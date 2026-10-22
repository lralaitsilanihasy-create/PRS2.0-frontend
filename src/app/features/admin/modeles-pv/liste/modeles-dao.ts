import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { GroupeDao, LigneDao } from './modeles-pv-vue';

/**
 * ⚠️ 22/10 (D0-D3 « modeles-dao ») — l'onglet « Dossier de mise en concurrence » : les 15 documents du DAO. Chacun est produit par son
 * document type de l'ARMP intégré tant qu'aucun modèle de l'application n'est en vigueur pour son sigle.
 *
 * ⚠️ 22/10 (présentation, demande du pilote) — un résumé (combien en vigueur, à valider, sans modèle), puis une carte par catégorie ;
 * dans une carte, une ligne compacte par document : son type, son nom (sans la catégorie, déjà dite par la carte), son état, « Texte
 * intégré » en icône et « Ouvrir » (ou « Créer » sans modèle).
 */
@Component({
  selector: 'app-modeles-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="mdo" aria-labelledby="mdo-titre">
      <div class="mdo__tete">
        <div>
          <h2 id="mdo-titre" class="mdo__titre">Documents du dossier de mise en concurrence</h2>
          <p class="mdo__sous">Un modèle par document, produit en Word et en PDF. Son départ est le document type de l’ARMP, mot pour mot.</p>
        </div>
        <dl class="mdo__compteurs">
          @for (c of compteurs(); track c.cle) {
            <div [class]="'mdo__compteur mdo__compteur--' + c.cle"><dt>{{ c.libelle }}</dt><dd>{{ c.n }}</dd></div>
          }
        </dl>
      </div>

      <div class="mdo__grille">
        @for (g of groupes(); track g.cle) {
          <article class="mdo__carte" [attr.aria-labelledby]="'mdo-g-' + g.cle">
            <header class="mdo__carte-tete">
              <h3 [id]="'mdo-g-' + g.cle">{{ g.titre }}</h3>
              <span>{{ g.lignes.length }} document{{ g.lignes.length > 1 ? 's' : '' }}</span>
            </header>
            <ul class="mdo__liste">
              @for (l of g.lignes; track l.sigle) {
                <li class="mdo__ligne">
                  <span [class]="'mdo__type mdo__type--' + l.typeDocument">{{ typeCourt(l) }}</span>
                  <div class="mdo__nom">
                    <strong [title]="l.libelle">{{ nomCourt(l, g.cle) }}</strong>
                    <span>{{ l.sigle }}</span>
                  </div>
                  <span [class]="'mdo__etat mdo__etat--' + l.etat"><span class="mdo__point" aria-hidden="true"></span>{{ etatCourt(l) }}</span>
                  <button type="button" class="mdo__icone" [disabled]="!!occupe()" [attr.aria-label]="'Texte intégré — ' + l.sigle"
                          title="Voir le document type intégré (PDF, données non remplies)" (click)="texte.emit(l.sigle)">
                    <app-icone nom="eye" [taille]="16" />
                  </button>
                  <button type="button" class="mdo__action" [class.mdo__action--creer]="!l.modele" [disabled]="!!occupe()"
                          [attr.aria-label]="(l.modele ? 'Ouvrir le modèle ' : 'Créer le modèle ') + l.sigle" (click)="agir.emit(l)">
                    {{ occupe() === l.sigle ? '…' : l.modele ? 'Ouvrir' : 'Créer' }}
                    <app-icone nom="chev" [taille]="14" />
                  </button>
                </li>
              }
            </ul>
          </article>
        }
      </div>
      <p class="mdo__note">
        Une version qui s’écarte du document type demande, à sa mise en vigueur, la validation du juriste. Les pièces fixes (CCAG, instructions
        aux candidats) restent hors des modèles.
      </p>
    </section>
  `,
  styles: `
    .mdo { display: flex; flex-direction: column; gap: 12px; }
    .mdo__tete { display: flex; gap: 16px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap;
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
    .mdo__titre { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); }
    .mdo__sous { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
    .mdo__compteurs { display: flex; gap: 8px; margin: 0; flex-wrap: wrap; }
    .mdo__compteur { border: 1px solid var(--border); border-left-width: 3px; border-radius: 8px; padding: 6px 12px; min-width: 7.5rem; }
    .mdo__compteur dt { font-size: 12px; color: var(--text-muted); }
    .mdo__compteur dd { margin: 0; font-size: 20px; font-weight: 600; color: var(--text); }
    .mdo__compteur--total { border-left-color: var(--primary); }
    .mdo__compteur--ok { border-left-color: var(--ok-accent); }
    .mdo__compteur--prep { border-left-color: var(--prep-accent); }
    .mdo__compteur--integre { border-left-color: var(--border); }

    .mdo__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(30rem, 1fr)); gap: 12px; }
    .mdo__carte { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .mdo__carte-tete { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 14px;
      background: var(--page-bg); border-bottom: 1px solid var(--border); }
    .mdo__carte-tete h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); }
    .mdo__carte-tete span { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    .mdo__liste { list-style: none; margin: 0; padding: 0; }
    .mdo__ligne { display: grid; grid-template-columns: 3.6rem minmax(0, 1fr) auto auto auto; gap: 10px; align-items: center; padding: 8px 14px;
      border-top: 1px solid var(--border); }
    .mdo__ligne:first-child { border-top: 0; }
    .mdo__ligne:hover { background: var(--page-bg); }

    .mdo__type { font-size: 11px; font-weight: 700; letter-spacing: 0.03em; text-align: center; border-radius: 6px; padding: 3px 0;
      background: var(--reco-bg); color: var(--primary); border: 1px solid var(--reco-border); }
    .mdo__type--AVIS, .mdo__type--LETTRE { background: #f5f3ff; color: #5b21b6; border-color: #ddd6fe; }
    .mdo__type--AE { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
    .mdo__type--CCAP { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }

    .mdo__nom { display: flex; flex-direction: column; min-width: 0; }
    .mdo__nom strong { font-weight: 500; font-size: 14px; line-height: 1.3; color: var(--text); overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .mdo__nom span { font-size: 11.5px; color: var(--text-muted); font-family: Consolas, monospace; }

    .mdo__etat { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-muted); white-space: nowrap; }
    .mdo__point { width: 8px; height: 8px; border-radius: 50%; background: var(--n-300, #cbd5e1); }
    .mdo__etat--ok .mdo__point { background: var(--ok-accent); }
    .mdo__etat--ok { color: var(--ok-text); font-weight: 600; }
    .mdo__etat--prep .mdo__point { background: var(--prep-accent); }
    .mdo__etat--prep { color: var(--prep-text); }

    .mdo__icone { border: 1px solid transparent; background: none; color: var(--text-muted); border-radius: 6px; width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .mdo__icone:hover:not(:disabled) { color: var(--primary); border-color: var(--border); background: var(--card-bg); }
    .mdo__action { border: 1px solid var(--border); background: var(--card-bg); color: var(--primary); border-radius: 8px; padding: 4px 8px 4px 12px;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; min-width: 5.5rem; justify-content: center; }
    .mdo__action:hover:not(:disabled) { border-color: var(--primary); background: var(--reco-bg); }
    .mdo__action--creer { background: var(--primary); border-color: var(--primary); color: #fff; }
    .mdo__icone:focus-visible, .mdo__action:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mdo__icone:disabled, .mdo__action:disabled { opacity: 0.6; cursor: default; }
    .mdo__note { margin: 0; font-size: 13px; color: var(--text-muted); }

    @media (max-width: 640px) {
      .mdo__grille { grid-template-columns: 1fr; }
      .mdo__ligne { grid-template-columns: 3.2rem minmax(0, 1fr) auto auto; }
      .mdo__etat { grid-column: 2 / -1; grid-row: 2; }
    }
  `,
})
export class ModelesDao {
  readonly groupes = input.required<GroupeDao[]>();
  /** Ce qui est en cours : le sigle d'une création, ou « texte-<sigle> » pour une ouverture. */
  readonly occupe = input<string | null>(null);
  readonly agir = output<LigneDao>();
  readonly texte = output<string>();

  readonly compteurs = computed(() => {
    const l = this.groupes().flatMap((g) => g.lignes);
    return [
      { cle: 'total', libelle: 'Documents', n: l.length },
      { cle: 'ok', libelle: 'En vigueur', n: l.filter((x) => x.etat === 'ok').length },
      { cle: 'prep', libelle: 'À valider', n: l.filter((x) => x.etat === 'prep').length },
      { cle: 'integre', libelle: 'Sans modèle', n: l.filter((x) => x.etat === 'integre').length },
    ];
  });

  /** Le type lu sur le sigle (« CPS » pour le CPS des prestations intellectuelles, qui tient le rôle du CCAP). */
  typeCourt(l: LigneDao): string {
    return l.sigle.split('-')[0];
  }

  /** Le nom sans la catégorie entre parenthèses, que le titre de la carte dit déjà (gardée dans la carte des documents communs). */
  nomCourt(l: LigneDao, groupe: string): string {
    return groupe === 'PLUSIEURS' ? l.libelle : l.libelle.replace(/\s*\([^)]*\)\s*$/, '');
  }

  etatCourt(l: LigneDao): string {
    if (l.etat === 'integre') return 'Document type intégré';
    if (l.etat === 'ok') return l.badge;
    return l.badge === 'À valider' ? 'Brouillon à valider' : 'À rédiger';
  }
}
