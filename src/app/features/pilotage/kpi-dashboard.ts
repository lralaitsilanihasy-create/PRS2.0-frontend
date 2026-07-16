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
      <header class="page-header">
        <div class="page-subtitle">Pilotage</div>
        <h1 class="page-title">Tableau de bord</h1>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (data(); as d) {
        <div class="kpi__cards">
          <article class="kpi-card">
            <span class="kpi-card__ic">📥</span>
            <span class="kpi-card__value">{{ d.nbDossiersSoumis }}</span>
            <span class="kpi-card__label">Dossiers soumis</span>
          </article>
          <article class="kpi-card">
            <span class="kpi-card__ic kpi-card__ic--ok" aria-hidden="true">✓</span>
            <span class="kpi-card__value">{{ d.nbDossiersConformes }}</span>
            <span class="kpi-card__label">Dossiers conformes</span>
          </article>
          <article class="kpi-card kpi-card--accent">
            <span class="kpi-card__value">{{ d.tauxConformitePct }} %</span>
            <span class="kpi-card__label">Taux de conformité</span>
          </article>
        </div>

        <h2 class="kpi__subtitle">Pipeline par statut</h2>
        <div class="kpi__pipeline">
          @for (entry of pipeline(); track entry.statut) {
            <div class="kpi-pill">
              <app-statut-badge [statut]="entry.statut" />
              <span class="kpi-pill__count">{{ entry.count }}</span>
            </div>
          } @empty {
            <p class="text-muted">Aucune donnée de pipeline.</p>
          }
        </div>

        <h2 class="kpi__subtitle">Top 5 — points de contrôle non conformes</h2>
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Point de contrôle</th>
                <th class="r">Non conformes</th>
                <th class="r">Total</th>
                <th class="r">Taux</th>
              </tr>
            </thead>
            <tbody>
              @for (p of d.topNonConformite; track p.idPointCtrl) {
                <tr>
                  <td>{{ p.libelle }}</td>
                  <td class="r">{{ p.nbNonConforme }}</td>
                  <td class="r">{{ p.nbTotal }}</td>
                  <td class="r">{{ p.tauxNonConformitePct }} %</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="text-muted" style="text-align:center; padding:1.5rem;">Aucun point non conforme.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .kpi { display: flex; flex-direction: column; gap: 1rem; }
    .kpi__cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: 1rem;
    }
    /* Cartes de statistiques : relief doux, puce d'icône, valeur large — relief au survol. */
    .kpi-card {
      background: #fff;
      border: 1px solid var(--n-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      transition: var(--transition);
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
    .kpi-card__ic {
      width: 2.5rem; height: 2.5rem; margin-bottom: 0.3rem;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: var(--radius-md);
      background: var(--p-50); color: var(--p-600);
      font-size: 1.2rem; font-weight: 800;
    }
    .kpi-card__ic--ok { background: var(--success-bg); color: var(--success-text); }
    .kpi-card__value { font-size: 1.95rem; font-weight: 800; color: var(--n-800); letter-spacing: -0.02em; line-height: 1.05; }
    .kpi-card__label { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
    /* Carte « accent » (KPI phare) : dégradé de marque. */
    .kpi-card--accent {
      background: var(--grad-primary);
      border-color: transparent;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.28);
      justify-content: center;
    }
    .kpi-card--accent .kpi-card__value { color: #fff; font-size: 2.2rem; }
    .kpi-card--accent .kpi-card__label { color: rgba(255, 255, 255, 0.85); }
    .kpi__subtitle { font-size: var(--text-md); font-weight: 700; color: var(--n-800); margin: 0.9rem 0 0.15rem; }
    .kpi__pipeline { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .kpi-pill {
      display: flex; align-items: center; gap: 0.45rem;
      background: #fff; border: 1px solid var(--n-200);
      border-radius: var(--radius-full);
      padding: 0.35rem 0.75rem;
      box-shadow: var(--shadow-sm);
      transition: var(--transition);
    }
    .kpi-pill:hover { border-color: var(--p-200); box-shadow: var(--shadow-md); }
    .kpi-pill__count { font-weight: 800; color: var(--n-800); }
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
