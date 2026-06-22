import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { EXAMEN_DETAIL_CONFIG } from '../circuit/circuit-resources.config';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { Messagerie } from '../transverse/messagerie';
import { ExamenDossier } from './examen-dossier';
import { MembrePv } from './pv-page';

/** Espace Membre (lazy, sous roleGuard MEMBRE). */
export const MEMBRE_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'examiner/:idDossier', component: ExamenDossier, data: { title: 'Examiner un dossier' } },
  { path: 'examens', component: DossiersPipeline, data: { title: 'Dossiers à examiner', timeline: false, source: 'a-examiner', examenAction: true } },
  { path: 'examines', component: DossiersPipeline, data: { title: 'Dossiers examinés', timeline: false, source: 'examines' } },
  { path: 'examen-details', component: CrudPage, data: { crud: EXAMEN_DETAIL_CONFIG } },
  { path: 'pv', component: MembrePv },
  { path: 'pv-definitifs', component: PvDefinitifs },
  { path: 'messagerie', component: Messagerie },
];
