import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CodeVerification, CoteConformite, DemandeEvaluation, Evaluation, OffreEvaluee, QualificationRejet, SpecificationOffre, VerificationConformite } from '../../models';
import { EvaluationService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DemandeVue } from './demande-vue';
import { DroitsEvaluation } from './droits-evaluation';
import { AIDES_QUALIFICATION_REJET, LIBELLES_QUALIFICATION_REJET, refusEvaluation } from './libelles-evaluation';

/** ⚠️ Guide de la CAO (§B3.1, 15/10) — la cote d'une rubrique ; `''` : à examiner. */
export type Choix = CoteConformite | '';
export const LIBELLES_COTE: Readonly<Record<CoteConformite, string>> = { C: 'Conforme', SC: 'Substantiellement conforme', NC: 'Non conforme', SO: 'Sans objet' };
/** La cote de départ : celle de la commission, sinon la proposée, sinon la décision d'avant la grille cotée (vrai → C, faux → NC). */
export function coteInitiale(v: VerificationConformite): Choix {
  return v.cote ?? v.coteProposee ?? (v.satisfaite === true ? 'C' : v.satisfaite === false ? 'NC' : '');
}

/**
 * Une offre à l'**examen préliminaire** (étape 2 du guide, art. 43, 46) : la grille des neuf vérifications pré-remplie par le
 * serveur depuis la lecture de séance (`proposee`, `constat`), que la CAO confirme ou corrige, puis la décision — conforme, ou
 * ⚠️ Guide de la CAO, tranche 2 (15/10) : la grille du guide s'y ajoute (date et signature de l'acte, validité, délai, bordereau,
 * sommes versées aux tiers, validité de la garantie, visite des lieux, autres conditions), chaque rubrique cotée C · SC · NC · SO
 * (vide : à examiner) ; en fournitures déposées par formulaires, les spécifications techniques se cotent aussi. La grille ne décide
 * pas : la décision reste celle de la commission.
 * écartée avec sa qualification (art. 1), son motif et la clause du DAO visée. Une proposition n'est jamais une décision.
 * Les précisions (art. 35-VI) : demandées par la PRMP, la réponse du candidat jointe au rapport.
 */
@Component({
  selector: 'app-conformite-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemandeVue],
  template: `
    @let o = offre();
    @let c = o.conformite;
    <article class="card co" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
      <header class="co__tete">
        <h3 class="co__titre">Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }} <span class="cnm-mono text-sm text-muted">NIF {{ o.entreprise.nif }}</span></h3>
        @if (c?.decision === 'CONFORME') { <span class="badge badge-success">Conforme</span> }
        @else if (c?.decision === 'ECARTEE') { <span class="badge badge-danger">Écartée — {{ qualifications[c!.qualification!] }}</span> }
        @else { <span class="badge badge-warning">À décider</span> }
        @if (o.precisionsEnAttente) { <span class="badge badge-info">{{ o.precisionsEnAttente }} précision(s) attendue(s)</span> }
      </header>
      @if (c?.decision && c?.nom) { <p class="text-sm text-muted co__auteur">Décision de {{ c!.nom }}, le {{ dateHeure(c!.le) }}@if (c?.motif) { — {{ c!.motif }}@if (c?.clause) { ({{ c!.clause }}) } }</p> }

      <div class="cnm-table-wrap">
        <table class="cnm-table co__grille" [attr.aria-label]="'Vérifications de l’offre n° ' + (o.numero ?? '?')">
          <thead><tr><th scope="col">Rubrique</th><th scope="col">Valeur relevée</th><th scope="col">Proposé</th><th scope="col">Cote de la CAO</th><th scope="col">Observation</th></tr></thead>
          <tbody>
            @for (v of c?.verifications ?? []; track v.code) {
              <tr [class.co__non]="choix()[v.code] === 'NC'">
                <th scope="row">{{ v.libelle }}</th>
                <td class="text-sm">{{ v.constat || '—' }}</td>
                <td class="text-sm">{{ proposition(v) }}</td>
                <td>
                  <select class="form-control form-control-sm" [attr.aria-label]="'Cote : ' + v.libelle" [disabled]="!modifiable()" (change)="choisir(v.code, $any($event.target).value)">
                    <option value="" [selected]="!choix()[v.code]">À examiner</option>
                    @for (k of cotes; track k) { <option [value]="k" [selected]="choix()[v.code] === k">{{ libellesCote[k] }}</option> }
                  </select>
                </td>
                <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Observation : ' + v.libelle" [disabled]="!modifiable()" [value]="observations()[v.code] ?? ''" (input)="observer(v.code, $any($event.target).value)" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-sm text-muted co__legende">C : conforme · SC : substantiellement conforme · NC : non conforme · SO : sans objet. La grille ne décide pas : la décision sur l'offre reste à prendre ci-dessous.</p>

      <!-- ⚠️ Guide de la CAO (§B3.2) — les spécifications techniques, cotées par la commission (fournitures déposées par formulaires). -->
      <details class="co__specs" (toggle)="ouvertSpecs($any($event.target).open)">
        <summary>Spécifications techniques{{ specs()?.length ? ' — ' + specs()!.length + ' caractéristique(s)' : '' }}</summary>
        @if (specs() === null) {
          <p class="text-sm" role="status">Chargement…</p>
        } @else if (!specs()!.length) {
          <p class="text-sm text-muted">Rien à coter en ligne : l’offre est déposée par pièces (la rubrique « conformité technique » de la grille en tient lieu).</p>
        } @else {
          <div class="cnm-table-wrap">
            <table class="cnm-table co__grille co__grille--specs" [attr.aria-label]="'Spécifications techniques de l’offre n° ' + (o.numero ?? '?')">
              <thead><tr><th scope="col">Article · caractéristique</th><th scope="col">Exigée</th><th scope="col">Proposée</th><th scope="col">Déclaration du candidat</th><th scope="col">Cote de la CAO</th><th scope="col">Observation</th></tr></thead>
              <tbody>
                @for (s of specs(); track cleSpec(s)) {
                  <tr [class.co__non]="coteSpec()[cleSpec(s)] === 'NC'">
                    <th scope="row">{{ s.article }}@if (s.marque || s.modele) { <span class="text-muted"> ({{ s.marque }} {{ s.modele }})</span> } · {{ s.caracteristique }}</th>
                    <td class="text-sm">{{ s.exigee || '—' }}</td>
                    <td class="text-sm">{{ s.proposee || '—' }}</td>
                    <td class="text-sm">{{ s.declareeConforme === true ? 'Conforme' : s.declareeConforme === false ? 'Non conforme' : '—' }}</td>
                    <td>
                      <select class="form-control form-control-sm" [attr.aria-label]="'Cote : ' + s.article + ', ' + s.caracteristique" [disabled]="!modifiable()" (change)="coterSpec(s, $any($event.target).value)">
                        <option value="" [selected]="!coteSpec()[cleSpec(s)]">À examiner</option>
                        @for (k of cotesSpec; track k) { <option [value]="k" [selected]="coteSpec()[cleSpec(s)] === k">{{ libellesCote[k] }}</option> }
                      </select>
                    </td>
                    <td><input class="form-control form-control-sm" type="text" [attr.aria-label]="'Observation : ' + s.article + ', ' + s.caracteristique" [disabled]="!modifiable()" [value]="obsSpec()[cleSpec(s)] ?? ''" (input)="observerSpec(s, $any($event.target).value)" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </details>

      @if (modifiable()) {
        <fieldset class="co__decision">
          <legend class="form-label">Décision sur l'offre</legend>
          <div class="co__radios">
            <label><input type="radio" [name]="'dec-' + o.idOffre" [checked]="decision() === 'CONFORME'" (change)="decision.set('CONFORME')" /> Conforme pour l'essentiel : elle passe à l'évaluation</label>
            <label><input type="radio" [name]="'dec-' + o.idOffre" [checked]="decision() === 'ECARTEE'" (change)="decision.set('ECARTEE')" /> Écartée</label>
          </div>
          @if (nonSatisfaites() && decision() === 'CONFORME') {
            <p class="text-sm co__rappel" role="status">{{ nonSatisfaites() }} rubrique(s) non conforme(s) : une offre peut être retenue malgré tout, motivez-le dans l'observation.</p>
          }
          @if (decision() === 'ECARTEE') {
            <div class="co__ecart">
              <label class="form-group">
                <span class="form-label">Qualification (art. 1)</span>
                <select class="form-control" (change)="qualification.set($any($event.target).value || null)">
                  <option value="" [selected]="!qualification()">— Choisir —</option>
                  @for (q of codesQualification; track q) { <option [value]="q" [selected]="qualification() === q">{{ qualifications[q] }}</option> }
                </select>
                @if (qualification(); as q) { <span class="text-sm text-muted">{{ aides[q] }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">Motif (porté au rapport)</span>
                <input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" />
              </label>
              <label class="form-group">
                <span class="form-label">Clause du DAO visée</span>
                <input class="form-control" type="text" placeholder="ex. IC 4.1, DPAO 6.2" [value]="clause()" (input)="clause.set($any($event.target).value)" />
              </label>
            </div>
          }
          <div class="co__actions">
            <button type="button" class="btn btn-primary btn-sm" [disabled]="!decision() || travail()" (click)="enregistrer()">Enregistrer la décision</button>
          </div>
        </fieldset>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

      <details class="co__precisions" (toggle)="ouvertPrecisions($any($event.target).open)">
        <summary>Précisions demandées au candidat (art. 35-VI){{ precisions().length ? ' — ' + precisions().length : '' }}</summary>
        <div class="co__precisions-corps">
          @for (d of precisions(); track d.idDemande) { <app-demande-vue [idDmc]="idDmc()" [demande]="d" /> }
          @if (precisionsChargees() && !precisions().length) { <p class="text-sm text-muted">Aucune demande.</p> }
          @if (droits().prmp) {
            <div class="co__demande">
              <label class="form-group">
                <span class="form-label">Question au candidat</span>
                <textarea class="form-control" rows="2" [value]="question()" (input)="question.set($any($event.target).value)"></textarea>
              </label>
              <label class="form-group co__delai">
                <span class="form-label">Délai (jours)</span>
                <input class="form-control" type="number" min="1" placeholder="celui de la fiche" [value]="delai() ?? ''" (input)="delai.set(+$any($event.target).value || null)" />
              </label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="!question().trim() || travail()" (click)="demander()">Demander une précision</button>
              <p class="text-sm text-muted co__regle">Une précision ne sert jamais à compléter une pièce essentielle manquante ni à changer le prix (guide §2.4).</p>
            </div>
          }
        </div>
      </details>
    </article>
  `,
  styles: `
    .co { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .co__tete { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .co__titre { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .co__auteur, .co__rappel, .co__regle { margin: 0; }
    /* Le style global des en-têtes de tableau (texte blanc sur fond sombre) ne vaut que pour thead : l'en-tête de ligne reste lisible. */
    .co__grille { table-layout: fixed; width: 100%; }
    .co__grille th, .co__grille td { white-space: normal; vertical-align: top; }
    .co__grille tbody th[scope='row'] { font-weight: 600; text-align: left; color: var(--n-800); background: transparent; text-transform: none; letter-spacing: normal; font-size: var(--text-sm); }
    .co__grille thead th:nth-child(1) { width: 24%; }
    .co__grille thead th:nth-child(2) { width: 28%; }
    .co__grille thead th:nth-child(3) { width: 13%; }
    .co__grille thead th:nth-child(4) { width: 15%; }
    .co__grille thead th:nth-child(5) { width: 20%; }
    .co__non td, .co__non th { background: var(--n-100); }
    .co__legende { margin: 0; }
    .co__specs summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .co__grille--specs thead th { width: auto !important; }
    .co__decision { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .co__radios { display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .co__ecart { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 0.5rem; }
    .co__actions { display: flex; justify-content: flex-end; }
    .co__precisions summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .co__precisions-corps { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; }
    .co__demande { display: grid; grid-template-columns: 3fr 1fr auto; gap: 0.5rem; align-items: end; }
    .co__regle { grid-column: 1 / -1; }
    @media (max-width: 800px) { .co__ecart, .co__demande { grid-template-columns: 1fr; } }
  `,
})
export class ConformiteOffre implements OnInit {
  readonly idDmc = input.required<number>();
  readonly offre = input.required<OffreEvaluee>();
  readonly droits = input.required<DroitsEvaluation>();
  /** L'étape est arrêtée : décisions figées. */
  readonly figee = input(false);
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly toast = inject(ToastService);

  readonly qualifications = LIBELLES_QUALIFICATION_REJET;
  readonly aides = AIDES_QUALIFICATION_REJET;
  readonly codesQualification = Object.keys(LIBELLES_QUALIFICATION_REJET) as QualificationRejet[];
  readonly dateHeure = dateHeureFr;

  readonly cotes: readonly CoteConformite[] = ['C', 'SC', 'NC', 'SO'];
  readonly cotesSpec: readonly CoteConformite[] = ['C', 'SC', 'NC'];
  readonly libellesCote = LIBELLES_COTE;
  readonly choix = signal<Partial<Record<CodeVerification, Choix>>>({});
  /** Les spécifications de l'offre : nul tant qu'elles ne sont pas lues (à l'ouverture du volet, ou avant l'enregistrement). */
  readonly specs = signal<SpecificationOffre[] | null>(null);
  readonly coteSpec = signal<Record<string, Choix>>({});
  readonly obsSpec = signal<Record<string, string>>({});
  readonly observations = signal<Partial<Record<CodeVerification, string>>>({});
  readonly decision = signal<'CONFORME' | 'ECARTEE' | null>(null);
  readonly qualification = signal<QualificationRejet | null>(null);
  readonly motif = signal('');
  readonly clause = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly precisions = signal<DemandeEvaluation[]>([]);
  readonly precisionsChargees = signal(false);
  readonly question = signal('');
  readonly delai = signal<number | null>(null);

  readonly modifiable = computed(() => this.droits().decider && !this.figee());
  readonly nonSatisfaites = computed(() => Object.values(this.choix()).filter((c) => c === 'NC').length);

  ngOnInit(): void {
    const c = this.offre().conformite;
    const choix: Partial<Record<CodeVerification, Choix>> = {};
    const obs: Partial<Record<CodeVerification, string>> = {};
    for (const v of c?.verifications ?? []) {
      choix[v.code] = coteInitiale(v);
      if (v.observation) obs[v.code] = v.observation;
    }
    this.choix.set(choix);
    this.observations.set(obs);
    this.decision.set(c?.decision ?? null);
    this.qualification.set(c?.qualification ?? null);
    this.motif.set(c?.motif ?? '');
    this.clause.set(c?.clause ?? '');
  }

  choisir(code: CodeVerification, valeur: Choix): void {
    this.choix.update((c) => ({ ...c, [code]: valeur }));
  }

  /** Ce que le serveur propose : la cote, sinon l'ancienne proposition (vrai, faux, nul). */
  proposition(v: VerificationConformite): string {
    if (v.coteProposee) return LIBELLES_COTE[v.coteProposee];
    if (v.coteProposee === null && v.cote !== undefined) return 'À examiner';
    return v.proposee === true ? 'Satisfaite' : v.proposee === false ? 'Non satisfaite' : 'Sans objet / à examiner';
  }

  cleSpec(s: SpecificationOffre): string {
    return s.idArticle + '-' + s.idCaracteristique;
  }

  coterSpec(s: SpecificationOffre, valeur: Choix): void {
    this.coteSpec.update((c) => ({ ...c, [this.cleSpec(s)]: valeur }));
  }

  observerSpec(s: SpecificationOffre, texte: string): void {
    this.obsSpec.update((o) => ({ ...o, [this.cleSpec(s)]: texte }));
  }

  ouvertSpecs(ouvert: boolean): void {
    if (ouvert && this.specs() === null) this.chargerSpecs().subscribe({ error: (e: ApiError) => this.erreur.set(refusEvaluation(e)) });
  }

  /** Lit les spécifications et pose les cotes de départ (celle de la commission, sinon la déclaration du candidat). */
  private chargerSpecs(): Observable<SpecificationOffre[]> {
    return this.service.specifications(this.idDmc(), this.offre().idOffre).pipe(
      tap((l) => {
        const cotes: Record<string, Choix> = {};
        const obs: Record<string, string> = {};
        for (const s of l) {
          cotes[this.cleSpec(s)] = s.cote ?? s.coteProposee ?? '';
          if (s.observation) obs[this.cleSpec(s)] = s.observation;
        }
        this.coteSpec.set(cotes);
        this.obsSpec.set(obs);
        this.specs.set(l);
      }),
    );
  }

  observer(code: CodeVerification, texte: string): void {
    this.observations.update((o) => ({ ...o, [code]: texte }));
  }

  enregistrer(): void {
    const decision = this.decision();
    if (!decision) return;
    const ecartee = decision === 'ECARTEE';
    this.travail.set(true);
    this.erreur.set(null);
    // ⚠️ §B3.2 — le PUT remplace toute la décision : les spécifications sont lues avant, pour renvoyer leurs cotes.
    const specs$ = this.specs() === null ? this.chargerSpecs() : of(this.specs()!);
    specs$
      .pipe(
        switchMap((specs) =>
          this.service.conformite(this.idDmc(), this.offre().idOffre, {
            verifications: (this.offre().conformite?.verifications ?? []).map((v) => {
              const cote = this.choix()[v.code] || null;
              const observation = this.observations()[v.code]?.trim() || null;
              return cote ? { code: v.code, cote, observation } : { code: v.code, cote: null, satisfaite: null, observation };
            }),
            ...(specs.length
              ? {
                  specifications: specs
                    .filter((s) => this.coteSpec()[this.cleSpec(s)])
                    .map((s) => ({
                      idArticle: s.idArticle,
                      idCaracteristique: s.idCaracteristique,
                      cote: this.coteSpec()[this.cleSpec(s)] as CoteConformite,
                      observation: this.obsSpec()[this.cleSpec(s)]?.trim() || null,
                    })),
                }
              : {}),
            decision,
            qualification: ecartee ? this.qualification() : null,
            motif: ecartee ? this.motif().trim() || null : null,
            clause: ecartee ? this.clause().trim() || null : null,
          }),
        ),
      )
      .subscribe({
        next: (ev) => {
          this.travail.set(false);
          this.toast.success(ecartee ? 'L’offre est écartée ; le motif est porté au rapport.' : 'L’offre est retenue à l’examen préliminaire.');
          this.maj.emit(ev);
        },
        error: (e: ApiError) => this.echec(e),
      });
  }

  ouvertPrecisions(ouvert: boolean): void {
    if (ouvert && !this.precisionsChargees()) this.chargerPrecisions();
  }

  private chargerPrecisions(): void {
    this.service.precisions(this.idDmc(), this.offre().idOffre).subscribe({
      next: (l) => {
        this.precisions.set(l);
        this.precisionsChargees.set(true);
      },
      error: (e: ApiError) => this.erreur.set(refusEvaluation(e)),
    });
  }

  demander(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.demanderPrecision(this.idDmc(), this.offre().idOffre, this.question().trim(), this.delai()).subscribe({
      next: (d) => {
        this.travail.set(false);
        this.question.set('');
        this.delai.set(null);
        this.precisions.update((l) => [...l, d]);
        this.toast.success('La demande est envoyée au candidat, par notification et par courriel.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  private echec(e: ApiError): void {
    this.travail.set(false);
    this.erreur.set(refusEvaluation(e));
  }
}
