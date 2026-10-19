import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import { Cao, CompteMembreCao, MembreCaoCorps, OrigineMembreCao } from '../../models';
import { CaoService, FicheMarcheService } from '../../services';
import { EnteteProcedure } from './entete-procedure';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ETAT_CAO, LIBELLES_ETAT_COMPTE_CAO, LIBELLES_ORIGINE, MESSAGE_UN_SEUL_EXPERT, classeCao } from '../cao/libelles-cao';

/** Une ligne du tableau des membres, telle qu'elle se saisit ; `cle` est locale, `id` vient du serveur. */
interface Ligne {
  cle: number;
  id: number | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  origine: OrigineMembreCao | '';
  fonction: string;
  service: string;
  organisme: string;
  domaine: string;
  president: boolean;
  compte: CompteMembreCao | null;
  /** Un ancien « expert adjoint » servi par V67 : il n'a ni part ni compte, l'écran demande son origine ou son retrait (§B6). */
  ancienExpertAdjoint: boolean;
}

const DECISION_MAX_MO = 10;
const ORIGINES: readonly OrigineMembreCao[] = ['ENTITE_CONTRACTANTE', 'EXPERT_OBJET'];

/**
 * **Commission d'appel d'offres** d'une fiche DAO en remise électronique (lot 2a, V67, décision Q11) — l'écran de la
 * PRMP, ⚠️ et de l'UGPM depuis V70 (arbitrage du pilote, 04/10 : elle prépare et saisit, la décision reste celle de la PRMP) : la décision de nomination (référence, date, PDF), les membres avec leur origine (entité contractante, ou expert
 * de l'objet du DAO — **un seul expert au plus**, pilote 04/10), **un** président, et l'état des comptes : la désignation
 * crée le compte `MEMBRE_CAO` et envoie l'invitation par courriel. Tous les membres détiennent une part. Une CAO par
 * DAO ; une cérémonie close la fige (409 `CEREMONIE_CLOSE` : le responsable rouvre d'abord). Les exclusions (PRMP, UGPM,
 * contrôleurs de la CNM, candidats, comptes internes) sont dites par le serveur, jamais devinées ici.
 */
@Component({
  selector: 'app-cao-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, EnteteProcedure],
  template: `
    <section class="cao">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Commission d'appel d'offres</h1>
      </header>
      <p class="page-role">
        Les membres désignés par la décision de la PRMP — saisie par elle ou par l'UGPM — détiennent chacun une part de la clé qui ouvrira
        les offres : des agents de votre entité, et au plus un expert de l'objet du marché. Chacun active son compte par l'invitation reçue
        par courriel, puis publie sa clé à la cérémonie.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La commission se lit par qui lit la fiche, et se saisit par la PRMP ou l'UGPM de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La commission n'a pas pu être chargée." (reessayer)="charger()" />
      } @else {
        <div class="cao__etat">
          <span class="badge" [class]="'badge ' + classeCao(cao()?.etat)">Commission {{ etats[cao()?.etat ?? 'ABSENTE'] }}</span>
          <span class="text-sm text-muted">{{ lignes().length }} membre{{ lignes().length > 1 ? 's' : '' }}{{ president() ? ' · présidée par ' + president() : '' }}</span>
          @for (a of cao()?.anomalies ?? []; track a.regle) { <span class="cao__anomalie">{{ a.message }}</span> }
        </div>
        <!-- ⚠️ 19/10 (pilote) — une cérémonie close fige la composition (409 CEREMONIE_CLOSE) : l'écran passe en lecture et le dit. -->
        @if (fige()) {
          <div class="alert alert-info" role="status">
            <span><strong>La cérémonie des clés est close : la composition de la commission est figée.</strong> Pour la changer, le responsable de la
            procédure rouvre la cérémonie, et chaque membre republie sa clé. La décision signée peut encore être jointe.</span>
          </div>
        }
        @if (erreurGlobale(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <form class="cao__form" (submit)="$event.preventDefault(); enregistrer()" novalidate aria-label="Désignation de la commission">
          <section class="card cao__bloc" aria-labelledby="cao-decision">
            <h2 id="cao-decision" class="cao__h2">Décision de nomination</h2>
            <div class="cao__decision-grille">
              @if (fige()) {
                <div class="cao__lu"><span class="form-label">Référence de la décision</span><strong>{{ reference() || '—' }}</strong></div>
                <div class="cao__lu"><span class="form-label">Date de la décision</span><strong>{{ dateDecision() ? date(dateDecision()) : '—' }}</strong></div>
              } @else {
                <label class="form-group">
                  <span class="form-label">Référence de la décision</span>
                  <input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" [class.error]="!!erreurDe('decision.reference')" />
                  @if (erreurDe('decision.reference'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
                <label class="form-group">
                  <span class="form-label">Date de la décision</span>
                  <input class="form-control" type="date" [value]="dateDecision()" (input)="dateDecision.set($any($event.target).value)" [class.error]="!!erreurDe('decision.date')" />
                  @if (erreurDe('decision.date'); as m) { <span class="form-error">{{ m }}</span> }
                </label>
              }
              <div class="cao__pdf">
                <span class="form-label">Décision signée (PDF, {{ decisionMaxMo }} Mo au plus)</span>
                @if (cao()?.decision?.fichier) {
                  <span class="cao__pdf-ok">Jointe — en joindre une nouvelle la remplace.</span>
                } @else {
                  <span class="cao__pdf-ko">Non jointe : facultative, mais attendue.</span>
                }
                <div class="cao__pdf-choix">
                  <input class="form-control" type="file" accept="application/pdf" aria-label="Fichier PDF de la décision signée" (change)="choisirDecision($event)" />
                  <button type="button" class="btn btn-secondary btn-sm" [disabled]="!fichier() || saving()" (click)="joindreDecision()">Joindre</button>
                </div>
                @if (fichierErreur(); as m) { <span class="form-error">{{ m }}</span> }
              </div>
            </div>
          </section>

          <section class="cao__bloc-membres" aria-labelledby="cao-membres">
            <h2 id="cao-membres" class="cao__h2">Membres</h2>
            @if (erreurDe('membres'); as m) { <span class="form-error">{{ m }}</span> }
            <ul class="cao__membres">
              @for (l of lignes(); track l.cle; let i = $index) {
                <li class="card cao__membre" [class.cao__membre--president]="l.president" [class.cao__membre--ancien]="l.ancienExpertAdjoint">
                  <div class="cao__membre-tete">
                    <span class="cao__avatar" aria-hidden="true">{{ initiales(l) }}</span>
                    <div class="cao__membre-nom">
                      <strong>{{ (l.nom + ' ' + l.prenom).trim() || 'Membre ' + (i + 1) }}</strong>
                      <span class="text-xs text-muted">{{ l.origine ? libOrigine[l.origine] : 'Origine à choisir' }}</span>
                    </div>
                    @if (l.president) { <span class="badge badge-info">Président</span> }
                    @if (l.compte; as c) {
                      <span class="badge" [class.badge-success]="c.etat === 'ACTIF'" [class.badge-info]="c.etat === 'INVITE'" [class.badge-neutral]="c.etat === 'A_INVITER' || c.etat === 'ARCHIVE'" [attr.title]="c.dateInvitation ? 'Invité le ' + dateHeure(c.dateInvitation) : null">{{ libCompte[c.etat] }}</span>
                    } @else {
                      <span class="badge badge-neutral">Compte créé à l’enregistrement</span>
                    }
                  </div>

                  @if (fige()) {
                    <dl class="cao__dl">
                      <dt>Fonction</dt><dd>{{ l.fonction || '—' }}</dd>
                      @if (l.origine === 'EXPERT_OBJET') {
                        <dt>Organisme</dt><dd>{{ l.organisme || '—' }}</dd>
                        <dt>Domaine</dt><dd>{{ l.domaine || '—' }}</dd>
                      } @else {
                        <dt>Service</dt><dd>{{ l.service || '—' }}</dd>
                      }
                      <dt>Adresse</dt><dd class="cao__email">{{ l.email || '—' }}</dd>
                      <dt>Téléphone</dt><dd>{{ l.telephone || '—' }}</dd>
                    </dl>
                  } @else {
                    @if (l.ancienExpertAdjoint) { <p class="form-hint">Ancien expert adjoint : donnez-lui son origine (il détiendra une part), ou retirez-le.</p> }
                    <div class="cao__champs">
                      <label class="form-group">
                        <span class="form-label">Origine</span>
                        <select class="form-control" (change)="poser(l.cle, 'origine', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].origine')">
                          <option value="" [selected]="!l.origine">— Choisir —</option>
                          @for (o of origines; track o) { <option [value]="o" [selected]="l.origine === o">{{ libOrigine[o] }}</option> }
                        </select>
                        @if (erreurDe('membres[' + i + '].origine'); as m) { <span class="form-error">{{ m }}</span> }
                      </label>
                      <label class="form-group">
                        <span class="form-label">Fonction</span>
                        <input class="form-control" type="text" [value]="l.fonction" (input)="poser(l.cle, 'fonction', $any($event.target).value)" />
                      </label>
                      <label class="form-group">
                        <span class="form-label">Nom</span>
                        <input class="form-control" type="text" [value]="l.nom" (input)="poser(l.cle, 'nom', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].nom')" />
                        @if (erreurDe('membres[' + i + '].nom'); as m) { <span class="form-error">{{ m }}</span> }
                      </label>
                      <label class="form-group">
                        <span class="form-label">Prénom</span>
                        <input class="form-control" type="text" [value]="l.prenom" (input)="poser(l.cle, 'prenom', $any($event.target).value)" />
                      </label>
                      <label class="form-group">
                        <span class="form-label">Adresse électronique</span>
                        <input class="form-control" type="email" [value]="l.email" (input)="poser(l.cle, 'email', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].email')" />
                        @if (erreurDe('membres[' + i + '].email'); as m) { <span class="form-error">{{ m }}</span> }
                      </label>
                      <label class="form-group">
                        <span class="form-label">Téléphone</span>
                        <input class="form-control" type="tel" [value]="l.telephone" (input)="poser(l.cle, 'telephone', $any($event.target).value)" />
                      </label>
                      @if (l.origine === 'EXPERT_OBJET') {
                        <label class="form-group">
                          <span class="form-label">Organisme</span>
                          <input class="form-control" type="text" placeholder="ex. cabinet, université" [value]="l.organisme" (input)="poser(l.cle, 'organisme', $any($event.target).value)" />
                        </label>
                        <label class="form-group">
                          <span class="form-label">Domaine</span>
                          <input class="form-control" type="text" placeholder="ex. génie civil" [value]="l.domaine" (input)="poser(l.cle, 'domaine', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].domaine')" />
                          @if (erreurDe('membres[' + i + '].domaine'); as m) { <span class="form-error">{{ m }}</span> }
                        </label>
                      } @else {
                        <label class="form-group cao__large">
                          <span class="form-label">Service</span>
                          <input class="form-control" type="text" placeholder="ex. Direction des affaires financières" [value]="l.service" (input)="poser(l.cle, 'service', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].service')" />
                          @if (erreurDe('membres[' + i + '].service'); as m) { <span class="form-error">{{ m }}</span> }
                        </label>
                      }
                    </div>
                    <div class="cao__membre-pied">
                      <label class="cao__case"><input type="radio" name="president" [checked]="l.president" (change)="presider(l.cle)" /> Président de la commission</label>
                      @if (l.compte && l.compte.etat !== 'ACTIF' && l.id != null) {
                        <button type="button" class="btn btn-sm btn-outline" [disabled]="saving()" (click)="inviter(l)">Renvoyer l'invitation</button>
                      }
                      <button type="button" class="btn btn-sm btn-outline cao__retirer" (click)="retirer(l.cle)">Retirer ce membre</button>
                    </div>
                  }
                </li>
              }
            </ul>
          </section>

          @if (!fige()) {
            <div class="card cao__pied">
              <button type="button" class="btn btn-secondary btn-sm" (click)="ajouter()">Ajouter un membre</button>
              <span class="text-sm text-muted">Au moins deux membres, un seul président ; un expert de l'objet au plus{{ nbExperts() ? ' (' + nbExperts() + ' saisi' + (nbExperts() > 1 ? 's' : '') + ')' : '' }}. Un membre nouveau reçoit son invitation à l'enregistrement ; un membre retiré l'est à l'enregistrement.</span>
              <button type="submit" class="btn btn-primary cao__enregistrer" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer la commission' }}</button>
            </div>
          }
        </form>
      }
    </section>
  `,
  styles: `
    .cao { display: flex; flex-direction: column; gap: 1rem; }
    .cao__etat { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .cao__anomalie { font-size: var(--text-sm); color: var(--warning-text); }
    .cao__form { display: flex; flex-direction: column; gap: 1rem; }
    .cao__bloc { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .cao__h2 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-600); }
    .cao__decision-grille { display: grid; grid-template-columns: minmax(0, 2fr) minmax(10rem, 1fr) minmax(0, 2fr); gap: 0.9rem 1.2rem; align-items: start; }
    .cao__lu { display: flex; flex-direction: column; gap: 0.25rem; }
    .cao__pdf { display: flex; flex-direction: column; gap: 0.3rem; }
    .cao__pdf-ok { font-size: var(--text-sm); color: var(--success-text); font-weight: 600; }
    .cao__pdf-ko { font-size: var(--text-sm); color: var(--warning-text); }
    .cao__pdf-choix { display: flex; gap: 0.5rem; align-items: center; }
    .cao__pdf-choix .form-control { flex: 1; min-width: 0; }
    .cao__bloc-membres { display: flex; flex-direction: column; gap: 0.6rem; }
    .cao__membres { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr)); gap: 0.8rem; }
    .cao__membre { padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.7rem; border-top: 3px solid var(--n-300); }
    .cao__membre--president { border-top-color: var(--p-600); }
    .cao__membre--ancien { background: var(--warning-bg, #fffbeb); }
    .cao__membre-tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .cao__avatar { width: 2.4rem; height: 2.4rem; border-radius: 50%; display: grid; place-items: center; background: var(--p-100); color: var(--p-800); font-weight: 700; font-size: 0.85rem; flex: none; }
    .cao__membre-nom { display: flex; flex-direction: column; flex: 1 1 10rem; min-width: 0; }
    .cao__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 0.9rem; font-size: var(--text-sm); }
    .cao__dl dt { color: var(--n-500); }
    .cao__dl dd { margin: 0; color: var(--n-800); }
    .cao__email { overflow-wrap: anywhere; }
    .cao__champs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem 0.75rem; }
    .cao__champs .form-group { margin: 0; }
    .cao__large { grid-column: 1 / -1; }
    .cao__membre-pied { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; padding-top: 0.6rem; border-top: 1px solid var(--n-200); }
    .cao__case { display: inline-flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); font-weight: 600; margin-right: auto; }
    .cao__pied { padding: 0.8rem 1rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .cao__pied .text-sm { flex: 1 1 20rem; }
    @media (max-width: 900px) { .cao__decision-grille { grid-template-columns: 1fr; } }
    @media (max-width: 520px) { .cao__champs { grid-template-columns: 1fr; } }
  `,
})
export class CaoEcran implements OnInit {
  private readonly service = inject(CaoService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly origines = ORIGINES;
  readonly libOrigine = LIBELLES_ORIGINE;
  readonly libCompte = LIBELLES_ETAT_COMPTE_CAO;
  readonly etats = LIBELLES_ETAT_CAO;
  readonly classeCao = classeCao;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly decisionMaxMo = DECISION_MAX_MO;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly cao = signal<Cao | null>(null);
  readonly reference = signal('');
  readonly dateDecision = signal('');
  readonly lignes = signal<Ligne[]>([]);
  readonly erreurs = signal<ReadonlyMap<string, string>>(new Map());
  readonly erreurGlobale = signal<string | null>(null);
  readonly fichier = signal<File | null>(null);
  readonly fichierErreur = signal<string | null>(null);
  // ⚠️ 19/10 (pilote) — une cérémonie close fige la composition (409 CEREMONIE_CLOSE) : l'écran passe en lecture.
  private readonly fiches = inject(FicheMarcheService);
  readonly fige = signal(false);
  readonly president = computed(() => { const p = this.lignes().find((l) => l.president); return p ? (p.nom + ' ' + p.prenom).trim() : null; });
  initiales(l: { nom: string; prenom: string }): string {
    return ((l.prenom.trim()[0] ?? '') + (l.nom.trim()[0] ?? '')).toUpperCase() || '?';
  }
  readonly nbExperts = computed(() => this.lignes().filter((l) => l.origine === 'EXPERT_OBJET').length);
  private prochaineCle = 1;

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.fiches.lire(this.idDmc).subscribe({ next: (f) => this.fige.set(f.ceremonie === 'CLOSE'), error: () => this.fige.set(false) });
    this.service.lire(this.idDmc).subscribe({
      next: (c) => {
        this.poserCao(c);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else if (e.status === 404) this.poserCao({ idDmc: this.idDmc, decision: { reference: null, date: null, fichier: false }, membres: [], etat: 'ABSENTE', anomalies: [] });
        else this.erreur.set(true);
      },
    });
  }

  private poserCao(c: Cao): void {
    this.cao.set(c);
    this.reference.set(c.decision?.reference ?? '');
    this.dateDecision.set(c.decision?.date ?? '');
    this.lignes.set(
      c.membres.map((m) => ({
        cle: this.prochaineCle++,
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        email: m.email,
        telephone: m.telephone ?? '',
        origine: m.origine ?? '',
        fonction: m.fonction ?? '',
        service: m.service ?? '',
        organisme: m.organisme ?? '',
        domaine: m.domaine ?? '',
        president: m.president,
        compte: m.compte,
        ancienExpertAdjoint: m.qualite === 'EXPERT_ADJOINT',
      })),
    );
    this.erreurs.set(new Map());
    this.erreurGlobale.set(null);
  }

  erreurDe(cle: string): string | null {
    return this.erreurs().get(cle) ?? null;
  }

  ajouter(): void {
    this.lignes.update((l) => [...l, { cle: this.prochaineCle++, id: null, nom: '', prenom: '', email: '', telephone: '', origine: '', fonction: '', service: '', organisme: '', domaine: '', president: false, compte: null, ancienExpertAdjoint: false }]);
  }

  retirer(cle: number): void {
    this.lignes.update((l) => l.filter((x) => x.cle !== cle));
  }

  poser<K extends keyof Ligne>(cle: number, champ: K, valeur: Ligne[K]): void {
    this.lignes.update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  presider(cle: number): void {
    this.lignes.update((l) => l.map((x) => ({ ...x, president: x.cle === cle })));
  }

  private corpsMembre(l: Ligne): MembreCaoCorps {
    return {
      id: l.id ?? undefined,
      nom: l.nom.trim(),
      prenom: l.prenom.trim(),
      email: l.email.trim(),
      telephone: l.telephone.trim() || null,
      // Une origine vide part telle quelle : c'est le serveur qui la refuse, sous `membres[i].origine`.
      origine: l.origine as OrigineMembreCao,
      fonction: l.fonction.trim() || null,
      service: l.origine === 'ENTITE_CONTRACTANTE' ? l.service.trim() || null : null,
      organisme: l.organisme.trim() || null,
      domaine: l.origine === 'EXPERT_OBJET' ? l.domaine.trim() || null : null,
      president: l.president,
    };
  }

  enregistrer(): void {
    if (this.saving()) return;
    this.erreurs.set(new Map());
    this.erreurGlobale.set(null);
    // ⚠️ Pilote (04/10) : « Un expert est suffisant dans la CAO. » Le même message que le serveur, avant l'envoi.
    if (this.nbExperts() > 1) {
      this.erreurs.set(new Map([['membres', MESSAGE_UN_SEUL_EXPERT]]));
      return;
    }
    this.saving.set(true);
    this.service
      .definir(this.idDmc, { decision: { reference: this.reference().trim(), date: this.dateDecision() }, membres: this.lignes().map((l) => this.corpsMembre(l)) })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.poserCao(c);
          this.toast.success(`Commission enregistrée — ${LIBELLES_ETAT_CAO[c.etat]}. Les membres nouveaux reçoivent leur invitation.`, 'C’est fait');
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          const parChamp = erreursParChamp(e);
          if (e.status === 400 && parChamp.size) {
            this.erreurs.set(parChamp);
            return;
          }
          this.erreurGlobale.set(this.motif(e));
        },
      });
  }

  inviter(l: Ligne): void {
    if (l.id == null || this.saving()) return;
    this.saving.set(true);
    this.service.inviter(this.idDmc, l.id).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.lignes.update((ls) => ls.map((x) => (x.cle === l.cle ? { ...x, compte: m.compte } : x)));
        this.toast.success(`Invitation renvoyée à ${m.email}. Le code précédent ne vaut plus.`);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.erreurGlobale.set(codeErreur(e) === 'COMPTE_ACTIF' ? 'Ce compte est déjà actif : rien à renvoyer.' : e.message || "L'invitation n'a pas pu être renvoyée.");
      },
    });
  }

  choisirDecision(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    if (!f) {
      this.fichier.set(null);
      this.fichierErreur.set(null);
      return;
    }
    const erreur = validerFichier(f, TYPES_PDF, DECISION_MAX_MO);
    this.fichierErreur.set(erreur);
    this.fichier.set(erreur ? null : f);
  }

  joindreDecision(): void {
    const f = this.fichier();
    if (!f || this.saving()) return;
    this.saving.set(true);
    this.fichierErreur.set(null);
    this.service.deposerDecision(this.idDmc, f).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.fichier.set(null);
        this.poserCao(c);
        this.toast.success('Décision signée jointe.');
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        if (e.status === 404) this.fichierErreur.set("Enregistrez d'abord la commission, puis joignez la décision.");
        else if (e.status === 413) this.fichierErreur.set(`Fichier trop volumineux : ${DECISION_MAX_MO} Mo au plus.`);
        else this.fichierErreur.set(e.message || "Le fichier n'a pas été accepté.");
      },
    });
  }

  private motif(e: ApiError): string {
    switch (codeErreur(e)) {
      case 'MEMBRE_EXCLU':
        return e.message || 'Une des personnes désignées ne peut pas siéger (PRMP, UGPM, contrôleur de la CNM, candidat ou compte interne).';
      case 'CEREMONIE_CLOSE':
        return 'La cérémonie des clés est close : la composition des détenteurs est figée. Le responsable de la procédure doit la rouvrir avant tout changement.';
      default:
        return e.status === 403 ? 'Seule la PRMP de la fiche désigne la commission.' : e.message || "L'enregistrement n'a pas abouti.";
    }
  }
}
