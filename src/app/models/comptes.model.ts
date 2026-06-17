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

/** Organigramme d'un ministère. */
export interface Organigramme {
  idOrganigramme: number;
  idMinistere: number;
  libelle?: string;
  version?: string;
  dateValidation?: string;
  actif: boolean;
}
