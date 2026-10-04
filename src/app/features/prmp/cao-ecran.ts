import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiError, codeErreur, erreursParChamp } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import { Cao, CompteMembreCao, MembreCaoCorps, OrigineMembreCao } from '../../models';
import { CaoService } from '../../services';
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
 * PRMP : la décision de nomination (référence, date, PDF), les membres avec leur origine (entité contractante, ou expert
 * de l'objet du DAO — **un seul expert au plus**, pilote 04/10), **un** président, et l'état des comptes : la désignation
 * crée le compte `MEMBRE_CAO` et envoie l'invitation par courriel. Tous les membres détiennent une part. Une CAO par
 * DAO ; une cérémonie close la fige (409 `CEREMONIE_CLOSE` : le responsable rouvre d'abord). Les exclusions (PRMP, UGPM,
 * contrôleurs de la CNM, candidats, comptes internes) sont dites par le serveur, jamais devinées ici.
 */
@Component({
  selector: 'app-cao-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <section class="cao">
      <nav class="cao__ariane" aria-label="Fil d'Ariane">
        <a [routerLink]="['/prmp', 'dao', idDmc]">Fiche DAO</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Commission d'appel d'offres</span>
      </nav>
      <header class="page-header">
        <div class="page-subtitle">Domaine PRMP · ligne {{ idDmc }} du plan</div>
        <h1 class="page-title">Commission d'appel d'offres</h1>
      </header>
      <p class="page-role">
        Les membres que vous désignez par décision détiennent chacun une part de la clé qui ouvrira les offres : des agents de
        votre entité, et au plus un expert de l'objet du marché. Chacun reçoit par courriel une invitation à activer son
        compte, puis publie sa clé à la cérémonie. Une commission par appel d'offres.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La commission se lit par qui lit la fiche, et se désigne par la PRMP de la fiche.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La commission n'a pas pu être chargée." (reessayer)="charger()" />
      } @else {
        <div class="cao__etat">
          <span class="badge" [class]="'badge ' + classeCao(cao()?.etat)">Commission {{ etats[cao()?.etat ?? 'ABSENTE'] }}</span>
          @for (a of cao()?.anomalies ?? []; track a.regle) { <span class="text-sm" [class.text-muted]="a.regle === 'DECISION_SANS_FICHIER'">{{ a.message }}</span> }
        </div>
        @if (erreurGlobale(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <form class="card cnm-form cao__form" (submit)="$event.preventDefault(); enregistrer()" novalidate aria-label="Désignation de la commission">
          <h2 class="cao__h2">Décision de nomination</h2>
          <div class="cnm-form-grid">
            <label class="form-group">
              <span class="form-label">Référence de la décision</span>
              <input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" [class.error]="!!erreurDe('decision.reference')" />
              @if (erreurDe('decision.reference'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <label class="form-group">
              <span class="form-label">Date de la décision</span>
              <input class="form-control cao__court" type="date" [value]="dateDecision()" (input)="dateDecision.set($any($event.target).value)" [class.error]="!!erreurDe('decision.date')" />
              @if (erreurDe('decision.date'); as m) { <span class="form-error">{{ m }}</span> }
            </label>
          </div>

          <h2 class="cao__h2">Membres</h2>
          @if (erreurDe('membres'); as m) { <span class="form-error">{{ m }}</span> }
          <div class="table-card cao__tableau">
            <table class="cao__table">
              <caption class="cnm-sr-only">Les membres de la commission</caption>
              <thead>
                <tr><th scope="col">Président</th><th scope="col">Origine</th><th scope="col">Nom</th><th scope="col">Prénom</th><th scope="col">Adresse électronique</th><th scope="col">Téléphone</th><th scope="col">Fonction</th><th scope="col">Service, ou organisme et domaine</th><th scope="col">Compte</th><th scope="col"><span class="cnm-sr-only">Retirer</span></th></tr>
              </thead>
              <tbody>
                @for (l of lignes(); track l.cle; let i = $index) {
                  <tr [class.cao__ligne--ancien]="l.ancienExpertAdjoint">
                    <td><input type="radio" name="president" [checked]="l.president" (change)="presider(l.cle)" [attr.aria-label]="'Président : ' + (l.nom || 'membre ' + (i + 1))" /></td>
                    <td>
                      <select class="form-control cao__select" [attr.aria-label]="'Origine du membre ' + (i + 1)" (change)="poser(l.cle, 'origine', $any($event.target).value)" [class.error]="!!erreurDe('membres[' + i + '].origine')">
                        <option value="" [selected]="!l.origine">— Choisir —</option>
                        @for (o of origines; track o) { <option [value]="o" [selected]="l.origine === o">{{ libOrigine[o] }}</option> }
                      </select>
                      @if (l.ancienExpertAdjoint) { <span class="form-hint">Ancien expert adjoint : donnez-lui son origine (il détiendra une part), ou retirez-le.</span> }
                      @if (erreurDe('membres[' + i + '].origine'); as m) { <span class="form-error">{{ m }}</span> }
                    </td>
                    <td><input class="form-control" type="text" [value]="l.nom" (input)="poser(l.cle, 'nom', $any($event.target).value)" [attr.aria-label]="'Nom du membre ' + (i + 1)" [class.error]="!!erreurDe('membres[' + i + '].nom')" />@if (erreurDe('membres[' + i + '].nom'); as m) { <span class="form-error">{{ m }}</span> }</td>
                    <td><input class="form-control" type="text" [value]="l.prenom" (input)="poser(l.cle, 'prenom', $any($event.target).value)" [attr.aria-label]="'Prénom du membre ' + (i + 1)" /></td>
                    <td><input class="form-control" type="email" [value]="l.email" (input)="poser(l.cle, 'email', $any($event.target).value)" [attr.aria-label]="'Adresse du membre ' + (i + 1)" [class.error]="!!erreurDe('membres[' + i + '].email')" />@if (erreurDe('membres[' + i + '].email'); as m) { <span class="form-error">{{ m }}</span> }</td>
                    <td><input class="form-control cao__court" type="tel" [value]="l.telephone" (input)="poser(l.cle, 'telephone', $any($event.target).value)" [attr.aria-label]="'Téléphone du membre ' + (i + 1)" /></td>
                    <td><input class="form-control" type="text" [value]="l.fonction" (input)="poser(l.cle, 'fonction', $any($event.target).value)" [attr.aria-label]="'Fonction du membre ' + (i + 1)" /></td>
                    <td>
                      @if (l.origine === 'EXPERT_OBJET') {
                        <input class="form-control" type="text" placeholder="ex. organisme" [value]="l.organisme" (input)="poser(l.cle, 'organisme', $any($event.target).value)" [attr.aria-label]="'Organisme du membre ' + (i + 1)" />
                        <input class="form-control" type="text" placeholder="ex. génie civil" [value]="l.domaine" (input)="poser(l.cle, 'domaine', $any($event.target).value)" [attr.aria-label]="'Domaine du membre ' + (i + 1)" [class.error]="!!erreurDe('membres[' + i + '].domaine')" />
                        @if (erreurDe('membres[' + i + '].domaine'); as m) { <span class="form-error">{{ m }}</span> }
                      } @else {
                        <input class="form-control" type="text" placeholder="ex. Direction des affaires financières" [value]="l.service" (input)="poser(l.cle, 'service', $any($event.target).value)" [attr.aria-label]="'Service du membre ' + (i + 1)" [class.error]="!!erreurDe('membres[' + i + '].service')" />
                        @if (erreurDe('membres[' + i + '].service'); as m) { <span class="form-error">{{ m }}</span> }
                      }
                    </td>
                    <td class="nowrap">
                      @if (l.compte; as c) {
                        <span class="badge" [class.badge-success]="c.etat === 'ACTIF'" [class.badge-info]="c.etat === 'INVITE'" [class.badge-neutral]="c.etat === 'A_INVITER' || c.etat === 'ARCHIVE'">{{ libCompte[c.etat] }}</span>
                        @if (c.etat !== 'ACTIF' && l.id != null) { <button type="button" class="btn btn-sm btn-outline cao__inviter" [disabled]="saving()" (click)="inviter(l)">Renvoyer l'invitation</button> }
                        @if (c.dateInvitation) { <span class="text-xs text-muted">{{ dateHeure(c.dateInvitation) }}</span> }
                      } @else { <span class="text-xs text-muted">créé à l'enregistrement</span> }
                    </td>
                    <td><button type="button" class="btn btn-sm btn-outline" (click)="retirer(l.cle)" [attr.aria-label]="'Retirer ' + (l.nom || 'le membre ' + (i + 1))">✕</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="cao__actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="ajouter()">Ajouter un membre</button>
            <span class="text-sm text-muted">Au moins deux membres, un seul président ; un expert de l'objet au plus{{ nbExperts() ? ' (' + nbExperts() + ' saisi' + (nbExperts() > 1 ? 's' : '') + ')' : '' }}.</span>
          </div>
          <div class="cao__pied">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer la commission' }}</button>
            <span class="text-sm text-muted">Un membre nouveau reçoit son invitation à l'enregistrement ; un membre omis est retiré.</span>
          </div>
        </form>

        <section class="card cao__decision" aria-labelledby="cao-pdf">
          <h2 id="cao-pdf" class="cao__h2">Décision signée (PDF)</h2>
          @if (cao()?.decision?.fichier) { <p class="text-sm">Une décision signée est jointe{{ cao()?.decision?.date ? ' (' + date(cao()!.decision.date) + ')' : '' }}. En joindre une nouvelle la remplace.</p> }
          @else { <p class="text-sm text-muted">Facultative, mais attendue : sans elle, la commission porte un avertissement.</p> }
          <div class="cao__actions">
            <label class="form-group cao__fichier">
              <span class="form-label">Fichier PDF ({{ decisionMaxMo }} Mo au plus)</span>
              <input class="form-control" type="file" accept="application/pdf" (change)="choisirDecision($event)" />
              @if (fichierErreur(); as m) { <span class="form-error">{{ m }}</span> }
            </label>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="!fichier() || saving()" (click)="joindreDecision()">Joindre</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .cao { display: flex; flex-direction: column; gap: 1rem; }
    .cao__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .cao__ariane a { color: var(--p-700); font-weight: 600; }
    .cao__etat { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .cao__form, .cao__decision { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .cao__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .cao__court { max-width: 11rem; }
    .cao__tableau { overflow-x: auto; }
    .cao__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); min-width: 66rem; }
    .cao__table th, .cao__table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--n-200); vertical-align: top; }
    .cao__table th { color: var(--n-500); font-weight: 600; white-space: nowrap; }
    .cao__table .form-control { padding: 0.3rem 0.45rem; min-width: 7rem; }
    .cao__table td .form-control + .form-control { margin-top: 0.25rem; }
    .cao__ligne--ancien td { background: var(--warning-bg); }
    .cao__select { min-width: 11rem; }
    .cao__inviter { margin-left: 0.3rem; }
    .cao__actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .cao__pied { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid var(--n-200); }
    .cao__fichier { margin: 0; min-width: 18rem; }
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
  readonly nbExperts = computed(() => this.lignes().filter((l) => l.origine === 'EXPERT_OBJET').length);
  private prochaineCle = 1;

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
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
