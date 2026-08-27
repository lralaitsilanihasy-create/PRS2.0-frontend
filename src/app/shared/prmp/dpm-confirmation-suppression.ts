import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ModaleDirective } from '../a11y/modale.directive';

/**
 * Ce que l'on s'apprête à supprimer depuis le détail PPM : le plan lui-même, ou l'un de ses marchés.
 * `count` arrive après coup (comptage asynchrone des dates prévisionnelles) — `null` tant qu'il
 * n'est pas connu, ce que le message rend par « … ».
 */
export interface CibleSuppression {
  kind: 'marche' | 'ppm';
  id: number;
  label: string;
  count: number | null;
}

/**
 * Sous-dialogue de confirmation de suppression du détail PPM (marché ou PPM entier).
 *
 * Purement présentationnel : il énonce ce qui va disparaître et rend la main. La suppression
 * elle-même — appel de service, toasts, rafraîchissement — reste chez l'hôte, qui écoute
 * `(confirmer)`. Extrait de `detail-ppm-modal` sans changement de comportement.
 */
@Component({
  selector: 'app-dpm-confirmation-suppression',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="dpm__overlay">
      <div class="dpm dpm--sm cnm-card" role="dialog" aria-modal="true" aria-label="Confirmation de suppression" appModale appModaleClicExterieur (appModaleFermer)="annuler.emit()">
        <header class="dpm__head">
          <h2 class="dpm__title">{{ cible().kind === 'ppm' ? 'Supprimer le PPM' : 'Supprimer le marché' }}</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="annuler.emit()">&times;</button>
        </header>
        <div class="dpm__body dpm__body--pad">
          <p>{{ message() }}</p>
          <p class="cnm-muted">Action irréversible.</p>
        </div>
        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler.emit()">Annuler</button>
          <button type="button" class="cnm-btn cnm-btn--danger" [disabled]="busy()" (click)="confirmer.emit()">
            {{ busy() ? 'Suppression…' : 'Supprimer définitivement' }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styleUrl: './dpm-confirmation-suppression.scss',
})
export class DpmConfirmationSuppression {
  readonly cible = input.required<CibleSuppression>();
  /** Suppression en cours côté hôte : neutralise le bouton de confirmation. */
  readonly busy = input(false);
  /** Fermeture demandée (× / voile / Échap / Annuler). */
  readonly annuler = output<void>();
  /** L'utilisateur confirme : l'hôte procède réellement à la suppression. */
  readonly confirmer = output<void>();

  readonly message = computed(() => {
    const c = this.cible();
    if (c.kind === 'ppm') {
      return `Supprimer le PPM « ${c.label} » ? Cela supprimera aussi ses ${c.count ?? 0} marché(s) et toutes leurs dates prévisionnelles.`;
    }
    const n = c.count == null ? '…' : c.count;
    return `Supprimer le marché « ${c.label} » et ses ${n} date(s) prévisionnelle(s) ?`;
  });
}
