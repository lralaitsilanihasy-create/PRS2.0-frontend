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
