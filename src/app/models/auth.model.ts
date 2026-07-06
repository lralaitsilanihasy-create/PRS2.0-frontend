import { Role, TypeActeur } from './common.model';

/** Corps de `POST /api/auth/login` (seule route publique). */
export interface LoginRequest {
  login: string;
  motDePasse: string;
}

/** Réponse de `POST /api/auth/login`. */
export interface LoginResponse {
  /** JWT à placer dans `Authorization: Bearer ...`. */
  token: string;
  login: string;
  /** Profil métier (ou `null` si non reconnu). */
  role: Role | null;
  typeActeur: TypeActeur;
  /** Matricule contrôleur ou identifiant PRMP. */
  ref: string;
  /** Localité de rattachement (`null` = toutes, cas Président). */
  localite: string | null;
  /** Durée de validité du jeton, en secondes. */
  expiresIn: number;
}

/** Corps de POST /api/auth/register/prmp (route publique). Auto-inscription PRMP. */
export interface RegisterPrmpRequest {
  login: string;
  motDePasse: string;
  /** = matricule de la PRMP (identifiant unifié). */
  idPrmp: string;
  nomPrmp: string;
  prenomsPrmp: string;
  arreteNomin: string;
  dateNomin: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailPrmp: string;
  telPrmp: string;
}

/** Entité du référentiel réduit public (GET /api/auth/entites). */
export interface EntitePubliqueDto {
  idEntiteContract: number;
  libelleEntite: string;
  adresse?: string;
  categorieEntite?: string;
  idLocalite?: string;
}

/** Entité « non listée » proposée à l'inscription (validée plus tard par l'admin). */
export interface EntiteNonListee {
  libelle: string;
  adresse?: string;
  idLocalite: string;
  categorie?: string;
}

/** Part `data` (application/json) de l'inscription v2 multipart. */
export interface RegisterPrmpV2Request {
  login: string;
  motDePasse: string;
  /** = matricule de la PRMP (identifiant unifié). */
  idPrmp: string;
  nomPrmp: string;
  prenomsPrmp: string;
  arreteNomin: string;
  dateNomin: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailPrmp: string;
  telPrmp: string;
  idEntites: number[];
  entitesNonListees: EntiteNonListee[];
}

/** Réponse de POST /api/auth/register/prmp (compte créé inactif, en attente de validation). */
export interface RegisterResponse {
  login: string;
  refActeur: string;
  typeActeur: TypeActeur;
  /** Toujours false à l'inscription (validation admin requise). */
  actif: boolean;
  /** Statut du compte à l'inscription (toujours `EN_ATTENTE`). */
  statut?: string;
  message: string;
}

/** Corps de POST /api/mon-compte/changer-mot-de-passe. */
export interface ChangePasswordRequest {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}

/** Réponse générique porteuse d'un message d'information. */
export interface MessageResponse {
  message: string;
}
