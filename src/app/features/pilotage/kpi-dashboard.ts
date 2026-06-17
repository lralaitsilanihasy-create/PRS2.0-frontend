import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TableauBord } from '../../models';
import { KpiService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Tableau de bord KPIs (PRESIDENT / ADMINISTRATEUR) : pipeline par statut, taux de
 * conformité, et top 5 des points de contrôle non conformes — depuis `GET /api/kpis/tableau-bord`.
 */
@Component({
  selector: 'app-kpi-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="kpi">
      <h1 class="kpi__title">Tableau de bord</h1>

      @if (loading()) {
        <p class="kpi__info">Chargement…</p>
      } @else if (data(); as d) {
        <div class="kpi__cards">
          <div class="kpi-card">
            <span class="kpi-card__value">{{ d.nbDossiersSoumis }}</span>
            <span class="kpi-card__label">Dossiers soumis</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card__value">{{ d.nbDossiersConformes }}</span>
            <span class="kpi-card__label">Dossiers conformes</span>
          </div>
          <div class="kpi-card kpi-card--accent">
            <span class="kpi-card__value">{{ d.tauxConformitePct }} %</span>
            <span class="kpi-card__label">Taux de conformité</span>
          </div>
        </div>

        <h2 class="kpi__subtitle">Pipeline par statut</h2>
        <div class="kpi__pipeline">
          @for (entry of pipeline(); track entry.statut) {
            <div class="kpi-pill">
              <app-statut-badge [statut]="entry.statut" />
              <span class="kpi-pill__count">{{ entry.count }}</span>
            </div>
          } @empty {
            <p class="kpi__info">Aucune donnée de pipeline.</p>
          }
        </div>

        <h2 class="kpi__subtitle">Top 5 — points de contrôle non conformes</h2>
        <table class="kpi__table">
          <thead>
            <tr>
              <th>Point de contrôle</th>
              <th>Non conformes</th>
              <th>Total</th>
              <th>Taux</th>
            </tr>
          </thead>
          <tbody>
            @for (p of d.topNonConformite; track p.idPointCtrl) {
              <tr>
                <td>{{ p.libelle }}</td>
                <td>{{ p.nbNonConforme }}</td>
                <td>{{ p.nbTotal }}</td>
                <td>{{ p.tauxNonConformitePct }} %</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="kpi__info">Aucun point non conforme.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .kpi__title {
      margin: 0 0 1rem;
      font-size: 1.35rem;
      color: var(--cnm-text);
    }
    .kpi__subtitle {
      font-size: 1rem;
      color: var(--cnm-text-2);
      margin: 1.5rem 0 0.5rem;
    }
    .kpi__info {
      color: var(--cnm-text-2);
    }
    .kpi__cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      gap: 0.75rem;
    }
    .kpi-card {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .kpi-card--accent {
      background: var(--cnm-brand);
      border-color: var(--cnm-brand);
      color: #fff;
    }
    .kpi-card__value {
      font-size: 1.75rem;
      font-weight: 700;
    }
    .kpi-card__label {
      font-size: 0.8rem;
      opacity: 0.85;
    }
    .kpi__pipeline {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .kpi-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 1.25rem;
      padding: 0.3rem 0.6rem;
    }
    .kpi-pill__count {
      font-weight: 700;
      color: var(--cnm-text);
    }
    .kpi__table {
      width: 100%;
      border-collapse: collapse;
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    .kpi__table th,
    .kpi__table td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--cnm-border);
    }
    .kpi__table th {
      background: var(--cnm-surface-2);
      font-weight: 600;
    }
  `,
})
export class KpiDashboard {
  private readonly kpiService = inject(KpiService);

  readonly data = signal<TableauBord | null>(null);
  readonly loading = signal(false);

  readonly pipeline = computed(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    return Object.entries(d.pipelineParStatut).map(([statut, count]) => ({ statut, count }));
  });

  constructor() {
    this.loading.set(true);
    this.kpiService.tableauBord().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
