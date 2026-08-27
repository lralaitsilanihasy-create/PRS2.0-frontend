import { Role } from './common.model';

/**
 * Actualités affichées à l'ouverture de session (spec 2026-08-18, `docs/spec-actualites.md`).
 *
 * ⚠️ `contenuMd` est du **markdown**, jamais du HTML : il est rendu par
 * `shared/actualites/markdown` qui construit des nœuds typés, sans aucune injection dans le DOM.
 * Le choix est délibéré — il ferme la surface XSS que rouvrirait un contenu HTML éditable.
 */
export interface Actualite {
  idActualite: number;
  titre: string;
  /** Markdown brut (sous-ensemble : titres, gras, italique, listes, liens, images, paragraphes). */
  contenuMd: string;
  /** Profils destinataires (noms d'enum serveur). Vide ⇒ 400 : le ciblage est un acte délibéré. */
  profilsCibles: Role[];
  statut: StatutActualite;
  /** `null` = visible dès l'activation. */
  datePublication?: string | null;
  /** `null` = sans terme. Atteinte ⇒ le serveur bascule l'actualité en ARCHIVE. */
  dateExpiration?: string | null;
  /** Peuplé serveur, lecture seule. */
  images?: ActualiteImage[];
  dateCreation?: string;
  imAuteur?: string;
  dateArchivage?: string | null;
  imArchiveur?: string | null;
}

/** Cycle : INACTIF (création) → ACTIF (publication) → ARCHIVE (retrait ou expiration, définitif). */
export type StatutActualite = 'ACTIF' | 'INACTIF' | 'ARCHIVE';

export const ACTUALITE_STATUT_LABELS: Record<StatutActualite, string> = {
  ACTIF: 'Active',
  INACTIF: 'Inactive',
  ARCHIVE: 'Archivée',
};

/**
 * Image d'une actualité — JPEG uniquement, redimensionnée au serveur avant stockage.
 * Champ à champ le `ActualiteImageDto` du backend : jamais le binaire, servi par
 * `GET /api/actualites/{id}/images/{idImage}`.
 */
export interface ActualiteImage {
  idImage: number;
  nomFichier: string;
  taille?: number;
  /** Position dans la mini-page. */
  ordre?: number;
}

/** Interrupteur global : à `false`, `/mes-actualites` renvoie une liste vide pour tout le monde. */
export interface ParametreActualites {
  actif: boolean;
}
