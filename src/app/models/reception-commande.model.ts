/**
 * ⚠️ Lot MS-4 (V127, 16/10 ; demande « marchés subséquents ») — **la réception des commandes** (loi n° 2016-055, art. 13 ; CCAG
 * fournitures, art. 22) : la commission de réception désignée par décision de la PRMP (Q1), la livraison déclarée, le procès-verbal
 * établi par le président (réception, ajournement, réfaction, rejet), les signatures, puis la réception définitive au terme de la
 * garantie. Distinct de `/api/receptions` (la réception des dossiers par la Commission).
 */
export type TypeReceptionCommande = 'PROVISOIRE' | 'DEFINITIVE' | (string & {});

export type EtatReceptionCommande = 'A_ETABLIR' | 'PV_ETABLI' | 'SIGNE' | (string & {});

export type DecisionReceptionCommande = 'RECEPTION' | 'AJOURNEMENT' | 'REFACTION' | 'REJET';

export type EtatReceptionBon =
  | 'A_LIVRER' | 'EN_RECEPTION' | 'AJOURNE' | 'REJETE' | 'RECU_PROVISOIRE' | 'EN_RECEPTION_DEFINITIVE' | 'RECU_DEFINITIF' | 'ANNULE'
  | (string & {});

export interface MembreCommissionReception {
  id: number | null;
  nom: string;
  prenom: string | null;
  email: string;
  fonction: string | null;
  president: boolean;
  idCompte: string | null;
  compteActif: boolean;
}

/** `GET /api/contrats-en-vigueur/{id}/commission-reception` ; membres vides tant qu'elle n'est pas désignée. */
export interface CommissionReception {
  idContrat: number;
  decisionReference: string | null;
  decisionDate: string | null;
  presideeParPrmp: boolean;
  membres: MembreCommissionReception[];
  majLe: string | null;
  majPar: string | null;
}

/** Corps du `PUT` : la décision de la PRMP (saisie par elle ou l'UGPM). */
export interface CommissionReceptionCorps {
  decision: { reference: string; date: string };
  presideeParPrmp: boolean;
  membres: { nom: string; prenom: string | null; email: string; fonction: string | null; president: boolean }[];
}

/** Un signataire attendu : `signataire` = le compte du membre, ou `PRMP`. */
export interface SignataireReception {
  signataire: string;
  nom: string | null;
  president: boolean;
  signeLe: string | null;
}

export interface ReceptionCommande {
  id: number;
  idBon: number;
  numeroBon: number;
  idContrat: number;
  idDmc: number;
  lot: number;
  type: TypeReceptionCommande;
  etat: EtatReceptionCommande;
  dateLivraison: string | null;
  livraisonObservations: string | null;
  declareeLe: string | null;
  declareePar: string | null;
  decision: DecisionReceptionCommande | null;
  dateReception: string | null;
  motif: string | null;
  reserves: string | null;
  montantBon: number | null;
  montantRefaction: number | null;
  montantReceptionne: number | null;
  echeanceLivraison: string | null;
  joursRetard: number | null;
  /** En pour mille du montant du bon, par jour de retard (⚠️ hypothèse : 1 ‰ à défaut). */
  tauxPenalite: number | null;
  plafondPenalite: number | null;
  /** Indicative, jamais retenue par l'application. */
  penaliteIndicative: number | null;
  penaliteNote: string | null;
  etabliLe: string | null;
  etabliPar: string | null;
  pvDisponible: boolean;
  attendus: SignataireReception[];
  signeLe: string | null;
}

/** `GET /api/receptions-commandes/bons/{idBon}` (et l'espace du titulaire). */
export interface ReceptionsBon {
  idBon: number;
  numero: number;
  objet: string | null;
  titulaire: string | null;
  etatReception: EtatReceptionBon;
  garantieMois: number | null;
  garantieJusquau: string | null;
  /** `RECEPTION_DEFINITIVE_A_PRONONCER` : le délai de garantie est écoulé. */
  alertes: string[];
  receptions: ReceptionCommande[];
}

/** `GET /api/receptions-commandes/miennes` — une réception à traiter par un membre de la commission. */
export interface ReceptionAMoi {
  reception: ReceptionCommande;
  objetBon: string | null;
  titulaire: string | null;
  president: boolean;
  aEtablir: boolean;
  aSigner: boolean;
}

export interface LivraisonCorps {
  dateLivraison: string | null;
  observations: string | null;
}

export interface PvReceptionCorps {
  decision: DecisionReceptionCommande;
  dateReception: string | null;
  motif: string | null;
  reserves: string | null;
  montantRefaction: number | null;
  tauxJournalier: number | null;
}
