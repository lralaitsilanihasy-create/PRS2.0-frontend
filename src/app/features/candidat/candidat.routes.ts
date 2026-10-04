import { Routes } from '@angular/router';

import { externeConnecteGuard, externeHorsSessionGuard } from '../../core/auth/auth.guard';

/**
 * Espace candidat (soumission en ligne, lot 1 — demande du 04/10, §B2 à §B8). Monté sous `/candidat` dans la coquille des
 * espaces externes (`EspaceExterneLayout`), jamais dans `MainLayout` : le candidat n'a aucune route interne. Les procédures
 * se lisent sans session ; l'inscription et la confirmation sont publiques ; « Mon entreprise » demande la connexion.
 */
export const CANDIDAT_ROUTES: Routes = [
  { path: '', redirectTo: 'procedures', pathMatch: 'full' },
  {
    path: 'inscription',
    canActivate: [externeHorsSessionGuard],
    loadComponent: () => import('./inscription-candidat').then((m) => m.InscriptionCandidat),
  },
  {
    path: 'confirmation',
    canActivate: [externeHorsSessionGuard],
    loadComponent: () => import('./confirmation-candidat').then((m) => m.ConfirmationCandidat),
  },
  { path: 'procedures', loadComponent: () => import('./procedures-en-ligne').then((m) => m.ProceduresEnLigne) },
  {
    path: 'procedures/:idDmc',
    loadComponent: () => import('./procedure-en-ligne-detail').then((m) => m.ProcedureEnLigneDetail),
  },
  {
    path: 'entreprise',
    canActivate: [externeConnecteGuard],
    loadComponent: () => import('./entreprise-candidat').then((m) => m.EntrepriseCandidat),
  },
];
