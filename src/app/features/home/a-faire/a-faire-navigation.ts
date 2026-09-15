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

/** Où conduit `geste` pour la tâche `t`, dans l'espace `espace` (« president », « cc », « prmp »…). */
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
