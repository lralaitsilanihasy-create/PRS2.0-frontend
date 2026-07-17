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
export interface Localite {
  idLocalite: string;
  libelleLocalite: string;
  referencement: string;
  localite: string;
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

/** Point de contrôle (grille d'examen). */
export interface PointsCtrl {
  idPointCtrl: number;
  libelPointCtrl?: string;
  decriptPointCtrl?: string;
  ordrePointCtrl?: number;
  obligatoire: boolean;
  idTypeDossier: string;
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

/** CAPM — processus de marché (référentiel `t_capm`) ; `ordre` fixe l'affichage des dates prévisionnelles. */
export interface Capm {
  idCapm: number;
  libelleProcessus?: string;
  ordre: number;
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
