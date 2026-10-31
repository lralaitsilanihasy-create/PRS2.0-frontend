import { ChangeDetectionStrategy, Component, ElementRef, effect, input, viewChild } from '@angular/core';

/**
 * Deux volets : la LISTE à gauche, le DÉTAIL de l'élément choisi à droite, sans changer de page (pilote, 31/10/2026, direction
 * « Espace de travail », lot 3 — « liste + détail partout où c'est possible »).
 *
 * Le composant ne fait que la disposition ; l'écran garde ses données, sa sélection et ses gestes :
 *
 * ```html
 * <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.id" libelleListe="Contrats" libelleDetail="Détail du contrat"
 *                  invite="Choisissez un contrat : son détail s'affiche ici.">
 *   <ul liste>…une ligne par élément, un bouton qui le choisit…</ul>
 *   <div detail>@if (selection(); as c) { …le détail… }</div>
 * </app-deux-volets>
 * ```
 *
 * Au large, le détail reste collé sous le menu et défile sur place. Sous 1 024 px, il passe sous la liste ; choisir un élément y
 * fait alors défiler la page (et y porte le focus, pour les lecteurs d'écran comme au clavier).
 */
@Component({
  selector: 'app-deux-volets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dv">
      <section class="dv__liste" [attr.aria-label]="libelleListe()">
        <ng-content select="[liste]" />
      </section>
      <section #detail class="dv__detail" [attr.aria-label]="libelleDetail()" tabindex="-1">
        @if (!ouvert()) { <p class="dv__invite">{{ invite() }}</p> }
        <ng-content select="[detail]" />
      </section>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .dv {
      display: grid;
      grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
      align-items: start;
      background: var(--carte-fond);
      border: 1px solid var(--bordure);
      border-radius: 4px;
    }
    .dv__liste { min-width: 0; border-right: 1px solid var(--bordure); }
    .dv__detail {
      position: sticky;
      top: calc(var(--hauteur-menu) + 8px);
      min-width: 0;
      max-height: calc(100vh - var(--hauteur-menu) - 16px);
      overflow-y: auto;
      padding: 12px 16px 16px;
      outline: none;
    }
    .dv__detail:focus-visible { box-shadow: inset 0 0 0 2px var(--bouton-principal); }
    .dv__invite { margin: 24px 0; text-align: center; font-size: 12.5px; color: var(--texte-secondaire); }
    @media (max-width: 64rem) {
      .dv { grid-template-columns: minmax(0, 1fr); }
      .dv__liste { border-right: 0; border-bottom: 1px solid var(--bordure); }
      .dv__detail { position: static; max-height: none; overflow: visible; }
    }
  `,
})
export class DeuxVolets {
  /** Un élément est-il choisi ? Sinon, l'invite s'affiche dans le volet de détail. */
  readonly ouvert = input(false);
  /** Identité de l'élément choisi : quand elle change sur un écran étroit, la page défile jusqu'au détail. */
  readonly cle = input<unknown>(null);
  readonly libelleListe = input('Liste');
  readonly libelleDetail = input('Détail');
  readonly invite = input('Choisissez un élément de la liste : son détail s’affiche ici.');

  private readonly detail = viewChild.required<ElementRef<HTMLElement>>('detail');
  private precedente: unknown = null;

  constructor() {
    effect(() => {
      const cle = this.cle();
      const ouvert = this.ouvert();
      // La sélection posée par l'écran à son ouverture (rien → premier élément) ne fait pas défiler : seul le passage
      // d'un élément à un autre, c'est-à-dire un choix de l'utilisateur, le fait.
      const avant = this.precedente;
      this.precedente = cle;
      if (avant == null || !ouvert || cle == null || cle === avant) return;
      const vue = this.detail().nativeElement.ownerDocument.defaultView;
      if (vue && vue.matchMedia?.('(max-width: 64rem)').matches) {
        const el = this.detail().nativeElement;
        el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        el.focus({ preventScroll: true });
      }
    });
  }
}
