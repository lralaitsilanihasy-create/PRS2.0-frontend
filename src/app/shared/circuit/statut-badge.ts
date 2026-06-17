import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { statutDossierLabel, statutSeverity } from './circuit-workflow';

/**
 * Badge coloré pour un statut (dossier, PV, demande de retrait, avis…).
 * La couleur est dérivée de `statutSeverity`. Un libellé peut surcharger le code brut.
 *
 * Usage : `<app-statut-badge [statut]="dossier.statut" />`
 */
@Component({
  selector: 'app-statut-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (statut()) {
      <span class="cnm-badge cnm-badge--{{ severity() }}">{{ label() || autoLabel() }}</span>
    }
  `,
})
export class StatutBadge {
  /** Code de statut brut (string). */
  readonly statut = input<string | null | undefined>();
  /** Libellé d'affichage facultatif (sinon libellé dérivé du code, ou code brut). */
  readonly label = input<string | null | undefined>();

  readonly severity = computed(() => statutSeverity(this.statut() ?? ''));
  /** Libellé humanisé des statuts de dossier (code brut pour les autres : PV, avis, retrait…). */
  readonly autoLabel = computed(() => statutDossierLabel(this.statut() ?? ''));
}
