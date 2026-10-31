import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { AIDE_RACCOURCIS } from './raccourcis-clavier';

/** Aide des raccourcis clavier, ouverte par « ? » (pilote, 31/10/2026, Espace de travail, lot 5). */
@Component({
  selector: 'app-aide-clavier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="modal-backdrop">
      <div class="modal ac" role="dialog" aria-modal="true" aria-label="Raccourcis clavier" appModale (appModaleFermer)="ferme.emit()">
        <div class="modal-header">
          <span class="modal-title">Raccourcis clavier</span>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="ferme.emit()">✕</button>
        </div>
        <div class="modal-body">
          <table class="ac__table" data-sans-fiches>
            <tbody>
              @for (r of aide; track r.effet) {
                <tr>
                  <th scope="row">
                    @for (t of r.touches; track t) { <kbd class="ac__touche">{{ t }}</kbd> }
                  </th>
                  <td>{{ r.effet }}</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="ac__note">Les raccourcis sont inactifs pendant une saisie et quand une fenêtre est ouverte.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" (click)="ferme.emit()">Fermer</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .ac { max-width: 30rem; }
    .ac__table { width: 100%; border-collapse: collapse; }
    .ac__table th, .ac__table td { padding: 6px 8px; border-bottom: 1px solid var(--bordure); text-align: left; vertical-align: middle; }
    .ac__table th { width: 7rem; font-weight: 400; white-space: nowrap; }
    .ac__touche {
      display: inline-block;
      min-width: 1.6rem;
      padding: 1px 6px;
      font: inherit;
      font-weight: 500;
      text-align: center;
      background: var(--page-fond);
      border: 1px solid var(--bordure-champ);
      border-radius: 4px;
    }
    .ac__note { margin: 10px 0 0; font-size: var(--text-sm); color: var(--texte-secondaire); }
  `,
})
export class AideClavier {
  readonly ferme = output<void>();
  readonly aide = AIDE_RACCOURCIS;
}
