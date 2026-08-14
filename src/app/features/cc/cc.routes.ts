import { Routes } from '@angular/router';

import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { DossiersClassement, CIRCUIT_GROUPES } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { MembrePv } from '../membre/pv-page';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { ResultatExamen } from '../circuit/resultat-examen';
import { PpmMarches } from '../prmp/ppm-marches';
import { PrmpMarchesPrevisions } from '../prmp/prmp-marches-previsions';
import { KpiDashboard } from '../pilotage/kpi-dashboard';
import { RapportsPage } from '../pilotage/rapports-page';
import { RetraitsValidation } from '../circuit/retraits-validation';
import { Messagerie } from '../transverse/messagerie';
// ⚠️ Délégation ascendante (spec 2026-08-14) — écrans des profils subordonnés montés dans CET espace
// (le roleGuard de l'espace reste inchangé ; les paires actives de t_delegation_profil pilotent
// menus/actions, le backend tranche en dernier ressort).
import { ExamenDossier } from '../membre/examen-dossier';
import { VerifierDossier } from '../verificateur/verifier-dossier';
import { EnAttentePrmp } from '../verificateur/en-attente-prmp';
import { PvAssistant } from '../circuit/pv-assistant';

/** Classement « Mes dossiers » (CC) : cartes par type × {pré-dispatch, dispatch}, scopé à sa localité,
 *  + section « Dispatchs par contrôleur » (les Membres de SA commission — listes scopées serveur). */
const CLASSEMENT_CC = { subtitle: 'Domaine Chef de commission', base: '/cc/mes-dossiers', groupes: CIRCUIT_GROUPES, statDispatchsControleurs: true, retraitsPath: '/cc/retraits' };

/** Espace Chef de commission (lazy, sous roleGuard CHEF_COMMISSION). */
export const CC_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'mes-dossiers', component: DossiersClassement, data: { classement: CLASSEMENT_CC } },
  { path: 'mes-dossiers/:type/:groupe', component: DossiersCircuitListe, data: { classement: CLASSEMENT_CC } },
  // « Dispatch des dossiers » retiré : dossiers dispatchés consultables dans « Mes dossiers ».
  // Même hub que le Président (cf. president.routes.ts) : les deux profils partagent leurs écrans.
  // Les listes s'ouvrent sous les cartes via ces routes ENFANTS, qui portent les mêmes `data` que les
  // routes de premier niveau — sans quoi les lettres perdraient leur caractère signable.
  {
    path: 'resultat-examen',
    component: ResultatExamen,
    children: [
      { path: 'pv', component: MembrePv },
      { path: 'pv-definitifs', component: PvDefinitifs },
      {
        path: 'lettre-renvois',
        component: LettreRenvoiConsultation,
        data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' },
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
  // ⚠️ 2026-08-04 — menu commun Président / Chef de commission (cf. `menuCommission()` dans
  // navigation.ts). `GET /api/rapports/dossiers` autorise bien CHEF_COMMISSION (vérifié 200 avec CCANT01).
  { path: 'rapports', component: RapportsPage },
  // ⚠️ 2026-08-04 — MÊME écran que le Président (demande user) : le tableau de bord KPI remplace la
  // liste d'instantanés, palliatif d'une époque où `/api/kpis/tableau-bord` était réservé Président/Admin.
  // Le backend l'ouvre désormais à CHEF_COMMISSION (vérifié 200 avec CCANT01) et scope les chiffres.
  { path: 'statistiques', component: KpiDashboard },
  { path: 'messagerie', component: Messagerie },
  // Retirés du menu des deux profils (demande user 2026-08-04) ; routes conservées, symétriques du Président.
  { path: 'ppm-marches', component: PpmMarches },
  { path: 'marches-previsions', component: PrmpMarchesPrevisions },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) de sa localité ; `:idLettre` déplie le détail.
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
