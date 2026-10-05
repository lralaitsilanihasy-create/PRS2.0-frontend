import { Routes } from '@angular/router';

import { externeConnecteGuard, externeHorsSessionGuard } from '../../core/auth/auth.guard';

/**
 * ⚠️ V71 (05/10, décision du pilote) — l'espace du **dépositaire** de la part de secours. Monté sous `/depositaire` dans la
 * coquille des espaces externes, jamais dans `MainLayout`. Rien n'est public ici, sauf l'activation, à laquelle l'invitation
 * par courriel conduit — le même écran que pour la CAO, en variante.
 */
export const DEPOSITAIRE_ROUTES: Routes = [
  { path: '', redirectTo: 'mes-procedures', pathMatch: 'full' },
  {
    path: 'activation',
    canActivate: [externeHorsSessionGuard],
    data: { variante: 'depositaire' },
    loadComponent: () => import('../cao/activation-cao').then((m) => m.ActivationCao),
  },
  {
    path: 'mes-procedures',
    canActivate: [externeConnecteGuard],
    loadComponent: () => import('./mes-procedures-depositaire').then((m) => m.MesProceduresDepositaire),
  },
  {
    path: 'procedures/:idDmc',
    canActivate: [externeConnecteGuard],
    loadComponent: () => import('./procedure-depositaire').then((m) => m.ProcedureDepositaireEcran),
  },
];
