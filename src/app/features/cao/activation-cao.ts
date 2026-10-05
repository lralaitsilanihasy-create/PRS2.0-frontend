import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CaoEspaceService, DepositaireService } from '../../services';

/**
 * ⚠️ V71 (05/10) — le même écran sert au dépositaire de la part de secours (`/depositaire/activation`, route
 * `data.variante = 'depositaire'`) : même code à six chiffres, même politique de mot de passe, autre service et autres mots.
 */
const VARIANTES = {
  cao: {
    sousTitre: "Commission d'appel d'offres",
    role: "Vous avez été désigné membre d'une commission d'appel d'offres.",
    qui: 'la PRMP',
    racine: '/cao',
    titre: 'Commission d’appel d’offres',
    autre: { libelle: 'Vous êtes dépositaire de la part de secours ?', lien: '/depositaire/activation' },
  },
  depositaire: {
    sousTitre: 'Dépositaire de la part de secours',
    role: "Vous avez été désigné dépositaire de la part de secours d'une procédure.",
    qui: 'le responsable de la procédure',
    racine: '/depositaire',
    titre: 'Dépositaire',
    autre: { libelle: 'Vous êtes membre d’une commission d’appel d’offres ?', lien: '/cao/activation' },
  },
} as const;

const CODE = /^\d{6}$/;
/** La politique des comptes internes, reprise par le serveur : 8 à 72 caractères, une lettre et un chiffre. */
const MOT_DE_PASSE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

function memeMotDePasse(groupe: AbstractControl): ValidationErrors | null {
  const a = groupe.get('motDePasse')?.value;
  const b = groupe.get('confirmation')?.value;
  return a && b && a !== b ? { confirmation: true } : null;
}

/**
 * Activation du compte d'un membre de la commission d'appel d'offres (`POST /api/cao/activation`, public, lot 2a §B2). La
 * PRMP l'a désigné ; le courriel d'invitation porte un code à six chiffres, valable **72 heures**, et le lien de cet
 * écran. Le membre choisit ici son mot de passe — le compte n'en avait pas — puis se connecte par son adresse.
 */
@Component({
  selector: 'app-activation-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="ac">
      <header class="page-header">
        <div class="page-subtitle">{{ v.sousTitre }}</div>
        <h1 class="page-title">Activer mon compte</h1>
      </header>
      <p class="page-role">
        {{ v.role }} Saisissez le code reçu par courriel — il vaut
        soixante-douze heures — et choisissez votre mot de passe. Vous vous connecterez ensuite avec votre adresse.
      </p>

      <form class="card cnm-form ac__form" [formGroup]="form" (ngSubmit)="activer()" novalidate aria-label="Activation du compte">
        @if (erreur(); as e) {
          <div class="alert alert-danger" role="alert">
            <span>{{ e }}</span>
            @if (autreEspace()) { <span> {{ v.autre.libelle }} <a [routerLink]="v.autre.lien" [queryParams]="{ email: form.controls.email.value }">Activez votre compte ici</a>.</span> }
          </div>
        }

        <label class="form-group">
          <span class="form-label">Adresse électronique</span>
          <input class="form-control" type="email" formControlName="email" autocomplete="email" required [class.error]="touche('email') && form.controls.email.invalid" />
          @if (touche('email') && form.controls.email.invalid) { <span class="form-error">Adresse obligatoire.</span> }
        </label>
        <label class="form-group">
          <span class="form-label">Code reçu par courriel</span>
          <input class="form-control ac__code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" formControlName="code" required [class.error]="touche('code') && form.controls.code.invalid" />
          @if (touche('code') && form.controls.code.invalid) { <span class="form-error">Six chiffres.</span> }
        </label>
        <label class="form-group">
          <span class="form-label">Mot de passe (8 à 72 caractères, une lettre et un chiffre)</span>
          <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password" required [class.error]="touche('motDePasse') && form.controls.motDePasse.invalid || !!erreurMotDePasse()" />
          @if (touche('motDePasse') && form.controls.motDePasse.hasError('required')) { <span class="form-error">Obligatoire.</span> }
          @if (touche('motDePasse') && form.controls.motDePasse.hasError('pattern')) { <span class="form-error">8 à 72 caractères, avec au moins une lettre et un chiffre.</span> }
          @if (erreurMotDePasse(); as m) { <span class="form-error">{{ m }}</span> }
        </label>
        <label class="form-group">
          <span class="form-label">Confirmer le mot de passe</span>
          <input class="form-control" type="password" formControlName="confirmation" autocomplete="new-password" required [class.error]="touche('confirmation') && form.hasError('confirmation')" />
          @if (touche('confirmation') && form.hasError('confirmation')) { <span class="form-error">Les deux mots de passe diffèrent.</span> }
        </label>

        <div class="ac__pied">
          <button type="submit" class="btn btn-primary" [disabled]="envoi()">{{ envoi() ? 'Activation…' : 'Activer mon compte' }}</button>
          <span class="text-sm text-muted">Code périmé ? Demandez à {{ v.qui }} de renvoyer l'invitation. Compte déjà actif ? <a routerLink="/login" [queryParams]="{ returnUrl: v.racine }">Se connecter</a></span>
        </div>
      </form>
    </div>
  `,
  styles: `
    .ac { max-width: 36rem; }
    .ac__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .ac__code { max-width: 10rem; letter-spacing: 0.2em; font-variant-numeric: tabular-nums; }
    .ac__pied { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem; }
  `,
})
export class ActivationCao {
  private readonly fb = inject(FormBuilder);
  private readonly cao = inject(CaoEspaceService);
  private readonly depositaire = inject(DepositaireService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly v = VARIANTES[this.route.snapshot.data['variante'] === 'depositaire' ? 'depositaire' : 'cao'];

  readonly form = this.fb.nonNullable.group(
    {
      email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.pattern(CODE)]],
      motDePasse: ['', [Validators.required, Validators.pattern(MOT_DE_PASSE)]],
      confirmation: ['', Validators.required],
    },
    { validators: memeMotDePasse },
  );

  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly erreurMotDePasse = signal<string | null>(null);
  /** Après un 404 : l'invitation vient peut-être de l'autre espace (membre de CAO ou dépositaire). */
  readonly autreEspace = signal(false);

  constructor() {
    inject(DOCUMENT).title = `Activer mon compte — ${this.v.titre} — PRS 2.0`;
  }

  touche(champ: keyof typeof this.form.controls): boolean {
    return this.form.controls[champ].touched;
  }

  activer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    this.erreurMotDePasse.set(null);
    const { email, code, motDePasse } = this.form.getRawValue();
    const service = this.v.racine === '/depositaire' ? this.depositaire : this.cao;
    service.activer({ email: email.trim(), code, motDePasse }).subscribe({
      next: () => {
        this.toast.success('Votre compte est actif. Connectez-vous avec votre adresse électronique.', 'C’est fait');
        void this.router.navigate(['/login'], { queryParams: { login: email.trim(), returnUrl: this.v.racine } });
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        if (e.status === 400 && e.code === 'CODE_EXPIRE') this.erreur.set(`Ce code a expiré (soixante-douze heures) : demandez à ${this.v.qui} de renvoyer l’invitation.`);
        else if (e.status === 400 && e.code === 'CODE_INVALIDE') this.erreur.set('Code incorrect. Vérifiez les six chiffres reçus par courriel.');
        else if (e.status === 400 && e.fieldErrors?.['motDePasse']) this.erreurMotDePasse.set(e.fieldErrors['motDePasse']);
        else if (e.status === 404) {
          this.erreur.set('Aucune invitation pour cette adresse ici. Vérifiez l’adresse à laquelle le courriel a été envoyé.');
          this.autreEspace.set(true);
        }
        else if (e.status === 429) this.erreur.set(`Trop d’essais : ce code ne vaut plus. Demandez à ${this.v.qui} de renvoyer l’invitation.`);
        else this.erreur.set(e.message || "L'activation n'a pas abouti. Réessayez dans un moment.");
      },
    });
  }
}
