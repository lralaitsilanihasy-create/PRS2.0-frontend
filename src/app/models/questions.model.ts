/**
 * ⚠️ Manuel révisé lot 2, R7 (V109, 13/10 ; art. 35-II, délai légal n° 3) — les questions des candidats avant la date limite.
 * Recevables jusqu'à dix jours avant la date limite (`clotureLe` compris, `closes` dès le lendemain) ; posées par un candidat **ayant
 * retiré le DAO** ; **répondre = diffuser** (`publieeLe` = `repondueLe`, une réponse définitive), la réponse paraît **anonymisée** sur la
 * page publique et chaque candidat ayant retiré le dossier est notifié. Contrat : `docs/api-endpoints.md`, tranche R7.
 */
export type EtatQuestion = 'EN_ATTENTE' | 'REPONDUE';

export interface QuestionCandidat {
  id: number;
  idDmc: number;
  question: string;
  poseeLe: string;
  /** Raison sociale (à défaut le compte) — lecteurs internes seulement, `null` ailleurs. */
  auteur: string | null;
  auteurCompte: string | null;
  /** La question du candidat connecté. */
  mienne: boolean;
  etat: EtatQuestion;
  reponse: string | null;
  /** Le fichier joint à la réponse (nom, taille) ; nul sans fichier. */
  reponseNom: string | null;
  reponseTaille: number | null;
  repondueLe: string | null;
  publieeLe: string | null;
}

/** La fenêtre des questions et leur liste (publique : répondues et anonymisées ; interne : toutes, avec leur auteur). */
export interface QuestionsProcedure {
  /** ISO à la minute. */
  dateLimite: string | null;
  /** Dernier jour recevable (`AAAA-MM-JJ`), compris. */
  clotureLe: string | null;
  closes: boolean;
  joursAvantLimite: number;
  questions: QuestionCandidat[];
}
