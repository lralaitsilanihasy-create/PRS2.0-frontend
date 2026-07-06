/** Comptes et hiérarchie (gestion ADMINISTRATEUR, lecture ouverte). */

/** Contrôleur (compte interne CNM). PK = imControleur (matricule). */
export interface Controleur {
  imControleur: string;
  nomCont?: string;
  prenomsCont?: string;
  emailCont?: string;
  telCont?: string;
  idProfile?: number;
  /** `null` = toutes localités (cas Président). */
  idLocalite?: string | null;
  idSuperieur?: string;
  transversal: boolean;
}

/** Fiche de la personne PRMP (distincte des PPM/marchés soumis). PK = idPrmp (string). */
export interface Prmp {
  idPrmp: string;
  nomPrmp: string;
  prenomsPrmp: string;
  imPrmp: string;
  arreteNomin: string;
  dateNomin: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailPrmp: string;
  telPrmp: string;
  idLocalite: string;
}

/**
 * UGPM (Unité de Gestion de la Passation des Marchés), rattachée à **une** PRMP de tutelle.
 * `GET /api/ugpms` → `UgpmDto[]` (Admin). PK = idUgpm (string).
 */
export interface Ugpm {
  idUgpm: string;
  libelle?: string;
  /** PRMP de tutelle (FK t_prmp.idPrmp). */
  idPrmpTutelle: string;
  // Identité (alignée PRMP, sans arrêté/date de nomination) — champs obligatoires.
  nomUgpm: string;
  prenomsUgpm: string;
  imUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
}

/**
 * Corps de `POST /api/ugpms` (Admin) : crée l'UGPM **et** son compte d'authentification actif
 * (TYPE_ACTEUR='UGPM'). 409 si idPrmpTutelle inconnue, idUgpm déjà pris, ou login déjà utilisé ;
 * 400 si un champ d'identité obligatoire manque.
 */
export interface CreerUgpmRequest {
  idUgpm: string;
  libelle?: string;
  idPrmpTutelle: string;
  nomUgpm: string;
  prenomsUgpm: string;
  imUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  login: string;
  motDePasse: string;
}

/** Organigramme d'un ministère. */
export interface Organigramme {
  idOrganigramme: number;
  idMinistere: number;
  libelle?: string;
  version?: string;
  dateValidation?: string;
  actif: boolean;
}
