import { TypeActeur } from './common.model';

/** Sécurité & administration (réservé ADMINISTRATEUR pour toutes les opérations). */

/** Entrée du journal d'audit (alimenté automatiquement ; immuable, DELETE → 409). */
export interface AuditLog {
  idLog: number;
  dateAction: string;
  imActeur?: string;
  nomTable?: string;
  idEnregistrement?: string;
  typeAction?: string;
  champModifie?: string;
  ancienneValeur?: string;
  nouvelleValeur?: string;
  ipAdresse?: string;
  sessionId?: string;
}

/** Session utilisateur (connexion). */
export interface SessionUtilisateur {
  idSession: string;
  imControleur?: string;
  dateConnexion?: string;
  dateDeconnexion?: string;
  ipAdresse?: string;
  userAgent?: string;
  succes?: boolean;
}

/** Résumé d'un compte d'authentification (réservé ADMINISTRATEUR ; mot de passe jamais exposé). */
export interface CompteAuthResume {
  login: string;
  typeActeur: TypeActeur;
  refActeur: string;
  /** `true` si le compte peut se connecter. */
  actif: boolean;
}

/** Corps de POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe. */
export interface ReinitMotDePasseRequest {
  nouveauMotDePasse: string;
}

/** Entité déclarée dans une inscription PRMP (existante et/ou proposée). */
export interface InscriptionEntiteDeclaree {
  idEntiteContract?: number;
  libelle?: string;
  /** `true` si l'entité existante est encore disponible (non rattachée à une autre PRMP). */
  disponible?: boolean;
}

/**
 * Inscription en attente de validation Administrateur (`GET /api/inscriptions/en-attente`).
 * Couvre les inscriptions **PRMP et UGPM** (`type`) ; une UGPM porte `idPrmpTutelle` et n'a pas d'entités.
 */
export interface InscriptionEnAttente {
  login: string;
  /** PRMP ou UGPM. */
  type: 'PRMP' | 'UGPM';
  /** Identifiant de l'acteur (matricule PRMP/UGPM), si exposé. */
  refActeur?: string;
  /**
   * Identité — le backend type l'identité « en Prmp générique » : selon la sérialisation, les champs
   * peuvent être unifiés (`nom`/`prenoms`/`email`) ou typés (`nomPrmp`/`nomUgpm`…). On lit les deux.
   */
  nom?: string;
  prenoms?: string;
  email?: string;
  nomPrmp?: string;
  prenomsPrmp?: string;
  emailPrmp?: string;
  nomUgpm?: string;
  prenomsUgpm?: string;
  emailUgpm?: string;
  /** Renseigné pour une UGPM : matricule de la PRMP de tutelle. */
  idPrmpTutelle?: string;
  /** Entités déclarées (PRMP uniquement ; vide pour une UGPM). */
  entitesDeclarees?: InscriptionEntiteDeclaree[];
}

/** Corps de POST /api/inscriptions/{login}/refuser. */
export interface RefusInscriptionRequest {
  motif: string;
}
