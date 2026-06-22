import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersClotures } from '../circuit/dossiers-clotures';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { ECHEANCE_CONFIG, PPM_CONFIG } from '../circuit/circuit-resources.config';
import { DossiersARectifier } from './dossiers-a-rectifier';
import { MesBrouillons } from './mes-brouillons';
import { MesPpmMarches } from './mes-ppm-marches';
import { PrmpRetraits } from './retraits';
import { RectifierDossier } from './rectifier-dossier';
import { SoumettreDossier } from './soumettre-dossier';

/** Espace PRMP (lazy, sous roleGuard PRMP). */
export const PRMP_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Mes dossiers' },
  },
  { path: 'a-rectifier', component: DossiersARectifier },
  // Formulaire restreint de rectification en place (en-tête PPM + lignes marché) ; returnUrl en query param.
  { path: 'rectifier/:idDossier', component: RectifierDossier },
  { path: 'dossiers-verifies', component: DossiersClotures, data: { title: 'Dossiers vérifiés', source: 'prmp-clotures' } },
  { path: 'ppm', component: CrudPage, data: { crud: PPM_CONFIG } },
  { path: 'soumettre-dossier', component: SoumettreDossier },
  { path: 'mes-brouillons', component: MesBrouillons },
  { path: 'ppm-marches', component: MesPpmMarches },
  { path: 'retraits', component: PrmpRetraits },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
];
