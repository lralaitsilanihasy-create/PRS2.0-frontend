import { AFaireTache, GesteAFaire } from '../../../models';

/**
 * Geste → écran EXISTANT qui le porte (accueil « À faire »). Recensement du 2026-09-15 :
 *
 * - les gestes dont l'écran s'ouvre par une URL ciblée partent vers cette URL, dans l'espace du profil
 *   (examen, vérification, gestion du PV `?gerer=<idPv>`, lettre `:idLettre`, archivage `:idPv`,
 *   reprise d'un brouillon `?reprendre=`, rectification) ;
 * - ceux dont l'écran est une MODALE sans lien profond (réception, dispatch unitaire ou en lot,
 *   réattribution, pièces du dépôt, consultation) ouvrent cette même modale par-dessus l'accueil —
 *   « Tous les dossiers », qui les porte aussi, est paginé et ne sait pas cibler un dossier ;
 * - la décision de retrait n'a pas d'ouverture ciblée : la liste des demandes s'ouvre.
 *
 * Une référence manquante (`refs`) fait retomber sur la liste de l'écran, ou sur la consultation.
 *
 * ⚠️ Lot L4-F6 (2026-09-16) : l'accueil n'appelle plus `cibleGeste` directement, mais `cibleAccueil`,
 * qui envoie la consultation et les gestes courts sur la PAGE du dossier (décision 2). `cibleGeste`
 * reste la table des écrans existants — la page dossier s'en sert pour ses propres gestes.
 */

export type ModaleAFaire = 'reception' | 'dispatch' | 'reattribution' | 'pieces-depot' | 'consultation';

export type CibleGeste =
  | {
      type: 'route';
      commandes: (string | number)[];
      queryParams?: Record<string, string | number>;
      /** L'écran s'ouvre sur CE dossier (sinon sur une liste où le retrouver). */
      ciblee: boolean;
    }
  | { type: 'modale'; modale: ModaleAFaire };

/** Famille d'un geste — sert la documentation et les tests (au moins un geste par famille). */
export type FamilleGeste = 'reception' | 'dispatch' | 'examen' | 'pv' | 'lettre' | 'retrait' | 'verification' | 'archivage' | 'prmp' | 'consultation';

export const FAMILLES_GESTES: Readonly<Record<GesteAFaire, FamilleGeste>> = {
  NUMEROTER: 'reception',
  DISPATCHER: 'dispatch',
  REATTRIBUER: 'dispatch',
  EXAMINER: 'examen',
  REEXAMINER: 'examen',
  REPRENDRE_EXAMEN: 'examen',
  SOUMETTRE_PV: 'pv',
  ACCEPTER: 'pv',
  VISER: 'pv',
  RETOURNER: 'pv',
  SIGNER: 'pv',
  SIGNER_LETTRE: 'lettre',
  ARCHIVER_LETTRE: 'lettre',
  DECIDER_RETRAIT: 'retrait',
  VERIFIER: 'verification',
  TRANSMETTRE_DECISION: 'verification',
  TRANSMETTRE_SIGMP: 'verification',
  ARCHIVER_PV: 'archivage',
  SOUMETTRE: 'prmp',
  COMPLETER_BROUILLON: 'prmp',
  COMPLETER_PIECES_DEPOT: 'prmp',
  TRANSMETTRE_COMPLEMENTS: 'prmp',
  RECTIFIER: 'prmp',
  VOIR: 'consultation',
  SUIVRE: 'consultation',
};

const route = (commandes: (string | number)[], ciblee: boolean, queryParams?: Record<string, string | number>): CibleGeste => ({
  type: 'route',
  commandes,
  ciblee,
  ...(queryParams ? { queryParams } : {}),
});
const modale = (m: ModaleAFaire): CibleGeste => ({ type: 'modale', modale: m });

/**
 * Gestes COURTS (décision 2 du plan L4, adoptée par Mathieu le 2026-09-15) : depuis l'accueil, ils
 * ouvrent la PAGE du dossier sur son étape en cours (`?geste=`) — la modale y monte par-dessus
 * (numérotation, dispatch, réattribution, pièces du dépôt), la navette du projet de PV et la décision
 * de retrait s'y jouent dans le panneau. Les écrans de TRAVAIL (examen, vérification, rectification,
 * saisie, lettres, archivage) restent directs. Le dispatch GROUPÉ n'est pas ici : il porte sur
 * plusieurs dossiers et garde sa modale sur l'accueil (plan L4 §4).
 *
 * ⚠️ Invariant testé (`a-faire-navigation.spec.ts`) : cette liste est exactement l'ensemble des gestes
 * que la page exécute chez elle, c'est-à-dire ceux dont `famillePage` (page dossier) n'est pas `lien`.
 */
export const GESTES_SUR_PAGE: readonly GesteAFaire[] = [
  'NUMEROTER',
  'DISPATCHER',
  'REATTRIBUER',
  'COMPLETER_PIECES_DEPOT',
  'SOUMETTRE_PV',
  'ACCEPTER',
  'VISER',
  'RETOURNER',
  'SIGNER',
  'DECIDER_RETRAIT',
];

/**
 * Page d'un dossier (refonte ergonomique, lot L4-F6) : `/<espace>/dossier/:idDossier`, avec `returnUrl`
 * vers l'écran d'origine — le retour arrière y restitue la liste telle qu'on l'a quittée.
 */
export function cibleDossier(idDossier: number, espace: string, retour: string, geste?: GesteAFaire): CibleGeste {
  return route(['/', espace, 'dossier', idDossier], true, geste ? { returnUrl: retour, geste } : { returnUrl: retour });
}

/**
 * Où conduit `geste` DEPUIS L'ACCUEIL (lot L4-F6) : la page du dossier pour la consultation (VOIR,
 * SUIVRE) et pour les gestes courts, l'écran de travail existant sinon (`cibleGeste`). `retour` est
 * l'URL de l'accueil, paramètres compris.
 */
export function cibleAccueil(geste: GesteAFaire, t: AFaireTache, espace: string, retour: string): CibleGeste {
  const id = t.dossier.idDossier;
  if (FAMILLES_GESTES[geste] === 'consultation') return cibleDossier(id, espace, retour);
  if (GESTES_SUR_PAGE.includes(geste)) return cibleDossier(id, espace, retour, geste);
  return cibleGeste(geste, t, espace);
}

/**
 * Où conduit `geste` pour la tâche `t`, dans l'espace `espace` (« president », « cc », « prmp »…).
 *
 * C'est la table des ÉCRANS EXISTANTS, celle que la page dossier réemploie (`ciblePage`) pour ses
 * propres gestes. Depuis l'accueil, passer par `cibleAccueil` : lui seul applique la décision 2.
 */
export function cibleGeste(geste: GesteAFaire, t: AFaireTache, espace: string): CibleGeste {
  const base = `/${espace}`;
  const id = t.dossier.idDossier;
  const { idPv, idLettre, idReception, idDispatch } = t.refs;
  switch (geste) {
    case 'NUMEROTER':
      return modale('reception');
    case 'DISPATCHER':
      return idReception != null ? modale('dispatch') : modale('consultation');
    case 'REATTRIBUER':
      return idReception != null && idDispatch != null ? modale('reattribution') : modale('consultation');
    case 'EXAMINER':
    case 'REEXAMINER':
    case 'REPRENDRE_EXAMEN':
      return route([base, 'examiner', id], true);
    case 'SOUMETTRE_PV':
    case 'ACCEPTER':
    case 'VISER':
    case 'RETOURNER':
    case 'SIGNER':
      return idPv != null ? route([base, 'resultat-examen', 'pv'], true, { gerer: idPv }) : route([base, 'resultat-examen', 'pv'], false);
    case 'SIGNER_LETTRE':
    case 'ARCHIVER_LETTRE':
      return idLettre != null ? route([base, 'lettre-renvois', idLettre], true) : route([base, 'lettre-renvois'], false);
    case 'DECIDER_RETRAIT':
      return route([base, 'retraits'], false);
    case 'VERIFIER':
    case 'TRANSMETTRE_DECISION':
    case 'TRANSMETTRE_SIGMP':
      return route([base, 'verifier', id], true);
    case 'ARCHIVER_PV':
      return idPv != null ? route([base, 'pv-examens', idPv], true) : route([base, 'pv-examens'], false);
    case 'SOUMETTRE':
    case 'COMPLETER_BROUILLON':
      return route([base, 'soumettre-dossier'], true, { reprendre: id });
    case 'COMPLETER_PIECES_DEPOT':
      return modale('pieces-depot');
    case 'TRANSMETTRE_COMPLEMENTS':
      return idLettre != null
        ? route([base, 'resultat-examen', 'lettre-renvois', idLettre], true)
        : route([base, 'resultat-examen', 'lettre-renvois'], false);
    case 'RECTIFIER':
      return route([base, 'rectifier', id], true, { returnUrl: `${base}/a-faire` });
    case 'VOIR':
    case 'SUIVRE':
      return modale('consultation');
  }
}
