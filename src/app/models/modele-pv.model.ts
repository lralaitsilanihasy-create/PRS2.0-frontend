/**
 * ⚠️ Générateur de modèles de PV, lot G1 (demande `docs/demande-backend-2026-10-20-generateur-modeles-pv.md`, V138) — les
 * échanges de `/api/modeles-pv` (`ModelePvDto` du backend). Réservé à l'Administrateur. Rien n'est encore produit par ces
 * modèles : la production est le lot G2.
 */

export type NatureModelePv = 'PV' | 'LETTRE_RENVOI';
export type EtatModelePv = 'ACTIF' | 'ARCHIVE';
export type EtatVersionModelePv = 'BROUILLON' | 'EN_VIGUEUR' | 'REMPLACEE';
export type NiveauPointRapport = 'OK' | 'AVERTISSEMENT' | 'BLOQUANT';
export type TypeChampSaisi = 'TEXTE' | 'TEXTE_LONG' | 'LISTE' | 'CASE' | 'DATE' | 'NOMBRE' | 'PIECE';
export type AvisApercu = 'FAV' | 'FAVR' | 'DEF' | 'NSP';

export interface VersionCourteModelePv {
  numero: number;
  etat: EtatVersionModelePv;
  bloquant: boolean;
  deposeeLe: string | null;
  enVigueurLe: string | null;
}

/** Une ligne de `GET /api/modeles-pv`. */
export interface ModelePvResume {
  id: number;
  code: string;
  libelle: string;
  nature: NatureModelePv;
  etat: EtatModelePv;
  sousTypes: string[];
  enVigueur: VersionCourteModelePv | null;
  derniere: VersionCourteModelePv | null;
}

export interface SousTypeModelePv {
  id: string;
  libelle: string | null;
  famille: string | null;
}

/** Un point du rapport de contrôle ; `ou` situe le marqueur (paragraphe, cellule, en-tête), `suggestion` propose un code. */
export interface PointRapportModelePv {
  niveau: NiveauPointRapport;
  code: string;
  message: string;
  ou: string | null;
  suggestion: string | null;
}

export interface RapportModelePv {
  bloquant: boolean;
  nbBloquants: number;
  nbAvertissements: number;
  points: PointRapportModelePv[];
  variables: string[];
  conditionsUtilisees: string[];
  champsUtilises: string[];
  controleLe: string | null;
}

export interface ConditionModelePv {
  nom: string;
  expression: string;
  libelle: string | null;
}

export interface ChampModelePv {
  code: string;
  libelle: string;
  type: TypeChampSaisi;
  options: string[] | null;
  obligatoire: boolean | null;
  aide: string | null;
  /** Le nom d'une condition déclarée de la version ; nul : toujours visible. */
  visibleSi: string | null;
}

export interface VersionModelePv {
  numero: number;
  nomFichier: string;
  taille: number | null;
  empreinte: string | null;
  etat: EtatVersionModelePv;
  bloquant: boolean;
  rapport: RapportModelePv | null;
  motif: string | null;
  deposeeLe: string | null;
  deposeePar: string | null;
  enVigueurLe: string | null;
  enVigueurPar: string | null;
  remplaceeLe: string | null;
  conditions: ConditionModelePv[];
  champs: ChampModelePv[];
}

export interface EvenementModelePv {
  le: string;
  action: string;
  numeroVersion: number | null;
  detail: string | null;
  par: string | null;
}

/** `GET /api/modeles-pv/{id}` — versions de la plus récente à la plus ancienne. */
export interface ModelePvFiche {
  id: number;
  code: string;
  libelle: string;
  nature: NatureModelePv;
  etat: EtatModelePv;
  creeLe: string | null;
  creePar: string | null;
  archiveLe: string | null;
  motifArchivage: string | null;
  sousTypes: SousTypeModelePv[];
  versions: VersionModelePv[];
  historique: EvenementModelePv[];
}

export interface VariableCatalogue {
  code: string;
  libelle: string;
  exemple: string | null;
  /** La liste répétée qui porte la variable (`TITULAIRES`…) ; nul : variable simple. */
  liste: string | null;
}

/** `GET /api/modeles-pv/variables?sousType=` */
export interface CatalogueModelePv {
  sousType: string | null;
  famille: string | null;
  groupes: { nom: string; variables: VariableCatalogue[] }[];
  listes: { nom: string; prefixe: string; libelle: string }[];
  cles: { cle: string; libelle: string; valeurs: string[] | null }[];
  formats: string[];
  alias: Record<string, string>;
}

/**
 * ⚠️ 20/10 (demande « modeles-pv-integres », B1) — `GET /api/modeles-pv/integres` : les fichiers Word **intégrés** au backend, lus là
 * où le choix se fait (`PvDocumentGenerator.modeles()`, `LettreRenvoiDocumentGenerator.modeles()`). Seuls ceux présents dans le JAR.
 */
export interface ModeleIntegre {
  code: string;
  libelle: string;
  nature: NatureModelePv;
  /** Les sous-types servis ; `null` : tous. */
  sousTypes: string[] | null;
  fichiers: string[];
  regle: string;
  /** Vrai tant que la production ne passe pas par le générateur (G2). */
  enService: boolean;
}

export type ProducteurDocument = 'INTEGRE' | 'GERE' | 'AUCUN';

/**
 * ⚠️ 20/10 (B2) — `GET /api/modeles-pv/couverture` : une ligne par sous-type du référentiel et par nature, ce qui produit son
 * document. Avant G2, `produitPar` ne vaut jamais `GERE` : un modèle rattaché est servi à part (`modeleRattache`).
 */
export interface CouvertureSousType {
  sousType: string;
  libelle: string | null;
  famille: string | null;
  nature: NatureModelePv;
  produitPar: ProducteurDocument;
  /** Le `code` du modèle intégré qui produit, s'il y en a un. */
  integre: string | null;
  modeleRattache: { id: number; code: string; numeroEnVigueur: number | null } | null;
}
