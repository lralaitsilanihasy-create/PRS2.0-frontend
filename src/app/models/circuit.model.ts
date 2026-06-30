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
  idTypeDossier?: string;
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

/** Corps de `POST /api/examens/{id}/soumettre` : produit toujours un projet de PV (`idAvis` = avis du PV). */
export interface ExamenSoumissionRequest {
  idAvis: string;
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
  /** `true` si la lettre a déjà été lue par la PRMP courante (réponse, lecture seule). */
  lue?: boolean;
}

/** Résultat d'un point de contrôle examiné. */
export interface ExamenDetail {
  idDetailExamen: number;
  idExamen: number;
  idPtControle: number;
  conforme: boolean;
  /** Lignes « AU LIEU DE / LIRE » (remplace l'ancien champ texte `observation`) ; `[]` si conforme. */
  observations?: ObservationControle[];
  obsSiNonConforme?: string;
}

/**
 * PV d'examen.
 * Cycle : BROUILLON → PROJET_SOUMIS → EN_RECTIFICATION → PROJET_ACCEPTE → SIGNE.
 * À la création, `statutPv` est forcé à `BROUILLON` et `nbNavettes` à `0`.
 */
export interface PvExamen {
  idPv: number;
  idExamen: number;
  idAvis: string;
  imCtrlPresident?: string;
  imCtrlCc?: string;
  imCtrlMembre: string;
  /** Vérificateur désigné Secrétaire de séance (posé à la soumission). */
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
}

/**
 * Corps des actions de workflow du PV (`/soumettre`, `/retourner`, `/accepter`, `/signer`).
 * `commentaire` obligatoire pour `retourner` ; `role` obligatoire pour `signer`.
 */
export interface PvActionRequest {
  imActeur: string;
  commentaire?: string;
  role?: PvSignataireRole;
}
