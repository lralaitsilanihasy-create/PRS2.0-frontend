/** Domaine PRMP : PPM, marchés et leurs détails. */

/** Plan de Passation des Marchés. */
export interface Ppm {
  idPpm: number;
  idDossier: number;
  exercice: number;
  signataire: string;
  dateSignature: string;
  datePpmInit?: string;
  numMajPrec?: number;
  dateMajPrec?: string;
  numMaj?: number;
  dateMaj?: string;
  reference: string;
  libelle?: string;
  dateReceptionCnm?: string;
  idLocalite?: string;
  vu?: string;
  idPrmp?: string;
  motifMaj?: string;
}

/** Marché (détail d'un dossier). PK = idDetail. */
export interface Marche {
  idDetail: number;
  idDossier: number;
  idPpm: number;
  designationMarche?: string;
  numCompte?: string;
  montEstim?: number;
  ancienMontEstim?: number;
  nouvMontEstim?: number;
  financement?: string;
  statut?: string;
  idNature?: number;
  idMode?: number;
}

/**
 * Date prévisionnelle d'un marché (relation 1,N avec Marché via idDetail) — **une ligne par processus
 * CAPM** (`idCapm`), avec sa période `dateDebut`/`dateFin`. `ordre` (réponse) vient de `t_capm.ordre`.
 */
export interface MarchePrevision {
  idPrevision: number;
  /** FK vers le marché (Marche.idDetail). */
  idDetail: number;
  /** FK vers le processus CAPM (`t_capm`). */
  idCapm: number;
  /** `yyyy-MM-dd`. */
  dateDebut: string;
  /** `yyyy-MM-dd`. */
  dateFin: string;
  /** Lecture seule (réponse) — `t_capm.ordre`, pour le tri d'affichage. */
  ordre?: number;
}

/** Un processus prévisionnel d'un marché à la saisie (`POST /api/saisies/ppm`). */
export interface ProcessusMarche {
  idCapm: number;
  dateDebut: string; // yyyy-MM-dd
  dateFin: string; // yyyy-MM-dd
}

/**
 * Pièce jointe réellement déposée sur un dossier (`t_piece_jointe_dossier`).
 * `apresLettreRenvoi` distingue les pièces initiales (`false`) des pièces ajoutées après une
 * lettre de renvoi (`true`, avec `idLettre`). Le contenu binaire n'est jamais exposé en JSON.
 */
export interface PieceJointeDossier {
  idPiece?: number;
  idDossier: number;
  idTypePiece: number;
  libellePiece?: string;
  nomFichier?: string;
  format?: string;
  taille?: number;
  dateUpload?: string;
  apresLettreRenvoi?: boolean;
  idLettre?: number;
}

/** Lot d'un marché. */
export interface Lot {
  idLot: number;
  idDossier: number;
  idDetail: number;
  designationLot: string;
  montLot?: number;
  qteLot?: number;
  uniteLot?: string;
}

/** Tranche d'un lot. */
export interface Tranche {
  idTranche: number;
  lieuTrc?: string;
  montTrc?: number;
  idLot: number;
}

/** Service bénéficiaire d'un détail de marché (compte + montants propres au bénéficiaire). */
export interface ServiceBeneficiaire {
  idBenef: number;
  ancMontBenef?: number;
  nouvMontBenef?: number;
  soaCode?: string;
  /** Compte budgétaire du bénéficiaire (FK `tr_compte`) — par bénéficiaire, cf. « COMPTE » du PPM. */
  numCompte?: string;
  idDetail: number;
}

/** SOA bénéficiaire (référentiel léger). PK = soaCode. */
export interface SoaBeneficiaire {
  soaCode: string;
  libelle?: string;
}

/** Affectation d'une PRMP à une entité contractante. */
export interface PrmpEntite {
  idPrmpEntite: number;
  idPrmp: string;
  idEntiteContract: number;
  dateAffectation?: string;
  actif: boolean;
}

/**
 * Façade de saisie (`/api/saisies`, réservée PRMP). « Saisir » crée le dossier en
 * BROUILLON + son contenu en une transaction. Les endpoints bruts dossiers/ppms
 * sont réservés ADMIN ; côté PRMP on passe toujours par ces requêtes.
 */

/**
 * Bénéficiaire (ventilation par service) d'une ligne de marché à la saisie (`POST /api/saisies/ppm`).
 * Le serveur résout-ou-crée `soaCode` (`tr_soa_beneficiaire`) et `numCompte` (`tr_compte`) à la volée
 * et crée une ligne `t_service_beneficiaire`. Cohérence : `Σ ancMontBenef = montEstim` du marché
 * (et `Σ nouvMontBenef = nouvMontEstim` si fourni) — validée serveur quand la liste est non vide.
 */
export interface SaisieMarcheBeneficiaire {
  soaCode?: string;
  numCompte?: string;
  /** Montant estimatif (initial) par bénéficiaire. */
  ancMontBenef?: number;
  /** Nouveau montant estimatif par bénéficiaire. */
  nouvMontBenef?: number;
}

/**
 * Ligne de marché d'une saisie PPM. Le service renseigne idDossier/idPpm/idMode (mode auto).
 * `idDetail` : null à la création (PK serveur) ; renseigné seulement en édition (réconciliation).
 */
export interface SaisieMarcheLigne {
  idDetail?: number;
  designationMarche?: string;
  numCompte?: string;
  montEstim?: number;
  /** Nouveau montant estimatif du marché (versioning) — `t_marche.NOUV_MONT_ESTIM`. */
  nouvMontEstim?: number;
  financement?: string;
  statut?: string;
  idNature?: number;
  /** Libellé de nature (import) quand `idNature` n'est pas résolu → le serveur crée/résout à la volée. */
  natureLibelle?: string;
  idMode?: number; // mode de passation choisi par la PRMP (FK tr_mode) ; conservé tel quel
  /** Libellé de mode (import) quand `idMode` n'est pas résolu → le serveur crée/résout à la volée. */
  modeLibelle?: string;
  /** Ventilation par bénéficiaire (SOA + montants) — le serveur crée une `t_service_beneficiaire` par élément. */
  beneficiaires?: SaisieMarcheBeneficiaire[];
  /**
   * Processus prévisionnels du marché — **au moins un obligatoire à la création** (`POST /api/saisies/ppm`) ;
   * le serveur crée une ligne `t_marche_prevision` par processus.
   */
  processus?: ProcessusMarche[];
}

/**
 * Corps de `POST /api/saisies/ppm` : crée dossier (type PPM, BROUILLON) + PPM + lignes.
 * `idLocalite` n'est pas un champ d'entrée : dérivé de l'ENTITÉ choisie côté serveur.
 * `idDossier`/`idPpm` non envoyés : attribués par une séquence serveur.
 * `reference` et `signataire` ne sont plus saisis : générés serveur (référence dérivée de l'entité,
 * signataire = PRMP connectée) et exposés en sortie dans `PpmDto`.
 */
export interface SaisiePpmRequest {
  idEntiteContract: number;
  exercice: number;
  dateSignature: string;
  marches?: SaisieMarcheLigne[];
}

/**
 * Corps de `POST /api/saisies/dossier` : DAO/MAOO (sans PPM). `idTypeDossier` ≠ `PPM` (sinon 409).
 * `idLocalite` dérivé de l'ENTITÉ choisie côté serveur (non envoyé) ; `idDossier` attribué serveur.
 */
export interface SaisieDossierRequest {
  idTypeDossier: string;
  idEntiteContract: number;
}

/** Bénéficiaire extrait d'un PPM PDF (import read-only ; pas encore consommé par la création). */
export interface SaisieImportBeneficiaire {
  soaCode?: string;
  numCompte?: string;
  ancMontBenef?: number;
  nouvMontBenef?: number;
}

/** Prévision (jalon) extraite d'un PPM PDF. `processus` = LANCEMENT / OUVERTURE / ATTRIBUTION… */
export interface SaisieImportPrevision {
  processus?: string;
  dateDebut?: string;
}

/** Ligne de marché extraite d'un PPM PDF (best-effort ; `idNature`/`idMode` résolus ou libellé seul). */
export interface SaisieImportMarche {
  designationMarche?: string;
  montEstim?: number;
  nouvMontEstim?: number;
  idNature?: number;
  natureLibelle?: string;
  idMode?: number;
  modeLibelle?: string;
  financement?: string;
  beneficiaires?: SaisieImportBeneficiaire[];
  previsions?: SaisieImportPrevision[];
}

/**
 * Résultat **read-only** de `POST /api/saisies/ppm/import` (parsing d'un PPM PDF, PDFBox).
 * Pré-remplit le formulaire de saisie **sans rien créer**. En-tête + entité fiables ; tableau des
 * marchés best-effort (référentiels non résolus → libellé seul + `avertissements`).
 */
export interface SaisiePpmImportResult {
  exercice?: number;
  dateSignature?: string;
  autoriteContractante?: string;
  idEntiteContract?: number;
  marches?: SaisieImportMarche[];
  avertissements?: string[];
}
