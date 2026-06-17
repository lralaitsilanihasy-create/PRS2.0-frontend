import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { SectionHome } from '../../shared/ui/section-home';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DispatchsList } from '../circuit/dispatchs-list';
import { ECHEANCE_CONFIG } from '../circuit/circuit-resources.config';
import { MembrePv } from '../membre/pv-page';
import { KpiDashboard } from '../pilotage/kpi-dashboard';
import { RapportsPage } from '../pilotage/rapports-page';
import { PresidentPpmMarches } from './president-ppm-marches';
import { PresidentPreDispatch } from './pre-dispatch';

/** Espace Président (lazy, sous roleGuard PRESIDENT). */
export const PRESIDENT_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Pipeline — toutes localités' },
  },
  { path: 'pre-dispatch', component: PresidentPreDispatch },
  {
    path: 'circuit',
    component: SectionHome,
    data: {
      title: 'Circuit de contrôle',
      links: [
        { label: 'Dispatch des dossiers', path: '/president/circuit/dispatch' },
        { label: 'Projets de PV', path: '/president/circuit/pv' },
      ],
    },
  },
  { path: 'circuit/dispatch', component: DispatchsList },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
  { path: 'rapports', component: RapportsPage },
  { path: 'statistiques', component: KpiDashboard },
  { path: 'ppm-marches', component: PresidentPpmMarches },
];
