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
      <header class="dash__header">
        <span class="cnm-section-label">{{ perimetre() }}</span>
        <h1 class="dash__title">{{ title() }}</h1>
      </header>

      @if (loading()) {
        <p class="dash__info">Chargement…</p>
      } @else {
        <h2 class="dash__section">À faire</h2>
        <div class="dash__worklist">
          @for (w of worklist(); track w.label) {
            <div class="cnm-card dash-task">
              <span class="cnm-badge {{ 'cnm-badge--' + (w.severity ?? 'neutral') }} dash-task__count">{{ w.count }}</span>
              <div class="dash-task__body">
                <span class="dash-task__label">{{ w.label }}</span>
                @if (w.hint) { <span class="dash-task__hint cnm-muted">{{ w.hint }}</span> }
              </div>
              <a class="cnm-btn cnm-btn--primary cnm-btn--sm" [routerLink]="w.actionPath">{{ w.actionLabel }}</a>
            </div>
          } @empty {
            <p class="dash__info">Rien à traiter pour le moment.</p>
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
            <p class="dash__info">Aucun dossier dans le périmètre.</p>
          }
        </div>
        <app-circuit-timeline [active]="-1" />
      }
    </section>
  `,
  styles: `
    .dash__header { margin-bottom: var(--cnm-space-4); }
    .dash__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .dash__section { margin: var(--cnm-space-4) 0 var(--cnm-space-2); font-size: var(--cnm-fs-md); color: var(--cnm-text-2); }
    .dash__info { color: var(--cnm-text-2); }
    .dash__worklist { display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .dash-task { display: flex; align-items: center; gap: var(--cnm-space-3); padding: var(--cnm-space-3) var(--cnm-space-4); }
    .dash-task__count { font-weight: var(--cnm-fw-semibold); }
    .dash-task__body { display: flex; flex-direction: column; flex: 1; }
    .dash-task__label { color: var(--cnm-text); font-weight: var(--cnm-fw-medium); }
    .dash-task__hint { font-size: var(--cnm-fs-sm); }
    .dash__kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: var(--cnm-space-3); }
    .dash-kpi { background: var(--cnm-surface); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius); padding: var(--cnm-space-4); display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .dash-kpi--accent { background: var(--cnm-brand); border-color: var(--cnm-brand); color: #fff; }
    .dash-kpi__value { font-size: 1.75rem; font-weight: var(--cnm-fw-bold); }
    .dash-kpi__label { font-size: var(--cnm-fs-sm); opacity: .85; }
    .dash__pipeline { display: flex; flex-wrap: wrap; gap: var(--cnm-space-2); margin-bottom: var(--cnm-space-3); }
    .dash-pill { display: flex; align-items: center; gap: var(--cnm-space-2); background: var(--cnm-surface); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius-pill); padding: 0.3rem 0.6rem; }
    .dash-pill__count { font-weight: var(--cnm-fw-bold); color: var(--cnm-text); }
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
