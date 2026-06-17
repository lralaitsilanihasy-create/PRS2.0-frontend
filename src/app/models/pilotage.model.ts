/** Transverse & pilotage : messagerie, notifications, échéances, indicateurs, KPIs. */

/** Message interne. Confidentialité : expéditeur ou destinataire uniquement. */
export interface Message {
  idMessage: number;
  idDossier?: number;
  /** Forcé à l'utilisateur courant à l'envoi. */
  expediteurIm: string;
  destinataireIm: string;
  sujet?: string;
  corps?: string;
  dateEnvoi?: string;
  lu?: boolean;
  idMessageParent?: number;
}

/** Corps de `POST /api/messages/envoyer` (id et expéditeur générés côté serveur). */
export interface MessageEnvoiRequest {
  destinataireIm: string;
  sujet?: string;
  corps?: string;
  idDossier?: number;
  idMessageParent?: number;
}

/** Notification système (normalement créée automatiquement). */
export interface Notification {
  idNotification: number;
  idDossier?: number;
  typeNotif: string;
  destinataireIm?: string;
  destinataireEmail?: string;
  /** Clé unifiée du destinataire (matricule ou id PRMP). */
  destinataireRef?: string;
  /** `CONTROLEUR` / `PRMP`. */
  destinataireType?: string;
  /** Objet concerné (selon `typeObjet`). */
  idObjet?: number;
  /** `DOSSIER` / `PV` / `MESSAGE`. */
  typeObjet?: string;
  titre?: string;
  corps?: string;
  dateEnvoi?: string;
  lu?: boolean;
  dateLecture?: string;
  canal?: string;
}

/** Échéance / jalon d'un marché. */
export interface Echeance {
  idEcheance: number;
  idDetail: number;
  typeJalon: string;
  datePrevue: string;
  dateReelle?: string;
  statutJalon?: string;
  ecartJours?: number;
  alerteEnvoyee?: boolean;
}

/** Anomalie détectée. */
export interface Anomalie {
  idAnomalie: number;
  idDetail?: number;
  idPpm?: number;
  idRegleAnomalie: number;
  typeAnomalie?: string;
  gravite?: string;
  description?: string;
  dateDetection?: string;
  source?: string;
  statut?: string;
  imTraitement?: string;
  dateTraitement?: string;
  commentaireTraitement?: string;
}

/** Indicateur de performance d'un contrôleur (par période). */
export interface IndicateurCtrl {
  idIndicateur: number;
  imControleur: string;
  periode: string;
  nbExamens?: number;
  nbConformes?: number;
  delaiMoyenExamen?: number;
  nbObsEmises?: number;
}

/** Indicateur de performance d'une PRMP (par exercice). */
export interface IndicateurPrmp {
  idIndicateurPrmp: number;
  idPrmp: string;
  exercice: number;
  nbPpmSoumis: number;
  nbDossiersSoumis: number;
  nbDossiersConformes: number;
  nbDossiersNonConformes: number;
  nbRetours: number;
  nbRetraits: number;
  tauxConformite?: number;
  delaiMoyCorrectionJours?: number;
  montTotalSoumis?: number;
  dateMaj?: string;
}

/** Instantané de statistiques agrégées (par localité × exercice). */
export interface SnapshotStats {
  idSnapshot: number;
  dateSnapshot: string;
  idLocalite?: string;
  exercice: number;
  nbDossiersRecus?: number;
  nbDossiersClotures?: number;
  nbDossiersEnCours?: number;
  tauxConformite?: number;
  delaiMoyenJours?: number;
  montTotalControle?: number;
  nbRetoursMoyen?: number;
}

/** Un point de contrôle dans le top non-conformité du tableau de bord. */
export interface PointNonConformite {
  idPointCtrl: number;
  libelle: string;
  nbTotal: number;
  nbNonConforme: number;
  tauxNonConformitePct: number;
}

/** Réponse de `GET /api/kpis/tableau-bord` (PRESIDENT / ADMINISTRATEUR). */
export interface TableauBord {
  /** Nombre de dossiers par statut. */
  pipelineParStatut: Record<string, number>;
  nbDossiersSoumis: number;
  nbDossiersConformes: number;
  tauxConformitePct: number;
  topNonConformite: PointNonConformite[];
}
