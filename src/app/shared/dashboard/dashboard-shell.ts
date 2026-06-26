import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CircuitTimeline, StatutBadge } from '../circuit';
import { Severity } from '../circuit/circuit-workflow';

/** Élément de la worklist « À faire » du tableau de bord. */
export interface WorklistItem {
  label: string;
  count: number;
  actionLabel: string;
  actionPath: string;
  severity?: Severity;
  hint?: string;
}
/** Tuile d'indicateur clé. */
export interface KpiTile {
  label: string;
  value: string | number;
  accent?: boolean;
}
/** Entrée du pipeline (comptage par statut). */
export interface PipelineEntry {
  statut: string;
  count: number;
}

/**
 * Coquille présentielle UNIFORME du tableau de bord (tous profils) : en-tête + périmètre,
 * worklist « À faire », indicateurs clés, pipeline du périmètre (statuts + timeline du circuit).
 * 100 % design-system (tokens cnm-*, StatutBadge, CircuitTimeline, cnm-card/btn/badge).
 * Les données sont fournies par un composant « intelligent » par profil (aucune logique ici).
 */
@Component({
  selector: 'app-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, CircuitTimeline],
  template: `
    <section class="dash">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ perimetre() }}</div>
          <h1 class="page-title">{{ title() }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <h2 class="dash__section">À faire</h2>
        <div class="dash__worklist">
          @for (w of worklist(); track w.label) {
            <div class="card dash-task">
              <span class="badge {{ 'badge-' + (w.severity ?? 'neutral') }} dash-task__count">{{ w.count }}</span>
              <div class="dash-task__body">
                <span class="dash-task__label">{{ w.label }}</span>
                @if (w.hint) { <span class="dash-task__hint text-muted">{{ w.hint }}</span> }
              </div>
              <a class="btn btn-primary btn-sm" [routerLink]="w.actionPath">{{ w.actionLabel }}</a>
            </div>
          } @empty {
            <p class="text-muted">Rien à traiter pour le moment.</p>
          }
        </div>

        @if (kpis().length) {
          <h2 class="dash__section">Indicateurs</h2>
          <div class="dash__kpis">
            @for (k of kpis(); track k.label) {
              <div class="dash-kpi" [class.dash-kpi--accent]="k.accent">
                <span class="dash-kpi__value">{{ k.value }}</span>
                <span class="dash-kpi__label">{{ k.label }}</span>
              </div>
            }
          </div>
        }

        <h2 class="dash__section">Pipeline du périmètre</h2>
        <div class="dash__pipeline">
          @for (p of pipeline(); track p.statut) {
            <span class="dash-pill"><app-statut-badge [statut]="p.statut" /><span class="dash-pill__count">{{ p.count }}</span></span>
          } @empty {
            <p class="text-muted">Aucun dossier dans le périmètre.</p>
          }
        </div>
        <app-circuit-timeline [active]="-1" />
      }
    </section>
  `,
  styles: `
    .dash__section { margin: 1.5rem 0 0.5rem; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .dash__worklist { display: flex; flex-direction: column; gap: 0.5rem; }
    .dash-task { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.1rem; }
    .dash-task__count { font-weight: 700; }
    .dash-task__body { display: flex; flex-direction: column; flex: 1; }
    .dash-task__label { color: var(--n-800); font-weight: 500; }
    .dash-task__hint { font-size: var(--text-sm); }
    .dash__kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.75rem; }
    .dash-kpi { background: #fff; border: 1px solid var(--c-100); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); padding: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .dash-kpi--accent { background: linear-gradient(135deg, var(--c-600), var(--c-700)); border-color: var(--c-700); color: #fff; }
    .dash-kpi__value { font-size: 1.75rem; font-weight: 800; }
    .dash-kpi__label { font-size: var(--text-sm); opacity: .85; }
    .dash__pipeline { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
    .dash-pill { display: flex; align-items: center; gap: 0.5rem; background: #fff; border: 1px solid var(--c-100); border-radius: var(--radius-full); padding: 0.3rem 0.6rem; }
    .dash-pill__count { font-weight: 800; color: var(--c-800); }
  `,
})
export class DashboardShell {
  readonly title = input.required<string>();
  readonly perimetre = input<string>('');
  readonly loading = input<boolean>(false);
  readonly worklist = input<WorklistItem[]>([]);
  readonly kpis = input<KpiTile[]>([]);
  readonly pipeline = input<PipelineEntry[]>([]);
}
