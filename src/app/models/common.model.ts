/**
 * Types transverses : format d'erreur API et valeurs contrôlées (unions).
 *
 * Pour les statuts dont le contrat ne donne que des exemples (« ex. »), on utilise
 * un type ouvert `(string & {})` : autocomplétion sur les valeurs connues tout en
 * acceptant n'importe quelle chaîne renvoyée par le backend (qui reste l'autorité).
 */

/** Réponse paginée Spring (`Page<T>`). */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** Index de la page courante (0-based). */
  number: number;
  size: number;
}

/**
 * Profils métier portés par le claim `role` du JWT.
 * `UGPM` (Unité de Gestion de la Passation des Marchés) agit **sous le périmètre de sa PRMP de tutelle**
 * (le claim `ref` porte l'idPrmp) : crée/édite des brouillons, marchés, pièces et consulte les PV,
 * mais **ne peut pas soumettre** (réservé PRMP). Cf. docs/api-endpoints.md (/api/saisies, /api/ugpms).
 */
export type Role =
  | 'PRMP'
  | 'UGPM'
  | 'PRESIDENT'
  | 'CHEF_COMMISSION'
  | 'SECRETAIRE'
  | 'MEMBRE'
  | 'VERIFICATEUR'
  | 'ASSISTANT_CONTROLEUR'
  | 'CHARGE_PUBLICATION'
  | 'ADMINISTRATEUR';

/** Nature de l'acteur authentifié (LoginResponse.typeActeur) ; `UGPM` agit sous sa PRMP de tutelle. */
export type TypeActeur = 'CONTROLEUR' | 'PRMP' | 'UGPM';

/** Statut d'un dossier (cycle réel backend : BROUILLON → SOUMIS → PRET_DISPATCH → … → CLOTURE/RETIRE). */
export type StatutDossier =
  | 'BROUILLON'
  | 'SOUMIS'
  | 'PRET_DISPATCH'
  | 'DISPATCHE'
  | 'EN_EXAMEN'
  | 'EN_ATTENTE_DECISION_PRMP'
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
export type StatutDemandeRetrait = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

/** Statut d'une publication (ensemble fermé). */
export type StatutPublication = 'EN_ATTENTE' | 'PUBLIE' | 'RETIRE';

/** Type de passage d'une réception (`INITIAL` ⟺ numPassage = 1 ; retours non nommés). */
export type TypePassage = 'INITIAL' | (string & {});

/** Rôle attendu lors de la signature d'un PV (PvActionRequest.role). */
export type PvSignataireRole = 'MEMBRE' | 'PRESIDENT' | 'CC';

/**
 * Corps d'erreur standard renvoyé par l'API (toutes les erreurs HTTP).
 * `erreurs` (tableau `{ champ, message }`) n'est renseigné que pour les erreurs de validation (400).
 */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  erreurs?: { champ: string; message: string }[];
}
