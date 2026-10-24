import { EtatCao, EtatCeremonie, EtatCompteCao, EtatPart, EtatPartDeSecours, OrigineMembreCao } from '../../models';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

/**
 * Soumission en ligne, lots 2a et 2b (04/10) — libellés de la commission d'appel d'offres et de la cérémonie des clés,
 * fichier UNIQUE : la PRMP, le responsable de la procédure et le membre de CAO lisent les mêmes mots.
 */

/** Le message du refus d'un second expert — le même ici, avant l'envoi, et au serveur (§B6). */
export const MESSAGE_UN_SEUL_EXPERT = 'Un expert de l’objet suffit : la commission n’en compte qu’un.';

export const LIBELLES_ORIGINE: Readonly<Record<OrigineMembreCao, string>> = {
  ENTITE_CONTRACTANTE: 'Entité contractante',
  EXPERT_OBJET: 'Expert de l’objet du DAO',
};

export const LIBELLES_ETAT_COMPTE_CAO: Readonly<Record<EtatCompteCao, string>> = {
  A_INVITER: 'À inviter',
  INVITE: 'Invitation envoyée',
  ACTIF: 'Compte actif',
  ARCHIVE: 'Compte archivé',
};

export const LIBELLES_ETAT_CAO: Readonly<Record<EtatCao, string>> = {
  ABSENTE: 'non constituée',
  INCOMPLETE: 'incomplète',
  COMPLETE: 'constituée',
};

export const LIBELLES_ETAT_CEREMONIE: Readonly<Record<EtatCeremonie, string>> = {
  A_VENIR: 'à venir — des clés manquent',
  CLOSE: 'close — clés publiées',
  A_REFAIRE: 'rouverte — à refaire',
};

export const LIBELLES_ETAT_PART: Readonly<Record<EtatPart, string>> = {
  ABSENTE: 'Clé à publier',
  PUBLIEE: 'Clé publiée',
  VERIFIEE: 'Part vérifiée',
  PERDUE: 'Part perdue',
};

export const LIBELLES_ETAT_PART_SECOURS: Readonly<Record<EtatPartDeSecours, string>> = {
  A_DESIGNER: 'Dépositaire à désigner',
  DESIGNE: 'Dépositaire désigné, clé à publier',
  PUBLIEE: 'Clé de secours publiée',
  VERIFIEE: 'Part de secours vérifiée',
  PERDUE: 'Part de secours perdue',
};

/** La variante de pastille d'un état de part : vert quand la part tient, rouge perdue, neutre à publier. */
export function classePart(etat: EtatPart | EtatPartDeSecours): string {
  switch (etat) {
    case 'VERIFIEE':
      return 'badge-success';
    case 'PUBLIEE':
      return 'badge-info';
    case 'PERDUE':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

export function classeCeremonie(etat: EtatCeremonie | null | undefined): string {
  return etat === 'CLOSE' ? 'badge-success' : etat === 'A_REFAIRE' ? 'badge-warning' : 'badge-neutral';
}

export function classeCao(etat: EtatCao | null | undefined): string {
  return etat === 'COMPLETE' ? 'badge-success' : etat === 'INCOMPLETE' ? 'badge-warning' : 'badge-neutral';
}

/** Le prochain pas d'un membre sur une de ses procédures, et le ton de la carte. */
export interface ProchainPasCao {
  texte: string;
  ton: 'action' | 'alerte' | 'attente' | 'suite';
}

/**
 * ⚠️ 19/10 (pilote) — ce que « Mes procédures » dit au membre, d'un coup d'œil : sa clé d'abord (à publier, perdue, cérémonie
 * rouverte), puis le temps des dépôts, puis la séance et l'évaluation une fois la date limite passée.
 */
export function prochainPasCao(p: { etatPart: EtatPart; etatCeremonie: EtatCeremonie | null; dateLimite: string | null }, maintenant = maintenantServeur()): ProchainPasCao {
  if (p.etatPart === 'PERDUE') return { texte: 'Part perdue : remplacer ma clé', ton: 'alerte' };
  if (p.etatPart === 'ABSENTE' || p.etatCeremonie === 'A_REFAIRE') return { texte: p.etatCeremonie === 'A_REFAIRE' ? 'Cérémonie rouverte : republier ma clé' : 'Publier ma clé', ton: 'action' };
  if (p.etatCeremonie !== 'CLOSE') return { texte: 'Clé publiée : attendre la clôture de la cérémonie', ton: 'attente' };
  const limite = p.dateLimite ? new Date(p.dateLimite) : null;
  if (limite && !Number.isNaN(limite.getTime()) && limite > maintenant) return { texte: 'Dépôts en cours : la séance suit la date limite', ton: 'attente' };
  return { texte: 'Séance d’ouverture et évaluation des offres', ton: 'suite' };
}
