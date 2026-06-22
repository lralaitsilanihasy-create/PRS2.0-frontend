import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DispatchsList } from '../circuit/dispatchs-list';
import { ECHEANCE_CONFIG } from '../circuit/circuit-resources.config';
import { MembrePv } from '../membre/pv-page';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { RetraitsValidation } from '../circuit/retraits-validation';
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
  // Plus de page intermédiaire à tuiles : « circuit » redirige vers le dispatch (entrées directes au menu).
  { path: 'circuit', redirectTo: 'circuit/dispatch', pathMatch: 'full' },
  { path: 'circuit/dispatch', component: DispatchsList },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'circuit/pv-definitifs', component: PvDefinitifs },
  { path: 'retraits', component: RetraitsValidation },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
  { path: 'rapports', component: RapportsPage },
  { path: 'statistiques', component: KpiDashboard },
  { path: 'ppm-marches', component: PresidentPpmMarches },
];
