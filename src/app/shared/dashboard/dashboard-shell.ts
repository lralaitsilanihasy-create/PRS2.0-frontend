import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CircuitTimeline, StatutBadge } from '../circuit';
import { Severity } from '../circuit/circuit-workflow';
import { EtatErreur } from '../ui/etat-erreur';

/**
 * Élément de la worklist « À faire » du tableau de bord.
 *
 * `error` : la source qui alimente cet élément a échoué — le composant affiche un état
 * d'erreur réessayable au lieu du compteur. Ne JAMAIS laisser `count` à 0 dans ce cas :
 * un compteur à zéro après un échec réseau se lit comme une vraie donnée (AUDIT.md P9).
 */
export interface WorklistItem {
  label: string;
  count: number;
  actionLabel: string;
  actionPath: string;
  severity?: Severity;
  hint?: string;
  error?: boolean;
}
/**
 * Tuile d'indicateur clé (pill dégradée).
 *
 * `error` : même contrat que `WorklistItem.error` — la tuile bascule sur un état d'erreur
 * réessayable plutôt que d'afficher `value` (qui resterait affiché même à 0 ou périmé).
 */
export interface KpiTile {
  label: string;
  value: string | number;
  /** Icône (emoji) optionnelle affichée dans la pastille. */
  icon?: string;
  /** Couleur de la pill ; à défaut, une couleur est cyclée selon la position. */
  color?: 'blue' | 'indigo' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
  error?: boolean;
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
 *
 * **État d'erreur par source (AUDIT.md P9)** : un tableau de bord agrège plusieurs requêtes
 * indépendantes ; remplacer tout l'écran par un bloc d'erreur dès qu'UNE source échoue
 * détruirait les données des autres, et afficher une tuile à 0 déguiserait l'échec en résultat
 * réel. La coquille pose donc l'état d'erreur AU NIVEAU DE LA TUILE (`WorklistItem.error`,
 * `KpiTile.error`) ou de la section (`pipelineError`), chacune avec son propre « Réessayer » —
 * posé UNE SEULE FOIS ici plutôt que dans chaque tableau de bord consommateur. Un seul événement
 * `reessayer` remonte au composant intelligent, qui ne rejoue que la ou les sources en échec.
 */
@Component({
  selector: 'app-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, CircuitTimeline, EtatErreur],
  template: `
    <section class="dash">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ perimetre() }}</div>
          <h1 class="page-title">{{ title() }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <h2 class="dash__section">À faire</h2>
        <div class="dash__worklist">
          @for (w of worklist(); track w.label) {
            @if (w.error) {
              <div class="card dash-task dash-task--error" role="alert">
                <span class="dash-task__icon" aria-hidden="true">⚠</span>
                <div class="dash-task__body">
                  <span class="dash-task__label">{{ w.label }}</span>
                  <span class="dash-task__hint">Indisponible pour le moment.</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" (click)="reessayer.emit()">Réessayer</button>
              </div>
            } @else {
              <div class="card dash-task">
                <span class="badge {{ 'badge-' + (w.severity ?? 'neutral') }} dash-task__count">{{ w.count }}</span>
                <div class="dash-task__body">
                  <span class="dash-task__label">{{ w.label }}</span>
                  @if (w.hint) { <span class="dash-task__hint text-muted">{{ w.hint }}</span> }
                </div>
                <a class="btn btn-primary btn-sm" [routerLink]="w.actionPath">{{ w.actionLabel }}</a>
              </div>
            }
          } @empty {
            <p class="text-muted">Rien à traiter pour le moment.</p>
          }
        </div>

        @if (kpis().length) {
          <h2 class="dash__section">Indicateurs</h2>
          <div class="dash__kpis">
            @for (k of kpis(); track k.label; let i = $index) {
              @if (k.error) {
                <div class="cnm-stat cnm-stat--error" role="alert">
                  <div class="cnm-stat__icon" aria-hidden="true">⚠</div>
                  <div class="cnm-stat__body">
                    <div class="cnm-stat__value cnm-stat__value--error">Erreur</div>
                    <div class="cnm-stat__label">{{ k.label }}</div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm dash-kpi__retry" (click)="reessayer.emit()">
                    Réessayer
                  </button>
                </div>
              } @else {
                <div class="cnm-stat cnm-stat--{{ k.color ?? couleurAuto(i) }}">
                  @if (k.icon) { <div class="cnm-stat__icon" aria-hidden="true">{{ k.icon }}</div> }
                  <div class="cnm-stat__body">
                    <div class="cnm-stat__value">{{ k.value }}</div>
                    <div class="cnm-stat__label">{{ k.label }}</div>
                  </div>
                </div>
              }
            }
          </div>
        }

        <h2 class="dash__section">Pipeline du périmètre</h2>
        @if (pipelineError()) {
          <app-etat-erreur message="Le pipeline du périmètre n'a pas pu être chargé." (reessayer)="reessayer.emit()" />
        } @else {
          <div class="dash__pipeline">
            @for (p of pipeline(); track p.statut) {
              <span class="dash-pill"><app-statut-badge [statut]="p.statut" /><span class="dash-pill__count">{{ p.count }}</span></span>
            } @empty {
              <p class="text-muted">Aucun dossier dans le périmètre.</p>
            }
          </div>
        }
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
    /* Tuile « À faire » en échec : sa source n'a pas répondu — jamais un compteur à 0. */
    .dash-task--error {
      background: var(--danger-bg, #fef2f2);
      border: 1px solid var(--danger-border, #fecaca);
    }
    .dash-task--error .dash-task__icon { font-size: 1.2rem; color: var(--danger-text, #b91c1c); }
    .dash-task--error .dash-task__hint { color: var(--danger-text, #b91c1c); opacity: 0.85; }
    .dash__kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.75rem; }
    /* Tuile KPI en échec : même raisonnement — la valeur reste indéterminée, pas à zéro. */
    .cnm-stat--error {
      background: var(--danger-bg, #fef2f2);
      border: 1px solid var(--danger-border, #fecaca);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
    }
    .cnm-stat--error .cnm-stat__icon { color: var(--danger-text, #b91c1c); }
    .cnm-stat__value--error { font-size: 1.1rem; font-weight: 700; color: var(--danger-text, #b91c1c); }
    .dash-kpi__retry { align-self: flex-start; }
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
  /** La source du pipeline a échoué — affiche `<app-etat-erreur>` à la place des pastilles. */
  readonly pipelineError = input<boolean>(false);

  /**
   * Émis par le « Réessayer » de n'importe quelle tuile/section en échec. Ne porte pas
   * l'identité de la source : le composant intelligent connaît déjà, via ses propres signaux
   * d'erreur, laquelle (ou lesquelles) rejouer — un seul événement suffit donc ici.
   */
  readonly reessayer = output<void>();

  /** Couleurs cyclées pour les pills KPI sans couleur explicite. */
  private readonly kpiPalette = ['blue', 'indigo', 'green', 'amber', 'purple', 'teal'];
  couleurAuto(i: number): string {
    return this.kpiPalette[i % this.kpiPalette.length];
  }
}
