/**
 * ⚠️ AMI en ligne, tranche AMI-a (07/10, V82 ; `demande-backend-2026-10-07-ami-pi.md`, §B1, §B2) — l'appel à manifestation
 * d'intérêt d'une procédure de prestations intellectuelles (loi 2016-055, art. 32 et 42-II). Les critères vivent sur l'AMI, pas
 * dans la fiche : il précède la demande de propositions et se fige à la publication.
 */

export type EtatAmi = 'BROUILLON' | 'PUBLIE' | 'DISPENSE';

/** Un critère de sélection : `poids` en points sur 100 (les poids totalisent 100). `code` (C1, C2…) est donné par le serveur s'il manque. */
export interface CritereAmi {
  code: string | null;
  libelle: string;
  poids: number;
  description: string | null;
}

/** Un support de publication déclaré par la PRMP (art. 32-III). `date` : AAAA-MM-JJ. */
export interface PublicationAmi {
  support: string;
  date: string;
  reference: string | null;
}

/** `GET /api/fiches-marche/{idDmc}/ami` — PRMP, UGPM, membres de la CAO ; 404 tant qu'il n'est pas préparé. */
export interface Ami {
  idDmc: number;
  etat: EtatAmi;
  objet: string | null;
  autoriteContractante: string | null;
  reference: string | null;
  dateLimite: string | null;
  criteres: CritereAmi[];
  pieces: string[];
  noteMinimale: number | null;
  nombreRetenus: number | null;
  motifDispense: string | null;
  publications: PublicationAmi[];
  avisDisponible: boolean;
  publieLe: string | null;
  publiePar: string | null;
  /** La date limite est passée : les expressions se lisent (arbitrage Q2). */
  lectureOuverte: boolean;
  /** Le nombre d'expressions déposées, servi à tout moment — jamais leur contenu avant la date limite. */
  nombreExpressions: number;
}

/** `PUT …/ami` — modifiable tant que l'AMI n'est pas publié. `dateLimite` : AAAA-MM-JJTHH:mm. */
export interface AmiCorps {
  dateLimite: string;
  criteres: CritereAmi[];
  pieces: string[];
  noteMinimale: number | null;
  nombreRetenus: number | null;
}

/** `GET /api/amis-en-ligne[/{idDmc}]` — public, sans session ; `ouvert` tant que la date limite n'est pas passée. */
export interface AmiPublic {
  idDmc: number;
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  dateLimite: string | null;
  criteres: CritereAmi[];
  pieces: string[];
  nombreRetenus: number | null;
  publications: PublicationAmi[];
  publieLe: string | null;
  ouvert: boolean;
}

export interface ReferenceMission {
  intitule: string;
  client: string;
  annee: number | null;
  montant: number | null;
  description: string | null;
}

export interface MembreGroupement {
  nif: string;
  raisonSociale: string;
  role: string;
}

/** Une pièce attendue de l'AMI (`libelle`) et le nom du fichier qui la porte dans les parties `fichiers`. */
export interface PieceDeclaree {
  libelle: string;
  fichier: string;
}

/** La partie `expression` (JSON) du dépôt multipart. */
export interface ExpressionCorps {
  lettre: string;
  qualifications: string | null;
  references: ReferenceMission[];
  groupement: MembreGroupement[];
  pieces: PieceDeclaree[];
}

export interface PieceExpression {
  id: number;
  libelle: string;
  nom: string;
  format: string;
  taille: number;
  empreinte: string;
}

export type EtatExpression = 'DEPOSEE' | 'REMPLACEE' | 'RETIREE';

/** Une expression d'intérêt ; `empreinte` = SHA-256 du contenu et des pièces (l'accusé de dépôt). */
export interface Expression {
  id: string;
  numero: number;
  nif: string | null;
  raisonSociale: string | null;
  etat: EtatExpression;
  deposeeLe: string;
  empreinte: string;
  lettre: string;
  qualifications: string | null;
  references: ReferenceMission[];
  groupement: MembreGroupement[];
  pieces: PieceExpression[];
}
