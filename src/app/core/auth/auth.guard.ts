import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../../models';
import { AuthService } from './auth.service';

/**
 * Garde d'authentification : laisse passer si une session valide existe,
 * sinon redirige vers `/login` en mémorisant l'URL demandée (`returnUrl`).
 *
 * Confort UX uniquement : le backend refuse de toute façon sans JWT valide (401).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Garde de rôle : autorise la route si le profil courant figure dans `data.roles`.
 * Sans `roles` déclaré, la route est ouverte à tout utilisateur authentifié.
 * En cas de refus, redirige vers `/acces-refuse`.
 *
 * Là encore, c'est une commodité : le backend applique réellement le RBAC (403).
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = route.data['roles'] as Role[] | undefined;
  if (!allowed || allowed.length === 0 || auth.hasRole(...allowed)) {
    return true;
  }
  return router.createUrlTree(['/acces-refuse']);
};
