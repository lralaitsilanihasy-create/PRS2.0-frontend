import { Routes } from '@angular/router';

/** Espace Membre (lazy, sous roleGuard MEMBRE). */
export const MEMBRE_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Dossiers de ma localité' },
  },
  // ⚠️ Demande pilote (2026-09-13) — « Mes dossiers » (cartes type × statut) RETIRÉ du menu : « Tous
  // les dossiers » (pipeline) porte déjà À examiner / Examinés avec les actions inline (Examiner /
  // Réexaminer / Modifier l'examen) et la pastille « à examiner ». Ancien lien redirigé pour ne pas
  // casser un signet ou une notification. (MEMBRE_GROUPES reste dans classement-config, encore
  // utilisé — via GROUPES_MES_EXAMENS — par l'écran « Dossiers à examiner » monté chez P/CC.)
  { path: 'mes-dossiers', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  { path: 'examiner/:idDossier', loadComponent: () => import('./examen-dossier').then((m) => m.ExamenDossier), data: { title: 'Examiner un dossier' } },
  { path: 'pv', loadComponent: () => import('./pv-page').then((m) => m.MembrePv) },
  { path: 'lettre-renvois', loadComponent: () => import('./lettre-renvois').then((m) => m.LettreRenvoiList) },
  { path: 'pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
