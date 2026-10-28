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
/**
 * ⚠️ V46 (25/09) — les **pièces produites** par la fiche. Les documents maîtres (`DocumentDao`) en sont, mais
 * s'y ajoutent les pièces dérivées du **besoin** et les **formulaires du candidat**, qui ne sont le document
 * maître d'aucun champ : `LF` liste des fournitures et calendrier, `BP` bordereau des prix (classeur),
 * `TC` tableau de conformité (classeur), `A1`–`A4` fiches exigées du candidat, `C1`/`C2` modèles de garantie.
 *
 * ⚠️ `A1`–`A4` et `C1`/`C2` **ne sont pas encore produits** : le backend attend les modèles officiels. Les
 * nommer ici ne les promet pas — c'est l'écran qui saura les lire le jour où le serveur les servira.
 */
/** ⚠️ 30/09 — `AVIS` : l'avis spécifique d'appel d'offres, produit À LA DEMANDE après le PV (jamais à la validation). */
/** ⚠️ V73 (06/10) — `DAO_COMPLET` : le dossier d'appel d'offres en un seul document (Word et PDF), qui remplace les pièces séparées. */
export type PieceProduite = DocumentDao | 'DAO_COMPLET' | 'LF' | 'BP' | 'TC' | 'A1' | 'A2' | 'A3' | 'A4' | 'C1' | 'C2' | 'AVIS' | 'LETTRE_INVITATION'
  // ⚠️ Q11 (V117, 14/10) — produits à la validation, un PDF par lot, jamais publiés ni servis aux candidats.
  | 'BORDEREAU_ESTIMATIF' | 'DQE_ESTIMATIF'
  // ⚠️ 17/10 (V129) — travaux : le devis descriptif et les plans (PDF déposé sur la fiche), annexé au DAO, remis au retrait.
  | 'DESCRIPTIF_PLANS';
export type SourceChamp = 'PPM' | 'SAISIE' | 'CADRAGE';
/**
 * ⚠️ Lot 5 (24/09) — la **catégorie** de dossier d'appel d'offres, second axe du référentiel. Elle se déduit de la
 * **nature** de la ligne du plan (`tr_nature.CATEGORIE_DAO`), jamais d'une réponse de cadrage.
 */
export type CategorieDao = 'FOURNITURES_SERVICES' | 'TRAVAUX' | 'PRESTATIONS_INTELLECTUELLES';

export type TypeChamp =
  | 'TEXTE'
  | 'TEXTE_LONG'
  | 'NOMBRE'
  | 'MONTANT'
  | 'POURCENTAGE'
  | 'DATE'
  | 'LISTE'
  /**
   * ⚠️ 25/09 — plusieurs options d'un coup (`B04-CD-01` : les fiches A1 à A4 jointes au dossier). La valeur est
   * la liste des options retenues **séparées par des virgules**, dans l'ordre du référentiel : `'A1,A3'`.
   */
  | 'LISTE_MULTIPLE'
  | 'OUI_NON'
  | 'PIECE'
  /**
   * ⚠️ Remise électronique (27/09, demande du 27/09 §B1.2) — deux types nouveaux, servis par V50. `DATE_HEURE` :
   * valeur ISO locale `AAAA-MM-JJTHH:MM` (celle d'un `input type="datetime-local"`), imprimée « JJ/MM/AAAA HH:MM ».
   * `URL` : adresse absolue http ou https, imprimée telle quelle. Les heures existantes (`B04-LR-04`, `B04-OP-03`)
   * restent du texte : c'est une règle du bilan qui les exige au format HH:MM en mode électronique, pas un type.
   */
  | 'DATE_HEURE'
  | 'URL';
export type StatutFiche = 'BROUILLON' | 'VALIDEE';

/**
 * ⚠️ Remise électronique (27/09) — l'état de l'écran séparé des **paramètres internes** de la procédure (membres
 * détenteurs d'une part de clé, quorum, cérémonie), tel que la fiche le dit à tous ceux qui la lisent. Les valeurs,
 * elles, ne sont servies qu'au responsable de la procédure (`GET …/parametres-internes`, 403 pour les autres).
 * `ABSENTS` : rien n'a encore été saisi.
 */
export type EtatParametresInternes = 'COMPLETS' | 'INCOMPLETS' | 'ABSENTS';

/** Le titulaire du rôle « Responsable de la procédure » d'une fiche (désignation nominative, un seul actif). */
export interface ResponsableProcedure {
  im: string;
  nom: string;
}

/** Un compte désignable : membre détenteur d'une part de clé, ou responsable de la procédure. */
export interface CompteDesignable {
  im: string;
  nom: string;
  profil?: string | null;
}

/** Une écriture du journal dédié des paramètres internes (servi au seul titulaire ; ancienne → nouvelle valeur). */
export interface EntreeJournalParametres {
  date: string;
  acteur: string;
  nomActeur?: string | null;
  champ: string;
  ancienneValeur?: string | null;
  nouvelleValeur?: string | null;
}

/**
 * ⚠️ Remise électronique (27/09, demande §B4) — `GET /api/fiches-marche/{idDmc}/parametres-internes`, réservé au
 * responsable de la procédure (403 aux autres, Administrateur compris). Ces valeurs vivent hors de la fiche et hors
 * du moteur de rendu : aucun jeton ne les atteint. `nombreParts` (INT-SE-02) est calculé du nombre de membres ;
 * `responsable` (INT-SE-05) est le titulaire du rôle, posé par le serveur.
 */
export interface ParametresInternes {
  idDmc: number;
  /**
   * ⚠️ Lot 2a (04/10, V67, Q11) — **dérivés de la commission d'appel d'offres** désignée par la PRMP : les membres de qualité
   * `MEMBRE`, `im` = identifiant `K…`, `profil` = `MEMBRE_CAO`. Le responsable ne les choisit plus, il les lit.
   */
  membresCommission: CompteDesignable[];
  nombreParts: number;
  quorum: number | null;
  dateCeremonie: string | null;
  responsable: ResponsableProcedure | null;
  etat: EtatParametresInternes;
  anomalies: { regle: string; message: string }[];
  /** ⚠️ Lot 2b (V66) — `SE_QUORUM_MARGE` (S1) : un avertissement, jamais un refus. */
  avertissements?: { regle: string; message: string }[] | null;
  /** ⚠️ Lot 2b (V66) — la part de secours (S3), hors `nombreParts`. */
  partDeSecours?: PartDeSecours | null;
  /** ⚠️ R1 (V101) — la surcharge du quorum de la CAO de cette procédure (nul : la règle globale s'applique). */
  caoQuorum?: string | null;
  /** ⚠️ R1 (V101) — la règle effectivement appliquée (surcharge, sinon la règle globale). */
  caoQuorumEffectif?: string | null;
  /** ⚠️ R10 (V113) — la signature de l'offre (valeur effective) : `SCELLE_PLUS_ORIGINAL` (défaut) ; `CERTIFIEE` réservé, sans effet. */
  signatureOffre?: SignatureOffre | null;
  journal: EntreeJournalParametres[];
}

/** ⚠️ R10 (V113) — dépôt scellé puis original signé de l'acte d'engagement ; ou signature certifiée (réservée, pas encore branchée). */
export type SignatureOffre = 'SCELLE_PLUS_ORIGINAL' | 'CERTIFIEE';

/**
 * Le dépositaire de la part de secours (ADR-0013, S3). ⚠️ V71 (05/10) : il a un **compte externe** (`D…`) et génère lui-même
 * sa clé ; `email` est obligatoire à l'écriture (400 sous `depositaire.email`), `compte` est servi, ignoré en écriture, et
 * `null` pour un dépositaire désigné avant V71 sans adresse.
 */
export interface Depositaire {
  nom: string;
  organisme?: string | null;
  fonction?: string | null;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  compte?: { idCompte: string; etat: 'A_INVITER' | 'INVITE' | 'ACTIF' | 'ARCHIVE' } | null;
}

export type EtatPartDeSecours = 'A_DESIGNER' | 'DESIGNE' | 'PUBLIEE' | 'VERIFIEE' | 'PERDUE';

export interface PartDeSecours {
  depositaire: Depositaire | null;
  etat: EtatPartDeSecours;
}

/**
 * Corps du `PUT …/parametres-internes` : quorum, date de la cérémonie, dépositaire. ⚠️ Lot 2a : `membresCommission` n'en
 * fait plus partie (400 s'il est envoyé) — les membres viennent de la CAO.
 */
export interface ParametresInternesCorps {
  quorum: number | null;
  dateCeremonie: string | null;
  depositaire: Depositaire | null;
  /** ⚠️ R1 (V101) — la surcharge du quorum de la CAO pour cette procédure (`MAJORITE`, `TOUS`, `"n"`) ; nul ou absent : la règle globale. */
  caoQuorum?: string | null;
  /** ⚠️ R10 (V113) — **toujours envoyé** : son absence remet la valeur par défaut. 400 `SIGNATURE_OFFRE_INVALIDE`. */
  signatureOffre?: SignatureOffre | null;
}

/** ⚠️ Lot 2a (V67) — l'état de la commission d'appel d'offres, tel que la fiche le dit à qui la lit. */
export type EtatCao = 'ABSENTE' | 'INCOMPLETE' | 'COMPLETE';

/** ⚠️ Lot 2b (V66) — l'état de la cérémonie des clés : `A_VENIR` (des clés manquent), `CLOSE`, `A_REFAIRE` (rouverte). */
export type EtatCeremonie = 'A_VENIR' | 'CLOSE' | 'A_REFAIRE';

/**
 * ⚠️ 06/10 — `GET /api/fiches-marche/en-ligne` (`demande-backend-2026-10-06-liste-procedures-en-ligne`) : une procédure en remise
 * électronique, pour son **responsable** (titulaire, ou par intérim : il voit, il n'agit pas) et pour l'**Administrateur** (toutes).
 */
/** ⚠️ V73 (06/10) — le Word des spécifications techniques joint à la version de la fiche, inséré dans le DAO complet. */
export interface SpecificationsTechniques {
  nomFichier: string;
  taille: number | null;
  deposeLe: string | null;
  deposePar: string | null;
}

export interface ProcedureInterne {
  idDmc: number;
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  categorie: CategorieDao | null;
  statutFiche: 'BROUILLON' | 'VALIDEE' | 'REVISION';
  responsable: { im: string; nom: string } | null;
  /** Vue par l'intérimaire du titulaire : il ne peut pas encore conduire la procédure (paramètres, cérémonie, séance). */
  parInterim: boolean;
  etatCao: EtatCao | null;
  etatCeremonie: EtatCeremonie | null;
  datePublication: string | null;
  dateOuvertureDepots: string | null;
  dateLimite: string | null;
  dateOuverturePlis: string | null;
  etat: 'NON_LANCEE' | 'A_VENIR' | 'OUVERTE' | 'CLOSE';
  etatSeance: string | null;
  nbOffres: number;
  /** Sans responsable, cérémonie non close, ou séance en cours ou du jour. */
  aTraiter: boolean;
}

/** Rubrique d'un bloc (« Garantie de soumission » dans B05). `attendus` : compte d'informations de l'esquisse. */
export interface RubriqueFiche {
  code: string;
  libelle: string;
  rang: number;
  documentMaitre?: DocumentDao | null;
  /** Nombre d'informations attendues (esquisse) — sert tant que les champs ne sont pas chargés. Clé servie : `nbAttendu`. */
  nbAttendu?: number | null;
}

/**
 * ⚠️ 25/09 — un bloc peut DÉCLARER son rendu au lieu de laisser l'écran deviner : `null` (ou absent) = la liste
 * de ses champs, `'BESOIN'` = la grille du besoin (lots → articles → caractéristiques). Un rendu inconnu du front
 * n'est pas une erreur : le bloc annonce qu'il n'a rien à saisir plutôt que de rester blanc.
 */
export type RenduBloc = 'BESOIN' | 'MOYENS' | 'PIECES' | (string & {});

/**
 * ⚠️ Lot 4 du chantier b — livré le 03/10 (V61, `demande-backend-2026-10-03-pieces-offre-travaux`) : les pièces de
 * l'offre exigées des travaux, en liste (bloc `B14`, rendu `'PIECES'`). Hors travaux : 409 `PIECES_HORS_PERIMETRE`.
 * `ADMINISTRATIVE` = 2° de la clause 6.2 du DPAO ; `OFFRE` = 1° (« en sus de ceux mentionnés aux IC »).
 */
export type RubriquePiece = 'ADMINISTRATIVE' | 'OFFRE';

export interface PieceExigee {
  idPiece?: number | null;
  ordre?: number | null;
  rubrique: RubriquePiece;
  /** « 01 », « 8-a » : le numéro que le DAO donne à la pièce. */
  numero?: string | null;
  libelle: string;
  /** « copie légalisée par le centre fiscal », « original »… */
  forme?: string | null;
  /** « datée de moins de 3 mois ». */
  ancienneteMaxMois?: number | null;
  parLot?: boolean | null;
  /** « annexe 5, planning 8-a ». */
  modele?: string | null;
}

/**
 * ⚠️ Lot 3 du chantier b — livré le 03/10 (V60, `demande-backend-2026-10-03-materiel-personnel-travaux`) : le matériel
 * et le personnel exigés des travaux, en listes (bloc `B13`, rendu `'MOYENS'`). Hors travaux : 409 `MOYENS_HORS_PERIMETRE`.
 */
export interface MaterielExige {
  idMateriel?: number | null;
  ordre?: number | null;
  designation: string;
  /** « ≥ 10 000 kg » : capacité, puissance… */
  caracteristique?: string | null;
  nombre: number | null;
  /** `null` = propriété ou location indifférente ; `= nombre` = tout en propre. */
  minimumEnPropre?: number | null;
  /** Le nombre vaut pour chaque lot. */
  parLot?: boolean | null;
}

export interface PersonnelExige {
  idPersonnel?: number | null;
  ordre?: number | null;
  poste: string;
  nombre: number | null;
  diplome?: string | null;
  experienceAnnees?: number | null;
  /** « travaux routiers ». */
  domaineExperience?: string | null;
  justificatifs?: string | null;
  parLot?: boolean | null;
}

export interface BlocFiche {
  /** `B01` … `B10`. */
  code: string;
  libelle: string;
  rang: number;
  rubriques: RubriqueFiche[];
  rendu?: RenduBloc | null;
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
  /**
   * ⚠️ V47 (R6), porté par l'écran admin depuis le 27/09 — valeur **recopiée dans la fiche à sa création** par le
   * serveur (jamais pré-remplie par l'écran) ; refusée hors source `SAISIE`. Une constante : « 50 », « PDF,PDF/A »,
   * « OUI ». Les défauts calculés (une date déduite d'une autre) ne passent pas par ici : le serveur les pose à
   * l'enregistrement du bloc (`champsCalcules`).
   */
  valeurDefaut?: string | null;
  /**
   * ⚠️ Demandé le 02/10 (`demande-backend-2026-10-02-gabarits-champs.md`), pas encore servi — les phrases des modèles
   * qui impriment ce champ : la PRMP voit où sa saisie s'insère (fiche 40 : « au delà de Au-delà de 20 %… »).
   * Absent tant que le serveur ne le sert pas : rien ne s'affiche.
   */
  gabarits?: GabaritChamp[] | null;
}

/** Un paragraphe de modèle qui cite le champ : le texte avant et après son jeton (les autres jetons valent `___`). */
export interface GabaritChamp {
  /** Pièce, en code court : `DPAO`, `AE`, `CCAP`, `AVIS`… */
  document: string;
  avant: string;
  apres: string;
  /** Suffixe du jeton (`lettres`, `parLot`…) ; `null` = la valeur telle que saisie. */
  suffixe: string | null;
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
/** Le mode de remise des offres (cadrage `modeRemise`, H3) : papier ou électronique, jamais les deux. */
export type ModeRemise = 'PAPIER' | 'ELECTRONIQUE';

/**
 * ⚠️ 28/10 (demande « dao-complet-en-file », V144) — le DAO complet de la dernière version validée, assemblé par Word dans une file
 * à un seul ouvrier, après la validation. `rang` : 1 = le prochain, nul hors `EN_FILE` ; `depuis` : entrée dans l'état courant
 * (nul en `SANS_WORD`) ; `motif` : le dernier échec, en `ECHEC` et en `EN_FILE` quand la version attend un nouvel essai.
 */
export type EtatDaoComplet = 'EN_FILE' | 'EN_COURS' | 'PRET' | 'ECHEC' | 'SANS_WORD';
export interface DaoCompletFile {
  etat: EtatDaoComplet;
  rang: number | null;
  depuis: string | null;
  motif: string | null;
}

export interface FicheMarche {
  idFiche?: number | null;
  /** ⚠️ 28/10 (V144) — servi sur la lecture de la fiche et la réponse de la validation ; nul sans version validée. */
  daoComplet?: DaoCompletFile | null;
  /** ⚠️ Q11 (V116) — l'estimation de chaque lot face au plan ; `null` hors du besoin (prestations intellectuelles). */
  estimations?: EstimationLot[] | null;
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
  /**
   * ⚠️ R8 (V110, 13/10 ; arbitrage Q1) — le mode de remise est **figé** dès qu'une version validée existe : `modeRemiseFige` est le mode à
   * garder (`PUT …/cadrage` avec un autre mode, ou sans la clé qui vaut papier → 409 `MODE_FIGE`). Seule exception : la migration
   * documentée par l'Administrateur, portée par la version qui l'a reçue (`modeMigre*`).
   */
  modeFige?: boolean;
  modeRemiseFige?: ModeRemise | null;
  modeMigreLe?: string | null;
  modeMigrePar?: string | null;
  modeMigreMotif?: string | null;
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
  /**
   * ⚠️ Remise électronique (27/09, demande §B5.1) — **le serveur dit** qui est responsable de la procédure et ce que
   * le lecteur connecté peut faire, au lieu que l'écran le déduise d'un rôle : le rôle est nominatif, par fiche, et
   * n'est pas un rôle de session. Absents tant que le contrat n'est pas servi.
   */
  responsableProcedure?: ResponsableProcedure | null;
  /** Vrai pour le seul titulaire connecté : l'écran des paramètres internes lui est ouvert, 403 aux autres. */
  peutModifierParametresInternes?: boolean | null;
  parametresInternes?: EtatParametresInternes | null;
  /** ⚠️ Lot 2a (V67) — l'état de la CAO ; `null` en mode papier. */
  cao?: EtatCao | null;
  /** ⚠️ Lot 2b (V66) — l'état de la cérémonie des clés ; `null` en mode papier. */
  ceremonie?: EtatCeremonie | null;
  /** ⚠️ Lot 3 (V68) — les dépôts : le nombre, et s'ils sont clos (date limite passée) ; `null` en mode papier. */
  depots?: { nombre: number; clos: boolean } | null;
  /**
   * Clés (`CODE` ou `CODE#n`) dont la valeur a été **posée par le serveur** à l'enregistrement du bloc — en mode
   * électronique : ouverture des plis (date limite + délai), dates déduites (publication, assistance, dépôt de
   * l'original). L'écran les montre en lecture seule, avec la mention « calculée » ; il ne calcule rien lui-même.
   */
  champsCalcules?: string[] | null;
}


/**
 * ⚠️ Le besoin (bloc `B12`, 25/09) — une **exigence technique** d'un article : « Mémoire vive » / « 8 Go au
 * minimum ». Elle alimente le tableau de conformité que le candidat remplit, ligne par ligne.
 */
export interface CaracteristiqueFiche {
  idCaracteristique?: number | null;
  /** Rang d'affichage ; **posé par le serveur** à partir de la position envoyée. */
  ordre?: number | null;
  libelle: string;
  exigence: string;
}

/**
 * ⚠️ Le besoin (bloc `B12`, 25/09) — un **article** d'un lot : ce que l'acheteur veut acheter, en quelles
 * quantités, et à quelles conditions techniques. N'est **pas** un champ de la fiche : une ressource à part
 * (`GET|PUT /api/fiches-marche/{idDmc}/articles`), parce qu'une clé ne peut pas porter un tableau.
 *
 * - **à commande** : `quantiteMin` et `quantiteMax` ; `quantite` est ignorée ;
 * - **quantité fixe** et **contrat-cadre** : `quantite` seule.
 *
 * `redigePar` / `profilRedacteur` sont une **trace** de qui a enregistré, posée par le serveur : ils ne
 * commandent aucun droit (arbitrage du 25/09 — le besoin suit les droits de la fiche).
 */
export interface ArticleFiche {
  idArticle?: number | null;
  /** Rang du lot au plan ; `null` sur une ligne non allotie. */
  lot?: number | null;
  ordre?: number | null;
  designation: string;
  unite: string;
  quantiteMin?: number | null;
  quantiteMax?: number | null;
  quantite?: number | null;
  caracteristiques: CaracteristiqueFiche[];
  redigePar?: string | null;
  profilRedacteur?: string | null;
  /**
   * ⚠️ **DQE des travaux** — livré le 02/10 (V59, `demande-backend-2026-10-02-dqe-et-seuils-travaux` §B1.2), noms
   * de la demande. Hors travaux, servis vides (`null`, `false`) et ignorés à l'écriture.
   */
  /** N° de prix au bordereau (« 529 », « 2.4 ») — unique dans le lot. */
  numeroPrix?: string | null;
  /** Série ou chapitre du DQE (« 500 ») ; regroupe les articles, dérive le découpage du forfait. */
  serie?: string | null;
  serieLibelle?: string | null;
  /** « Le mètre cube » : tête de ligne du bordereau des prix unitaires, où le candidat écrit son prix en lettres. */
  libelleBordereau?: string | null;
  /** Prix soumis à sous-détail (annexe 3 de l'AE). */
  sousDetail?: boolean | null;
  /** Plafond du prix en % du montant des travaux (installation de chantier : 10). */
  plafond?: number | null;
  /**
   * ⚠️ Q11 (arbitrage du pilote, 14/10 ; backend V116) — prix unitaire estimé HT de l'article, en ariary. Obligatoire pour valider la
   * fiche (`PRIX_ESTIME_MANQUANT`), facultatif à l'écriture. **Jamais publié** : lu par la PRMP, l'UGPM, la Commission, et la commission
   * d'appel d'offres après l'ouverture des offres.
   */
  prixUnitaireEstime?: number | null;
}

/** ⚠️ Q11 (V116) — l'estimation d'un lot face au plan (`FicheMarcheDto.estimations`) ; `lot` nul sur une ligne non allotie. */
export interface EstimationLot {
  lot: number | null;
  /** Montant HT du lot au plan ; `null` si le plan n'en porte pas (avertissement seulement). */
  montantPlan: number | null;
  totalEstime: number | null;
  ecart: number | null;
  nbArticles: number;
  articlesSansPrix: string[];
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
  /** ⚠️ 06/10 — fiche en remise électronique : offres déposées (le nombre seul) et reçus des frais en attente. Absents = 0. */
  nbOffres?: number | null;
  recusEnAttente?: number | null;
  /** ⚠️ Lot 1c — forme du marché portée par la ligne (`FORME_MARCHE`) : c'est elle qui donne le type de la fiche. */
  formeMarche?: TypeMarche | null;
  /** Lot 1c — cette forme est-elle prise en charge aujourd'hui ? Sinon la ligne se voit mais ne se prépare pas. */
  formeOutillee?: boolean | null;
  /** ⚠️ Lot 5 — catégorie de la ligne, déduite de sa nature ; `null` si la nature manque ou n'est pas classée. */
  categorie?: CategorieDao | null;
  /** Lot 5 — cette catégorie est-elle outillée ? Jumelle de `formeOutillee`, sur l'autre axe. */
  categorieOutillee?: boolean | null;
  /**
   * ⚠️ Demande du 29/09 (colonne « Nature » de la liste) — la nature de la ligne (`t_nature`), dont la catégorie est
   * déduite : « Services » et « Fournitures » sont deux natures d'une même catégorie. Absente tant que non servie.
   */
  idNature?: number | null;
  libelleNature?: string | null;
  /**
   * ⚠️ Backend e16a4f5 (14/10, `docs/demande-backend-2026-10-14-sous-type-ligne.md`) — le sous-type du dossier que la fiche
   * de cette ligne produira (`DAOO`, `DAOOI`, `DAOOPREQUAL`, `DAOR`, `DAORI`, `DC`), calculé par le serveur à la lecture avec
   * la règle de la validation (mode de la ligne, catégorie). Une fiche qui a déjà produit son dossier : le sous-type de ce dossier fait foi.
   */
  sousType?: string | null;
  /** ⚠️ 19/10 (« etat-fiche-liste ») — la fiche de la ligne (`null` sans fiche) : brouillon (ou révision ouverte) ou validée, et sa version. */
  fiche?: { statut: 'BROUILLON' | 'VALIDEE'; version: number } | null;
  /** ⚠️ 19/10 — le dossier soumis né de la fiche, `null` tant qu'il n'est pas créé. */
  dossier?: { idDossier: number; refeDossier: string | null; statut: string } | null;
  /** ⚠️ 20/10 (« dossier-marche-lecture », B2) — les dossiers de marché nés de l'attribution, par lot ; vide tant qu'aucun n'existe. */
  dossiersMarche?: { lot: number; idDossier: number; refeDossier: string | null; statut: string }[] | null;
  /** ⚠️ 20/10 (« liste-dossier-marche », B1) — le numéro de la procédure (règle de l'en-tête) ; `null` sans fiche. */
  numeroProcedure?: string | null;
  /** B2 — l'état de l'attribution par lot ; vide tant que l'évaluation n'est pas ouverte, `null` sans fiche. */
  attributions?: AttributionLigne[] | null;
  /** ⚠️ 27/10 (« dossier-marche-remise-papier », P1) — le mode de remise figé par la dernière version validée ; nul sans version validée. */
  modeRemise?: 'PAPIER' | 'ELECTRONIQUE' | null;
  /** P1 — les lots de la procédure (un lot 1, intitulé nul, pour une ligne sans lot) ; nul sans fiche. */
  lots?: { lot: number; intitule: string | null }[] | null;
  /**
   * P1 — remise papier seulement : le dossier de marché peut-il naître (`ouvert`) ; sinon la première condition qui manque
   * (`FICHE_NON_VALIDEE`, `DOSSIER_NON_CLOTURE`, `AVIS_NON_FAVORABLE`, `AVIS_NON_PUBLIE`). Nul hors remise papier.
   */
  marchePapier?: { ouvert: boolean; motif: string | null } | null;
}

/** ⚠️ 20/10 (B2) — un lot de la ligne : son état d'attribution, le rapport signé, l'offre du rang 1 (et le nombre de titulaires). */
export interface AttributionLigne {
  lot: number;
  etat: string;
  rapportSigneLe: string | null;
  propose: { candidat: string; montant: number | null; nbTitulaires: number } | null;
}

/**
 * Les sous-types qu'une fiche DAO produit, présentés à la PRMP (libellés du référentiel « Sous-types de dossier ») :
 * le mode de passation que doit porter la ligne du plan, et les documents que la fiche remplit.
 */
const PRESENTATIONS: Record<string, { libelle: string; titre: string; ligne: string; raison: string; documents: string }> = {
  DAOO: { libelle: 'Dossier d’appel d’offres ouvert', titre: 'Un appel d’offres ouvert se prépare dans sa fiche DAO', ligne: 'une ligne du plan dont le mode de passation est l’appel d’offres ouvert', raison: 'c’est le mode de passation de la ligne qui fait le sous-type du dossier', documents: 'Le DPAO, l’acte d’engagement et le CCAP' },
  // ⚠️ 18/10 (décision du pilote) — le contrat-cadre garde son sous-type distinct (DAOO-CC), produit par la fiche comme les autres
  // (demande backend du 18/10 « sous-type-contrat-cadre »).
  'DAOO-CC': { libelle: 'Dossier d’appel d’offres ouvert — contrat-cadre', titre: 'Un contrat-cadre se prépare dans sa fiche DAO', ligne: 'une ligne du plan en appel d’offres ouvert dont la forme est le contrat-cadre', raison: 'c’est le mode de passation et la forme de la ligne qui font le sous-type du dossier', documents: 'Le DPAC, l’acte d’engagement du contrat-cadre et le CCAP' },
  DAOOI: { libelle: 'Dossier d’appel d’offres ouvert international', titre: 'Un appel d’offres ouvert international se prépare dans sa fiche DAO', ligne: 'une ligne du plan dont le mode de passation est l’appel d’offres ouvert international', raison: 'c’est le mode de passation de la ligne qui fait le sous-type du dossier', documents: 'Le DPAO (le DPAC pour un contrat-cadre), l’acte d’engagement et le CCAP' },
  DAOOPREQUAL: { libelle: 'Dossier d’appel d’offres ouvert avec pré-qualification', titre: 'Un appel d’offres avec pré-qualification se prépare dans sa fiche DAO', ligne: 'une ligne du plan dont le mode de passation est l’appel d’offres avec pré-qualification', raison: 'c’est le mode de passation de la ligne qui fait le sous-type du dossier', documents: 'Le DPAO (le DPAC pour un contrat-cadre), l’acte d’engagement et le CCAP' },
  DAOR: { libelle: 'Dossier d’appel d’offres restreint', titre: 'Un appel d’offres restreint se prépare dans sa fiche DAO', ligne: 'une ligne du plan dont le mode de passation est l’appel d’offres restreint', raison: 'c’est le mode de passation de la ligne qui fait le sous-type du dossier', documents: 'Le DPAO (le DPAC pour un contrat-cadre), l’acte d’engagement et le CCAP' },
  DAORI: { libelle: 'Dossier d’appel d’offres restreint international', titre: 'Un appel d’offres restreint international se prépare dans sa fiche DAO', ligne: 'une ligne du plan dont le mode de passation est l’appel d’offres restreint international', raison: 'c’est le mode de passation de la ligne qui fait le sous-type du dossier', documents: 'Le DPAO (le DPAC pour un contrat-cadre), l’acte d’engagement et le CCAP' },
  DC: { libelle: 'Dossier de consultation (prestations intellectuelles)', titre: 'Une consultation de prestations intellectuelles se prépare dans sa fiche', ligne: 'une ligne du plan de prestations intellectuelles', raison: 'c’est la nature de la ligne qui en fait une consultation, quel que soit son mode de passation', documents: 'Les données particulières des instructions aux consultants (DPIC) et les pièces de la consultation' },
};
/** L'ancien sous-type `DAO` (dossiers relus d'avant la migration M1) se présente comme `DAOO`. */
export const PRESENTATION_SOUS_TYPE_FICHE: Readonly<Record<string, { libelle: string; titre: string; ligne: string; raison: string; documents: string }>> = { ...PRESENTATIONS, DAO: PRESENTATIONS['DAOO'] };

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
  /** La DERNIÈRE version validée — elle avance à chaque revalidation, elle ne dit pas ce que la Commission a examiné. */
  version: number;
  /**
   * ⚠️ Lot C (V49, 27/09, §B1) — la version que le dossier a SOUMISE (posée à la soumission, avancée par la resoumission
   * et la transmission des compléments) et, séparément, la version EXAMINÉE (celle du PV — dans la boucle FAVR la
   * version soumise avance sans réexamen). `0` ou nul : dossier d'avant V49 sans version connue.
   */
  versionSoumise?: number | null;
  versionExaminee?: number | null;
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
  /** La pièce : un document maître (`DPAO`, `AE`, `CCAP`…) ou une pièce dérivée du besoin (`LF`, `BP`, `TC`…). */
  type: PieceProduite;
  libelle?: string | null;
  extension?: string | null;
  nomFichier: string;
  tailleOctets?: number | null;
  dateGeneration?: string | null;
  /** Version de la fiche qui a produit ce document. */
  version?: number | null;
  /**
   * ⚠️ 30/09 (V56) — avis spécifique (`PublicationAvis`) ou lettre d'invitation (`PublicationLettres`, 01/10) : les
   * informations saisies à l'impression. Rien pour les autres documents.
   */
  publication?: PublicationAvis | PublicationLettres | null;
}

// ── Avis spécifique d'appel d'offres (demande du 30/09, livrée : V56) ─────────────────────────────────────────────

/**
 * Corps de `POST …/avis-specifique` et trace gardée avec chaque avis produit. Dates `AAAA-MM-JJ`.
 * ⚠️ V118 (15/10, H1 « figés ») — `jmpNumero` et `jmpDate` ne s'envoient plus (le serveur les ignore) : ils se lisent sur la publication de
 * l'AGPM déposée sur le plan, et la trace porte en plus `journal` et `referenceAgpm`. Seule `datePublication` est exigée.
 */
export interface PublicationAvis {
  datePublication: string;
  supports: string;
  jmpNumero?: string | null;
  jmpDate?: string | null;
  journal?: string | null;
  referenceAgpm?: string | null;
}

/**
 * ⚠️ 01/10 (lot AV-4) — un candidat de la liste restreinte des prestations intellectuelles. `adresse` : une ligne par ligne.
 * ⚠️ 08/10 (lot 3 PI, tranche PI-a) — `email`, facultatif : le compte candidat qui porte cette adresse est rattaché à
 * l'invitation (même créé après) et l'adresse reçoit la notification de la lettre.
 */
export interface CandidatInvite {
  nom: string;
  adresse: string;
  email?: string | null;
}

/**
 * ⚠️ Lot 3 PI, tranche PI-a (V84) — un sous-critère d'un critère technique (`B06-TP-02` à `B06-TP-06`) : ses points
 * s'additionnent pour faire ceux du critère (`SOUS_CRITERES_POINTS` au bilan). L'ordre est la position dans la liste.
 */
export interface SousCritere {
  ordre?: number;
  critere: string;
  libelle: string;
  points: number;
}

/**
 * Corps de `POST …/lettres-invitation` et trace gardée avec chaque lettre produite ; `rang` (1, 2…) dit à quel candidat
 * de la liste une paire est adressée (trace seulement). Date `AAAA-MM-JJ`.
 */
export interface PublicationLettres {
  dateEnvoi: string;
  lieu: string;
  candidats: CandidatInvite[];
  rang?: number;
}

/** Pourquoi l'avis ne s'imprime pas encore (`details.raison` du 409 `AVIS_INDISPONIBLE`, `raison` de la disponibilité). */
export type RaisonAvisIndisponible =
  | 'CATEGORIE_SANS_AVIS'
  | 'SANS_DOSSIER'
  | 'PV_NON_SIGNE'
  | 'AVIS_NON_FAVORABLE'
  | 'RESERVES_NON_LEVEES'
  | 'FICHE_NON_VALIDEE'
  /** ⚠️ V118 (15/10) — la publication de l'AGPM n'est pas déposée sur le plan : l'avis cite son journal. */
  | 'PUBLICATION_AGPM_ABSENTE'
  | 'CATEGORIE_SANS_LETTRE'
  /** ⚠️ Manuel révisé, R3c (13/10) — appel d'offres restreint : pas d'avis, une lettre d'invitation (gabarit LETTRE-AOR). */
  | 'MODE_SANS_AVIS'
  /** ⚠️ Lot 2b (V66) — remise électronique : sans clés publiées, aucun candidat ne pourrait sceller. Vaut aussi pour les lettres. */
  | 'CEREMONIE_NON_CLOSE'
  /** ⚠️ 18/10 (« dao-electronique », Q4) — dossier payant sans compte de l'ARMP réglé : l'avis et la lettre AOR imprimeraient des pointillés. */
  | 'COMPTE_ARMP_ABSENT'
  | (string & {});

/**
 * `GET …/avis-specifique/disponibilite` — la règle du serveur (PV signé FAV, ou FAVR après la levée des réserves),
 * lue telle quelle : l'écran ne la réécrit pas.
 */
export interface DisponibiliteAvis {
  disponible: boolean;
  raison: RaisonAvisIndisponible | null;
  idAvis: string | null;
  statutPv: string | null;
  statutDossier: string | null;
  idDossierSoumis: number | null;
  /**
   * ⚠️ R9a (V111, 14/10, art. 31) — l'avis et les lettres exigent le DAO complet de la version validée : `PRODUIT` ; `A_ASSEMBLER`
   * (⚠️ 28/10, V144 : l'impression le met en tête de file et rend 409 `DAO_COMPLET_ABSENT` — il n'est plus assemblé sur-le-champ) ;
   * `SANS_ASSEMBLAGE` (serveur sans Word : la règle ne s'applique pas) ; nul sans version validée. Indicatif : `disponible` n'en dépend pas.
   */
  daoComplet?: 'PRODUIT' | 'A_ASSEMBLER' | 'SANS_ASSEMBLAGE' | null;
  /**
   * ⚠️ 15/10 (décret n° 2019-1064, art. 9 ; demande « marchés subséquents », B0) — contrat-cadre seulement : les supports de
   * publicité minimaux, en rappel près de la saisie des supports. Rien n'est exigé ; liste vide hors contrat-cadre.
   */
  supportsMinimaux?: string[] | null;
}

/**
 * ⚠️ Manuel révisé, R3c (13/10, arbitrage Q3 « mentions complètes ») — les mentions du modèle type d'un avis ou d'une lettre,
 * vérifiées deux fois par le serveur : sur le **gabarit** (le modèle porte la mention) et sur le **document rendu** pour la version
 * courante (la valeur n'est pas en pointillés), ou **sans objet** pour cette fiche. `GET …/avis-specifique/mentions`,
 * `GET …/lettres-invitation/mentions` ; 409 `AVIS_INDISPONIBLE` / `LETTRE_INDISPONIBLE` (`details.raison`).
 */
export interface MentionDocument {
  code: string;
  libelle: string;
  presenteAuGabarit: boolean;
  renseignee: boolean;
  sansObjet: boolean;
  detail: string | null;
}

export interface MentionsDocument {
  gabarit: string;
  gabaritComplet: boolean;
  documentComplet: boolean;
  mentions: MentionDocument[];
}

/** Erreur nominative par champ d'un `PUT …/blocs/{bloc}` (400). */
export interface ErreurChamp {
  champ: string;
  message: string;
}

// ── Import du DAO (demande du 28/09, livrée : `POST …/import`, `PUT …/import/appliquer`) ──────────────────────────

/** Niveau de confiance d'une valeur lue : haute = bornée par le texte fixe du modèle ; basse = à vérifier de près. */
export type ConfianceImport = 'haute' | 'moyenne' | 'basse';

/** Une valeur lue dans le DAO pour un champ de la fiche. `actuelle` : ce que la fiche porte déjà (jamais écrasé d'office). */
export interface PropositionImport {
  code: string;
  lot: number | null;
  valeur: string | number | null;
  brut: string;
  confiance: ConfianceImport;
  extrait: string;
  actuelle: string | number | null;
  /** Refus de la validation, condition d'affichage fausse, champ par lot : la ligne ne peut pas être retenue. */
  anomalies: string[];
  /**
   * ⚠️ 03/10 — lecture hybride (contrat demandé, `demande-backend-2026-10-03-lecture-par-clause` §B3) : `'modele'` = lue
   * dans le modèle (la lecture habituelle) ; `'clause'` = trouvée par les mots-clés de sa clause, toujours en confiance
   * moyenne, à vérifier. Absent : lecture habituelle.
   */
  source?: 'modele' | 'clause' | null;
}

/**
 * ⚠️ 03/10 — un passage de liste repéré par la lecture par clause (contrat demandé, §B2) : il ne s'applique pas, il se
 * colle dans la liste du bloc (« Coller une liste »), où la PRMP vérifie l'aperçu.
 */
export interface PassageImport {
  liste: 'MATERIEL' | 'PERSONNEL' | 'PIECES';
  texte: string;
  paragraphe?: number | null;
}

/** Une réponse de cadrage déduite de la rédaction retenue par le document. */
export interface ReponseCadrageImport {
  cle: string;
  valeur: string | number;
  section: string;
  actuelle: string | number | null;
  /**
   * ⚠️ 17/10 (`demande-backend-2026-10-17-cadrage-depuis-dao`, livré PRS20 6c8e2b5) — d'où vient la réponse : une section
   * reconnue du modèle, le reflet d'un champ lu (`avance` depuis le taux), ou une clause lue par mots-clés (jamais sûre).
   * Absent d'un serveur antérieur.
   */
  source?: 'section' | 'reflet' | 'clause' | null;
  /** La phrase du DAO qui porte la réponse (clause, reflet). */
  extrait?: string | null;
}

export interface ImportDaoResult {
  fichier: string;
  empreinte: string;
  modeles: { sigle: string; unites: number; reconnues: number }[];
  cadrage: ReponseCadrageImport[];
  propositions: PropositionImport[];
  /** Un endroit du document que le modèle attribue à plusieurs champs possibles : signalé, jamais choisi. */
  ambigus: { candidats: string[]; texte: string }[];
  /** Le DAO dit autre chose que le plan de passation : le plan fait foi, rien n'est proposé. */
  divergences: { code: string; document: string; plan: string }[];
  conflits: { code: string; valeurs: (string | number)[] }[];
  nonTrouves: string[];
  avertissements: string[];
  /** ⚠️ 03/10 — passages de listes (contrat demandé) ; absent tant que le serveur ne le sert pas. */
  passages?: PassageImport[] | null;
  /**
   * ⚠️ 16/10 — le besoin (bloc `B12`) lu dans les **tableaux** du DAO (`demande-backend-2026-10-16-import-specifications`,
   * livré). Lecture seule : les lots retenus s'écrivent par `PUT …/articles?lot=k`, avec la trace de l'import.
   */
  articles?: ArticleImport[] | null;
  /**
   * ⚠️ 17/10 — le verdict d'identité : le DAO est-il celui de la ligne du plan ? (`demande-backend-2026-10-17-identite-dao-importe`,
   * livré, PRS20 ffb3bb0). Absent d'un serveur antérieur. Le serveur le fait respecter à l'application (409).
   */
  identite?: IdentiteImport | null;
}

/** `CONFORME` : tout est retrouvé ; `NON_PROUVE` : rien de contredit, un critère introuvable (attestation de la PRMP) ; `ETRANGER` : un critère contredit (rien ne s'applique). */
export type VerdictIdentite = 'CONFORME' | 'NON_PROUVE' | 'ETRANGER';
export type CritereIdentite = 'OBJET' | 'AUTORITE' | 'MODE' | 'FORME' | 'LOTS';
export type EtatCritere = 'RETROUVE' | 'CONTREDIT' | 'INTROUVABLE';

export interface IdentiteImport {
  verdict: VerdictIdentite;
  /** Vide quand le DAO est reconnu à sa marque (DAO produit par l'application, fichier intact). */
  criteres: { critere: CritereIdentite; plan: string; etat: EtatCritere; extrait: string | null; page: number | null }[];
  /** La ligne du plan à laquelle le DAO ressemble autant ou plus (test de discrimination), sinon `null`. */
  voisine: { idDetail: number; objet: string } | null;
  /** Le verdict en une phrase, prête à afficher. */
  motif: string;
}

/**
 * ⚠️ 16/10 — un article lu dans les tableaux du DAO (bordereau ou DQE, spécifications, définition des prix en travaux).
 * Les prix ne sont jamais lus.
 */
export interface ArticleImport {
  /** Rang du lot au plan ; `null` sur une ligne non allotie. */
  lot: number | null;
  /** Tel qu'écrit dans le DAO (« 001 », « 529 ») ; le n° de prix en travaux. */
  numero: string;
  designation: string;
  unite: string | null;
  quantite: number | null;
  quantiteMin: number | null;
  quantiteMax: number | null;
  /** Travaux : la série du DQE (« 500 ») et son libellé (« OUVRAGES »). */
  serie: string | null;
  serieLibelle: string | null;
  /** Sans « libellé : » dans le DAO, le serveur pose le libellé « Spécification » (la validation exige les deux). */
  caracteristiques: { libelle: string; exigence: string }[];
  /** `article` : haute (lu au bordereau), moyenne (seulement aux spécifications) ; `caracteristiques` : moyenne, nulle sans. */
  confiance: { article: ConfianceImport; caracteristiques: ConfianceImport | null };
  /** Pages du PDF ; `null` pour un Word. */
  pages: { bordereau: number | null; specification: number | null } | null;
  /** Présent seulement si les spécifications nomment l'article autrement (écart signalé aussi en avertissement). */
  designationSpecification?: string | null;
  /** Chaque entrée commence par son code (`LOT_HORS_PLAN : …`, `QUANTITES_INCOMPATIBLES : …`) : non retenable. */
  anomalies: string[];
}

/** Corps de `PUT …/import/appliquer` : les seules lignes retenues par la PRMP, avec la trace du fichier lu. */
export interface AppliquerImportCorps {
  cadrage: Record<string, string | number>;
  valeurs: Record<string, string | number>;
  fichier: string;
  empreinte: string;
  /** ⚠️ 17/10 — la PRMP (elle seule) atteste qu'un DAO `NON_PROUVE` est celui de la ligne ; sinon 409 `ATTESTATION_REQUISE`. */
  attestation?: boolean;
}
