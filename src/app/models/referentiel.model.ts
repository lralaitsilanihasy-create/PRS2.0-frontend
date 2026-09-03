/** Référentiels (lecture ouverte, écriture ADMINISTRATEUR) + suggestion de mode. */

/** Avis (FAV, DEFAVORABLE, ...). PK = idAvis (string). */
export interface Avis {
  idAvis: string;
  libelleAvis?: string;
}

/** Catégorie de compte budgétaire. PK = idCatCompte (string). */
export interface CatCompte {
  idCatCompte: string;
  catCompte?: string;
}

/** Catégorie d'entité contractante (PK = libellé) ; porte le niveau hiérarchique dont l'entité hérite. */
export interface CategorieEntite {
  libelle: string;
  niveauHierarchique?: number;
}

/** Compte budgétaire. PK = numCompte (string). */
export interface Compte {
  numCompte: string;
  libelle?: string;
  idCatCompte?: string;
}

/**
 * Délégation de profil.
 * `idProfileDelegant` = profil qui exerce la tâche ;
 * `idProfileDelegue` = profil dont la tâche est exercée.
 */
export interface DelegationProfil {
  idDelegation: number;
  idProfileDelegant: number;
  idProfileDelegue: number;
  actif: boolean;
}

/** Entité contractante. */
export interface EntiteContract {
  idEntiteContract: number;
  libelleEntite: string;
  adresse: string;
  categorieEntite?: string;
  idOrganigramme: number;
  idEntiteParent?: number;
  niveauHierarchique?: number;
  /** Localité de l'entité (FK tr_localite) ; détermine la localité des dossiers la concernant. */
  idLocalite?: string;
}

/** Localité. PK = idLocalite (string). */
/** Localité — contrat réduit à 2 champs (2026-07-17) : `referencement` et `localite` (code) retirés (colonnes héritées dépréciées en BD). */
export interface Localite {
  /** Clé (max 5) référencée partout ; compose aussi le segment localité des références officielles (`CRM-<id>`). */
  idLocalite: string;
  libelleLocalite: string;
  /**
   * ⚠️ Ajouté (2026-08-03) — chef-lieu : ville de siège de la Commission (régionale), reprise par les
   * documents officiels (« A <chef-lieu>, le … ») ; à défaut, `libelleLocalite` est utilisé.
   */
  chefLieu?: string;
  /** ⚠️ Demandé au backend (2026-09-03) — vrai pour la localité CENTRALE (CNM) ; pas encore servi. */
  estCentrale?: boolean;
}

/**
 * ⚠️ Demande pilote (2026-09-03) — localité CENTRALE (CNM) : repli MIROIR de la constante backend
 * `Localite.ID_CENTRALE` ('ANT'), sa source unique côté serveur (segment « CNM » des références,
 * modèles de PV centraux, lettres de renvoi). Le champ `estCentrale`, une fois servi par
 * /api/localites (demande backend 2026-09-03), prime sur cette constante.
 */
export const ID_LOCALITE_CENTRALE_REPLI = 'ANT';

/** La localité est-elle la CENTRALE (CNM) ? — champ servi s'il est fourni, sinon repli miroir. */
export function estLocaliteCentrale(idLocalite: string | null | undefined, referentiel?: readonly Localite[]): boolean {
  if (!idLocalite) return false;
  const servie = referentiel?.find((l) => l.idLocalite === idLocalite)?.estCentrale;
  return servie ?? idLocalite === ID_LOCALITE_CENTRALE_REPLI;
}

/** Ministère. */
export interface Ministere {
  idMinistere: number;
  libelleMinistere: string;
  sigle?: string;
}

/** Mode de passation. */
export interface ModePassation {
  idMode: number;
  libelle?: string;
  description?: string;
  publiciteRequise?: boolean;
  delaiMinJours?: number;
  baseLegale?: string;
  /** Mapping vers le type de DMC (`t_type_dmc`) — sert à dériver le type de DMC des marchés de ce mode. `null` = non mappé. */
  idTypeDmc?: number | null;
  /**
   * Drapeau data-driven (`tr_mode_passation.DECLENCHE_AGPM`) : ce mode (ex. « appel d'offres ouvert »)
   * rend la pièce AGPM obligatoire à la soumission d'un PPM. Administrable via `mode-passations`.
   */
  declencheAgpm?: boolean;
  /**
   * Modèle CAPM partagé (`tr_mode_passation.ID_MODE_MODELE_CAPM`) : mode dont ce mode réutilise le
   * modèle détaillé de processus (ex. CPO / Appel à manifestation d'intérêt → « Appel d'offres ouvert »).
   * `null` = pas de partage. Administrable via `mode-passations`.
   */
  idModeModeleCapm?: number | null;
  /**
   * Classification du mode (`tr_mode_passation.CATEGORIE`) : `NORMAL` (droit commun) ou `DEROGATOIRE`.
   * `null` = non classé. Déclaratif (aucune règle dérivée à ce jour), administrable via `mode-passations`.
   */
  categorie?: 'NORMAL' | 'DEROGATOIRE' | null;
}

/**
 * Type de Dossier de Mise en Concurrence (`/api/type-dmc`, référentiel administrable).
 * Ex. `DAO` (Dossier d'Appel d'Offres), `DC` (Dossier de Consultation), `BC` (Bon de Commande).
 * PK `idTypeDmc` **générée par la base** (IDENTITY). Écriture réservée ADMINISTRATEUR.
 */
export interface TypeDmc {
  idTypeDmc: number;
  code: string;
  libelle: string;
  actif?: boolean;
}

/** Nature de marché. */
export interface Nature {
  idNature: number;
  libelle?: string;
  description?: string;
}

/** Point de contrôle (grille d'examen) — porté par une famille, affinable par sous-type. */
export interface PointsCtrl {
  idPointCtrl: number;
  libelPointCtrl?: string;
  decriptPointCtrl?: string;
  ordrePointCtrl?: number;
  obligatoire: boolean;
  /** Famille (`DDP`/`DMC`/`DDM`). */
  idTypeDossier: string;
  /** Sous-type ciblé (doit appartenir à la famille, sinon 400) ; `null`/absent = point **commun** à la famille. */
  idSousType?: string | null;
  /**
   * Portée d'évaluation : `LIGNE` (par ligne de marché), `DOSSIER` (inter-lignes, ex.
   * fractionnement), et depuis le 02/09 (backend `f361de9`) `FICHE` / `AGPM` — la fiche de
   * présentation et le projet d'AGPM ont chacun LEUR grille dans l'examen. Tout ce qui n'est pas
   * `LIGNE` s'évalue UNE fois (résultat stocké `idDetail = null`). Défaut serveur `LIGNE`.
   */
  portee?: 'LIGNE' | 'DOSSIER' | 'FICHE' | 'AGPM';
}

/** Profil (référentiel RBAC). */
export interface Profile {
  idProfile: number;
  /** Libellé du profil (ex. « Chef de commission »). */
  profile?: string;
}

/** Règle d'alerte sur jalon. */
export interface RegleAlerte {
  idRegleAlerte: number;
  typeJalon: string;
  joursAvant: number;
  destinataireProfil?: number;
  actif?: boolean;
}

/** Règle d'anomalie. */
export interface RegleAnomalie {
  idRegleAnomalie: number;
  codeRegle: string;
  libelle?: string;
  parametreNum?: number;
  parametreTxt?: string;
  actif?: boolean;
  graviteDefaut?: string;
}

/** CAPM — processus de marché (référentiel `t_capm`) ; `ordre` fixe l'affichage des dates prévisionnelles.
 *  Modèle mixte : `idMode` null = processus commun, sinon spécifique au mode de passation (ex. modèle
 *  détaillé « Appel d'offres ouvert ») ; `groupe` = phase du modèle (regroupement à l'affichage). */
export interface Capm {
  idCapm: number;
  libelleProcessus?: string;
  ordre: number;
  idMode?: number | null;
  groupe?: string | null;
}

/** Type de pièce jointe attendue par type de dossier (référentiel `t_type_piece_jointe`). */
export interface TypePieceJointe {
  idTypePiece: number;
  libellePiece: string;
  obligatoire: boolean;
  idTypeDossier?: string;
  ordre?: number;
  /** Code stable (`t_type_piece_jointe.CODE`), ex. `AGPM` — sert à repérer une pièce par nature. */
  code?: string;
}

/** Type (famille) de dossier — `DDP` / `DMC` / `DDM`. PK = idTypeDossier (string). */
export interface TypeDossier {
  idTypeDossier: string;
  libelleType?: string;
}

/**
 * Sous-type de dossier (référentiel administrable `tr_sous_type_dossier`), rattaché à une famille.
 * Jeu initial : DDP ⊃ PPM / PPM-AGPM (dérivés serveur) ; DMC ⊃ DAO / DAOR ; DDM ⊃ MAOO / MAOR.
 * DELETE d'un sous-type référencé par un dossier → 409.
 */
export interface SousTypeDossier {
  idSousType: string;
  libelleSousType?: string;
  /** FK famille (`tr_type_dossier` : DDP / DMC / DDM) ; famille inconnue → 404. */
  idTypeDossier: string;
}
