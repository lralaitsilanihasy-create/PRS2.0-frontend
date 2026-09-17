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

/** Réponse de `GET /api/kpis/mes-compteurs` (PRMP) — compteurs par section du menu, filtrés sur la PRMP (JWT). */
export interface CompteursPrmp {
  brouillons: number;
  ppmMarches: number;
  dossiersARectifier: number;
  dossiersVerifies: number;
  /**
   * Lettres de renvoi SIGNE que **l'agent connecté** n'a pas encore lues.
   * ⚠️ Règle modifiée (2026-08-27) — décompte par agent : la consultation par une UGPM ne
   * décrémente plus le compteur de sa PRMP de tutelle.
   */
  lettresRenvoi: number;
  /** Demandes passées à ACCEPTEE/REFUSEE depuis ma dernière consultation de l'écran. */
  demandesRetraitNouvelles: number;
}

/**
 * Réponse de `GET /api/kpis/mes-compteurs-verificateur` (VERIFICATEUR) — miroir exact de ses trois
 * files, scopé à sa localité par le serveur.
 */
export interface CompteursVerificateur {
  /**
   * Dossiers sur lesquels le vérificateur a encore une action : EN_VERIFICATION,
   * EN_ATTENTE_DECISION_PRMP ou OBSERVATIONS_LEVEES. ⚠️ Un dossier en sort dès la transmission de la
   * décision à SIGMP (il bascule alors dans `verifies`).
   */
  aVerifier: number;
  /** Dossiers DECISION_TRANSMISE_SIGMP ou CLOTURE avec PV signé. */
  verifies: number;
  enAttentePrmp: number;
}

/**
 * `GET /api/kpis/badges` — compteurs de menu agrégés en UN appel, par profil du connecté
 * (livraison backend c16407f). Les clés de `compteurs` dépendent du profil :
 * PRMP → clés de `CompteursPrmp` ; PRESIDENT / CHEF_COMMISSION → predispatch, dispatch,
 * projetsPV, lettresRenvoi, pvDefinitifs, demandesRetrait ; SECRETAIRE → aReceptionner,
 * receptions ; VERIFICATEUR → clés de `CompteursVerificateur`.
 */
export interface BadgesMenu {
  profil: string;
  compteurs: Record<string, number>;
  /**
   * Gestes attendus du connecté — même calcul que `compteurs.aFaire` de `GET /api/dossiers/a-faire`
   * (demande 2026-09-14-accueil-a-faire, §5). Absent tant que le backend ne le sert pas, `null` pour
   * l'Administrateur et le Chargé de publication : pas de pastille dans ces cas.
   */
  aFaire?: number | null;
}

/**
 * `compteurs` de `GET /api/kpis/badges` **pour l'ADMINISTRATEUR** (`CompteursAdminDto`, livraison
 * backend B1 du 2026-09-17). Il alimente l'accueil de l'Administrateur.
 *
 * ⚠️ Il ne rentre **pas** dans `BadgesMenu.compteurs` (`Record<string, number>`) : deux de ses champs
 * sont des dates. D'où `BadgesAdmin`, vue typée de la **même** réponse — pas une seconde route.
 *
 * ⚠️ **2026-09-17 (B4)** — `sessionsOuvertes` et `echecsConnexion24h` sont **servis** : le journal des
 * connexions existe (`t_session_utilisateur` alimentée au login et au logout, migration `V31`). Ce
 * sont les deux tuiles que l'accueil refusait d'afficher faute de source.
 */
export interface CompteursAdmin {
  /**
   * Inscriptions en attente de validation. ⚠️ 2026-09-17 — périmètre **PRMP et UGPM** (et non plus
   * PRMP seul) : le badge compte ce que l'écran des inscriptions liste. Ce nombre a donc pu augmenter
   * sans qu'aucune inscription n'ait été déposée — ce sont les UGPM jusqu'ici invisibles.
   */
  inscriptionsEnAttente: number;
  /** Déclarations de rattachement PRMP⇄entité non décidées. */
  rattachementsEnAttente: number;
  /**
   * Dépôt de la plus ancienne inscription encore en attente ; `null` si la file est vide.
   * ⚠️ **Dérivée** (première pièce jointe déposée) tant que `t_compte_auth` n'a pas de date de
   * demande — migration V29 attendue, cf. demande backend §B4.
   */
  inscriptionDoyenneLe: string | null;
  /**
   * Première déclaration de rattachement encore en attente ; `null` si la file est vide.
   * ⚠️ **À minuit** : `DATE_DECLARATION` est une date, pas un instant. L'ancienneté de cette file se
   * lit donc en JOURS — l'exprimer en heures inventerait une précision que la donnée n'a pas.
   */
  rattachementDoyenLe: string | null;
  /** Total des comptes d'authentification (tous statuts confondus). */
  comptes: number;
  /** Comptes connectables (`t_compte_auth.ACTIF = true`). */
  comptesActifs: number;
  /**
   * Comptes validés puis **fermés** par l'Administrateur. ⚠️ Les inscriptions **refusées** n'y sont
   * pas comptées : ce n'est pas le même état, et cette tuile est une mesure de sécurité.
   */
  comptesSuspendus: number;
  /** Mandats PRMP non abrogés dont le terme tombe dans les 30 jours. */
  mandatsExpirantSous30j: number;
  /** Nombre total d'entrées du journal d'audit. */
  journalAudit: number;
  /**
   * Connexions **réussies** jamais fermées **et datant de moins de 12 heures**.
   *
   * ⚠️ La borne de 12 h n'est pas un détail d'implémentation, c'est la définition : une session
   * n'est fermée que par une déconnexion explicite, or la plupart des utilisateurs ferment
   * simplement leur onglet. Sans elle, le compteur ne redescendrait jamais. L'écran doit donc le
   * DIRE, sous peine d'être lu comme « personnes actuellement connectées ».
   */
  sessionsOuvertes: number;
  /**
   * Tentatives de connexion **refusées** des 24 dernières heures, identifiants inconnus compris.
   * Les refus du quota (429) n'y figurent pas : ils n'examinent aucun identifiant et ne sont pas
   * journalisés.
   */
  echecsConnexion24h: number;
}

/** `GET /api/kpis/badges` vu par l'Administrateur — même réponse que `BadgesMenu`, `compteurs` typé. */
export interface BadgesAdmin {
  profil: string;
  compteurs: CompteursAdmin;
  /** `null` pour l'Administrateur (il n'a pas de file de dossiers). */
  aFaire?: number | null;
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
