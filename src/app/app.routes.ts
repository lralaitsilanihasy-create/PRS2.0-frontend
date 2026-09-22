import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/auth/auth.guard';
import { accueilPublicGuard } from './core/navigation/accueil-public.guard';
import { dossierAliasGuard } from './core/navigation/dossier-alias.guard';

/**
 * Routes de l'application.
 *
 * - `/accueil/:audience` : ENTRÉE PUBLIQUE (proposition 2026-09-22, arbitrée) — la racine hors session y mène
 *   (`authGuard`), un connecté en est renvoyé à son « À faire » (`accueilPublicGuard`).
 * - `/login` : route publique (page de connexion).
 * - Tout le reste passe par la coquille `MainLayout`, protégée par `authGuard`.
 *   Les espaces par profil (PRMP, Président, CC, …) seront ajoutés en routes
 *   enfants lazy aux étapes 8 à 13, chacune gardée par `roleGuard`.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'inscription',
    loadComponent: () =>
      import('./features/auth/register/register-prmp').then((m) => m.RegisterPrmp),
  },
  {
    // Entrée publique (proposition 2026-09-22) : deux audiences, l'onglet retenu vit dans l'URL.
    path: 'accueil',
    canActivate: [accueilPublicGuard],
    children: [
      { path: '', redirectTo: 'prmp', pathMatch: 'full' },
      { path: ':audience', loadComponent: () => import('./features/public/accueil-public').then((m) => m.AccueilPublic) },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'acces-refuse',
        loadComponent: () =>
          import('./features/errors/access-denied').then((m) => m.AccessDenied),
      },
      {
        // Refonte ergonomique (lot L4-F2) — alias partageable d'un dossier : la garde redirige vers
        // `/<espace>/dossier/:idDossier` (paramètres conservés) ; Administrateur et Chargé de
        // publication vers `/acces-refuse`. Le serveur tranche le périmètre.
        path: 'dossier/:idDossier',
        canActivate: [dossierAliasGuard],
        children: [],
      },
      {
        // ⚠️ Spec notifications (2026-08-02) — écran dédié, TRANSVERSE (tous profils authentifiés).
        path: 'notifications',
        loadComponent: () =>
          import('./features/transverse/notifications-page').then((m) => m.NotificationsPage),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRATEUR'] },
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'prmp',
        canActivate: [roleGuard],
        // UGPM agit sous le périmètre de sa PRMP : accès aux écrans PRMP (saisie/brouillons/PV).
        // Le menu restreint ce qu'il voit ; le backend refuse (403) ce qu'il ne peut pas faire (soumettre…).
        data: { roles: ['PRMP', 'UGPM'] },
        loadChildren: () => import('./features/prmp/prmp.routes').then((m) => m.PRMP_ROUTES),
      },
      {
        path: 'secretaire',
        canActivate: [roleGuard],
        data: { roles: ['SECRETAIRE'] },
        loadChildren: () =>
          import('./features/secretaire/secretaire.routes').then((m) => m.SECRETAIRE_ROUTES),
      },
      {
        path: 'membre',
        canActivate: [roleGuard],
        data: { roles: ['MEMBRE'] },
        loadChildren: () => import('./features/membre/membre.routes').then((m) => m.MEMBRE_ROUTES),
      },
      {
        path: 'president',
        canActivate: [roleGuard],
        data: { roles: ['PRESIDENT'] },
        loadChildren: () =>
          import('./features/president/president.routes').then((m) => m.PRESIDENT_ROUTES),
      },
      {
        path: 'cc',
        canActivate: [roleGuard],
        data: { roles: ['CHEF_COMMISSION'] },
        loadChildren: () => import('./features/cc/cc.routes').then((m) => m.CC_ROUTES),
      },
      {
        path: 'verificateur',
        canActivate: [roleGuard],
        data: { roles: ['VERIFICATEUR'] },
        loadChildren: () =>
          import('./features/verificateur/verificateur.routes').then(
            (m) => m.VERIFICATEUR_ROUTES,
          ),
      },
      {
        path: 'assistant',
        canActivate: [roleGuard],
        data: { roles: ['ASSISTANT_CONTROLEUR'] },
        loadChildren: () =>
          import('./features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
      },
      {
        path: 'publication',
        canActivate: [roleGuard],
        data: { roles: ['CHARGE_PUBLICATION'] },
        loadChildren: () =>
          import('./features/publication/publication.routes').then((m) => m.PUBLICATION_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
