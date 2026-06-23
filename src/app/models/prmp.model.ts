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
  idSituation?: number;
  idNature?: number;
  idMode?: number;
}

/** Type de date prévisionnelle d'un marché (valeurs contrôlées). */
export type TypeDatePrevision = 'LANCEMENT' | 'DAO' | 'OUVERTURE' | 'ATTRIBUTION';

/** Date prévisionnelle d'un marché (relation 1,N avec Marché via idDetail). */
export interface MarchePrevision {
  idPrevision: number;
  /** FK vers le marché (Marche.idDetail). */
  idDetail: number;
  typeDate: TypeDatePrevision;
  datePrev?: string;
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

/** Service bénéficiaire d'un détail de marché. */
export interface ServiceBeneficiaire {
  idBenef: number;
  ancMontBenef?: number;
  nouvMontBenef?: number;
  soaCode?: string;
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
 * Ligne de marché d'une saisie PPM. Le service renseigne idDossier/idPpm/idMode (mode auto).
 * `idDetail` : null à la création (PK serveur) ; renseigné seulement en édition (réconciliation).
 */
export interface SaisieMarcheLigne {
  idDetail?: number;
  designationMarche?: string;
  numCompte?: string;
  montEstim?: number;
  financement?: string;
  statut?: string;
  idSituation?: number;
  idNature?: number;
  idMode?: number; // mode choisi par la PRMP (facultatif) ; absent → recommandé serveur
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
