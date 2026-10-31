import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bloc de contenu (design institutionnel, 30/10/2026) : carte blanche, filet --bordure, rayon 8 px, marge intérieure 12 px ;
 * titre 12 px, graisse 500, souligné d'un filet or de 2 px ; contenu projeté. Les actions du bloc (valider, rejeter,
 * retour…) se projettent en bas à droite avec l'attribut `actions`.
 *
 * ```html
 * <app-bloc titre="Informations">
 *   …
 *   <div actions><button class="btn btn-primary">Valider</button></div>
 * </app-bloc>
 * ```
 */
@Component({
  selector: 'app-bloc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bloc" [attr.aria-label]="titre() || null">
      @if (titre()) { <h2 class="bloc__titre">{{ titre() }}</h2> }
      <div class="bloc__corps"><ng-content /></div>
      <div class="bloc__actions"><ng-content select="[actions]" /></div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .bloc { padding: 12px; background: var(--carte-fond); border: 1px solid var(--bordure); border-radius: 8px; }
    .bloc__titre { display: inline-block; margin: 0 0 10px; padding-bottom: 3px; border-bottom: 2px solid var(--or); font-family: var(--font-base); font-size: 12px; font-weight: 500; color: var(--texte); }
    .bloc__actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .bloc__actions:empty { display: none; }
  `,
})
export class Bloc {
  readonly titre = input<string | null>(null);
}
