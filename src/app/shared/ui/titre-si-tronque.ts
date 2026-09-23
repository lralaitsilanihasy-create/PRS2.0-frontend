import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Pose `title` sur un élément **uniquement quand son texte est réellement coupé** par un `line-clamp`
 * ou un `text-overflow`. Sans elle, un `[attr.title]` inconditionnel fait surgir une infobulle native
 * qui répète un texte déjà lisible en entier : elle recouvre la ligne suivante et n'apprend rien.
 *
 * La mesure est exacte (`scrollHeight`/`scrollWidth` contre la taille visible), refaite à chaque
 * changement de taille de l'élément — une colonne qui s'élargit rend l'infobulle inutile, et elle
 * disparaît d'elle-même.
 *
 * ⚠️ `title` reste une infobulle de confort : elle n'est pas lue par tous les lecteurs d'écran et ne
 * s'ouvre pas au clavier. Le texte coupé doit donc rester accessible ailleurs (ici, la page de la fiche).
 *
 * Usage : `<span class="…" appTitreSiTronque>{{ texte }}</span>`.
 */
@Directive({
  selector: '[appTitreSiTronque]',
  standalone: true,
})
export class TitreSiTronqueDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observateur?: ResizeObserver;

  ngAfterViewInit(): void {
    this.evaluer();
    // Le contenu peut arriver après l'init de la vue (liaison, police chargée) : on remesure au tick suivant.
    queueMicrotask(() => this.evaluer());
    if (typeof ResizeObserver !== 'undefined') {
      this.observateur = new ResizeObserver(() => this.evaluer());
      this.observateur.observe(this.el);
    }
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
  }

  private evaluer(): void {
    // Un pixel de marge : les hauteurs sous-pixel d'une police mise à l'échelle donneraient un faux positif.
    const coupe = this.el.scrollHeight > this.el.clientHeight + 1 || this.el.scrollWidth > this.el.clientWidth + 1;
    if (coupe) this.el.setAttribute('title', (this.el.textContent || '').trim());
    else this.el.removeAttribute('title');
  }
}
