import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ParametresInternes } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_PART_SECOURS, classePart } from '../cao/libelles-cao';
import { CeremonieResponsable } from './ceremonie-responsable';

/**
 * **Paramètres internes de la procédure** — écran SÉPARÉ de la fiche DAO, réservé au responsable de la procédure
 * (demande du 27/09, §B4 et §B5 ; plan Q6, Q7). Le quorum de déchiffrement (INT-SE-03), la date de la cérémonie des
 * clés (INT-SE-04), le responsable (INT-SE-05, posé par le serveur), et depuis le lot 2b le **dépositaire de la part de
 * secours** (ADR-0013, S3). Ces valeurs ne sont ni des champs de la fiche ni des jetons : le moteur de rendu ne les voit jamais.
 *
 * ⚠️ Lot 2a (04/10, Q11) — les **membres détenteurs d'une part ne se choisissent plus ici** : ce sont les membres de la
 * commission d'appel d'offres, désignés par la PRMP par une décision ; le responsable les lit. `nombreParts` en découle.
 * La section « Cérémonie des clés » (lot 2b) suit le formulaire.
 *
 * ⚠️ Le droit est **par procédure**, pas par rôle de session : la route est transverse, ouverte à tout profil
 * connecté, et c'est le serveur qui répond 403 à quiconque n'est pas le titulaire — Administrateur compris. L'écran
 * nomme ce refus au lieu de rediriger : la personne sait pourquoi elle ne lit rien. Le journal servi ici porte
 * les anciennes et nouvelles valeurs ; le journal global de l'Administrateur ne les porte pas (Q7).
 */
@Component({
  selector: 'app-parametres-internes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EtatErreur, CeremonieResponsable],
  template: `
    <section class="pi">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Procédure n° {{ idDmc() }} · responsable de la procédure</div>
          <h1 class="page-title">Paramètres internes de la remise électronique</h1>
        </div>
        <button type="button" class="btn btn-outline btn-sm" (click)="retour()">Retour</button>
      </header>
      <p class="page-role">
        Ce que la plateforme de dépôt saura de cette procédure sans jamais l'imprimer dans le dossier : combien de parts
        suffisent pour déchiffrer, quand la cérémonie des clés a lieu, qui garde la part de secours. Les détenteurs, eux,
        sont les membres de la commission d'appel d'offres, désignés par la PRMP. Seul le responsable de la procédure lit et
        modifie cet écran ; chaque modification est journalisée avec l'ancienne et la nouvelle valeur.
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-warning" role="status">
          <span><strong>Accès réservé au responsable de la procédure.</strong> Vous n'êtes pas désigné responsable de cette
          procédure : ses paramètres internes ne vous sont pas servis, même en lecture. La désignation se fait par
          l'Administrateur, depuis la fiche DAO.</span>
        </div>
      } @else if (contratAbsent()) {
        <div class="alert alert-info" role="status">
          <span><strong>Contrat en attente du backend</strong> (demande du 27/09, §B4) : la route des paramètres internes n'est
          pas encore servie.</span>
        </div>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les paramètres internes." (reessayer)="charger()" />
      } @else if (donnees(); as d) {
        <div class="pi__etat">
          <span class="badge" [class.badge-success]="d.etat === 'COMPLETS'" [class.badge-warning]="d.etat !== 'COMPLETS'">Paramètres {{ libelleEtat(d.etat) }}</span>
          @if (d.responsable; as r) { <span>Responsable : <strong>{{ r.nom }}</strong>&nbsp;<span class="cnm-mono">{{ r.im }}</span></span> }
          @else { <span class="pi__manque">Aucun responsable désigné</span> }
          @if (d.partDeSecours; as s) { <span class="badge" [class]="'badge ' + classePart(s.etat)">{{ secoursLibelles[s.etat] }}</span> }
        </div>
        @if (d.anomalies.length) {
          <ul class="pi__anomalies" aria-label="Règles non satisfaites">
            @for (a of d.anomalies; track a.regle) { <li><span class="cnm-mono">{{ a.regle }}</span> {{ a.message }}</li> }
          </ul>
        }
        @for (a of d.avertissements ?? []; track a.regle) { <p class="alert alert-warning" role="status"><span>{{ a.message }}</span></p> }

        <form class="card cnm-form pi__form" aria-label="Paramètres internes" (submit)="$event.preventDefault(); enregistrer()" novalidate>
          <div class="form-group">
            <span class="form-label">Membres de la commission d'appel d'offres détenteurs d'une part de clé <span class="pi__code">INT-SE-01</span></span>
            @if (d.membresCommission.length) {
              <ul class="pi__membres">
                @for (m of d.membresCommission; track m.im) { <li>{{ m.nom }} <span class="cnm-mono pi__profil">{{ m.im }}</span></li> }
              </ul>
            } @else {
              <p class="text-muted pi__lecture">Aucun membre : la PRMP n'a pas encore désigné la commission d'appel d'offres sur la fiche.</p>
            }
            <span class="form-hint">Désignés par la PRMP, par une décision ; ils se lisent ici, ils ne se choisissent pas.</span>
          </div>

          <div class="cnm-form-grid">
            <div class="form-group">
              <span class="form-label">Nombre de parts (n) <span class="pi__code">INT-SE-02</span></span>
              <div class="pi__lecture" id="pi-nombre-parts">{{ d.nombreParts }} <span class="pi__calc">+ 1 part de secours</span></div>
            </div>
            <label class="form-group">
              <span class="form-label">Quorum de déchiffrement (k) <span class="pi__code">INT-SE-03</span></span>
              <input class="form-control pi__court" id="pi-quorum" type="number" min="2" [max]="d.nombreParts || null" [value]="quorum() ?? ''" (input)="quorum.set($any($event.target).valueAsNumber || null)" />
              <span class="form-hint">Entre 2 et le nombre de membres ; proposé : {{ quorumPropose() }}. Un quorum égal au nombre de membres ne tolère aucune perte (S1).</span>
              @if (erreurDe('quorum'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Date de la cérémonie des clés <span class="pi__code">INT-SE-04</span></span>
              <input class="form-control" id="pi-ceremonie" type="datetime-local" [value]="dateCeremonie() ?? ''" (input)="dateCeremonie.set($any($event.target).value || null)" />
              <span class="form-hint">Avant la publication de l'avis (règle 8).</span>
              @if (erreurDe('dateCeremonie'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <div class="form-group">
              <span class="form-label">Responsable de la procédure <span class="pi__code">INT-SE-05</span></span>
              <div class="pi__lecture" id="pi-responsable">{{ d.responsable ? d.responsable.nom + ' (' + d.responsable.im + ')' : '—' }} <span class="pi__calc">désigné par l'Administrateur</span></div>
            </div>
          </div>

          <!-- ⚠️ V71 (05/10) — le dépositaire de la part de secours a un compte : invité par courriel, il génère lui-même sa clé. -->
          <fieldset class="form-group pi__depositaire">
            <legend class="form-label">Dépositaire de la part de secours (hors commission)</legend>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Nom</span>
                <input class="form-control" type="text" [value]="depNom()" (input)="depNom.set($any($event.target).value)" [class.error]="!!erreurDe('depositaire')" />
              </label>
              <label class="form-group">
                <span class="form-label">Organisme</span>
                <input class="form-control" type="text" [value]="depOrganisme()" (input)="depOrganisme.set($any($event.target).value)" />
              </label>
              <label class="form-group">
                <span class="form-label">Fonction</span>
                <input class="form-control" type="text" [value]="depFonction()" (input)="depFonction.set($any($event.target).value)" />
              </label>
              <label class="form-group">
                <span class="form-label">Contact</span>
                <input class="form-control" type="text" [value]="depContact()" (input)="depContact.set($any($event.target).value)" />
              </label>
              <label class="form-group">
                <span class="form-label">Adresse électronique (obligatoire)</span>
                <input class="form-control" type="email" autocomplete="off" [value]="depEmail()" (input)="depEmail.set($any($event.target).value)" [class.error]="!!erreurDe('depositaire.email')" />
                @if (erreurDe('depositaire.email'); as m) { <span class="form-error">{{ m }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Téléphone</span>
                <input class="form-control" type="tel" autocomplete="off" [value]="depTelephone()" (input)="depTelephone.set($any($event.target).value)" />
              </label>
            </div>
            @if (d.partDeSecours?.depositaire; as dep) {
              <p class="pi__compte">
                @if (dep.compte; as c) {
                  <span class="badge badge-neutral">{{ comptesDepositaire[c.etat] ?? c.etat }}</span>
                  <span class="cnm-mono text-sm">{{ c.idCompte }}</span>
                  @if (c.etat !== 'ACTIF' && c.etat !== 'ARCHIVE') {
                    <button type="button" class="btn btn-outline btn-sm" [disabled]="saving()" (click)="inviterDepositaire()">Renvoyer l'invitation</button>
                  }
                } @else {
                  <span class="text-sm pi__manque">Sans adresse : le dépositaire n'a pas de compte. Renseignez son adresse, puis enregistrez.</span>
                }
              </p>
            }
            <span class="form-hint">Libre : vous le désignez pour chaque procédure (arbitrage du pilote, 04/10). Il reçoit une invitation par courriel, puis génère lui-même sa clé de secours depuis son espace : personne d'autre ne voit sa phrase (décision du 05/10).</span>
            @if (erreurDe('depositaire'); as m) { <span class="form-error">{{ m }}</span> }
          </fieldset>

          <div class="pi__pied">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>

        @if (idDmc(); as id) {
          <!-- ⚠️ Lot 4 (V69) — la séance d'ouverture des plis, conduite par le responsable. -->
          <p class="pi__seance"><a class="btn btn-primary btn-sm" [routerLink]="['/procedure', id, 'seance']">Séance d'ouverture des plis</a></p>
          <app-ceremonie-responsable [idDmc]="id" [depositaire]="d.partDeSecours?.depositaire ?? null" [quorum]="d.quorum" (changement)="charger(true)" />
        }

        <h2 class="pi__h2">Journal des modifications</h2>
        @if (d.journal.length) {
          <div class="table-responsive">
            <table class="cnm-table pi__journal">
              <thead><tr><th scope="col">Date</th><th scope="col">Par</th><th scope="col">Champ</th><th scope="col">Ancienne valeur</th><th scope="col">Nouvelle valeur</th></tr></thead>
              <tbody>
                @for (e of d.journal; track $index) {
                  <tr><td class="cnm-mono">{{ e.date | date: 'dd/MM/yyyy HH:mm' }}</td><td>{{ e.nomActeur || e.acteur }}</td><td class="cnm-mono">{{ e.champ }}</td><td>{{ e.ancienneValeur ?? '—' }}</td><td>{{ e.nouvelleValeur ?? '—' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-muted">Aucune modification enregistrée.</p>
        }
      }
    </section>
  `,
  styles: `
    .pi { display: flex; flex-direction: column; gap: 1rem; }
    .pi__etat { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; font-size: 0.9rem; }
    .pi__manque { color: var(--warning-text, #8a5a00); font-weight: 600; }
    .pi__anomalies { margin: 0; padding-left: 1.2rem; color: var(--n-700); font-size: 0.88rem; }
    .pi__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .pi fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .pi__compte { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .pi__depositaire { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.5rem; border-top: 1px solid var(--n-200); }
    .pi__membres { margin: 0; padding-left: 1.1rem; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; }
    .pi__profil, .pi__code { color: var(--n-500); font-size: 0.78rem; font-weight: 400; }
    .pi__code { margin-left: 0.3rem; font-family: var(--font-mono, ui-monospace, monospace); }
    .pi__lecture { padding: 0.45rem 0.6rem; border-radius: 8px; background: var(--n-100); color: var(--n-700); font-size: 0.9rem; }
    .pi__calc { margin-left: 0.4rem; font-size: 0.74rem; font-style: italic; color: var(--n-500); }
    .pi__court { max-width: 8rem; }
    .pi__pied { display: flex; gap: 0.6rem; }
    .pi__h2 { margin: 0.5rem 0 0; font-size: 1.05rem; }
    .pi__journal { font-size: 0.86rem; }
    .pi__seance { margin: 0; }
  `,
})
export class ParametresInternesEcran implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly service = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly secoursLibelles = LIBELLES_ETAT_PART_SECOURS;
  readonly classePart = classePart;

  readonly idDmc = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly refuse = signal(false);
  readonly contratAbsent = signal(false);
  readonly erreur = signal(false);
  readonly donnees = signal<ParametresInternes | null>(null);
  readonly erreurs = signal<ReadonlyMap<string, string>>(new Map());

  // les valeurs saisies ; le reste est calculé ou posé par le serveur
  readonly quorum = signal<number | null>(null);
  readonly dateCeremonie = signal<string | null>(null);
  readonly depNom = signal('');
  readonly depOrganisme = signal('');
  readonly depFonction = signal('');
  readonly depContact = signal('');
  readonly depEmail = signal('');
  readonly depTelephone = signal('');
  readonly comptesDepositaire: Readonly<Record<string, string>> = { A_INVITER: 'Compte à inviter', INVITE: 'Invitation envoyée', ACTIF: 'Compte actif', ARCHIVE: 'Compte archivé' };
  /** « 3 sur 5 » : le quorum proposé suit la règle du défaut (3/5), borné à [2, n]. */
  readonly quorumPropose = computed(() => {
    const n = this.donnees()?.nombreParts ?? 0;
    return n ? Math.min(n, Math.max(2, Math.ceil((n * 3) / 5))) : 3;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('idDmc'));
      this.idDmc.set(Number.isFinite(id) && id > 0 ? id : null);
      this.charger();
    });
  }

  /** `silencieux` : relecture après un geste de la cérémonie, sans repasser par l'indicateur de chargement. */
  charger(silencieux = false): void {
    const id = this.idDmc();
    if (id == null) return;
    if (!silencieux) this.loading.set(true);
    this.refuse.set(false);
    this.contratAbsent.set(false);
    this.erreur.set(false);
    this.service.parametresInternes(id).subscribe({
      next: (d) => {
        this.poser(d);
        this.loading.set(false);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.loading.set(false);
        if (e.status === 403) this.refuse.set(true);
        else if (e.status === 404) this.contratAbsent.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private poser(d: ParametresInternes): void {
    this.donnees.set(d);
    this.quorum.set(d.quorum ?? null);
    this.dateCeremonie.set(d.dateCeremonie ?? null);
    const dep = d.partDeSecours?.depositaire ?? null;
    this.depNom.set(dep?.nom ?? '');
    this.depOrganisme.set(dep?.organisme ?? '');
    this.depFonction.set(dep?.fonction ?? '');
    this.depContact.set(dep?.contact ?? '');
    this.depEmail.set(dep?.email ?? '');
    this.depTelephone.set(dep?.telephone ?? '');
    this.erreurs.set(new Map());
  }

  libelleEtat(etat: ParametresInternes['etat']): string {
    return etat === 'COMPLETS' ? 'complets' : etat === 'INCOMPLETS' ? 'incomplets' : 'à saisir';
  }
  erreurDe(cle: string): string | null {
    return this.erreurs().get(cle) ?? null;
  }
  retour(): void {
    this.location.back();
  }

  enregistrer(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    const nom = this.depNom().trim();
    const depositaire = nom
      ? {
          nom,
          organisme: this.depOrganisme().trim() || null,
          fonction: this.depFonction().trim() || null,
          contact: this.depContact().trim() || null,
          email: this.depEmail().trim() || null,
          telephone: this.depTelephone().trim() || null,
        }
      : null;
    this.service.enregistrerParametresInternes(id, { quorum: this.quorum(), dateCeremonie: this.dateCeremonie(), depositaire }).subscribe({
      next: (d) => {
        this.saving.set(false);
        this.poser(d);
        this.toast.success(`Paramètres internes enregistrés — ${this.libelleEtat(d.etat)}.`);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        const parChamp = erreursParChamp(e);
        if (e.status === 400 && parChamp.size) {
          this.erreurs.set(parChamp);
          return;
        }
        this.toast.error(this.motif(e));
      },
    });
  }

  /** ⚠️ V71 — renvoie l'invitation du dépositaire (code d'activation par courriel). */
  inviterDepositaire(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.service.inviterDepositaire(id).subscribe({
      next: (d) => {
        this.saving.set(false);
        this.poser(d);
        this.toast.success('L’invitation est renvoyée au dépositaire.');
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        this.toast.error(this.motif(e));
      },
    });
  }

  /** Notre mot pour un code connu, le message du serveur sinon. */
  private motif(e: ApiError | HttpErrorResponse): string {
    switch (codeErreur(e)) {
      case 'MEMBRE_COMMISSION':
        return 'Le responsable de la procédure ne peut pas détenir une part de clé.';
      case 'FICHE_VALIDEE':
        return 'La fiche est validée en remise électronique : ses paramètres internes ne se modifient plus.';
      case 'DEJA_ACTIF':
        return 'Le compte du dépositaire est déjà actif : il se connecte avec son adresse.';
      case 'DEPOSITAIRE_ABSENT':
        return 'Renseignez l’adresse du dépositaire, enregistrez, puis renvoyez l’invitation.';
      case 'DEPOSITAIRE_INCOMPATIBLE':
        return 'Cette personne ne peut pas être dépositaire : PRMP, UGPM, responsable, membre de la CAO de la procédure ou candidat.';
      case 'CEREMONIE_CLOSE':
        return 'La cérémonie des clés est close : rouvrez-la (section ci-dessous) avant de changer le quorum, la date ou le dépositaire.';
      default:
        return e.status === 403 ? 'Seul le responsable de la procédure modifie ces paramètres.' : e.message || 'Enregistrement impossible.';
    }
  }
}
