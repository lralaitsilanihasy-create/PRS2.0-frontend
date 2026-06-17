import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';

/**
 * Intercepteur JWT : ajoute `Authorization: Bearer <token>` à chaque requête sortante,
 * sauf la route publique de login.
 *
 * La gestion des erreurs (401/403/404/409) sera ajoutée par un intercepteur dédié
 * à l'étape 4.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Ne jamais ajouter le jeton aux routes publiques d'authentification
  // (/auth/login et /auth/register/prmp).
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const token = inject(AuthService).token();
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
