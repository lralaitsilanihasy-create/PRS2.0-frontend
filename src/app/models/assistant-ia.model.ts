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

/**
 * Événement du flux de réponse (`POST /api/assistant-ia/questions`, SSE).
 *
 * ⚠️ `sources` et `faits` sont **exclusifs** (lot 4) : une question sur les règles rend des extraits
 * du corpus, une question sur des données rend ce que le serveur a lu pour cet utilisateur. Jamais les
 * deux — une seule matière par réponse.
 */
export type EvenementAssistantIa =
  | { type: 'sources'; sources: SourceAssistantIa[] }
  | { type: 'faits'; faits: FaitsDossier }
  | { type: 'texte'; texte: string }
  | { type: 'fin'; modele: string; dureeMs: number }
  | { type: 'erreur'; message: string };

/** Un tour déjà eu, renvoyé au serveur pour qu'il garde le fil (lot 4). */
export interface TourAssistantIa {
  question: string;
  reponse: string;
}

/* -------------------------------------------------------------- lot 2 — synthèse d'un dossier */

/** Une section des faits : un titre, et des lignes déjà rédigées par le serveur. */
export interface SectionFaits {
  titre: string;
  lignes: string[];
}

/**
 * ⚠️ Ce que le SERVEUR a lu du dossier, et exactement ce que le modèle a reçu — servi avant la
 * moindre seconde de génération (`POST /api/assistant-ia/dossiers/{id}/synthese`).
 *
 * `outilsRefuses` nomme les lectures que le profil ne permet pas : elles retirent leur section, elles
 * ne la remplacent pas par une approximation. Exemple normal : le journal du circuit est une vue
 * interne à la CNM, donc absent de la synthèse d'une PRMP.
 */
export interface FaitsDossier {
  idDossier: number;
  reference: string;
  sections: SectionFaits[];
  outilsLus: string[];
  outilsRefuses: string[];
}

/**
 * Événement du flux de synthèse d'un dossier (SSE). `statut` n'accompagne que les erreurs de la
 * requête elle-même : c'est lui qui distingue un assistant absent (404) d'une panne passagère.
 */
export type EvenementSyntheseIa =
  | { type: 'faits'; faits: FaitsDossier }
  | { type: 'texte'; texte: string }
  | { type: 'fin'; modele: string; dureeMs: number; mention: string }
  | { type: 'erreur'; message: string; statut?: number };
