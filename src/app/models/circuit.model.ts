import {
  Role,
  StatutDossier,
  StatutPv,
  SensNavette,
  StatutDemandeRetrait,
  TypePassage,
  PvSignataireRole,
} from './common.model';

/**
 * Résultat **allégé** de la résolution d'une référence (`GET /api/dossiers/recherche?q=`).
 *
 * Volontairement plus pauvre que `Dossier` : une recherche par référence n'a pas à divulguer la
 * localité, la PRMP propriétaire ni les auteurs. Ne porte que de quoi afficher un résultat et y
 * naviguer — `idTypeDossier` et `statut` désignent la liste de destination (type × groupe).
 */
export interface RechercheDossier {
  idDossier: number;
  /** Référence officielle du dossier, posée à la réception (`null` avant). */
  refeDossier: string | null;
  /** Référence **affichée** et effectivement cherchée : `refeDossier`, sinon celle du PPM rattaché. */
  reference: string | null;
  idTypeDossier: string | null;
  statut: StatutDossier;
}

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
  /**
   * ⚠️ Rattachements (2026-09-01) — Vérificateur CIBLE de la boucle FAVR post-visa : le rattaché du
   * Membre EXAMINATEUR (pas le co-signataire), résolu serveur, présent en unitaire ET en liste.
   * `null` = chaîne incomplète, repli localité — état NORMAL, aucun badge. ⚠️ Ciblage SANS garde :
   * tout Vérificateur de la localité peut agir — ne JAMAIS griser l'action d'un dossier « d'autrui »,
   * ce serait inventer une règle que le serveur n'applique pas.
   */
  imVerificateurCible?: string | null;
  /** Nom complet du Vérificateur cible, résolu serveur. */
  nomVerificateurCible?: string | null;
  /** Assistant CIBLE de l'archivage (rattaché du Vérificateur ayant validé) — mêmes règles : null normal, ciblage sans garde. */
  imAssistantCible?: string | null;
  /** Nom complet de l'Assistant cible, résolu serveur. */
  nomAssistantCible?: string | null;
  /**
   * ⚠️ Chronométrage (2026-09-01, backend `c66db71`) — date prévisionnelle d'achèvement du
   * traitement CNM, **calculée serveur** en jours ouvrés (aujourd'hui + reste de l'étape en cours +
   * prévisions des étapes restantes ; une étape en dépassement compte 0 : la date GLISSE au lieu de
   * mentir). `null` hors circuit (brouillon, clos, retiré). Présente en unitaire ET en liste,
   * résolue en lot serveur. Aucun calcul de date côté front.
   */
  datePrevisionnelleFin?: string | null;
  /** Vrai quand la balle est CHEZ LA PRMP (statut suspensif) : la date prévisionnelle glisse d'autant. */
  attentePrmp?: boolean;
  /** Étape de circuit ouverte (`EtapeCircuit`) ; `null` si aucune tâche CNM ne court. */
  etapeCourante?: EtapeCircuit | null;
  /** Verrou optimiste : à renvoyer telle quelle au PUT (périmée → 409 `CONFLIT_VERSION`) ; absente = dernier écrit gagne. */
  version?: number;
}

// ─── Chronométrage et prévision des délais (règle du pilote 2026-09-01, backend `c66db71`) ───────

/**
 * Les huit étapes chronométrées du circuit, dans l'ordre de parcours. La vérification et la
 * transmission SIGMP sont DEUX étapes (EN_ATTENTE_DECISION_PRMP tombe entre les deux actes) ;
 * ARCHIVAGE est chronométrée mais HORS compteur global (la règle arrête le chronomètre à la
 * validation sur SIGMP).
 */
export type EtapeCircuit =
  | 'RECEPTION'
  | 'DISPATCH'
  | 'EXAMEN'
  | 'VISA'
  | 'COSIGNATURE'
  | 'VERIFICATION'
  | 'TRANSMISSION_SIGMP'
  | 'ARCHIVAGE';

/** Libellés d'affichage des étapes (le référentiel des délais sert aussi les siens, `libelle`). */
export const ETAPE_CIRCUIT_LABELS: Record<EtapeCircuit, string> = {
  RECEPTION: 'Réception & enregistrement',
  DISPATCH: 'Dispatch',
  EXAMEN: 'Examen',
  VISA: 'Visa',
  COSIGNATURE: 'Co-signature',
  VERIFICATION: 'Vérification',
  TRANSMISSION_SIGMP: 'Transmission SIGMP',
  ARCHIVAGE: 'Archivage',
};

/**
 * Profil NOMINAL porteur de chaque étape (miroir de `EtapeCircuit.porteur()` serveur) — sert à
 * MONTRER le bouton « Prendre en charge » au bon profil ; délégations résolues par
 * `PermissionsService.peutExecuter`, la garde qui tranche reste le serveur (403).
 */
export const ETAPE_CIRCUIT_PORTEURS: Record<EtapeCircuit, Role> = {
  RECEPTION: 'SECRETAIRE',
  DISPATCH: 'CHEF_COMMISSION',
  EXAMEN: 'MEMBRE',
  VISA: 'CHEF_COMMISSION',
  COSIGNATURE: 'MEMBRE',
  VERIFICATION: 'VERIFICATEUR',
  TRANSMISSION_SIGMP: 'VERIFICATEUR',
  ARCHIVAGE: 'ASSISTANT_CONTROLEUR',
};

/**
 * Une occurrence de tâche chronométrée. Append-only : un réexamen, une navette de visa, un passage
 * FAVR supplémentaire créent chacun une occurrence de plus (`occurrence` = 1, 2, 3…) — c'est ce qui
 * rend visible le nombre d'aller-retours.
 */
export interface TacheDossier {
  etape: EtapeCircuit;
  occurrence: number;
  imActeur?: string | null;
  /** « prénoms nom » résolu serveur ; null si matricule inconnu. */
  nomActeur?: string | null;
  /** Profil sous lequel l'acteur a agi (délégation / intérim compris). */
  profil?: string | null;
  /** Horodatage à la seconde ; = `fin` (durée nulle) quand le geste a été posé sans prise en charge. */
  priseEnCharge?: string | null;
  /** `null` tant que la tâche est en cours. */
  fin?: string | null;
  /** ⚠️ HEURES ouvrées depuis le 02/09 (backend `c8d987a`) : 8 h = 1 jour ouvré. */
  previsionHeures?: number | null;
  /** Vrai si la prévision vient du référentiel des délais standards, pas d'une saisie. */
  previsionStandard: boolean;
  /**
   * Durée effective en HEURES ouvrées (fenêtre de service 08 h-16 h côté serveur — même échelle
   * que la prévision) ; pour une tâche en cours, le temps déjà écoulé.
   */
  dureeHeuresOuvrees: number;
  enCours: boolean;
}

/** `GET /api/dossiers/{id}/chronometrage` — matière de la frise (occurrences + compteurs globaux). */
export interface Chronometrage {
  idDossier: number;
  /** De la plus ancienne à la plus récente. */
  taches: TacheDossier[];
  /** Clôture de RECEPTION (enregistrement) ; null si pas encore atteinte. */
  debutCompteur?: string | null;
  /** Clôture de TRANSMISSION_SIGMP ; null tant que le dossier court. */
  finCompteur?: string | null;
  /** Compteur BRUT (heures ouvrées) : enregistrement → SIGMP, à la lettre de la règle. */
  dureeBruteHeuresOuvrees: number;
  /** Compteur NET CNM (heures ouvrées) : le brut moins les attentes PRMP — c'est lui qui juge la CNM. */
  dureeNetteHeuresOuvrees: number;
  /** Cumul des fenêtres où la balle était chez la PRMP (heures ouvrées). */
  attentePrmpHeuresOuvrees: number;
  etapeCourante?: EtapeCircuit | null;
  attentePrmp: boolean;
  datePrevisionnelleFin?: string | null;
  /**
   * Attributaire courant du dossier (`imCtrlMembre` du dispatch, réattributions comprises) — la
   * prise en charge d'EXAMEN lui est réservée (`5225529`, 403 même par délégation). ⚠️ Champ
   * DEMANDÉ au backend (demande-backend-2026-09-04-chronometrage-attributaire.md) : absent tant
   * que non livré — le widget replie alors sur la règle du porteur nominal.
   */
  attributaire?: string | null;
}

/**
 * Corps de `POST /api/dossiers/{id}/prise-en-charge` — rejoué sur une tâche ouverte, il CORRIGE la
 * prévision. ⚠️ `previsionJours` (unité d'avant le 02/09) part en 400 explicite : 5 « jours » lus
 * comme 5 heures fausseraient la date sans bruit.
 */
export interface PriseEnChargeRequest {
  /** HEURES ouvrées (8 h = 1 jour ouvré), entier ≥ 1 (400 sinon). */
  previsionHeures: number;
}

/** Délai standard d'une étape — référentiel administrable (PUT réservé à l'Administrateur). */
export interface DelaiStandard {
  etape: EtapeCircuit;
  /** HEURES ouvrées (8 h = 1 jour ouvré), ≥ 1 (400 sinon) ; repli serveur à 8 h si l'étape manque. */
  delaiHeures: number;
  /** Libellé d'affichage, servi par le backend. */
  libelle?: string;
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
  /**
   * Date et heure de **pré-dispatch** = réception du dossier par le secrétaire (la plus récente
   * du dossier), au format `yyyy-MM-dd HH:mm`. Posée par le serveur, **lecture seule** ;
   * `undefined` si le dossier n'a encore aucune réception.
   */
  datePredispatch?: string;
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
 * ⚠️ Visa unique (2026-08-31) — le Membre ÉMET SON AVIS à la soumission (inversion de la règle du
 * 01/08) ; cohérence validée serveur (≥ 1 observation → FAV refusé, 409). Le Secrétaire de séance
 * a DISPARU du cycle (règle du 01/09, backend `8ae307a`) : le champ n'est plus envoyé nulle part
 * (un client non à jour qui l'enverrait encore serait ignoré, jamais refusé).
 */
export interface ExamenSoumissionRequest {
  /** Avis du Membre — exigé par le front ; l'obligation serveur (400) arrive au lot 2 backend. */
  idAvis?: string;
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
  /**
   * ⚠️ Visa unique (2026-08-31) — avis ÉMIS PAR LE MEMBRE à la soumission de l'examen, modifiable
   * par le Président/CC au visa. Encore null sur les PV soumis sous la règle du 01/08 : le visa doit
   * alors le fournir (409 serveur sinon).
   */
  idAvis?: string;
  imCtrlPresident?: string;
  imCtrlCc?: string;
  imCtrlMembre: string;
  /**
   * ⚠️ HISTORIQUE — la notion de Secrétaire de séance a disparu du cycle (règle du 01/09, backend
   * `8ae307a`) : plus jamais posé, `null` sur tout PV visé depuis. Conservé en LECTURE pour les PV
   * antérieurs (un PV est un acte officiel, sa trace n'est pas réécrite) ; l'affichage est
   * conditionnel à sa présence.
   */
  idSecretaireSeance?: string;
  /** Nom complet du secrétaire de séance historique, peuplé serveur — lecture seule. */
  nomSecretaireSeance?: string;
  /**
   * ⚠️ Co-signature (backend `e8b5b2e`, 2026-08-28) — Membre DÉSIGNÉ par le Président ou le CC pour
   * signer la part Membre. À ne pas confondre avec `imCtrlMembre`, qui reste **qui a examiné** :
   * depuis cette règle, ce sont deux personnes possiblement distinctes. La part Membre appartient au
   * désigné, et à lui seul — l'attributaire n'y a plus droit du seul fait d'avoir instruit.
   * `null` sur les PV signés avant la règle (le PV 2, notamment) : trace correcte, non reconstituée.
   */
  imMembreCoSignataire?: string;
  /** Nom complet du Membre co-signataire, peuplé serveur — évite un appel pour l'afficher. */
  nomMembreCoSignataire?: string;
  /**
   * ⚠️ Navette à DEUX NIVEAUX (2026-09-04, backend `f648254`) — dossier dispatché Président → CC
   * puis réattribué CC → Membre : niveau courant de la navette. `'CC'` = le PV est chez le Chef de
   * commission (accepter/retourner) ; `'PRESIDENT'` = transmis au Président (viser/retourner au
   * CC) ; absent = navette SIMPLE (contrat inchangé). C'est LUI qui décide du panneau à ouvrir.
   */
  niveauNavette?: 'CC' | 'PRESIDENT';
  /** CC désigné co-signataire au visa (combinaisons P+CC[+M]) — sa part CC passe par `signer(CC)`. */
  imCcCoSignataire?: string;
  nomCcCoSignataire?: string;
  /**
   * ⚠️ Visa unique (2026-08-31) — dispatcheur du dossier (`imCtrlDispatch` du dernier dispatch),
   * habilité à viser : contrainte d'IDENTITÉ qui suit QUI A POSTÉ le dispatch, pas le rang.
   * ⚠️ Intérim (2026-09-01) — l'exception : un autre P/CC DU PÉRIMÈTRE (Président partout, CC dans
   * sa localité) peut viser en joignant la note d'intérim — sans note c'est un 400 « note requise »,
   * pas un interdit ; le 403 reste pour un CC d'une autre localité (aucune note ne l'autoriserait)
   * et les profils hors P/CC. Sert à conditionner les boutons sans appel supplémentaire.
   */
  imDispatcheur?: string;
  /** Nom complet du dispatcheur, peuplé serveur — pour écrire la raison du refus aux autres P/CC. */
  nomDispatcheur?: string;
  /** ⚠️ Intérim (2026-09-01) — le visa a été posé par intérim (trace ; mention sur le document PV pour les seules localités régionales, sous « Étaient présents »). */
  viseParInterim?: boolean;
  /** Nom du fichier de la note d'intérim téléversée au visa. */
  noteInterimNom?: string;
  /** Le PDF de la note est téléchargeable (`GET /{id}/note-interim`) — contrôleurs du périmètre + Admin, 403 PRMP. */
  noteInterimDisponible?: boolean;
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
 * Corps des actions de workflow du PV (`/soumettre`, `/retourner`, `/viser`, `/signer`).
 * `commentaire` obligatoire pour `retourner` ; `role` obligatoire pour `signer` — MEMBRE seul
 * depuis le visa unique (PRESIDENT/CC y reçoivent 409 : leur part passe par `viser`).
 * ⚠️ Visa unique (2026-08-31, allégé 02/09) — pour `viser` : `imMembreCoSignataire` obligatoire
 * (400), `idAvis` optionnel (absent = avis du Membre conservé, fourni = remplacé, cohérence
 * revalidée), `imActeur` ignoré (l'acteur est la session), pas de `role` (la part signée est
 * dérivée du profil de l'acteur). Le Secrétaire de séance a disparu du cycle (backend `8ae307a`) :
 * le champ n'existe plus dans ce corps.
 */
export interface PvActionRequest {
  imActeur: string;
  commentaire?: string;
  role?: PvSignataireRole;
  idAvis?: string;
  /**
   * ⚠️ Co-signature (2026-08-28, reprise par `viser` le 31/08) — Membre appelé à co-signer,
   * obligatoire pour `viser` (400). Doit être un Membre de la localité du dossier et différent du
   * signataire : le PV est co-signé par deux personnes distinctes. Ignoré pour `signer` (MEMBRE).
   */
  imMembreCoSignataire?: string;
  /**
   * ⚠️ Navette à deux niveaux (2026-09-04) — visa du PRÉSIDENT : 1 à 2 co-signataires parmi
   * {CC du circuit, Membre examinateur, autre Membre de la centrale}. `imMembreCoSignataire` seul
   * reste accepté (rétro-compatibilité — équivaut à `[lui]`). Gardes serveur : jamais l'acteur
   * lui-même, désigné hors localité → 400.
   */
  coSignataires?: string[];
}
