import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  Renderer2,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';

/** Sélecteur des éléments focalisables au clavier à l'intérieur d'une modale. */
const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), ' +
  'select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Rend une modale utilisable au clavier (AUDIT.md A1) — à poser sur le CONTENEUR
 * du dialogue (l'élément `role="dialog"`), pas sur le voile :
 * - focus déplacé dans la modale à l'ouverture, restitué au déclencheur à la fermeture ;
 * - Échap émet `appModaleFermer` (chaque hôte garde son propre mécanisme de fermeture) ;
 * - piège de focus : Tab et Maj+Tab bouclent à l'intérieur de la modale ;
 * - `appModaleClicExterieur` : la fermeture au clic sur le voile, portée ici plutôt que par
 *   un `(click)` sur le voile lui-même (chantier a11y 2026-08-27).
 *
 * **Pourquoi le clic sur le voile vit ici.** Écrit en template, il obligeait à deux
 * gestionnaires sans équivalent clavier : `(click)` sur le voile — un `<div>` non focalisable
 * annoncé comme cliquable — et `(click)="$event.stopPropagation()"` sur le dialogue, uniquement
 * pour neutraliser le premier. Les deux sont désormais inutiles : la directive écoute le voile
 * (le parent de l'hôte) et ne ferme que si le clic n'a pas traversé le dialogue. Le voile
 * redevient un décor, et **Échap est l'équivalent clavier** de ce geste de souris.
 *
 * L'entrée `appModale` accepte une valeur : `[appModale]="false"` rend la directive inerte,
 * pour les conteneurs rendus tantôt en modale, tantôt intégrés à la page (`dossier-consultation`).
 */
@Directive({ selector: '[appModale]' })
export class ModaleDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  /** Élément focalisé avant l'ouverture — pour restituer le focus à la fermeture. */
  private readonly declencheur =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  /** Retire l'écouteur posé sur le voile. */
  private detacherVoile?: () => void;

  /** `[appModale]="false"` neutralise la directive (conteneur affiché hors modale). */
  readonly appModale = input(true, { transform: booleanAttribute });

  /** Ferme aussi la modale au clic sur le voile — l'élément parent du dialogue. */
  readonly appModaleClicExterieur = input(false, { transform: booleanAttribute });

  /** Émis sur Échap et, si demandé, au clic sur le voile : l'hôte ferme la modale. */
  readonly appModaleFermer = output<void>();

  ngAfterViewInit(): void {
    if (!this.appModale()) {
      return;
    }
    const hote = this.el.nativeElement;
    // tabindex -1 : le conteneur peut recevoir le focus initial (et donc les keydown)
    // même quand la modale n'a aucun champ.
    if (!hote.hasAttribute('tabindex')) {
      hote.setAttribute('tabindex', '-1');
    }
    (hote.querySelector<HTMLElement>('[autofocus]') ?? hote).focus();

    const voile = hote.parentElement;
    if (this.appModaleClicExterieur() && voile) {
      this.detacherVoile = this.renderer.listen(voile, 'click', (ev: Event) => {
        // `composedPath()` porte le trajet réel de l'événement : un clic sur un élément que
        // son propre gestionnaire retire du DOM reste rattaché au dialogue, là où un test
        // `contains(ev.target)` conclurait à tort à un clic extérieur.
        if (ev.composedPath().includes(hote)) {
          // Reproduit le `stopPropagation()` que portait le dialogue : un clic dans la
          // modale ne remonte pas au-delà du voile.
          ev.stopPropagation();
          return;
        }
        this.appModaleFermer.emit();
      });
    }
  }

  ngOnDestroy(): void {
    this.detacherVoile?.();
    if (this.appModale()) {
      this.declencheur?.focus();
    }
  }

  @HostListener('keydown.escape', ['$event'])
  surEchap(ev: Event): void {
    if (!this.appModale()) {
      return;
    }
    ev.stopPropagation();
    this.appModaleFermer.emit();
  }

  // Deux écouteurs : la syntaxe à touches d'Angular sépare Tab et Maj+Tab.
  @HostListener('keydown.tab', ['$event'])
  @HostListener('keydown.shift.tab', ['$event'])
  surTab(ev: Event): void {
    if (!this.appModale()) {
      return;
    }
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
