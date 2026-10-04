import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CandidatInscriptionService } from '../../services';

/** La politique des comptes internes, reprise par le serveur : 8 à 72 caractères, une lettre et un chiffre. */
const MOT_DE_PASSE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** La confirmation est un garde-fou de saisie, purement local : le contrat n'a qu'un champ, elle n'est jamais envoyée. */
function memeMotDePasse(groupe: AbstractControl): ValidationErrors | null {
  const a = groupe.get('motDePasse')?.value;
  const b = groupe.get('confirmation')?.value;
  return a && b && a !== b ? { confirmation: true } : null;
}

/**
 * Inscription d'un CANDIDAT (`POST /api/candidats/inscription`, public, §B2) : une entreprise portée par une personne.
 * Le compte naît `A_CONFIRMER` ; le code reçu par courriel le confirme sur l'écran suivant. Le téléphone est déclaré,
 * et confirmé seulement si l'Administrateur l'exige (aucune passerelle SMS n'est raccordée aujourd'hui).
 */
@Component({
  selector: 'app-inscription-candidat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="ic">
      <header class="page-header">
        <div class="page-subtitle">Espace candidat</div>
        <h1 class="page-title">Créer un compte candidat</h1>
      </header>
      <p class="page-role">
        Un compte par entreprise, porté par une personne. Vous recevrez un code par courriel pour le confirmer ; vous
        déclarerez ensuite votre entreprise (NIF, STAT, RCS) une fois pour toutes.
      </p>

      <form class="card cnm-form ic__form" [formGroup]="form" (ngSubmit)="soumettre()" novalidate aria-label="Inscription du candidat">
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Nom</span>
            <input class="form-control" type="text" formControlName="nom" autocomplete="family-name" required [class.error]="invalide('nom')" />
            @if (manque('nom')) { <span class="form-error">Obligatoire.</span> }
            @if (erreurChamp('nom'); as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Prénom</span>
            <input class="form-control" type="text" formControlName="prenom" autocomplete="given-name" required [class.error]="invalide('prenom')" />
            @if (manque('prenom')) { <span class="form-error">Obligatoire.</span> }
            @if (erreurChamp('prenom'); as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Adresse électronique (votre identifiant de connexion)</span>
            <input class="form-control" type="email" formControlName="email" autocomplete="email" required [class.error]="invalide('email')" />
            @if (manque('email')) { <span class="form-error">Obligatoire.</span> }
            @if (touche('email') && form.controls.email.hasError('email')) { <span class="form-error">Adresse invalide.</span> }
            @if (erreurChamp('email'); as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Téléphone</span>
            <input class="form-control" type="tel" formControlName="telephone" autocomplete="tel" required [class.error]="invalide('telephone')" />
            @if (manque('telephone')) { <span class="form-error">Obligatoire.</span> }
            @if (erreurChamp('telephone'); as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Mot de passe (8 à 72 caractères, une lettre et un chiffre)</span>
            <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password" required [class.error]="invalide('motDePasse')" />
            @if (manque('motDePasse')) { <span class="form-error">Obligatoire.</span> }
            @if (touche('motDePasse') && form.controls.motDePasse.hasError('pattern')) { <span class="form-error">8 à 72 caractères, avec au moins une lettre et un chiffre.</span> }
            @if (erreurChamp('motDePasse'); as m) { <span class="form-error">{{ m }}</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Confirmer le mot de passe</span>
            <input class="form-control" type="password" formControlName="confirmation" autocomplete="new-password" required [class.error]="touche('confirmation') && form.hasError('confirmation')" />
            @if (touche('confirmation') && form.hasError('confirmation')) { <span class="form-error">Les deux mots de passe diffèrent.</span> }
          </label>
        </div>

        <div class="ic__pied">
          <button type="submit" class="btn btn-primary" [disabled]="envoi()">{{ envoi() ? 'Création…' : 'Créer mon compte' }}</button>
          <span class="text-sm text-muted">Déjà inscrit ? <a routerLink="/login" [queryParams]="{ returnUrl: '/candidat' }">Se connecter</a> · Code reçu ? <a routerLink="/candidat/confirmation">Confirmer mon compte</a></span>
        </div>
      </form>
    </div>
  `,
  styles: `
    .ic { max-width: 56rem; }
    .ic__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .ic__pied { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  `,
})
export class InscriptionCandidat {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CandidatInscriptionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group(
    {
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      motDePasse: ['', [Validators.required, Validators.pattern(MOT_DE_PASSE)]],
      confirmation: ['', Validators.required],
    },
    { validators: memeMotDePasse },
  );

  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly erreursChamps = signal<Record<string, string>>({});

  constructor() {
    inject(DOCUMENT).title = 'Créer un compte candidat — PRS 2.0';
  }

  touche(champ: keyof typeof this.form.controls): boolean {
    return this.form.controls[champ].touched;
  }

  manque(champ: keyof typeof this.form.controls): boolean {
    return this.touche(champ) && this.form.controls[champ].hasError('required');
  }

  invalide(champ: keyof typeof this.form.controls): boolean {
    return (this.touche(champ) && this.form.controls[champ].invalid) || !!this.erreursChamps()[champ];
  }

  erreurChamp(champ: string): string | undefined {
    return this.erreursChamps()[champ];
  }

  soumettre(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.erreursChamps.set({});
    const { nom, prenom, email, telephone, motDePasse } = this.form.getRawValue();
    this.service.inscrire({ nom, prenom, email: email.trim(), telephone, motDePasse }).subscribe({
      next: () => {
        this.toast.success('Votre compte est créé. Saisissez maintenant le code reçu par courriel.', 'Compte créé');
        void this.router.navigate(['/candidat', 'confirmation'], { queryParams: { email: email.trim() } });
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        if (e.status === 400 && e.fieldErrors) {
          this.erreursChamps.set(e.fieldErrors);
          return;
        }
        if (e.status === 409 && e.code === 'EMAIL_EXISTANT') {
          this.erreursChamps.set({ email: e.message || 'Cette adresse est déjà utilisée par un compte.' });
          return;
        }
        // 429 (inscriptions du jour épuisées pour cette connexion), 0 (réseau) : le message du serveur, ou un repli.
        this.erreur.set(e.message || "L'inscription n'a pas pu être enregistrée. Réessayez dans un moment.");
      },
    });
  }
}
