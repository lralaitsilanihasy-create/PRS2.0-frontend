import { Routes } from '@angular/router';


import { ClassementConfig, MEMBRE_GROUPES } from '../circuit/dossiers-classement';







// MEMBRE_GROUPES vit dans classement-config (source unique) : partagé avec l'écran
// « Dossiers à examiner » monté chez Président/CC par délégation (2026-09-03).

/** Classement « Mes dossiers » (Membre) : cartes par type × {à examiner, examinés}, SES dossiers attribués. */
const CLASSEMENT_MEMBRE: ClassementConfig = { subtitle: 'Domaine Membre', base: '/membre/mes-dossiers', groupes: MEMBRE_GROUPES, source: 'membre' };

/** Espace Membre (lazy, sous roleGuard MEMBRE). */
export const MEMBRE_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'mes-dossiers', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_MEMBRE } },
  { path: 'mes-dossiers/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_MEMBRE } },
  { path: 'examiner/:idDossier', loadComponent: () => import('./examen-dossier').then((m) => m.ExamenDossier), data: { title: 'Examiner un dossier' } },
  // « Dossiers à examiner », « Dossiers examinés » et « Détails d'examen » retirés :
  // files + actions Examiner / Modifier l'examen dans « Mes dossiers ».
  { path: 'pv', loadComponent: () => import('./pv-page').then((m) => m.MembrePv) },
  { path: 'lettre-renvois', loadComponent: () => import('./lettre-renvois').then((m) => m.LettreRenvoiList) },
  { path: 'pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
