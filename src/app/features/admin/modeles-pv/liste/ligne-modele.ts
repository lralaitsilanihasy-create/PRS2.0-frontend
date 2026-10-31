import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { libelleAction } from './detail-modele';
import { ICONE_ETAT } from './etats-visuels';
import { LIBELLES_ETAT, LigneModele } from './modeles-pv-vue';

const PUCES_VISIBLES = 3;

/**
 * Une ligne de la liste (ModelRow du cahier), en grille de six colonnes : icône d'état, nom et sous-titre, trois puces et « +N »,
 * badge, bouton d'action, chevron. Toute la ligne déplie son détail : un vrai \`<button>\` (Entrée, Espace, \`aria-expanded\`) dont la
 * zone cliquable s'étend à la ligne ; le bouton d'action passe au-dessus.
 */
@Component({
  selector: 'app-ligne-modele',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @let l = ligne();
    <div class="lgm" [class.lgm--ouverte]="ouverte()">
      <span [class]="'lgm__etat lgm__etat--' + l.etat" aria-hidden="true"><app-icone [nom]="icones[l.etat]" [taille]="16" /></span>
      <div class="lgm__nom">
        <button type="button" class="lgm__deplier" [attr.aria-expanded]="ouverte()" [attr.aria-controls]="'detail-' + l.id" (click)="basculer.emit()">
          {{ l.nom }}<span class="cnm-sr-only"> — {{ libellesEtat[l.etat] }}, afficher le détail</span>
        </button>
        @if (l.remplace.length) {
          <span class="lgm__sous lgm__sous--remplace"><app-icone nom="remplacer" [taille]="13" /> Remplacera le modèle intégré</span>
        } @else {
          <span class="lgm__sous">{{ l.sousTitre }}</span>
        }
      </div>
      <div [class]="'lgm__puces lgm__puces--' + l.etat">
        @if (l.tous) { <span class="lgm__code">tous</span> }
        @for (s of visibles(); track s) { <span class="lgm__code" [title]="l.libellesSousTypes[s] ?? ''">{{ s }}</span> }
        @if (reste() > 0) { <span class="lgm__code lgm__code--plus" [title]="caches()">+{{ reste() }}</span> }
      </div>
      @if (l.badge !== libellesEtat[l.etat]) { <span [class]="'lgm__badge lgm__badge--' + l.etat">{{ l.badge }}</span> } @else { <span></span> }
      <button type="button" [class]="'lgm__action lgm__action--' + l.etat" [attr.aria-label]="libelleAction() + ' : ' + l.nom" (click)="action.emit(l)">
        {{ libelleAction() }}
      </button>
      <span class="lgm__chevron" aria-hidden="true"><app-icone [nom]="ouverte() ? 'chevd' : 'chev'" [taille]="16" /></span>
    </div>
  `,
  styles: `
    .lgm { position: relative; display: grid; grid-template-columns: 32px minmax(0, 2.2fr) minmax(0, 1.6fr) 9.5rem 6.5rem 20px; gap: 14px; align-items: center;
      padding: 12px 16px; cursor: pointer; background: var(--card-bg); }
    .lgm:hover, .lgm--ouverte { background: var(--page-bg); }
    .lgm__etat { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
    .lgm__etat--miss { background: var(--miss-bg); color: var(--miss-accent); }
    .lgm__etat--prep { background: var(--prep-bg); color: var(--prep-accent); }
    .lgm__etat--ok { background: var(--ok-bg); color: var(--ok-accent); }
    .lgm__nom { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .lgm__deplier { all: unset; font-size: 13px; font-weight: 500; color: var(--text); cursor: pointer; overflow-wrap: anywhere; }
    /* La zone cliquable du bouton couvre la ligne ; le bouton d'action, positionné au-dessus, garde la sienne. */
    .lgm__deplier::after { content: ''; position: absolute; inset: 0; }
    .lgm__deplier:focus-visible { outline: none; }
    .lgm:has(.lgm__deplier:focus-visible) { outline: 2px solid var(--primary); outline-offset: -2px; }
    .lgm__sous { font-size: 12px; color: var(--text-muted); }
    .lgm__sous--remplace { color: var(--texte); display: inline-flex; align-items: center; gap: 4px; }
    .lgm__puces { display: flex; flex-wrap: wrap; gap: 4px; }
    .lgm__code { font-family: Consolas, 'Courier New', monospace; font-size: 11px; padding: 2px 6px; border-radius: 6px; border: 1px solid; }
    /* Les codes sont des données, pas un état : neutres. La couleur d'état reste au carré d'icône et au badge. */
    .lgm__code { background: var(--card-bg); color: var(--text); border-color: var(--border); }
    .lgm__code--plus { background: var(--page-bg); color: var(--text-muted); }
    .lgm__badge { justify-self: start; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; white-space: nowrap; border: 1px solid; }
    .lgm__badge--miss { background: var(--miss-bg); color: var(--miss-text); border-color: var(--miss-border); }
    .lgm__badge--prep { background: var(--prep-bg); color: var(--prep-text); border-color: var(--prep-border); }
    .lgm__badge--ok { background: var(--ok-bg); color: var(--ok-text); border-color: var(--ok-border); }
    .lgm__action { position: relative; z-index: 1; height: 30px; padding: 0 12px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 500;
      cursor: pointer; justify-self: end; }
    .lgm__action:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    /* Les actions parlent la couleur d'action de la page (bleu), pas celle de l'état : le rouge n'invite pas à agir. */
    .lgm__action--miss { background: var(--primary); border: 1px solid var(--primary); color: var(--primary-text); }
    .lgm__action--miss:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
    .lgm__action--prep { background: var(--card-bg); border: 1px solid var(--primary); color: var(--texte); }
    .lgm__action--prep:hover { background: var(--reco-bg); }
    .lgm__action--ok { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); }
    .lgm__action--ok:hover { background: var(--page-bg); }
    .lgm__chevron { color: var(--text-muted); display: inline-flex; }
    @media (max-width: 900px) {
      .lgm { grid-template-columns: 32px minmax(0, 1fr) auto; }
      .lgm__puces, .lgm__chevron { display: none; }
      .lgm__badge { grid-column: 2; }
    }
  `,
})
export class LigneModeleComposant {
  readonly ligne = input.required<LigneModele>();
  readonly ouverte = input(false);
  readonly basculer = output<void>();
  readonly action = output<LigneModele>();

  readonly icones = ICONE_ETAT;
  readonly libellesEtat = LIBELLES_ETAT;
  readonly visibles = computed(() => this.ligne().sousTypes.slice(0, PUCES_VISIBLES));
  readonly reste = computed(() => this.ligne().sousTypes.length - PUCES_VISIBLES);
  readonly caches = computed(() => this.ligne().sousTypes.slice(PUCES_VISIBLES).join(' · '));
  readonly libelleAction = computed(() => libelleAction(this.ligne()));
}
