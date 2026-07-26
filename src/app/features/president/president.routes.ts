import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DossiersClassement, CIRCUIT_GROUPES } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { ECHEANCE_CONFIG } from '../circuit/circuit-resources.config';
import { MembrePv } from '../membre/pv-page';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { RetraitsValidation } from '../circuit/retraits-validation';
import { KpiDashboard } from '../pilotage/kpi-dashboard';
import { RapportsPage } from '../pilotage/rapports-page';
import { PresidentPpmMarches } from './president-ppm-marches';

/** Classement « Mes dossiers » (Président) : cartes par type × {pré-dispatch, dispatch}, toutes localités. */
const CLASSEMENT_PRESIDENT = { subtitle: 'Domaine Président', base: '/president/mes-dossiers', groupes: CIRCUIT_GROUPES };

/** Espace Président (lazy, sous roleGuard PRESIDENT). */
export const PRESIDENT_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Pipeline — toutes localités' },
  },
  { path: 'mes-dossiers', component: DossiersClassement, data: { classement: CLASSEMENT_PRESIDENT } },
  { path: 'mes-dossiers/:type/:groupe', component: DossiersCircuitListe, data: { classement: CLASSEMENT_PRESIDENT } },
  // Pré-dispatch et « Dispatch des dossiers » retirés : classement + action de dispatch dans « Mes dossiers ».
  { path: 'circuit', redirectTo: 'circuit/pv', pathMatch: 'full' },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'circuit/pv-definitifs', component: PvDefinitifs },
  { path: 'retraits', component: RetraitsValidation },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
  { path: 'rapports', component: RapportsPage },
  { path: 'statistiques', component: KpiDashboard },
  { path: 'ppm-marches', component: PresidentPpmMarches },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) ; `:idLettre` (lien de notification) déplie le détail.
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
