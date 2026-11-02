import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { ApiError, corpsErreur } from '../../../core/errors/api-error';
import { FichePresentationDao } from '../../../models';
import { DossierService } from '../../../services';

/**
 * ⚠️ 17/10 (demande « pieces-dmc-par-les-donnees », B2 ; PRS20 be8089c) — la **fiche de présentation** d'un dossier DAO né d'une fiche,
 * produite des données (identification, marché, procédure, cohérence avec l'AGPM, validation), comme celle du dossier de
 * planification. Elle tient lieu de la pièce « Fiche de présentation datée et signée ».
 * ⚠️ 27/10 (pilote, « les éléments du dossier en données, pas en PDF ») — plus de bouton « Ouvrir le PDF » : elle se lit en données.
 */
@Component({
  selector: 'app-fiche-presentation-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="fp" [class.fp--tableau]="vue() === 'tableau'" aria-labelledby="fp-titre">
      <div class="fp__tete">
        <!-- ⚠️ 20/10 (pilote) — la fiche d'un dossier de marché (section « Attribution », V137) se nomme comme telle. -->
        <h3 id="fp-titre" class="fp__titre">Fiche de présentation du {{ duMarche() ? 'dossier de marché' : 'dossier d’appel d’offres' }}</h3>
        @if (fiche(); as f) {
          <span class="fp__version">{{ duMarche() ? (lot() ? 'lot n° ' + lot() + ' · ' : '') + 'issue de l’attribution' : 'informations du DAO, version ' + f.versionFiche }}</span>
        }
      </div>
      @if (chargement()) {
        <p class="fp__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="fp__refus" role="alert">{{ r }}</p>
      } @else if (fiche(); as f) {
        @if (vue() === 'tableau') {
          <!-- ⚠️ 31/10 (pilote, maquette « Fiche de présentation sans défilement », variante A) — dans la fenêtre de la page du dossier :
               les chiffres clés en tête.
               ⚠️ 02/11 (pilote) — puis DEUX VOLETS, comme la fiche DAO : le sommaire des sections à gauche, UNE section à droite ;
               « précédent / suivant » en bas, flèches haut et bas du clavier. -->
          <div class="fpt">
            @if (cles().length) {
              <dl class="fpt-cles">
                @for (c of cles(); track c.libelle) {
                  <div class="fpt-cle" [class.fpt-cle--or]="c.or">
                    <dt>{{ c.libelle }}</dt>
                    <dd [attr.title]="c.valeur">{{ insecable(c.valeur) }}@if (c.complement) { <small>&nbsp;· {{ c.complement }}</small> }</dd>
                  </div>
                }
              </dl>
            }
            <div class="fpv">
              <nav class="fpv-rail" aria-label="Sections de la fiche">
                <span class="fpv-rail__titre">Sections de la fiche</span>
                @for (s of sections(); track s.code; let k = $index) {
                  <button type="button" class="fpv-rail__nom" [attr.aria-current]="k === indexSection() ? 'true' : null" (click)="indexSection.set(k)" (keydown)="clavier($event)">
                    <span>{{ s.titre }}</span><span class="fpv-rail__n">{{ s.lignes.length }}</span>
                  </button>
                }
                <span class="fpv-rail__aide"><kbd>↑</kbd> <kbd>↓</kbd> changer de section</span>
              </nav>
              @if (sectionCourante(); as s) {
                <section class="fpv-section" aria-live="polite" [attr.aria-label]="s.titre">
                  <h4 class="fpv-section__titre">{{ s.titre }}<span class="fpv-pill">{{ s.lignes.length }} information{{ s.lignes.length > 1 ? 's' : '' }}</span></h4>
                  <dl class="fpt-lignes">
                    @for (l of s.lignes; track l.code) {
                      <div class="fpt-ligne" [attr.data-code]="l.code">
                        <dt>{{ l.libelle }}</dt><dd>{{ insecable(l.valeur) }}</dd>
                      </div>
                    }
                  </dl>
                  <div class="fpv-nav">
                    <button type="button" class="btn btn-outline btn-sm" [disabled]="indexSection() === 0" (click)="indexSection.set(indexSection() - 1)">‹ {{ sections()[indexSection() - 1]?.titre ?? 'Précédente' }}</button>
                    <span class="fpv-nav__ou">Section {{ indexSection() + 1 }} sur {{ sections().length }}</span>
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="indexSection() >= sections().length - 1" (click)="indexSection.set(indexSection() + 1)">{{ sections()[indexSection() + 1]?.titre ?? 'Suivante' }} ›</button>
                  </div>
                </section>
              }
            </div>
          </div>
        } @else {
        @for (s of f.sections; track s.code) {
          <div class="fp__section">
            <h4 class="fp__s-titre">{{ s.titre }}</h4>
            <dl class="fp__lignes">
              @for (l of s.lignes; track l.code) {
                <div class="fp__ligne" [attr.data-code]="l.code"><dt>{{ l.libelle }}</dt><dd>{{ l.valeur }}</dd></div>
              }
            </dl>
          </div>
        }
        @if (duMarche()) {
          <p class="fp__aide">Produite par l’application à partir de la ligne du plan, des informations du DAO, de la séance d’ouverture et du rapport d’évaluation signé. La création nominative du dossier de marché par la PRMP en tient lieu de signature (à confirmer).</p>
        } @else {
          <p class="fp__aide">Produite par l’application à partir de la ligne du plan et des informations du DAO validées par la PRMP : elle tient lieu de la fiche de présentation datée et signée.</p>
        }
        }
      }
    </section>
  `,
  styles: `
    .fp { display: flex; flex-direction: column; gap: 0.75rem; }
    .fp__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .fp__titre { margin: 0; font-size: 1.05rem; }
    .fp__version { font-size: 0.8rem; color: var(--n-500); }
    .fp__section { border: 1px solid var(--n-200); border-radius: var(--radius-lg, 10px); overflow: hidden; }
    .fp__s-titre { margin: 0; padding: 0.5rem 0.9rem; background: var(--success-bg); color: var(--success-text); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .fp__lignes { margin: 0; }
    .fp__ligne { display: grid; grid-template-columns: minmax(12rem, 32%) 1fr; gap: 1rem; padding: 0.5rem 0.9rem; border-top: 1px solid var(--n-100); }
    .fp__ligne dt { color: var(--n-500); font-size: 0.85rem; }
    .fp__ligne dd { margin: 0; color: var(--n-800); font-size: 0.9rem; overflow-wrap: anywhere; white-space: pre-line; }
    .fp__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .fp__refus { margin: 0; color: var(--danger-text); }

    /* ⚠️ 31/10 (pilote, variante A) — vue « tableau » : chiffres clés, puis (⚠️ 02/11) deux volets comme la fiche DAO. */
    .fp--tableau { gap: 8px; }
    /* Dans la fenêtre, le titre répète celui de la fenêtre (le lot est dans la carte « Attribution ») : la place va au contenu. */
    .fp--tableau .fp__tete { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .fpt { display: flex; flex-direction: column; gap: 10px; }
    .fpt-cles { display: grid; grid-auto-flow: column; grid-template-columns: minmax(0, 1.6fr); grid-auto-columns: minmax(0, 1fr); margin: 0; background: var(--section-fond); color: var(--texte-menu); border-radius: 4px; }
    .fpt-cle { min-width: 0; padding: 7px 12px; border-left: 1px solid var(--menu-survol); }
    .fpt-cle:first-child { border-left: 0; }
    .fpt-cle dt { font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .fpt-cle dd { margin: 0; font-size: 15px; font-weight: 500; line-height: 1.3; overflow-wrap: break-word; }
    .fpt-cle dd small { font-size: 11.5px; font-weight: 400; color: var(--texte-menu-secondaire); }
    .fpt-cle--or dd { color: var(--or); }
    .fpv { display: grid; grid-template-columns: 16rem minmax(0, 1fr); min-height: 22rem; border: 1px solid var(--bordure); border-radius: 4px; overflow: hidden; background: var(--carte-fond); }
    .fpv-rail { display: flex; flex-direction: column; gap: 1px; padding: 8px 6px; background: var(--menu-fond); color: var(--texte-menu); }
    .fpv-rail__titre { padding: 2px 8px 6px; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .fpv-rail__nom { display: flex; justify-content: space-between; gap: 8px; padding: 6px 12px; border: 0; border-radius: 4px; background: transparent; color: var(--texte-menu); font: inherit; font-size: 13px; line-height: 1.3; text-align: left; cursor: pointer; }
    .fpv-rail__nom:hover { background: var(--menu-survol); }
    .fpv-rail__nom[aria-current="true"] { background: var(--onglet-actif-fond); color: var(--texte); font-weight: 500; box-shadow: inset 3px 0 0 var(--or); }
    .fpv-rail__nom:focus-visible { outline: 2px solid var(--or); outline-offset: -2px; }
    .fpv-rail__n { font-size: 11.5px; opacity: 0.8; }
    .fpv-rail__aide { margin-top: auto; padding: 6px 8px 2px; font-size: 11px; color: var(--texte-menu-secondaire); }
    .fpv-rail__aide kbd { font: inherit; font-size: 10.5px; padding: 0 4px; border: 1px solid var(--texte-menu-secondaire); border-radius: 3px; }
    .fpv-section { min-width: 0; display: flex; flex-direction: column; }
    .fpv-section__titre { display: flex; align-items: center; gap: 10px; margin: 0; padding: 9px 14px; border-bottom: 1px solid var(--bordure); font-size: 15px; font-weight: 500; }
    .fpv-pill { padding: 1px 8px; border-radius: 10px; background: var(--neutre-fond); color: var(--neutre-texte); font-size: 11px; font-weight: 500; }
    .fpv-section .fpt-lignes { padding: 4px 0; }
    .fpv-nav { display: flex; align-items: center; gap: 10px; margin-top: auto; padding: 7px 14px; border-top: 1px solid var(--bordure); background: var(--tableau-entete); }
    .fpv-nav__ou { margin: 0 auto; font-size: 12px; color: var(--texte-secondaire); }
    .fpt-lignes { margin: 0; }
    .fpt-ligne { display: grid; grid-template-columns: minmax(12rem, 22rem) minmax(0, 1fr); gap: 16px; padding: 7px 14px; border-top: 1px solid var(--bordure); font-size: 13.5px; line-height: 1.45; }
    .fpt-ligne:first-child { border-top: 0; }
    .fpt-ligne dt { color: var(--texte-secondaire); }
    .fpt-ligne dd { margin: 0; color: var(--texte); overflow-wrap: break-word; white-space: pre-line; }
    @media (max-width: 52rem) {
      .fpv { grid-template-columns: minmax(0, 1fr); }
      .fpv-rail { flex-direction: row; overflow-x: auto; }
      .fpv-rail__nom { white-space: nowrap; }
      .fpv-rail__titre, .fpv-rail__aide { display: none; }
      .fpt-ligne { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    }
  `,
})
export class FichePresentationDaoDoc {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly fiche = signal<FichePresentationDao | null>(null);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);
  /** ⚠️ 20/10 — la fiche d'un dossier de marché porte la section « Attribution » (V137). */
  readonly duMarche = computed(() => !!this.fiche()?.sections.some((x) => x.code === 'ATTRIBUTION'));
  readonly lot = computed(() => this.fiche()?.sections.find((x) => x.code === 'ATTRIBUTION')?.lignes.find((l) => l.code === 'LOT')?.valeur ?? null);

  /** ⚠️ 31/10 (pilote, variante A) — `tableau` : la fenêtre de la page du dossier (chiffres clés, puis deux volets) ; `document` ailleurs. */
  readonly vue = input<'document' | 'tableau'>('document');

  /** ⚠️ 02/11 (pilote) — les sections qui ont des lignes, et celle affichée dans le volet de droite. */
  readonly sections = computed(() => (this.fiche()?.sections ?? []).filter((s) => s.lignes.length > 0));
  readonly indexSection = signal(0);
  readonly sectionCourante = computed(() => this.sections()[Math.min(this.indexSection(), this.sections().length - 1)] ?? null);

  /** Dans le sommaire, flèches haut et bas : section précédente ou suivante ; le focus suit le bouton de la section. */
  clavier(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const k = this.indexSection() + (e.key === 'ArrowDown' ? 1 : -1);
    if (k < 0 || k >= this.sections().length) return;
    e.preventDefault();
    this.indexSection.set(k);
    const boutons = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('.fpv-rail__nom');
    boutons?.[k]?.focus();
  }

  /**
   * ⚠️ 31/10 (pilote) — un montant ne se coupe jamais : les espaces entre ses groupes de chiffres (« 2 820 116 508 ») et devant son
   * unité (« Ar », « Ariary », « % ») deviennent insécables ; trop long pour la fin d'une ligne, il passe entier à la suivante.
   */
  insecable(valeur: string | null | undefined): string {
    return (valeur ?? '')
      .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00A0')
      .replace(/(\d) (?=(Ar|Ariary|%)(?![\p{L}]))/gu, '$1\u00A0');
  }
  /** Les chiffres clés du bandeau, tirés des lignes servies ; une ligne absente n'a pas de case. */
  readonly cles = computed<{ libelle: string; valeur: string; complement?: string | null; or?: boolean }[]>(() => {
    const f = this.fiche();
    if (!f) return [];
    const v = (section: string, code: string): string | null => f.sections.find((x) => x.code === section)?.lignes.find((l) => l.code === code)?.valeur ?? null;
    const court = (x: string | null): string | null => (x ? x.split(' (')[0] : null);
    const ariary = (x: string | null): string | null => (x && /^[\d\s]+$/.test(x) ? `${x} Ar` : x);
    const cases = this.duMarche()
      ? [
          { libelle: 'Attributaire proposé', valeur: court(v('ATTRIBUTION', 'ATTRIBUTAIRE')), complement: /\((offre[^)]*)\)/.exec(v('ATTRIBUTION', 'ATTRIBUTAIRE') ?? '')?.[1] ?? null },
          { libelle: 'Montant proposé HT', valeur: ariary(v('ATTRIBUTION', 'MONTANT_HT')), or: true },
          { libelle: 'Écart à l’estimation', valeur: court(v('ATTRIBUTION', 'ECART_ESTIMATION')) },
          {
            libelle: 'Offres',
            valeur: v('SEANCE', 'OFFRES_RECUES') ? `${v('SEANCE', 'OFFRES_RECUES')} reçue(s)` : null,
            complement: v('EVALUATION', 'OFFRES_CONFORMES') ? `${v('EVALUATION', 'OFFRES_CONFORMES')} conforme(s)` : null,
          },
          { libelle: 'Délai d’exécution', valeur: v('ATTRIBUTION', 'DELAI') },
        ]
      : [
          { libelle: 'Mode de passation', valeur: v('MARCHE', 'MODE') },
          { libelle: 'Montant estimatif du plan', valeur: ariary(v('MARCHE', 'MONTANT_ESTIMATIF')), or: true },
          { libelle: 'Date limite de remise', valeur: v('PROCEDURE', 'DATE_LIMITE') },
          { libelle: 'Garantie de soumission', valeur: court(v('PROCEDURE', 'GARANTIE_MONTANT')) },
          { libelle: 'Retard sur le plan', valeur: v('COHERENCE', 'RETARD') },
        ];
    return cases.filter((c): c is typeof c & { valeur: string } => !!c.valeur);
  });
  constructor() {
    effect((nettoyer) => {
      const id = this.idDossier();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = this.dossiers.fichePresentation(id).subscribe({
        next: (f) => { this.fiche.set(f); this.indexSection.set(0); this.chargement.set(false); },
        error: (e: ApiError) => {
          this.fiche.set(null);
          this.chargement.set(false);
          this.refus.set(corpsErreur<{ message?: string }>(e)?.message ?? 'La fiche de présentation n’est pas disponible : les informations du DAO doivent être validées.');
        },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }
}
