import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Un chiffre clé : son libellé, sa valeur, et s'il s'agit d'une alerte (valeur en rouge). */
export interface Indicateur {
  libelle: string;
  valeur: string | number;
  alerte?: boolean;
}

/**
 * Ligne de chiffres clés (design institutionnel, 30/10/2026). ⚠️ 31/10 (pilote, Espace de travail) — forme COMPACTE : les
 * indicateurs tiennent sur une ligne, le chiffre (16 px, graisse 500) devant son libellé (12 px, secondaire), séparés par
 * un filet ; ils passent à la ligne quand la place manque. Le balisage (dt libellé, dd valeur) ne change pas : seul
 * l'ordre visuel met le chiffre en tête.
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
    :host { display: block; margin-bottom: 10px; }
    .ci { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 0; margin: 0; padding: 6px 4px; }
    .ci__case { display: flex; align-items: baseline; gap: 6px; min-width: 0; padding: 0 14px; }
    .ci__case:first-child { padding-left: 0; }
    .ci__case + .ci__case { border-left: 1px solid var(--bordure); }
    .ci__libelle { order: 2; font-size: 12px; color: var(--texte-secondaire); }
    .ci__valeur { order: 1; margin: 0; font-size: 16px; font-weight: 500; line-height: 1.2; color: var(--texte); font-variant-numeric: tabular-nums; }
    .ci__valeur--alerte { color: var(--retard-texte); }
  `,
})
export class CarteIndicateurs {
  readonly indicateurs = input.required<readonly Indicateur[]>();
}
