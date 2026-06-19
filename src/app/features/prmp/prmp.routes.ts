import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { ECHEANCE_CONFIG, PPM_CONFIG } from '../circuit/circuit-resources.config';
import { MesBrouillons } from './mes-brouillons';
import { PrmpDashboard } from './prmp-dashboard';
import { MesPpmMarches } from './mes-ppm-marches';
import { PrmpRetraits } from './retraits';
import { SoumettreDossier } from './soumettre-dossier';

/** Espace PRMP (lazy, sous roleGuard PRMP). */
export const PRMP_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: PrmpDashboard,
    data: { title: 'Mes dossiers' },
  },
  { path: 'ppm', component: CrudPage, data: { crud: PPM_CONFIG } },
  { path: 'soumettre-dossier', component: SoumettreDossier },
  { path: 'mes-brouillons', component: MesBrouillons },
  { path: 'ppm-marches', component: MesPpmMarches },
  { path: 'retraits', component: PrmpRetraits },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
];
