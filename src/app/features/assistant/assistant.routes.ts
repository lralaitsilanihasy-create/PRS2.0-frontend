import { Routes } from '@angular/router';






/** Espace Assistant contrôleur (lazy, sous roleGuard ASSISTANT_CONTROLEUR) — lecture seule. */
export const ASSISTANT_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  { path: 'tableau-de-bord', loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline), data: { title: 'Dossiers de ma localité' } },
  // `:idLettre` / `:idPv` : liens de notification (LETTRE_RENVOI_COPIE / PV_DEFINITIF_COPIE / CLOTURE_COPIE_ASSISTANT).
  { path: 'lettre-renvois', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', title: 'Lettres de renvoi reçues', archivable: true } },
  { path: 'lettre-renvois/:idLettre', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', title: 'Lettres de renvoi reçues', archivable: true } },
  { path: 'pv-examens', loadComponent: () => import('../circuit/pv-assistant').then((m) => m.PvAssistant) },
  { path: 'pv-examens/:idPv', loadComponent: () => import('../circuit/pv-assistant').then((m) => m.PvAssistant) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
