import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DossiersClassement, ClassementConfig, ClassementGroupe } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { EXAMEN_DETAIL_CONFIG } from '../circuit/circuit-resources.config';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { Messagerie } from '../transverse/messagerie';
import { ExamenDossier } from './examen-dossier';
import { LettreRenvoiList } from './lettre-renvois';
import { MembrePv } from './pv-page';

/** Groupes du Membre : à examiner (DISPATCHE) vs examinés (historique de la file `/examines`). */
const MEMBRE_GROUPES: ClassementGroupe[] = [
  { key: 'a-examiner', label: 'À examiner', statuts: ['DISPATCHE'], icon: '🔍', kind: 'a', colonnes: ['dateDispatch'], actionExamen: true },
  { key: 'examines', label: 'Examinés', statuts: ['EXAMINE', 'PV_SIGNE', 'EN_VERIFICATION', 'CLOTURE'], icon: '✅', kind: 'b', colonnes: ['dateDispatch'] },
];

/** Classement « Mes dossiers » (Membre) : cartes par type × {à examiner, examinés}, SES dossiers attribués. */
const CLASSEMENT_MEMBRE: ClassementConfig = { subtitle: 'Domaine Membre', base: '/membre/mes-dossiers', groupes: MEMBRE_GROUPES, source: 'membre' };

/** Espace Membre (lazy, sous roleGuard MEMBRE). */
export const MEMBRE_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'mes-dossiers', component: DossiersClassement, data: { classement: CLASSEMENT_MEMBRE } },
  { path: 'mes-dossiers/:type/:groupe', component: DossiersCircuitListe, data: { classement: CLASSEMENT_MEMBRE } },
  { path: 'examiner/:idDossier', component: ExamenDossier, data: { title: 'Examiner un dossier' } },
  { path: 'examens', component: DossiersPipeline, data: { title: 'Dossiers à examiner', timeline: false, source: 'a-examiner', examenAction: true } },
  { path: 'examines', component: DossiersPipeline, data: { title: 'Dossiers examinés', timeline: false, source: 'examines' } },
  { path: 'examen-details', component: CrudPage, data: { crud: EXAMEN_DETAIL_CONFIG } },
  { path: 'pv', component: MembrePv },
  { path: 'lettre-renvois', component: LettreRenvoiList },
  { path: 'pv-definitifs', component: PvDefinitifs },
  { path: 'messagerie', component: Messagerie },
];
