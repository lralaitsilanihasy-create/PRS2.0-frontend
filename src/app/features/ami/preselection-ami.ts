import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { ExpressionNotee, Preselection } from '../../models';
import { AmiService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';

/** Les refus nommés de la tranche AMI-b (V83). */
export const MESSAGES_PRESELECTION: Readonly<Record<string, string>> = {
  DEJA_DECLARE: 'Votre déclaration est déjà signée.',
  CRITERE_INCONNU: 'Un critère noté n’existe pas dans l’appel.',
  NOTE_HORS_BAREME: 'Une note dépasse les points du critère (ou est négative).',
  MOTIF_OBLIGATOIRE: 'Le motif est obligatoire.',
  MEMBRE_EN_CONFLIT: 'Vous avez déclaré un conflit d’intérêts : vous ne décidez rien.',
  DECLARATION_MANQUANTE: 'Signez d’abord votre déclaration.',
  LECTURE_FERMEE: 'Les expressions ne se lisent qu’après la date limite.',
  LISTE_ARRETEE: 'La liste est déjà arrêtée.',
  EXPRESSION_ECARTEE: 'L’expression est écartée : rétablissez-la avant de la noter.',
  AMI_INFRUCTUEUX: 'L’appel est déclaré infructueux.',
  MOTIF_NOMBRE_OBLIGATOIRE: 'Moins de candidats qualifiés que de places : motivez le nombre retenu.',
  ORDRE_INVALIDE: 'L’ordre de départage doit citer une fois chaque expression à égalité.',
  NOTATION_INCOMPLETE: 'Des expressions ne sont pas encore notées sur tous les critères',
  AUCUN_QUALIFIE: 'Aucune expression n’est qualifiée : la PRMP relance l’appel ou le déclare infructueux.',
  EGALITE_A_DEPARTAGER: 'Des expressions sont à égalité au seuil de la liste : fixez leur ordre ci-dessous, puis arrêtez de nouveau.',
  NON_SIGNATAIRE: 'Vous n’êtes pas appelé à signer ce rapport.',
  RAPPORT_NON_PRODUIT: 'Le rapport n’est pas encore produit.',
  DEJA_SIGNE: 'Déjà signé.',
  MOTIF_ABSENT: 'Le motif de l’empêchement est obligatoire.',
  DATE_LIMITE_INVALIDE: 'La nouvelle date limite doit être à venir.',
  QUALIFIES_PRESENTS: 'Une expression au moins est qualifiée : l’appel n’est pas infructueux.',
};

export function messagePreselection(e: ApiError, defaut: string): string {
  const code = codeErreur(e);
  if (code === 'NOTATION_INCOMPLETE') {
    const n = corpsErreur<{ details?: { expressions?: unknown[] } }>(e)?.details?.expressions ?? [];
    return `${MESSAGES_PRESELECTION['NOTATION_INCOMPLETE']}${n.length ? ' : n° ' + n.join(', ') : ''}.`;
  }
  if (e.status === 403 && !code) return 'Ce geste ne vous revient pas.';
  return (code && MESSAGES_PRESELECTION[code]) || corpsErreur<{ message?: string }>(e)?.message || defaut;
}

const ETATS: Readonly<Record<Preselection['etat'], string>> = {
  EN_ATTENTE: 'Avant la date limite',
  NOTATION: 'Notation en cours',
  LISTE_ARRETEE: 'Liste arrêtée — rapport à signer',
  DEFINITIVE: 'Liste définitive',
  INFRUCTUEUX: 'Infructueux',
};

/** La saisie en cours d'une note : texte brut, converti à l'envoi. */
interface NoteEnCours {
  note: string;
  motif: string;
}

/**
 * ⚠️ **La présélection de l'AMI** (tranche AMI-b, 07/10, V83 ; art. 42-II). Un même écran, deux espaces, comme l'évaluation :
 * les membres de la commission (`/cao`) déclarent, notent chaque expression critère par critère (motif exigé, borné aux points du
 * critère) ou l'écartent ; le président arrête la liste (motif du nombre si moins de qualifiées que de places, ordre des ex æquo au
 * seuil quand le serveur le demande) ; tous signent le rapport. Dans la coquille interne, la PRMP lit, relance l'appel ou le déclare
 * infructueux. La notation est collégiale : une note par critère, la dernière saisie fait foi (le journal garde les autres).
 * Ce que l'écran propose n'est jamais une garde : le serveur refuse, l'écran nomme le refus.
 */
@Component({
  selector: 'app-preselection-ami',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    @if (espace === 'cao') {
      <nav class="ps__ariane" aria-label="Fil d'Ariane">
        <a routerLink="/cao/mes-procedures">Mes procédures</a><span aria-hidden="true">›</span>
        <a [routerLink]="['/cao/procedures', idDmc]">Procédure</a><span aria-hidden="true">›</span>
        <span aria-current="page">Présélection</span>
      </nav>
    }
    <header class="page-header page-header--actions">
      <div>
        <div class="page-subtitle">Procédure n° {{ idDmc }} · {{ qui() }}</div>
        <h1 class="page-title">Présélection des candidats</h1>
      </div>
      <div class="ps__entete">
        @if (lienAmi()) { <a class="btn btn-outline btn-sm" [routerLink]="lienAmi()!">Appel à manifestation d’intérêt</a> }
        @if (ps()) { <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="charger()">Rafraîchir</button> }
      </div>
    </header>

    @if (chargement() && !ps()) {
      <p class="text-muted" role="status">Chargement de la présélection…</p>
    } @else if (refuse()) {
      <div class="alert alert-info" role="status"><span>La présélection est réservée aux membres de la commission, à la PRMP et à l’UGPM de la fiche.</span></div>
    } @else if (absente()) {
      <div class="alert alert-info" role="status"><span>L’appel à manifestation d’intérêt n’est pas publié : il n’y a rien à présélectionner.</span></div>
    } @else if (erreur()) {
      <app-etat-erreur message="La présélection n’a pas pu être chargée." (reessayer)="charger()" />
    } @else if (ps(); as p) {
      <div class="ps__etat">
        <span class="badge" [class.badge-info]="p.etat === 'NOTATION' || p.etat === 'EN_ATTENTE'" [class.badge-warning]="p.etat === 'LISTE_ARRETEE'" [class.badge-success]="p.etat === 'DEFINITIVE'" [class.badge-danger]="p.etat === 'INFRUCTUEUX'">{{ etats[p.etat] }}</span>
        <span class="text-sm text-muted">{{ p.nombreRetenus ?? 6 }} places · note minimale {{ p.noteMinimale != null ? p.noteMinimale + ' / 100' : 'aucune' }}{{ p.nombreRelances ? ' · relancé ' + p.nombreRelances + ' fois' : '' }}</span>
      </div>
      @if (message(); as m) { <div class="alert alert-danger" role="alert"><span>{{ m }}</span></div> }
      @if (p.etat === 'EN_ATTENTE') {
        <p class="text-sm" role="status">Les expressions d’intérêt se lisent après la date limite. D’ici là, la commission peut signer ses déclarations.</p>
      }
      @if (p.etat === 'INFRUCTUEUX') {
        <div class="alert alert-info" role="status"><span>Appel déclaré infructueux (art. 56-II) : {{ p.motifInfructueux }}</span></div>
      }

      <section class="card ps__bloc" aria-labelledby="ps-decl">
        <h2 id="ps-decl" class="ps__h2">Déclarations des membres</h2>
        <ul class="ps__decl">
          @for (d of p.declarations; track d.membre) {
            <li>
              <strong>{{ d.nom }}</strong>{{ d.president ? ' — président' : '' }} :
              @if (!d.signeeLe) { <span class="text-muted">déclaration à signer</span> }
              @else if (d.conflit) { <span class="badge badge-danger">conflit d’intérêts déclaré</span>{{ d.precision ? ' — ' + d.precision : '' }} <span class="text-sm text-muted">(lit, ne décide pas)</span> }
              @else { <span class="text-sm">aucun conflit — le {{ dateHeure(d.signeeLe) }}</span> }
            </li>
          }
        </ul>
        @if (maDeclaration() && !maDeclaration()!.signeeLe && enCours()) {
          <fieldset class="ps__form">
            <legend class="form-label">Votre déclaration (avant toute décision ; elle ne se reprend pas)</legend>
            <label><input type="radio" name="ps-conflit" [checked]="conflit() === false" (change)="conflit.set(false)" /> Je n’ai aucun intérêt dans un cabinet ou un consultant candidat.</label>
            <label><input type="radio" name="ps-conflit" [checked]="conflit() === true" (change)="conflit.set(true)" /> Je déclare un conflit d’intérêts : je lirai la présélection sans y décider.</label>
            @if (conflit()) {
              <label class="form-group"><span class="form-label">Précision</span><input class="form-control" type="text" [value]="precision()" (input)="precision.set(valeur($event))" /></label>
            }
            <button type="button" class="btn btn-primary btn-sm ps__btn" [disabled]="conflit() === null || travail()" (click)="declarer()">Signer ma déclaration</button>
          </fieldset>
        }
      </section>

      @if (p.expressions.length) {
        <section class="card ps__bloc" aria-labelledby="ps-expr">
          <h2 id="ps-expr" class="ps__h2">Expressions d’intérêt et classement</h2>
          <p class="text-sm text-muted">Qualifiée : notée sur tous les critères, non écartée, au moins la note minimale. Le classement suit le total sur 100.</p>
          <div class="cnm-table-wrap">
            <table class="cnm-table ps__table">
              <caption class="cnm-sr-only">Expressions d'intérêt, classées</caption>
              <thead><tr><th scope="col">N°</th><th scope="col">Candidat</th><th scope="col" class="cnm-num">Total</th><th scope="col">Situation</th><th scope="col" class="cnm-num">Rang</th></tr></thead>
              <tbody>
                @for (x of classees(); track x.id) {
                  <tr>
                    <td class="cnm-mono">{{ x.numero }}</td>
                    <td><strong>{{ x.raisonSociale || '—' }}</strong><div class="text-xs text-muted">NIF {{ x.nif || '—' }}</div></td>
                    <td class="cnm-num">{{ x.total != null ? x.total : '—' }}</td>
                    <td>
                      @if (x.ecartee) { <span class="badge badge-danger">écartée</span> <span class="text-xs">{{ x.motifEcartement }}</span> }
                      @else if (!x.complete) { <span class="badge badge-neutral">à noter</span> }
                      @else if (x.qualifiee) { <span class="badge badge-success">qualifiée</span> }
                      @else { <span class="badge badge-warning">sous la note minimale</span> }
                    </td>
                    <td class="cnm-num">{{ x.rang ?? '—' }}{{ x.exAequo ? ' ex æquo' : '' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @for (x of p.expressions; track x.id) {
            <details class="ps__x" [attr.data-expression]="x.numero">
              <summary><span class="cnm-mono">n° {{ x.numero }}</span> <strong>{{ x.raisonSociale || '—' }}</strong> <span class="text-sm text-muted">{{ decider() && notable(x) ? 'noter' : 'détail des notes' }}</span></summary>
              @if (decider() && notable(x)) {
                <div class="ps__grille">
                  @for (n of x.notes; track n.code) {
                    <div class="ps__note">
                      <label class="form-label" [for]="'n-' + x.id + '-' + n.code">{{ n.code }} — {{ n.libelle }} <span class="text-muted">(sur {{ n.max }})</span></label>
                      <input class="form-control ps__court" type="number" min="0" [max]="n.max" step="0.5" [id]="'n-' + x.id + '-' + n.code" [value]="saisie(x.id, n.code).note" (input)="poser(x.id, n.code, 'note', valeur($event))" />
                      <input class="form-control" [attr.aria-label]="'Motif de la note ' + n.code" placeholder="Motif" [value]="saisie(x.id, n.code).motif" (input)="poser(x.id, n.code, 'motif', valeur($event))" />
                      @if (n.nom) { <span class="text-xs text-muted">dernière saisie : {{ n.nom }}, {{ dateHeure(n.le) }}</span> }
                    </div>
                  }
                  <button type="button" class="btn btn-primary btn-sm ps__btn" [disabled]="travail() || !grilleComplete(x)" (click)="noter(x)">Enregistrer les notes</button>
                </div>
              } @else {
                <ul class="ps__lect">
                  @for (n of x.notes; track n.code) {
                    <li>{{ n.code }} — {{ n.libelle }} : <strong>{{ n.note != null ? n.note + ' / ' + n.max : 'non notée' }}</strong>{{ n.motif ? ' — ' + n.motif : '' }}{{ n.nom ? ' (' + n.nom + ')' : '' }}</li>
                  }
                </ul>
              }
              @if (decider() && p.etat === 'NOTATION') {
                <div class="ps__ecart">
                  <label class="form-label" [for]="'e-' + x.id">{{ x.ecartee ? 'Motif du rétablissement' : 'Motif de l’écartement' }}</label>
                  <input class="form-control" [id]="'e-' + x.id" [value]="motifsEcart()[x.id] ?? ''" (input)="poserMotifEcart(x.id, valeur($event))" />
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="travail() || !(motifsEcart()[x.id] ?? '').trim()" (click)="ecarter(x)">{{ x.ecartee ? 'Rétablir' : 'Écarter' }}</button>
                </div>
              }
            </details>
          }
        </section>
      }

      @if (president() && p.etat === 'NOTATION') {
        <section class="card ps__bloc ps__president" aria-labelledby="ps-arret">
          <h2 id="ps-arret" class="ps__h2">Arrêter la liste restreinte</h2>
          <p class="text-sm">{{ qualifiees() }} qualifiée{{ qualifiees() > 1 ? 's' : '' }} pour {{ p.nombreRetenus ?? 6 }} places. La liste prend les premières ; le rapport de présélection est alors produit et se signe.</p>
          @if (qualifiees() < (p.nombreRetenus ?? 6)) {
            <label class="form-label" for="ps-motif-nombre">Motif du nombre retenu (moins de qualifiées que de places)</label>
            <textarea id="ps-motif-nombre" class="form-control" rows="2" [value]="motifNombre()" (input)="motifNombre.set(valeur($event))"></textarea>
          }
          <label class="form-label" for="ps-obs">Observations (facultatif)</label>
          <textarea id="ps-obs" class="form-control" rows="2" [value]="observations()" (input)="observations.set(valeur($event))"></textarea>
          @if (ordre().length) {
            <h3 class="ps__h3">Ordre de départage au seuil</h3>
            <ol class="ps__ordre">
              @for (id of ordre(); track id; let i = $index; let dernier = $last) {
                <li>
                  {{ libelleExpression(id) }}
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Monter ' + libelleExpression(id)" [disabled]="i === 0" (click)="deplacer(i, -1)">↑</button>
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Descendre ' + libelleExpression(id)" [disabled]="dernier" (click)="deplacer(i, 1)">↓</button>
                </li>
              }
            </ol>
          }
          <button type="button" class="btn btn-primary btn-sm ps__btn" [disabled]="travail()" (click)="arreter()">Arrêter la liste</button>
        </section>
      }

      @if (p.liste.length) {
        <section class="card ps__bloc" aria-labelledby="ps-liste">
          <h2 id="ps-liste" class="ps__h2">Liste restreinte {{ p.etat === 'DEFINITIVE' ? 'définitive' : 'arrêtée' }}</h2>
          <ol class="ps__liste">
            @for (r of p.liste; track r.idExpression) { <li><strong>{{ r.raisonSociale }}</strong><span class="text-sm text-muted">&nbsp;· NIF {{ r.nif || '—' }} · {{ r.note }} / 100</span></li> }
          </ol>
          @if (p.motifNombre) { <p class="text-sm"><strong>Motif du nombre :</strong> {{ p.motifNombre }}</p> }
          @if (p.observations) { <p class="text-sm"><strong>Observations :</strong> {{ p.observations }}</p> }
          @if (p.etat === 'DEFINITIVE') {
            <p class="text-sm">Publiée sur la page de l’appel et notifiée à chaque candidat. Les lettres d’invitation vont désormais aux candidats de cette liste, et le dossier de la demande de propositions peut être créé : le rapport signé y est joint d’office.</p>
          }
        </section>
      }

      @if (p.rapport; as r) {
        <section class="card ps__bloc" aria-labelledby="ps-rapport">
          <h2 id="ps-rapport" class="ps__h2">Rapport de présélection</h2>
          <p class="text-sm text-muted">Produit le {{ dateHeure(r.produitLe) }}{{ r.signe ? ' · signé de tous le ' + dateHeure(r.signeLe) : '' }}</p>
          <div class="ps__actions">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="lireRapport('pdf')">Ouvrir le PDF</button>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="lireRapport('docx')">Enregistrer le Word</button>
          </div>
          <ul class="ps__decl">
            @for (s of r.signatures; track s.im) {
              <li><strong>{{ s.nom }}</strong> : {{ s.empechement ? 'empêché — ' + s.motif + ' (constaté par ' + s.constatePar + ')' : 'signé le ' + dateHeure(s.date) }}{{ s.observation ? ' — « ' + s.observation + ' »' : '' }}</li>
            }
            @for (a of attendues(); track a.im) { <li><strong>{{ a.nom }}</strong> : <span class="text-muted">signature attendue</span></li> }
          </ul>
          @if (jeSigne()) {
            <label class="form-label" for="ps-obs-sig">Observation (facultative)</label>
            <input id="ps-obs-sig" class="form-control" [value]="observationSignature()" (input)="observationSignature.set(valeur($event))" />
            <button type="button" class="btn btn-primary btn-sm ps__btn" [disabled]="travail()" (click)="signer()">Signer le rapport</button>
          }
          @if (presidentDeclare() && attendues().length) {
            <details class="ps__emp">
              <summary>Constater l’empêchement d’un membre</summary>
              <label class="form-label" for="ps-emp-im">Membre</label>
              <select id="ps-emp-im" class="form-control" [value]="empecheIm()" (change)="empecheIm.set(valeur($event))">
                <option value="">—</option>
                @for (a of attendues(); track a.im) { <option [value]="a.im">{{ a.nom }}</option> }
              </select>
              <label class="form-label" for="ps-emp-motif">Motif</label>
              <input id="ps-emp-motif" class="form-control" [value]="empecheMotif()" (input)="empecheMotif.set(valeur($event))" />
              <button type="button" class="btn btn-outline btn-sm" [disabled]="travail() || !empecheIm() || !empecheMotif().trim()" (click)="empechement()">Constater</button>
            </details>
          }
        </section>
      }

      @if (prmp() && p.etat === 'NOTATION') {
        <section class="card ps__bloc" aria-labelledby="ps-prmp">
          <h2 id="ps-prmp" class="ps__h2">Relancer ou déclarer infructueux</h2>
          <p class="text-sm">Avant l’arrêt de la liste : la relance rouvre le dépôt jusqu’à une nouvelle date limite (expressions et notes gardées) ; l’infructuosité (art. 56-II) n’est possible que sans aucune expression qualifiée.</p>
          <label class="form-label" for="ps-relance-date">Nouvelle date limite</label>
          <input id="ps-relance-date" class="form-control ps__court" type="datetime-local" [value]="relanceDate()" (input)="relanceDate.set(valeur($event))" />
          <label class="form-label" for="ps-prmp-motif">Motif</label>
          <textarea id="ps-prmp-motif" class="form-control" rows="2" [value]="motifPrmp()" (input)="motifPrmp.set(valeur($event))"></textarea>
          <div class="ps__actions">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail() || !relanceDate() || !motifPrmp().trim()" (click)="relancer()">Relancer l’appel</button>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="travail() || !motifPrmp().trim() || qualifiees() > 0" (click)="infructueux()">Déclarer infructueux</button>
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .ps__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); }
    .ps__entete, .ps__actions, .ps__etat { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .ps__bloc { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .ps__president { border-left: 4px solid var(--p-600); }
    .ps__h2 { margin: 0; font-size: 1.05rem; }
    .ps__h3 { margin: 0.4rem 0 0; font-size: 0.95rem; }
    .ps__decl { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .ps__form { display: flex; flex-direction: column; gap: 0.4rem; border: 0; padding: 0; margin: 0; }
    .ps__btn { align-self: flex-start; }
    .ps__table tbody th, .ps__table td { vertical-align: top; }
    .ps__x { border: 1px solid var(--n-200); border-radius: var(--radius-md, 6px); padding: 0.5rem 0.75rem; }
    .ps__x summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
    .ps__grille { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem; }
    .ps__note { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem; }
    .ps__court { max-width: 9rem; }
    .ps__lect { margin: 0.5rem 0 0; padding-left: 1.1rem; }
    .ps__ecart { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.5rem; margin-top: 0.6rem; border-top: 1px solid var(--n-200); padding-top: 0.5rem; }
    .ps__ecart .form-control { flex: 1 1 16rem; }
    .ps__ordre li, .ps__liste li { margin: 0.2rem 0; }
    .ps__emp summary { cursor: pointer; }
  `,
})
export class PreselectionAmi implements OnInit {
  private readonly service = inject(AmiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly espace: 'cao' | 'interne' = this.route.snapshot.data['espace'] === 'cao' ? 'cao' : 'interne';

  readonly etats = ETATS;
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly refuse = signal(false);
  readonly absente = signal(false);
  readonly ps = signal<Preselection | null>(null);
  readonly travail = signal(false);
  readonly message = signal<string | null>(null);

  // ── Qui regarde ──
  private readonly moi = computed(() => this.auth.ref());
  readonly maDeclaration = computed(() => (this.espace === 'cao' ? this.ps()?.declarations.find((d) => d.membre === this.moi()) ?? null : null));
  readonly enCours = computed(() => ['EN_ATTENTE', 'NOTATION'].includes(this.ps()?.etat ?? ''));
  readonly presidentDeclare = computed(() => {
    const d = this.maDeclaration();
    return !!d?.president && !!d.signeeLe && !d.conflit;
  });
  readonly decider = computed(() => {
    const d = this.maDeclaration();
    return !!d?.signeeLe && !d.conflit && this.ps()?.etat === 'NOTATION';
  });
  readonly president = computed(() => this.decider() && !!this.maDeclaration()?.president);
  readonly prmp = computed(() => this.espace === 'interne' && this.auth.role() === 'PRMP');
  readonly lienAmi = computed(() => (this.espace === 'interne' && ['PRMP', 'UGPM'].includes(this.auth.role() ?? '') ? ['/prmp', 'dao', this.idDmc, 'ami'] : null));
  readonly qui = computed(() => {
    if (this.espace === 'cao') return this.maDeclaration()?.president ? 'président de la commission' : 'membre de la commission';
    return this.auth.role() === 'PRMP' ? 'PRMP' : 'lecture';
  });

  readonly classees = computed(() =>
    [...(this.ps()?.expressions ?? [])].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || (b.total ?? -1) - (a.total ?? -1) || a.numero - b.numero),
  );
  readonly qualifiees = computed(() => (this.ps()?.expressions ?? []).filter((x) => x.qualifiee).length);
  readonly attendues = computed(() => {
    const r = this.ps()?.rapport;
    return r ? r.attendues.filter((a) => !r.signatures.some((s) => s.im === a.im)) : [];
  });
  readonly jeSigne = computed(() => this.ps()?.etat === 'LISTE_ARRETEE' && this.attendues().some((a) => a.im === this.moi()));

  // ── Les saisies ──
  readonly conflit = signal<boolean | null>(null);
  readonly precision = signal('');
  private readonly saisies = signal<Record<string, NoteEnCours>>({});
  readonly motifsEcart = signal<Record<string, string>>({});
  readonly motifNombre = signal('');
  readonly observations = signal('');
  readonly ordre = signal<string[]>([]);
  readonly observationSignature = signal('');
  readonly empecheIm = signal('');
  readonly empecheMotif = signal('');
  readonly relanceDate = signal('');
  readonly motifPrmp = signal('');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.preselection(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => this.recevoir(p),
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else if (e.status === 404) this.absente.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private recevoir(p: Preselection): void {
    this.ps.set(p);
    this.chargement.set(false);
    // La grille repart de la note retenue par le serveur : une saisie d'un autre membre s'y lit au rafraîchissement.
    const s: Record<string, NoteEnCours> = {};
    for (const x of p.expressions) for (const n of x.notes) s[`${x.id}|${n.code}`] = { note: n.note != null ? String(n.note) : '', motif: n.motif ?? '' };
    this.saisies.set(s);
  }

  valeur(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  notable(x: ExpressionNotee): boolean {
    return !x.ecartee;
  }

  saisie(idX: string, code: string): NoteEnCours {
    return this.saisies()[`${idX}|${code}`] ?? { note: '', motif: '' };
  }

  poser(idX: string, code: string, champ: 'note' | 'motif', v: string): void {
    const cle = `${idX}|${code}`;
    this.saisies.update((s) => ({ ...s, [cle]: { ...(s[cle] ?? { note: '', motif: '' }), [champ]: v } }));
  }

  /** Chaque critère porte une note dans son barème et un motif : le serveur l'exige, l'écran le dit avant l'envoi. */
  grilleComplete(x: ExpressionNotee): boolean {
    return x.notes.every((n) => {
      const s = this.saisie(x.id, n.code);
      const v = Number(s.note);
      return s.note.trim() !== '' && !Number.isNaN(v) && v >= 0 && v <= n.max && s.motif.trim() !== '';
    });
  }

  poserMotifEcart(idX: string, v: string): void {
    this.motifsEcart.update((m) => ({ ...m, [idX]: v }));
  }

  libelleExpression(id: string): string {
    const x = this.ps()?.expressions.find((e) => e.id === id);
    return x ? `n° ${x.numero} — ${x.raisonSociale ?? '—'} (${x.total ?? '—'})` : id;
  }

  deplacer(i: number, sens: -1 | 1): void {
    this.ordre.update((l) => {
      const c = [...l];
      [c[i], c[i + sens]] = [c[i + sens], c[i]];
      return c;
    });
  }

  declarer(): void {
    const c = this.conflit();
    if (c === null) return;
    this.geste(this.service.declarer(this.idDmc, c, c ? this.precision().trim() || null : null), 'Déclaration signée.');
  }

  noter(x: ExpressionNotee): void {
    if (!this.grilleComplete(x)) return;
    const notes = x.notes.map((n) => ({ code: n.code, note: Number(this.saisie(x.id, n.code).note), motif: this.saisie(x.id, n.code).motif.trim() }));
    this.geste(this.service.noter(this.idDmc, x.id, notes), `Notes de l’expression n° ${x.numero} enregistrées.`);
  }

  ecarter(x: ExpressionNotee): void {
    const motif = (this.motifsEcart()[x.id] ?? '').trim();
    if (!motif) return;
    this.geste(this.service.ecarter(this.idDmc, x.id, !x.ecartee, motif), x.ecartee ? 'Expression rétablie.' : 'Expression écartée.', () =>
      this.motifsEcart.update((m) => ({ ...m, [x.id]: '' })),
    );
  }

  arreter(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.message.set(null);
    const corps = {
      motifNombre: this.motifNombre().trim() || null,
      observations: this.observations().trim() || null,
      ordre: this.ordre().length ? this.ordre() : null,
    };
    this.service.arreter(this.idDmc, corps).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => {
        this.travail.set(false);
        this.ordre.set([]);
        this.recevoir(p);
        this.toast.success('Liste arrêtée : le rapport de présélection est produit et attend les signatures.');
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        if (codeErreur(e) === 'EGALITE_A_DEPARTAGER') {
          const ids = corpsErreur<{ details?: { expressions?: string[] } }>(e)?.details?.expressions ?? [];
          this.ordre.set(ids.map(String));
        }
        this.message.set(messagePreselection(e, 'L’arrêt de la liste a échoué.'));
      },
    });
  }

  signer(): void {
    this.geste(this.service.signer(this.idDmc, this.observationSignature().trim() || null), 'Rapport signé.');
  }

  empechement(): void {
    this.geste(this.service.constaterEmpechement(this.idDmc, this.empecheIm(), this.empecheMotif().trim()), 'Empêchement constaté.', () => {
      this.empecheIm.set('');
      this.empecheMotif.set('');
    });
  }

  relancer(): void {
    const d = this.relanceDate();
    this.gesteAmi(this.service.relancer(this.idDmc, d.length === 16 ? `${d}:00` : d, this.motifPrmp().trim()), 'Appel relancé : le dépôt est rouvert jusqu’à la nouvelle date limite.');
  }

  infructueux(): void {
    this.gesteAmi(this.service.declarerInfructueux(this.idDmc, this.motifPrmp().trim()), 'Appel déclaré infructueux.');
  }

  lireRapport(format: 'pdf' | 'docx'): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.service.rapport(this.idDmc, format).subscribe({
      next: (blob) => {
        this.travail.set(false);
        if (format === 'pdf') ouvrirBlobSur(blob);
        else telechargerBlob(blob, `rapport-preselection-${this.idDmc}.docx`);
      },
      error: () => {
        this.travail.set(false);
        this.toast.error('Le rapport est indisponible — réessayez.');
      },
    });
  }

  private geste(appel: Observable<Preselection>, succes: string, apres?: () => void): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.message.set(null);
    appel.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => {
        this.travail.set(false);
        this.recevoir(p);
        apres?.();
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(messagePreselection(e, 'Le geste a échoué. Réessayez.'));
      },
    });
  }

  /** Relance et infructuosité répondent l'AMI, pas la présélection : on relit celle-ci ensuite. */
  private gesteAmi(appel: Observable<unknown>, succes: string): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.message.set(null);
    appel.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.travail.set(false);
        this.motifPrmp.set('');
        this.relanceDate.set('');
        this.toast.success(succes);
        this.charger();
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(messagePreselection(e, 'Le geste a échoué. Réessayez.'));
      },
    });
  }
}
