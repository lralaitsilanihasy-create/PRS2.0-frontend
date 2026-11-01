import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';

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
  host: { '(window:resize)': 'ajuster()' },
  template: `
    <section class="fp" [class.fp--tableau]="vue() === 'tableau'" aria-labelledby="fp-titre">
      <div class="fp__tete">
        <!-- ⚠️ 20/10 (pilote) — la fiche d'un dossier de marché (section « Attribution », V137) se nomme comme telle. -->
        <h3 id="fp-titre" class="fp__titre">Fiche de présentation du {{ duMarche() ? 'dossier de marché' : 'dossier d’appel d’offres' }}</h3>
        @if (fiche(); as f) {
          <span class="fp__version">{{ duMarche() ? (lot() ? 'lot n° ' + lot() + ' · ' : '') + 'issue de l’attribution' : 'fiche DAO, version ' + f.versionFiche }}</span>
        }
      </div>
      @if (chargement()) {
        <p class="fp__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="fp__refus" role="alert">{{ r }}</p>
      } @else if (fiche(); as f) {
        @if (vue() === 'tableau') {
          <!-- ⚠️ 31/10 (pilote, maquette « Fiche de présentation sans défilement », variante A) — dans la fenêtre de la page du dossier :
               les chiffres clés en tête, puis toutes les sections en cartes sur quatre colonnes ; tout se lit sur un écran. -->
          <div class="fpt" [style.zoom]="zoom() < 1 ? zoom() : null">
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
            <div class="fpt-cartes">
              @for (s of f.sections; track s.code) {
                @if (s.lignes.length) {
                  <section class="fpt-carte" [attr.aria-label]="s.titre">
                    <h4 class="fp__s-titre fpt-carte__titre"><span>{{ s.titre }}</span><span class="fpt-carte__n">{{ s.lignes.length }}</span></h4>
                    <dl class="fpt-lignes">
                      @for (l of s.lignes; track l.code) {
                        <div class="fpt-ligne" [attr.data-code]="l.code">
                          <dt>{{ l.libelle }}</dt><dd>{{ insecable(l.valeur) }}</dd>
                        </div>
                      }
                    </dl>
                  </section>
                }
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
          <p class="fp__aide">Produite par l’application à partir de la ligne du plan, de la fiche DAO, de la séance d’ouverture et du rapport d’évaluation signé. La création nominative du dossier de marché par la PRMP en tient lieu de signature (à confirmer).</p>
        } @else {
          <p class="fp__aide">Produite par l’application à partir de la ligne du plan et de la fiche DAO validée par la PRMP : elle tient lieu de la fiche de présentation datée et signée.</p>
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

    /* ⚠️ 31/10 (pilote, variante A) — vue « tableau » : chiffres clés, puis cartes en quatre colonnes équilibrées. */
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
    .fpt-cartes { columns: 4; column-gap: 8px; }
    .fpt-carte { break-inside: avoid; margin: 0 0 8px; border: 1px solid var(--bordure); border-radius: 4px; overflow: hidden; }
    .fpt-carte__titre { display: flex; justify-content: space-between; gap: 6px; padding: 4px 10px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.06em; }
    .fpt-carte__n { color: var(--texte-secondaire); }
    .fpt-lignes { margin: 0; }
    .fpt-ligne { display: grid; grid-template-columns: 44% 56%; gap: 6px; padding: 2px 10px; border-top: 1px solid var(--bordure); font-size: 12px; line-height: 1.3; }
    .fpt-ligne:first-child { border-top: 0; }
    .fpt-ligne dt { color: var(--texte-secondaire); }
    .fpt-ligne dd { margin: 0; color: var(--texte); overflow-wrap: break-word; white-space: pre-line; }
    @media (max-width: 62rem) { .fpt-cartes { columns: 3; } }
    @media (max-width: 52rem) { .fpt-cartes { columns: 1; } .fpt { zoom: 1 !important; } }
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

  /** ⚠️ 31/10 (pilote, variante A) — `tableau` : la fenêtre de la page du dossier (tout sur un écran) ; `document` ailleurs. */
  readonly vue = input<'document' | 'tableau'>('document');
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Réduction légère quand la fiche dépasse un peu la fenêtre (80 % au plus) : on la lit encore d'un coup d'œil. */
  readonly zoom = signal(1);

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
  private readonly suiviZoom = effect(() => {
    if (this.vue() !== 'tableau' || !this.fiche()) return;
    setTimeout(() => this.ajuster());
    setTimeout(() => this.ajuster(), 400);
  });

  /** Mesure la fiche à sa taille naturelle et la réduit juste assez pour tenir dans le corps de la fenêtre. */
  ajuster(): void {
    if (this.vue() !== 'tableau') return;
    const corps = this.hote.nativeElement.closest('.modal-body');
    const fpt = this.hote.nativeElement.querySelector<HTMLElement>('.fpt');
    if (!corps || !fpt) return;
    fpt.style.zoom = '';
    const tient = (): boolean => corps.scrollHeight <= corps.clientHeight + 1;
    let z = 1;
    if (!tient()) {
      // Première estimation à proportion, puis on remonte par pas de 0,01 tant que la fiche tient : réduite, elle s'élargit, ses textes
      // passent moins à la ligne, et la proportion seule la réduirait plus que nécessaire.
      const surplus = corps.scrollHeight - corps.clientHeight;
      z = Math.max(0.8, Math.floor(((fpt.offsetHeight - surplus) / fpt.offsetHeight) * 100) / 100);
      fpt.style.zoom = String(z);
      while (z < 1 && tient()) {
        const essai = Math.round((z + 0.01) * 100) / 100;
        fpt.style.zoom = String(essai);
        if (!tient()) break;
        z = essai;
      }
    }
    this.zoom.set(z);
    fpt.style.zoom = z < 1 ? String(z) : '';
  }

  constructor() {
    effect((nettoyer) => {
      const id = this.idDossier();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = this.dossiers.fichePresentation(id).subscribe({
        next: (f) => { this.fiche.set(f); this.chargement.set(false); },
        error: (e: ApiError) => {
          this.fiche.set(null);
          this.chargement.set(false);
          this.refus.set(corpsErreur<{ message?: string }>(e)?.message ?? 'La fiche de présentation n’est pas disponible : la fiche DAO doit être validée.');
        },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }
}
