/**
 * Types transverses : format d'erreur API et valeurs contrôlées (unions).
 *
 * Pour les statuts dont le contrat ne donne que des exemples (« ex. »), on utilise
 * un type ouvert `(string & {})` : autocomplétion sur les valeurs connues tout en
 * acceptant n'importe quelle chaîne renvoyée par le backend (qui reste l'autorité).
 */

/** Profils métier portés par le claim `role` du JWT. */
export type Role =
  | 'PRMP'
  | 'PRESIDENT'
  | 'CHEF_COMMISSION'
  | 'SECRETAIRE'
  | 'MEMBRE'
  | 'VERIFICATEUR'
  | 'CHARGE_PUBLICATION'
  | 'ADMINISTRATEUR';

/** Nature de l'acteur authentifié (LoginResponse.typeActeur). */
export type TypeActeur = 'CONTROLEUR' | 'PRMP';

/** Statut d'un dossier (cycle réel backend : BROUILLON → SOUMIS → PRET_DISPATCH → … → CLOTURE/RETIRE). */
export type StatutDossier =
  | 'BROUILLON'
  | 'SOUMIS'
  | 'PRET_DISPATCH'
  | 'DISPATCHE'
  | 'EN_EXAMEN'
  | 'CLOTURE'
  | 'RETIRE'
  | (string & {});

/** Cycle de vie du PV d'examen (ensemble fermé, cf. PvExamenDto). */
export type StatutPv =
  | 'BROUILLON'
  | 'PROJET_SOUMIS'
  | 'EN_RECTIFICATION'
  | 'PROJET_ACCEPTE'
  | 'SIGNE';

/** Sens d'une navette de PV (ensemble fermé — 409 sinon). */
export type SensNavette = 'SOUMISSION' | 'RETOUR_RECTIF' | 'ACCEPTATION';

/** Statut d'une demande de retrait (ensemble fermé). */
export type StatutDemandeRetrait = 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';

/** Statut d'une publication (ensemble fermé). */
export type StatutPublication = 'EN_ATTENTE' | 'PUBLIE' | 'RETIRE';

/** Type de passage d'une réception (`INITIAL` ⟺ numPassage = 1 ; retours non nommés). */
export type TypePassage = 'INITIAL' | (string & {});

/** Rôle attendu lors de la signature d'un PV (PvActionRequest.role). */
export type PvSignataireRole = 'MEMBRE' | 'PRESIDENT' | 'CC';

/**
 * Corps d'erreur standard renvoyé par l'API (toutes les erreurs HTTP).
 * `fieldErrors` n'est renseigné que pour les erreurs de validation (400).
 */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
}
