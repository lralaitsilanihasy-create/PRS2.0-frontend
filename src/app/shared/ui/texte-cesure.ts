import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';

import { decouperTexte } from './cesure';

/**
 * Écrit un texte de document officiel mot par mot, césures syllabiques comprises (`cesure.ts`).
 *
 * Chaque mot est un `<span class="doc-mot">` en `inline-block` borné à la largeur de la cellule
 * (`styles/_document-officiel.scss`) : un mot qui tient sur une ligne passe ENTIER à la ligne
 * suivante ; seul un mot plus large que sa colonne se coupe, à une syllabe, avec un trait d'union.
 * Sans cette boîte, le navigateur remplit chaque ligne au plus près et coupe aussi les mots qui
 * auraient tenu seuls (« de prix ou-verte », mesuré dans Chrome).
 *
 * L'élément hôte ne doit porter AUCUN autre contenu : la directive le réécrit à chaque changement.
 * Les nœuds sont créés par `Renderer2` (texte seul, jamais de HTML interprété).
 */
@Directive({ selector: '[appTexteCesure]' })
export class TexteCesure {
  readonly appTexteCesure = input<string | null | undefined>('');

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rendu = inject(Renderer2);

  constructor() {
    effect(() => this.ecrire(decouperTexte(this.appTexteCesure())));
  }

  private ecrire(lignes: readonly (readonly string[])[]): void {
    const el = this.hote.nativeElement;
    while (el.firstChild) this.rendu.removeChild(el, el.firstChild);
    lignes.forEach((mots, i) => {
      if (i > 0) this.rendu.appendChild(el, this.rendu.createElement('br'));
      mots.forEach((mot, j) => {
        if (j > 0) this.rendu.appendChild(el, this.rendu.createText(' '));
        const boite = this.rendu.createElement('span');
        this.rendu.addClass(boite, 'doc-mot');
        this.rendu.appendChild(boite, this.rendu.createText(mot));
        this.rendu.appendChild(el, boite);
      });
    });
  }
}
