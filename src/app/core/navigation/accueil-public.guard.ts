import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { espaceExterneDe } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { cheminAFaire } from './navigation';

/**
 * Entrée publique (`/accueil/:audience`, proposition 2026-09-22) : un utilisateur DÉJÀ connecté n'a rien à y faire —
 * il est renvoyé à son « À faire » (ou à la racine de l'application pour les profils qui n'en ont pas :
 * Administrateur, Chargé de publication). Un visiteur passe.
 */
export const accueilPublicGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  // ⚠️ Soumission en ligne (04/10) — un profil externe connecté (candidat, membre de CAO) a son espace, hors coquille interne.
  const espace = espaceExterneDe(auth.role());
  if (espace) return router.parseUrl(espace);
  return router.parseUrl(cheminAFaire(auth.role()) ?? '/');
};
