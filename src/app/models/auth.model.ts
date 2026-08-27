import { Role, TypeActeur } from './common.model';

/** Corps de `POST /api/auth/login` (seule route publique). */
export interface LoginRequest {
  login: string;
  motDePasse: string;
}

/** Réponse de `POST /api/auth/login`. */
export interface LoginResponse {
  /**
   * JWT. ⚠️ Phase 2 du plan cookie (2026-08-17) : la session est portée par le cookie HttpOnly
   * `PRS_SESSION` posé par le serveur — le front N'UTILISE PLUS ce champ et ne le stocke jamais.
   * Encore renseigné tant que le backend est en phase 1 ; `null` quand il passera en phase 3
   * (`app.auth.cookie.exclusif=true`).
   */
  token: string | null;
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
  /**
   * « Nom Prénoms » résolu côté serveur pour TOUS les types d'acteur (PRMP, contrôleur, UGPM, admin) —
   * toujours renseigné (repli serveur sur le login). Disponible seulement à la connexion : persisté avec
   * la session. Absent d'une session antérieure à la livraison → repli front sur les anciens lookups.
   */
  nomAffichage?: string;
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
  /** Obligatoire : le backend la refuse vide (`@NotBlank` sur `EntiteNonListeeRequest`). */
  adresse: string;
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

/** PRMP du référentiel réduit public (`GET /api/auth/prmps`), pour le menu « PRMP de tutelle ». */
export interface PrmpPublique {
  idPrmp: string;
  nomPrmp: string;
  prenomsPrmp: string;
}

/** Part `data` (application/json) de l'auto-inscription UGPM multipart (public). */
export interface RegisterUgpmRequest {
  login: string;
  motDePasse: string;
  /** = matricule de l'UGPM (identifiant unifié). */
  idUgpm: string;
  libelle?: string;
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  /** PRMP de tutelle (= matricule) — obligatoire. */
  idPrmpTutelle: string;
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
