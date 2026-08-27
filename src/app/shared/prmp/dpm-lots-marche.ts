import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Marche } from '../../models';
import { ModaleDirective } from '../a11y/modale.directive';

/**
 * Sous-dialogue d'édition des **lots** (allotissement) d'un marché du détail PPM.
 *
 * Même partage des rôles que pour les bénéficiaires : le formulaire et la réconciliation avec le
 * serveur restent chez l'hôte (`detail-ppm-modal`), ce composant en rend la saisie et signale les
 * gestes. Extrait sans changement de comportement.
 */
@Component({
  selector: 'app-dpm-lots-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModaleDirective],
  template: `
    <div class="dpm__overlay">
      <form class="dpm cnm-card" [formGroup]="formulaire()" (ngSubmit)="enregistrer.emit()" role="dialog" aria-modal="true" aria-label="Lots du marché" appModale appModaleClicExterieur (appModaleFermer)="annuler.emit()" novalidate>
        <header class="dpm__head">
          <h2 class="dpm__title">Lots (allotissement) — {{ marche().designationMarche || 'Marché #' + marche().idDetail }}</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="annuler.emit()">&times;</button>
        </header>
        <div class="dpm__body dpm__body--pad">
          @for (ctrl of lignes(); track $index) {
            <div class="dpm-benef-edit-row" [formGroup]="ctrl">
              <input class="form-control" type="text" formControlName="designationLot" placeholder="Désignation du lot *" aria-label="Désignation du lot" />
              <input class="form-control" type="number" formControlName="montLot" placeholder="Montant" aria-label="Montant" />
              <input class="form-control" type="number" formControlName="qteLot" placeholder="Quantité" aria-label="Quantité" />
              <input class="form-control" type="text" formControlName="uniteLot" placeholder="Unité" aria-label="Unité" />
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirer.emit($index)" aria-label="Retirer">✕</button>
            </div>
          } @empty {
            <p class="dpm__info">Aucun lot. Ajoutez-en un pour allotir ce marché.</p>
          }
          <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ajouter.emit()">+ Ajouter un lot</button>
        </div>
        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler.emit()">Annuler</button>
          <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="busy()">Enregistrer</button>
        </footer>
      </form>
    </div>
  `,
  styleUrl: './dpm-lots-marche.scss',
})
export class DpmLotsMarche {
  readonly marche = input.required<Marche>();
  /** Formulaire détenu par l'hôte : un `FormArray` « lignes » de groupes lot. */
  readonly formulaire = input.required<FormGroup>();
  /** Enregistrement en cours côté hôte. */
  readonly busy = input(false);

  readonly ajouter = output<void>();
  /** Index de la ligne à retirer. */
  readonly retirer = output<number>();
  readonly annuler = output<void>();
  readonly enregistrer = output<void>();

  lignes(): FormGroup[] {
    return (this.formulaire().get('lignes') as FormArray).controls as FormGroup[];
  }
}
