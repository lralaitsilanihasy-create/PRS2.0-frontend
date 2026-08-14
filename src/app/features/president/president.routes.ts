import { Routes } from '@angular/router';

import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DossiersClassement, CIRCUIT_GROUPES } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { MembrePv } from '../membre/pv-page';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { ResultatExamen } from '../circuit/resultat-examen';
import { RetraitsValidation } from '../circuit/retraits-validation';
import { KpiDashboard } from '../pilotage/kpi-dashboard';
import { RapportsPage } from '../pilotage/rapports-page';
import { PpmMarches } from '../prmp/ppm-marches';
import { PrmpMarchesPrevisions } from '../prmp/prmp-marches-previsions';
import { Messagerie } from '../transverse/messagerie';
// ⚠️ Délégation ascendante (spec 2026-08-14) — écrans des profils subordonnés montés dans CET espace
// (le roleGuard de l'espace reste inchangé ; les paires actives de t_delegation_profil pilotent
// menus/actions, le backend tranche en dernier ressort).
import { ExamenDossier } from '../membre/examen-dossier';
import { VerifierDossier } from '../verificateur/verifier-dossier';
import { EnAttentePrmp } from '../verificateur/en-attente-prmp';
import { PvAssistant } from '../circuit/pv-assistant';

/** Classement « Mes dossiers » (Président) : cartes par type × {pré-dispatch, dispatch}, toutes localités,
 *  + section « Dispatchs par contrôleur » sous le classement. */
const CLASSEMENT_PRESIDENT = { subtitle: 'Domaine Président', base: '/president/mes-dossiers', groupes: CIRCUIT_GROUPES, statDispatchsControleurs: true, retraitsPath: '/president/retraits' };

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
  // « Dispatchs par contrôleur » : section embarquée dans « Mes dossiers » (plus d'écran dédié).
  // Pré-dispatch et « Dispatch des dossiers » retirés : classement + action de dispatch dans « Mes dossiers ».
  // ⚠️ 2026-08-06 (demande user) — hub « Résultat examen » : une seule entrée de menu pour les trois
  // écrans produits par l'examen (projets de PV, PV définitifs, lettres de renvoi). Les routes des
  // trois écrans restent inchangées, le hub ne fait que les rassembler.
  // ⚠️ 2026-08-07 — la liste s'ouvre JUSTE SOUS les cartes : routes ENFANTS + `router-outlet` dans le
  // hub. Chaque écran conserve ainsi ses `data` de route (ici `signable` pour les lettres), ce qu'un
  // simple encastrement de composant aurait perdu.
  {
    path: 'resultat-examen',
    component: ResultatExamen,
    children: [
      { path: 'pv', component: MembrePv },
      { path: 'pv-definitifs', component: PvDefinitifs },
      {
        path: 'lettre-renvois',
        component: LettreRenvoiConsultation,
        data: { source: 'localite', signable: true, title: 'Lettres de renvoi' },
      },
    ],
  },
  { path: 'circuit', redirectTo: 'circuit/pv', pathMatch: 'full' },
  { path: 'circuit/pv', component: MembrePv },
  { path: 'circuit/pv-definitifs', component: PvDefinitifs },
  { path: 'retraits', component: RetraitsValidation },
  // — Délégation ascendante : tâches des subordonnés exercées DANS cet espace (paires en base). —
  { path: 'examiner/:idDossier', component: ExamenDossier, data: { title: 'Examiner un dossier' } },
  { path: 'verifications', component: DossiersPipeline, data: { title: 'Dossiers à vérifier', timeline: false, source: 'a-verifier', verifAction: true } },
  { path: 'verifier/:idDossier', component: VerifierDossier },
  { path: 'en-attente-prmp', component: EnAttentePrmp },
  { path: 'pv-examens', component: PvAssistant },
  { path: 'pv-examens/:idPv', component: PvAssistant },
  { path: 'rapports', component: RapportsPage },
  { path: 'statistiques', component: KpiDashboard },
  // ⚠️ 2026-08-04 — menu commun Président / Chef de commission (cf. `menuCommission()` dans
  // navigation.ts) : mêmes écrans partagés, périmètre scopé par le backend (national ici).
  { path: 'messagerie', component: Messagerie },
  // Retirés du menu des deux profils (demande user 2026-08-04) ; routes conservées, symétriques du CC.
  { path: 'ppm-marches', component: PpmMarches },
  { path: 'marches-previsions', component: PrmpMarchesPrevisions },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) ; `:idLettre` (lien de notification) déplie le détail.
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
