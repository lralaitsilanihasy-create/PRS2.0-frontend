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

/** Les trois publics du portail (`/accueil/:audience`). */
export type PublicPortail = 'prmp' | 'commission' | 'candidat';

/**
 * ⚠️ 02/11 (pilote) — le public du portail dont relève un profil : PRMP et UGPM (et le Responsable de procédure, de leur côté) sur
 * « PRMP & UGPM », le candidat sur « Entreprises », les profils de la CNM et l'Administrateur sur « CNM ». Les membres de CAO et les
 * dépositaires, invités par une PRMP, relèvent de « PRMP & UGPM ».
 */
export function publicDuRole(role: string | null | undefined): PublicPortail {
  if (role === 'CANDIDAT') return 'candidat';
  if (!role || ['PRMP', 'UGPM', 'RESPONSABLE_PROCEDURE', 'MEMBRE_CAO', 'DEPOSITAIRE'].includes(role)) return 'prmp';
  return 'commission';
}

/** ⚠️ 02/11 (pilote) — après la déconnexion, le portail public, sur l'onglet du profil qui sort (rôle lu AVANT la déconnexion). */
export function accueilApresDeconnexion(role: string | null | undefined): string {
  return `/accueil/${publicDuRole(role)}`;
}
