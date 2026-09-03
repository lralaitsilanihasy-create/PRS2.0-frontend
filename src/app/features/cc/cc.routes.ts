import { Routes } from '@angular/router';


import { CIRCUIT_GROUPES, MEMBRE_GROUPES } from '../circuit/dossiers-classement';











// ⚠️ Délégation ascendante (spec 2026-08-14) — écrans des profils subordonnés montés dans CET espace
// (le roleGuard de l'espace reste inchangé ; les paires actives de t_delegation_profil pilotent
// menus/actions, le backend tranche en dernier ressort).





/** Classement « Mes dossiers » (CC) : cartes par type × {pré-dispatch, dispatch}, scopé à sa localité,
 *  + section « Dispatchs par contrôleur » (les Membres de SA commission — listes scopées serveur). */
const CLASSEMENT_CC = { subtitle: 'Domaine Chef de commission', base: '/cc/mes-dossiers', groupes: CIRCUIT_GROUPES, statDispatchsControleurs: true, retraitsPath: '/cc/retraits' };

/** ⚠️ Demande pilote (2026-09-03) — files du Membre chez le CC : le CC attributaire d'un dossier
 *  dispatché par le Président retrouve « À examiner » / « Examinés » (files IM-scopées serveur),
 *  comme un Membre. Entrée de menu conditionnée à la paire CC → Membre (délégation). */
const CLASSEMENT_EXAMEN_CC = { subtitle: 'Domaine Chef de commission', titre: 'Dossiers à examiner', base: '/cc/examen-dossiers', groupes: MEMBRE_GROUPES, source: 'membre' as const };

/** Espace Chef de commission (lazy, sous roleGuard CHEF_COMMISSION). */
export const CC_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Dossiers de ma localité' },
  },
  { path: 'mes-dossiers', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_CC } },
  { path: 'mes-dossiers/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_CC } },
  { path: 'examen-dossiers', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_EXAMEN_CC } },
  { path: 'examen-dossiers/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_EXAMEN_CC } },
  // ⚠️ Rattachements (2026-09-01) — chaînes Membre→Vérificateur→Assistant : le CC administre SA localité (scopé serveur).
  { path: 'chaines-controle', loadComponent: () => import('../admin/chaines-controle').then((m) => m.ChainesControle) },
  // « Dispatch des dossiers » retiré : dossiers dispatchés consultables dans « Mes dossiers ».
  // Même hub que le Président (cf. president.routes.ts) : les deux profils partagent leurs écrans.
  // Les listes s'ouvrent sous les cartes via ces routes ENFANTS, qui portent les mêmes `data` que les
  // routes de premier niveau — sans quoi les lettres perdraient leur caractère signable.
  {
    path: 'resultat-examen',
    loadComponent: () => import('../circuit/resultat-examen').then((m) => m.ResultatExamen),
    children: [
      { path: 'pv', loadComponent: () => import('../membre/pv-page').then((m) => m.MembrePv) },
      { path: 'pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
      {
        path: 'lettre-renvois',
        loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation),
        data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' },
      },
    ],
  },
  { path: 'circuit', redirectTo: 'circuit/pv', pathMatch: 'full' },
  { path: 'circuit/pv', loadComponent: () => import('../membre/pv-page').then((m) => m.MembrePv) },
  { path: 'circuit/pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
  { path: 'retraits', loadComponent: () => import('../circuit/retraits-validation').then((m) => m.RetraitsValidation) },
  // — Délégation ascendante : tâches des subordonnés exercées DANS cet espace (paires en base). —
  { path: 'examiner/:idDossier', loadComponent: () => import('../membre/examen-dossier').then((m) => m.ExamenDossier), data: { title: 'Examiner un dossier' } },
  { path: 'verifications', loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline), data: { title: 'Dossiers à vérifier', timeline: false, source: 'a-verifier', verifAction: true } },
  { path: 'verifier/:idDossier', loadComponent: () => import('../verificateur/verifier-dossier').then((m) => m.VerifierDossier) },
  { path: 'en-attente-prmp', loadComponent: () => import('../verificateur/en-attente-prmp').then((m) => m.EnAttentePrmp) },
  { path: 'pv-examens', loadComponent: () => import('../circuit/pv-assistant').then((m) => m.PvAssistant) },
  { path: 'pv-examens/:idPv', loadComponent: () => import('../circuit/pv-assistant').then((m) => m.PvAssistant) },
  // ⚠️ 2026-08-04 — menu commun Président / Chef de commission (cf. `menuCommission()` dans
  // navigation.ts). `GET /api/rapports/dossiers` autorise bien CHEF_COMMISSION (vérifié 200 avec CCANT01).
  { path: 'rapports', loadComponent: () => import('../pilotage/rapports-page').then((m) => m.RapportsPage) },
  // ⚠️ 2026-08-04 — MÊME écran que le Président (demande user) : le tableau de bord KPI remplace la
  // liste d'instantanés, palliatif d'une époque où `/api/kpis/tableau-bord` était réservé Président/Admin.
  // Le backend l'ouvre désormais à CHEF_COMMISSION (vérifié 200 avec CCANT01) et scope les chiffres.
  { path: 'statistiques', loadComponent: () => import('../pilotage/kpi-dashboard').then((m) => m.KpiDashboard) },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
  // Retirés du menu des deux profils (demande user 2026-08-04) ; routes conservées, symétriques du Président.
  { path: 'ppm-marches', loadComponent: () => import('../prmp/ppm-marches').then((m) => m.PpmMarches) },
  { path: 'marches-previsions', loadComponent: () => import('../prmp/prmp-marches-previsions').then((m) => m.PrmpMarchesPrevisions) },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) de sa localité ; `:idLettre` déplie le détail.
  { path: 'lettre-renvois', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
