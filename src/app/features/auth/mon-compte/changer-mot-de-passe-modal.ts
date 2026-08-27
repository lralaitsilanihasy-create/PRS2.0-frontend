import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { ChangePasswordRequest } from '../../../models';
import { MonCompteService } from '../../../services';
import { fermerAvecAnimation } from '../../../shared/a11y/fermeture-animee';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';

/** Longueur minimale imposée par le backend (`ChangePasswordRequest.@Size(min = 8, max = 72)`). */
const MIN_LONGUEUR = 8;
const MAX_LONGUEUR = 72;

/**
 * « Changer mon mot de passe » — action de l'utilisateur connecté sur son propre compte,
 * tous profils. Passe par `POST /api/mon-compte/changer-mot-de-passe` (l'ancien mot de passe est
 * vérifié serveur ; 400 si incorrect ou identique au nouveau).
 *
 * La confirmation est un garde-fou **de saisie**, purement local : le contrat n'a que deux champs,
 * elle n'est jamais envoyée. Les 400 par champ du serveur (`fieldErrors`) s'affichent sous le champ
 * concerné, comme dans les autres formulaires du dépôt.
 */
@Component({
  selector: 'app-changer-mot-de-passe-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModaleDirective],
  template: `
    <div class="modal-backdrop" [class.closing]="closing()">
      <div
        class="modal cnm-form cmp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Changer mon mot de passe"
        appModale
        appModaleClicExterieur
        (appModaleFermer)="fermerAnime()"
      >
        <header class="modal-header-plain">
          <span class="modal-title">Changer mon mot de passe</span>
          <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="fermerAnime()">✕</button>
        </header>

        <form [formGroup]="form" (ngSubmit)="soumettre()" novalidate>
          <div class="modal-body">
            @if (erreur(); as e) { <div class="cmp-erreur" role="alert">{{ e }}</div> }

            <label class="form-group">
              <span class="form-label">Mot de passe actuel</span>
              <input
                class="form-control"
                type="password"
                autocomplete="current-password"
                formControlName="ancienMotDePasse"
                [class.error]="invalide('ancienMotDePasse')"
              />
              @if (touche('ancienMotDePasse') && form.controls.ancienMotDePasse.hasError('required')) {
                <span class="form-error">Obligatoire.</span>
              }
              @if (erreurChamp('ancienMotDePasse'); as m) { <span class="form-error">{{ m }}</span> }
            </label>

            <label class="form-group">
              <span class="form-label">Nouveau mot de passe ({{ minLongueur }} caractères minimum)</span>
              <input
                class="form-control"
                type="password"
                autocomplete="new-password"
                formControlName="nouveauMotDePasse"
                [class.error]="invalide('nouveauMotDePasse')"
              />
              @if (touche('nouveauMotDePasse') && form.controls.nouveauMotDePasse.hasError('required')) {
                <span class="form-error">Obligatoire.</span>
              }
              @if (touche('nouveauMotDePasse') && form.controls.nouveauMotDePasse.hasError('minlength')) {
                <span class="form-error">{{ minLongueur }} caractères minimum.</span>
              }
              @if (erreurChamp('nouveauMotDePasse'); as m) { <span class="form-error">{{ m }}</span> }
            </label>

            <label class="form-group">
              <span class="form-label">Confirmer le nouveau mot de passe</span>
              <input
                class="form-control"
                type="password"
                autocomplete="new-password"
                formControlName="confirmation"
                [class.error]="confirmationDivergente()"
              />
              @if (confirmationDivergente()) {
                <span class="form-error">Les deux saisies diffèrent.</span>
              }
            </label>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerAnime()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="envoi()">
              {{ envoi() ? 'Enregistrement…' : 'Changer le mot de passe' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
  styles: `
    .cmp-modal { max-width: 28rem; }
    .cmp-erreur { background: #FEF2F2; color: #9B1C1C; border: 1px solid #FEE2E2; border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: var(--text-sm); margin-bottom: 0.5rem; }
  `,
})
export class ChangerMotDePasseModal {
  readonly ferme = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(MonCompteService);
  private readonly toast = inject(ToastService);

  protected readonly minLongueur = MIN_LONGUEUR;

  readonly form = this.fb.nonNullable.group({
    ancienMotDePasse: ['', Validators.required],
    nouveauMotDePasse: [
      '',
      [Validators.required, Validators.minLength(MIN_LONGUEUR), Validators.maxLength(MAX_LONGUEUR)],
    ],
    confirmation: ['', Validators.required],
  });

  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  private readonly erreursChamps = signal<Record<string, string>>({});

  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closing = signal(false);
  fermerAnime(): void {
    fermerAvecAnimation(this.closing, () => this.ferme.emit());
  }

  touche(champ: 'ancienMotDePasse' | 'nouveauMotDePasse' | 'confirmation'): boolean {
    return this.form.controls[champ].touched;
  }
  invalide(champ: 'ancienMotDePasse' | 'nouveauMotDePasse' | 'confirmation'): boolean {
    const c = this.form.controls[champ];
    return (c.touched && c.invalid) || !!this.erreursChamps()[champ];
  }
  erreurChamp(champ: string): string | undefined {
    return this.erreursChamps()[champ];
  }
  /** Confirmation saisie et différente du nouveau mot de passe (contrôle local uniquement). */
  confirmationDivergente(): boolean {
    const { nouveauMotDePasse, confirmation } = this.form.controls;
    return confirmation.touched && !!confirmation.value && confirmation.value !== nouveauMotDePasse.value;
  }

  soumettre(): void {
    this.form.markAllAsTouched();
    this.erreur.set(null);
    this.erreursChamps.set({});
    if (this.form.invalid || this.confirmationDivergente()) {
      return;
    }
    const { ancienMotDePasse, nouveauMotDePasse } = this.form.getRawValue();
    const corps: ChangePasswordRequest = { ancienMotDePasse, nouveauMotDePasse };
    this.envoi.set(true);
    this.service.changerMotDePasse(corps).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.toast.success(r.message || 'Mot de passe modifié.');
        this.fermerAnime();
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        if (e.fieldErrors && Object.keys(e.fieldErrors).length) {
          this.erreursChamps.set(e.fieldErrors);
        } else {
          this.erreur.set(e.message || 'Changement impossible.');
        }
      },
    });
  }
}
