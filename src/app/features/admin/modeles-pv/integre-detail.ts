import { UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { telechargerBlob } from '../../../core/securite/fichiers-surs';
import { ModeleIntegre } from '../../../models';
import { ModelePvService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { ApercuVersion } from './apercu-version';
import { LIBELLES_NATURE, grilleFichiers, phrasesRegle } from './modeles-pv-libelles';

/**
 * ⚠️ 21/10 (demande « modeles-pv-integres-consultation ») — un modèle intégré au backend, consulté dans une modale : sa règle en
 * liste, ses fichiers en grille (avis × AGPM × commission pour le PV du plan ; commission pour la lettre), chacun téléchargeable
 * tel que livré, puis l'aperçu sur un dossier réel, qui nomme le fichier choisi par la règle de production.
 */
@Component({
  selector: 'app-integre-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, ModaleDirective, ApercuVersion],
  template: `
    @let m = modele();
    <div class="modal-backdrop">
      <div class="modal modal-xl itd" role="dialog" aria-modal="true" [attr.aria-label]="'Modèle intégré : ' + m.libelle" appModale (appModaleFermer)="fermer.emit()">
        <div class="modal-header itd__tete">
          <div>
            <p class="itd__sur">MODÈLE INTÉGRÉ À L’APPLICATION · {{ natures[m.nature] | uppercase }}</p>
            <h2 class="modal-title">{{ m.libelle }}</h2>
            <p class="itd__puces">
              @if (m.enService) { <span class="badge badge-success">En service</span> } @else { <span class="badge badge-neutral">Remplacé</span> }
              <span class="itd__puce">{{ m.fichiers.length }} fichiers Word</span>
              <span class="itd__puce">{{ m.sousTypes ? m.sousTypes.join(' · ') : 'tous les sous-types' }}</span>
            </p>
          </div>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="fermer.emit()">✕</button>
        </div>
        <div class="modal-body itd__corps">
          <section class="itd__bloc">
            <h3 class="itd__titre">Quand il sert</h3>
            <ul class="itd__regle">
              @for (p of phrases(); track $index) { <li>{{ p }}</li> }
              <li>Livré avec le serveur : il ne se dépose ni ne se modifie ici. Il sert tant qu’aucun modèle de cet écran ne produit les PV.</li>
            </ul>
          </section>

          <section class="itd__bloc">
            <h3 class="itd__titre">Fichiers — cliquez pour télécharger le Word</h3>
            @if (grille(); as g) {
              <div class="itd__grille-cadre">
                <table class="itd__grille">
                  <thead>
                    <tr><th scope="col"><span class="cnm-sr-only">Avis</span></th>@for (c of g.colonnes; track c) { <th scope="col">{{ c }}</th> }</tr>
                  </thead>
                  <tbody>
                    @for (l of g.lignes; track l.libelle) {
                      <tr>
                        <th scope="row">{{ l.libelle }}</th>
                        @for (f of l.cellules; track $index) {
                          <td>
                            @if (f) {
                              <button type="button" class="itd__fichier" [attr.aria-label]="'Télécharger ' + f" [title]="f" (click)="telecharger(f)">
                                <span aria-hidden="true">⤓</span> Word
                              </button>
                            } @else { <span class="text-muted">—</span> }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="itd__liste">
                @for (f of m.fichiers; track f) { <button type="button" class="itd__fichier" (click)="telecharger(f)">{{ f }}</button> }
              </p>
            }
          </section>

          <section class="itd__bloc">
            <h3 class="itd__titre">Rendu sur un dossier réel</h3>
            <app-apercu-version [codeIntegre]="m.code" [codeModele]="m.code" [avecAvis]="m.nature === 'PV'" [sousTypesServis]="m.sousTypes ?? []" />
          </section>
        </div>
      </div>
    </div>
  `,
  styles: `
    .itd__tete { align-items: flex-start; }
    .itd__sur { margin: 0 0 0.2rem; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; color: var(--primary); }
    .itd__puces { margin: 0.4rem 0 0; display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
    .itd__puce { padding: 0.05rem 0.55rem; border-radius: 999px; background: var(--page-bg); color: var(--text-muted); font-size: 0.78rem; }
    .itd__corps { display: flex; flex-direction: column; gap: 1.1rem; }
    .itd__bloc { display: flex; flex-direction: column; gap: 0.5rem; }
    .itd__titre { margin: 0; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--primary); }
    .itd__regle { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; color: var(--text); font-size: 0.9rem; }
    .itd__grille-cadre { overflow-x: auto; }
    .itd__grille { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .itd__grille th, .itd__grille td { border: 1px solid var(--border); padding: 0.45rem 0.6rem; text-align: center; white-space: nowrap; }
    .itd__grille thead th { background: var(--reco-bg); color: var(--primary); font-size: 0.75rem; }
    .itd__grille tbody th { text-align: left; color: var(--text); background: var(--page-bg); }
    .itd__fichier { border: 1px solid var(--reco-border); background: var(--card-bg); color: var(--primary); border-radius: 6px; padding: 0.15rem 0.55rem;
      font-size: 0.8rem; font-weight: 500; cursor: pointer; }
    .itd__fichier:hover { background: var(--reco-bg); }
    .itd__fichier:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .itd__liste { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; }
  `,
})
export class IntegreDetail {
  private readonly service = inject(ModelePvService);
  private readonly toast = inject(ToastService);

  readonly modele = input.required<ModeleIntegre>();
  readonly fermer = output<void>();

  readonly natures = LIBELLES_NATURE;
  readonly grille = computed(() => grilleFichiers(this.modele().fichiers));
  readonly phrases = computed(() => phrasesRegle(this.modele().regle));

  telecharger(nom: string): void {
    this.service.fichierIntegre(this.modele().code, nom).subscribe({
      next: (blob) => telechargerBlob(blob, nom),
      error: (e: ApiError) => this.toast.error(e.message || 'Le fichier n’a pas pu être téléchargé.'),
    });
  }
}
