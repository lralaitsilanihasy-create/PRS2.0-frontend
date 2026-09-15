import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { ESPACES_A_FAIRE } from './navigation';

/**
 * Alias partageable `/dossier/:idDossier` (refonte ergonomique, lot L4-F2 — plan L4, §2) : redirige
 * vers la page du dossier DANS l'espace du connecté, `/<espace>/dossier/:idDossier`, en gardant les
 * paramètres de requête (`returnUrl`…) et le fragment. Les écrans et les gestes vivent dans l'espace :
 * la route canonique y garde son `roleGuard`.
 *
 * Profils sans espace du circuit (Administrateur, Chargé de publication) : `/acces-refuse`, ils n'ont
 * pas la page en v1. Confort de navigation seulement : le serveur tranche le périmètre (403).
 */
export const dossierAliasGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const role = inject(AuthService).role();
  const espace = role ? ESPACES_A_FAIRE[role] : undefined;
  if (!espace) {
    return router.createUrlTree(['/acces-refuse']);
  }
  return router.createUrlTree(['/', espace, 'dossier', route.paramMap.get('idDossier') ?? ''], {
    queryParams: route.queryParams,
    fragment: route.fragment ?? undefined,
  });
};
