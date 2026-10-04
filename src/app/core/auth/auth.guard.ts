import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Role } from '../../models';
import { InterimStore } from '../interim/interim.store';
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
    // ⚠️ Soumission en ligne, lot 1 (04/10) — le CANDIDAT n'entre jamais dans la coquille interne : chaque appel
    // qu'elle fait au chargement (notifications, actualités, intérims…) lui vaudrait un 403 et son dialogue.
    if (auth.role() === 'CANDIDAT' && !state.url.startsWith('/candidat')) {
      return router.createUrlTree(['/candidat']);
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
  // Un candidat n'a ni intérim ni accès à `/api/interims/mes` (403) : son refus est son propre espace, sans appel.
  if (auth.role() === 'CANDIDAT') {
    return router.createUrlTree(['/candidat']);
  }
  const refus = router.createUrlTree(['/acces-refuse']);
  return interims.assurer().pipe(
    map((m) => (m.exerces.some((i) => allowed.includes(i.profilTitulaire)) ? true : refus)),
    catchError(() => of(refus)),
  );
};

/**
 * ⚠️ Soumission en ligne, lot 1 (04/10) — l'espace `/candidat` : PUBLIC pour un visiteur (procédures ouvertes,
 * inscription, confirmation), réservé au CANDIDAT une fois connecté. Un agent connecté y est renvoyé chez lui :
 * la PRMP lit le registre des retraits sur sa fiche, l'Administrateur a ses écrans, aucun n'a rien à faire ici.
 */
export const espaceCandidatGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated() || auth.role() === 'CANDIDAT') {
    return true;
  }
  return router.createUrlTree(['/']);
};

/** Écran du candidat CONNECTÉ (« Mon entreprise ») : sans session, connexion puis retour à l'écran demandé. */
export const candidatConnecteGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Inscription et confirmation : un candidat déjà connecté n'a rien à y faire, il retrouve ses procédures. */
export const candidatHorsSessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/candidat']) : true;
};
