import { ChangeDetectionStrategy, Component, DOCUMENT, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { EtatSeance, Seance } from '../../models';
import { SeanceService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { ApportParts } from './apport-parts';
import { LectureSeance } from './lecture-seance';
import { SignaturesPv } from './signatures-pv';

export const LIBELLES_ETAT_SEANCE: Readonly<Record<EtatSeance, string>> = {
  A_VENIR: 'À venir',
  OUVERTE: 'Ouverte — les parts arrivent',
  DECHIFFREE: 'Offres ouvertes',
  PV_A_SIGNER: 'PV à signer par les membres présents',
  ILLISIBLE: 'Offres illisibles (constat)',
  CLOSE: 'Close — PV signé',
};

/**
 * Les offres sont-elles ouvertes ? Après le déchiffrement, le serveur efface les parts (gardées en mémoire seulement) et sert
 * `partsApportees = false` : compter les membres afficherait « 0 / 2 ». Recette de bout en bout du 04/10, fiche 40.
 */
export function offresOuvertes(s: Seance): boolean {
  return s.etat === 'DECHIFFREE' || s.etat === 'PV_A_SIGNER' || s.etat === 'CLOSE';
}

/** « 1 / 2 » tant que les parts arrivent ; « atteint » une fois les offres ouvertes. */
export function quorumLibelle(s: Seance): string {
  if (offresOuvertes(s)) return `atteint (${s.quorum})`;
  return `${s.membres.filter((m) => m.partsApportees).length + (s.secoursEmploye ? 1 : 0)} / ${s.quorum}`;
}

/**
 * La **séance d'ouverture des plis** (lot 4, V69), `/procedure/:idDmc/seance` — route transverse, garde par identité au serveur.
 * - Le **responsable de la procédure** la conduit : ouvrir à l'heure, noter les présences, apporter la **part de secours** (S3,
 *   motif), suivre le quorum, lire (mode projection), produire le **PV d'ouverture**, ou **constater l'illisibilité** (S5).
 *   ⚠️ V71 : la part de secours se **demande** (motif) et le dépositaire l'apporte de son espace ; l'ancien geste (le
 *   responsable l'apporte, phrase dictée) ne vaut plus que pour une clé générée chez lui avant le 05/10.
 *   ⚠️ V70 : le PV produit attend ensuite la signature des membres présents (`PV_A_SIGNER`) ; le responsable la suit, et ne
 *   constate un empêchement que si le président est lui-même empêché.
 * - La **PRMP** et l'**UGPM** y lisent l'état, puis la lecture et le PV — rien d'une offre avant le déchiffrement.
 * - ⚠️ Arbitrage du pilote (04/10) : personne n'ouvre ici les **pièces** des offres, pas même le responsable — elles sont
 *   réservées aux membres de la CAO, dans leur espace (`demande-backend-2026-10-04-arbitrages-soumission-en-ligne` §B1).
 * Les membres de la CAO apportent leurs parts depuis leur espace `/cao`. L'état se relit toutes les cinq secondes tant que la
 * séance attend des parts. Le serveur reste l'autorité : un geste refusé est nommé, jamais deviné.
 */
@Component({
  selector: 'app-seance-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, ApportParts, LectureSeance, SignaturesPv],
  template: `
    <section class="se">
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Procédure n° {{ idDmc }} · {{ conduite() ? 'responsable de la procédure' : 'lecture' }}</div>
          <h1 class="page-title">Séance d'ouverture des plis</h1>
        </div>
        @if (lienFiche()) { <a class="btn btn-outline btn-sm" [routerLink]="lienFiche()!">Fiche DAO</a> }
      </header>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de la séance…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La séance est réservée au responsable de la procédure, aux membres de la commission, et à la PRMP de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La séance n'a pas pu être chargée." (reessayer)="charger()" />
      } @else if (seance(); as s) {
        <div class="se__etat">
          <span class="badge" [class.badge-success]="s.etat === 'DECHIFFREE' || s.etat === 'CLOSE'" [class.badge-info]="s.etat === 'OUVERTE' || s.etat === 'PV_A_SIGNER'" [class.badge-danger]="s.etat === 'ILLISIBLE'" [class.badge-neutral]="s.etat === 'A_VENIR'">{{ etats[s.etat] }}</span>
          @if (s.heureOuverture) { <span class="text-sm">Heure d'ouverture : <strong>{{ dateHeure(s.heureOuverture) }}</strong></span> }
          @if (s.ouverteDans != null && s.ouverteDans > 0) { <span class="text-sm text-muted">dans {{ duree(s.ouverteDans) }}</span> }
          <span class="text-sm">Quorum : <strong>{{ quorum() }}</strong> détenteurs{{ s.secoursEmploye ? ' (part de secours employée)' : '' }}</span>
        </div>
        @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }

        <div class="se__grille">
          <section class="card se__bloc" aria-labelledby="se-membres">
            <h2 id="se-membres" class="se__h2">Membres de la commission</h2>
            <ul class="se__membres">
              @for (m of s.membres; track m.im) {
                <li>
                  @if (conduite() && s.etat === 'OUVERTE') {
                    <label class="se__case"><input type="checkbox" [checked]="m.present" (change)="basculerPresence(m.im, $any($event.target).checked)" /> {{ m.nom }}{{ m.president ? ' — président' : '' }}</label>
                  } @else { <span>{{ m.nom }}{{ m.president ? ' — président' : '' }}{{ m.present ? ' · présent' : '' }}</span> }
                  @if (!offresOuvertes(s)) {
                    <span class="badge" [class.badge-success]="m.partsApportees" [class.badge-neutral]="!m.partsApportees">{{ m.partsApportees ? 'parts apportées' : 'en attente' }}</span>
                  }
                </li>
              }
            </ul>
            @if (s.autres.length) { <p class="text-sm">Autres présents : {{ autresTexte() }}</p> }
            @if (conduite() && s.etat === 'OUVERTE') {
              <div class="se__autre">
                <input class="form-control" type="text" placeholder="Nom d'un autre présent" aria-label="Nom d'un autre présent" [value]="autreNom()" (input)="autreNom.set($any($event.target).value)" />
                <input class="form-control" type="text" placeholder="Qualité (ex. représentant de la PRMP)" aria-label="Qualité de l'autre présent" [value]="autreQualite()" (input)="autreQualite.set($any($event.target).value)" />
                <button type="button" class="btn btn-sm btn-secondary" [disabled]="!autreNom().trim() || travail()" (click)="ajouterAutre()">Ajouter</button>
              </div>
            }
          </section>

          <section class="card se__bloc" aria-labelledby="se-offres">
            <h2 id="se-offres" class="se__h2">Offres reçues ({{ s.offres.length }})</h2>
            @if (s.offres.length) {
              <ul class="se__offres">@for (o of s.offres; track $index) { <li>N° {{ o.numero ?? '—' }}{{ o.lot ? ' · lot ' + o.lot : '' }} — {{ o.etat }} · {{ o.partsRecues }} part(s)</li> }</ul>
            } @else { <p class="text-sm text-muted">Aucune offre déposée : la séance conduit à un PV de carence.</p> }
          </section>
        </div>

        @if (conduite()) {
          <div class="se__actions">
            @if (s.etat === 'A_VENIR') {
              <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrir()">Ouvrir la séance</button>
            }
            @if (s.etat === 'OUVERTE') {
              <button type="button" class="btn btn-outline" (click)="secoursOuvert.set(!secoursOuvert())" [attr.aria-expanded]="secoursOuvert()">Part de secours…</button>
              <button type="button" class="btn btn-outline" (click)="constatOuvert.set(!constatOuvert())" [attr.aria-expanded]="constatOuvert()">Constater l'illisibilité…</button>
            }
            @if (s.etat === 'DECHIFFREE') {
              <button type="button" class="btn btn-outline" (click)="projection.set(!projection())">{{ projection() ? 'Quitter la projection' : 'Projeter la lecture' }}</button>
            }
          </div>
          @if (secoursOuvert() && s.etat === 'OUVERTE') {
            @if (s.secoursGenerePar === 'RESPONSABLE') {
              <!-- Clé de l'ancien geste (avant le 05/10) : le responsable l'apporte lui-même, la phrase dictée du pli. -->
              <div class="card se__bloc"><app-apport-parts [idDmc]="idDmc" role="SECOURS" (apporte)="apres($event, 'La part de secours est apportée.')" /></div>
            } @else {
              <!-- ⚠️ V71 : le responsable demande, avec le motif porté au PV ; le dépositaire apporte depuis son espace. -->
              <div class="card se__bloc">
                <p class="text-sm">Le dépositaire est prévenu par courriel ; il apporte la part de secours depuis son espace, sa phrase ne quittant pas son poste. Le motif est porté au procès-verbal.</p>
                <label class="form-group"><span class="form-label">Motif de l'emploi de la part de secours</span><input class="form-control" type="text" [value]="motifSecours()" (input)="motifSecours.set($any($event.target).value)" /></label>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="!motifSecours().trim() || travail()" (click)="demanderSecours()">{{ s.secoursDemande ? 'Renouveler la demande' : 'Demander la part de secours' }}</button>
              </div>
            }
          }
          @if (s.secoursDemande; as d) {
            <p class="alert alert-info se__demande" role="status"><span>Part de secours demandée le {{ dateHeure(d.date) }} — motif : {{ d.motif }}.{{ s.etat === 'OUVERTE' && !s.secoursEmploye ? ' En attente du dépositaire.' : '' }}</span></p>
          }
          @if (constatOuvert() && s.etat === 'OUVERTE') {
            <div class="card se__bloc">
              <p class="text-sm">Le quorum ne peut plus être atteint, part de secours comprise : la séance le constate, un PV de constat est produit, les soumissionnaires sont avertis, la procédure est à relancer.</p>
              <label class="form-group"><span class="form-label">Motif du constat</span><textarea class="form-control" rows="2" [value]="motifConstat()" (input)="motifConstat.set($any($event.target).value)"></textarea></label>
              <button type="button" class="btn btn-danger btn-sm" [disabled]="!motifConstat().trim() || travail()" (click)="constater()">Constater l'illisibilité des offres</button>
            </div>
          }
        }

        @if (offresOuvertes(s)) {
          <h2 class="se__h2">Lecture des offres</h2>
          <!-- Arbitrage du pilote (04/10) : les pièces s'ouvrent pour les membres de la CAO seulement, depuis /cao. -->
          <app-lecture-seance [idDmc]="idDmc" [piecesOuvrables]="false" [projection]="projection()" />
        }

        @if (conduite() && s.etat === 'DECHIFFREE') {
          <section class="card se__bloc" aria-labelledby="se-pv">
            <h2 id="se-pv" class="se__h2">Procès-verbal d'ouverture</h2>
            <label class="form-group"><span class="form-label">Observations de la séance (facultatif)</span><textarea class="form-control" rows="3" [value]="observations()" (input)="observations.set($any($event.target).value)"></textarea></label>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="produirePv()">Produire le PV d'ouverture</button>
          </section>
        }
        @if (s.pv?.produit) {
          <!-- ⚠️ V70 (§B2) : le PV se signe par les membres présents, depuis leur espace ; publié à la dernière signature. -->
          <section class="card se__bloc" aria-label="Signatures du PV d'ouverture">
            <app-signatures-pv [idDmc]="idDmc" [seance]="s" [vue]="conduite() ? 'responsable' : 'lecture'" (geste)="seance.set($event)" />
            <div class="se__actions">
              <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="telechargerPv()">Enregistrer le PV (PDF)</button>
              @if (s.pv?.publie) { <span class="text-sm text-muted">Publié sur la procédure en ligne (extrait sans les alertes).</span> }
              @else if (!s.pv?.signe) { <span class="text-sm text-muted">L'extrait public, s'il est prévu, paraît à la dernière signature.</span> }
            </div>
          </section>
        }
      }
    </section>
  `,
  styles: `
    .se { display: flex; flex-direction: column; gap: 1rem; }
    .se__etat { display: flex; gap: 0.9rem; align-items: center; flex-wrap: wrap; }
    .se__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 1rem; }
    .se__bloc { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .se__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .se__membres { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .se__membres li { display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; font-size: var(--text-sm); }
    .se__case { display: inline-flex; gap: 0.4rem; align-items: center; }
    .se__autre { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.4rem; }
    .se__offres { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); }
    .se__demande { margin: 0; }
    .se__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
    @media (max-width: 600px) { .se__autre { grid-template-columns: 1fr; } }
  `,
})
export class SeanceEcran implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SeanceService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly etats = LIBELLES_ETAT_SEANCE;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly seance = signal<Seance | null>(null);
  readonly travail = signal(false);
  readonly message = signal<string | null>(null);
  readonly secoursOuvert = signal(false);
  readonly constatOuvert = signal(false);
  readonly motifConstat = signal('');
  readonly motifSecours = signal('');
  readonly observations = signal('');
  readonly projection = signal(false);
  readonly autreNom = signal('');
  readonly autreQualite = signal('');
  private sondage: ReturnType<typeof setInterval> | undefined;

  /** PRMP et UGPM lisent ; tout autre lecteur servi est le responsable (le serveur refuse les autres). */
  readonly conduite = computed(() => !['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  readonly lienFiche = computed(() => (['PRMP', 'UGPM'].includes(this.auth.role() ?? '') ? ['/prmp', 'dao', this.idDmc] : null));
  readonly quorum = computed(() => {
    const s = this.seance();
    return s ? quorumLibelle(s) : '';
  });
  readonly offresOuvertes = offresOuvertes;
  readonly autresTexte = computed(() => (this.seance()?.autres ?? []).map((a) => `${a.nom}${a.qualite ? ' (' + a.qualite + ')' : ''}`).join(' ; '));

  constructor() {
    inject(DOCUMENT).title = 'Séance d’ouverture des plis — PRS 2.0';
  }

  ngOnInit(): void {
    this.charger();
    this.sondage = setInterval(() => {
      const e = this.seance()?.etat;
      // ⚠️ V70 : on relit aussi pendant que les signatures du PV arrivent.
      if (e === 'OUVERTE' || e === 'A_VENIR' || e === 'PV_A_SIGNER') this.relire();
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.refuse.set(false);
    this.service.lire(this.idDmc).subscribe({
      next: (s) => {
        this.seance.set(s);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private relire(): void {
    this.service.lire(this.idDmc).subscribe({ next: (s) => this.seance.set(s), error: () => {} });
  }

  duree(secondes: number): string {
    const m = Math.ceil(secondes / 60);
    const h = Math.floor(m / 60);
    return h ? `${h} h ${m % 60} min` : `${m} min`;
  }

  apres(s: Seance, texte: string): void {
    this.travail.set(false);
    this.seance.set(s);
    this.secoursOuvert.set(false);
    this.constatOuvert.set(false);
    this.toast.success(texte);
  }

  private echec(e: ApiError): void {
    this.travail.set(false);
    const details = (e.raw?.error as { details?: Record<string, unknown> } | null)?.details ?? {};
    switch (codeErreur(e)) {
      case 'SEANCE_PREMATUREE':
        this.message.set(`La séance ne s'ouvre qu'à l'heure d'ouverture des plis${details['heureOuverture'] ? ' : ' + dateHeureFr(String(details['heureOuverture'])) : ''}.`);
        return;
      case 'DEPOTS_NON_CLOS':
        this.message.set("La date limite des dépôts n'est pas passée.");
        return;
      case 'QUORUM_POSSIBLE':
        this.message.set(`Le quorum reste atteignable (${details['possibles'] ?? '?'} détenteurs possibles pour un quorum de ${details['quorum'] ?? '?'}) : l'illisibilité ne se constate pas.`);
        return;
      case 'SECOURS_INUTILE':
        this.message.set('La part de secours est déjà apportée.');
        return;
      case 'GESTE_DU_RESPONSABLE':
        this.message.set('Cette clé de secours a été générée chez le responsable avant le 05/10 : apportez-la vous-même, avec la phrase du pli.');
        return;
      case 'MOTIF_ABSENT':
        this.message.set("Le motif de l'emploi de la part de secours est obligatoire.");
        return;
      case 'SEANCE_CLOSE':
        this.message.set('Le PV est produit : les présences ne se modifient plus.');
        return;
      case 'SEANCE_NON_DECHIFFREE':
        this.message.set("Les offres ne sont pas encore ouvertes : le quorum n'est pas atteint.");
        return;
    }
    this.message.set(e.message || "Le geste n'a pas abouti.");
  }

  ouvrir(): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.ouvrir(this.idDmc).subscribe({ next: (s) => this.apres(s, 'La séance est ouverte : les membres peuvent apporter leurs parts.'), error: (e: ApiError) => this.echec(e) });
  }

  private envoyerPresences(presents: string[], autres: { nom: string; qualite: string | null }[]): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.presences(this.idDmc, presents, autres).subscribe({
      next: (s) => {
        this.travail.set(false);
        this.seance.set(s);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  basculerPresence(im: string, present: boolean): void {
    const s = this.seance();
    if (!s) return;
    const presents = s.membres.filter((m) => (m.im === im ? present : m.present)).map((m) => m.im);
    this.envoyerPresences(presents, s.autres);
  }

  ajouterAutre(): void {
    const s = this.seance();
    if (!s || !this.autreNom().trim()) return;
    this.envoyerPresences(
      s.membres.filter((m) => m.present).map((m) => m.im),
      [...s.autres, { nom: this.autreNom().trim(), qualite: this.autreQualite().trim() || null }],
    );
    this.autreNom.set('');
    this.autreQualite.set('');
  }

  /** ⚠️ V71 — la demande de la part de secours ; le dépositaire, notifié, l'apporte depuis son espace. */
  demanderSecours(): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.demanderSecours(this.idDmc, this.motifSecours().trim()).subscribe({
      next: (s) => {
        this.motifSecours.set('');
        this.apres(s, 'La part de secours est demandée : le dépositaire est prévenu.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  constater(): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.constaterIllisible(this.idDmc, this.motifConstat().trim()).subscribe({ next: (s) => this.apres(s, "L'illisibilité est constatée ; le PV de constat est produit."), error: (e: ApiError) => this.echec(e) });
  }

  produirePv(): void {
    this.travail.set(true);
    this.message.set(null);
    this.service.produirePv(this.idDmc, this.observations().trim() || null).subscribe({ next: (s) => this.apres(s, "Le PV d'ouverture est produit : il attend la signature des membres présents."), error: (e: ApiError) => this.echec(e) });
  }

  telechargerPv(): void {
    this.travail.set(true);
    this.service.pv(this.idDmc).subscribe({
      next: (b) => {
        this.travail.set(false);
        telechargerBlob(b, `pv-ouverture-procedure-${this.idDmc}.pdf`);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }
}
