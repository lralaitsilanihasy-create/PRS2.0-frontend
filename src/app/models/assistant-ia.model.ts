/**
 * Assistant IA local — lot 1 (`backend/docs/plan-assistant-ia.md`).
 *
 * Il répond aux questions sur les règles du contrôle des marchés et de PRS, à partir du manuel de
 * contrôle a priori de la CNM et des règles de gestion de PRS. Lecture seule, non décisionnaire :
 * il ne lit aucun dossier et ne décide de rien.
 */

/** `GET /api/assistant-ia/etat`. */
export interface EtatAssistantIa {
  /** L'assistant est activé côté serveur ; sinon, il n'est pas proposé. */
  actif: boolean;
  /** Le service de calcul répond et connaît le modèle (sonde courte côté serveur). */
  disponible: boolean;
  /** Modèle utilisé ; `null` si l'assistant est inactif. */
  modele: string | null;
  /** Documents sur lesquels l'assistant s'appuie. */
  documents: DocumentAssistantIa[];
}

export interface DocumentAssistantIa {
  libelle: string;
  passages: number;
}

/** Un extrait fourni au modèle, cité `[numero]` dans la réponse. */
export interface SourceAssistantIa {
  numero: number;
  /** Ex. « Manuel de contrôle a priori (CNM, février 2026) ». */
  document: string;
  /** Ex. « p. 15 », « 3.1. PRMP › Module 02 — Saisie & gestion PPM ». */
  reference: string;
  extrait: string;
}

/** Événement du flux de réponse (`POST /api/assistant-ia/questions`, SSE). */
export type EvenementAssistantIa =
  | { type: 'sources'; sources: SourceAssistantIa[] }
  | { type: 'texte'; texte: string }
  | { type: 'fin'; modele: string; dureeMs: number }
  | { type: 'erreur'; message: string };
