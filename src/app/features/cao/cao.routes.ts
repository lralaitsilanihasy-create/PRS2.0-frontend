import { Routes } from '@angular/router';

import { externeConnecteGuard, externeHorsSessionGuard } from '../../core/auth/auth.guard';

/**
 * Espace des membres de la commission d'appel d'offres (soumission en ligne, lot 2a — demande du 04/10, §B2 ; lot 2b, la
 * clé). Monté sous `/cao` dans la coquille des espaces externes, jamais dans `MainLayout` : le membre n'a aucune route
 * interne. Rien n'est public ici, sauf l'activation du compte, à laquelle l'invitation par courriel conduit.
 */
export const CAO_ROUTES: Routes = [
  { path: '', redirectTo: 'mes-procedures', pathMatch: 'full' },
  {
    path: 'activation',
    canActivate: [externeHorsSessionGuard],
    loadComponent: () => import('./activation-cao').then((m) => m.ActivationCao),
  },
  {
    path: 'mes-procedures',
    canActivate: [externeConnecteGuard],
    loadComponent: () => import('./mes-procedures-cao').then((m) => m.MesProceduresCao),
  },
  {
    path: 'procedures/:idDmc',
    canActivate: [externeConnecteGuard],
    loadComponent: () => import('./procedure-cao').then((m) => m.ProcedureCao),
  },
];
