import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Role } from '../../models';
import { InterimStore } from '../interim/interim.store';
import { AuthService } from './auth.service';

/**
 * ⚠️ Soumission en ligne (04/10) — les profils EXTERNES et leur espace : le candidat (lot 1) et le membre de la commission
 * d'appel d'offres (lot 2a). Ni l'un ni l'autre n'entre dans la coquille interne : chaque appel qu'elle fait au chargement
 * (notifications, actualités, intérims, vacance…) leur vaudrait un 403 et son dialogue. Chaque espace a sa coquille
 * (`features/externe/espace-externe-layout.ts`) et ses routes.
 */
export const ESPACES_EXTERNES: Readonly<Partial<Record<Role, string>>> = {
  CANDIDAT: '/candidat',
  MEMBRE_CAO: '/cao',
  DEPOSITAIRE: '/depositaire',
};

/** La racine de l'espace externe du profil, `null` pour un profil de la coquille interne (ou sans profil). */
export function espaceExterneDe(role: Role | null | undefined): string | null {
  return role ? (ESPACES_EXTERNES[role] ?? null) : null;
}

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
    // Un profil externe (candidat, membre de CAO) n'entre jamais dans la coquille interne : son espace, et rien d'autre.
    const espace = espaceExterneDe(auth.role());
    if (espace && !state.url.startsWith(espace)) {
      return router.createUrlTree([espace]);
    }
    return true;
  }
  // Entrée publique (proposition 2026-09-22, arbitrage Q1) : la RACINE hors session mène à l'accueil public ;
  // un lien profond garde le chemin historique — connexion, puis retour à l'écran demandé.
  if (state.url === '/' || state.url === '') {
    return router.createUrlTree(['/accueil', 'prmp']);
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Garde de rôle : autorise la route si le profil courant figure dans `data.roles`.
 * Sans `roles` déclaré, la route est ouverte à tout utilisateur authentifié.
 * En cas de refus, redirige vers `/acces-refuse`.
 *
 * Là encore, c'est une commodité : le backend applique réellement le RBAC (403).
 *
 * ⚠️ Intérim désigné (2026-09-21, backend `e867082`) — l'espace d'un titulaire s'ouvre à son intérimaire
 * ACTIF : un Membre qui supplée un CC entre dans `/cc`, un CC qui supplée le Président dans `/president` —
 * les écrans y sont ceux du titulaire, le serveur scope les données sur SON périmètre. Jamais par
 * délégation (les écrans délégués sont montés dans l'espace du délégataire). L'état d'intérim est lu une
 * fois par session (`InterimStore.assurer`), d'où la garde asynchrone quand le rôle seul ne suffit pas.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const interims = inject(InterimStore);

  const allowed = route.data['roles'] as Role[] | undefined;
  if (!allowed || allowed.length === 0 || auth.hasRole(...allowed)) {
    return true;
  }
  // Un profil externe n'a ni intérim ni accès à `/api/interims/mes` (403) : son refus est son propre espace, sans appel.
  const espace = espaceExterneDe(auth.role());
  if (espace) {
    return router.createUrlTree([espace]);
  }
  const refus = router.createUrlTree(['/acces-refuse']);
  return interims.assurer().pipe(
    map((m) => (m.exerces.some((i) => allowed.includes(i.profilTitulaire)) ? true : refus)),
    catchError(() => of(refus)),
  );
};

/**
 * ⚠️ Soumission en ligne (04/10) — la racine d'un espace externe (`/candidat`, `/cao`), dont la route porte
 * `data.role`. PUBLIC pour un visiteur (procédures ouvertes, inscription, activation), réservé à SON profil une fois
 * connecté. Un agent connecté y est renvoyé chez lui (la PRMP a sa fiche, l'Administrateur ses écrans) ; un autre profil
 * externe, dans son propre espace.
 */
export const espaceExterneGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const attendu = route.data['role'] as Role | undefined;
  if (!auth.isAuthenticated() || auth.role() === attendu) {
    return true;
  }
  return router.createUrlTree([espaceExterneDe(auth.role()) ?? '/']);
};

/** Écran d'un externe CONNECTÉ (« Mon entreprise », « Mes procédures ») : sans session, connexion puis retour à l'écran demandé. */
export const externeConnecteGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Inscription, confirmation, activation : un externe déjà connecté n'a rien à y faire, il retrouve son espace. */
export const externeHorsSessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree([espaceExterneDe(auth.role()) ?? '/']) : true;
};
