import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { EntreeJournalEvaluation, ETAPES_EVALUATION, EtapeEvaluation, Evaluation, Financiere, LotEvaluation, Negociations, OffreEvaluee, Technique } from '../../models';
import { EvaluationPiService, EvaluationService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation, EspaceEvaluation, droitsEvaluation, etapeArretee, etapeAtteinte } from './droits-evaluation';
import { AttributionLots } from './attribution-lots';
import { AnormaleOffre, IndicateursPrixVue } from './etape-anormales';
import { ConformiteOffre } from './etape-conformite';
import { MontantOffre, TableauEvaluation } from './etape-montant';
import { EtapeQualification } from './etape-qualification';
import { EtapeTechnique } from './etape-technique';
import { SeanceFinanciereVue } from './seance-financiere';
import { EtapeFinanciere } from './etape-financiere';
import { NegociationPi } from './negociation-pi';
import { LIBELLES_ETAPE, LIBELLES_ETAT_EVALUATION, NUMERO_ETAPE, refusEvaluation } from './libelles-evaluation';
import { RapportEvaluationVue } from './rapport-evaluation';

/**
 * L'**évaluation des offres** d'une procédure en ligne (lot 1, V76-V78 ; guide d'évaluation du 07/10, étapes 2 à 5 et rapport).
 * Un même écran, deux espaces :
 * - `/cao/procedures/:idDmc/evaluation` — les **membres de la CAO** signent leur déclaration préalable, puis décident, étape par
 *   étape et lot par lot ; le **président** arrête et rouvre les étapes ; tous signent le rapport ;
 * - `/procedure/:idDmc/evaluation` — le **responsable** ouvre l'évaluation et produit le rapport ; la **PRMP** demande précisions
 *   et justifications aux candidats ; l'**UGPM** lit.
 * Le serveur calcule et garde tout (montant évalué, rang, tour de post-qualification, proposition d'attribution) ; l'écran
 * affiche, saisit, et nomme chaque refus. Confidentiel : rien n'est visible des candidats avant l'information officielle (lot 2).
 */
@Component({
  selector: 'app-evaluation-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur, AttributionLots, ConformiteOffre, MontantOffre, TableauEvaluation, IndicateursPrixVue, AnormaleOffre, EtapeQualification, EtapeTechnique, SeanceFinanciereVue, EtapeFinanciere, NegociationPi, RapportEvaluationVue],
  template: `
    <!-- La coquille interne porte son fil d'Ariane (parents déclarés sur la route) ; l'espace CAO n'en a pas : l'écran le pose. -->
    @if (espace === 'cao') {
      <nav class="ev__ariane" aria-label="Fil d'Ariane">
        <a routerLink="/cao/mes-procedures">Mes procédures</a><span aria-hidden="true">›</span>
        <a [routerLink]="['/cao/procedures', idDmc]">Procédure</a><span aria-hidden="true">›</span>
        <span aria-current="page">Évaluation des offres</span>
      </nav>
    }

    <header class="page-header page-header--actions">
      <div>
        <div class="page-subtitle">Procédure n° {{ idDmc }} · {{ qui() }}</div>
        <h1 class="page-title">Évaluation des offres</h1>
      </div>
      <div class="ev__entete-actions">
        @if (lienFiche()) { <a class="btn btn-outline btn-sm" [routerLink]="lienFiche()!">Fiche DAO</a> }
        @if (evaluation()) { <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="charger()">Rafraîchir</button> }
      </div>
    </header>

    @if (chargement() && !evaluation()) {
      <p class="text-muted" role="status">Chargement de l'évaluation…</p>
    } @else if (refuse()) {
      <div class="alert alert-info" role="status"><span>L'évaluation est réservée aux membres de la commission, au responsable de la procédure, et à la PRMP et l'UGPM de la fiche.</span></div>
    } @else if (nonOuverte()) {
      <section class="card ev__bloc">
        <p>L'évaluation n'est pas encore ouverte. Elle s'ouvre quand le PV d'ouverture est signé de tous.</p>
        @if (droits().responsable) {
          <button type="button" class="btn btn-primary btn-sm ev__btn" [disabled]="travail()" (click)="ouvrir()">Ouvrir l'évaluation</button>
        }
        @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }
      </section>
    } @else if (erreur()) {
      <app-etat-erreur message="L'évaluation n'a pas pu être chargée." (reessayer)="charger()" />
    } @else if (evaluation(); as ev) {
      <div class="ev__etat">
        <span class="badge" [class.badge-info]="ev.etat === 'EN_COURS'" [class.badge-warning]="ev.etat === 'RAPPORT_A_SIGNER'" [class.badge-success]="ev.etat === 'CLOSE'">{{ etats[ev.etat] }}</span>
        <span class="text-sm text-muted">Ouverte le {{ dateHeure(ev.ouverteLe) }}{{ ev.ouvertePar ? ' par ' + ev.ouvertePar : '' }}</span>
        <span class="text-sm text-muted">Confidentiel jusqu'à l'information des candidats (art. 12-V, 35-V).</span>
      </div>
      @if (message(); as m) { <div class="alert alert-danger" role="alert">{{ m }}</div> }

      <!-- P6 : la déclaration préalable de chaque membre. -->
      <section class="card ev__bloc" aria-labelledby="ev-decl">
        <h2 id="ev-decl" class="ev__h2">Déclarations des membres</h2>
        <ul class="ev__decl">
          @for (d of ev.declarations; track d.membre) {
            <li>
              <strong>{{ d.nom }}</strong>{{ d.president ? ' — président' : '' }} :
              @if (!d.signeeLe) { <span class="text-muted">déclaration à signer</span> }
              @else if (d.conflit) { <span class="badge badge-danger">conflit d'intérêts déclaré</span>{{ d.precision ? ' — ' + d.precision : '' }} <span class="text-sm text-muted">(lit, ne décide pas)</span> }
              @else { <span class="text-sm">aucun conflit, confidentialité acceptée — le {{ dateHeure(d.signeeLe) }}</span> }
            </li>
          }
        </ul>
        @if (droits().membre && !droits().declaree && ev.etat === 'EN_COURS') {
          <fieldset class="ev__form-decl">
            <legend class="form-label">Votre déclaration (avant toute décision ; elle ne se reprend pas)</legend>
            <label><input type="radio" name="ev-conflit" [checked]="conflit() === false" (change)="conflit.set(false)" /> Je n'ai aucun intérêt financier ou personnel dans une entreprise candidate (art. 21-d).</label>
            <label><input type="radio" name="ev-conflit" [checked]="conflit() === true" (change)="conflit.set(true)" /> Je déclare un conflit d'intérêts : je lirai l'évaluation sans y décider.</label>
            @if (conflit()) {
              <label class="form-group"><span class="form-label">Précision</span><input class="form-control" type="text" [value]="precision()" (input)="precision.set($any($event.target).value)" /></label>
            }
            <label><input type="checkbox" [checked]="confidentialite()" (change)="confidentialite.set($any($event.target).checked)" /> Je m'engage à ne divulguer aucune information sur les offres, les notes ou le classement avant la publication officielle (art. 12-V).</label>
            <button type="button" class="btn btn-primary btn-sm ev__btn" [disabled]="conflit() === null || !confidentialite() || travail()" (click)="declarer()">Signer ma déclaration</button>
          </fieldset>
        } @else if (droits().conflit) {
          <p class="text-sm">Vous avez déclaré un conflit d'intérêts : vous lisez l'évaluation, vous n'y décidez rien.</p>
        }
      </section>

      @if (ev.lots.length > 1) {
        <div class="ev__lots" role="tablist" aria-label="Lots">
          @for (l of ev.lots; track l.lot) {
            <button type="button" role="tab" class="btn btn-sm" [class.btn-primary]="l.lot === lotChoisi()" [class.btn-outline]="l.lot !== lotChoisi()" [attr.aria-selected]="l.lot === lotChoisi()" (click)="choisirLot(l.lot)">Lot {{ l.lot }} — {{ etapes[l.etape] }}</button>
          }
        </div>
      }

      @if (lot(); as l) {
        <ol class="ev__etapes" aria-label="Étapes de l'évaluation">
          @for (e of etapesVisibles(); track e) {
            <li class="ev__etape" [class.ev__etape--faite]="arretee(l, e)" [class.ev__etape--courante]="courante(l) === e">
              <button type="button" class="ev__etape-b" [disabled]="!atteinte(l, e)" [attr.aria-current]="etapeChoisie() === e ? 'step' : null" (click)="etapeChoisie.set(e)">
                <span class="ev__etape-n">{{ numeros[e] }}</span>
                <span>{{ libelleEtape(e) }}</span>
                <span class="text-sm text-muted">{{ arretee(l, e) ? 'arrêtée' : courante(l) === e ? 'en cours' : 'à venir' }}</span>
              </button>
            </li>
          }
        </ol>

        @if (arret(l, etapeChoisie()); as a) {
          <p class="text-sm ev__arret">Étape arrêtée par {{ a.nom || a.par }} le {{ dateHeure(a.le) }}{{ a.observation ? ' — ' + a.observation : '' }}.</p>
        }

        <div class="ev__panneau">
          @switch (etapeChoisie()) {
            @case ('CONFORMITE') {
              <p class="text-sm text-muted ev__aide">Recevabilité, éligibilité et conformité pour l'essentiel (art. 43, 46) : la grille est pré-remplie depuis la séance ; la CAO décide, offre par offre.</p>
              @for (o of l.offres; track o.idOffre) {
                <app-conformite-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'CONFORMITE')" (maj)="appliquer($event)" />
              }
            }
            @case ('EVALUATION') {
              @if (technique(); as t) {
                <!-- ⚠️ Lot 3 PI, PI-c (V87) — la notation technique des propositions, par membre. -->
                <app-etape-technique [idDmc]="idDmc" [technique]="t" [lot]="l.lot" [droits]="droits()" [moi]="moi()" (maj)="technique.set($event)" />
              } @else {
              <p class="text-sm text-muted ev__aide">Corrections arithmétiques, rabais, préférence et critères du DAO ; le serveur calcule le montant évalué hors taxes et classe (art. 47).</p>
              @for (o of retenues(l); track o.idOffre) {
                <app-montant-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'EVALUATION')" (maj)="appliquer($event)" />
              }
              <app-tableau-evaluation [idDmc]="idDmc" [lot]="l" [droits]="droitsTableau(l)" (maj)="appliquer($event)" />
              }
            }
            @case ('ANORMALES') {
              <app-indicateurs-prix [idDmc]="idDmc" [lot]="l.lot" />
              @for (o of classees(l); track o.idOffre) {
                <app-anormale-offre [idDmc]="idDmc" [offre]="o" [droits]="droits()" [figee]="arretee(l, 'ANORMALES')" (maj)="appliquer($event)" />
              }
            }
            @case ('QUALIFICATION') {
              <app-etape-qualification [idDmc]="idDmc" [lot]="l" [droits]="droits()" (maj)="appliquer($event)" />
            }
            @case ('RAPPORT') {
              <p class="text-sm">Toutes les étapes du lot {{ l.lot }} sont arrêtées.</p>
            }
          }
        </div>

        @if (droits().president && etapeChoisie() !== 'RAPPORT' && !(technique() && etapeChoisie() === 'EVALUATION')) {
          <section class="card ev__president" aria-label="Arrêt de l'étape par le président">
            @if (!arretee(l, etapeChoisie()) && l.etape === etapeChoisie()) {
              <label class="form-group"><span class="form-label">Observation (facultative)</span><input class="form-control" type="text" [value]="observation()" (input)="observation.set($any($event.target).value)" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="arreter(l)">Arrêter l'étape « {{ etapes[etapeChoisie()] }} »</button>
              <p class="text-sm text-muted ev__aide">Arrêter fige les décisions de l'étape pour ce lot et ouvre l'étape suivante.</p>
            } @else if (arretee(l, etapeChoisie())) {
              <details>
                <summary>Rouvrir l'étape (et les suivantes du lot)…</summary>
                <div class="ev__rouvrir">
                  <label class="form-group"><span class="form-label">Motif (obligatoire, porté au journal)</span><input class="form-control" type="text" [value]="motifReouverture()" (input)="motifReouverture.set($any($event.target).value)" /></label>
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="!motifReouverture().trim() || travail()" (click)="rouvrir(l)">Rouvrir</button>
                </div>
              </details>
            }
          </section>
        }
      }

      @if (ev.nonEvaluees.length) {
        <section class="card ev__bloc" aria-labelledby="ev-non">
          <h2 id="ev-non" class="ev__h2">Offres non évaluées</h2>
          <ul class="ev__decl">
            @for (n of ev.nonEvaluees; track $index) { <li>Offre n° {{ n.numero ?? '—' }} · {{ nomEntreprise(n.entreprise) }} — {{ n.etat }}{{ n.motif ? ' : ' + n.motif : '' }}</li> }
          </ul>
        </section>
      }

      <!-- ⚠️ Lot 3 PI, PI-d1 (V88) — la seconde séance : les enveloppes financières des propositions qualifiées, une fois l'évaluation
           technique arrêtée sur chaque lot. -->
      @if (techniqueArretee()) {
        <app-seance-financiere [idDmc]="idDmc" [droits]="droits()" [espace]="espace" [membres]="ev.declarations" (etatChange)="chargerFinanciere()" />
        <!-- ⚠️ PI-d2a (V89) — l'évaluation financière et le classement, puis la négociation (PRMP ou UGPM), lot par lot. -->
        @if (financiere(); as f) {
          <app-etape-financiere [idDmc]="idDmc" [financiere]="f" [lot]="lot()?.lot ?? 1" [droits]="droits()" (maj)="apresFinanciere($event)" />
        }
        @if (negociations(); as n) {
          <app-negociation-pi [idDmc]="idDmc" [negociations]="n" [lot]="lot()?.lot ?? 1" [conduite]="prmpOuUgpm()" (maj)="apresNegociation($event)" />
        }
      }

      <app-rapport-evaluation [idDmc]="idDmc" [evaluation]="ev" [droits]="droits()" [moi]="moi()" (maj)="appliquer($event)" />

      <!-- ⚠️ Lot 2, tranche 2a (V79) — après le rapport signé : le dossier de marché de chaque lot, au contrôle de la Commission. -->
      @if (ev.etat === 'CLOSE') { <app-attribution-lots [idDmc]="idDmc" [prmpOuUgpm]="prmpOuUgpm()" [prmp]="espace === 'interne' && role() === 'PRMP'" /> }

      @if (journalOuvert()) {
        <details class="card ev__bloc" (toggle)="lireJournal($any($event.target).open)">
          <summary class="ev__h2">Journal de l'évaluation</summary>
          @if (journal(); as j) {
            <ul class="ev__journal">
              @for (x of j; track $index) { <li><span class="text-muted">{{ dateHeure(x.date) }}</span> · <strong>{{ x.acteur }}</strong> · {{ x.action }}{{ x.detail ? ' — ' + x.detail : '' }}</li> }
            </ul>
          }
        </details>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.9rem; }
    .ev__ariane { display: flex; gap: 0.4rem; align-items: center; font-size: var(--text-sm); color: var(--n-500); flex-wrap: wrap; }
    .ev__ariane a { color: var(--p-700); font-weight: 600; }
    .ev__entete-actions { display: flex; gap: 0.5rem; }
    .ev__etat { display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; }
    .ev__bloc { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .ev__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ev__decl { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .ev__form-decl { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: var(--text-sm); }
    .ev__btn { align-self: flex-start; }
    .ev__lots { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .ev__etapes { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; }
    .ev__etape-b { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem; padding: 0.5rem 0.6rem; border: 1px solid var(--n-200); border-radius: 6px; background: var(--n-100); text-align: left; cursor: pointer; }
    .ev__etape-b:disabled { cursor: default; opacity: 0.6; }
    .ev__etape-b[aria-current='step'] { border-color: var(--p-600); box-shadow: inset 0 -3px 0 var(--p-600); }
    .ev__etape--faite .ev__etape-n { background: var(--p-600); color: #fff; }
    .ev__etape-n { display: inline-grid; place-items: center; min-width: 1.4rem; height: 1.4rem; border-radius: 50%; border: 1px solid var(--p-600); font-size: 0.75rem; font-weight: 700; }
    .ev__etape-n:empty { display: none; }
    .ev__arret, .ev__aide { margin: 0; }
    .ev__panneau { display: flex; flex-direction: column; gap: 0.7rem; }
    .ev__president { padding: 0.7rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; border-left: 4px solid var(--p-600); }
    .ev__president .btn { align-self: flex-start; }
    .ev__rouvrir { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: end; padding-top: 0.4rem; }
    .ev__journal { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.2rem; max-height: 22rem; overflow: auto; }
    details > summary { cursor: pointer; }
    @media (max-width: 900px) { .ev__etapes { grid-template-columns: 1fr 1fr; } .ev__rouvrir { grid-template-columns: 1fr; } }
  `,
})
export class EvaluationEcran implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly idDmc = Number(this.route.snapshot.paramMap.get('idDmc'));
  readonly espace: EspaceEvaluation = this.route.snapshot.data['espace'] === 'cao' ? 'cao' : 'interne';
  readonly etats = LIBELLES_ETAT_EVALUATION;
  readonly etapes = LIBELLES_ETAPE;
  readonly numeros = NUMERO_ETAPE;
  readonly ordreEtapes: readonly EtapeEvaluation[] = [...ETAPES_EVALUATION, 'RAPPORT'];
  readonly dateHeure = dateHeureFr;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly nonOuverte = signal(false);
  readonly erreur = signal(false);
  readonly message = signal<string | null>(null);
  readonly travail = signal(false);
  readonly evaluation = signal<Evaluation | null>(null);
  readonly lotChoisi = signal(1);
  readonly etapeChoisie = signal<EtapeEvaluation>('CONFORMITE');
  readonly conflit = signal<boolean | null>(null);
  readonly precision = signal('');
  readonly confidentialite = signal(false);
  readonly observation = signal('');
  readonly motifReouverture = signal('');
  readonly journal = signal<EntreeJournalEvaluation[] | null>(null);
  /**
   * ⚠️ Lot 3 PI, PI-c (V87) — la notation technique, si la procédure est de prestations intellectuelles (409 `CATEGORIE_SANS_NOTATION_TECHNIQUE`
   * sinon : `null`). Sa présence fait le mode PI : examen préliminaire, évaluation technique, rapport.
   */
  readonly technique = signal<Technique | null>(null);
  /** ⚠️ PI-d2a — l'évaluation financière et la négociation ; nulles tant que le serveur ne les sert pas (séance non ouverte, hors PI). */
  readonly financiere = signal<Financiere | null>(null);
  readonly negociations = signal<Negociations | null>(null);
  private readonly pi = inject(EvaluationPiService);
  /** ⚠️ PI-d1 — l'évaluation technique est arrêtée sur chaque lot : la seconde séance peut s'ouvrir. */
  readonly techniqueArretee = computed(() => {
    const t = this.technique();
    return !!t && t.lots.length > 0 && t.lots.every((l) => !!l.arret);
  });
  readonly etapesVisibles = computed<readonly EtapeEvaluation[]>(() => (this.technique() ? ['CONFORMITE', 'EVALUATION', 'RAPPORT'] : this.ordreEtapes));

  readonly moi = computed(() => this.auth.ref());
  readonly droits = computed<DroitsEvaluation>(() => droitsEvaluation(this.evaluation(), this.espace, this.moi(), this.auth.role()));
  readonly lot = computed<LotEvaluation | null>(() => this.evaluation()?.lots.find((l) => l.lot === this.lotChoisi()) ?? this.evaluation()?.lots[0] ?? null);
  readonly lienFiche = computed(() => (['PRMP', 'UGPM'].includes(this.auth.role() ?? '') ? ['/prmp', 'dao', this.idDmc] : null));
  readonly qui = computed(() => {
    const d = this.droits();
    // Le titre suit la déclaration (qui préside), pas le droit d'arrêter, qui cesse avec l'évaluation close.
    const preside = this.evaluation()?.declarations.some((x) => x.membre === this.moi() && x.president);
    if (this.espace === 'cao') return preside ? 'président de la commission' : 'membre de la commission';
    return d.responsable ? 'responsable de la procédure' : this.auth.role() === 'PRMP' ? 'PRMP' : 'lecture';
  });
  /** La PRMP ou son UGPM, dans la coquille interne : elles créent le dossier de marché. */
  readonly role = computed(() => this.auth.role());
  readonly prmpOuUgpm = computed(() => this.espace === 'interne' && ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));
  /** Le journal : CAO, responsable, PRMP — pas l'UGPM (403). */
  readonly journalOuvert = computed(() => this.espace === 'cao' || this.auth.role() !== 'UGPM');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.lire(this.idDmc).subscribe({
      next: (ev) => {
        this.chargement.set(false);
        this.nonOuverte.set(false);
        this.appliquer(ev, true);
        this.chargerTechnique();
        this.document.title = `Évaluation des offres — procédure ${this.idDmc} — PRS 2.0`;
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 404) this.nonOuverte.set(true);
        else if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  /** Une évaluation neuve (lecture ou réponse d'un geste) ; au premier chargement, on se place sur l'étape en cours. */
  appliquer(ev: Evaluation, premier = false): void {
    const avant = this.lot()?.etape;
    this.evaluation.set(ev);
    this.message.set(null);
    this.journal.set(null);
    const l = this.lot();
    if (l && (premier || l.etape !== avant)) this.etapeChoisie.set(l.etape);
  }

  choisirLot(lot: number): void {
    this.lotChoisi.set(lot);
    const l = this.lot();
    if (l) this.etapeChoisie.set(l.etape);
  }

  arretee(l: LotEvaluation, e: EtapeEvaluation): boolean {
    const t = this.lotTechnique(l);
    if (t && e === 'EVALUATION') return !!t.arret;
    return etapeArretee(l, e);
  }

  atteinte(l: LotEvaluation, e: EtapeEvaluation): boolean {
    const t = this.lotTechnique(l);
    if (t && e === 'EVALUATION') return t.conformiteArretee;
    if (t && e === 'RAPPORT') return !!t.arret;
    return etapeAtteinte(l, e);
  }

  /** L'étape en cours du lot ; en PI, l'évaluation technique tant qu'elle n'est pas arrêtée, puis le rapport. */
  courante(l: LotEvaluation): EtapeEvaluation {
    const t = this.lotTechnique(l);
    if (!t || !t.conformiteArretee) return l.etape;
    return t.arret ? 'RAPPORT' : 'EVALUATION';
  }

  libelleEtape(e: EtapeEvaluation): string {
    return this.technique() && e === 'EVALUATION' ? 'Évaluation technique' : this.etapes[e];
  }

  private lotTechnique(l: LotEvaluation) {
    return this.technique()?.lots.find((x) => x.lot === l.lot) ?? null;
  }

  /** ⚠️ PI-d2a — l'évaluation financière et la négociation, relues ensemble (l'une conditionne l'autre) ; silencieuses en cas d'échec. */
  chargerFinanciere(): void {
    this.pi.evaluationFinanciere(this.idDmc).subscribe({ next: (f) => this.financiere.set(f), error: () => this.financiere.set(null) });
    this.pi.negociations(this.idDmc).subscribe({ next: (n) => this.negociations.set(n), error: () => this.negociations.set(null) });
  }

  /** Un classement arrêté ou rouvert ouvre ou ferme la négociation : elle se relit. */
  apresFinanciere(f: Financiere): void {
    this.financiere.set(f);
    this.pi.negociations(this.idDmc).subscribe({ next: (n) => this.negociations.set(n), error: () => this.negociations.set(null) });
  }

  /** Une négociation conclue fige les montants (ou ouvre le suivant) : l'évaluation financière se relit. */
  apresNegociation(n: Negociations): void {
    this.negociations.set(n);
    this.pi.evaluationFinanciere(this.idDmc).subscribe({ next: (f) => this.financiere.set(f), error: () => this.financiere.set(null) });
  }

  /** Silencieux : hors prestations intellectuelles (409) ou sans évaluation (404), l'écran reste celui des offres. */
  private chargerTechnique(): void {
    this.pi.technique(this.idDmc).subscribe({
      next: (t) => {
        this.technique.set(t);
        if (t.lots.length && t.lots.every((l) => !!l.arret)) this.chargerFinanciere();
        const l = this.lot();
        if (l) this.etapeChoisie.set(this.courante(l));
      },
      error: () => this.technique.set(null),
    });
  }

  arret(l: LotEvaluation, e: EtapeEvaluation) {
    // En PI, l'arrêt technique se lit dans l'étape elle-même.
    if (this.lotTechnique(l) && e === 'EVALUATION') return null;
    return l.etapesArretees.find((a) => a.etape === e) ?? null;
  }

  /** Étape 3 : les offres retenues à l'examen préliminaire (et celles écartées ensuite, pour mémoire). */
  retenues(l: LotEvaluation): OffreEvaluee[] {
    return l.offres.filter((o) => o.conformite?.decision === 'CONFORME');
  }

  /** Étape 4 : les offres classées à l'étape 3, et celles qu'elle a rejetées. */
  classees(l: LotEvaluation): OffreEvaluee[] {
    return l.offres
      .filter((o) => o.rang != null || o.ecartee?.etape === 'ANORMALES' || o.ecartee?.etape === 'QUALIFICATION')
      .sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));
  }

  /** Le départage n'est ouvert qu'à l'étape 3, tant qu'elle n'est pas arrêtée. */
  droitsTableau(l: LotEvaluation): DroitsEvaluation {
    const d = this.droits();
    return etapeArretee(l, 'EVALUATION') ? { ...d, decider: false } : d;
  }

  nomEntreprise(e: unknown): string {
    if (!e) return '—';
    if (typeof e === 'string') return e;
    const o = e as { raisonSociale?: string; nif?: string };
    return o.raisonSociale ?? o.nif ?? '—';
  }

  ouvrir(): void {
    this.geste(this.service.ouvrir(this.idDmc), 'L’évaluation est ouverte : les membres de la commission et la PRMP sont notifiés.', () => this.nonOuverte.set(false));
  }

  declarer(): void {
    const conflit = this.conflit();
    if (conflit === null) return;
    this.geste(this.service.declarer(this.idDmc, conflit, conflit ? this.precision().trim() || null : null), conflit ? 'Votre conflit est déclaré : vous lisez sans décider.' : 'Votre déclaration est signée : vous pouvez décider.');
  }

  arreter(l: LotEvaluation): void {
    this.geste(this.service.arreter(this.idDmc, l.lot, this.etapeChoisie(), this.observation().trim() || null), 'L’étape est arrêtée.', () => this.observation.set(''));
  }

  rouvrir(l: LotEvaluation): void {
    this.geste(this.service.rouvrir(this.idDmc, l.lot, this.etapeChoisie(), this.motifReouverture().trim()), 'L’étape est rouverte, avec les suivantes du lot.', () => this.motifReouverture.set(''));
  }

  lireJournal(ouvert: boolean): void {
    if (!ouvert || this.journal()) return;
    this.service.journal(this.idDmc).subscribe({
      next: (j) => this.journal.set([...j].reverse()),
      error: (e: ApiError) => this.message.set(refusEvaluation(e)),
    });
  }

  private geste(appel: ReturnType<EvaluationService['lire']>, succes: string, apres?: () => void): void {
    this.travail.set(true);
    this.message.set(null);
    appel.subscribe({
      next: (ev) => {
        this.travail.set(false);
        apres?.();
        this.appliquer(ev, !this.evaluation());
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusEvaluation(e));
      },
    });
  }
}
