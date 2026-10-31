import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { Recommandation } from './modeles-pv-vue';

/** Bandeau « Action recommandée » (RecommendationBanner du cahier) : le modèle à créer qui couvrirait le plus de sous-types. */
@Component({
  selector: 'app-bandeau-recommandation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="brc" aria-labelledby="brc-titre">
      <span class="brc__icone" aria-hidden="true"><app-icone nom="ampoule" [taille]="20" /></span>
      <div class="brc__texte">
        <h2 id="brc-titre" class="brc__titre">Action recommandée</h2>
        <p class="brc__phrase">{{ reco().texte }}</p>
      </div>
      <button type="button" class="brc__btn" (click)="commencer.emit()">Commencer</button>
    </section>
  `,
  styles: `
    .brc { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 0 12px 12px 0; background: var(--reco-bg);
      border: 1px solid var(--reco-border); border-left: 3px solid var(--reco-accent); color: var(--reco-text); flex-wrap: wrap; }
    .brc__icone { color: var(--texte); display: inline-flex; }
    .brc__texte { flex: 1 1 20rem; min-width: 0; }
    .brc__titre { margin: 0; font-size: 14px; font-weight: 500; color: var(--reco-text); }
    .brc__phrase { margin: 2px 0 0; font-size: 13px; color: var(--reco-text); }
    .brc__btn { height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--reco-accent); background: var(--reco-accent);
      color: var(--primary-text); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .brc__btn:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
    .brc__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  `,
})
export class BandeauRecommandation {
  readonly reco = input.required<Recommandation>();
  readonly commencer = output<void>();
}
