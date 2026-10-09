import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Financiere, LotFinancier, PropositionFinanciere } from '../../models';
import { EvaluationPiService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { DroitsEvaluation } from './droits-evaluation';
import { ariary } from './libelles-evaluation';
import { LIBELLES_METHODE_PI, LIBELLES_STATUT_FINANCIER, methodeAuPremierRang, refusPi } from './libelles-pi';
import { SaisieFinanciereVue } from './saisie-financiere';

/** Les propositions ex aequo d'un lot, dans l'ordre servi : ce sont elles que la commission départage. */
export function exAequo(l: LotFinancier): PropositionFinanciere[] {
  return l.propositions.filter((p) => p.egalite);
}

/** Déplace l'élément d'indice `i` d'un cran (`-1` vers le haut, `+1` vers le bas) ; rend une nouvelle liste. */
export function deplacer<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return liste;
  const l = [...liste];
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}

/**
 * ⚠️ **L'évaluation financière et le classement** des propositions de prestations intellectuelles (lot 3 PI, PI-d2a — V89). Seules les
 * propositions qualifiées techniquement y figurent. Le classement suit la méthode de la fiche : qualité-coût (score combiné), budget
 * prédéterminé (au-delà : hors budget, rang technique), moindre coût (montant comparé), qualité technique exclusivement et qualification
 * du consultant (rang technique ; seule la première ouvre sa financière). Les ex aequo se départagent, motivés ; le président arrête,
 * et la négociation (PRMP) s'ouvre avec le premier classé.
 */
@Component({
  selector: 'app-etape-financiere',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SaisieFinanciereVue],
  template: `
    @let f = financiere();
    @if (lotF(); as l) {
      <section class="card ef" aria-labelledby="ef-titre">
        <h2 id="ef-titre" class="ef__titre">Évaluation financière et classement{{ f.lots.length > 1 ? ' — lot ' + l.lot : '' }}</h2>
        <p class="text-sm ef__methode">
          Méthode : <strong>{{ f.codeMethode ? methodes[f.codeMethode] : (f.methode || '—') }}</strong>
          @if (f.codeMethode === 'QUALITE_COUT') { · poids technique {{ f.poidsTechnique ?? '—' }}, financier {{ f.poidsFinancier ?? '—' }} }
          @if (f.codeMethode === 'BUDGET') { · budget disponible {{ ariary(f.budget) }} HT }
        </p>
        @if (auPremierRang()) {
          <p class="text-sm text-muted ef__aide">Le rang est technique : seule la première proposition ouvre son enveloppe financière, puis se négocie ; en cas d’échec, la suivante s’ouvre en séance complémentaire.</p>
        }
        @if (l.arret; as a) {
          <p class="text-sm ef__arret">Classement arrêté par {{ a.nom || a.par }} le {{ jj(a.le) }}{{ a.observation ? ' — ' + a.observation : '' }}.</p>
        }
        @if (message(); as m) { <div class="alert alert-danger" role="alert"><span>{{ m }}</span></div> }

        <div class="table-card">
          <table class="ef__table">
            <caption class="cnm-sr-only">Le classement financier du lot {{ l.lot }}</caption>
            <thead>
              <tr>
                <th scope="col">N°</th><th scope="col">Candidat</th><th scope="col">Note technique</th><th scope="col">Statut</th>
                <th scope="col">Montant comparé</th>
                @if (f.codeMethode === 'QUALITE_COUT') { <th scope="col">Score financier</th><th scope="col">Score combiné</th> }
                <th scope="col">Rang</th>
              </tr>
            </thead>
            <tbody>
              @for (p of l.propositions; track p.idOffre) {
                <tr [class.ef__egal]="p.egalite">
                  <td>{{ p.numero ?? '—' }}</td><td>{{ p.raisonSociale || p.nif }}</td><td>{{ p.noteTechnique ?? '—' }}</td>
                  <td>{{ statuts[p.statut] }}</td><td>{{ ariary(p.montantCompare) }}</td>
                  @if (f.codeMethode === 'QUALITE_COUT') { <td>{{ p.scoreFinancier ?? '—' }}</td><td><strong>{{ p.scoreCombine ?? '—' }}</strong></td> }
                  <td>{{ p.rang ?? '—' }}{{ p.egalite ? ' (ex aequo)' : '' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="text-muted">Aucune proposition qualifiée sur ce lot.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (l.departage; as d) {
          <p class="text-sm">Départage par {{ d.nom || d.par }} le {{ jj(d.le) }} : {{ d.motif }}</p>
        }

        @for (p of l.propositions; track p.idOffre) {
          <app-saisie-financiere [idDmc]="idDmc()" [proposition]="p" [modifiable]="decider() && !l.arret" (maj)="maj.emit($event)" />
        }

        @if (decider() && !l.arret && egaux().length > 1) {
          <fieldset class="ef__departage">
            <legend class="form-label">Départager les propositions ex aequo</legend>
            <ol class="ef__ordre">
              @for (p of ordre(); track p.idOffre; let i = $index) {
                <li>
                  <span>N° {{ p.numero ?? '—' }} · {{ p.raisonSociale || p.nif }}</span>
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === 0" [attr.aria-label]="'Monter la proposition n° ' + (p.numero ?? '')" (click)="monter(i, -1)">↑</button>
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="i === ordre().length - 1" [attr.aria-label]="'Descendre la proposition n° ' + (p.numero ?? '')" (click)="monter(i, 1)">↓</button>
                </li>
              }
            </ol>
            <label class="form-group"><span class="form-label">Motif du départage (obligatoire)</span><input class="form-control" type="text" [value]="motifDepartage()" (input)="motifDepartage.set($any($event.target).value)" /></label>
            <div><button type="button" class="btn btn-outline btn-sm" [disabled]="!motifDepartage().trim() || travail()" (click)="departager(l)">Départager</button></div>
          </fieldset>
        }

        @if (droits().president) {
          <div class="ef__president">
            @if (!l.arret) {
              <label class="form-group"><span class="form-label">Observation (facultative)</span><input class="form-control" type="text" [value]="observation()" (input)="observation.set($any($event.target).value)" /></label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="travail()" (click)="arreter(l)">Arrêter le classement du lot {{ l.lot }}</button>
            } @else {
              <details>
                <summary>Rouvrir le classement…</summary>
                <div class="ef__rouvrir">
                  <label class="form-group"><span class="form-label">Motif (obligatoire)</span><input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" /></label>
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="!motif().trim() || travail()" (click)="rouvrir(l)">Rouvrir</button>
                </div>
              </details>
            }
          </div>
        }
      </section>
    }
  `,
  styles: `
    .ef { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .ef__titre { margin: 0; font-size: 1.05rem; }
    .ef__methode, .ef__aide, .ef__arret { margin: 0; }
    .ef__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ef__table th, .ef__table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--n-200); }
    .ef__egal td { background: #fffbeb; }
    .ef__departage { border: 1px solid var(--n-200); border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ef__ordre { margin: 0; padding-left: 1.4rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--text-sm); }
    .ef__ordre li span { margin-right: 0.4rem; }
    .ef__president { border-top: 1px dashed var(--n-200); padding-top: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .ef__president > .btn { align-self: flex-start; }
    .ef__rouvrir { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; margin-top: 0.4rem; }
  `,
})
export class EtapeFinanciere {
  private readonly service = inject(EvaluationPiService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly financiere = input.required<Financiere>();
  readonly lot = input.required<number>();
  readonly droits = input.required<DroitsEvaluation>();
  readonly maj = output<Financiere>();

  readonly methodes = LIBELLES_METHODE_PI;
  readonly statuts = LIBELLES_STATUT_FINANCIER;
  readonly ariary = ariary;
  readonly jj = dateHeureFr;

  readonly lotF = computed<LotFinancier | null>(() => this.financiere().lots.find((l) => l.lot === this.lot()) ?? this.financiere().lots[0] ?? null);
  readonly decider = computed(() => this.droits().decider);
  readonly auPremierRang = computed(() => methodeAuPremierRang(this.financiere().codeMethode));
  readonly egaux = computed(() => { const l = this.lotF(); return l ? exAequo(l) : []; });
  /** L'ordre de départage en cours de saisie ; il repart de l'ordre servi à chaque nouvelle réponse. */
  private readonly ordreSaisi = signal<PropositionFinanciere[] | null>(null);
  readonly ordre = computed(() => this.ordreSaisi() ?? this.egaux());
  readonly motifDepartage = signal('');
  readonly observation = signal('');
  readonly motif = signal('');
  readonly travail = signal(false);
  readonly message = signal<string | null>(null);

  monter(i: number, sens: -1 | 1): void {
    this.ordreSaisi.set(deplacer(this.ordre(), i, sens));
  }

  departager(l: LotFinancier): void {
    this.geste(this.service.departagerFinancier(this.idDmc(), l.lot, this.ordre().map((p) => p.idOffre), this.motifDepartage().trim()), 'Départage enregistré.', () => {
      this.ordreSaisi.set(null);
      this.motifDepartage.set('');
    });
  }

  arreter(l: LotFinancier): void {
    this.geste(this.service.arreterClassement(this.idDmc(), l.lot, this.observation().trim() || null), `Classement du lot ${l.lot} arrêté : la négociation peut s’ouvrir.`, () => this.observation.set(''));
  }

  rouvrir(l: LotFinancier): void {
    this.geste(this.service.rouvrirClassement(this.idDmc(), l.lot, this.motif().trim()), `Classement du lot ${l.lot} rouvert.`, () => this.motif.set(''));
  }

  private geste(appel: ReturnType<EvaluationPiService['arreterClassement']>, succes: string, apres: () => void): void {
    this.travail.set(true);
    this.message.set(null);
    appel.subscribe({
      next: (f) => {
        this.travail.set(false);
        apres();
        this.toast.success(succes);
        this.maj.emit(f);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.message.set(refusPi(e));
      },
    });
  }
}
