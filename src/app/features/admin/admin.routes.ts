import { Routes } from '@angular/router';
















import { COMPTES, REFERENTIELS, SECURITE } from './admin-resources.config';

const refLinks = [
  ...REFERENTIELS.map((r) => ({
    label: r.config.title,
    path: `/admin/referentiels/${r.slug}`,
  })),
  // Écran dédié : mapping mode de passation → type de DMC (PUT sur les modes ; pas un CRUD générique).
  { label: 'Mapping mode → document DMC', path: '/admin/referentiels/dmc-mapping' },
];
const compteLinks = [
  ...COMPTES.map((r) => ({
    label: r.config.title,
    path: `/admin/comptes/${r.slug}`,
  })),
  // Écran dédié (POST /api/ugpms : création UGPM + compte ; pas de CRUD générique).
  { label: 'UGPM (unités de gestion)', path: '/admin/comptes/ugpms' },
  // Écran dédié : mandats PRMP (nomination / reconduction / abrogation — pas un CRUD générique).
  { label: 'Mandats PRMP', path: '/admin/comptes/mandats' },
];
const auditConfig = SECURITE.find((r) => r.slug === 'audit-logs')!.config;
const sessionConfig = SECURITE.find((r) => r.slug === 'session-utilisateurs')!.config;

/**
 * Routes de l'espace administration (chargées en lazy, sous roleGuard ADMINISTRATEUR).
 * Chaque ressource réutilise `CrudPage` ; sa configuration est passée via `data.crud`.
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },

  { path: 'tableau-de-bord', loadComponent: () => import('../pilotage/kpi-dashboard').then((m) => m.KpiDashboard) },

  {
    path: 'referentiels',
    loadComponent: () => import('../../shared/ui/section-home').then((m) => m.SectionHome),
    data: { title: 'Référentiels', links: refLinks },
  },
  { path: 'referentiels/entite-arbre', loadComponent: () => import('./entite-arbre').then((m) => m.EntiteArbre) },
  { path: 'referentiels/dmc-mapping', loadComponent: () => import('./dmc-mapping-admin').then((m) => m.DmcMappingAdmin) },
  ...REFERENTIELS.map((r) => ({
    path: `referentiels/${r.slug}`,
    loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage),
    data: { crud: r.config },
  })),

  {
    path: 'comptes',
    loadComponent: () => import('../../shared/ui/section-home').then((m) => m.SectionHome),
    data: { title: 'Comptes & hiérarchie', links: compteLinks },
  },
  // PRMP et contrôleur ont un écran dédié (fiche + photo/pièces) ; les autres ressources « comptes » sont génériques.
  ...COMPTES.filter((r) => r.slug !== 'prmps' && r.slug !== 'controleurs').map((r) => ({
    path: `comptes/${r.slug}`,
    loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage),
    data: { crud: r.config },
  })),
  { path: 'comptes/prmps', loadComponent: () => import('./prmp-admin').then((m) => m.PrmpAdmin) },
  { path: 'comptes/controleurs', loadComponent: () => import('./controleur-admin').then((m) => m.ControleurAdmin) },
  { path: 'comptes/ugpms', loadComponent: () => import('./ugpm-admin').then((m) => m.UgpmAdmin) },
  { path: 'comptes/mandats', loadComponent: () => import('./mandats-admin').then((m) => m.MandatsAdmin) },
  { path: 'comptes/prmp-pieces', loadComponent: () => import('./prmp-pieces-admin').then((m) => m.PrmpPiecesAdmin) },
  { path: 'comptes/ugpm-pieces', loadComponent: () => import('./ugpm-pieces-admin').then((m) => m.UgpmPiecesAdmin) },

  // Actualités affichées à l'ouverture de session (spec 2026-08-18) : CRUD, ciblage par profil,
  // images JPEG, interrupteur global et historique des archivées.
  { path: 'actualites', loadComponent: () => import('./actualites-admin').then((m) => m.ActualitesAdmin) },
  { path: 'inscriptions', loadComponent: () => import('./inscriptions-admin').then((m) => m.InscriptionsAdmin) },
  { path: 'rattachements', loadComponent: () => import('./rattachements-admin').then((m) => m.RattachementsAdmin) },
  { path: 'audit', loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage), data: { crud: auditConfig } },
  { path: 'sessions', loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage), data: { crud: sessionConfig } },
  { path: 'rapports', loadComponent: () => import('../pilotage/rapports-page').then((m) => m.RapportsPage) },
  { path: 'ppm-marches', loadComponent: () => import('../prmp/ppm-marches').then((m) => m.PpmMarches) },
  { path: 'marches-previsions', loadComponent: () => import('../prmp/prmp-marches-previsions').then((m) => m.PrmpMarchesPrevisions) },
];
