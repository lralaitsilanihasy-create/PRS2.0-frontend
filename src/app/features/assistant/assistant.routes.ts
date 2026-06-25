import { Routes } from '@angular/router';

import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvAssistant } from '../circuit/pv-assistant';
import { Messagerie } from '../transverse/messagerie';

/** Espace Assistant contrôleur (lazy, sous roleGuard ASSISTANT_CONTROLEUR) — lecture seule. */
export const ASSISTANT_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  { path: 'tableau-de-bord', component: DossiersPipeline, data: { title: 'Dossiers de ma localité' } },
  // `:idLettre` / `:idPv` : liens de notification (LETTRE_RENVOI_COPIE / PV_DEFINITIF_COPIE / CLOTURE_COPIE_ASSISTANT).
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'localite', title: 'Lettres de renvoi reçues' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'localite', title: 'Lettres de renvoi reçues' } },
  { path: 'pv-examens', component: PvAssistant },
  { path: 'pv-examens/:idPv', component: PvAssistant },
  { path: 'messagerie', component: Messagerie },
];
