import { Routes } from '@angular/router';

import { Messagerie } from '../transverse/messagerie';
import { SecretaireDashboard } from './secretaire-dashboard';
import { SecretaireEnregistrement } from './enregistrement';
import { SecretaireReceptions } from './receptions';

/** Espace Secrétaire (lazy, sous roleGuard SECRETAIRE). */
export const SECRETAIRE_ROUTES: Routes = [
  { path: '', redirectTo: 'receptions', pathMatch: 'full' },
  { path: 'tableau-de-bord', component: SecretaireDashboard },
  { path: 'receptions', component: SecretaireReceptions },
  { path: 'enregistrement', component: SecretaireEnregistrement },
  { path: 'messagerie', component: Messagerie },
];
