import {
  StatutDossier,
  StatutPv,
  SensNavette,
  StatutDemandeRetrait,
  TypePassage,
  PvSignataireRole,
} from './common.model';

/** Dossier soumis au contrôle. Lecture filtrée par localité. */
export interface Dossier {
  idDossier: number;
  /** Famille de dossier (`tr_type_dossier` : DDP / DMC / DDM). */
  idTypeDossier?: string;
  /** Sous-type (référentiel `sous-type-dossiers`) ; famille DDP : **dérivé serveur** (PPM / PPM-AGPM selon les marchés), DMC/DDM : choisi à la saisie. */
  idSousType?: string;
  idDossierParent?: number | null;
  /** Référence officielle générée par `…/soumettre` ; laisser vide à la création. */
  refeDossier?: string;
  /** Renseignée à la soumission si vide. */
  dateRef?: string;
  statut?: StatutDossier;
  /** Localité du dossier (FK tr_localite) ; estampillée par `…/soumettre`, modifiable. */
  idLocalite?: string;
  /** Entité contractante (FK tr_entite_contract) ; choisie à la saisie. */
  idEntiteContract?: number;
  /** PRMP **d'attribution** (posée à la saisie, JAMAIS recalculée) ; la PRMP en fonction peut aussi agir (Mandats PRMP). */
  idPrmp?: string;
  /** Mandat d'attribution (lecture seule, figé à la création ; null si la PRMP n'a pas de mandat déclaré). */
  idMandatAttrib?: number | null;
  /**
   * ⚠️ Traçabilité (exposée par le backend le 2026-08-19) — **login** de l'acteur ayant créé le
   * dossier (PRMP **ou UGPM** agissant sous sa tutelle). Lecture seule : posé serveur à la création.
   */
  creePar?: string;
  /** Login de l'acteur ayant **soumis** le dossier (PRMP uniquement). Lecture seule, posé serveur. */
  soumisPar?: string;
  /**
   * Nom lisible « Nom Prénoms » correspondant à `creePar`, **résolu par le serveur** (le login n'est
   * pas l'identifiant de l'acteur : seul le backend peut faire la jointure vers la PRMP / l'UGPM).
   * `null` si le compte a disparu — on retombe alors sur le login brut.
   */
  creeParNom?: string | null;
  /** Nom lisible correspondant à `soumisPar` ; `null` si non résolvable. */
  soumisParNom?: string | null;
  /** Verrou optimiste : à renvoyer telle quelle au PUT (périmée → 409 `CONFLIT_VERSION`) ; absente = dernier écrit gagne. */
  version?: number;
}

/**
 * Entrée du **journal des actions** d'un dossier (`GET /api/dossiers/{id}/journal`, spec « Mandats PRMP ») :
 * qui a agi, quand et sous quel mandat. `idPrmpOperateur` = PRMP EN FONCTION à la date de l'action —
 * après un changement de titulaire elle diffère de `idPrmp`/`idMandatAttrib` du dossier (qui ne bougent pas).
 */
export interface ActionDossier {
  idAction: number;
  idDossier: number;
  dateAction: string;
  /** CREATION | SOUMISSION | RESOUMISSION | TRANSMISSION_COMPLEMENTS | TRANSMISSION_COMPLEMENTS_DEPOT | SUPPRESSION | MISE_A_JOUR. */
  typeAction: string;
  idPrmpOperateur?: string;
  nomOperateur?: string;
  auteur?: string;
  idMandatOperateur?: number | null;
  detail?: string;
}

/** Réception d'un dossier (passage initial ou retour). */
export interface Reception {
  /** PK allouée par le serveur au POST (id client ignoré, non envoyé) ; présente en réponse, utilisée par le dispatch. */
  idReception: number;
  idDossier: number;
  numPassage: number;
  typePassage: TypePassage;
  imCtrlRecept?: string;
  dateReception?: string;
  observation?: string;
  /** Si `true` → le dossier passe en `PRET_DISPATCH` (effet [Auto]). */
  complet?: boolean;
  idReceptionPrec?: number;
  /** Référence officielle structurée générée au POST (réponse, lecture seule) ; aussi persistée sur le dossier (`refeDossier`). */
  reference?: string;
  /** Date/heure de soumission du dossier rattaché (`yyyy-MM-dd HH:mm`, lecture seule) ; `null` pour un dossier ancien sans date de soumission. */
  dateSoumission?: string;
}

/** Réponse de GET /api/receptions/dossier/{idDossier}/existe (test léger « déjà réceptionné ? »). */
export interface ReceptionExiste {
  idDossier: number;
  recu: boolean;
}

/** Affectation d'un dossier à un membre. */
export interface Dispatch {
  idDispatch: number;
  idReception: number;
  imCtrlDispatch?: string;
  imCtrlCc?: string;
  imCtrlMembre?: string;
  dateDispatch?: string;
  dateCtrlAssigne?: string;
  instructions?: string;
  /** Président → false ; CC dans sa localité → false ; CC hors localité → true (sinon 409). */
  interimDispatch: boolean;
}

/** Copie formelle d'un dossier transmise pour information. */
export interface CopieDossier {
  idCopie: number;
  idDispatch: number;
  idDossier: number;
  imDestinataire: string;
  typeCopie: string;
  dateTransmission: string;
  accuseReception: boolean;
  dateAccuse?: string;
  observation?: string;
}

/** Examen d'un dossier par un membre. */
export interface Examen {
  idExamen: number;
  idDispatch: number;
  imCtrlMembre?: string;
  dateExamen?: string;
  /** Avis **suggéré** (réponse `GET /{id}`, non contraignant) : `DEF` si ≥1 point non conforme, sinon `FAV`, `null` si rien d'évalué. Pré-remplit l'avis final. */
  avisSuggere?: string | null;
}

/**
 * Ligne structurée « AU LIEU DE / LIRE » d'un point de contrôle non conforme (`t_observation_controle`).
 * Remplace l'ancien champ texte `observation`.
 */
export interface ObservationControle {
  /** PK auto-générée (réponse, IDENTITY). */
  idObservation?: number;
  /** FK vers le point de contrôle ; requis pour l'API dédiée, implicite quand embarqué dans `ExamenDetail`. */
  idDetail?: number;
  auLieuDe?: string;
  lire?: string;
  ordre: number;
}

/**
 * Corps de `POST /api/examens/{id}/soumettre` : produit toujours un projet de PV.
 * ⚠️ Règle modifiée (2026-08-01) — le Membre ne renseigne PLUS l'avis ni le secrétaire à la
 * soumission : ils sont posés à la clôture de navette (`/pv-examens/{id}/accepter`, Président/CC).
 */
export interface ExamenSoumissionRequest {
  idAvis?: string;
  /** Matricule du Vérificateur désigné Secrétaire de séance (optionnel — posé à la clôture de navette). */
  idSecretaireSeance?: string;
}

/**
 * Lettre de renvoi (`t_lettre_renvoi`) — alternative au projet de PV produite par l'examen.
 * Cycle : `BROUILLON → SOUMIS → SIGNE`. `refLettre`/dates/statut/imSignataire posés serveur.
 */
export interface LettreRenvoi {
  /** PK auto-générée (réponse). */
  idLettre?: number;
  idExamen: number;
  /** Lecture seule (dérivé de l'examen). */
  idDossier?: number;
  /** Générée serveur : `<seq>/<type>/<code_localite>/LR/<année>`. */
  refLettre?: string;
  corpsLettre?: string;
  dateExamen?: string;
  dateLettre?: string;
  /** `BROUILLON` / `SOUMIS` / `SIGNE` (forcé serveur). */
  statut?: string;
  imSignataire?: string;
  /** Nom complet du signataire (« prénoms nom »), peuplé serveur — lecture seule. */
  nomSignataire?: string;
  /**
   * `true` si la lettre a déjà été lue par l'**agent connecté** (réponse, lecture seule).
   * ⚠️ Règle modifiée (2026-08-27) — le suivi de lecture est **individuel** (par compte) et non
   * plus partagé par la tutelle : la consultation par une UGPM ne vaut plus lecture pour sa PRMP,
   * et réciproquement. Forme de l'API inchangée (le serveur peuple le drapeau pour le connecté).
   */
  lue?: boolean;
  /** ⚠️ Spec navette (2026-08-01) — archivage par l'Assistant contrôleur (lecture seule). */
  dateArchivage?: string;
  imArchiveur?: string;
  /** Verrou optimiste : à renvoyer telle quelle au PUT (périmée → 409 `CONFLIT_VERSION`) ; absente = dernier écrit gagne. */
  version?: number;
}

/** Résultat d'un point de contrôle examiné — par ligne de marché (portée LIGNE) ou au niveau dossier (DOSSIER). */
export interface ExamenDetail {
  idDetailExamen: number;
  idExamen: number;
  /** Ligne de marché évaluée (FK `t_marche`) : renseignée pour un point **LIGNE**, `null` pour un point **DOSSIER** (ou examen historique). */
  idDetail?: number | null;
  idPtControle: number;
  conforme: boolean;
  /** Lignes « AU LIEU DE / LIRE » (remplace l'ancien champ texte `observation`) ; `[]` si conforme. */
  observations?: ObservationControle[];
  obsSiNonConforme?: string;
}

/** Examen d'une **pièce jointe** du dossier (`t_examen_piece`, ⚠️ règle ajoutée) — une pièce = un résultat. */
export interface ExamenPiece {
  idExamenPiece: number;
  idExamen: number;
  idPiece: number;
  /** RAS = true ; sinon `observation` porte le constat. */
  conforme: boolean;
  observation?: string;
}

/**
 * PV d'examen.
 * Cycle : BROUILLON → PROJET_SOUMIS → EN_RECTIFICATION → PROJET_ACCEPTE → SIGNE.
 * À la création, `statutPv` est forcé à `BROUILLON` et `nbNavettes` à `0`.
 */
export interface PvExamen {
  idPv: number;
  idExamen: number;
  /** ⚠️ Règle modifiée (2026-08-01) — nullable : l'avis est posé à la clôture de navette (accepter, Président/CC). */
  idAvis?: string;
  imCtrlPresident?: string;
  imCtrlCc?: string;
  imCtrlMembre: string;
  /** Vérificateur désigné Secrétaire de séance (posé à la clôture de navette). */
  idSecretaireSeance?: string;
  /** Nom complet du secrétaire de séance, peuplé serveur — lecture seule. */
  nomSecretaireSeance?: string;
  syntheseObservations?: string;
  statutPv: StatutPv;
  nbNavettes: number;
  dateSoumissionInitiale?: string;
  dateAcceptation?: string;
  dateSignaturePresident?: string;
  dateSignatureCc?: string;
  dateSignatureMembre?: string;
  datePv?: string;
  referencePv?: string;
  /** Référence officielle dérivée du dossier (refeDossier avec /PV avant l'année), générée serveur. */
  refePv?: string;
  /**
   * Présence d'un PDF officiel téléchargeable (`t_pv_examen.CHEMIN_DOCUMENT` non nul / PV éligible).
   * Le document n'est généré que pour un avis `FAVR`, un dossier de localité centrale (`ANT`) et des
   * marchés tous en appel d'offres ouvert. `undefined` = information non fournie par le backend.
   */
  documentDisponible?: boolean;
  /** ⚠️ Spec navette (2026-08-01) — archivage par l'Assistant contrôleur (lecture seule). */
  dateArchivage?: string;
  imArchiveur?: string;
  /** Verrou optimiste : à renvoyer telle quelle au PUT (périmée → 409 `CONFLIT_VERSION`) ; absente = dernier écrit gagne. */
  version?: number;
}

/**
 * ⚠️ Spec recevabilité au dépôt (2026-08-02) — vérification pièce par pièce du SECRÉTAIRE avant
 * enregistrement de la réception (`t_verification_piece_depot`, append-only : l'état courant d'un type
 * de pièce = sa dernière décision). Distinct de la lettre de renvoi (aucun archivage).
 */
export interface VerificationPieceDepot {
  idVerifPiece?: number;
  idDossier: number;
  /** Type de pièce attendu (référentiel `type-piece-jointes`). */
  idTypePiece: number;
  /** Pièce déposée vérifiée — absent si MANQUANTE. */
  idPiece?: number;
  decision: 'CONFORME' | 'NON_CONFORME' | 'MANQUANTE' | (string & {});
  observation?: string;
  imSecretaire?: string;
  dateVerif?: string;
}

/**
 * ⚠️ Spec « circuit des observations FAVR » (2026-08-02) — observation du PÉRIMÈTRE FIGÉ du PV
 * (`t_observation_pv` + historique `t_suivi_observation`). Le périmètre est figé à la signature du
 * PV FAVR ; statut courant : EMISE (jamais statuée) / LEVEE (satisfaite, DÉFINITIVE) / MAINTENUE
 * (rappel à la PRMP, précision facultative). Aucune création possible côté client (rejet backend).
 */
export interface ObservationPv {
  idObservationPv: number;
  idDossier: number;
  idPv: number;
  source: 'POINT' | 'PIECE' | (string & {});
  /** Résultat de pièce d'origine (`t_examen_piece`) — PIECE seulement : pont vers la pièce concernée. */
  idExamenPiece?: number;
  /** Libellé figé, tel qu'arrêté au PV. */
  libelle: string;
  ordre?: number;
  statut: 'EMISE' | 'LEVEE' | 'MAINTENUE' | (string & {});
  /** Dernière précision du vérificateur (« ce qui manque »), si MAINTENUE. */
  precision?: string;
  /**
   * ⚠️ Règle 2026-08-15 — pas de levée avant la première RESOUMISSION de la PRMP : false au premier
   * passage (= rappel, tout est maintenu ; 409 serveur en garde), true ensuite. Absent = backend
   * antérieur → comportement historique (levée offerte).
   */
  leveePossible?: boolean;
  /** Dernière itération statuée. */
  iteration?: number;
  historique?: SuiviObservation[];
}

/** Une décision d'itération sur une observation (historique, traçabilité). */
export interface SuiviObservation {
  iteration: number;
  decision: 'LEVEE' | 'MAINTENUE' | (string & {});
  precision?: string;
  imVerificateur?: string;
  dateDecision?: string;
}

/**
 * ⚠️ Spec navette (2026-08-01) — transmission du sens de la décision de la Commission vers SIGMP
 * (`t_transmission_sigmp`, enregistrée côté PRS 2.0 en attendant l'API SIGMP réelle).
 * Au POST, seul `idDossier` est requis : sens/levée/date/auteur dérivés serveur.
 */
export interface TransmissionSigmp {
  idTransmission?: number;
  idDossier: number;
  idPv?: number;
  /** APPROUVE (FAV, ou FAVR après levée) / NON_APPROUVE (DEF, NSP). */
  sens?: 'APPROUVE' | 'NON_APPROUVE' | (string & {});
  leveeObservations?: boolean;
  dateTransmission?: string;
  imVerificateur?: string;
  statutEnvoi?: string;
}

/** Navette (aller-retour) du projet de PV. Traçabilité immuable (pas de suppression). */
export interface PvNavette {
  idNavette: number;
  idPv: number;
  numNavette: number;
  sens: SensNavette;
  imActeur: string;
  dateAction: string;
  commentaire?: string;
}

/** Vérification de la levée des observations sur PV signé. */
export interface Verification {
  /** Auto-généré côté serveur (IDENTITY) ; non envoyé à la création. */
  idVerification?: number;
  idReception: number;
  idPv: number;
  imCtrlVerif?: string;
  dateVerif?: string;
  observation?: string;
  /** Si `true` → dossier `CLOTURE` + notification publication (effet [Auto]). */
  obsLevees?: boolean;
  /** Motif de rectification PRMP (sortie) ; posé serveur à la resoumission ; lecture seule. */
  motifRectif?: string;
}

/** Corps de `POST /api/dossiers/{id}/resoumettre` (PRMP propriétaire). */
export interface DossierResoumissionRequest {
  motifRectification: string;
}

/** Entrée du fil chronologique d'un dossier clôturé (`GET /api/dossiers/{id}/historique-echanges`, trié ASC). */
export interface EchangeDto {
  type: 'OBSERVATION' | 'RECTIFICATION';
  date: string;
  acteur: string;
  texte: string;
  /** Renseigné pour OBSERVATION (true = passage de clôture) ; null/absent pour RECTIFICATION. */
  obsLevees?: boolean;
}

/**
 * Demande de retrait d'un dossier par une PRMP.
 * `EN_ATTENTE` à la création ; à la décision du CC, `imCtrlCc` et `obsDecision`
 * deviennent obligatoires (sinon 409).
 */
export interface DemandeRetrait {
  /** Auto-généré serveur (IDENTITY) ; ignoré en entrée. */
  idDemandeRetrait?: number;
  idDossier: number;
  /** Dérivé du JWT ; ignoré en entrée. */
  idPrmp?: string;
  motifRetrait: string;
  /** Posé serveur ; ignoré en entrée. */
  dateDemande?: string;
  /** Forcé serveur (`EN_ATTENTE`) ; ignoré en entrée. */
  statut?: StatutDemandeRetrait;
  imCtrlCc?: string;
  dateDecision?: string;
  obsDecision?: string;
  /**
   * ⚠️ Lettre de demande de retrait (règle 2026-08-17) : PDF daté et signé, joint **à la demande**
   * (pas aux pièces du dossier — il justifie la décision et survit à la purge du circuit).
   * `null` sur les demandes antérieures à la règle : le document répond alors 404.
   */
  nomFichier?: string | null;
  tailleFichier?: number | null;
}

/**
 * Corps des actions de workflow du PV (`/soumettre`, `/retourner`, `/accepter`, `/signer`).
 * `commentaire` obligatoire pour `retourner` ; `role` obligatoire pour `signer`.
 * ⚠️ Règle ajoutée (2026-08-01) — `idAvis` + `idSecretaireSeance` obligatoires pour `accepter`
 * (clôture de navette, Président/CC) ; ignorés par les autres actions.
 */
export interface PvActionRequest {
  imActeur: string;
  commentaire?: string;
  role?: PvSignataireRole;
  idAvis?: string;
  /** Vérificateur (localité du dossier) désigné Secrétaire de séance — requis pour `accepter`. */
  idSecretaireSeance?: string;
}
