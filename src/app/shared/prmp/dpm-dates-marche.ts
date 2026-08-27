import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Capm, Marche, MarchePrevision } from '../../models';
import { ModaleDirective } from '../a11y/modale.directive';

/**
 * Libellé d'un processus CAPM, ou `#id` à défaut. Une seule définition, partagée par le
 * sous-dialogue de consultation et par les dialogues d'édition restés dans `detail-ppm-modal` —
 * la recopier des deux côtés est précisément ce qui fait diverger une règle.
 */
export function libelleCapm(capms: readonly Capm[], id: number): string {
  return capms.find((c) => c.idCapm === id)?.libelleProcessus ?? '#' + id;
}

/**
 * Sous-dialogue **lecture seule** des dates prévisionnelles d'un marché (bouton « Voir dates »
 * du détail PPM). Le chargement est porté par l'hôte, qui appelle `GET /api/marche-previsions`
 * et passe le résultat ici. Extrait de `detail-ppm-modal` sans changement de comportement.
 */
@Component({
  selector: 'app-dpm-dates-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="dpm__overlay">
      <div class="dpm dpm--sm cnm-card" role="dialog" aria-modal="true" aria-label="Dates du marché" appModale appModaleClicExterieur (appModaleFermer)="fermer.emit()">
        <header class="dpm__head">
          <h2 class="dpm__title">Dates prévisionnelles — {{ marche().designationMarche || 'Marché #' + marche().idDetail }}</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="fermer.emit()">&times;</button>
        </header>
        <div class="dpm__body dpm__body--pad">
          @if (chargement()) {
            <p class="dpm__info" role="status">Chargement des dates…</p>
          } @else if (dates().length) {
            <table class="cnm-table">
              <thead><tr><th scope="col">Processus</th><th scope="col">Période prévisionnelle</th></tr></thead>
              <tbody>
                @for (d of dates(); track d.idPrevision) {
                  <tr><td>{{ capmLabel(d.idCapm) }}</td><td class="cnm-mono">{{ d.dateDebut || '—' }} → {{ d.dateFin || '—' }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="dpm__info">Aucune date prévisionnelle pour ce marché.</p>
          }
        </div>
        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="fermer.emit()">Fermer</button>
        </footer>
      </div>
    </div>
  `,
  styleUrl: './dpm-dates-marche.scss',
})
export class DpmDatesMarche {
  readonly marche = input.required<Marche>();
  /** Référentiel des processus CAPM, pour nommer chaque ligne. */
  readonly capms = input.required<readonly Capm[]>();
  readonly chargement = input(false);
  readonly dates = input.required<readonly MarchePrevision[]>();
  readonly fermer = output<void>();

  capmLabel(id: number): string {
    return libelleCapm(this.capms(), id);
  }
}
