import { Routes } from '@angular/router';

import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { Messagerie } from '../transverse/messagerie';
import { VerifierDossier } from './verifier-dossier';

/** Espace Contrôleur vérificateur (lazy, sous roleGuard VERIFICATEUR). */
export const VERIFICATEUR_ROUTES: Routes = [
  { path: '', redirectTo: 'a-verifier', pathMatch: 'full' },
  {
    path: 'a-verifier',
    component: DossiersPipeline,
    data: { title: 'Dossiers à vérifier', timeline: false, source: 'a-verifier', verifAction: true },
  },
  {
    path: 'verifies',
    component: DossiersPipeline,
    data: { title: 'Dossiers vérifiés / clôturés', timeline: false, source: 'verifies' },
  },
  { path: 'verifier/:idDossier', component: VerifierDossier },
  { path: 'messagerie', component: Messagerie },
];
