/**
 * ⚠️ Lot MS-1 (V124, 16/10 ; demande « marchés subséquents ») — le **contrat en vigueur** : créé à la notification d'un lot de
 * contrat-cadre ou de marché à commandes, ce qui le régit figé depuis la fiche validée (décret n° 2019-1064, art. 8, 18, 19, 34 ;
 * loi n° 2016-055, art. 30). `GET /api/contrats-en-vigueur[/{id}]`.
 */
export type EtatContratVigueur = 'EN_VIGUEUR' | 'ECHU' | (string & {});

export type AlerteContrat = 'RECONDUCTION_A_DECIDER' | 'ECHEANCE_PROCHE' | 'ECHU' | (string & {});

export type DecisionReconduction = 'RECONDUIRE' | 'NE_PAS_RECONDUIRE';

/** Un titulaire : la liste est fermée (art. 18), lue sur l'attribution, les retirés exclus. */
export interface TitulaireContrat {
  idOffre: string;
  numero: number | null;
  candidat: string | null;
  nif: string | null;
  montant: number | null;
  delai: string | null;
  rang: number | null;
}

export interface DecisionContrat {
  id: number;
  decision: DecisionReconduction;
  reference: string;
  dateDecision: string;
  finAvant: string | null;
  nouvelleFin: string | null;
  /** Décision prise après la limite du préavis : acceptée, mais marquée. */
  horsPreavis: boolean;
  le: string;
  par: string | null;
}

export interface ContratVigueur {
  id: number;
  idDmc: number;
  lot: number;
  /** `CONTRAT_CADRE` ou `MARCHE_A_COMMANDES` (code servi par le référentiel). */
  typeMarche: string | null;
  objet: string | null;
  acheteur: string | null;
  etat: EtatContratVigueur;
  dateEffet: string;
  dateFin: string;
  periodeMois: number | null;
  dureeMaxMois: number | null;
  finMaximale: string | null;
  reconductible: boolean;
  reconductionsMax: number | null;
  reconductions: number;
  preavisMois: number | null;
  /** `dateFin` − préavis : au-delà, une décision est marquée hors préavis. */
  dateLimiteDecision: string | null;
  montantEstime: number | null;
  montantMinimum: number | null;
  montantMaximum: number | null;
  formeSubsequents: string | null;
  rythme: string | null;
  calendrier: string | null;
  titulaires: TitulaireContrat[];
  decisions: DecisionContrat[];
  alertes: AlerteContrat[];
}

/** Corps de `POST /api/contrats-en-vigueur/{id}/reconduction` (PRMP de la fiche). */
export interface ReconductionCorps {
  decision: DecisionReconduction;
  reference: string;
  dateDecision: string;
}
