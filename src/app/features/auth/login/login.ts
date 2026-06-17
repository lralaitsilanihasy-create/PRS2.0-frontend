import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../core/errors/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/notifications/toast.service';

/** Page de connexion (route publique). Seul point d'entrée de l'authentification. */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    motDePasse: ['', Validators.required],
    seSouvenir: [true],
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { login, motDePasse, seSouvenir } = this.form.getRawValue();
    this.auth.authenticate({ login, motDePasse }, seSouvenir).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        // 401 = identifiants invalides OU compte désactivé : on affiche le message backend si présent.
        this.errorMessage.set(
          err.status === 401 ? err.message || 'Identifiants invalides.' : err.message,
        );
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
