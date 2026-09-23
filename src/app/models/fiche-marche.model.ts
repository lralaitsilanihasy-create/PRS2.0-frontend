/**
 * Fiche DAO d'un appel d'offres (DAO) — CONTRAT PROPOSÉ au backend le 2026-09-22
 * (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`, lot 1 : quantité fixe, sans génération). ⚠️ Développé
 * contre ce contrat : tant que le serveur ne le sert pas, l'écran se replie sur la structure de l'esquisse
 * (`REFERENTIEL_ESQUISSE`) et le dit. Rien ici n'est confirmé par le backend.
 */

export type TypeMarche = 'QUANTITE_FIXE' | 'A_COMMANDE' | 'CONTRAT_CADRE';
export type DocumentDao = 'DPAO' | 'DPAC' | 'AE' | 'CCAP' | 'AUCUN';
export type SourceChamp = 'PPM' | 'SAISIE' | 'CADRAGE';
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
