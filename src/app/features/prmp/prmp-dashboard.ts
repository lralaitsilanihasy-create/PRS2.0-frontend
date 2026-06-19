import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Dossier } from '../../models';
import { DossierService, NotificationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';

/**
 * Tableau de bord PRMP : section « en attente de décision » (dossiers EN_ATTENTE_DECISION_PRMP
 * avec le texte complet de l'observation du vérificateur, lue dans la notification
 * OBSERVATION_VERIFICATION — aucun champ observation dans DossierDto), puis le pipeline
 * habituel de ses dossiers. Le backend reste l'autorité ; ici lecture seule.
 */
@Component({
  selector: 'app-prmp-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossiersPipeline],
  template: `
    @if (enAttente().length) {
      <div class="cnm-card pd__alert">
        <h2 class="pd__alert-title">Dossiers en attente de votre décision</h2>
        <p class="cnm-muted pd__alert-note">
          Le vérificateur a relevé des observations non levées. Prenez-en connaissance, corrigez le dossier,
          puis décidez de la suite.
        </p>
        <ul class="pd__list">
          @for (d of enAttente(); track d.idDossier) {
            <li class="pd__item">
              <div class="pd__item-head">
                <span class="pd__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</span>
                <app-statut-badge [statut]="d.statut" />
              </div>
              <p class="pd__obs"><strong>Observation du vérificateur :</strong> {{ observationPour(d.idDossier) || '—' }}</p>
            </li>
          }
        </ul>
      </div>
    }

    <app-dossiers-pipeline />
  `,
  styles: `
    .pd__alert { padding: var(--cnm-space-4) var(--cnm-space-5); margin-bottom: var(--cnm-space-4); border-left: 4px solid var(--cnm-warning-fg); }
    .pd__alert-title { margin: 0; font-size: var(--cnm-fs-md); }
    .pd__alert-note { margin: var(--cnm-space-1) 0 var(--cnm-space-3); }
    .pd__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .pd__item { padding: var(--cnm-space-3); background: var(--cnm-surface-2); border-radius: var(--cnm-radius-sm); }
    .pd__item-head { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .pd__ref { font-weight: var(--cnm-fw-semibold); }
    .pd__obs { margin: var(--cnm-space-1) 0 0; font-size: var(--cnm-fs-sm); }
  `,
})
export class PrmpDashboard {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);

  readonly enAttente = signal<Dossier[]>([]);
  private readonly observations = signal<Map<number, string>>(new Map());

  constructor() {
    forkJoin({
      dossiers: this.dossierService.list('EN_ATTENTE_DECISION_PRMP'),
      notifs: this.notificationService.mes(),
    }).subscribe({
      next: ({ dossiers, notifs }) => {
        this.enAttente.set(dossiers);
        const m = new Map<number, string>();
        notifs
          .filter((n) => n.typeNotif === 'OBSERVATION_VERIFICATION' && n.idDossier != null && n.corps)
          .sort((a, b) => (a.dateEnvoi ?? '').localeCompare(b.dateEnvoi ?? '')) // la plus récente écrase
          .forEach((n) => m.set(n.idDossier as number, n.corps as string));
        this.observations.set(m);
      },
      error: () => {},
    });
  }

  observationPour(idDossier: number): string | undefined {
    return this.observations().get(idDossier);
  }
}
