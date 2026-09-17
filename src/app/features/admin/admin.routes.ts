import { Routes } from '@angular/router';
















import { COMPTES, REFERENTIELS, SECURITE } from './admin-resources.config';

/**
 * ⚠️ Lot 6 F1 (2026-09-17) — « Points de contrôle » et « Règles d'alerte » quittent le sommaire des
 * nomenclatures : ce sont des réglages du moteur de contrôle, et ils ont depuis leur propre entrée
 * de menu (`navigation.ts`). Leurs ROUTES et leurs écrans (CRUD générique) sont inchangés — seul le
 * chemin d'accès l'est, comme pour l'écran-hub « Examen de dossiers » du Président.
 */
const PROMUS_EN_MENU = ['points-ctrls', 'regle-alertes'];

const refLinks = [
  ...REFERENTIELS.filter((r) => !PROMUS_EN_MENU.includes(r.slug)).map((r) => ({
    label: r.config.title,
    path: `/admin/referentiels/${r.slug}`,
  })),
  // Écran dédié : mapping mode de passation → type de DMC (PUT sur les modes ; pas un CRUD générique).
  { label: 'Mapping mode → document DMC', path: '/admin/referentiels/dmc-mapping' },
];
const sessionConfig = SECURITE.find((r) => r.slug === 'session-utilisateurs')!.config;

/**
 * Routes de l'espace administration (chargées en lazy, sous roleGuard ADMINISTRATEUR).
 * Chaque ressource réutilise `CrudPage` ; sa configuration est passée via `data.crud`.
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },

  // ⚠️ Lot 6 F2 (2026-09-17) — l'accueil de l'Administrateur cesse d'emprunter le `KpiDashboard` du
  // CONTRÔLE (dossiers déposés, taux de conformité, top des points non conformes) : aucune de ces
  // mesures n'est de son ressort. `KpiDashboard` n'est pas modifié — il reste l'accueil du Président
  // et du Chef de commission, seule cette route cesse de l'emprunter.
  { path: 'tableau-de-bord', loadComponent: () => import('./admin-accueil').then((m) => m.AdminAccueil) },

  {
    path: 'referentiels',
    loadComponent: () => import('../../shared/ui/section-home').then((m) => m.SectionHome),
    data: { title: 'Nomenclatures', links: refLinks },
  },
  { path: 'referentiels/entite-arbre', loadComponent: () => import('./entite-arbre').then((m) => m.EntiteArbre) },
  { path: 'referentiels/dmc-mapping', loadComponent: () => import('./dmc-mapping-admin').then((m) => m.DmcMappingAdmin) },
  ...REFERENTIELS.map((r) => ({
    path: `referentiels/${r.slug}`,
    loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage),
    data: { crud: r.config },
  })),

  // ⚠️ Lot 6 F3 (2026-09-17) — `/admin/comptes` cesse d'être un SOMMAIRE de huit écrans (défaut §1.2
  // du plan : aucun de ces huit n'a d'entrée de menu, ce sommaire était leur seul chemin). Il ouvre
  // désormais sur l'ANNUAIRE, qui cherche une personne et agit sur elle. Les huit restent joignables
  // — depuis la fiche pour ceux qu'une personne désigne, et tous depuis le dépliant de pied de page
  // de l'annuaire (`ECRANS_COMPTES`). Aucune route n'est retirée.
  { path: 'comptes', loadComponent: () => import('./annuaire-admin').then((m) => m.AnnuaireAdmin) },
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
  // ⚠️ Rattachements Membre→Vérificateur→Assistant (2026-09-01) — « chaines-controle » car
  // « rattachements » est pris (PRMP↔entité, ci-dessus).
  { path: 'chaines-controle', loadComponent: () => import('./chaines-controle').then((m) => m.ChainesControle) },
  // ⚠️ Chronométrage (2026-09-01) — délais standards par étape (PUT réservé à l'Administrateur).
  { path: 'delais-standards', loadComponent: () => import('./delais-standards').then((m) => m.DelaisStandards) },
  { path: 'agpm-seuil', loadComponent: () => import('./agpm-seuil-admin').then((m) => m.AgpmSeuilAdmin) },
  // Écran dédié : journal d'audit paginé et filtré (table, acteur, période) — la table croît sans
  // fin, le CRUD générique en demandait la totalité (⚠️ audit 2026-08-27, C-1).
  { path: 'audit', loadComponent: () => import('./audit-logs-admin').then((m) => m.AuditLogsAdmin) },
  // ⚠️ Lot 6 F1 — route CONSERVÉE, entrée de menu retirée : le journal des connexions devient un
  // onglet du Journal au lot F5, qui retirera alors cette route et sa configuration `SECURITE`.
  { path: 'sessions', loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage), data: { crud: sessionConfig } },
  { path: 'rapports', loadComponent: () => import('../pilotage/rapports-page').then((m) => m.RapportsPage) },
  // ⚠️ Lot 6 F1 — routes CONSERVÉES, entrées de menu retirées (décision Mathieu 2026-09-17) : écrans
  // PRMP réutilisés, de la consultation de données métier et non de l'administration.
  { path: 'ppm-marches', loadComponent: () => import('../prmp/ppm-marches').then((m) => m.PpmMarches) },
  { path: 'marches-previsions', loadComponent: () => import('../prmp/prmp-marches-previsions').then((m) => m.PrmpMarchesPrevisions) },
];
