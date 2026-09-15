import { Routes } from '@angular/router';







/** Espace Contrôleur vérificateur (lazy, sous roleGuard VERIFICATEUR). */
export const VERIFICATEUR_ROUTES: Routes = [
  { path: '', redirectTo: 'a-verifier', pathMatch: 'full' },
  // Refonte ergonomique (2026-09-15) — accueil « À faire » : les gestes que le serveur attribue au connecté
  // (demande 2026-09-14-accueil-a-faire). Monté dans l'espace pour que chaque geste y reste.
  { path: 'a-faire', loadComponent: () => import('../home/a-faire').then((m) => m.AFaireEcran), data: { title: 'À faire' } },
  // Refonte ergonomique (lot L4-F2) — page d'un dossier, en lecture seule ; alias partageable `/dossier/:idDossier`.
  { path: 'dossier/:idDossier', loadComponent: () => import('../circuit/page-dossier/page-dossier').then((m) => m.PageDossier), data: { title: 'Dossier', concentration: true } },
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
  // Refonte ergonomique (2026-09-15) — mode « concentration », comme l'examen : la barre latérale se range en
  // tiroir et le plan de passation retrouve sa largeur (fluide, sans défilement horizontal à 1366 px).
  { path: 'verifier/:idDossier', loadComponent: () => import('./verifier-dossier').then((m) => m.VerifierDossier), data: { title: 'Vérifier un dossier', concentration: true } },
  // Retiré du menu (demande user 2026-08-04) : redondant avec « À vérifier ». Route conservée.
  { path: 'en-attente-prmp', loadComponent: () => import('./en-attente-prmp').then((m) => m.EnAttentePrmp) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
