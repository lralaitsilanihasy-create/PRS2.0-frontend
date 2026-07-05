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
}

/** Type de dossier. PK = idTypeDossier (string). */
export interface TypeDossier {
  idTypeDossier: string;
  libelleType?: string;
}
