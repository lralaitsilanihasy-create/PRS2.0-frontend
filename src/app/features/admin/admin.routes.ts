import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { SectionHome } from '../../shared/ui/section-home';
import { KpiDashboard } from '../pilotage/kpi-dashboard';
import { RapportsPage } from '../pilotage/rapports-page';
import { EntiteArbre } from './entite-arbre';
import { ControleurAdmin } from './controleur-admin';
import { DmcMappingAdmin } from './dmc-mapping-admin';
import { InscriptionsAdmin } from './inscriptions-admin';
import { PrmpAdmin } from './prmp-admin';
import { PrmpPiecesAdmin } from './prmp-pieces-admin';
import { UgpmAdmin } from './ugpm-admin';
import { UgpmPiecesAdmin } from './ugpm-pieces-admin';
import { PpmMarches } from '../prmp/ppm-marches';
import { PrmpMarchesPrevisions } from '../prmp/prmp-marches-previsions';
import { COMPTES, REFERENTIELS, SECURITE } from './admin-resources.config';

const refLinks = [
  ...REFERENTIELS.map((r) => ({
    label: r.config.title,
    path: `/admin/referentiels/${r.slug}`,
  })),
  // Écran dédié : mapping mode de passation → type de DMC (PUT sur les modes ; pas un CRUD générique).
  { label: 'Mapping mode → type de DMC', path: '/admin/referentiels/dmc-mapping' },
];
const compteLinks = [
  ...COMPTES.map((r) => ({
    label: r.config.title,
    path: `/admin/comptes/${r.slug}`,
  })),
  // Écran dédié (POST /api/ugpms : création UGPM + compte ; pas de CRUD générique).
  { label: 'UGPM (unités de gestion)', path: '/admin/comptes/ugpms' },
];
const auditConfig = SECURITE.find((r) => r.slug === 'audit-logs')!.config;
const sessionConfig = SECURITE.find((r) => r.slug === 'session-utilisateurs')!.config;

/**
 * Routes de l'espace administration (chargées en lazy, sous roleGuard ADMINISTRATEUR).
 * Chaque ressource réutilise `CrudPage` ; sa configuration est passée via `data.crud`.
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },

  { path: 'tableau-de-bord', component: KpiDashboard },

  {
    path: 'referentiels',
    component: SectionHome,
    data: { title: 'Référentiels', links: refLinks },
  },
  { path: 'referentiels/entite-arbre', component: EntiteArbre },
  { path: 'referentiels/dmc-mapping', component: DmcMappingAdmin },
  ...REFERENTIELS.map((r) => ({
    path: `referentiels/${r.slug}`,
    component: CrudPage,
    data: { crud: r.config },
  })),

  {
    path: 'comptes',
    component: SectionHome,
    data: { title: 'Comptes & hiérarchie', links: compteLinks },
  },
  // PRMP et contrôleur ont un écran dédié (fiche + photo/pièces) ; les autres ressources « comptes » sont génériques.
  ...COMPTES.filter((r) => r.slug !== 'prmps' && r.slug !== 'controleurs').map((r) => ({
    path: `comptes/${r.slug}`,
    component: CrudPage,
    data: { crud: r.config },
  })),
  { path: 'comptes/prmps', component: PrmpAdmin },
  { path: 'comptes/controleurs', component: ControleurAdmin },
  { path: 'comptes/ugpms', component: UgpmAdmin },
  { path: 'comptes/prmp-pieces', component: PrmpPiecesAdmin },
  { path: 'comptes/ugpm-pieces', component: UgpmPiecesAdmin },

  { path: 'inscriptions', component: InscriptionsAdmin },
  { path: 'audit', component: CrudPage, data: { crud: auditConfig } },
  { path: 'sessions', component: CrudPage, data: { crud: sessionConfig } },
  { path: 'rapports', component: RapportsPage },
  { path: 'ppm-marches', component: PpmMarches },
  { path: 'marches-previsions', component: PrmpMarchesPrevisions },
];
