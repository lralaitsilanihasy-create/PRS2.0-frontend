/**
 * ⚠️ Lot MS-2 (V125, 16/10 ; demande « marchés subséquents ») — la **remise en concurrence** des titulaires d'un contrat-cadre et
 * le **marché subséquent** (décret n° 2019-1064, art. 20-33 ; loi n° 2016-055, art. 33). Un seul titulaire : `COMPLETUDE` (il
 * complète son offre initiale). Les réponses sont fermées jusqu'à l'échéance (montants, délai, fichier et écart nuls avant).
 */
export type ModeRemiseConcurrence = 'CONCURRENCE' | 'COMPLETUDE' | (string & {});

export type EtatRemise = 'EN_COURS' | 'EVALUEE' | 'ATTRIBUEE' | 'INFRUCTUEUSE' | (string & {});

export type NatureReponseRemise = 'DEVIS' | 'FACTURE_PRO_FORMA' | 'DOCUMENT_CONVENU';

export type AlerteRemise = 'EXCLUSION_POSSIBLE' | 'DELIEMENT_POSSIBLE' | 'PLAFOND_DEPASSE' | (string & {});

export interface ConsulteRemise {
  idOffre: string;
  numero: number | null;
  candidat: string | null;
  notifieLe: string | null;
  reponseRecue: boolean;
  sansReponse: boolean;
  absencesConsecutives: number | null;
}

export interface ReponseRemise {
  id: number;
  idOffre: string;
  numero: number | null;
  candidat: string | null;
  nature: NatureReponseRemise | (string & {});
  /** `EN_LIGNE` (le titulaire) ou `PAPIER` (saisie par la PRMP ou l'UGPM). */
  voie: string | null;
  montantHt: number | null;
  montantTtc: number | null;
  delai: string | null;
  recueLe: string | null;
  /** Nom du fichier joint ; nul avant l'échéance. */
  fichier: string | null;
  conforme: boolean | null;
  motif: string | null;
  /** (montant − prix moyen) / prix moyen, en %, au dixième ; nul sans prix moyen. */
  ecartPrixMoyen: number | null;
  /** Rang parmi les conformes, par montant HT. */
  rang: number | null;
  plafondDepasse: boolean | null;
}

export interface Remise {
  id: number;
  idContrat: number;
  idDmc: number;
  lot: number;
  numero: number;
  mode: ModeRemiseConcurrence;
  etat: EtatRemise;
  objet: string;
  specifications: string | null;
  criteres: string | null;
  lieuLivraison: string | null;
  delaiExecution: string | null;
  validiteJours: number | null;
  visite: string | null;
  echeance: string;
  echeancePassee: boolean;
  lanceeLe: string | null;
  lanceePar: string | null;
  lettreDisponible: boolean;
  consultes: ConsulteRemise[];
  reponses: ReponseRemise[];
  prixMoyen: number | null;
  idOffreProposee: string | null;
  observations: string | null;
  evalueeLe: string | null;
  evalueePar: string | null;
  rapportDisponible: boolean;
  idOffreRetenue: string | null;
  montantRetenu: number | null;
  motifDecision: string | null;
  decideeLe: string | null;
  decideePar: string | null;
  alertes: AlerteRemise[];
}

/** Corps de `POST /api/contrats-en-vigueur/{id}/remises` (PRMP ou UGPM). `echeance` : date-heure ISO locale. */
export interface LancementRemise {
  objet: string;
  specifications: string;
  criteres: string | null;
  lieuLivraison: string | null;
  delaiExecution: string;
  validiteJours: number | null;
  visite: string | null;
  echeance: string | null;
}

/** Corps de `POST /api/remises/{id}/evaluation` (⚠️ H1 : le président de la CAO de la procédure). */
export interface EvaluationRemise {
  prixMoyen: number | null;
  decisions: { idOffre: string; conforme: boolean; motif: string | null }[];
  idOffreProposee: string | null;
  observations: string | null;
}

/** La réponse, en ligne (le titulaire) ou papier (PRMP, UGPM) : multipart. */
export interface ReponseRemiseCorps {
  nature: NatureReponseRemise;
  montantHt: number;
  montantTtc: number | null;
  delai: string | null;
}

export type ResultatRemiseTitulaire = 'EN_COURS' | 'RETENU' | 'NON_RETENU' | 'INFRUCTUEUSE' | (string & {});

/** `GET /api/candidat/remises` — une remise où l'une des offres du candidat est consultée. */
export interface RemiseTitulaire {
  id: number;
  numero: number;
  idOffre: string;
  objet: string;
  objetContrat: string | null;
  echeance: string;
  echeancePassee: boolean;
  delaiExecution: string | null;
  lieuLivraison: string | null;
  maReponse: ReponseRemise | null;
  resultat: ResultatRemiseTitulaire;
  motif: string | null;
  dateContrat: string | null;
}
