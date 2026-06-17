import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CIRCUIT_ETAPES } from './circuit-workflow';

/**
 * Timeline horizontale du circuit (7 étapes) : ligne + points, nom au-dessus, libellé/date
 * en dessous. Étapes franchies colorées, étape en cours mise en avant, à venir atténuées.
 *
 * - `active` : index (0-based) de l'étape courante ; `-1` = hors flux / légende.
 * - `sublabels` : texte court sous chaque point (statut, ou date d'étape franchie pour un
 *   dossier précis). Index aligné sur `CIRCUIT_ETAPES`.
 *
 * Couleurs issues du design system (tokens) ; défilement horizontal sur petit écran.
 */
@Component({
  selector: 'app-circuit-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="ct">
      @for (etape of etapes; track etape.key; let i = $index) {
        <li
          class="ct__step"
          [class.ct__step--done]="active() >= 0 && i < active()"
          [class.ct__step--current]="i === active()"
        >
          <span class="ct__name">{{ etape.label }}</span>
          <span class="ct__node"><span class="ct__dot"></span></span>
          <span class="ct__sub">{{ sublabels()[i] || '' }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .ct {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      overflow-x: auto;
    }
    .ct__step {
      flex: 1 0 6.5rem;
      min-width: 6.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--cnm-space-1);
      text-align: center;
    }
    .ct__name {
      font-size: var(--cnm-fs-xs);
      color: var(--cnm-text-3);
      line-height: 1.2;
      min-height: 2.4em;
      display: flex;
      align-items: flex-end;
    }
    .ct__node {
      position: relative;
      width: 100%;
      height: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Segment de ligne vers l'étape précédente (centré sur le rang des points). */
    .ct__node::before {
      content: '';
      position: absolute;
      top: 50%;
      right: 50%;
      width: 100%;
      height: 2px;
      background: var(--cnm-border-strong);
      transform: translateY(-50%);
    }
    .ct__step:first-child .ct__node::before {
      display: none;
    }
    .ct__dot {
      position: relative;
      z-index: 1;
      width: 0.85rem;
      height: 0.85rem;
      border-radius: 50%;
      background: var(--cnm-surface-3);
      border: 2px solid var(--cnm-border-strong);
    }
    .ct__sub {
      font-size: var(--cnm-fs-micro);
      color: var(--cnm-text-2);
      font-family: var(--cnm-mono);
      min-height: 1.2em;
    }
    /* Étapes franchies */
    .ct__step--done .ct__name { color: var(--cnm-text-2); }
    .ct__step--done .ct__dot { background: var(--cnm-brand); border-color: var(--cnm-brand); }
    .ct__step--done .ct__node::before { background: var(--cnm-brand); }
    /* Étape en cours */
    .ct__step--current .ct__name { color: var(--cnm-text); font-weight: var(--cnm-fw-semibold); }
    .ct__step--current .ct__dot { background: var(--cnm-brand); border-color: var(--cnm-brand); box-shadow: 0 0 0 4px var(--cnm-action-bg); }
    .ct__step--current .ct__node::before { background: var(--cnm-brand); }
  `,
})
export class CircuitTimeline {
  /** Index (0-based) de l'étape courante ; -1 = hors flux / légende. */
  readonly active = input<number>(0);
  /** Libellé court sous chaque point (statut ou date d'étape franchie). */
  readonly sublabels = input<(string | null | undefined)[]>([]);

  protected readonly etapes = CIRCUIT_ETAPES;
}
