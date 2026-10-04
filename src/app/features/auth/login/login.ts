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
        // Un CANDIDAT n'a que son espace : un retour vers la coquille interne (ou aucun) le mène à `/candidat`.
        const cible = res.role === 'CANDIDAT' ? (returnUrl?.startsWith('/candidat') ? returnUrl : '/candidat') : (returnUrl ?? '/');
        void this.router.navigateByUrl(cible);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        // ⚠️ Soumission en ligne (04/10) — deux 409 nommés APRÈS le mot de passe vérifié (un tiers n'apprend rien) :
        // le compte candidat n'est pas confirmé, ou il est archivé et un nouveau code vient de partir. Même geste : la
        // confirmation, avec l'adresse déjà posée.
        if (err.status === 409 && (err.code === 'COMPTE_A_CONFIRMER' || err.code === 'COMPTE_ARCHIVE')) {
          this.toast.info(err.message, err.code === 'COMPTE_ARCHIVE' ? 'Compte archivé' : 'Compte à confirmer');
          void this.router.navigate(['/candidat', 'confirmation'], {
            queryParams: { email: login.trim(), archive: err.code === 'COMPTE_ARCHIVE' ? 1 : null },
          });
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
