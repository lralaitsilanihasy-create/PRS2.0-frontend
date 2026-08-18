import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { blocsMd } from './markdown';

/**
 * Rend un markdown d'actualité (`docs/spec-actualites.md`).
 *
 * ⚠️ Aucun `[innerHTML]` : le texte est converti en blocs typés puis rendu par de vraies balises.
 * Une chaîne saisie par un administrateur ne peut donc jamais être interprétée comme du HTML.
 * Les liens sortent en `target="_blank"` avec `rel="noopener noreferrer"` (le parseur a déjà écarté
 * tout protocole autre que http(s) et mailto).
 */
@Component({
  selector: 'app-markdown-vue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    @for (bloc of blocs(); track $index) {
      @switch (bloc.type) {
        @case ('titre') {
          @if (bloc.niveau === 1) {
            <h3 class="md__h1">
              <ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: bloc.contenu }" />
            </h3>
          } @else if (bloc.niveau === 2) {
            <h4 class="md__h2">
              <ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: bloc.contenu }" />
            </h4>
          } @else {
            <h5 class="md__h3">
              <ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: bloc.contenu }" />
            </h5>
          }
        }
        @case ('paragraphe') {
          <p class="md__p">
            <ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: bloc.contenu }" />
          </p>
        }
        @case ('citation') {
          <blockquote class="md__quote">
            <ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: bloc.contenu }" />
          </blockquote>
        }
        @case ('separateur') {
          <hr class="md__hr" />
        }
        @case ('liste') {
          @if (bloc.ordonnee) {
            <ol class="md__list">
              @for (el of bloc.elements; track $index) {
                <li><ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: el }" /></li>
              }
            </ol>
          } @else {
            <ul class="md__list">
              @for (el of bloc.elements; track $index) {
                <li><ng-container [ngTemplateOutlet]="frags" [ngTemplateOutletContext]="{ $implicit: el }" /></li>
              }
            </ul>
          }
        }
      }
    }

    <ng-template #frags let-fragments>
      @for (f of fragments; track $index) {
        @switch (f.type) {
          @case ('gras') { <strong>{{ f.texte }}</strong> }
          @case ('italique') { <em>{{ f.texte }}</em> }
          @case ('code') { <code class="md__code">{{ f.texte }}</code> }
          @case ('lien') { <a [href]="f.href" target="_blank" rel="noopener noreferrer">{{ f.texte }}</a> }
          @default { {{ f.texte }} }
        }
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; color: var(--n-700); }
    .md__h1 { margin: 0 0 0.5rem; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .md__h2 { margin: 1rem 0 0.4rem; font-size: var(--text-base); font-weight: 700; color: var(--c-800); }
    .md__h3 { margin: 0.8rem 0 0.3rem; font-size: var(--text-base); font-weight: 600; color: var(--n-800); }
    .md__p { margin: 0 0 0.7rem; line-height: 1.6; }
    .md__list { margin: 0 0 0.7rem; padding-left: 1.3rem; line-height: 1.6; }
    .md__list li { margin-bottom: 0.25rem; }
    .md__quote { margin: 0 0 0.7rem; padding: 0.5rem 0.9rem; border-left: 3px solid var(--c-200); background: var(--c-50); color: var(--n-600); }
    .md__hr { margin: 1rem 0; border: 0; border-top: 1px solid var(--n-200); }
    .md__code { padding: 0.05rem 0.3rem; background: var(--n-100); border-radius: 4px; font-family: var(--font-mono, monospace); font-size: 0.92em; }
    a { color: var(--c-600); }
  `,
})
export class MarkdownVue {
  readonly markdown = input<string>('');
  readonly blocs = computed(() => blocsMd(this.markdown()));
}
