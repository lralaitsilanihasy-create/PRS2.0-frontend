/**
 * Ancienneté d'une demande en attente — « la plus ancienne attend depuis… » de l'accueil de
 * l'Administrateur (lot 6, F2 ; maquette A).
 *
 * ⚠️ **La granularité n'est pas un détail de présentation, c'est une question d'exactitude.** Les
 * deux dates servies par `GET /api/kpis/badges` n'ont pas la même précision :
 *
 * - `inscriptionDoyenneLe` est un **instant** (dépôt de la première pièce jointe) → `'heure'` ;
 * - `rattachementDoyenLe` est une **date ramenée à minuit** (`DATE_DECLARATION` est une date, pas un
 *   instant) → `'jour'`. L'afficher en heures annoncerait « depuis 14 heures » pour une déclaration
 *   faite ce matin : une précision que la donnée n'a pas, et une attente surévaluée.
 *
 * Module séparé du composant, et sans dépendance à Angular, pour être éprouvé seul.
 */

/** Au-delà de ce délai, une demande d'accès n'attend plus : elle est en retard (maquette A, sous-titre). */
export const PREAVIS_DEMANDE_HEURES = 48;

const MS_HEURE = 3_600_000;
const MS_JOUR = 24 * MS_HEURE;

/** `'heure'` pour une date qui est un instant, `'jour'` pour une date ramenée à minuit. */
export type GranulariteAnciennete = 'heure' | 'jour';

export interface Anciennete {
  /** Phrase prête à afficher, sans le sujet : « depuis 3 jours », « depuis 6 heures », « depuis aujourd'hui ». */
  readonly libelle: string;
  /** Attente strictement supérieure au préavis de 48 h. */
  readonly enRetard: boolean;
  /** Millisecondes écoulées (0 au minimum) — sert à désigner la file la plus ancienne des deux. */
  readonly ecouleMs: number;
}

/**
 * Ancienneté de `iso` à l'instant `maintenant`, ou `null` si la date est absente ou illisible —
 * **jamais** une valeur de repli : une file sans doyenne n'affiche pas d'attente (plan L6, §6).
 */
export function anciennete(
  iso: string | null | undefined,
  maintenant: Date,
  granularite: GranulariteAnciennete,
): Anciennete | null {
  if (!iso) {
    return null;
  }
  const depuis = new Date(iso);
  if (isNaN(depuis.getTime())) {
    return null;
  }
  // Une date future (horloge du poste en avance sur celle du serveur) vaut zéro, pas une attente négative.
  const ecouleMs = Math.max(0, maintenant.getTime() - depuis.getTime());
  const enRetard = ecouleMs > PREAVIS_DEMANDE_HEURES * MS_HEURE;
  return { libelle: libelle(ecouleMs, granularite), enRetard, ecouleMs };
}

function libelle(ecouleMs: number, granularite: GranulariteAnciennete): string {
  const jours = Math.floor(ecouleMs / MS_JOUR);
  if (granularite === 'jour') {
    if (jours === 0) return "depuis aujourd'hui";
    if (jours === 1) return 'depuis hier';
    return `depuis ${jours} jours`;
  }
  if (ecouleMs < MS_HEURE) {
    return "depuis moins d'une heure";
  }
  if (jours < 2) {
    const heures = Math.floor(ecouleMs / MS_HEURE);
    return heures === 1 ? 'depuis 1 heure' : `depuis ${heures} heures`;
  }
  return `depuis ${jours} jours`;
}
