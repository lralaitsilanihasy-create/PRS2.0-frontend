import type { RabaisLu } from './cao.model';

/**
 * ⚠️ Évaluation des offres, lot 1 (demande du 07/10, livrée en tranches 1a à 1d : V76, V77, V78) — les objets de
 * `GET /api/fiches-marche/{idDmc}/evaluation` et de ses gestes. Noms confirmés par le backend (`docs/api-endpoints.md`,
 * § *L'évaluation des offres*). Le serveur calcule tout (montant évalué, rang, tour de post-qualification, proposition) :
 * ces types ne portent aucune règle.
 */

export type EtatEvaluation = 'EN_COURS' | 'RAPPORT_A_SIGNER' | 'CLOSE';

/** Les étapes d'un lot, dans leur ordre ; `RAPPORT` : toutes arrêtées. */
export type EtapeEvaluation = 'CONFORMITE' | 'EVALUATION' | 'ANORMALES' | 'QUALIFICATION' | 'RAPPORT';
export const ETAPES_EVALUATION: readonly Exclude<EtapeEvaluation, 'RAPPORT'>[] = ['CONFORMITE', 'EVALUATION', 'ANORMALES', 'QUALIFICATION'];

export type QualificationRejet = 'IRRECEVABLE' | 'NON_CONFORME' | 'INAPPROPRIEE' | 'INACCEPTABLE';

export type CodeVerification =
  | 'AE_PRIX' | 'GARANTIE' | 'OFFRE_UNIQUE' | 'EXCLUSION' | 'POUVOIRS' | 'PIECES' | 'CONFORMITE_TECHNIQUE' | 'INTEGRITE' | 'FRAIS_DOSSIER';

export interface DeclarationMembre {
  /** Identifiant du membre (`K…`). */
  membre: string;
  nom: string;
  president: boolean;
  /** Nul tant que le membre n'a pas signé sa déclaration. */
  signeeLe: string | null;
  conflit: boolean | null;
  precision: string | null;
}

export interface EtapeArretee {
  etape: EtapeEvaluation;
  par: string;
  nom: string | null;
  le: string;
  observation: string | null;
}

export interface VerificationConformite {
  code: CodeVerification;
  libelle: string;
  /** Vrai, faux, ou nul (sans objet, ou à examiner). Une proposition n'est jamais une décision. */
  proposee: boolean | null;
  constat: string | null;
  /** La valeur de la CAO si elle a décidé, la proposée sinon. */
  satisfaite: boolean | null;
  observation: string | null;
}

/** Qui a décidé, et quand — commun à chaque décision. */
export interface Auteur {
  par: string | null;
  nom: string | null;
  le: string | null;
}

export interface Conformite extends Auteur {
  verifications: VerificationConformite[];
  decision: 'CONFORME' | 'ECARTEE' | null;
  qualification: QualificationRejet | null;
  motif: string | null;
  clause: string | null;
}

export type RegleCorrection = 'PU_PREVAUT' | 'LETTRES_PREVALENT' | 'REPORT' | 'AUTRE';

export interface Correction {
  /** Nulle pour une correction d'ensemble (`PU_PREVAUT`). */
  ligne: number | null;
  libelle: string;
  avant: number;
  apres: number;
  regle: RegleCorrection;
  retenue?: boolean;
}

export interface Rabais {
  montant: number;
  lecture: string | null;
  /** ⚠️ 07/10 (rabais structuré) — la proposition du serveur (sur le prix corrigé), et ce que le candidat a déclaré. */
  propose?: number | null;
  nature?: 'POURCENTAGE' | 'MONTANT' | null;
  valeur?: number | null;
  condition?: 'AUCUNE' | 'LOTS' | null;
  lots?: number[] | null;
  /** Le motif d'une correction du rabais proposé. */
  motif?: string | null;
}

export interface Preference {
  eligible: boolean;
  motif: string | null;
  taux?: number | null;
  ajustement?: number | null;
}

export interface CritereMonetise {
  libelle: string;
  montant: number;
  justification: string;
}

export interface RefusCandidat {
  motif: string;
  clause: string;
}

export interface MontantEvalue extends Auteur {
  prixLu: number | null;
  prixLuTtc: number | null;
  corrections: Correction[];
  refusCandidat: RefusCandidat | null;
  rabais: Rabais | null;
  preference: Preference | null;
  criteres: CritereMonetise[];
  prixCorrige: number | null;
  montantEvalue: number | null;
}

export type EtatDemande = 'EN_ATTENTE' | 'REPONDUE' | 'EXPIREE';

/** Une demande de précision (art. 35-VI) ou de justification d'un prix (art. 48), et la réponse du candidat. */
export interface DemandeEvaluation {
  idDemande: number;
  idOffre: string;
  numero: number | null;
  type: 'PRECISION' | 'JUSTIFICATION';
  question: string;
  delaiJours: number | null;
  echeance: string | null;
  demandeeLe: string;
  etat: EtatDemande;
  reponse: string | null;
  fichier: string | null;
  tailleFichier: number | null;
  reponduLe: string | null;
}

export type DecisionAnormale = 'NON_SUSPECTEE' | 'SUSPECTEE' | 'MAINTENUE' | 'REJETEE';

export interface Anormale extends Auteur {
  suspectee: boolean;
  decision: DecisionAnormale | null;
  motif: string | null;
  justification: DemandeEvaluation | null;
}

export type GroupeCritere = 'JURIDIQUE' | 'FINANCIERE' | 'TECHNIQUE';
export type DecisionCritere = 'SATISFAIT' | 'NON_SATISFAIT';

export interface CritereQualification {
  code: string;
  groupe: GroupeCritere;
  libelle: string;
  exigence: string | null;
  constat: string | null;
  /** Faux sur une alerte de séance ; nul sinon (« à vérifier sur l'offre »). */
  proposee: boolean | null;
  decision: DecisionCritere | null;
  motif: string | null;
}

export interface Qualification extends Auteur {
  /** Nul quand toutes les offres classées ont échoué (infructuosité proposée). */
  idOffre: string | null;
  numero: number | null;
  criteres: CritereQualification[];
  decision: 'QUALIFIE' | 'NON_QUALIFIE' | null;
  motif: string | null;
  clause: string | null;
}

export interface OffreEcartee {
  etape: EtapeEvaluation;
  qualification: QualificationRejet | null;
  motif: string | null;
  clause: string | null;
  par: string | null;
  nom: string | null;
  le: string | null;
}

export interface OffreEvaluee {
  idOffre: string;
  numero: number | null;
  entreprise: { nif: string; raisonSociale: string };
  conformite: Conformite | null;
  evaluation: MontantEvalue | null;
  anormale: Anormale | null;
  qualification: Qualification | null;
  rang: number | null;
  exAequo?: boolean;
  ecartee: OffreEcartee | null;
  precisionsEnAttente: number;
  /** ⚠️ 07/10 — le rabais lu en séance (chiffré sur le HT lu), pour pré-remplir l'étape 3 avant toute saisie. */
  rabaisDeclare?: RabaisLu | null;
}

export interface PropositionAttribution {
  idOffre: string | null;
  numero: number | null;
  candidat: string | null;
  /** Prix corrigé − rabais, hors taxes. */
  montant: number | null;
  montantTtc: number | null;
  delai: string | number | null;
  infructueux: boolean;
}

export interface LotEvaluation {
  lot: number;
  etape: EtapeEvaluation;
  etapesArretees: EtapeArretee[];
  offres: OffreEvaluee[];
  proposition?: PropositionAttribution | null;
}

export interface OffreNonEvaluee {
  numero: number | null;
  entreprise: string | { nif?: string; raisonSociale?: string } | null;
  etat: string;
  motif: string | null;
}

export interface SignatureRapport {
  im: string;
  nom: string;
  president: boolean;
  date: string | null;
  empechement: boolean;
  motif: string | null;
  constatePar: string | null;
  observation: string | null;
}

export interface RapportEvaluation {
  produitLe: string;
  observations: string | null;
  signe: boolean;
  signeLe: string | null;
  signatures: SignatureRapport[];
  signaturesAttendues: { im: string; nom: string }[];
}

export interface Evaluation {
  idDmc: number;
  etat: EtatEvaluation;
  ouverteLe: string;
  ouvertePar: string | null;
  declarations: DeclarationMembre[];
  lots: LotEvaluation[];
  nonEvaluees: OffreNonEvaluee[];
  rapport?: RapportEvaluation | null;
}

/** `GET …/lots/{lot}/tableau` — le tableau d'évaluation du guide (p. 9). */
export interface LigneTableau {
  idOffre: string;
  numero: number | null;
  candidat: string;
  prixLu: number | null;
  prixLuTtc: number | null;
  /** « 1 700 000 MGA », « présente », « absente ». */
  garantie: string | null;
  conforme: boolean | null;
  /** « motif (clause) » de l'étape qui a écarté l'offre. */
  motifRejet: string | null;
  prixCorrige: number | null;
  rabais: number | null;
  ajustements: number | null;
  montantEvalue: number | null;
  rang: number | null;
  exAequo: boolean;
  qualifie: boolean | null;
}

/** `GET …/lots/{lot}/indicateurs-prix` — des indicateurs, jamais une décision. */
export interface IndicateursPrix {
  /** `B06-EO-07` ; nul sans méthode au DAO. */
  methodeDao: string | null;
  estimation: number | null;
  moyenne: number | null;
  offres: { idOffre: string; numero: number | null; montant: number | null; ecartEstimation: number | null; ecartMoyenne: number | null; alertes: string[] }[];
}

export interface EntreeJournalEvaluation {
  date: string;
  acteur: string;
  action: string;
  detail: string | null;
}

/** Corps de `PUT …/montant`. */
export interface MontantRequest {
  prixLu?: number | null;
  corrections: Correction[];
  refusCandidat?: RefusCandidat | null;
  rabais?: { montant: number; lecture?: string | null; motif?: string | null } | null;
  preference?: { eligible: boolean; motif?: string | null } | null;
  criteres?: CritereMonetise[];
}

// ── Attribution, lot 2 (tranche 2a, V79) ─────────────────────────────────────────────────────────────────────────────

/** États d'un lot après l'évaluation (tranche 2a ; les suivants viennent avec leurs gestes). */
export type EtatAttribution = 'EN_EVALUATION' | 'PROPOSE' | 'AU_CONTROLE' | 'AVIS_RENDU' | (string & {});

/** Le dossier de marché (famille `DDM`) d'un lot, au contrôle de la Commission. */
export interface DossierMarche {
  idDossier: number;
  sousType: string;
  statut: string | null;
  /** L'avis du dernier PV signé du dossier : `FAV`, `FAVR`, `DEF` ; nul avant. */
  avis: string | null;
  creeLe: string | null;
  creePar: string | null;
}

export interface LotAttribution {
  lot: number;
  etat: EtatAttribution;
  /** La proposition du rapport d'évaluation ; nulle tant qu'il n'est pas signé. */
  proposition: PropositionAttribution | null;
  dossierMarche: DossierMarche | null;
  /** Le projet de marché produit par le serveur (avec le dossier) se télécharge. */
  projetDisponible: boolean;
}

/** `GET /api/fiches-marche/{idDmc}/attribution` — 404 tant que l'évaluation n'est pas ouverte. */
export interface Attribution {
  idDmc: number;
  lots: LotAttribution[];
}
