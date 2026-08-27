import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ModaleDirective } from '../a11y/modale.directive';

/**
 * Sous-dialogue « Réimport impossible » du détail PPM : le PDF importé porte une autre entité
 * contractante que celle du dossier. L'entité d'un dossier ne peut pas changer — rien n'a été
 * modifié, et c'est ce que le message doit rendre évident.
 *
 * `role="alertdialog"` (et non `dialog`) : il annonce un refus, pas une action à mener.
 * Extrait de `detail-ppm-modal` sans changement de comportement.
 */
@Component({
  selector: 'app-dpm-reimport-refuse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="dpm__overlay">
      <div class="dpm dpm--sm cnm-card" role="alertdialog" aria-modal="true" aria-label="Réimport refusé" appModale appModaleClicExterieur (appModaleFermer)="fermer.emit()">
        <header class="dpm__head">
          <h2 class="dpm__title">🚫 Réimport impossible</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="fermer.emit()">&times;</button>
        </header>
        <div class="dpm__body dpm__body--pad">
          <p>
            Ce PDF concerne l'entité contractante <strong>« {{ autorite() }} »</strong>, alors que le dossier
            concerne <strong>« {{ entite() }} »</strong>.
          </p>
          <p class="cnm-muted">
            L'entité d'un dossier ne peut pas changer. <strong>Les données actuelles n'ont pas été modifiées.</strong>
            Importez un PPM de la même entité.
          </p>
        </div>
        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--primary" (click)="fermer.emit()">Compris</button>
        </footer>
      </div>
    </div>
  `,
  styleUrl: './dpm-reimport-refuse.scss',
})
export class DpmReimportRefuse {
  /** Entité contractante lue dans le PDF refusé. */
  readonly autorite = input.required<string>();
  /** Entité contractante du dossier — celle qui fait autorité. */
  readonly entite = input.required<string>();
  readonly fermer = output<void>();
}
