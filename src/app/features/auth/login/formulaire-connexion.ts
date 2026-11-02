import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiError } from '../../../core/errors/api-error';
import { espaceExterneDe } from '../../../core/auth/auth.guard';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/notifications/toast.service';

/**
 * ⚠️ 01/11 (pilote, maquette « Portail public », variante A) — le FORMULAIRE de connexion, seul point d'entrée de
 * l'authentification, partagé par l'écran `/login` et le portail public (`/accueil/:audience`, où l'on se connecte sans détour).
 * Mêmes champs, mêmes messages, mêmes suites qu'avant l'extraction. Les liens du bas (créer un compte…) viennent de l'hôte.
 */
@Component({
  selector: 'app-formulaire-connexion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 class="login-form__title" [id]="idTitre()">{{ titre() }}</h2>
      @if (sousTitre()) { <p class="login-form__sous">{{ sousTitre() }}</p> }

      @if (errorMessage()) {
        <div class="login-form__error" role="alert">{{ errorMessage() }}</div>
      }

      <!-- Libellé visible au-dessus du champ : le champ reste nommé quand le texte de substitution disparaît (AUDIT.md A7). -->
      <label class="login-field" [class.login-field--invalid]="form.controls.login.touched && form.controls.login.invalid">
        <span class="login-field__libelle">Identifiant ou adresse électronique</span>
        <!-- Un candidat (soumission en ligne, 04/10) se connecte par son adresse électronique ; un agent par son matricule. -->
        <input
          type="text"
          class="login-field__input"
          autocomplete="username"
          formControlName="login"
          required
          [id]="idTitre() + '-login'"
          [attr.aria-invalid]="form.controls.login.touched && form.controls.login.invalid ? 'true' : null"
          [attr.aria-describedby]="form.controls.login.touched && form.controls.login.hasError('required') ? idTitre() + '-login-erreur' : null"
        />
      </label>
      @if (form.controls.login.touched && form.controls.login.hasError('required')) {
        <span class="login-form__hint" [id]="idTitre() + '-login-erreur'">L'identifiant est obligatoire.</span>
      }

      <label class="login-field" [class.login-field--invalid]="form.controls.motDePasse.touched && form.controls.motDePasse.invalid">
        <span class="login-field__libelle">Mot de passe</span>
        <input
          type="password"
          class="login-field__input"
          autocomplete="current-password"
          formControlName="motDePasse"
          required
          [attr.aria-invalid]="form.controls.motDePasse.touched && form.controls.motDePasse.invalid ? 'true' : null"
          [attr.aria-describedby]="form.controls.motDePasse.touched && form.controls.motDePasse.hasError('required') ? idTitre() + '-mdp-erreur' : null"
        />
      </label>
      @if (form.controls.motDePasse.touched && form.controls.motDePasse.hasError('required')) {
        <span class="login-form__hint" [id]="idTitre() + '-mdp-erreur'">Le mot de passe est obligatoire.</span>
      }

      <div class="login-form__row">
        <label class="login-form__remember">
          <input type="checkbox" formControlName="seSouvenir" /><span>Se souvenir de moi</span>
        </label>
        <button type="button" class="login-form__forgot" (click)="motDePasseOublie()">Mot de passe oublié&nbsp;?</button>
      </div>

      <button type="submit" class="btn login-form__submit" [class.btn-primary]="accent() === 'defaut'" [class.login-form__submit--or]="accent() === 'or'" [disabled]="submitting()">
        {{ submitting() ? 'Connexion…' : 'Se connecter' }}
      </button>

      <ng-content />
    </form>
  `,
  styles: `
    :host { display: block; }
    .login-form { width: 100%; display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    .login-form__title { margin: 0; font-size: 17px; font-weight: 500; color: var(--texte); }
    .login-form__sous { margin: -6px 0 0; font-size: 12px; color: var(--texte-secondaire); }
    .login-form__error { padding: 8px 12px; border-radius: 6px; background: var(--retard-fond); color: var(--retard-texte); }
    .login-form__hint { margin-top: -6px; font-size: 12px; color: var(--retard-texte); }
    .login-form__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .login-form__remember { display: inline-flex; align-items: center; gap: 6px; color: var(--texte-secondaire); cursor: pointer; }
    .login-form__remember input { accent-color: var(--bouton-principal); }
    .login-form__forgot {
      padding: 0; border: 0; background: none; font: inherit; color: var(--texte); cursor: pointer;
      text-decoration: underline; text-decoration-color: var(--lien-soulignement); text-underline-offset: 3px;
    }
    .login-form__submit { width: 100%; margin-top: 4px; justify-content: center; }
    /* ⚠️ 02/11 (pilote) — sur le portail, le bouton prend l'or de l'accent (repères, bandeau) au lieu du bleu vif. */
    .login-form__submit--or { background: var(--or); border-color: var(--or); color: var(--texte); font-weight: 500; }
    .login-form__submit--or:hover:not(:disabled) { filter: brightness(0.95); }
    .login-form__submit--or:focus-visible { outline: 2px solid var(--section-fond); outline-offset: 2px; }
    /* Champ : libellé visible au-dessus, contour --bordure-champ (3,32:1). */
    .login-field { display: flex; flex-direction: column; gap: 4px; }
    .login-field__libelle { font-size: 11px; color: var(--texte-secondaire); }
    .login-field__input {
      padding: 8px 10px; border: 1px solid var(--bordure-champ); border-radius: 6px; background: var(--carte-fond);
      color: var(--texte); font: inherit; font-size: 13px;
    }
    .login-field__input:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 1px; }
    .login-field--invalid .login-field__input { border-color: var(--retard-texte); }
  `,
})
export class FormulaireConnexion {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly titre = input('Connexion');
  readonly sousTitre = input<string | null>(null);
  /** Préfixe des identifiants du formulaire (titre, messages) : l'hôte le nomme par `aria-labelledby`. */
  readonly idTitre = input('connexion');
  /** La couleur du bouton : le bleu des boutons principaux (écran `/login`), ou l'or de l'accent (portail public). */
  readonly accent = input<'defaut' | 'or'>('defaut');

  readonly form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    motDePasse: ['', Validators.required],
    seSouvenir: [true],
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    // ⚠️ Soumission en ligne, lot 1 (04/10) — la confirmation du compte candidat renvoie ici avec l'adresse (`?login=`).
    const login = this.route.snapshot.queryParamMap.get('login');
    if (login) this.form.patchValue({ login });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { login, motDePasse, seSouvenir } = this.form.getRawValue();
    this.auth.authenticate({ login, motDePasse }, seSouvenir).subscribe({
      next: (res) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Un profil EXTERNE (candidat, membre de CAO) n'a que son espace : un retour vers la coquille interne (ou aucun)
        // le mène à sa racine.
        const espace = espaceExterneDe(res.role);
        const cible = espace ? (returnUrl?.startsWith(espace) ? returnUrl : espace) : (returnUrl ?? '/');
        void this.router.navigateByUrl(cible);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        // ⚠️ Soumission en ligne (04/10) — des 409 nommés : le compte candidat n'est pas confirmé, ou il est archivé et un
        // nouveau code vient de partir (après le mot de passe vérifié : un tiers n'apprend rien) ; le compte de membre de
        // CAO n'est pas activé (avant toute vérification : il n'a pas encore de mot de passe — écart accepté). Même
        // geste : l'écran du code, avec l'adresse déjà posée.
        if (err.status === 409 && (err.code === 'COMPTE_A_CONFIRMER' || err.code === 'COMPTE_ARCHIVE')) {
          this.toast.info(err.message, err.code === 'COMPTE_ARCHIVE' ? 'Compte archivé' : 'Compte à confirmer');
          void this.router.navigate(['/candidat', 'confirmation'], {
            queryParams: { email: login.trim(), archive: err.code === 'COMPTE_ARCHIVE' ? 1 : null },
          });
          return;
        }
        if (err.status === 409 && err.code === 'COMPTE_A_ACTIVER') {
          this.toast.info(err.message, 'Compte à activer');
          // ⚠️ V71 : le dépositaire de la part de secours a aussi un compte à activer ; la réponse ne dit pas lequel, la page
          // visée (`returnUrl`) le dit — à défaut, la CAO, dont l'écran d'activation renvoie vers l'autre en cas d'échec.
          const visee = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
          const espace = visee.startsWith('/depositaire') ? '/depositaire' : '/cao';
          void this.router.navigate([espace, 'activation'], { queryParams: { email: login.trim() } });
          return;
        }
        // 401 = identifiants invalides OU compte désactivé : on affiche le message backend si présent.
        const message = err.status === 401 ? err.message || 'Identifiants invalides.' : err.message;
        // Boîte de dialogue centrée (règle maison du 06/08 : un refus s'accuse réception) ;
        // le bandeau en ligne reste comme rappel une fois le dialogue fermé.
        this.toast.error(message, 'Connexion refusée');
        this.errorMessage.set(message);
      },
    });
  }

  /** Pas d'endpoint public de réinitialisation : on oriente vers l'administrateur. */
  motDePasseOublie(): void {
    this.toast.info(
      "Mot de passe oublié : contactez l'administrateur pour une réinitialisation.",
    );
  }
}
