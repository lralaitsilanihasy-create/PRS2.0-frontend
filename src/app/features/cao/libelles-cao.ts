import {
  EtatCao,
  EtatCeremonie,
  EtatCompteCao,
  EtatPart,
  EtatPartDeSecours,
  OrigineMembreCao,
  QualiteMembreCao,
} from '../../models';

/**
 * Soumission en ligne, lots 2a et 2b (04/10) — libellés de la commission d'appel d'offres et de la cérémonie des clés,
 * fichier UNIQUE : la PRMP, le responsable de la procédure et le membre de CAO lisent les mêmes mots.
 */

export const LIBELLES_QUALITE: Readonly<Record<QualiteMembreCao, string>> = {
  MEMBRE: 'Membre',
  EXPERT_ADJOINT: 'Expert adjoint',
};

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
