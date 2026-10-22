import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { GroupeDao, LigneDao } from './modeles-pv-vue';

/** Les familles de documents, dans l'ordre du dossier : ce qu'on publie, ce qui règle la consultation, l'engagement, le cahier. */
const FAMILLES: readonly { cle: string; titre: string; detail: string; types: readonly string[] }[] = [
  { cle: 'avis', titre: 'Avis et lettres', detail: 'publication, invitation', types: ['AVIS', 'LETTRE'] },
  { cle: 'donnees', titre: 'Données particulières', detail: 'DPAO, DPIC, DPAC', types: ['DPAO', 'DPIC', 'DPAC'] },
  { cle: 'ae', titre: 'Acte d’engagement', detail: 'rempli par le candidat', types: ['AE'] },
  { cle: 'cahier', titre: 'Cahier des charges', detail: 'CCAP, CPS', types: ['CCAP'] },
];

/**
 * ⚠️ 22/10 (D0-D3 « modeles-dao ») — l'onglet « Dossier de mise en concurrence » : les 15 documents du DAO, chacun produit par son
 * document type de l'ARMP intégré tant qu'aucun modèle de l'application n'est en vigueur pour son sigle.
 *
 * ⚠️ 22/10 (présentation, 2e passe, demande du pilote) — un tableau croisé : une ligne par famille de documents (avis et lettres,
 * données particulières, acte d'engagement, cahier des charges), une colonne par catégorie. Les documents de même nature s'alignent ;
 * chaque case est une tuile cliquable (« Ouvrir » ou « Créer »), son état en couleur, le document type intégré à l'œil. Sur un écran
 * étroit, chaque famille devient une pile de tuiles qui rappellent leur catégorie.
 */
@Component({
  selector: 'app-modeles-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="mdo" aria-labelledby="mdo-titre">
      <header class="mdo__tete">
        <div class="mdo__tete-texte">
          <h2 id="mdo-titre" class="mdo__titre">Documents du dossier de mise en concurrence</h2>
          <p class="mdo__sous">Un modèle par document, produit en Word et en PDF. Son départ est le document type de l’ARMP, mot pour mot ;
            une version qui s’en écarte demande la validation du juriste.</p>
        </div>
        <div class="mdo__avancement" role="img" [attr.aria-label]="resume()">
          <div class="mdo__barre">
            @if (nb('ok')) { <span class="mdo__barre-ok" [style.flex-grow]="nb('ok')"></span> }
            @if (nb('prep')) { <span class="mdo__barre-prep" [style.flex-grow]="nb('prep')"></span> }
            @if (nb('integre')) { <span class="mdo__barre-integre" [style.flex-grow]="nb('integre')"></span> }
          </div>
          <ul class="mdo__legende">
            <li><span class="mdo__pastille mdo__pastille--ok"></span><b>{{ nb('ok') }}</b> en vigueur</li>
            <li><span class="mdo__pastille mdo__pastille--prep"></span><b>{{ nb('prep') }}</b> brouillon{{ nb('prep') > 1 ? 's' : '' }} à valider</li>
            <li><span class="mdo__pastille mdo__pastille--integre"></span><b>{{ nb('integre') }}</b> sans modèle</li>
          </ul>
        </div>
      </header>

      <div class="mdo__tableau" role="table" aria-label="Documents du DAO par famille et par catégorie">
        <div class="mdo__ligne mdo__ligne--entete" role="row">
          <div class="mdo__coin" role="columnheader"><span class="cnm-sr-only">Famille</span></div>
          @for (c of colonnes(); track c.cle) {
            <div class="mdo__col" role="columnheader">{{ c.titre }}</div>
          }
        </div>
        @for (f of familles; track f.cle) {
          <div class="mdo__ligne" role="row">
            <div class="mdo__famille" role="rowheader">
              <strong>{{ f.titre }}</strong>
              <span>{{ f.detail }}</span>
            </div>
            @for (c of colonnes(); track c.cle) {
              <div class="mdo__case" role="cell">
                @for (l of cellule(c.cle, f.types); track l.sigle) {
                  <div [class]="'mdo__tuile mdo__tuile--' + l.etat">
                    <button type="button" class="mdo__ouvrir" [disabled]="!!occupe()"
                            [attr.aria-label]="(l.modele ? 'Ouvrir le modèle ' : 'Créer le modèle ') + l.sigle + ' — ' + l.libelle" (click)="agir.emit(l)">
                      <span class="mdo__tuile-haut">
                        <span class="mdo__sigle">{{ l.sigle }}</span>
                        <span [class]="'mdo__etat mdo__etat--' + l.etat">{{ occupe() === l.sigle ? 'Création…' : etatCourt(l) }}</span>
                      </span>
                      <span class="mdo__nom" [title]="l.libelle">{{ nomCourt(l.libelle) }}</span>
                      <span class="mdo__cat">{{ c.titre }}</span>
                      <span class="mdo__action">{{ l.modele ? 'Ouvrir' : 'Créer le modèle' }} <app-icone nom="chev" [taille]="13" /></span>
                    </button>
                    <button type="button" class="mdo__oeil" [disabled]="!!occupe()" [attr.aria-label]="'Document type intégré — ' + l.sigle"
                            title="Voir le document type intégré (PDF, données non remplies)" (click)="texte.emit(l.sigle)">
                      <app-icone nom="eye" [taille]="15" />
                    </button>
                  </div>
                } @empty {
                  <span class="mdo__vide" aria-label="Sans objet">—</span>
                }
              </div>
            }
          </div>
        }
      </div>
      <p class="mdo__note">
        <app-icone nom="eye" [taille]="13" /> ouvre le document type intégré, données non remplies. Les pièces fixes (CCAG, instructions aux
        candidats) restent hors des modèles.
      </p>
    </section>
  `,
  styles: `
    .mdo { display: flex; flex-direction: column; gap: 12px; }
    .mdo__tete { display: flex; gap: 16px 24px; align-items: center; justify-content: space-between; flex-wrap: wrap;
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; }
    .mdo__tete-texte { flex: 1 1 26rem; min-width: 0; }
    .mdo__titre { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); }
    .mdo__sous { margin: 3px 0 0; font-size: 13px; color: var(--text-muted); max-width: 52rem; }
    .mdo__avancement { flex: 0 1 24rem; display: flex; flex-direction: column; gap: 6px; }
    .mdo__barre { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; background: var(--page-bg); }
    .mdo__barre span { flex-basis: 0; }
    .mdo__barre-ok { background: var(--ok-accent); }
    .mdo__barre-prep { background: var(--prep-accent); }
    .mdo__barre-integre { background: var(--n-300, #cbd5e1); }
    .mdo__legende { list-style: none; margin: 0; padding: 0; display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-muted); }
    .mdo__legende li { display: inline-flex; align-items: center; gap: 5px; }
    .mdo__legende b { color: var(--text); }
    .mdo__pastille { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .mdo__pastille--ok { background: var(--ok-accent); }
    .mdo__pastille--prep { background: var(--prep-accent); }
    .mdo__pastille--integre { background: var(--n-300, #cbd5e1); }

    .mdo__tableau { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .mdo__ligne { display: grid; grid-template-columns: 12rem repeat(var(--mdo-cols, 4), minmax(0, 1fr)); border-top: 1px solid var(--border); }
    .mdo__ligne--entete { border-top: 0; background: var(--page-bg); }
    .mdo__col { padding: 9px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted);
      border-left: 1px solid var(--border); }
    .mdo__famille { padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; background: var(--page-bg); }
    .mdo__famille strong { font-size: 14px; font-weight: 600; color: var(--primary); }
    .mdo__famille span { font-size: 12px; color: var(--text-muted); }
    .mdo__case { padding: 8px; border-left: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
    .mdo__vide { margin: auto; color: var(--n-300, #cbd5e1); font-size: 18px; }

    .mdo__tuile { position: relative; height: 100%; }
    .mdo__ouvrir { width: 100%; height: 100%; text-align: left; display: flex; flex-direction: column; gap: 3px; padding: 9px 10px 8px;
      border: 1px solid var(--border); border-left: 4px solid var(--n-300, #cbd5e1); border-radius: 8px; background: var(--card-bg);
      font: inherit; color: var(--text); cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s, background 0.12s; }
    .mdo__tuile--prep .mdo__ouvrir { border-left-color: var(--prep-accent); }
    .mdo__tuile--ok .mdo__ouvrir { border-left-color: var(--ok-accent); }
    .mdo__ouvrir:hover:not(:disabled) { border-color: var(--reco-border); background: var(--reco-bg); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
    .mdo__tuile--prep .mdo__ouvrir:hover:not(:disabled) { border-left-color: var(--prep-accent); }
    .mdo__tuile--ok .mdo__ouvrir:hover:not(:disabled) { border-left-color: var(--ok-accent); }
    .mdo__ouvrir:focus-visible, .mdo__oeil:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mdo__ouvrir:disabled, .mdo__oeil:disabled { opacity: 0.6; cursor: default; }
    .mdo__tuile-haut { display: flex; align-items: center; gap: 6px; padding-right: 26px; flex-wrap: wrap; }
    .mdo__sigle { font-family: Consolas, monospace; font-size: 12px; font-weight: 700; color: var(--primary); }
    .mdo__etat { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 0 7px; border: 1px solid; white-space: nowrap; }
    .mdo__etat--integre { color: var(--text-muted); background: var(--page-bg); border-color: var(--border); }
    .mdo__etat--prep { color: var(--prep-text); background: var(--prep-bg); border-color: var(--prep-border); }
    .mdo__etat--ok { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }
    .mdo__nom { font-size: 13.5px; font-weight: 500; line-height: 1.3; }
    .mdo__cat { display: none; font-size: 11.5px; color: var(--text-muted); }
    .mdo__action { margin-top: auto; padding-top: 4px; font-size: 12.5px; font-weight: 600; color: var(--primary); display: inline-flex; align-items: center; gap: 2px; }
    .mdo__tuile--integre .mdo__action { color: #fff; background: var(--primary); align-self: flex-start; border-radius: 6px; padding: 3px 8px; margin-top: 6px; }
    .mdo__oeil { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 6px; border: 1px solid transparent; background: none;
      color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .mdo__oeil:hover:not(:disabled) { color: var(--primary); border-color: var(--border); background: var(--card-bg); }
    .mdo__note { margin: 0; font-size: 12.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }

    @media (max-width: 900px) {
      .mdo__ligne--entete { display: none; }
      .mdo__ligne { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mdo__famille { grid-column: 1 / -1; flex-direction: row; gap: 8px; align-items: baseline; }
      .mdo__case { border-left: 0; }
      .mdo__case:has(.mdo__vide) { display: none; }
      .mdo__cat { display: block; }
    }
    @media (max-width: 520px) { .mdo__ligne { grid-template-columns: minmax(0, 1fr); } }
  `,
  host: { '[style.--mdo-cols]': 'colonnes().length' },
})
export class ModelesDao {
  readonly groupes = input.required<GroupeDao[]>();
  /** Ce qui est en cours : le sigle d'une création, ou « texte-<sigle> » pour une ouverture. */
  readonly occupe = input<string | null>(null);
  readonly agir = output<LigneDao>();
  readonly texte = output<string>();

  readonly familles = FAMILLES;
  /** Les colonnes : les catégories servies, dans l'ordre des groupes (« Communs » en dernier). */
  readonly colonnes = computed(() =>
    this.groupes().map((g) => ({ cle: g.cle, titre: g.cle === 'PLUSIEURS' ? 'Communs (contrat-cadre, restreint)' : g.titre })),
  );
  private readonly toutes = computed(() => this.groupes().flatMap((g) => g.lignes.map((l) => ({ l, cle: g.cle }))));

  cellule(cle: string, types: readonly string[]): LigneDao[] {
    return this.toutes().filter((x) => x.cle === cle && types.includes(x.l.typeDocument)).map((x) => x.l);
  }

  nb(etat: LigneDao['etat']): number {
    return this.toutes().filter((x) => x.l.etat === etat).length;
  }

  readonly resume = computed(() => `${this.toutes().length} documents : ${this.nb('ok')} en vigueur, ${this.nb('prep')} à valider, ${this.nb('integre')} sans modèle`);

  /** Le nom sans la catégorie entre parenthèses : la colonne la dit déjà. */
  nomCourt(libelle: string): string {
    return libelle.replace(/\s*\([^)]*\)\s*$/, '');
  }

  etatCourt(l: LigneDao): string {
    if (l.etat === 'integre') return 'Document type';
    if (l.etat === 'ok') return l.badge;
    return l.badge === 'À valider' ? 'À valider' : 'À rédiger';
  }
}
