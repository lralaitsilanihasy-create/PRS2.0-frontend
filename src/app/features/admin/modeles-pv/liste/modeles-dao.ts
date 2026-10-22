import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GroupeDao, LigneDao } from './modeles-pv-vue';

/**
 * ⚠️ 22/10 (D0-D3 « modeles-dao ») — l'onglet « Dossier de mise en concurrence » : les 15 documents du DAO, par catégorie. Chacun est
 * produit par son document type de l'ARMP intégré, tant qu'aucun modèle de l'application n'est en vigueur pour son sigle. « Créer »
 * prépare le modèle et ouvre sa fiche, d'où l'on génère le départ (le document intégré converti, sans écart) ; « Texte intégré » ouvre
 * le rendu brut du document type, jetons visibles.
 */
@Component({
  selector: 'app-modeles-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mdo" aria-labelledby="mdo-titre">
      <h2 id="mdo-titre" class="mdo__titre">Documents du dossier de mise en concurrence <span>· un modèle par document · Word et PDF</span></h2>
      @for (g of groupes(); track g.cle) {
        <h3 class="mdo__groupe">{{ g.titre }}</h3>
        <ul class="mdo__liste">
          @for (l of g.lignes; track l.sigle) {
            <li [class]="'mdo__ligne mdo__ligne--' + l.etat">
              <div class="mdo__nom">
                <strong>{{ l.libelle }}</strong>
                <span>{{ l.sigle }}@if (l.modele; as m) { · {{ m.code }} }</span>
              </div>
              <span [class]="'mdo__badge mdo__badge--' + l.etat">{{ l.badge }}</span>
              <button type="button" class="mdo__btn" [disabled]="!!occupe()" [attr.aria-label]="'Texte intégré — ' + l.sigle" (click)="texte.emit(l.sigle)">
                {{ occupe() === 'texte-' + l.sigle ? 'Ouverture…' : 'Texte intégré' }}
              </button>
              <button type="button" class="mdo__btn" [class.mdo__btn--plein]="l.action === 'Créer'" [disabled]="!!occupe()"
                      [attr.aria-label]="l.action + ' — ' + l.sigle" (click)="agir.emit(l)">
                {{ occupe() === l.sigle ? 'Création…' : l.action }}
              </button>
            </li>
          }
        </ul>
      }
      <p class="mdo__note">
        Le départ d’un modèle reprend le document type intégré, mot pour mot : il est la référence des écarts. Une version qui s’en écarte
        demande, à sa mise en vigueur, la validation du juriste. Les pièces fixes (CCAG, instructions aux candidats) restent hors des modèles.
      </p>
    </section>
  `,
  styles: `
    .mdo { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
    .mdo__titre { margin: 0; font-size: 15px; font-weight: 600; color: var(--text); }
    .mdo__titre span { font-weight: 400; color: var(--text-muted); font-size: 13px; }
    .mdo__groupe { margin: 8px 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); }
    .mdo__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .mdo__ligne { display: grid; grid-template-columns: 1fr auto auto auto; gap: 12px; align-items: center; padding: 8px 12px;
      border-top: 1px solid var(--border); border-left: 3px solid var(--border); }
    .mdo__ligne:first-child { border-top: 0; }
    .mdo__ligne--integre { border-left-color: var(--ok-accent); }
    .mdo__ligne--prep { border-left-color: var(--prep-accent); }
    .mdo__ligne--ok { border-left-color: var(--primary); }
    .mdo__nom { display: flex; flex-direction: column; min-width: 0; }
    .mdo__nom strong { font-weight: 500; color: var(--text); }
    .mdo__nom span { font-size: 12px; color: var(--text-muted); font-family: Consolas, monospace; }
    .mdo__badge { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 10px; border: 1px solid; white-space: nowrap; }
    .mdo__badge--integre { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }
    .mdo__badge--prep { color: var(--prep-text); background: var(--prep-bg); border-color: var(--prep-border); }
    .mdo__badge--ok { color: var(--primary); background: var(--reco-bg); border-color: var(--reco-border); }
    .mdo__btn { border: 1px solid var(--primary); background: var(--card-bg); color: var(--primary); border-radius: 8px; padding: 4px 12px;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 6rem; }
    .mdo__btn--plein { background: var(--primary); color: #fff; }
    .mdo__btn:disabled { opacity: 0.6; cursor: default; }
    .mdo__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mdo__note { margin: 4px 0 0; font-size: 13px; color: var(--text-muted); }
    @media (max-width: 760px) { .mdo__ligne { grid-template-columns: 1fr auto; } .mdo__nom { grid-column: 1 / -1; } }
  `,
})
export class ModelesDao {
  readonly groupes = input.required<GroupeDao[]>();
  /** Ce qui est en cours : le sigle d'une création, ou « texte-<sigle> » pour une ouverture. */
  readonly occupe = input<string | null>(null);
  readonly agir = output<LigneDao>();
  readonly texte = output<string>();
}
