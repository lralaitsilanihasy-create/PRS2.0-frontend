import { CategorieMarche } from './acte-gestion.model';

/**
 * ⚠️ Générateur de modèles de PV, lot G1 (demande `docs/demande-backend-2026-10-20-generateur-modeles-pv.md`, V138) — les
 * échanges de `/api/modeles-pv` (`ModelePvDto` du backend). Réservé à l'Administrateur. Rien n'est encore produit par ces
 * modèles : la production est le lot G2.
 */

/** ⚠️ 22/10 (M1 « modeles-documents-marche ») — `PROJET_MARCHE` : le projet de marché, un modèle par catégorie, en Word et en PDF. */
export type NatureModelePv = 'PV' | 'LETTRE_RENVOI' | 'PROJET_MARCHE' | 'DOCUMENT_DAO';
export type EtatModelePv = 'ACTIF' | 'ARCHIVE';
export type EtatVersionModelePv = 'BROUILLON' | 'EN_VIGUEUR' | 'REMPLACEE';
/** ⚠️ 22/10 (D-ARMP) — `INFO` : un point qui ne compte ni dans les bloquants ni dans les avertissements (écarts au document type). */
export type NiveauPointRapport = 'OK' | 'INFO' | 'AVERTISSEMENT' | 'BLOQUANT';
export type TypeChampSaisi = 'TEXTE' | 'TEXTE_LONG' | 'LISTE' | 'CASE' | 'DATE' | 'NOMBRE' | 'PIECE';
export type AvisApercu = 'FAV' | 'FAVR' | 'DEF' | 'NSP';
/** Portée du modèle de départ : un seul fichier, ou les deux variantes en blocs CENTRALE / REGIONALE (défaut). */
export type PorteeDepart = 'centrale' | 'regionale' | 'les-deux';

/** Le motif que le serveur pose sur une version de départ (`ModelePvDepart.MOTIF`) : la version vient de l'application. */
export const MOTIF_VERSION_DEPART = "Modèle de départ généré par l'application";

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
  /** ⚠️ 22/10 — les catégories servies par un modèle de projet de marché (vide sinon). */
  categories?: CategorieMarche[];
  /** ⚠️ 22/10 (D1-D3) — le sigle du document du DAO servi par un modèle `DOCUMENT_DAO` (un seul). */
  sigles?: string[];
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
  /** ⚠️ 21/10 (page) — les rangs du nœud depuis sa zone (`corps/1/1`), pour y amener le curseur. */
  chemin?: string | null;
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
  /** ⚠️ 21/10 (option C', V139) — `PAGE` : une page éditée dans l'application ; `WORD` : ancien dépôt, en consultation seulement. */
  support?: SupportVersion;
  /** Le document d'une page — servi par `GET …/versions/{n}` et les gestes qui la produisent ; nul dans la fiche. */
  document?: DocumentPage | null;
  /** ⚠️ 22/10 (D-ARMP) — le juriste qui a validé les écarts au document type, à la mise en vigueur. */
  juriste?: JuristeValidation | null;
}

/** ⚠️ 22/10 (D-ARMP) — la validation du juriste, saisie par l'Administrateur à la mise en vigueur d'une version qui s'écarte. */
export interface JuristeValidation {
  nom: string;
  qualite: string;
  /** `yyyy-MM-dd`. */
  date: string;
}

/** ⚠️ 22/10 (D-ARMP) — `GET …/versions/{n}/ecarts` : un écart avec le document type, ligne à ligne sur le fichier de commande. */
export interface EcartArmp {
  type: 'MODIFIE' | 'AJOUTE' | 'RETIRE';
  rang: number;
  avant: string | null;
  apres: string | null;
}

/** ⚠️ 22/10 (D0) — `GET /api/modeles-pv/integres/dao` : un document intégré du DAO (fichier de commande), par sigle. */
export interface DocumentDaoIntegre {
  sigle: string;
  libelle: string;
  typeDocument: 'DPAO' | 'DPAC' | 'DPIC' | 'AE' | 'CCAP' | 'AVIS' | 'LETTRE' | (string & {});
  categories: CategorieMarche[];
  couvertures: { typeMarche: string | null; categorie: string | null; mode: string | null }[];
  enService: boolean;
  modeleRattache: { id: number; code: string; numeroEnVigueur: number | null } | null;
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
  categories?: CategorieMarche[];
  sigles?: string[];
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
  /** ⚠️ 23/10 — `bloc` : le bloc de la fiche DAO d'une rubrique (posé par l'écran, `nommerRubriques`), pour ranger les rubriques. */
  groupes: { nom: string; bloc?: string | null; variables: VariableCatalogue[] }[];
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

// ——— ⚠️ 21/10 (demande « modele-pv-page », option C') — la page éditée dans l'application ———

export type SupportVersion = 'WORD' | 'PAGE';

/** Un nœud au format natif de Tiptap / ProseMirror, tel que le serveur le valide (schéma : `GET /api/modeles-pv/schema`). */
export interface NoeudPage {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoeudPage[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface ReglagesPage {
  format?: 'A4';
  orientation?: 'portrait' | 'paysage';
  /** Police et taille (points) par défaut. */
  police?: string;
  taille?: number;
  /** En millimètres, 0 à 60. */
  marges?: { haut?: number; bas?: number; gauche?: number; droite?: number };
}

/** L'enveloppe d'une version page : trois zones, chacune un `doc` Tiptap. */
export interface DocumentPage {
  page?: ReglagesPage;
  entete?: NoeudPage | null;
  enteteSurPremiereSeulement?: boolean | null;
  corps: NoeudPage;
  piedDePage?: NoeudPage | null;
}

/** `GET /api/modeles-pv/schema` — les nœuds, polices, couleurs et fonds admis. */
export interface SchemaModelePv {
  polices: string[];
  couleurs: Record<string, string>;
  fonds: Record<string, string>;
  formats: string[];
  limites: { tailleOctets: number; profondeur: number; noeuds: number; texte: number };
}

/** Une image de la bibliothèque des modèles (`POST /api/modeles-pv/images`, `GET …/images/embleme`). */
export interface ImageModelePv {
  idImage: number;
  largeur: number;
  hauteur: number;
  type: string;
  code: string | null;
}
