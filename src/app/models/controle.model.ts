/**
 * ⚠️ Manuel révisé, R5 (V105, 13/10) — le socle des **contrôles** d'un dossier (`t_controle_resultat`) : les règles automatiques
 * évaluées par le serveur à chaque soumission (bloquantes avant, toutes enregistrées après, sous le n° de soumission des instantanés),
 * et les contrôles **B** posés par le Membre attributaire pendant l'examen. Par règle, le **dernier résultat posé** fait foi : le Membre
 * lève une non-conformité automatique en posant `CONFORME` ou `NON_APPLICABLE` sur la même règle, avec son observation.
 */

export type ResultatControle = 'CONFORME' | 'NON_CONFORME' | 'NON_APPLICABLE';

/** Une ligne de `GET /api/dossiers/{id}/controles[?soumission=n]`. */
export interface ControleResultat {
  idControle: number;
  numeroSoumission: number | null;
  /** Référence du manuel (`2-III-A P5`) ou du point de grille. */
  reference: string | null;
  /** Point de grille visé, quand le contrôle en vient (règle `POINT_<id>`). */
  idPointCtrl: number | null;
  /** Code stable de la règle (`DOCUMENTS_EVALUATION_SIGNES`, `QUORUM_COMMISSION`, `DELAI_PUBLICITE`…). */
  regle: string;
  libelle: string | null;
  /** Les valeurs constatées par le serveur (JSON libre). */
  valeurs: Record<string, unknown> | null;
  resultat: ResultatControle;
  bloquant: boolean;
  /** `SERVEUR`, ou le matricule du Membre. */
  auteur: string | null;
  dateControle: string | null;
  observation: string | null;
}

/** Le corps de `POST /api/dossiers/{id}/controles` (Membre attributaire, examen modifiable) : un point de grille OU une règle. */
export interface ControleCorps {
  idPointCtrl?: number | null;
  regle?: string | null;
  reference?: string | null;
  libelle?: string | null;
  resultat: ResultatControle;
  /** Obligatoire quand le résultat est `NON_CONFORME`. */
  observation?: string | null;
  bloquant?: boolean;
}

/** Un contrôle bloquant du refus 400 `CONTROLES_BLOQUANTS` (`details.controles[]`) à la soumission ou à la resoumission. */
export interface ControleBloquant {
  code: string;
  reference: string | null;
  libelle: string | null;
  valeurs: Record<string, unknown> | null;
}
