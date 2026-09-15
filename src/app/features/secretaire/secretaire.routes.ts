import { Routes } from '@angular/router';

/**
 * Espace Secrétaire (lazy, sous roleGuard SECRETAIRE).
 * ⚠️ Demande pilote (2026-09-13) — « Mes dossiers » (cartes par type × {réceptions, enregistrés})
 * RETIRÉ : « Tous les dossiers » (pipeline partagé) porte à plat les réceptions + enregistrés, avec
 * l'action « Numéroter » inline. Atterrissage sur « Tous les dossiers ».
 */
export const SECRETAIRE_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  // Refonte ergonomique (2026-09-15) — accueil « À faire » : les gestes que le serveur attribue au connecté
  // (demande 2026-09-14-accueil-a-faire). Monté dans l'espace pour que chaque geste y reste.
  { path: 'a-faire', loadComponent: () => import('../home/a-faire').then((m) => m.AFaireEcran), data: { title: 'À faire' } },
  { path: 'tableau-de-bord', loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline), data: { title: 'Tous les dossiers' } },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
