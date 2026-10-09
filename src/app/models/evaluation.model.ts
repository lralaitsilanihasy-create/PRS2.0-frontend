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
  /** ⚠️ Lot 3 PI, PI-d2b (V90) — l'enveloppe financière de la proposition (PI) ; nulle pour une offre. */
  idOffreFinanciere?: string | null;
  /** ⚠️ PI-d2b — le motif de l'infructuosité proposée (PI) : toutes écartées, une seule conforme, aucune au score minimum… */
  motifInfructuosite?: string | null;
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
export type EtatAttribution =
  | 'EN_EVALUATION' | 'PROPOSE' | 'AU_CONTROLE' | 'AVIS_RENDU' | 'ATTRIBUE' | 'INFORME' | 'SIGNABLE' | 'SIGNE' | 'NOTIFIE' | 'PUBLIE' | 'RETIRE'
  | (string & {});

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
  // ⚠️ Tranches 2b et 2c (V80, V81) — nuls, ou listes vides, avant leur geste.
  attributaire?: Attributaire | null;
  information?: InformationCandidats | null;
  delaiAttente?: DelaiAttente | null;
  explications?: Explication[];
  miseAuPoint?: { rapport: string; le: string; par: string | null; fichier: FichierAttribution | null } | null;
  recours?: Recours[];
  signature?: { dateSignature: string; le: string; par: string | null; fichier: FichierAttribution | null } | null;
  enregistrement?: { date: string; reference: string | null; le: string; fichier: FichierAttribution | null } | null;
  notification?: { date: string; le: string; par: string | null; recueLe: string | null; receptionDeclaree: boolean } | null;
  avisAttribution?: { echeance: string; datePublication: string | null; publieLe: string | null; par: string | null; disponible: boolean } | null;
  piecesAttributaire?: PiecesAttributaire | null;
  retrait?: { le: string; par: string | null; motif: string } | null;
}

/** L'offre attribuée : montant hors taxes et délai (avec son unité) figés au choix de la PRMP. */
export interface Attributaire {
  idOffre: string;
  numero: number | null;
  candidat: string;
  nif: string | null;
  montant: number | null;
  montantTtc: number | null;
  delai: string | null;
  motif: string | null;
  le: string;
  par: string | null;
}

export interface LettreCandidat {
  id: number;
  idOffre: string;
  numero: number | null;
  candidat: string;
  type: 'ATTRIBUTION' | 'NON_RETENU';
  motif: string | null;
  /** Envoi du courriel (nul sans adresse). */
  envoyeeLe: string | null;
  /** Accusé de lecture de la plateforme. */
  lueLe: string | null;
}

export interface InformationCandidats {
  le: string;
  par: string | null;
  signataire: string | null;
  dateAffichage: string;
  lettres: LettreCandidat[];
}

/** Dix jours francs depuis la plus tardive de l'information et de l'affichage (art. 52, 78). */
export interface DelaiAttente {
  debut: string;
  fin: string;
  /** Premier jour où la signature est possible. */
  signableLe: string;
  jours: number;
  ecoule: boolean;
}

export interface Explication {
  id: number;
  idOffre: string;
  numero: number | null;
  candidat: string | null;
  question: string;
  demandeeLe: string;
  etat: 'EN_ATTENTE' | 'REPONDUE';
  reponse: string | null;
  reponseNom: string | null;
  reponseTaille: number | null;
  reponduLe: string | null;
}

export interface FichierAttribution {
  id: number;
  nature: string | null;
  nom: string;
  format: string | null;
  taille: number | null;
  deposeLe: string | null;
}

export type TypeRecours = 'REEXAMEN' | 'REVISION_ARMP' | 'REFERE';

export interface Recours {
  id: number;
  type: TypeRecours;
  dateReception: string;
  requerant: string;
  objet: string;
  declareLe: string;
  declarePar: string | null;
  fichiers: FichierAttribution[];
  suspensif: boolean;
  finSuspension: string | null;
  echeanceReponse: string | null;
  /** La signature est-elle fermée aujourd'hui par ce recours ? */
  bloquant: boolean;
  decision: { date: string; issue: 'REJETE' | 'ACCUEILLI' | 'AUTRE'; motif: string; le: string; par: string | null; fichiers: FichierAttribution[] } | null;
}

export interface PieceAttributaire {
  id: number;
  type: 'FISCALE' | 'SOCIALE';
  dateDelivrance: string;
  nom: string;
  taille: number | null;
  deposeLe: string;
  conforme: boolean | null;
  motif: string | null;
  verifieeLe: string | null;
}

/** Art. 20-I : fiscale de moins de six mois, sociale de moins de trois mois, sous 15 jours de la lettre d'attribution. */
export interface PiecesAttributaire {
  echeance: string;
  delaiDepasse: boolean;
  fiscaleConforme: boolean | null;
  socialeConforme: boolean | null;
  pieces: PieceAttributaire[];
}

/** `GET /api/candidat/offres/{idOffre}/resultat` — 404 avant l'information des candidats. */
export interface ResultatOffre {
  idOffre: string;
  numero: number | null;
  lot: number | null;
  retenu: boolean;
  motifRejet: string | null;
  attributaire: string | null;
  montant: number | null;
  montantTtc: number | null;
  delai: string | null;
  lettreDisponible: boolean;
  dateInformation: string | null;
  dateAffichage: string | null;
  finDelai: string | null;
  signableLe: string | null;
  dateSignature?: string | null;
  dateNotification?: string | null;
  notificationRecueLe?: string | null;
  marcheDisponible?: boolean;
  piecesAttributaire?: PiecesAttributaire | null;
  retire?: boolean;
}

/** `GET /api/procedures-en-ligne/{idDmc}/resultats` (public). */
export interface ResultatPublic {
  lot: number | null;
  attributaire: string | null;
  montant: number | null;
  dateInformation: string | null;
  dateAffichage: string | null;
  datePublicationAvis?: string | null;
  avisDisponible?: boolean;
}

/** `GET /api/fiches-marche/{idDmc}/attribution` — 404 tant que l'évaluation n'est pas ouverte. */
export interface Attribution {
  idDmc: number;
  lots: LotAttribution[];
}
