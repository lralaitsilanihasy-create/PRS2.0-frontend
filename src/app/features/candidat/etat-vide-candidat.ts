import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icone, NomIcone } from '../../shared/ui/icone';

/**
 * ⚠️ 18/10 (pilote, refonte de l'espace candidat) — l'écran vide d'une page du candidat, présenté partout de la même façon :
 * une icône, ce qui manque, pourquoi, et le geste qui fait avancer (projeté : `<a etatVideAction …>`). Les pages l'écrivaient
 * de trois manières, la plupart sans geste.
 */
@Component({
  selector: 'app-etat-vide-candidat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <div class="evc" role="status">
      <span class="evc__icone" aria-hidden="true"><app-icone [nom]="icone()" [taille]="26" /></span>
      <p class="evc__titre">{{ titre() }}</p>
      @if (texte()) { <p class="evc__texte">{{ texte() }}</p> }
      <div class="evc__actions"><ng-content select="[etatVideAction]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .evc { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.45rem; padding: 2.2rem 1.25rem; background: #fff;
      border: 1px dashed var(--n-300); border-radius: var(--radius-lg, 12px); }
    .evc__icone { width: 3.4rem; height: 3.4rem; border-radius: 50%; display: grid; place-items: center; background: var(--p-100); color: var(--p-700); margin-bottom: 0.3rem; }
    .evc__titre { margin: 0; font-weight: 700; font-size: 1.02rem; color: var(--n-800); }
    .evc__texte { margin: 0; max-width: 40rem; font-size: var(--text-sm); color: var(--n-500); }
    .evc__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.4rem; }
    .evc__actions:empty { display: none; }
  `,
})
export class EtatVideCandidat {
  readonly icone = input<NomIcone>('inbox');
  readonly titre = input.required<string>();
  readonly texte = input<string | null>(null);
}
