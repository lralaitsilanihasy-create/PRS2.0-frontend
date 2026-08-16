import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject, output } from '@angular/core';

/** Sélecteur des éléments focalisables au clavier à l'intérieur d'une modale. */
const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), ' +
  'select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Rend une modale utilisable au clavier (AUDIT.md A1) — à poser sur le CONTENEUR
 * du dialogue (l'élément `role="dialog"`), pas sur le backdrop :
 * - focus déplacé dans la modale à l'ouverture, restitué au déclencheur à la fermeture ;
 * - Échap émet `appModaleFermer` (chaque hôte garde son propre mécanisme de fermeture) ;
 * - piège de focus : Tab et Maj+Tab bouclent à l'intérieur de la modale.
 */
@Directive({ selector: '[appModale]' })
export class ModaleDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Élément focalisé avant l'ouverture — pour restituer le focus à la fermeture. */
  private readonly declencheur =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  /** Émis sur Échap : l'hôte ferme la modale. */
  readonly appModaleFermer = output<void>();

  ngAfterViewInit(): void {
    const hote = this.el.nativeElement;
    // tabindex -1 : le conteneur peut recevoir le focus initial (et donc les keydown)
    // même quand la modale n'a aucun champ.
    if (!hote.hasAttribute('tabindex')) {
      hote.setAttribute('tabindex', '-1');
    }
    (hote.querySelector<HTMLElement>('[autofocus]') ?? hote).focus();
  }

  ngOnDestroy(): void {
    this.declencheur?.focus();
  }

  @HostListener('keydown.escape', ['$event'])
  surEchap(ev: Event): void {
    ev.stopPropagation();
    this.appModaleFermer.emit();
  }

  // Deux écouteurs : la syntaxe à touches d'Angular sépare Tab et Maj+Tab.
  @HostListener('keydown.tab', ['$event'])
  @HostListener('keydown.shift.tab', ['$event'])
  surTab(ev: Event): void {
    const majuscule = (ev as KeyboardEvent).shiftKey;
    const focalisables = Array.from(
      this.el.nativeElement.querySelectorAll<HTMLElement>(FOCALISABLES),
    ).filter((e) => e.offsetParent !== null);
    if (!focalisables.length) {
      ev.preventDefault();
      return;
    }
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    const actif = document.activeElement;
    if (majuscule && (actif === premier || actif === this.el.nativeElement)) {
      ev.preventDefault();
      dernier.focus();
    } else if (!majuscule && actif === dernier) {
      ev.preventDefault();
      premier.focus();
    }
  }
}
