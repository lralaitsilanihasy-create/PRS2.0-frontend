import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { ApiError, corpsErreur } from '../../../core/errors/api-error';
import { CanevasRapport, CanevasSection } from '../../../models';
import { DossierService } from '../../../services';

/** Libellés des deux parties du canevas en prestations intellectuelles (Q2). */
const LIBELLES_PARTIE: Record<'TECHNIQUE' | 'FINALE', string> = {
  TECHNIQUE: 'Partie 1 — Évaluation des propositions techniques',
  FINALE: 'Partie 2 — Évaluation finale',
};

/**
 * ⚠️ 17/10 (demande « canevas-rapport-evaluation », B1 ; PRS20 17f0f26) — le **canevas de rapport d'évaluation** d'un dossier DAO né
 * d'une fiche validée hors contrat-cadre, produit par l'application (jamais téléversé). Le plan du rapport du guide de la CAO, rempli
 * de ce que la fiche exige (lignes) ; les tableaux que la commission remplira sont montrés vides.
 * ⚠️ 27/10 (pilote, « les éléments du dossier en données, pas en PDF ») — plus de bouton « Ouvrir le PDF ».
 */
@Component({
  selector: 'app-canevas-rapport-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cr" aria-labelledby="cr-titre">
      <div class="cr__tete">
        <h3 id="cr-titre" class="cr__titre">Canevas de rapport d’évaluation</h3>
        @if (canevas(); as c) { <span class="cr__version">fiche DAO, version {{ c.versionFiche }}</span> }
      </div>
      @if (chargement()) {
        <p class="cr__aide" role="status">Chargement…</p>
      } @else if (refus(); as r) {
        <p class="cr__refus" role="alert">{{ r }}</p>
      } @else if (canevas()) {
        @for (s of sections(); track s.code; let i = $index) {
          @if (s.partie && s.partie !== sections()[i - 1]?.partie) {
            <h4 class="cr__partie">{{ libellePartie(s) }}</h4>
          }
          <div class="cr__section" [attr.data-section]="s.code">
            <h5 class="cr__s-titre">{{ s.titre }}</h5>
            @if (s.lignes.length) {
              <dl class="cr__lignes">
                @for (l of s.lignes; track l.code) {
                  <div class="cr__ligne"><dt>{{ l.libelle }}</dt><dd>{{ l.valeur }}</dd></div>
                }
              </dl>
            }
            @if (s.tableau; as t) {
              <div class="cr__tableau-cadre">
                <table class="cr__tableau">
                  <caption class="sr-only">{{ s.titre }} — à remplir par la commission</caption>
                  <thead><tr>@for (c of t.colonnes; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
                  <tbody>
                    @for (r of t.rangees; track $index) {
                      <tr><th scope="row">{{ r }}</th>@for (c of t.colonnes.slice(1); track $index) { <td></td> }</tr>
                    }
                    @for (v of vides(t.rangeesVides); track v) {
                      <tr class="cr__vide">@for (c of t.colonnes; track $index) { <td></td> }</tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
        <p class="cr__aide">Produit par l’application à partir de la fiche DAO soumise : il tient lieu de la pièce « Canevas de rapport d’évaluation ». Les tableaux seront remplis par la commission d’appel d’offres.</p>
      }
    </section>
  `,
  styles: `
    .cr { display: flex; flex-direction: column; gap: 0.75rem; }
    .cr__tete { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .cr__titre { margin: 0; font-size: 1.05rem; }
    .cr__version { font-size: 0.8rem; color: var(--n-500); }
    .cr__partie { margin: 0.5rem 0 0; font-size: 0.95rem; color: var(--n-800); }
    .cr__section { border: 1px solid var(--n-200); border-radius: var(--radius-lg, 10px); overflow: hidden; }
    .cr__s-titre { margin: 0; padding: 0.5rem 0.9rem; background: var(--info-bg, #eff6ff); color: var(--info-text, #1d4ed8); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .cr__lignes { margin: 0; }
    .cr__ligne { display: grid; grid-template-columns: minmax(12rem, 32%) 1fr; gap: 1rem; padding: 0.5rem 0.9rem; border-top: 1px solid var(--n-100); }
    .cr__ligne dt { color: var(--n-500); font-size: 0.85rem; }
    .cr__ligne dd { margin: 0; color: var(--n-800); font-size: 0.9rem; overflow-wrap: anywhere; white-space: pre-line; }
    .cr__tableau-cadre { overflow-x: auto; padding: 0.5rem 0.9rem 0.75rem; border-top: 1px solid var(--n-100); }
    .cr__tableau { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .cr__tableau th, .cr__tableau td { border: 1px solid var(--n-300); padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
    .cr__tableau thead th { background: var(--n-50, #f8fafc); color: var(--n-700); font-weight: 600; }
    .cr__tableau tbody th { font-weight: 400; color: var(--n-800); }
    .cr__vide td { height: 1.6rem; }
    .cr__aide { margin: 0; font-size: 0.8rem; color: var(--n-500); }
    .cr__refus { margin: 0; color: var(--danger-text); }
  `,
})
export class CanevasRapportDoc {
  private readonly dossiers = inject(DossierService);

  readonly idDossier = input.required<number>();
  readonly canevas = signal<CanevasRapport | null>(null);
  readonly sections = computed(() => this.canevas()?.sections ?? []);
  readonly chargement = signal(true);
  readonly refus = signal<string | null>(null);

  constructor() {
    effect((nettoyer) => {
      const id = this.idDossier();
      this.chargement.set(true);
      this.refus.set(null);
      const abonnement = this.dossiers.canevasRapport(id).subscribe({
        next: (c) => { this.canevas.set(c); this.chargement.set(false); },
        error: (e: ApiError) => {
          this.canevas.set(null);
          this.chargement.set(false);
          this.refus.set(corpsErreur<{ message?: string }>(e)?.message
            ?? 'Le canevas n’est pas disponible : il faut une fiche DAO validée, hors contrat-cadre.');
        },
      });
      nettoyer(() => abonnement.unsubscribe());
    });
  }

  libellePartie(s: CanevasSection): string { return s.partie ? LIBELLES_PARTIE[s.partie] : ''; }

  /** Les rangées vierges, à numéroter pour le suivi. */
  vides(n: number): number[] { return Array.from({ length: Math.max(0, n) }, (_, i) => i); }
}
