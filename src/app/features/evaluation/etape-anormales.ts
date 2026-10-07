import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DecisionAnormale, DemandeEvaluation, Evaluation, IndicateursPrix, OffreEvaluee } from '../../models';
import { EvaluationService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DemandeVue } from './demande-vue';
import { DroitsEvaluation } from './droits-evaluation';
import { LIBELLES_ANORMALE, ariary, ecartPourCent, refusEvaluation } from './libelles-evaluation';

/**
 * Les **indicateurs de prix** d'un lot (étape 4, art. 48) : l'écart de chaque offre classée à l'estimation du plan et à la
 * moyenne des offres, et la méthode de détection du DAO (`B06-EO-07`). Des indicateurs, jamais une décision : sans méthode au
 * DAO, la CAO motive au cas par cas (guide §4).
 */
@Component({
  selector: 'app-indicateurs-prix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (indicateurs(); as ind) {
      <section class="ip" aria-labelledby="ip-titre">
        <h3 id="ip-titre" class="ip__h3">Indicateurs de prix — lot {{ lot() }}</h3>
        <p class="text-sm ip__methode"><strong>Méthode du DAO :</strong> {{ ind.methodeDao || 'aucune — la CAO motive son appréciation au cas par cas.' }}</p>
        <p class="text-sm ip__methode">Estimation du plan : <strong>{{ ariary(ind.estimation) }}</strong> (telle que le plan la porte) · moyenne des offres classées : <strong>{{ ariary(ind.moyenne) }}</strong> HT</p>
        <div class="cnm-table-wrap">
          <table class="cnm-table" aria-labelledby="ip-titre">
            <thead><tr><th scope="col">Offre</th><th scope="col">Montant HT (corrigé, rabais déduit)</th><th scope="col">Écart à l'estimation</th><th scope="col">Écart à la moyenne</th><th scope="col">Sous-détails</th></tr></thead>
            <tbody>
              @for (o of ind.offres; track o.idOffre) {
                <tr>
                  <td>n° {{ o.numero ?? '—' }}</td>
                  <td class="ip__num">{{ ariary(o.montant) }}</td>
                  <td class="ip__num">{{ ecart(o.ecartEstimation) }}</td>
                  <td class="ip__num">{{ ecart(o.ecartMoyenne) }}</td>
                  <td class="text-sm">{{ o.alertes.length ? o.alertes.join(' ; ') : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
  `,
  styles: `
    .ip { display: flex; flex-direction: column; gap: 0.4rem; }
    .ip__h3 { margin: 0; font-size: 0.95rem; }
    .ip__methode { margin: 0; }
    .ip__num { text-align: right; white-space: nowrap; }
  `,
})
export class IndicateursPrixVue implements OnInit {
  readonly idDmc = input.required<number>();
  readonly lot = input.required<number>();

  private readonly service = inject(EvaluationService);
  readonly ariary = ariary;
  readonly ecart = ecartPourCent;
  readonly indicateurs = signal<IndicateursPrix | null>(null);
  readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.service.indicateursPrix(this.idDmc(), this.lot()).subscribe({
      next: (i) => this.indicateurs.set(i),
      error: (e: ApiError) => this.erreur.set(refusEvaluation(e)),
    });
  }
}

/**
 * Une offre classée à l'**étape 4** : non suspectée, suspectée (justification attendue), puis maintenue ou rejetée. **Aucun rejet
 * sans demande écrite** (art. 48-I) : la PRMP demande la justification, le candidat répond ou le délai expire, puis la CAO
 * décide ; le serveur refuse tout raccourci (409 `JUSTIFICATION_NON_DEMANDEE`, `DELAI_EN_COURS`).
 */
@Component({
  selector: 'app-anormale-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemandeVue],
  template: `
    @let o = offre();
    @let a = o.anormale;
    <article class="card ao" [attr.aria-label]="'Offre n° ' + (o.numero ?? '?')">
      <header class="ao__tete">
        <h3 class="ao__titre">Offre n° {{ o.numero ?? '—' }} · {{ o.entreprise.raisonSociale }}</h3>
        @if (o.rang) { <span class="badge badge-primary">Rang {{ o.rang }}</span> }
        <span class="text-sm">Montant évalué : <strong>{{ ariary(o.evaluation?.montantEvalue) }}</strong></span>
        @if (a?.decision) {
          <span class="badge" [class.badge-success]="a!.decision === 'NON_SUSPECTEE' || a!.decision === 'MAINTENUE'" [class.badge-warning]="a!.decision === 'SUSPECTEE'" [class.badge-danger]="a!.decision === 'REJETEE'">{{ libelles[a!.decision!] }}</span>
        } @else { <span class="badge badge-warning">À décider</span> }
      </header>
      @if (a?.motif) { <p class="text-sm ao__motif">{{ a!.motif }}@if (a?.nom) { <span class="text-muted"> — {{ a!.nom }}, {{ dateHeure(a!.le) }}</span> }</p> }

      @for (d of justifications(); track d.idDemande) { <app-demande-vue [idDmc]="idDmc()" [demande]="d" /> }

      @if (droits().prmp && !justifications().length && !figee()) {
        <div class="ao__demande">
          <label class="form-group"><span class="form-label">Justification demandée au candidat (prix unitaires, sous-détails, moyens)</span>
            <textarea class="form-control" rows="2" [value]="elements()" (input)="elements.set($any($event.target).value)"></textarea>
          </label>
          <label class="form-group ao__delai"><span class="form-label">Délai (jours)</span>
            <input class="form-control" type="number" min="1" placeholder="celui de la fiche" [value]="delai() ?? ''" (input)="delai.set(+$any($event.target).value || null)" />
          </label>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="!elements().trim() || travail()" (click)="demander()">Demander la justification</button>
        </div>
      }

      @if (modifiable()) {
        <fieldset class="ao__decision">
          <legend class="form-label">Décision de la CAO</legend>
          <div class="ao__radios">
            @for (d of decisions; track d) {
              <label><input type="radio" [name]="'an-' + o.idOffre" [checked]="choix() === d" (change)="choix.set(d)" /> {{ libelles[d] }}</label>
            }
          </div>
          @if (choix() && choix() !== 'NON_SUSPECTEE') {
            <label class="form-group"><span class="form-label">Motif (porté au rapport)</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
          }
          @if (choix() === 'REJETEE') { <p class="text-sm ao__rappel">Le rejet n'est possible qu'après la justification demandée, puis reçue ou son délai expiré.</p> }
          <div class="ao__actions"><button type="button" class="btn btn-primary btn-sm" [disabled]="!choix() || travail()" (click)="enregistrer()">Enregistrer</button></div>
        </fieldset>
      }
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
    </article>
  `,
  styles: `
    .ao { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .ao__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .ao__titre { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .ao__motif, .ao__rappel { margin: 0; }
    .ao__demande { display: grid; grid-template-columns: 3fr 1fr auto; gap: 0.5rem; align-items: end; }
    .ao__decision { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ao__radios { display: flex; gap: 1rem; flex-wrap: wrap; font-size: var(--text-sm); }
    .ao__actions { display: flex; justify-content: flex-end; }
    @media (max-width: 800px) { .ao__demande { grid-template-columns: 1fr; } }
  `,
})
export class AnormaleOffre implements OnInit {
  readonly idDmc = input.required<number>();
  readonly offre = input.required<OffreEvaluee>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly figee = input(false);
  readonly maj = output<Evaluation>();

  private readonly service = inject(EvaluationService);
  private readonly toast = inject(ToastService);

  readonly libelles = LIBELLES_ANORMALE;
  readonly decisions: readonly DecisionAnormale[] = ['NON_SUSPECTEE', 'SUSPECTEE', 'MAINTENUE', 'REJETEE'];
  readonly ariary = ariary;
  readonly dateHeure = dateHeureFr;

  readonly justifications = signal<DemandeEvaluation[]>([]);
  readonly elements = signal('');
  readonly delai = signal<number | null>(null);
  readonly choix = signal<DecisionAnormale | null>(null);
  readonly motif = signal('');
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly modifiable = computed(() => this.droits().decider && !this.figee());

  ngOnInit(): void {
    const a = this.offre().anormale;
    this.choix.set(a?.decision ?? null);
    this.motif.set(a?.motif ?? '');
    if (a?.justification) this.justifications.set([a.justification]);
    else this.service.justifications(this.idDmc(), this.offre().idOffre).subscribe({ next: (l) => this.justifications.set(l), error: () => undefined });
  }

  demander(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.demanderJustification(this.idDmc(), this.offre().idOffre, this.elements().trim(), this.delai()).subscribe({
      next: (d) => {
        this.travail.set(false);
        this.justifications.set([d]);
        this.elements.set('');
        this.toast.success('La demande de justification est envoyée au candidat, par notification et par courriel.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  enregistrer(): void {
    const c = this.choix();
    if (!c) return;
    this.travail.set(true);
    this.erreur.set(null);
    const decision = c === 'MAINTENUE' || c === 'REJETEE' ? c : null;
    this.service.anormale(this.idDmc(), this.offre().idOffre, c !== 'NON_SUSPECTEE', decision, c === 'NON_SUSPECTEE' ? null : this.motif().trim() || null).subscribe({
      next: (ev) => {
        this.travail.set(false);
        this.toast.success(c === 'REJETEE' ? 'L’offre est rejetée et sort du classement.' : 'La décision est enregistrée.');
        this.maj.emit(ev);
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  private echec(e: ApiError): void {
    this.travail.set(false);
    this.erreur.set(refusEvaluation(e));
  }
}
