import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Titre de page (design institutionnel, 30/10/2026) : à empattements, 19 px, graisse 500, marge basse 12 px, avec un
 * emplacement à droite pour les boutons d'action de la page (contenu projeté). Un sous-titre facultatif (12 px,
 * secondaire) se pose sous le titre ; une pastille de statut peut s'y projeter avec l'attribut `statut`.
 *
 * ```html
 * <app-titre-page titre="Tous les dossiers" sousTitre="Dossiers de votre périmètre">
 *   <button class="btn btn-primary">Nouveau dossier</button>
 * </app-titre-page>
 * ```
 */
@Component({
  selector: 'app-titre-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tp">
      <div class="tp__textes">
        <h1 class="tp__titre">{{ titre() }} <ng-content select="[statut]" /></h1>
        @if (sousTitre()) { <p class="tp__sous-titre">{{ sousTitre() }}</p> }
      </div>
      <div class="tp__actions"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .tp { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .tp__textes { min-width: 0; }
    .tp__titre { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0; font-family: var(--police-titre); font-size: 19px; font-weight: 500; line-height: 1.25; color: var(--texte); }
    .tp__sous-titre { margin: 2px 0 0; font-size: 12px; color: var(--texte-secondaire); }
    .tp__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tp__actions:empty { display: none; }
  `,
})
export class TitrePage {
  readonly titre = input.required<string>();
  readonly sousTitre = input<string | null>(null);
}
