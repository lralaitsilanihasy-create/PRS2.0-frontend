import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { LigneMarche } from './modeles-pv-vue';

/**
 * ⚠️ 22/10 (M1 « modeles-documents-marche ») — l'onglet « Dossier de marché » : le projet de marché, un modèle par catégorie, produit en
 * Word et en PDF. Sans modèle en vigueur, la catégorie garde le texte écrit dans l'application ; « Créer » prépare le modèle et ouvre sa
 * fiche, d'où l'on génère le modèle de départ (le texte actuel, recopié mot pour mot).
 *
 * ⚠️ 22/10 (présentation, comme l'onglet du DAO) — une barre d'avancement en tête, puis une tuile cliquable par catégorie : son état en
 * pastille et en liseré de couleur, le modèle qui la sert, et « Ouvrir » ou « Créer le modèle ».
 */
@Component({
  selector: 'app-modeles-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="mmc" aria-labelledby="mmc-titre">
      <header class="mmc__tete">
        <div class="mmc__tete-texte">
          <h2 id="mmc-titre" class="mmc__titre">Projet de marché</h2>
          <p class="mmc__sous">Un modèle par catégorie, produit en Word et en PDF. Les données inconnues restent « …… » dans le Word, pour que la
            PRMP les complète avant la signature.</p>
        </div>
        <div class="mmc__avancement" role="img" [attr.aria-label]="resume()">
          <div class="mmc__barre">
            @if (nb('ok')) { <span class="mmc__barre-ok" [style.flex-grow]="nb('ok')"></span> }
            @if (nb('prep')) { <span class="mmc__barre-prep" [style.flex-grow]="nb('prep')"></span> }
            @if (nb('code')) { <span class="mmc__barre-code" [style.flex-grow]="nb('code')"></span> }
          </div>
          <ul class="mmc__legende">
            <li><span class="mmc__pastille mmc__pastille--ok"></span><b>{{ nb('ok') }}</b> en vigueur</li>
            <li><span class="mmc__pastille mmc__pastille--prep"></span><b>{{ nb('prep') }}</b> à valider</li>
            <li><span class="mmc__pastille mmc__pastille--code"></span><b>{{ nb('code') }}</b> texte de l’application</li>
          </ul>
        </div>
      </header>

      <div class="mmc__grille">
        @for (l of lignes(); track l.categorie) {
          <button type="button" [class]="'mmc__tuile mmc__tuile--' + l.etat" [disabled]="!!occupe()"
                  [attr.aria-label]="(l.modele ? 'Ouvrir le modèle du projet de marché, ' : 'Créer le modèle du projet de marché, ') + l.libelle" (click)="agir.emit(l)">
            <span class="mmc__haut">
              <span class="mmc__cat">{{ l.libelle }}</span>
              <span [class]="'mmc__etat mmc__etat--' + l.etat">{{ occupe() === l.categorie ? 'Création…' : etatCourt(l) }}</span>
            </span>
            @if (l.modele; as m) {
              <span class="mmc__code">{{ m.code }}</span>
              <span class="mmc__desc">{{ m.enVigueur ? 'Produit le projet de marché de la catégorie.' : 'Brouillon : à relire, essayer puis mettre en vigueur.' }}</span>
            } @else {
              <span class="mmc__code">—</span>
              <span class="mmc__desc">Aucun modèle : le projet est produit par le texte écrit dans l’application (art. 60).</span>
            }
            <span class="mmc__action">{{ l.modele ? 'Ouvrir' : 'Créer le modèle' }} <app-icone nom="chev" [taille]="13" /></span>
          </button>
        }
      </div>
      <p class="mmc__note">
        Un modèle mis en vigueur produit le projet de marché de sa catégorie à la création du dossier de marché ; archivé, le texte de
        l’application reprend. Un projet déjà produit ne change pas.
      </p>
    </section>
  `,
  styles: `
    .mmc { display: flex; flex-direction: column; gap: 12px; }
    .mmc__tete { display: flex; gap: 16px 24px; align-items: center; justify-content: space-between; flex-wrap: wrap;
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; }
    .mmc__tete-texte { flex: 1 1 26rem; min-width: 0; }
    .mmc__titre { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); }
    .mmc__sous { margin: 3px 0 0; font-size: 13px; color: var(--text-muted); max-width: 52rem; }
    .mmc__avancement { flex: 0 1 24rem; display: flex; flex-direction: column; gap: 6px; }
    .mmc__barre { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; background: var(--page-bg); }
    .mmc__barre span { flex-basis: 0; }
    .mmc__barre-ok { background: var(--ok-accent); }
    .mmc__barre-prep { background: var(--prep-accent); }
    .mmc__barre-code { background: var(--n-300, #cbd5e1); }
    .mmc__legende { list-style: none; margin: 0; padding: 0; display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-muted); }
    .mmc__legende li { display: inline-flex; align-items: center; gap: 5px; }
    .mmc__legende b { color: var(--text); }
    .mmc__pastille { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .mmc__pastille--ok { background: var(--ok-accent); }
    .mmc__pastille--prep { background: var(--prep-accent); }
    .mmc__pastille--code { background: var(--n-300, #cbd5e1); }

    .mmc__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 12px; }
    .mmc__tuile { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 14px 14px 12px; min-height: 9.5rem;
      border: 1px solid var(--border); border-left: 4px solid var(--n-300, #cbd5e1); border-radius: 10px; background: var(--card-bg);
      font: inherit; color: var(--text); cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s, background 0.12s; }
    .mmc__tuile--prep { border-left-color: var(--prep-accent); }
    .mmc__tuile--ok { border-left-color: var(--ok-accent); }
    .mmc__tuile:hover:not(:disabled) { border-color: var(--reco-border); background: var(--reco-bg); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
    .mmc__tuile--prep:hover:not(:disabled) { border-left-color: var(--prep-accent); }
    .mmc__tuile--ok:hover:not(:disabled) { border-left-color: var(--ok-accent); }
    .mmc__tuile:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mmc__tuile:disabled { opacity: 0.6; cursor: default; }
    .mmc__haut { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .mmc__cat { font-size: 15px; font-weight: 600; color: var(--text); }
    .mmc__etat { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 0 8px; border: 1px solid; white-space: nowrap; }
    .mmc__etat--code { color: var(--text-muted); background: var(--page-bg); border-color: var(--border); }
    .mmc__etat--prep { color: var(--prep-text); background: var(--prep-bg); border-color: var(--prep-border); }
    .mmc__etat--ok { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }
    .mmc__code { font-family: Consolas, monospace; font-size: 12px; font-weight: 700; color: var(--primary); }
    .mmc__desc { font-size: 13px; color: var(--text-muted); line-height: 1.35; }
    .mmc__action { margin-top: auto; padding-top: 6px; font-size: 12.5px; font-weight: 600; color: var(--primary); display: inline-flex; align-items: center; gap: 2px; }
    .mmc__tuile--code .mmc__action { color: #fff; background: var(--primary); align-self: flex-start; border-radius: 6px; padding: 3px 8px; margin-top: 8px; }
    .mmc__note { margin: 0; font-size: 12.5px; color: var(--text-muted); }
  `,
})
export class ModelesMarche {
  readonly lignes = input.required<LigneMarche[]>();
  /** La catégorie en cours de création (tuiles désactivées pendant ce temps). */
  readonly occupe = input<string | null>(null);
  readonly agir = output<LigneMarche>();

  nb(etat: LigneMarche['etat']): number {
    return this.lignes().filter((l) => l.etat === etat).length;
  }

  readonly resume = computed(() => `${this.lignes().length} catégories : ${this.nb('ok')} en vigueur, ${this.nb('prep')} à valider, ${this.nb('code')} produites par le texte de l’application`);

  etatCourt(l: LigneMarche): string {
    if (l.etat === 'code') return 'Texte de l’application';
    return l.badge;
  }
}
