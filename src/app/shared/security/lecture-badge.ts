import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { PermissionsService } from '../../core/auth/permissions.service';
import { Capability } from '../../core/auth/permissions';

/**
 * Badge « Lecture » signalant un contenu consulté en lecture seule (marqueur [Lecture]
 * des règles de gestion).
 *
 * - Sans `for` : toujours affiché (section explicitement en lecture).
 * - Avec `for` : affiché uniquement quand le profil courant NE possède PAS la
 *   capacité — il bascule donc visuellement en lecture seule pour ce profil.
 *
 * Usage : `<app-lecture-badge [for]="'RECEPTION_WRITE'" />`
 */
@Component({
  selector: 'app-lecture-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <span class="cnm-badge cnm-badge--neutral lecture-badge" title="Consultation en lecture seule">
        Lecture
      </span>
    }
  `,
  styles: `
    .lecture-badge {
      text-transform: uppercase;
      letter-spacing: 0.03em;
      vertical-align: middle;
    }
  `,
})
export class LectureBadge {
  private readonly permissions = inject(PermissionsService);

  /** Capacité de référence ; si absente, le badge est toujours visible. */
  readonly for = input<Capability | undefined>(undefined);

  readonly visible = computed(() => {
    const cap = this.for();
    return cap === undefined || !this.permissions.can(cap);
  });
}
