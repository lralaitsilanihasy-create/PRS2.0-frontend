import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DossierContenuStore } from './dossier-contenu.store';

/**
 * Identité d'un dossier : entité, localité, référence PRMP, exercice, signataire, mise à jour.
 * Lit le `DossierContenuStore` de l'hôte. Le repli (bouton « Afficher l'en-tête ») et la place du bloc
 * dans la mise en page appartiennent à l'hôte : il monte ce bloc, ou non, et lui pose sa classe.
 */
@Component({
  selector: 'app-dossier-identite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ⚠️ 2026-08-14 (demande user) — en-tête ÉPURÉ : seuls Entité contractante, Localité,
         Référence PRMP, Exercice, Signataire et Mise à jour restent (Type est déjà en chip,
         la date réf. dans le sous-titre ; PRMP d'attribution/dates de signature retirés). -->
    <div class="dc-meta">
      <div class="dc-meta-row">
        <span class="dc-meta-label">Entité contractante</span>
        <span class="dc-meta-value">{{ contenu.entiteLabel() }}</span>
      </div>
      <div class="dc-meta-row">
        <span class="dc-meta-label">Localité</span>
        <span class="dc-meta-value">{{ contenu.localiteLabel() }}</span>
      </div>
      @if (contenu.ppm(); as p) {
        @if (contenu.montrerReferencePpm()) {
          <div class="dc-meta-row">
            <span class="dc-meta-label">Référence PRMP</span>
            <span class="dc-meta-value">{{ p.reference || '—' }}</span>
          </div>
        }
        <div class="dc-meta-row">
          <span class="dc-meta-label">Exercice</span>
          <span class="dc-meta-value">{{ p.exercice }}</span>
        </div>
        <div class="dc-meta-row">
          <span class="dc-meta-label">Signataire</span>
          <span class="dc-meta-value">{{ p.signataire || '—' }}</span>
        </div>
        @if (p.numMaj != null) {
          <div class="dc-meta-row">
            <span class="dc-meta-label">Mise à jour</span>
            <span class="dc-meta-value">n° {{ p.numMaj }}{{ p.dateMaj ? ' · ' + p.dateMaj : '' }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .dc-meta { background: var(--n-50); border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-meta-row { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-bottom: 0.5px solid var(--n-200); }
    .dc-meta-row:last-child { border-bottom: none; }
    .dc-meta-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); width: 110px; flex-shrink: 0; }
    .dc-meta-value { font-size: 12.5px; font-weight: 600; color: var(--n-800); }
  `,
})
export class DossierIdentite {
  protected readonly contenu = inject(DossierContenuStore);
}
