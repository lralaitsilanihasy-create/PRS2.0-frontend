import { Routes } from '@angular/router';


import { CIRCUIT_GROUPES, GROUPE_ENREGISTREMENT, GROUPE_RECEPTIONS } from '../circuit/dossiers-classement';











// ⚠️ Délégation ascendante (spec 2026-08-14) — écrans des profils subordonnés montés dans CET espace
// (le roleGuard de l'espace reste inchangé ; les paires actives de t_delegation_profil pilotent
// menus/actions, le backend tranche en dernier ressort).





/** Classement « Mes dossiers » (Président) : cartes par type × {pré-dispatch, dispatch}, toutes localités,
 *  + section « Dispatchs par contrôleur » sous le classement. */
const CLASSEMENT_PRESIDENT = { subtitle: 'Domaine Président', base: '/president/mes-dossiers', groupes: CIRCUIT_GROUPES, statDispatchsControleurs: true, retraitsPath: '/president/retraits' };

/** ⚠️ Demande pilote (2026-09-03) — les tâches du Secrétaire quittent les cartes de « Mes dossiers »
 *  pour UNE entrée de menu « Exercé par délégation » (les deux groupes COMBINÉS — le dépôt entre en
 *  Réceptions et ressort en Enregistrés, un seul écran suffit). */
const CLASSEMENT_SECRETARIAT_PRESIDENT = { subtitle: 'Domaine Président', titre: 'Réceptions & Enregistrés', base: '/president/secretariat', groupes: [GROUPE_RECEPTIONS, GROUPE_ENREGISTREMENT] };

/** Espace Président (lazy, sous roleGuard PRESIDENT). */
export const PRESIDENT_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Pipeline — toutes localités' },
  },
  { path: 'mes-dossiers', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_PRESIDENT } },
  { path: 'mes-dossiers/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_PRESIDENT } },
  { path: 'secretariat', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_SECRETARIAT_PRESIDENT } },
  { path: 'secretariat/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_SECRETARIAT_PRESIDENT } },
  // ⚠️ Rattachements (2026-09-01) — chaînes Membre→Vérificateur→Assistant : le Président administre partout.
  { path: 'chaines-controle', loadComponent: () => import('../admin/chaines-controle').then((m) => m.ChainesControle) },
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
    loadComponent: () => import('../circuit/resultat-examen').then((m) => m.ResultatExamen),
    children: [
      { path: 'pv', loadComponent: () => import('../membre/pv-page').then((m) => m.MembrePv) },
      { path: 'pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
      {
        path: 'lettre-renvois',
        loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation),
        data: { source: 'localite', signable: true, title: 'Lettres de renvoi' },
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
  { path: 'rapports', loadComponent: () => import('../pilotage/rapports-page').then((m) => m.RapportsPage) },
  { path: 'statistiques', loadComponent: () => import('../pilotage/kpi-dashboard').then((m) => m.KpiDashboard) },
  // ⚠️ 2026-08-04 — menu commun Président / Chef de commission (cf. `menuCommission()` dans
  // navigation.ts) : mêmes écrans partagés, périmètre scopé par le backend (national ici).
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
  // Retirés du menu des deux profils (demande user 2026-08-04) ; routes conservées, symétriques du CC.
  { path: 'ppm-marches', loadComponent: () => import('../prmp/ppm-marches').then((m) => m.PpmMarches) },
  { path: 'marches-previsions', loadComponent: () => import('../prmp/prmp-marches-previsions').then((m) => m.PrmpMarchesPrevisions) },
  // Lettres de renvoi à signer (SOUMIS → SIGNE) ; `:idLettre` (lien de notification) déplie le détail.
  { path: 'lettre-renvois', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
  { path: 'lettre-renvois/:idLettre', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'localite', signable: true, title: 'Lettres de renvoi à signer' } },
];
