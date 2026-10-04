import { Routes } from '@angular/router';

import { authGuard, espaceExterneGuard, roleGuard } from './core/auth/auth.guard';
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
    // ⚠️ Soumission en ligne, lot 1 (04/10) — l'ESPACE CANDIDAT, dans la coquille des espaces EXTERNES (pas `MainLayout`,
    // dont chaque appel de démarrage vaudrait un 403 au profil CANDIDAT). Public pour un visiteur (procédures,
    // inscription), réservé au candidat connecté ensuite ; un agent connecté est renvoyé chez lui. Gardes fines : `candidat.routes.ts`.
    path: 'candidat',
    canActivate: [espaceExterneGuard],
    data: { role: 'CANDIDAT', espace: 'candidat' },
    loadComponent: () => import('./features/externe/espace-externe-layout').then((m) => m.EspaceExterneLayout),
    loadChildren: () => import('./features/candidat/candidat.routes').then((m) => m.CANDIDAT_ROUTES),
  },
  {
    // ⚠️ Soumission en ligne, lot 2a (04/10, Q11) — l'ESPACE DES MEMBRES DE LA COMMISSION D'APPEL D'OFFRES : activation du
    // compte (publique), puis ses procédures et sa clé (lot 2b). Même coquille externe, même règle : aucune route interne.
    path: 'cao',
    canActivate: [espaceExterneGuard],
    data: { role: 'MEMBRE_CAO', espace: 'cao' },
    loadComponent: () => import('./features/externe/espace-externe-layout').then((m) => m.EspaceExterneLayout),
    loadChildren: () => import('./features/cao/cao.routes').then((m) => m.CAO_ROUTES),
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
        // ⚠️ Remise électronique (27/09, Q6) — les paramètres internes d'une procédure : droit PAR PROCÉDURE, pas par
        // rôle de session. Route transverse, sans garde de rôle : le serveur répond 403 à qui n'est pas le responsable.
        path: 'procedure/:idDmc/parametres-internes',
        loadComponent: () =>
          import('./features/procedure/parametres-internes').then((m) => m.ParametresInternesEcran),
        data: { title: 'Paramètres internes de la procédure', concentration: true },
      },
      {
        // ⚠️ Soumission en ligne, lot 4 (04/10, V69) — la séance d'ouverture des plis : responsable (conduite), PRMP et UGPM
        // (lecture). Route transverse : le serveur garde par identité (403 aux autres).
        path: 'procedure/:idDmc/seance',
        loadComponent: () => import('./features/procedure/seance-ecran').then((m) => m.SeanceEcran),
        data: { title: 'Séance d’ouverture des plis' },
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
