import { Notification } from '../../models';

/**
 * Routage d'une notification vers l'ÉCRAN D'ACTION correspondant (demande user 2026-08-11) :
 * cliquer une notification dirige vers l'écran où l'action attendue s'accomplit — pas une simple
 * consultation. Mapping (typeNotif × rôle) aligné sur la table « Types émis à la transmission » du
 * contrat ; un type non mappé retombe sur le comportement historique de l'appelant (consultation).
 *
 * Utilisé par la PAGE /notifications ET la cloche (notification-center) — source unique.
 */

/** Préfixe d'espace par rôle. */
const BASE: Record<string, string> = {
  PRESIDENT: 'president',
  CHEF_COMMISSION: 'cc',
  MEMBRE: 'membre',
  SECRETAIRE: 'secretaire',
  VERIFICATEUR: 'verificateur',
  ASSISTANT: 'assistant',
  PRMP: 'prmp',
};

/** Profils disposant d'un écran messagerie (routage des notifications MESSAGE). */
const MESSAGERIE: ReadonlySet<string> = new Set(['PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE', 'SECRETAIRE', 'VERIFICATEUR', 'ASSISTANT']);

/** Cible résolue : une route directe, ou une route paramétrée par le type du dossier (avec repli). */
export type CibleNotification =
  | { genre: 'route'; commands: string[] }
  | { genre: 'route-type-dossier'; versCommands: (idTypeDossier: string) => string[]; repli: string[] };

/**
 * Écran d'action d'une notification pour le rôle courant — `null` si aucun mapping (l'appelant garde
 * son comportement par défaut, ex. modal de consultation du dossier).
 */
export function routePourNotification(n: Notification, role: string | null): CibleNotification | null {
  const base = BASE[role ?? ''];
  if (!base) return null;
  const type = n.typeNotif ?? '';

  // — Dossier complet, à dispatcher (Président / CC) → drill-down pré-dispatch de « Mes dossiers »
  //   (l'action Dispatcher y vit) ; le segment :type exige l'idTypeDossier du dossier (résolu par l'appelant).
  if (type === 'PRET_DISPATCH' && (role === 'PRESIDENT' || role === 'CHEF_COMMISSION')) {
    return {
      genre: 'route-type-dossier',
      versCommands: (t) => [`/${base}/mes-dossiers`, t, 'pre-dispatch'],
      repli: [`/${base}/mes-dossiers`],
    };
  }
  // — Dossier soumis → files de réception (Secrétaire) / suivi (CC).
  if (type === 'DOSSIER_SOUMIS') return { genre: 'route', commands: [`/${base}/mes-dossiers`] };
  // — Examen (Membre) : directement l'écran d'examen du dossier.
  if ((type === 'EXAMEN_A_FAIRE' || type === 'PIECE_AJOUTEE_APRES_RENVOI') && role === 'MEMBRE' && n.idDossier != null) {
    return { genre: 'route', commands: ['/membre/examiner', String(n.idDossier)] };
  }
  // — Vérification (Vérificateur) : directement l'écran de vérification du dossier.
  if ((type === 'PV_A_VERIFIER' || type === 'PV_POUR_INFO' || type === 'RECTIFICATION_PRMP') && role === 'VERIFICATEUR' && n.idDossier != null) {
    return { genre: 'route', commands: ['/verificateur/verifier', String(n.idDossier)] };
  }
  // — Projets de PV : validation (Président / CC, hub Résultat examen) ; rectification / acceptation (Membre).
  if (type === 'PV_A_VALIDER' && (role === 'PRESIDENT' || role === 'CHEF_COMMISSION')) {
    return { genre: 'route', commands: [`/${base}/resultat-examen/pv`] };
  }
  if ((type === 'PV_A_RECTIFIER' || type === 'PV_ACCEPTE') && role === 'MEMBRE') {
    return { genre: 'route', commands: ['/membre/pv'] };
  }
  // — PRMP : PV signé (PV définitifs), observations de vérification (à rectifier), lettre de renvoi, retraits.
  if (type === 'PV_SIGNE' && role === 'PRMP') return { genre: 'route', commands: ['/prmp/pv-definitifs'] };
  if (type === 'OBSERVATION_VERIFICATION' && role === 'PRMP') return { genre: 'route', commands: ['/prmp/a-rectifier'] };
  if (type === 'LETTRE_RENVOI_RECUE' && role === 'PRMP') return { genre: 'route', commands: ['/prmp/lettre-renvois'] };
  if ((type === 'RETRAIT_ACCEPTE' || type === 'RETRAIT_REFUSE') && role === 'PRMP') {
    return { genre: 'route', commands: ['/prmp/retraits'] };
  }
  // — Demande de retrait à statuer (Président / CC).
  if (type === 'DEMANDE_RETRAIT_A_VALIDER' && (role === 'PRESIDENT' || role === 'CHEF_COMMISSION')) {
    return { genre: 'route', commands: [`/${base}/retraits`] };
  }
  // — Assistant contrôleur : copies (lettres / PV définitifs).
  if (type === 'LETTRE_RENVOI_COPIE' && role === 'ASSISTANT') return { genre: 'route', commands: ['/assistant/lettre-renvois'] };
  if ((type === 'PV_DEFINITIF_COPIE' || type === 'CLOTURE_COPIE_ASSISTANT') && role === 'ASSISTANT') {
    return { genre: 'route', commands: ['/assistant/pv-examens'] };
  }

  // — Replis par OBJET (types non mappés individuellement).
  if (n.typeObjet === 'PV') {
    if (role === 'MEMBRE') return { genre: 'route', commands: ['/membre/pv'] };
    if (role === 'PRMP') return { genre: 'route', commands: ['/prmp/pv-definitifs'] };
    if (role === 'PRESIDENT' || role === 'CHEF_COMMISSION') return { genre: 'route', commands: [`/${base}/resultat-examen/pv`] };
  }
  if ((n.typeObjet === 'MESSAGE' || type === 'NOUVEAU_MESSAGE') && MESSAGERIE.has(role ?? '')) {
    return { genre: 'route', commands: [`/${base}/messagerie`] };
  }
  return null;
}
