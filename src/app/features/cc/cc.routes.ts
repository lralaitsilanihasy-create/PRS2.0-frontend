import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DossiersClassement, CIRCUIT_GROUPES } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { MembrePv } from '../membre/pv-page';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { PpmMarches } from '../prmp/ppm-marches';
import { PrmpMarchesPrevisions } from '../prmp/prmp-marches-previsions';
import { SNAPSHOT_STATS_CONFIG } from '../pilotage/pilotage-resources.config';
import { RetraitsValidation } from '../circuit/retraits-validation';
import { Messagerie } from '../transverse/messagerie';

/** Classement « Mes dossiers » (CC) : cartes par type × {pré-dispatch, dispatch}, scopé à sa localité. */
const CLASSEMENT_CC = { subtitle: 'Domaine Chef de commission', base: '/cc/mes-dossiers', groupes: CIRCUIT_GROUPES };

/** Espace Chef de commission (lazy, sous roleGuard CHEF_COMMISSION). */
export const CC_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'mes-dossiers', component: DossiersClassement, data: { classement: CLASSEMENT_CC } },
  { path: 'mes-dossiers/:type/:groupe', component: DossiersCircuitListe, data: { classement: CLASSEMENT_CC } },
  // « Dispatch des dossiers » retiré : dossiers dispatchés consultables dans « Mes dossiers ».
  { path: 'circuit', redirectTo: 'circuit/pv', pathMatch: 'full' },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'circuit/pv-definitifs', component: PvDefinitifs },
  { path: 'retraits', component: RetraitsValidation },
  { path: 'statistiques', component: CrudPage, data: { crud: SNAPSHOT_STATS_CONFIG } },
  { path: 'messagerie', component: Messagerie },
  { path: 'ppm-marches', component: PpmMarches },
  { path: 'marches-previsions', component: PrmpMarchesPrevisions },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) de sa localité ; `:idLettre` déplie le détail.
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
