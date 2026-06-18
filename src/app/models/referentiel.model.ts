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

/** Règle de passation (situation × seuil × mode). */
export interface ReglePassation {
  idRegle: number;
  idSituation: number;
  idSeuil: number;
  idMode: number;
  priorite?: number;
}

/** Seuil de montant par nature et localité. */
export interface Seuil {
  idSeuil: number;
  montantMin?: number;
  montantMax?: number;
  idNature: number;
  idLocalite: string;
}

/** Situation. */
export interface Situation {
  idSituation: number;
  libelle?: string;
  description?: string;
}

/** Type de dossier. PK = idTypeDossier (string). */
export interface TypeDossier {
  idTypeDossier: string;
  libelleType?: string;
}

/** Corps de `POST /api/regle-passations/suggestion-mode` (réservé PRMP). */
export interface SuggestionModeRequest {
  idSituation: number;
  montant: number;
  idNature: number;
  idLocalite: string;
}

/** Un mode autorisé renvoyé par `suggestion-mode`. */
export interface ModeAutorise {
  idMode: number;
  libelle: string;
}

/** Réponse de `suggestion-mode` : ensemble autorisé + recommandé (non contraignant ; le serveur valide). */
export interface SuggestionModeResponse {
  modeRecommande: number | null;
  modesAutorises: ModeAutorise[];
  modeNonDetermine: boolean;
}
