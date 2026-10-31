import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bandeau de section (design institutionnel, 30/10/2026) : 11 px en capitales, graisse 500, texte or sur --section-fond,
 * rayon 4 px, marge intérieure 5 px 10 px. Il introduit un groupe de contenu (tableau de bord, liste longue).
 * C'est un intitulé : `h2` par défaut, `niveau` le change pour garder la hiérarchie de la page.
 */
@Component({
  selector: 'app-bandeau-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="bs" role="heading" [attr.aria-level]="niveau()">{{ titre() }}</div>`,
  styles: `
    :host { display: block; margin: 12px 0 8px; }
    .bs { padding: 5px 10px; border-radius: 4px; background: var(--section-fond); color: var(--or); font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
  `,
})
export class BandeauSection {
  readonly titre = input.required<string>();
  readonly niveau = input(2);
}
