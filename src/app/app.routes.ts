import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/auth/auth.guard';

/**
 * Routes de l'application.
 *
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
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRATEUR'] },
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'prmp',
        canActivate: [roleGuard],
        data: { roles: ['PRMP'] },
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
