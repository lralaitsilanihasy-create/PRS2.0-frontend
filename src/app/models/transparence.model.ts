import { StatutPublication } from './common.model';

/** Portail de transparence (§3.7) : géré par le CHARGE_PUBLICATION. */

/**
 * Publication.
 * À la création, `statutPubli` est forcé à `EN_ATTENTE` et `nbConsultations` à `0`.
 * Cycle : EN_ATTENTE → PUBLIE → RETIRE.
 */
export interface Publication {
  idPublication: number;
  typeObjet: string;
  idObjet: number;
  datePublication?: string;
  imPubliePar?: string;
  statutPubli?: StatutPublication;
  dateRetrait?: string;
  motifRetrait?: string;
  nbConsultations?: number;
}

/** Corps de `POST /api/publications/{id}/retirer`. */
export interface RetraitPublicationRequest {
  motifRetrait: string;
}

/** Document public rattaché à une publication. */
export interface DocumentPublic {
  idDocPublic: number;
  idPublication: number;
  typeDoc?: string;
  libelleDoc?: string;
  cheminFichier?: string;
  format?: string;
  tailleOctets?: number;
  dateDepot?: string;
  /** Renseigné par l'action `empreinte`. */
  hashSha256?: string;
}

/** Corps des actions d'intégrité (`empreinte`, `verifier-integrite`). */
export interface EmpreinteRequest {
  /** Contenu du fichier en Base64. */
  contenuBase64: string;
}

/** Réponse de `verifier-integrite`. */
export interface VerificationIntegriteResult {
  conforme: boolean;
  hashAttendu: string;
  hashCalcule: string;
}
