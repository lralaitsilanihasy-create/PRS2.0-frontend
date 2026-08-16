import { Routes } from '@angular/router';







/** Espace Contrôleur vérificateur (lazy, sous roleGuard VERIFICATEUR). */
export const VERIFICATEUR_ROUTES: Routes = [
  { path: '', redirectTo: 'a-verifier', pathMatch: 'full' },
  {
    path: 'a-verifier',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Dossiers à vérifier', timeline: false, source: 'a-verifier', verifAction: true },
  },
  {
    path: 'verifies',
    loadComponent: () => import('../circuit/dossiers-clotures').then((m) => m.DossiersClotures),
    data: { title: 'Dossiers vérifiés / clôturés', source: 'verifies' },
  },
  { path: 'verifier/:idDossier', loadComponent: () => import('./verifier-dossier').then((m) => m.VerifierDossier) },
  // Retiré du menu (demande user 2026-08-04) : redondant avec « À vérifier ». Route conservée.
  { path: 'en-attente-prmp', loadComponent: () => import('./en-attente-prmp').then((m) => m.EnAttentePrmp) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
