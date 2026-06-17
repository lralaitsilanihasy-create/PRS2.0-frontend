import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { VERIFICATION_CONFIG } from '../circuit/circuit-resources.config';
import { Messagerie } from '../transverse/messagerie';

/** Espace Contrôleur vérificateur (lazy, sous roleGuard VERIFICATEUR). */
export const VERIFICATEUR_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers à vérifier' },
  },
  { path: 'verifications', component: CrudPage, data: { crud: VERIFICATION_CONFIG } },
  { path: 'messagerie', component: Messagerie },
];
