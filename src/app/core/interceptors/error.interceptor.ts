import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ApiError, SKIP_ERROR_TOAST, errorTitle, toApiError } from '../errors/api-error';
import { ToastService } from '../notifications/toast.service';

/**
 * Intercepteur de gestion centralisée des erreurs HTTP.
 *
 * - Normalise toute `HttpErrorResponse` en `ApiError` (puis la rejette pour que les
 *   composants/formulaires puissent réagir — notamment lire `fieldErrors` en 400).
 * - Affiche automatiquement un toast adapté au code (sauf si la requête a opté pour
 *   `skipErrorToast()`, ou en 400 avec `fieldErrors` — laissé au formulaire).
 * - En 401, purge la session et redirige vers la page de connexion.
 *
 * Rappel : le backend reste l'autorité ; ici on ne fait que présenter ses réponses.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const apiError = toApiError(err);

      if (apiError.status === 401) {
        auth.logout();
        if (!router.url.startsWith('/login')) {
          void router.navigateByUrl('/login');
        }
      }

      if (!req.context.get(SKIP_ERROR_TOAST) && shouldToast(apiError)) {
        toast.error(apiError.message, errorTitle(apiError.status));
      }

      return throwError(() => apiError);
    }),
  );
};

/**
 * Détermine si l'erreur doit produire un toast automatique.
 * On évite le toast en 400 porteur de `fieldErrors` : ces erreurs s'affichent
 * directement sous les champs du formulaire concerné.
 */
function shouldToast(error: ApiError): boolean {
  if (error.status === 400 && error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    return false;
  }
  return true;
}
