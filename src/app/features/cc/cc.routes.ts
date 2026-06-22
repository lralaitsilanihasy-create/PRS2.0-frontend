import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DispatchsList } from '../circuit/dispatchs-list';
import { MembrePv } from '../membre/pv-page';
import { PpmMarches } from '../prmp/ppm-marches';
import { PrmpMarchesPrevisions } from '../prmp/prmp-marches-previsions';
import { SNAPSHOT_STATS_CONFIG } from '../pilotage/pilotage-resources.config';
import { RetraitsValidation } from '../circuit/retraits-validation';
import { Messagerie } from '../transverse/messagerie';

/** Espace Chef de commission (lazy, sous roleGuard CHEF_COMMISSION). */
export const CC_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers de ma localité' },
  },
  // Plus de page intermédiaire à tuiles : « circuit » redirige vers le dispatch (entrées directes au menu).
  { path: 'circuit', redirectTo: 'circuit/dispatch', pathMatch: 'full' },
  { path: 'circuit/dispatch', component: DispatchsList },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'retraits', component: RetraitsValidation },
  { path: 'statistiques', component: CrudPage, data: { crud: SNAPSHOT_STATS_CONFIG } },
  { path: 'messagerie', component: Messagerie },
  { path: 'ppm-marches', component: PpmMarches },
  { path: 'marches-previsions', component: PrmpMarchesPrevisions },
];
