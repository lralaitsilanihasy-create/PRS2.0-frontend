import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { LigneMarche } from './modeles-pv-vue';

/**
 * ⚠️ 22/10 (M1 « modeles-documents-marche ») — l'onglet « Dossier de marché » : le projet de marché, un modèle par catégorie, produit en
 * Word et en PDF. Sans modèle en vigueur, la catégorie garde le texte écrit dans l'application ; « Créer » prépare le modèle et ouvre sa
 * fiche, d'où l'on génère le modèle de départ (le texte actuel, recopié mot pour mot).
 */
@Component({
  selector: 'app-modeles-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mmc" aria-labelledby="mmc-titre">
      <h2 id="mmc-titre" class="mmc__titre">Projet de marché <span>· un modèle par catégorie · Word et PDF</span></h2>
      <ul class="mmc__liste">
        @for (l of lignes(); track l.categorie) {
          <li [class]="'mmc__ligne mmc__ligne--' + l.etat">
            <div class="mmc__nom">
              <strong>{{ l.libelle }}</strong>
              <span>
                @if (l.modele; as m) { {{ m.code }} · {{ m.libelle }} }
                @else { Aucun modèle : le projet est produit par le texte écrit dans l’application (art. 60). }
              </span>
            </div>
            <span [class]="'mmc__badge mmc__badge--' + l.etat">{{ l.badge }}</span>
            <button type="button" class="mmc__btn" [class.mmc__btn--plein]="l.action === 'Créer'" [disabled]="occupe()"
                    [attr.aria-label]="l.action + ' — projet de marché, ' + l.libelle" (click)="agir.emit(l)">
              {{ occupe() === l.categorie ? 'Création…' : l.action }}
            </button>
          </li>
        }
      </ul>
      <p class="mmc__note">
        Un modèle mis en vigueur produit le projet de marché de sa catégorie à la création du dossier de marché ; archivé, le texte de
        l’application reprend. Un projet déjà produit ne change pas.
      </p>
    </section>
  `,
  styles: `
    .mmc { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .mmc__titre { margin: 0; font-size: 15px; font-weight: 600; color: var(--text); }
    .mmc__titre span { font-weight: 400; color: var(--text-muted); font-size: 13px; }
    .mmc__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .mmc__ligne { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center; padding: 10px 12px;
      border-top: 1px solid var(--border); border-left: 3px solid var(--border); }
    .mmc__ligne:first-child { border-top: 0; }
    .mmc__ligne--code { border-left-color: var(--miss-accent); }
    .mmc__ligne--prep { border-left-color: var(--prep-accent); }
    .mmc__ligne--ok { border-left-color: var(--ok-accent); }
    .mmc__nom { display: flex; flex-direction: column; min-width: 0; }
    .mmc__nom strong { font-weight: 500; color: var(--text); }
    .mmc__nom span { font-size: 13px; color: var(--text-muted); }
    .mmc__badge { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 10px; border: 1px solid; white-space: nowrap; }
    .mmc__badge--code { color: var(--miss-text); background: var(--miss-bg); border-color: var(--miss-border); }
    .mmc__badge--prep { color: var(--prep-text); background: var(--prep-bg); border-color: var(--prep-border); }
    .mmc__badge--ok { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }
    .mmc__btn { border: 1px solid var(--primary); background: var(--card-bg); color: var(--primary); border-radius: 8px; padding: 5px 14px;
      font: inherit; font-weight: 600; cursor: pointer; min-width: 6.5rem; }
    .mmc__btn--plein { background: var(--primary); color: #fff; }
    .mmc__btn:disabled { opacity: 0.6; cursor: default; }
    .mmc__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mmc__note { margin: 0; font-size: 13px; color: var(--text-muted); }
    @media (max-width: 640px) { .mmc__ligne { grid-template-columns: 1fr auto; } .mmc__nom { grid-column: 1 / -1; } }
  `,
})
export class ModelesMarche {
  readonly lignes = input.required<LigneMarche[]>();
  /** La catégorie en cours de création (bouton désactivé partout pendant ce temps). */
  readonly occupe = input<string | null>(null);
  readonly agir = output<LigneMarche>();
}
