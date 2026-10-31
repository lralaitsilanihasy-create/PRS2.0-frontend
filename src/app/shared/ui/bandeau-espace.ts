import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Une puce du bandeau : un libellé, une valeur mise en avant, et l'accent (fond clair) pour la donnée qui compte. */
export interface PuceBandeau {
  texte: string;
  fort?: string | number | null;
  accent?: boolean;
}

/**
 * ⚠️ 19/10 (pilote) — le **bandeau d'en-tête** des écrans de l'espace de la commission d'appel d'offres : surtitre (référence ou
 * espace), titre, puces (faits et compteurs), et un emplacement pour un badge de rôle (`[bandeau-badge]`). Un dégradé bleu qui
 * reprend la barre du haut de l'espace, pour que chaque écran du membre se reconnaisse d'un coup d'œil.
 */
@Component({
  selector: 'app-bandeau-espace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="be">
      <div class="be__haut">
        @if (surtitre()) { <span class="be__sur" [class.cnm-mono]="mono()">{{ surtitre() }}</span> }
        <ng-content select="[bandeau-badge]" />
      </div>
      <h1 class="be__titre">{{ titre() }}</h1>
      @if (puces().length) {
        <div class="be__puces">
          @for (p of puces(); track $index) {
            <span class="be__puce" [class.be__puce--accent]="p.accent">{{ p.texte }}@if (p.fort != null && p.fort !== '') { <strong>{{ p.fort }}</strong> }</span>
          }
        </div>
      }
    </header>
  `,
  styles: `
    :host { display: block; }
    .be { display: flex; flex-direction: column; gap: 0.45rem; padding: 1.1rem 1.3rem; border-radius: 8px; color: var(--texte-menu);
      background: var(--menu-fond); }
    .be__haut { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; min-height: 1.2rem; }
    .be__sur { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.06em; opacity: 0.9; }
    .be__titre { margin: 0; font-size: 1.55rem; line-height: 1.25; color: var(--texte-menu); }
    .be__puces { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .be__puce { display: inline-flex; gap: 0.35rem; align-items: baseline; padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--carte-fond); font-size: var(--text-sm); }
    .be__puce--accent { background: var(--carte-fond); color: var(--p-800); }
    @media (max-width: 520px) { .be__titre { font-size: 1.25rem; } }
  `,
})
export class BandeauEspace {
  readonly surtitre = input<string | null>(null);
  readonly titre = input.required<string>();
  readonly puces = input<readonly PuceBandeau[]>([]);
  /** La référence d'une procédure se lit en chasse fixe ; un nom d'espace, non. */
  readonly mono = input(false);
}
