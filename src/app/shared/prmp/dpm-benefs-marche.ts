import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Compte, Marche, SoaBeneficiaire } from '../../models';
import { ModaleDirective } from '../a11y/modale.directive';

/**
 * Sous-dialogue d'édition des **services bénéficiaires** d'un marché du détail PPM.
 *
 * Le formulaire est construit et détenu par l'hôte (`detail-ppm-modal`), qui seul connaît l'état
 * d'origine et sait le réconcilier avec le serveur (créations / mises à jour / suppressions).
 * Ce composant n'en rend que la saisie et signale les gestes : ajouter, retirer, annuler,
 * enregistrer. Extrait sans changement de comportement.
 */
@Component({
  selector: 'app-dpm-benefs-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModaleDirective],
  template: `
    <div class="dpm__overlay">
      <form class="dpm cnm-card" [formGroup]="formulaire()" (ngSubmit)="enregistrer.emit()" role="dialog" aria-modal="true" aria-label="Services bénéficiaires du marché" appModale appModaleClicExterieur (appModaleFermer)="annuler.emit()" novalidate>
        <header class="dpm__head">
          <h2 class="dpm__title">Services bénéficiaires — {{ marche().designationMarche || 'Marché #' + marche().idDetail }}</h2>
          <button type="button" class="dpm__close" aria-label="Fermer" (click)="annuler.emit()">&times;</button>
        </header>
        <div class="dpm__body dpm__body--pad">
          @for (ctrl of lignes(); track $index) {
            <div class="dpm-benef-edit-row" [formGroup]="ctrl">
              <select class="form-control" formControlName="soaCode" aria-label="Service bénéficiaire">
                <option [ngValue]="null">— Service bénéficiaire —</option>
                @for (s of soaList(); track s.soaCode) {
                  <option [ngValue]="s.soaCode">{{ s.soaCode }}{{ s.libelle ? ' · ' + s.libelle : '' }}</option>
                }
              </select>
              <select class="form-control" formControlName="numCompte" aria-label="Compte">
                <option [ngValue]="null">— Compte —</option>
                @for (c of comptes(); track c.numCompte) {
                  <option [ngValue]="c.numCompte">{{ c.numCompte }}{{ c.libelle ? ' · ' + c.libelle : '' }}</option>
                }
              </select>
              <input class="form-control" type="number" formControlName="ancMontBenef" placeholder="Montant" aria-label="Montant" />
              <input class="form-control" type="number" formControlName="nouvMontBenef" placeholder="Nouveau montant" aria-label="Nouveau montant" />
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirer.emit($index)" aria-label="Retirer">✕</button>
            </div>
          } @empty {
            <p class="dpm__info">Aucun bénéficiaire. Ajoutez-en un.</p>
          }
          <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ajouter.emit()">+ Ajouter un bénéficiaire</button>
        </div>
        <footer class="dpm__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler.emit()">Annuler</button>
          <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="busy()">Enregistrer</button>
        </footer>
      </form>
    </div>
  `,
  styleUrl: './dpm-benefs-marche.scss',
})
export class DpmBenefsMarche {
  readonly marche = input.required<Marche>();
  /** Formulaire détenu par l'hôte : un `FormArray` « lignes » de groupes bénéficiaire. */
  readonly formulaire = input.required<FormGroup>();
  readonly soaList = input.required<readonly SoaBeneficiaire[]>();
  readonly comptes = input.required<readonly Compte[]>();
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
