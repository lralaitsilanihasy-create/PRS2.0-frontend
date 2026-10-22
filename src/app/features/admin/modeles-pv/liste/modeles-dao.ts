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
 * ⚠️ 22/10 (présentation, 3e passe, demande du pilote) — un tableau croisé familles × catégories, en tuiles compactes : le sigle, le nom
 * seulement quand il dit plus que la ligne, l'état en point de couleur, et le nombre d'écarts au document type (ce que le juriste aura
 * à valider). Fond neutre ; le vert est réservé à ce qui est en vigueur. La tuile entière ouvre le modèle ; l'œil, au survol, ouvre le
 * document type intégré.
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
          <p class="mdo__sous">Le départ de chaque modèle est le document type de l’ARMP ; ses écarts sont validés par le juriste à la mise en vigueur.</p>
        </div>
        <dl class="mdo__chiffres">
          <div><dt>En vigueur</dt><dd class="mdo__chiffre--ok">{{ nb('ok') }}<small> / {{ total() }}</small></dd></div>
          <div><dt>À valider</dt><dd>{{ nb('prep') }}</dd></div>
          <div><dt>Écarts à valider</dt><dd>{{ totalEcarts() }}</dd></div>
        </dl>
      </header>

      <div class="mdo__tableau" role="table" aria-label="Documents du DAO par famille et par catégorie">
        <div class="mdo__ligne mdo__ligne--entete" role="row">
          <div role="columnheader"><span class="cnm-sr-only">Famille</span></div>
          @for (c of colonnes(); track c.cle) { <div class="mdo__col" role="columnheader">{{ c.titre }}</div> }
        </div>
        @for (f of familles; track f.cle) {
          <div class="mdo__ligne" role="row">
            <div class="mdo__famille" role="rowheader"><strong>{{ f.titre }}</strong><span>{{ f.detail }}</span></div>
            @for (c of colonnes(); track c.cle) {
              <div class="mdo__case" role="cell">
                @for (l of cellule(c.cle, f.types); track l.sigle) {
                  <div [class]="'mdo__tuile mdo__tuile--' + l.etat">
                    <button type="button" class="mdo__ouvrir" [disabled]="!!occupe()"
                            [attr.aria-label]="(l.modele ? 'Ouvrir le modèle ' : 'Créer le modèle ') + l.sigle + ' — ' + l.libelle + ' — ' + etatCourt(l)" (click)="agir.emit(l)">
                      <span class="mdo__sigle">{{ l.sigle }}</span>
                      @if (nomUtile(l.libelle, f.titre); as nom) { <span class="mdo__nom" [title]="l.libelle">{{ nom }}</span> }
                      <span class="mdo__bas">
                        <span [class]="'mdo__etat mdo__etat--' + l.etat"><span class="mdo__point" aria-hidden="true"></span>{{ occupe() === l.sigle ? 'Création…' : etatCourt(l) }}</span>
                        @if (ecarts()[l.sigle]; as n) { <span class="mdo__ecarts">{{ n }} écart{{ n > 1 ? 's' : '' }}</span> }
                        @else if (l.modele && ecarts()[l.sigle] === 0) { <span class="mdo__conforme">conforme</span> }
                      </span>
                      <app-icone class="mdo__chev" nom="chev" [taille]="16" />
                    </button>
                    <button type="button" class="mdo__oeil" [disabled]="!!occupe()" [attr.aria-label]="'Document type intégré — ' + l.sigle"
                            title="Document type intégré (PDF, données non remplies)" (click)="texte.emit(l.sigle)">
                      <app-icone nom="eye" [taille]="14" />
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
      <p class="mdo__note">Survolez une tuile pour voir son document type intégré (<app-icone nom="eye" [taille]="12" />). Les pièces fixes (CCAG,
        instructions aux candidats) restent hors des modèles.</p>
    </section>
  `,
  styles: `
    .mdo { display: flex; flex-direction: column; gap: 12px; }
    .mdo__tete { display: flex; gap: 12px 24px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 2px 2px 0; }
    .mdo__tete-texte { flex: 1 1 24rem; min-width: 0; }
    .mdo__titre { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); }
    .mdo__sous { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
    .mdo__chiffres { display: flex; gap: 8px; margin: 0; }
    .mdo__chiffres div { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 6px 14px; min-width: 6.5rem; }
    .mdo__chiffres dt { font-size: 11.5px; color: var(--text-muted); }
    .mdo__chiffres dd { margin: 0; font-size: 20px; font-weight: 600; color: var(--text); line-height: 1.2; }
    .mdo__chiffres dd small { font-size: 13px; font-weight: 400; color: var(--text-muted); }
    .mdo__chiffre--ok { color: var(--ok-text) !important; }

    .mdo__tableau { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .mdo__ligne { display: grid; grid-template-columns: 11rem repeat(var(--mdo-cols, 4), minmax(0, 1fr)); border-top: 1px solid var(--border); }
    .mdo__ligne--entete { border-top: 0; }
    .mdo__ligne--entete > div { padding: 10px 12px 8px; }
    .mdo__col { font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
    .mdo__famille { padding: 12px 14px; display: flex; flex-direction: column; gap: 1px; }
    .mdo__famille strong { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .mdo__famille span { font-size: 11.5px; color: var(--text-muted); }
    .mdo__case { padding: 6px; display: flex; flex-direction: column; }

    .mdo__tuile { position: relative; height: 100%; }
    .mdo__ouvrir { position: relative; width: 100%; height: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 9px 30px 9px 11px;
      border: 1px solid transparent; border-radius: 8px; background: var(--page-bg); font: inherit; color: var(--text); cursor: pointer;
      transition: border-color 0.12s, background 0.12s, box-shadow 0.12s; }
    .mdo__tuile--ok .mdo__ouvrir { background: var(--ok-bg); }
    .mdo__ouvrir:hover:not(:disabled) { border-color: var(--reco-border); background: var(--card-bg); box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08); }
    .mdo__ouvrir:focus-visible, .mdo__oeil:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .mdo__ouvrir:disabled, .mdo__oeil:disabled { opacity: 0.6; cursor: default; }
    .mdo__sigle { font-family: Consolas, monospace; font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: 0.02em; }
    .mdo__nom { font-size: 13px; line-height: 1.3; color: var(--text); }
    .mdo__bas { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; font-size: 12px; }
    .mdo__etat { display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted); }
    .mdo__point { width: 7px; height: 7px; border-radius: 50%; background: var(--n-300, #cbd5e1); }
    .mdo__etat--prep .mdo__point { background: var(--prep-accent); }
    .mdo__etat--ok { color: var(--ok-text); font-weight: 600; }
    .mdo__etat--ok .mdo__point { background: var(--ok-accent); }
    .mdo__ecarts { color: var(--prep-text); font-weight: 600; }
    .mdo__ecarts::before, .mdo__conforme::before { content: '·'; margin-right: 8px; color: var(--text-muted); font-weight: 400; }
    .mdo__conforme { color: var(--text-muted); }
    .mdo__chev { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--n-300, #cbd5e1); }
    .mdo__ouvrir:hover .mdo__chev { color: var(--primary); }
    .mdo__oeil { position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--card-bg); color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;
      transition: opacity 0.12s; }
    .mdo__tuile:hover .mdo__oeil, .mdo__oeil:focus-visible { opacity: 1; }
    .mdo__oeil:hover:not(:disabled) { color: var(--primary); }
    .mdo__note { margin: 0; font-size: 12px; color: var(--text-muted); }

    @media (hover: none) { .mdo__oeil { opacity: 1; } }
    @media (max-width: 900px) {
      .mdo__ligne--entete { display: none; }
      .mdo__ligne { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mdo__famille { grid-column: 1 / -1; flex-direction: row; gap: 8px; align-items: baseline; padding-bottom: 4px; }
      .mdo__case:empty { display: none; }
    }
    @media (max-width: 520px) { .mdo__ligne { grid-template-columns: minmax(0, 1fr); } }
  `,
  host: { '[style.--mdo-cols]': 'colonnes().length' },
})
export class ModelesDao {
  readonly groupes = input.required<GroupeDao[]>();
  /** Le nombre d'écarts au document type, par sigle (dernière version de son modèle) ; absent tant qu'il n'est pas lu. */
  readonly ecarts = input<Record<string, number>>({});
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
  readonly total = computed(() => this.toutes().length);
  readonly totalEcarts = computed(() => Object.values(this.ecarts()).reduce((n, x) => n + x, 0));

  cellule(cle: string, types: readonly string[]): LigneDao[] {
    return this.toutes().filter((x) => x.cle === cle && types.includes(x.l.typeDocument)).map((x) => x.l);
  }

  nb(etat: LigneDao['etat']): number {
    return this.toutes().filter((x) => x.l.etat === etat).length;
  }

  /** Le nom sans la catégorie entre parenthèses ; rien s'il répète le titre de la ligne (« Acte d'engagement »). */
  nomUtile(libelle: string, famille: string): string | null {
    const nom = libelle.replace(/\s*\([^)]*\)\s*$/, '');
    const simple = (s: string) => s.toLowerCase().replace(/[’']/g, "'").trim();
    return simple(nom) === simple(famille) ? null : nom;
  }

  etatCourt(l: LigneDao): string {
    if (l.etat === 'integre') return 'document type';
    if (l.etat === 'ok') return l.badge;
    return l.badge === 'À valider' ? 'à valider' : 'à rédiger';
  }
}
