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

/** Fiche de la personne PRMP. PK = `idPrmp` = **matricule** (identifiant unifié, comme les contrôleurs). */
export interface Prmp {
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
  // Pas d'idLocalite : la PRMP n'a pas de localité propre (dérivée de l'entité du dossier).
}

/**
 * Corps de `POST /api/prmps` (Admin) : `PrmpDto` + **compte optionnel** (`login`/`motDePasse`).
 * Fournis **ensemble** → crée aussi le compte PRMP **actif** (parité UGPM, connectable de suite).
 * Un seul des deux → **400** ; `idPrmp` ou `login` déjà pris → **409**.
 */
export interface CreerPrmpRequest extends Prmp {
  login?: string;
  motDePasse?: string;
}

/**
 * UGPM (Unité de Gestion de la Passation des Marchés), rattachée à **une** PRMP de tutelle.
 * `GET /api/ugpms` → `UgpmDto[]` (Admin). PK = idUgpm (string).
 */
export interface Ugpm {
  /** = matricule de l'UGPM (identifiant unifié, comme les contrôleurs). */
  idUgpm: string;
  libelle?: string;
  /** PRMP de tutelle (= matricule de la PRMP). */
  idPrmpTutelle: string;
  // Identité (alignée PRMP, sans arrêté/date de nomination) — champs obligatoires.
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  /** Login du compte associé, exposé en **lecture seule** (jamais le mot de passe) ; pré-remplit la réinitialisation. */
  login?: string;
}

/**
 * Corps de `POST /api/ugpms` (Admin) : crée l'UGPM **et** son compte d'authentification actif
 * (TYPE_ACTEUR='UGPM'). 409 si idPrmpTutelle inconnue, idUgpm déjà pris, ou login déjà utilisé ;
 * 400 si un champ d'identité obligatoire manque.
 */
export interface CreerUgpmRequest {
  /** = matricule de l'UGPM (identifiant unifié). */
  idUgpm: string;
  libelle?: string;
  idPrmpTutelle: string;
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  login: string;
  motDePasse: string;
}

/**
 * Corps de `PUT /api/ugpms/{id}` (Admin) — **champs métier éditables uniquement** : ni `idUgpm`
 * (matricule, porté par l'URL), ni le compte (login/motDePasse). 404 si UGPM inconnue ;
 * 409 si la nouvelle `idPrmpTutelle` est inconnue (réaffectation possible).
 */
export interface ModifierUgpmRequest {
  libelle?: string;
  idPrmpTutelle: string;
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
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
