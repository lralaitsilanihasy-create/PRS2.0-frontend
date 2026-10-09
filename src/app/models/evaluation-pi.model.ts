import { Correction, RefusCandidat } from './evaluation.model';

/**
 * ⚠️ Lot 3 PI — l'évaluation des propositions de prestations intellectuelles. Tranche PI-c (V87, 08/10) : la **notation technique**
 * (`/api/fiches-marche/{idDmc}/evaluation/technique`). Chaque membre déclaré sans conflit note, motive ; la moyenne de chaque élément
 * fait la note ; un écart de plus de 20 % du maximum entre la note haute et la basse est signalé ; le président arrête lot par lot, et
 * les propositions sous le score minimum (`B06-TP-07`) sont éliminées.
 */

/** Un élément de la grille : un sous-critère de la fiche (`B06-TP-03#2`) ou un critère noté globalement (`B06-TP-02`). */
export interface ElementTechnique {
  code: string;
  /** Le critère (`B06-TP-03`). */
  critere: string;
  libelleCritere: string | null;
  libelle: string | null;
  max: number;
}

export interface NoteTechnique {
  element: string;
  note: number;
  motif: string | null;
  le: string | null;
}

/** La grille d'un membre pour une proposition. */
export interface GrilleMembre {
  im: string;
  nom: string | null;
  notes: NoteTechnique[];
}

export interface MoyenneTechnique {
  element: string;
  moyenne: number | null;
  min: number | null;
  max: number | null;
  nombreNotes: number;
  /** La note la plus haute et la plus basse s'écartent de plus du seuil (en % du maximum) : alerte, la moyenne reste retenue. */
  ecart: boolean;
}

export type StatutTechnique = 'EN_COURS' | 'QUALIFIEE' | 'ELIMINEE';

export interface PropositionTechnique {
  idOffre: string;
  numero: number | null;
  nif: string | null;
  raisonSociale: string | null;
  grilles: GrilleMembre[];
  moyennes: MoyenneTechnique[];
  /** La note technique : la somme des moyennes. */
  total: number | null;
  /** Chaque membre décideur a noté chaque élément. */
  complete: boolean;
  statut: StatutTechnique;
  motifElimination: string | null;
  /** Le rang parmi les non éliminées, par note décroissante (égalité : même rang). */
  rang: number | null;
}

export interface ArretTechnique {
  le: string;
  par: string;
  nom: string | null;
  observation: string | null;
  rouverteLe: string | null;
  motifReouverture: string | null;
}

export interface LotTechnique {
  lot: number;
  /** L'examen préliminaire est arrêté : la notation est ouverte. */
  conformiteArretee: boolean;
  /** Nul tant que le président n'a pas arrêté l'étape technique. */
  arret: ArretTechnique | null;
  offres: PropositionTechnique[];
}

/** `GET …/evaluation/technique` — 404 tant que l'évaluation n'est pas ouverte ; 409 `CATEGORIE_SANS_NOTATION_TECHNIQUE` hors PI. */
export interface Technique {
  idDmc: number;
  /** `B06-TP-07`. */
  scoreMinimum: number | null;
  /** Le seuil d'écart, en % du maximum de l'élément (paramètre `EVALUATION_ECART_NOTES_POURCENT`, 20 par défaut). */
  seuilEcartPourcent: number | null;
  elements: ElementTechnique[];
  lots: LotTechnique[];
}

/** Corps de `PUT …/technique/offres/{idOffre}/notes` : la grille du membre appelant (une ou plusieurs notes, chacune motivée). */
export interface NotesTechniquesCorps {
  notes: { element: string; note: number; motif: string }[];
}

// ── Tranche PI-d1 (V88) : la seconde séance d'ouverture, celle des enveloppes financières ──

export type EtatSeanceFinanciere = 'OUVERTE' | 'DECHIFFREE' | 'CLOSE';

/** Une enveloppe financière à ouvrir : sa proposition, sa note et son rang techniques ; après le déchiffrement, l'acte lu. */
export interface EnveloppeFinanciere {
  idOffre: string;
  numero: number | null;
  raisonSociale: string | null;
  lot: number | null;
  noteTechnique: number | null;
  rangTechnique: number | null;
  partsRecues: number;
  integrite: string | null;
  /** L'acte d'engagement lu (montants HT, TTC…), nul avant le déchiffrement. */
  acteEngagement: Record<string, unknown> | null;
}

/** Une enveloppe financière qui ne s'ouvre pas : éliminée techniquement, ou hors du premier rang selon la méthode. */
export interface EnveloppeNonOuverte {
  numero: number | null;
  raisonSociale: string | null;
  lot: number | null;
  motif: string;
}

/** Une ronde : 1 = la seconde séance ; 2… = les séances complémentaires (négociation échouée, PI-d2a). */
export interface RondeSeanceFinanciere {
  ronde: number;
  etat: EtatSeanceFinanciere;
  motif: string | null;
  ouverteLe: string | null;
  closeLe: string | null;
  pvDisponible: boolean;
}

/** `GET …/seance/financiere` — 404 tant qu'elle n'est pas ouverte. */
export interface SeanceFinanciere {
  idDmc: number;
  etat: EtatSeanceFinanciere;
  /** La méthode de sélection (`B02-MS-01`) : elle décide quelles enveloppes s'ouvrent. */
  methode: string | null;
  quorum: number | null;
  aOuvrir: EnveloppeFinanciere[];
  nonOuvertes: EnveloppeNonOuverte[];
  presents: string[];
  autres: { nom: string; qualite: string | null }[];
  secoursEmploye: boolean;
  ouverteLe: string | null;
  dechiffreeLe: string | null;
  closeLe: string | null;
  pvDisponible: boolean;
  ronde: number | null;
  motif: string | null;
  rondes: RondeSeanceFinanciere[];
}

// ── Tranche PI-d2a (V89) : évaluation financière, classement selon la méthode, négociation ──

/** La méthode de sélection (`B02-MS-01`), codée par le serveur. */
export type CodeMethodePi = 'QUALITE_COUT' | 'BUDGET' | 'MOINDRE_COUT' | 'QUALITE_TECHNIQUE' | 'QUALIFICATION';

export type StatutFinancier = 'NON_OUVERTE' | 'A_EVALUER' | 'EVALUEE' | 'ECARTEE' | 'HORS_BUDGET';

/** La saisie de la commission sur une enveloppe financière : prix lu, corrections retenues, dépenses remboursables, refus éventuel. */
export interface SaisieFinanciere {
  prixLu: number | null;
  prixLuTtc: number | null;
  corrections: Correction[];
  refus: RefusCandidat | null;
  prixCorrige: number | null;
  remboursables: number | null;
  motifRemboursables: string | null;
  par: string | null;
  nom: string | null;
  le: string | null;
}

/** Une proposition qualifiée, dans le classement financier de son lot. */
export interface PropositionFinanciere {
  /** L'enveloppe technique (l'identifiant de la proposition). */
  idOffre: string;
  /** L'enveloppe financière : c'est elle qui se saisit. */
  idFinanciere: string | null;
  numero: number | null;
  nif: string | null;
  raisonSociale: string | null;
  noteTechnique: number | null;
  rangTechnique: number | null;
  financiereOuverte: boolean;
  saisie: SaisieFinanciere | null;
  statut: StatutFinancier;
  motif: string | null;
  /** Prix corrigé − dépenses remboursables : le montant comparé. */
  montantCompare: number | null;
  scoreFinancier: number | null;
  scoreCombine: number | null;
  rang: number | null;
  /** Même rang qu'une autre : le départage motivé est exigé à l'arrêt. */
  egalite: boolean;
}

export interface ArretFinancier {
  le: string;
  par: string;
  nom: string | null;
  observation: string | null;
  rouvertLe: string | null;
  motifReouverture: string | null;
}

export interface DepartageFinancier {
  ordre: string[];
  motif: string;
  par: string;
  nom: string | null;
  le: string;
}

export interface LotFinancier {
  lot: number;
  arret: ArretFinancier | null;
  departage: DepartageFinancier | null;
  propositions: PropositionFinanciere[];
}

/** `GET …/evaluation/financiere` — 404 (évaluation non ouverte), 409 hors PI. */
export interface Financiere {
  idDmc: number;
  methode: string | null;
  codeMethode: CodeMethodePi | null;
  poidsTechnique: number | null;
  poidsFinancier: number | null;
  budget: number | null;
  lots: LotFinancier[];
}

/** Corps de `PUT …/evaluation/financiere/offres/{idFinanciere}`. */
export interface SaisieFinanciereCorps {
  prixLu?: number | null;
  corrections: Correction[];
  remboursables: number;
  motifRemboursables?: string | null;
  refusCandidat?: RefusCandidat | null;
}

export type EtatNegociation = 'EN_COURS' | 'REUSSIE' | 'ECHOUEE';

export interface Negociation {
  id: number;
  idOffre: string;
  idFinanciere: string | null;
  numero: number | null;
  raisonSociale: string | null;
  rang: number | null;
  etat: EtatNegociation;
  ouverteLe: string | null;
  ouvertePar: string | null;
  prevueLe: string | null;
  lieu: string | null;
  conclueLe: string | null;
  concluePar: string | null;
  dateNegociation: string | null;
  texte: string | null;
  motifEchec: string | null;
  pieceNom: string | null;
  pvDisponible: boolean;
}

export interface LotNegociation {
  lot: number;
  classementArrete: boolean;
  /** Le classé suivant sans échec ; nul s'il y a une négociation en cours ou réussie. */
  prochain: { idOffre: string; numero: number | null; raisonSociale: string | null; rang: number | null; financiereOuverte: boolean } | null;
  conclue: boolean;
  negociations: Negociation[];
}

/** `GET …/evaluation/negociation`. */
export interface Negociations {
  idDmc: number;
  lots: LotNegociation[];
}

/** Corps de `POST …/negociation/{id}/conclure`. */
export interface ConclusionNegociation {
  resultat: 'REUSSIE' | 'ECHOUEE';
  /** `AAAA-MM-JJ`. */
  dateNegociation: string;
  lieu?: string | null;
  texte: string;
  motif?: string | null;
}
