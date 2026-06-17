import { HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';

import { ErrorResponse } from '../../models';

/**
 * Erreur API normalisée, propagée aux composants par l'intercepteur d'erreurs.
 * Permet aux formulaires de lire `fieldErrors` et aux écrans de réagir au `status`.
 */
export interface ApiError {
  /** Code HTTP (0 = erreur réseau / serveur injoignable). */
  status: number;
  /** Message lisible (issu de `ErrorResponse.message` ou message par défaut). */
  message: string;
  /** Erreurs de validation par champ (présent surtout en 400). */
  fieldErrors?: Record<string, string>;
  /** Réponse HTTP brute, pour les cas particuliers. */
  raw: HttpErrorResponse;
}

/**
 * Jeton de contexte HTTP permettant de désactiver l'affichage automatique du toast
 * d'erreur pour une requête donnée (le composant gère alors lui-même l'erreur).
 *
 * Usage : `http.get(url, { context: skipErrorToast() })`.
 */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Construit un `HttpContext` avec l'affichage automatique du toast désactivé. */
export function skipErrorToast(context: HttpContext = new HttpContext()): HttpContext {
  return context.set(SKIP_ERROR_TOAST, true);
}

/** Indique si une valeur inconnue est une `ApiError` normalisée. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'message' in value &&
    'raw' in value
  );
}

/** Récupère le message d'erreur d'un champ donné, s'il existe. */
export function getFieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.fieldErrors?.[field] : undefined;
}

/** Titre court catégorisant l'erreur, par code HTTP (affiché en gras dans le toast). */
export function errorTitle(status: number): string {
  switch (status) {
    case 0:
      return 'Connexion';
    case 400:
      return 'Saisie invalide';
    case 401:
      return 'Session';
    case 403:
      return 'Accès refusé';
    case 404:
      return 'Introuvable';
    case 409:
      return 'Action impossible';
    default:
      return status >= 500 ? 'Service indisponible' : 'Erreur';
  }
}

/** Normalise une `HttpErrorResponse` en `ApiError`. */
export function toApiError(err: HttpErrorResponse): ApiError {
  const body = err.error as Partial<ErrorResponse> | string | null;
  const hasStructuredBody = typeof body === 'object' && body !== null;

  const message = hasStructuredBody && body.message ? body.message : defaultMessage(err.status);
  const fieldErrors = hasStructuredBody ? body.fieldErrors : undefined;

  return { status: err.status, message, fieldErrors, raw: err };
}

/** Message par défaut quand le backend ne fournit pas de `ErrorResponse` exploitable. */
function defaultMessage(status: number): string {
  switch (status) {
    case 0:
      return 'Service indisponible : impossible de joindre le serveur.';
    case 400:
      return 'Données saisies invalides.';
    case 401:
      return 'Session expirée ou compte désactivé : veuillez vous reconnecter.';
    case 403:
      return 'Action non autorisée : rôle ou périmètre de localité insuffisant.';
    case 404:
      return 'Ressource introuvable.';
    case 409:
      return "Opération impossible dans l'état actuel (étape du circuit ou transition non autorisée).";
    default:
      return status >= 500
        ? 'Service indisponible, veuillez réessayer.'
        : "Une erreur est survenue.";
  }
}
