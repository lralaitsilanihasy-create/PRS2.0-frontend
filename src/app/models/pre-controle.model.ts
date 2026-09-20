/**
 * Pré-contrôle du PPM — assistant IA, lot 3 (`backend/docs/plan-assistant-ia.md` §4, lot 3).
 *
 * Signale à la PRMP les problèmes de son plan **avant qu'elle ne soumette**, et au contrôleur les points
 * à regarder **avant qu'il n'examine**. Chacun peut **écarter** un signalement non pertinent, en le
 * motivant — et ce motif est lu de l'autre côté du circuit.
 *
 * ⚠️ **Rien n'y bloque** : aucune soumission n'est refusée, aucun mode corrigé. Le mode de passation
 * reste celui que la PRMP a saisi. Un signalement est une question posée, pas une sanction.
 */

/** Sévérité d'un signalement — il n'y a **pas** de niveau bloquant, et c'est délibéré. */
export type GraviteSignalement = 'A_VERIFIER' | 'PRIORITAIRE';

/**
 * D'où vient un signalement. ⚠️ **À ne jamais présenter de la même façon** : `REGLE` est un fait
 * opposable, cité avec sa base légale ; `IA` est une piste du modèle, qu'on peut écarter sans en porter
 * la marque.
 */
export type SourceSignalement = 'REGLE' | 'IA';

/** Cycle de vie d'un signalement. `LEVE_MODIFICATION` = ne ressort plus, le plan a changé — jamais effacé. */
export type StatutSignalement = 'OUVERT' | 'ECARTE' | 'LEVE_MODIFICATION';

/** Une ligne visée par un signalement inter-lignes (fractionnement). */
export interface LigneViseeSignalement {
  idDetail: number;
  designation: string;
  /** Montant en vigueur **au moment de la détection** : recopié, pour rester lisible après correction. */
  montant: number | null;
}

/** L'écartement d'un signalement, tel qu'il se lit de l'autre côté du circuit. */
export interface EcartementSignalement {
  typeActeur: 'PRMP' | 'CONTROLEUR';
  refActeur: string | null;
  date: string | null;
  /** Le motif — c'est la pièce maîtresse : sans motif lisible, pas de dissuasion. */
  motif: string;
}

/** Un signalement du pré-contrôle (`t_anomalie`, source `REGLE` ou `IA`). */
export interface Signalement {
  id: number;
  /** Code de la règle : `FRACTIONNEMENT_COMPTE`, `MODE_SOUS_LE_SEUIL`… */
  type: string;
  /** Libellé **administrable** de la règle. */
  libelleRegle: string | null;
  gravite: GraviteSignalement;
  source: SourceSignalement;
  statut: StatutSignalement;
  /** Le constat, avec le texte qui le fonde (manuel, article, seuil, base légale). */
  description: string;
  /** La correction proposée, au format de l'annexe d'un PV (« Au lieu de : … Lire : … »). */
  suggestion: string | null;
  /** La ligne visée, si le signalement n'en vise qu'une ; `null` pour un constat inter-lignes. */
  idDetail: number | null;
  designationLigne: string | null;
  lignes: LigneViseeSignalement[];
  idPointCtrl: number | null;
  /** Point de la grille de contrôle que le signalement éclaire. */
  libellePointCtrl: string | null;
  dateDetection: string | null;
  /** `null` s'il n'y a pas d'écartement — ou si le lecteur n'a pas à le voir. */
  ecartement: EcartementSignalement | null;
  /** Vrai depuis la soumission : l'écartement ne se défait plus. */
  fige: boolean;
  dateLevee: string | null;
  /** Le constat tel qu'il était au moment de disparaître. */
  detailLevee: string | null;
}

/** `GET /api/pre-controle/ppm/{id}` et `POST …/verifier`. */
export interface ResumePreControle {
  idPpm: number;
  exercice: number | null;
  dateVerification: string;
  nbOuverts: number;
  /** Parmi les ouverts : le cumul change la procédure, ou soustrait le marché au contrôle a priori. */
  nbPrioritaires: number;
  nbEcartes: number;
  nbLeves: number;
  /** Déjà triés par le serveur : ouverts d'abord, prioritaires en tête. */
  signalements: Signalement[];
}

/**
 * `POST /api/pre-controle/ppm/{id}/analyse-ia` — ce que l'**assistant** ajoute par-dessus les règles.
 *
 * Les pistes trouvées ont rejoint les signalements du plan (`source: 'IA'`) ; `synthese` dit **où regarder
 * d'abord** et n'est pas enregistrée — c'est une aide à la lecture, recalculée à chaque analyse.
 */
export interface AnalyseIa {
  synthese: string | null;
  resume: ResumePreControle;
}

/**
 * Corps d'un écartement. `avertissementLu` n'est pas une formalité : le serveur l'exige (400 sinon),
 * pour que la promesse « la PRMP le sait au moment d'écarter » ne dépende pas du seul écran.
 */
export interface EcartementRequest {
  motif: string;
  avertissementLu: boolean;
}

/** Longueur minimale d'un motif recevable (le serveur refuse en deçà) — « RAS » ne dit rien. */
export const MOTIF_ECARTEMENT_MIN = 20;

/**
 * La phrase que l'écran **doit** montrer avant tout écartement. Elle est ici, et pas dans un gabarit,
 * pour qu'on la retrouve d'un coup d'œil : c'est la première des quatre conditions de la dissuasion.
 */
export const AVERTISSEMENT_ECARTEMENT =
  'Cet écartement et votre motif seront visibles de l’autre côté du circuit : du contrôleur de la CNM ' +
  'si vous êtes la PRMP, de votre hiérarchie si vous êtes contrôleur.';
