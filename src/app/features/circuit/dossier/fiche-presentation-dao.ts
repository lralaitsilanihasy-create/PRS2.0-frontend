import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { ApiError, corpsErreur } from '../../../core/errors/api-error';
import { ouvrirBlobSur } from '../../../core/securite/fichiers-surs';
import { FichePresentationDao } from '../../../models';
import { DossierService } from '../../../services';

/**
 * ⚠️ 17/10 (demande « pieces-dmc-par-les-donnees », B2 ; PRS20 be8089c) — la **fiche de présentation** d'un dossier DAO né d'une fiche,
 * produite des données (identification, marché, procédure, cohérence avec l'AGPM, validation), comme celle du dossier de
 * planification. Elle tient lieu de la pièce « Fiche de présentation datée et signée » ; le PDF sert à l'impression.
 */
@Component({
  selector: 'app-fiche-presentation-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="fp" aria-labelledby="fp-titre">
      <div class="fp__tete">
        <!-- ⚠️ 20/10 (pilote) — la fiche d'un dossier de marché (section « Attribution », V137) se nomme comme telle. -->
        <h3 id="fp-titre" class="fp__titre">Fiche de présentation du {{ duMarche() ? 'dossier de marché' : 'dossier d’appel d’offres' }}</h3>
        @if (fiche(); as f) {
          <span class="fp__version">{{ duMarche() ? (lot() ? 'lot n° ' + lot() + ' · ' : '') + 'issue de l’attribution' : 'fiche DAO, version ' + f.versionFiche }}</span>
        }
        <button type="button" class="btn btn-sm btn-outline fp__pdf" [disabled]="production()" (click)="ouvrirPdf()">
          {{ production() ? 'Production…' : 'Ouvrir le PDF' }}
        </button>
      </div>
      @if (chargement()) {
        <p class="fp__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="fp__refus" role="alert">{{ r }}</p>
      } @else if (fiche(); as f) {
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
    </section>
  `,
  styles: `
    .fp { display: flex; flex-direction: column; gap: 0.75rem; }
    .fp__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .fp__titre { margin: 0; font-size: 1.05rem; }
    .fp__version { font-size: 0.8rem; color: var(--n-500); }
    .fp__pdf { margin-left: auto; }
    .fp__section { border: 1px solid var(--n-200); border-radius: var(--radius-lg, 10px); overflow: hidden; }
    .fp__s-titre { margin: 0; padding: 0.5rem 0.9rem; background: var(--success-bg, #ecfdf5); color: var(--success-text, #047857); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .fp__lignes { margin: 0; }
    .fp__ligne { display: grid; grid-template-columns: minmax(12rem, 32%) 1fr; gap: 1rem; padding: 0.5rem 0.9rem; border-top: 1px solid var(--n-100); }
    .fp__ligne dt { color: var(--n-500); font-size: 0.85rem; }
    .fp__ligne dd { margin: 0; color: var(--n-800); font-size: 0.9rem; overflow-wrap: anywhere; }
    .fp__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .fp__refus { margin: 0; color: var(--danger-text); }
  `,
})
export class FichePresentationDaoDoc {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly fiche = signal<FichePresentationDao | null>(null);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);
  readonly production = signal(false);
  /** ⚠️ 20/10 — la fiche d'un dossier de marché porte la section « Attribution » (V137). */
  readonly duMarche = computed(() => !!this.fiche()?.sections.some((x) => x.code === 'ATTRIBUTION'));
  readonly lot = computed(() => this.fiche()?.sections.find((x) => x.code === 'ATTRIBUTION')?.lignes.find((l) => l.code === 'LOT')?.valeur ?? null);

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

  ouvrirPdf(): void {
    this.production.set(true);
    this.dossiers.fichePresentationPdf(this.idDossier()).subscribe({
      next: (b) => { this.production.set(false); ouvrirBlobSur(b); },
      error: () => { this.production.set(false); this.refus.set('Le PDF n’a pas pu être produit.'); },
    });
  }
}
