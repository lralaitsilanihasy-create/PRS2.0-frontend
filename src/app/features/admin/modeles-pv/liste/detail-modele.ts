import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { ETAPES_CYCLE, LigneModele } from './modeles-pv-vue';

/**
 * Le panneau de détail d'une ligne (ModelDetail du cahier), en trois colonnes : le cycle de vie (étapes passées cochées, étape en
 * cours dans la couleur de l'état, étapes à venir en gris), tous les sous-types, puis les informations et les actions.
 */
@Component({
  selector: 'app-detail-modele',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @let l = ligne();
    <div class="dtm" [class]="'dtm dtm--' + l.etat" [id]="'detail-' + l.id">
      <section class="dtm__col" [attr.aria-labelledby]="'cycle-' + l.id">
        <h3 class="dtm__titre" [id]="'cycle-' + l.id">Cycle de vie</h3>
        <ol class="dtm__etapes">
          @for (e of etapes(); track e.libelle) {
            <li class="dtm__etape" [class]="'dtm__etape dtm__etape--' + e.statut">
              <span class="dtm__puce" aria-hidden="true">
                @if (e.statut === 'faite') { <app-icone nom="check" [taille]="12" /> }
              </span>
              <span>{{ e.libelle }}@if (e.statut === 'courante') { <span class="dtm__courante"> · étape actuelle</span> }</span>
              <span class="cnm-sr-only">{{ e.statut === 'faite' ? '(terminée)' : e.statut === 'courante' ? '' : '(à venir)' }}</span>
            </li>
          }
        </ol>
      </section>

      <section class="dtm__col" [attr.aria-labelledby]="'st-' + l.id">
        <h3 class="dtm__titre" [id]="'st-' + l.id">Sous-types ({{ l.tous ? 'tous' : l.sousTypes.length }})</h3>
        @if (l.tous) {
          <p class="dtm__texte">Sert tous les sous-types de dossier.</p>
        } @else {
          <p class="dtm__puces">
            @for (s of l.sousTypes; track s) { <span class="dtm__code" [title]="l.libellesSousTypes[s] ?? ''">{{ s }}</span> }
          </p>
        }
        @if (l.remplace.length) {
          <p class="dtm__remplace"><app-icone nom="remplacer" [taille]="14" /> Remplacera le modèle intégré pour {{ l.remplace.join(' · ') }}</p>
        }
      </section>

      <section class="dtm__col" [attr.aria-labelledby]="'inf-' + l.id">
        <h3 class="dtm__titre" [id]="'inf-' + l.id">Informations</h3>
        <dl class="dtm__infos">
          @for (i of l.infos; track i.cle) { <div class="dtm__info"><dt>{{ i.cle }}</dt><dd>{{ i.valeur }}</dd></div> }
        </dl>
        <div class="dtm__actions">
          <button type="button" [class]="'dtm__btn dtm__btn--' + l.etat" (click)="action.emit(l)">{{ libelleAction() }}</button>
          @if (l.etat !== 'miss') {
            <button type="button" class="dtm__btn dtm__btn--neutre" (click)="fichiers.emit(l)">Fichiers</button>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .dtm { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; padding: 16px 20px 18px 64px; background: var(--page-bg);
      border-top: 1px dashed var(--border); }
    .dtm__col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .dtm__titre { margin: 0; font-size: 13px; font-weight: 500; color: var(--text); }
    .dtm__etapes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .dtm__etape { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }
    .dtm__puce { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border-control); display: inline-flex; align-items: center;
      justify-content: center; flex: none; background: var(--card-bg); }
    .dtm__etape--faite { color: var(--ok-text); }
    .dtm__etape--faite .dtm__puce { background: var(--ok-accent); border-color: var(--ok-accent); color: var(--primary-text); }
    .dtm--miss .dtm__etape--courante { color: var(--miss-text); font-weight: 500; }
    .dtm--miss .dtm__etape--courante .dtm__puce { border-color: var(--miss-accent); background: var(--miss-bg); }
    .dtm--prep .dtm__etape--courante { color: var(--prep-text); font-weight: 500; }
    .dtm--prep .dtm__etape--courante .dtm__puce { border-color: var(--prep-accent); background: var(--prep-bg); }
    .dtm__courante { font-weight: 400; }
    .dtm__texte { margin: 0; font-size: 13px; color: var(--text-muted); }
    .dtm__puces { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
    .dtm__code { font-family: Consolas, 'Courier New', monospace; font-size: 11px; padding: 2px 6px; border-radius: 6px; border: 1px solid; }
    .dtm__code { background: var(--card-bg); color: var(--text); border-color: var(--border); }
    .dtm__remplace { margin: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--primary); }
    .dtm__infos { margin: 0; display: flex; flex-direction: column; }
    .dtm__info { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
    .dtm__info dt { color: var(--text-muted); }
    .dtm__info dd { margin: 0; color: var(--text); text-align: right; }
    .dtm__actions { display: flex; gap: 8px; margin-top: 4px; }
    .dtm__btn { height: 32px; padding: 0 14px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent;
      color: var(--primary-text); }
    .dtm__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .dtm__btn--miss, .dtm__btn--prep, .dtm__btn--ok { background: var(--primary); }
    .dtm__btn--miss:hover, .dtm__btn--prep:hover, .dtm__btn--ok:hover { background: var(--primary-hover); }
    .dtm__btn--neutre { background: var(--card-bg); border-color: var(--border); color: var(--text); }
    .dtm__btn--neutre:hover { background: var(--page-bg); }
    @media (max-width: 900px) { .dtm { grid-template-columns: 1fr; padding-left: 20px; } }
  `,
})
export class DetailModele {
  readonly ligne = input.required<LigneModele>();
  readonly action = output<LigneModele>();
  readonly fichiers = output<LigneModele>();

  readonly etapes = computed(() =>
    ETAPES_CYCLE.map((libelle, i) => ({
      libelle,
      statut: i < this.ligne().etape ? 'faite' : i === this.ligne().etape ? 'courante' : 'avenir',
    })),
  );

  readonly libelleAction = computed(() => libelleAction(this.ligne()));
}

/** Le libellé du bouton d'action d'une ligne, selon son état (et le pas qui reste pour un modèle à déposer). */
export function libelleAction(l: LigneModele): string {
  if (l.etat === 'miss') return 'Créer';
  if (l.etat === 'prep') return l.etape >= 2 ? 'Valider' : 'Déposer';
  return 'Voir';
}
