import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CandidatInscriptionService } from '../../services';

/** Six chiffres, et rien d'autre : un code mal formé compte comme un essai côté serveur. */
const CODE = /^\d{6}$/;

/**
 * Confirmation du compte candidat (`POST /api/candidats/confirmation`, public, §B2). Le code reçu par courriel vaut
 * 15 minutes et 5 essais ; au-delà, « Renvoyer un code » en émet un nouveau (le précédent est invalidé). Le même
 * écran **réactive un compte archivé** : la connexion a répondu 409 `COMPTE_ARCHIVE` et un nouveau code est parti.
 */
@Component({
  selector: 'app-confirmation-candidat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="cc">
      <header class="page-header">
        <div class="page-subtitle">Espace candidat</div>
        <h1 class="page-title">{{ archive() ? 'Réactiver mon compte' : 'Confirmer mon compte' }}</h1>
      </header>
      <p class="page-role">
        @if (archive()) {
          Votre compte était archivé faute de connexion : un nouveau code vient de vous être envoyé par courriel.
          Saisissez-le pour le réactiver.
        } @else {
          Saisissez le code à six chiffres reçu par courriel. Il vaut quinze minutes ; passé ce délai, demandez-en un
          nouveau.
        }
      </p>

      <form class="card cnm-form cc__form" [formGroup]="form" (ngSubmit)="confirmer()" novalidate aria-label="Confirmation du compte">
        @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <label class="form-group">
          <span class="form-label">Adresse électronique</span>
          <input class="form-control" type="email" formControlName="email" autocomplete="email" required [class.error]="touche('email') && form.controls.email.invalid" />
          @if (touche('email') && form.controls.email.invalid) { <span class="form-error">Adresse obligatoire.</span> }
        </label>
        <label class="form-group">
          <span class="form-label">Code reçu par courriel</span>
          <input class="form-control cc__code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" formControlName="codeEmail" required [class.error]="touche('codeEmail') && form.controls.codeEmail.invalid" />
          @if (touche('codeEmail') && form.controls.codeEmail.invalid) { <span class="form-error">Six chiffres.</span> }
        </label>
        <label class="form-group">
          <span class="form-label">Code reçu par SMS — seulement si un code vous a été envoyé par téléphone</span>
          <input class="form-control cc__code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" formControlName="codeTelephone" />
        </label>

        <div class="cc__pied">
          <button type="submit" class="btn btn-primary" [disabled]="envoi()">{{ envoi() ? 'Vérification…' : 'Confirmer' }}</button>
          <button type="button" class="btn btn-outline" [disabled]="envoi() || renvoiEnCours()" (click)="renvoyer()">{{ renvoiEnCours() ? 'Envoi…' : 'Renvoyer un code' }}</button>
          <span class="text-sm text-muted">Pas encore de compte ? <a routerLink="/candidat/inscription">S'inscrire</a></span>
        </div>
      </form>
    </div>
  `,
  styles: `
    .cc { max-width: 36rem; }
    .cc__form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .cc__code { max-width: 10rem; letter-spacing: 0.2em; font-variant-numeric: tabular-nums; }
    .cc__pied { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem; }
  `,
})
export class ConfirmationCandidat {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CandidatInscriptionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    codeEmail: ['', [Validators.required, Validators.pattern(CODE)]],
    codeTelephone: [''],
  });

  /** Arrivée depuis une connexion refusée 409 `COMPTE_ARCHIVE` : le texte le dit, le geste est le même. */
  readonly archive = signal(this.route.snapshot.queryParamMap.get('archive') === '1');
  readonly envoi = signal(false);
  readonly renvoiEnCours = signal(false);
  readonly erreur = signal<string | null>(null);

  constructor() {
    inject(DOCUMENT).title = 'Confirmer mon compte — PRS 2.0';
  }

  touche(champ: 'email' | 'codeEmail'): boolean {
    return this.form.controls[champ].touched;
  }

  confirmer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    const { email, codeEmail, codeTelephone } = this.form.getRawValue();
    const corps = codeTelephone.trim() ? { email: email.trim(), codeEmail, codeTelephone: codeTelephone.trim() } : { email: email.trim(), codeEmail };
    this.service.confirmer(corps).subscribe({
      next: () => {
        this.toast.success(this.archive() ? 'Votre compte est réactivé. Connectez-vous.' : 'Votre compte est confirmé. Connectez-vous.', 'C’est fait');
        void this.router.navigate(['/login'], { queryParams: { login: email.trim(), returnUrl: '/candidat' } });
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        if (e.status === 400 && e.code === 'CODE_EXPIRE') {
          this.erreur.set('Ce code a expiré : demandez-en un nouveau.');
        } else if (e.status === 400 && e.code === 'CODE_INVALIDE') {
          this.erreur.set('Code incorrect. Vérifiez les six chiffres reçus par courriel.');
        } else if (e.status === 404) {
          this.erreur.set("Aucune inscription en attente pour cette adresse. Vérifiez l'adresse, ou inscrivez-vous.");
        } else if (e.status === 429) {
          this.erreur.set('Trop d’essais : ce code ne vaut plus. Demandez un nouveau code, puis réessayez.');
        } else {
          this.erreur.set(e.message || "La confirmation n'a pas abouti. Réessayez dans un moment.");
        }
      },
    });
  }

  /** Toujours 204, même pour une adresse inconnue : le message ne dit pas si l'adresse existe. */
  renvoyer(): void {
    const email = this.form.controls.email;
    if (email.invalid) {
      email.markAsTouched();
      return;
    }
    this.renvoiEnCours.set(true);
    this.erreur.set(null);
    this.service.renvoyerCodes(email.value.trim()).subscribe({
      next: () => {
        this.renvoiEnCours.set(false);
        this.toast.info('Si cette adresse correspond à une inscription, un nouveau code vient de partir par courriel. Le précédent ne vaut plus.', 'Code renvoyé');
      },
      error: (e: ApiError) => {
        this.renvoiEnCours.set(false);
        this.erreur.set(e.status === 429 ? 'Cinq renvois par heure au plus pour une adresse : patientez avant d’en redemander un.' : e.message || "Le renvoi n'a pas abouti.");
      },
    });
  }
}
