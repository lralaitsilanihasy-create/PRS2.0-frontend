import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
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
 * - piège de focus : Tab et Maj+Tab bouclent à l'intérieur de la modale.
 *
 * ⚠️ Demande pilote (2026-09-13) — les modals ne se ferment PLUS au clic sur le voile (clic hors du
 * dialogue) : la fermeture est réservée au bouton « Fermer » / « Annuler » (ou Échap au clavier).
 * Le flag `appModaleClicExterieur` reste accepté par les templates mais n'a plus aucun effet.
 *
 * L'entrée `appModale` accepte une valeur : `[appModale]="false"` rend la directive inerte, pour un
 * conteneur rendu tantôt en modale, tantôt intégré à la page. Plus aucun écran n'en a besoin depuis
 * le lot L4-F7 (la consultation, son dernier usage, est redevenue une modale et rien qu'une modale) :
 * l'échappatoire reste offerte, testée par la spec, mais toutes les modales posent la directive nue.
 *
 * ⚠️ Recette L4-Q2 (2026-09-16), défauts (e) et (k) — la restitution du focus ne peut pas se contenter
 * du déclencheur : il a souvent disparu quand la modale se ferme (bouton retiré du DOM par le geste
 * qu'il a lancé) ou n'avait jamais le focus à l'ouverture (bouton désactivé pendant la requête : le
 * focus est déjà retombé sur `<body>`). `body.focus()` ne fait rien — plus d'Échap, plus de Tab, plus
 * rien à annoncer. Voir `cibleRetour()` pour l'ordre des replis.
 */
@Directive({ selector: '[appModale]' })
export class ModaleDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Élément focalisé avant l'ouverture — pour restituer le focus à la fermeture. */
  private readonly declencheur =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  /** `[appModale]="false"` neutralise la directive (conteneur affiché hors modale). */
  readonly appModale = input(true, { transform: booleanAttribute });

  /**
   * ⚠️ Demande pilote (2026-09-13) — les modals ne se ferment PLUS au clic sur le voile (clic hors du
   * dialogue) : ce flag est CONSERVÉ pour compat des templates mais N'A PLUS D'EFFET. La fermeture se
   * fait par le bouton « Fermer » / « Annuler » (ou Échap, équivalent clavier — encore actif).
   */
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
    // ⚠️ 2026-09-13 (demande pilote) — plus de fermeture au clic sur le voile : aucun écouteur posé sur
    // le parent. Les modals se ferment par leur bouton (ou Échap). Voir `appModaleClicExterieur` (inerte).
  }

  ngOnDestroy(): void {
    if (this.appModale()) {
      this.cibleRetour()?.focus();
    }
  }

  /**
   * Où revient le focus à la fermeture :
   * 1. **une modale encore ouverte** au-dessus de l'écran (la dernière du document) garde le focus —
   *    une visionneuse refermée sous sa modale lui rend la main, qui reçoit de nouveau Échap ; le
   *    déclencheur ne l'emporte que s'il est DANS cette modale ;
   * 2. sinon le **déclencheur**, s'il est encore dans le document et recevable (ni `<body>`, ni
   *    désactivé) ;
   * 3. sinon le **point de reprise de l'écran**, `[data-focus-repli]` — un seul par écran, posé sur
   *    le titre de l'étape ou, à défaut, sur le titre de la page.
   *
   * Sans aucun des trois : on ne touche à rien (le focus reste là où l'application l'a mis).
   */
  private cibleRetour(): HTMLElement | null {
    const hote = this.el.nativeElement;
    const restantes = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
    ).filter((e) => e !== hote && !hote.contains(e) && e.isConnected);
    const sommet = restantes[restantes.length - 1] ?? null;
    const d = this.declencheur;
    const recevable = !!d && d !== document.body && d.isConnected && !(d as HTMLButtonElement).disabled;
    if (recevable && (!sommet || sommet.contains(d))) return d;
    return sommet ?? document.querySelector<HTMLElement>('[data-focus-repli]');
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
