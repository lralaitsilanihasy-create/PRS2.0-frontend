/**
 * Fiche DAO d'un appel d'offres (DAO) — CONTRAT PROPOSÉ au backend le 2026-09-22
 * (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`, lot 1 : quantité fixe, sans génération). ⚠️ Développé
 * contre ce contrat : tant que le serveur ne le sert pas, l'écran se replie sur la structure de l'esquisse
 * (`REFERENTIEL_ESQUISSE`) et le dit. Rien ici n'est confirmé par le backend.
 */

export type TypeMarche = 'QUANTITE_FIXE' | 'A_COMMANDE' | 'CONTRAT_CADRE';
/**
 * Les documents d'un dossier d'appel d'offres. Le **document de consultation** change avec la catégorie et la
 * forme : `DPAO` pour les fournitures et les travaux, `DPAC` pour un contrat-cadre, ⚠️ **`DPIC`** pour les
 * prestations intellectuelles (lot 6, 24/09) — données particulières des instructions aux consultants.
 */
export type DocumentDao = 'DPAO' | 'DPAC' | 'DPIC' | 'AE' | 'CCAP' | 'AUCUN';
export type SourceChamp = 'PPM' | 'SAISIE' | 'CADRAGE';
/**
 * ⚠️ Lot 5 (24/09) — la **catégorie** de dossier d'appel d'offres, second axe du référentiel. Elle se déduit de la
 * **nature** de la ligne du plan (`tr_nature.CATEGORIE_DAO`), jamais d'une réponse de cadrage.
 */
export type CategorieDao = 'FOURNITURES_SERVICES' | 'TRAVAUX' | 'PRESTATIONS_INTELLECTUELLES';

export type TypeChamp = 'TEXTE' | 'TEXTE_LONG' | 'NOMBRE' | 'MONTANT' | 'POURCENTAGE' | 'DATE' | 'LISTE' | 'OUI_NON' | 'PIECE';
export type StatutFiche = 'BROUILLON' | 'VALIDEE';

/** Rubrique d'un bloc (« Garantie de soumission » dans B05). `attendus` : compte d'informations de l'esquisse. */
export interface RubriqueFiche {
  code: string;
  libelle: string;
  rang: number;
  documentMaitre?: DocumentDao | null;
  /** Nombre d'informations attendues (esquisse) — sert tant que les champs ne sont pas chargés. Clé servie : `nbAttendu`. */
  nbAttendu?: number | null;
}

export interface BlocFiche {
  /** `B01` … `B10`. */
  code: string;
  libelle: string;
  rang: number;
  rubriques: RubriqueFiche[];
}

/** Une information du fichier de correspondance (esquisse, § « Structure d'une information »). */
export interface ChampFiche {
  /** `B05-GS-02` (bloc, rubrique, rang). */
  code: string;
  bloc: string;
  rubrique: string;
  rang: number;
  libelle: string;
  type: TypeChamp;
  source: SourceChamp;
  documentMaitre: DocumentDao;
  reprises: DocumentDao[];
  typesMarche: TypeMarche[];
  /** Expression sur le cadrage : `garantieSoumission = OUI`, `et`, `ou` ; `null` = toujours affiché. */
  condition?: string | null;
  obligatoire: boolean;
  texteType?: string | null;
  controle?: string | null;
  options?: string[] | null;
  aide?: string | null;
  /** Source `CADRAGE` : clé de la réponse de cadrage reflétée (`garantieSoumission`…) — livraison du 22/09. */
  cleCadrage?: string | null;
  /** Source `PPM` : clé interne de la ligne du plan relue (`ENTITE`, `MONTANT`…) — livraison du 22/09. */
  clePpm?: string | null;
  /**
   * ⚠️ V43 (25/09) — cette information **varie d'un lot à l'autre** : elle se saisit une fois par lot, et sa valeur
   * est enregistrée sous la clé `CODE#n` (n = rang du lot). Constaté sur un dossier réel : garantie de soumission,
   * montants minimum et maximum, délai de livraison sont donnés lot par lot.
   */
  parLot?: boolean | null;
  actif?: boolean;
}

/** `GET /api/champs-fiche-marche?typeMarche=` */
export interface ReferentielFiche {
  blocs: BlocFiche[];
  champs: ChampFiche[];
}

/** Réponses du cadrage (clés de la demande, valeurs en codes : `OUI` / `NON`, `UNITAIRES`…). */
export type Cadrage = Record<string, string | number | null>;

export interface ControleFiche {
  regle: string;
  champs: string[];
  bloc: string | null;
  message: string;
}

export interface BilanControles {
  bloquants: ControleFiche[];
  avertissements: ControleFiche[];
  ok: ControleFiche[];
  nbSaisis: number;
  nbAttendus: number;
}

/** `GET /api/fiches-marche/{idDmc}` — livraison backend du 22/09 : `idFiche` nul = fiche virtuelle (version 1, brouillon) avant le premier enregistrement. */
export interface FicheMarche {
  idFiche?: number | null;
  idDmc: number;
  idDetail: number;
  idDossier: number;
  refeDossier?: string | null;
  designationMarche?: string | null;
  /**
   * ⚠️ Lot 1c (23/09) — **déduit** de la forme du marché de la ligne du plan (`FORME_MARCHE`), relu à chaque lecture.
   * Il n'est plus une réponse de cadrage : la clé `typeMarche` a quitté `cadrage`.
   */
  typeMarche: TypeMarche | null;
  /** Lot 1c — la fiche a été saisie sous un type qui n'est plus celui du plan : à reprendre, pas à poursuivre. */
  typeChange?: boolean | null;
  /** ⚠️ Lot 5 — catégorie **déduite de la nature** de la ligne du plan ; `null` si la nature manque ou n'est pas classée. */
  categorie?: CategorieDao | null;
  /**
   * ⚠️ Lot 3 (demande du 23/09, §B2) — **le serveur dit** si ce type de marché est outillé, au lieu que le front
   * tienne sa propre liste. Absent tant que le contrat n'est pas servi : l'écran retombe alors sur `TYPES_OUTILLES`.
   * Même rôle que `LigneEligible.formeOutillee` sur la liste des lignes.
   */
  typeOutille?: boolean | null;
  statut: StatutFiche;
  version: number;
  cadrage: Cadrage;
  /** `{ code: valeur }` des champs saisis. */
  valeurs: Record<string, string | number | null>;
  /** Les 22 informations reprises de la ligne du PPM (clé = code du champ `PPM`), relues à chaque lecture. */
  valeursPpm: Record<string, string | number | null>;
  /**
   * ⚠️ V43 (25/09) — **le serveur dit si la ligne est allotie**, l'écran ne le déduit plus. `nbLots` = nombre de lots
   * de la ligne du plan (0 si aucun) ; `saisieParLot` vaut `nbLots > 1`. La réponse de cadrage `alloti` reste une
   * réponse de la PRMP — elle ouvre ses rubriques, elle ne décide pas des clés de valeur.
   */
  nbLots?: number | null;
  saisieParLot?: boolean | null;
  /** Version du PPM dont la ligne COURANTE est lue (filiation `idLigneOrigine`, demande B2 §1 du 22/09). */
  versionPpm?: number | null;
  /** `idDetail` de la ligne courante de la filiation (≠ `idDetail` lié quand le PPM a été versionné). */
  idDetailCourant?: number | null;
  /** La ligne est supprimée logiquement dans la version courante du PPM : avertir, ne pas bloquer (lot 1). */
  ligneSupprimee?: boolean | null;
  /** Montants en toutes lettres, servis par le serveur (`{ code: texte }`) — clé `enLettres` de la demande, B3. */
  enLettres?: Record<string, string> | null;
  /** Champs de source `CADRAGE`, dérivés des réponses par le serveur (`{ code: valeur }`), jamais reçus. */
  valeursCadrage?: Record<string, string | null> | null;
  bilanControles?: BilanControles | null;
  /**
   * ⚠️ Lot 1b (23/09) — le dossier **soumis à la CNM** produit par cette fiche, `null` tant qu'il n'existe pas.
   * À ne pas confondre avec `idDossier`, qui reste le dossier de **planification** de la ligne (contrat du 22/09).
   */
  idDossierSoumis?: number | null;
  dateCreation?: string | null;
  dateMaj?: string | null;
  dateValidation?: string | null;
  validePar?: string | null;
}

/** `GET /api/fiches-marche/{idDmc}/versions` — une version VALIDÉE, de quoi lister l'historique (le détail : `/versions/{n}`). */
export interface VersionFiche {
  idFiche: number | null;
  version: number;
  statut: StatutFiche;
  typeMarche: TypeMarche | null;
  dateCreation?: string | null;
  dateValidation?: string | null;
  validePar?: string | null;
  nbValeurs: number;
}

/** `GET /api/dmcs/eligibles` — lignes de PPM qui peuvent porter un DAO (H4). */
export interface LigneEligible {
  idDetail: number;
  idDossier: number;
  refeDossier: string | null;
  designationMarche: string;
  idMode: number | null;
  libelleMode: string | null;
  montEstim: number | null;
  dejaDao: boolean;
  idDmc?: number | null;
  /** ⚠️ Lot 1c — forme du marché portée par la ligne (`FORME_MARCHE`) : c'est elle qui donne le type de la fiche. */
  formeMarche?: TypeMarche | null;
  /** Lot 1c — cette forme est-elle prise en charge aujourd'hui ? Sinon la ligne se voit mais ne se prépare pas. */
  formeOutillee?: boolean | null;
  /** ⚠️ Lot 5 — catégorie de la ligne, déduite de sa nature ; `null` si la nature manque ou n'est pas classée. */
  categorie?: CategorieDao | null;
  /** Lot 5 — cette catégorie est-elle outillée ? Jumelle de `formeOutillee`, sur l'autre axe. */
  categorieOutillee?: boolean | null;
}

/** `DmcDto` (existant, lot 3a) — un DMC par ligne de marché. */
export interface Dmc {
  idDmc: number;
  idDetail: number;
  idTypeDmc: number;
  typeDmcCode?: string | null;
  typeDmcLibelle?: string | null;
  reference?: string | null;
  statut: 'A_PREPARER' | 'ENGAGE';
  dateCreation?: string | null;
  valeursPpm?: Record<string, string | number | null> | null;
  /** Lot 1b — dossier soumis produit par la fiche de ce DMC (`null` tant qu'il n'existe pas). */
  idDossierSoumis?: number | null;
}

/**
 * ⚠️ Lot 1b (23/09) — résumé de la fiche DAO **porté par le dossier** (`DossierDto.ficheMarche`), pour que sa page
 * l'affiche sans second appel. Servi sur la **lecture unitaire** seulement : les listes ne portent que `idDmc`.
 */
export interface FicheMarcheResume {
  idDmc: number;
  idDetail: number;
  refeDossierPpm?: string | null;
  designationMarche?: string | null;
  typeMarche: TypeMarche | null;
  statut: StatutFiche;
  version: number;
  nbSaisis?: number | null;
  nbAttendus?: number | null;
}

/** `GET /api/fiches-marche/rattachables` — fiches validées et non encore liées du périmètre (PRMP et UGPM). */
export interface FicheRattachable {
  idDmc: number;
  idDetail: number;
  refeDossierPpm?: string | null;
  designationMarche?: string | null;
  version: number;
  dateValidation?: string | null;
}

/**
 * ⚠️ Lot 2 (demande du 23/09) — document produit par la **validation** d'une version de la fiche
 * (`GET /api/fiches-marche/{idDmc}/documents`). Tant que le contrat n'est pas servi, l'écran replie l'étape 7.
 * Le **nom de fichier vient du serveur** : le front n'a pas les règles de nommage de la CNM.
 */
export interface DocumentFiche {
  idDocument: number;
  /**
   * ⚠️ V43 (25/09) — le lot auquel ce document se rapporte, `null` pour un document commun. Sur une ligne allotie
   * l'acte d'engagement est produit **une fois par lot**, comme dans un dossier réel.
   */
  lot?: number | null;
  /** Document maître, mêmes codes que `ChampFiche.documentMaitre` : `DPAO` · `DPAC` · `AE` · `CCAP`. */
  type: DocumentDao;
  libelle?: string | null;
  extension?: string | null;
  nomFichier: string;
  tailleOctets?: number | null;
  dateGeneration?: string | null;
  /** Version de la fiche qui a produit ce document. */
  version?: number | null;
}

/** Erreur nominative par champ d'un `PUT …/blocs/{bloc}` (400). */
export interface ErreurChamp {
  champ: string;
  message: string;
}
