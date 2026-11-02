import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { ApiError, corpsErreur } from '../../../core/errors/api-error';
import { CanevasRapport } from '../../../models';
import { DossierService } from '../../../services';
import { vueCanevas } from './canevas-rapport-vue';

/** Libellés des deux parties du canevas en prestations intellectuelles (Q2). */
const LIBELLES_PARTIE: Record<'TECHNIQUE' | 'FINALE', string> = {
  TECHNIQUE: 'Partie 1 — Évaluation des propositions techniques',
  FINALE: 'Partie 2 — Évaluation finale',
};

/** Les informations du DAO reprises dans la bande de chiffres, cherchées par libellé dans tout le canevas. */
const CLES: { libelle: string; motif: RegExp }[] = [
  { libelle: 'Dossier d’appel d’offres', motif: /^Numéro du dossier/i },
  { libelle: 'Mode de passation', motif: /^Mode de passation$/i },
  { libelle: 'Catégorie', motif: /^Catégorie$/i },
  { libelle: 'Montant estimatif du plan', motif: /^Montant estimatif/i },
  { libelle: 'Garantie de soumission', motif: /^Montant de la garantie de soumission/i },
];

/**
 * ⚠️ 17/10 (demande « canevas-rapport-evaluation », B1 ; PRS20 17f0f26) — le **canevas de rapport d'évaluation** d'un dossier DAO né
 * d'une fiche validée hors contrat-cadre, produit par l'application (jamais téléversé). Le plan du rapport du guide de la CAO, rempli
 * de ce que la fiche exige (lignes) ; les tableaux que la commission remplira sont montrés vides.
 * ⚠️ 27/10 (pilote, « les éléments du dossier en données, pas en PDF ») — plus de bouton « Ouvrir le PDF ».
 * ⚠️ 02/11 (pilote, maquette « Canevas de rapport », variante A) — DEUX VOLETS : la bande de chiffres, le sommaire des parties (chacune
 * avec ce qu'elle contient) à gauche, UNE partie à droite avec « précédente / suivante » ; l'exigence du DAO entre dans la grille de
 * qualification, les caractéristiques se rangent sous leur article (`vueCanevas`).
 */
@Component({
  selector: 'app-canevas-rapport-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cr" aria-labelledby="cr-titre">
      <div class="cr__tete">
        <h3 id="cr-titre" class="cr__titre">Canevas de rapport d’évaluation</h3>
        @if (canevas(); as c) { <span class="cr__version">informations du DAO, version {{ c.versionFiche }}</span> }
      </div>
      @if (chargement()) {
        <p class="cr__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="cr__refus" role="alert">{{ r }}</p>
      } @else if (canevas()) {
        @if (cles().length) {
          <dl class="cr-cles">
            @for (c of cles(); track c.libelle) { <div><dt>{{ c.libelle }}</dt><dd>{{ c.valeur }}</dd></div> }
          </dl>
        }
        <div class="cr-vol">
          <nav class="cr-rail" aria-label="Parties du rapport">
            @for (s of sections(); track s.code; let k = $index) {
              @if (s.partie && s.partie !== sections()[k - 1]?.partie) { <span class="cr-rail__partie">{{ libellePartie(s.partie) }}</span> }
              <button type="button" class="cr-rail__b" [attr.aria-current]="k === index() ? 'true' : null" (click)="index.set(k)" (keydown)="clavier($event)">
                <span class="cr-rail__n">{{ s.numero }}</span>
                <span class="cr-rail__t">{{ s.nom }}</span>
                <span class="cr-rail__q">{{ s.quantite }}</span>
              </button>
            }
            <span class="cr-rail__aide"><kbd>↑</kbd> <kbd>↓</kbd> changer de partie</span>
          </nav>
          @if (courante(); as s) {
            <section class="cr-partie" aria-live="polite" [attr.aria-label]="s.nom" [attr.data-section]="s.code">
              <h4 class="cr-partie__t"><span class="cr-partie__n">{{ s.numero }}</span>{{ s.nom }}<span class="cr-partie__q">{{ s.quantite }}</span></h4>
              @if (s.reperes.length) {
                @if (s.criteres || s.articles || s.tableau) { <p class="cr-sous">Repères du DAO</p> }
                <dl class="cr__lignes">
                  @for (l of s.reperes; track l.code) { <div class="cr__ligne"><dt>{{ l.libelle }}</dt><dd>{{ l.valeur }}</dd></div> }
                </dl>
              }
              @if (s.reperes.length && (s.tableau || s.articles)) { <p class="cr-sous">À remplir par la commission</p> }
              @if (s.criteres; as cs) {
                <div class="cr__tableau-cadre">
                  <table class="cr__tableau" [attr.aria-label]="s.nom + ' — à remplir par la commission'">
                    <thead><tr><th scope="col" class="cr-col-critere">{{ s.colonnes[0] }}</th><th scope="col">Exigé par le DAO</th>
                      @for (c of s.colonnes.slice(1); track $index) { <th scope="col" class="cr-col-saisie">{{ c }}</th> }</tr></thead>
                    <tbody>
                      @for (c of cs; track $index) {
                        <tr><th scope="row">{{ c.critere }}</th><td class="cr-exige">{{ c.exige }}</td>@for (x of s.colonnes.slice(1); track $index) { <td class="cr-saisir"></td> }</tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @if (s.articles; as arts) {
                <div class="cr__tableau-cadre">
                  <table class="cr__tableau" [attr.aria-label]="s.nom + ' — à remplir par la commission'">
                    <thead><tr><th scope="col" class="cr-col-critere">Caractéristique</th><th scope="col">Exigée</th>
                      @for (c of s.colonnes.slice(1); track $index) { <th scope="col" class="cr-col-saisie">{{ c }}</th> }</tr></thead>
                    <tbody>
                      @for (a of arts; track a.article; let i = $index) {
                        <tr class="cr-article"><th scope="colgroup" [attr.colspan]="s.colonnes.length + 1">{{ i + 1 }}. {{ a.article }}<small> · {{ a.caracteristiques.length }}</small></th></tr>
                        @for (c of a.caracteristiques; track $index) {
                          <tr><th scope="row">{{ c.caracteristique }}</th><td class="cr-exige">{{ c.exigee }}</td>@for (x of s.colonnes.slice(1); track $index) { <td class="cr-saisir"></td> }</tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }
              @if (s.tableau; as t) {
                <div class="cr__tableau-cadre">
                  <table class="cr__tableau" [attr.aria-label]="s.nom + ' — à remplir par la commission'">
                    <thead><tr>@for (c of t.colonnes; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
                    <tbody>
                      @for (r of t.rangees; track $index) {
                        <tr><th scope="row">{{ r }}</th>@for (c of t.colonnes.slice(1); track $index) { <td class="cr-saisir"></td> }</tr>
                      }
                      @for (v of vides(t.rangeesVides); track v) {
                        <tr class="cr__vide">@for (c of t.colonnes; track $index; let j = $index) {
                          @if (j === 0 && numerote(c)) { <td>{{ v + 1 }}</td> } @else { <td class="cr-saisir"></td> }
                        }</tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              <div class="cr-nav">
                <button type="button" class="btn btn-outline btn-sm" [disabled]="index() === 0" (click)="index.set(index() - 1)">‹ Partie précédente</button>
                <span class="cr-nav__ou">Partie {{ index() + 1 }} sur {{ sections().length }}</span>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="index() >= sections().length - 1" (click)="index.set(index() + 1)">Partie suivante ›</button>
              </div>
            </section>
          }
        </div>
        <p class="cr__aide">Produit par l’application à partir des informations du DAO soumises : il tient lieu de la pièce « Canevas de rapport d’évaluation ». Les cases grisées seront remplies par la commission d’appel d’offres.</p>
      }
    </section>
  `,
  styles: `
    .cr { display: flex; flex-direction: column; gap: 0.75rem; }
    .cr__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .cr__titre { margin: 0; font-size: 1.05rem; font-weight: 500; }
    .cr__version { font-size: 0.8rem; color: var(--texte-secondaire); }
    .cr-cles { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); margin: 0; background: var(--section-fond); color: var(--texte-menu); border-radius: 4px; }
    .cr-cles > div { min-width: 0; padding: 7px 12px; border-left: 1px solid var(--menu-survol); }
    .cr-cles > div:first-child { border-left: 0; }
    .cr-cles dt { font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .cr-cles dd { margin: 0; font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
    .cr-vol { display: grid; grid-template-columns: 17rem minmax(0, 1fr); min-height: 22rem; border: 1px solid var(--bordure); border-radius: 4px; overflow: hidden; background: var(--carte-fond); }
    .cr-rail { display: flex; flex-direction: column; gap: 1px; padding: 8px 6px; background: var(--menu-fond); color: var(--texte-menu); }
    .cr-rail__partie { padding: 8px 8px 4px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .cr-rail__b { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 1px 8px; padding: 6px 10px; border: 0; border-radius: 4px; background: transparent; color: var(--texte-menu); font: inherit; text-align: left; cursor: pointer; }
    .cr-rail__b:hover { background: var(--menu-survol); }
    .cr-rail__b[aria-current='true'] { background: var(--onglet-actif-fond); color: var(--texte); box-shadow: inset 3px 0 0 var(--or); }
    .cr-rail__b:focus-visible { outline: 2px solid var(--or); outline-offset: -2px; }
    .cr-rail__n { grid-row: span 2; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--menu-survol); font-size: 11.5px; font-weight: 500; }
    .cr-rail__b[aria-current='true'] .cr-rail__n { background: var(--or); color: var(--texte); }
    .cr-rail__t { font-size: 13px; line-height: 1.3; }
    .cr-rail__b[aria-current='true'] .cr-rail__t { font-weight: 500; }
    .cr-rail__q { font-size: 11.5px; color: var(--texte-menu-secondaire); }
    .cr-rail__b[aria-current='true'] .cr-rail__q { color: var(--texte-secondaire); }
    .cr-rail__aide { margin-top: auto; padding: 6px 8px 2px; font-size: 11px; color: var(--texte-menu-secondaire); }
    .cr-rail__aide kbd { font: inherit; font-size: 10.5px; padding: 0 4px; border: 1px solid var(--texte-menu-secondaire); border-radius: 3px; }
    .cr-partie { min-width: 0; display: flex; flex-direction: column; }
    .cr-partie__t { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0; padding: 9px 14px; border-bottom: 1px solid var(--bordure); font-size: 15px; font-weight: 500; }
    .cr-partie__n { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--section-fond); color: var(--texte-menu); font-size: 12px; }
    .cr-partie__q { padding: 1px 8px; border-radius: 10px; background: var(--neutre-fond); color: var(--neutre-texte); font-size: 11px; font-weight: 500; }
    .cr-sous { margin: 10px 14px 4px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .cr__lignes { margin: 0; }
    .cr__ligne { display: grid; grid-template-columns: minmax(12rem, 32%) 1fr; gap: 1rem; padding: 0.45rem 14px; border-top: 1px solid var(--bordure); }
    .cr__ligne:first-child { border-top: 0; }
    .cr__ligne dt { color: var(--texte-secondaire); font-size: 0.85rem; }
    .cr__ligne dd { margin: 0; color: var(--texte); font-size: 0.9rem; overflow-wrap: anywhere; white-space: pre-line; }
    .cr__tableau-cadre { overflow-x: auto; padding: 0.5rem 14px 0.75rem; }
    .cr__tableau { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .cr__tableau th, .cr__tableau td { border: 1px solid var(--bordure); padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
    .cr__tableau thead th { background: var(--tableau-entete); color: var(--texte-secondaire); font-weight: 500; }
    .cr__tableau tbody th { font-weight: 400; color: var(--texte); }
    .cr-col-critere { width: 24%; }
    .cr-col-saisie { width: 14%; }
    .cr-exige { color: var(--texte); white-space: pre-line; overflow-wrap: anywhere; }
    .cr-saisir { background: var(--ligne-survol); min-width: 6rem; }
    .cr-article th { background: var(--tableau-entete); font-weight: 500 !important; }
    .cr-article small { font-weight: 400; color: var(--texte-secondaire); }
    .cr__vide td { height: 1.6rem; }
    .cr-nav { display: flex; align-items: center; gap: 10px; margin-top: auto; padding: 7px 14px; border-top: 1px solid var(--bordure); background: var(--tableau-entete); }
    .cr-nav__ou { margin: 0 auto; font-size: 12px; color: var(--texte-secondaire); }
    .cr__aide { margin: 0; font-size: 0.8rem; color: var(--texte-secondaire); }
    .cr__refus { margin: 0; color: var(--retard-texte); }
    @media (max-width: 52rem) {
      .cr-cles { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cr-cles > div:nth-child(odd) { border-left: 0; }
      .cr-vol { grid-template-columns: minmax(0, 1fr); }
      .cr-rail { flex-direction: row; overflow-x: auto; }
      .cr-rail__b { min-width: 12rem; }
      .cr-rail__partie, .cr-rail__aide { display: none; }
      .cr__ligne { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    }
  `,
})
export class CanevasRapportDoc {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly canevas = signal<CanevasRapport | null>(null);
  /** ⚠️ 02/11 (variante A) — les parties mises en forme, et celle affichée dans le volet de droite. */
  readonly sections = computed(() => vueCanevas(this.canevas()));
  readonly index = signal(0);
  readonly courante = computed(() => this.sections()[Math.min(this.index(), this.sections().length - 1)] ?? null);
  /** La bande de chiffres : seulement les informations que le canevas sert. */
  readonly cles = computed(() => {
    const lignes = (this.canevas()?.sections ?? []).flatMap((s) => s.lignes);
    return CLES.flatMap((c) => {
      const l = lignes.find((x) => c.motif.test(x.libelle));
      return l?.valeur ? [{ libelle: c.libelle, valeur: l.valeur.replace(/\s*\(.*\)$/, '') }] : [];
    });
  });
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);

  constructor() {
    effect((nettoyer) => {
      const id = this.idDossier();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = this.dossiers.canevasRapport(id).subscribe({
        next: (c) => { this.canevas.set(c); this.index.set(0); this.chargement.set(false); },
        error: (e: ApiError) => {
          this.canevas.set(null);
          this.chargement.set(false);
          this.refus.set(corpsErreur<{ message?: string }>(e)?.message
            ?? 'Le canevas n’est pas disponible : il faut des informations du DAO validées, hors contrat-cadre.');
        },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }

  libellePartie(p: 'TECHNIQUE' | 'FINALE'): string { return LIBELLES_PARTIE[p]; }

  /** Dans le sommaire, flèches haut et bas : partie précédente ou suivante ; le focus suit le bouton de la partie. */
  clavier(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const k = this.index() + (e.key === 'ArrowDown' ? 1 : -1);
    if (k < 0 || k >= this.sections().length) return;
    e.preventDefault();
    this.index.set(k);
    const boutons = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('.cr-rail__b');
    boutons?.[k]?.focus();
  }

  /** Une première colonne « N° » ou « Rang » se numérote d'office dans les rangées vierges. */
  numerote(colonne: string): boolean { return /^(N°|Rang)$/.test(colonne); }

  /** Les rangées vierges, à numéroter pour le suivi. */
  vides(n: number): number[] { return Array.from({ length: Math.max(0, n) }, (_, i) => i); }
}
