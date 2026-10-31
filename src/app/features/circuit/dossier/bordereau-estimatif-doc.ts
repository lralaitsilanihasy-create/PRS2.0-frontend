import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';

import { ArticleFiche, EstimationLot, FicheMarche } from '../../../models';
import { FicheMarcheService } from '../../../services';
import { montantOfficiel } from '../../../shared/prmp/document-officiel';

/** Un lot du bordereau : ses articles chiffrés et son estimation face au plan. */
interface LotBordereau {
  lot: number | null;
  articles: { a: ArticleFiche; quantite: number | null; montant: number | null }[];
  estimation: EstimationLot | null;
}

/**
 * ⚠️ 18/10 (pilote) — le **bordereau des prix estimatifs** (le DQE estimatif en travaux) d'un dossier né d'une fiche, présenté en
 * données : les articles de la fiche par lot, quantité (le maximum à commandes), prix unitaire estimé HT, montant, et le total du lot
 * face au montant du plan (`estimations`, V116). Le PDF joint d'office (V117) reste la pièce du dossier ; il s'ouvre de la liste des
 * pièces. ⚠️ 18/10 (B2, `articles?version=n`) — articles et estimations de la version SOUMISE ; avant la soumission, la courante.
 */
@Component({
  selector: 'app-bordereau-estimatif-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="be" aria-labelledby="be-titre">
      <div class="be__tete">
        <h3 id="be-titre" class="be__titre">{{ travaux() ? 'Devis quantitatif et estimatif' : 'Bordereau des prix estimatifs' }}</h3>
        @if (fiche(); as f) { <span class="be__version">fiche DAO, version {{ versionSoumise() || f.version }}{{ versionSoumise() ? ', soumise' : '' }}</span> }
      </div>
      @if (chargement()) {
        <p class="be__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="be__refus" role="alert">{{ r }}</p>
      } @else {
        @for (l of lots(); track l.lot) {
          <div class="be__lot">
            @if (l.lot !== null) { <h4 class="be__lot-titre">Lot {{ l.lot }}</h4> }
            <div class="be__cadre">
              <table class="be__table">
                <thead>
                  <tr>
                    <th scope="col">N° prix</th><th scope="col">Désignation</th><th scope="col">Unité</th>
                    <th scope="col" class="be__num">Quantité</th><th scope="col" class="be__num">Prix unitaire HT</th><th scope="col" class="be__num">Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of l.articles; track r.a.idArticle) {
                    <tr>
                      <td>{{ r.a.numeroPrix || r.a.ordre }}</td>
                      <td>{{ r.a.designation }}</td>
                      <td>{{ r.a.unite }}</td>
                      <td class="be__num">{{ r.quantite === null ? '—' : quantiteFr(r.quantite) }}</td>
                      <td class="be__num">{{ r.a.prixUnitaireEstime == null ? 'à saisir' : montant(r.a.prixUnitaireEstime) }}</td>
                      <td class="be__num">{{ r.montant === null ? '—' : montant(r.montant) }}</td>
                    </tr>
                  }
                </tbody>
                @if (l.estimation; as e) {
                  <tfoot>
                    <tr><th scope="row" colspan="5">Total estimé HT</th><td class="be__num">{{ e.totalEstime === null ? '—' : montant(e.totalEstime) }}</td></tr>
                    <tr><th scope="row" colspan="5">Montant au plan</th><td class="be__num">{{ montant(e.montantPlan) }}</td></tr>
                    <tr [class.be__ecart]="!!e.ecart"><th scope="row" colspan="5">Écart</th><td class="be__num">{{ e.ecart == null ? '—' : montant(e.ecart) }}</td></tr>
                  </tfoot>
                }
              </table>
            </div>
          </div>
        } @empty {
          <p class="be__aide">La fiche ne porte aucun article.</p>
        }
        <p class="be__aide">Montants en ariary. Le prix estimé n’est jamais publié : il sert à la Commission et à l’évaluation des offres. La validation tracée de la fiche vaut signature.</p>
      }
    </section>
  `,
  styles: `
    .be { display: flex; flex-direction: column; gap: 0.75rem; }
    .be__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .be__titre { margin: 0; font-size: 1.05rem; }
    .be__version { font-size: 0.8rem; color: var(--n-500); }
    .be__lot-titre { margin: 0 0 0.35rem; font-size: 0.9rem; }
    .be__cadre { overflow-x: auto; }
    .be__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .be__table th, .be__table td { border: 1px solid var(--n-300); padding: 0.35rem 0.55rem; text-align: left; vertical-align: top; }
    .be__table thead th { background: var(--n-50); color: var(--n-700); font-weight: 500; }
    .be__table tfoot th { text-align: right; font-weight: 500; }
    .be__num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .be__ecart td { color: var(--danger-text); font-weight: 500; }
    .be__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .be__refus { margin: 0; color: var(--danger-text); }
  `,
})
export class BordereauEstimatifDoc {
  private readonly fiches = inject(FicheMarcheService);

  readonly idDmc = input.required<number>();
  /** La version de la fiche que le dossier a soumise (nulle avant la soumission). */
  readonly versionSoumise = input<number | null | undefined>(null);

  readonly fiche = signal<FicheMarche | null>(null);
  readonly articles = signal<ArticleFiche[]>([]);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);

  readonly travaux = computed(() => this.fiche()?.categorie === 'TRAVAUX');
  readonly lots = computed<LotBordereau[]>(() => {
    const estimations = this.fiche()?.estimations ?? [];
    const parLot = new Map<number | null, ArticleFiche[]>();
    for (const a of this.articles()) {
      const k = a.lot ?? null;
      parLot.set(k, [...(parLot.get(k) ?? []), a]);
    }
    return [...parLot.entries()]
      .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
      .map(([lot, articles]) => ({
        lot,
        estimation: estimations.find((e) => (e.lot ?? null) === lot) ?? null,
        articles: articles.map((a) => {
          const quantite = a.quantiteMax ?? a.quantite ?? null;
          return { a, quantite, montant: quantite !== null && a.prixUnitaireEstime != null ? quantite * a.prixUnitaireEstime : null };
        }),
      }));
  });

  /** Le format des documents officiels : « 48 200,00 ». */
  readonly montant = montantOfficiel;
  /** Une quantité : séparateur de milliers, décimales seulement si elle en a. */
  quantiteFr(q: number): string { return Number.isInteger(q) ? montantOfficiel(q).replace(/,00$/, '') : montantOfficiel(q); }

  constructor() {
    effect((nettoyer) => {
      const id = this.idDmc();
      const v = this.versionSoumise();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = forkJoin({
        fiche: this.fiches.lire(id),
        // Les estimations de la version soumise : celles de la version figée (`versions/{n}` les porte).
        figee: v ? this.fiches.version(id, v) : of(null),
        articles: this.fiches.articles(id, v),
      }).subscribe({
        next: ({ fiche, figee, articles }) => {
          this.fiche.set(figee ? { ...fiche, estimations: figee.estimations } : fiche);
          this.articles.set(articles);
          this.chargement.set(false);
        },
        error: () => { this.chargement.set(false); this.refus.set('Le bordereau n’a pas pu être lu.'); },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }
}
