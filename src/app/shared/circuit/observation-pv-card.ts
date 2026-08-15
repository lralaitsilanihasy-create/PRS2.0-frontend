import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ObservationPv } from '../../models';

/**
 * Décomposition du libellé FIGÉ d'une observation du PV (formats générés au snapshot) :
 * « Ligne « m » — point : au lieu de « x », lire « y » » / « Pièce « p » : obs » / repli brut.
 * Partagée entre la carte et le tableau « Dossiers à rectifier » de la PRMP.
 */
export function decomposerObservation(lib: string): {
  contexte: string;
  auLieuDe: string | null;
  lire: string | null;
  demande: string | null;
} {
  const corr = /^(.*?) : au lieu de « (.*?) », lire « (.*?) »$/s.exec(lib);
  if (corr) {
    return { contexte: corr[1], auLieuDe: corr[2], lire: corr[3], demande: null };
  }
  const deuxPoints = /^(Pièce « .*?»|Ligne « .*?» — .*?|[^:]{1,120}?) : (.+)$/s.exec(lib);
  if (deuxPoints) {
    return { contexte: deuxPoints[1], auLieuDe: null, lire: null, demande: deuxPoints[2] };
  }
  return { contexte: lib, auLieuDe: null, lire: null, demande: null };
}

/**
 * ⚠️ Spec « circuit des observations FAVR » (2026-08-02) — carte de PRÉSENTATION d'une observation du
 * périmètre figé du PV, partagée entre l'écran Vérificateur (qui y projette ses décisions) et le
 * panneau « Rectifier » de la PRMP (lecture seule). Le libellé FIGÉ est décomposé à l'affichage
 * (contexte / correction « Au lieu de → Lire » / demande libre) — la donnée reste la chaîne du PV.
 */
@Component({
  selector: 'app-observation-pv-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="opv" [class.opv--levee]="obs().statut === 'LEVEE'" [class.opv--maintenue]="obs().statut === 'MAINTENUE'">
      <div class="opv__head">
        @if (numero() != null) { <span class="opv__num">{{ numero() }}</span> }
        <span class="opv__src">{{ obs().source === 'PIECE' ? 'Pièce jointe' : 'Grille de contrôle' }}</span>
        <span class="opv__statut" [class.opv__statut--levee]="obs().statut === 'LEVEE'"
          [class.opv__statut--maintenue]="obs().statut === 'MAINTENUE'">
          {{ statutLabel() }}
        </span>
      </div>
      <div class="opv__contexte">{{ contexte() }}</div>
      @if (correction(); as c) {
        <div class="opv__corr">
          <span class="opv__corr-col opv__corr-col--avant">
            <span class="opv__corr-k">Au lieu de</span>
            <span class="opv__corr-v">{{ c.auLieuDe || '—' }}</span>
          </span>
          <span class="opv__corr-fleche">→</span>
          <span class="opv__corr-col opv__corr-col--apres">
            <span class="opv__corr-k">Lire</span>
            <span class="opv__corr-v">{{ c.lire || '—' }}</span>
          </span>
        </div>
      } @else if (demande()) {
        <div class="opv__demande">{{ demande() }}</div>
      }
      @if (obs().statut === 'MAINTENUE' && obs().precision) {
        <div class="opv__precision">Précision du vérificateur : « {{ obs().precision }} »</div>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .opv { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem 0.75rem; border: 1px solid var(--c-100); border-left: 3px solid var(--c-300); border-radius: var(--radius-md); background: var(--surface, #fff); }
    .opv--levee { background: #F0FDF4; border-color: #BBF7D0; border-left-color: #16A34A; }
    .opv--maintenue { border-left-color: var(--warning-text); }
    .opv__head { display: flex; align-items: center; gap: 0.5rem; }
    .opv__num { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-width: 1.4rem; height: 1.4rem; border-radius: 999px; background: var(--c-600); color: #fff; font-size: var(--text-xs); font-weight: 700; }
    .opv__src { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--n-400); font-weight: 700; }
    .opv__statut { margin-left: auto; font-size: var(--text-xs); font-weight: 700; padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--c-50); color: var(--n-500); border: 1px solid var(--c-100); }
    .opv__statut--levee { background: #DCFCE7; color: #15803D; border-color: #BBF7D0; }
    .opv__statut--maintenue { background: var(--warning-bg); color: var(--warning-text); border-color: transparent; }
    .opv__contexte { font-size: var(--text-sm); font-weight: 600; color: var(--n-700); }
    .opv__corr { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.5rem; }
    .opv__corr-col { flex: 1 1 14rem; display: flex; flex-direction: column; gap: 0.1rem; padding: 0.35rem 0.6rem; border-radius: var(--radius-md); }
    .opv__corr-col--avant { background: #FEF2F2; border: 1px solid #FECACA; }
    .opv__corr-col--apres { background: #F0FDF4; border: 1px solid #BBF7D0; }
    .opv__corr-k { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: var(--n-400); }
    .opv__corr-col--avant .opv__corr-v { color: #B91C1C; text-decoration: line-through; }
    .opv__corr-col--apres .opv__corr-v { color: #15803D; font-weight: 600; }
    .opv__corr-v { font-size: var(--text-sm); overflow-wrap: anywhere; }
    .opv__corr-fleche { align-self: center; color: var(--n-400); font-weight: 700; }
    .opv__demande { font-size: var(--text-sm); color: var(--n-700); background: var(--c-50); padding: 0.35rem 0.6rem; border-radius: var(--radius-md); }
    .opv__precision { font-size: var(--text-xs); color: var(--warning-text); background: var(--warning-bg); padding: 0.3rem 0.6rem; border-radius: var(--radius-md); }
  `,
})
export class ObservationPvCard {
  readonly obs = input.required<ObservationPv>();
  /** Numéro d'ordre affiché (1, 2, …) — optionnel. */
  readonly numero = input<number | null>(null);

  readonly statutLabel = computed(() => {
    const o = this.obs();
    if (o.statut === 'LEVEE') return `✓ Levée${o.iteration != null ? ' (itération ' + o.iteration + ')' : ''} — acquise`;
    if (o.statut === 'MAINTENUE') return `Maintenue${o.iteration != null ? ' (itération ' + o.iteration + ')' : ''}`;
    return 'Émise';
  });

  /**
   * Décomposition du libellé FIGÉ (formats générés au snapshot) :
   * « Ligne « m » — point : au lieu de « x », lire « y » » / « Pièce « p » : obs » / repli brut.
   */
  private readonly parties = computed(() => decomposerObservation(this.obs().libelle ?? ''));

  readonly contexte = computed(() => this.parties().contexte);
  readonly demande = computed(() => this.parties().demande);
  readonly correction = computed(() => {
    const p = this.parties();
    return p.auLieuDe !== null ? { auLieuDe: p.auLieuDe, lire: p.lire ?? '' } : null;
  });
}
