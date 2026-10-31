import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Un chiffre clé : son libellé, sa valeur, et s'il s'agit d'une alerte (valeur en rouge). */
export interface Indicateur {
  libelle: string;
  valeur: string | number;
  alerte?: boolean;
}

/**
 * Ligne de chiffres clés (design institutionnel, 30/10/2026) — 2 à 4 indicateurs, fond blanc, filet --bordure, rayon 8 px,
 * séparateurs verticaux ; libellé 11 px secondaire, valeur 21 px graisse 500 (rouge si c'est une alerte). Sous 768 px, les
 * indicateurs passent deux par ligne.
 */
@Component({
  selector: 'app-carte-indicateurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="ci">
      @for (i of indicateurs(); track i.libelle) {
        <div class="ci__case">
          <dt class="ci__libelle">{{ i.libelle }}</dt>
          <dd class="ci__valeur" [class.ci__valeur--alerte]="i.alerte">{{ i.valeur }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; margin-bottom: 12px; }
    .ci { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: 0; background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 8px; }
    .ci__case { padding: 10px 14px; min-width: 0; }
    .ci__case + .ci__case { border-left: 1px solid var(--bordure); }
    .ci__libelle { font-size: 11px; color: var(--texte-secondaire); }
    .ci__valeur { margin: 2px 0 0; font-size: 21px; font-weight: 500; line-height: 1.2; color: var(--texte); font-variant-numeric: tabular-nums; }
    .ci__valeur--alerte { color: var(--retard-texte); }
    @media (max-width: 48rem) {
      .ci { grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
      .ci__case + .ci__case { border-left: 0; }
      .ci__case:nth-child(even) { border-left: 1px solid var(--bordure); }
      .ci__case:nth-child(n + 3) { border-top: 1px solid var(--bordure); }
    }
  `,
})
export class CarteIndicateurs {
  readonly indicateurs = input.required<readonly Indicateur[]>();
}
