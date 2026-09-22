/** Comptes et hiérarchie (gestion ADMINISTRATEUR, lecture ouverte). */

/** Contrôleur (compte interne CNM). PK = imControleur (matricule). */
import { Role } from './common.model';

export interface Controleur {
  imControleur: string;
  nomCont?: string;
  prenomsCont?: string;
  emailCont?: string;
  telCont?: string;
  idProfile?: number;
  /** `null` = toutes localités (cas Président). */
  idLocalite?: string | null;
  idSuperieur?: string;
  transversal: boolean;
  /**
   * ⚠️ Intérim désigné (2026-09-21, backend `e867082`) — titulaire ABSENT : qui le supplée aujourd'hui (intérim ACTIF) ;
   * `null` sinon, et TOUJOURS pour la PRMP et l'UGPM (règle C2 : qui supplée qui est interne à la Commission).
   */
  interimEnCours?: InterimEnCours | null;
  /** Intérimaire : les titulaires qu'il supplée aujourd'hui ; `null` pour la PRMP et l'UGPM. */
  interimPour?: InterimPour[] | null;
}

/**
 * ⚠️ Rattachements (2026-09-01) — chaînes **Membre → Vérificateur → Assistant** qui routent la
 * boucle FAVR post-visa (vérification/validation SIGMP par le Vérificateur rattaché au Membre
 * examinateur, archivage par l'Assistant rattaché à ce Vérificateur). CIBLAGE de files, PAS une
 * garde : un collègue de la localité peut toujours agir. Distinct d'`idSuperieur` (hiérarchie).
 * `profilAttendu` (VERIFICATEUR pour un Membre, ASSISTANT_CONTROLEUR pour un Vérificateur) est
 * résolu serveur pour peupler la liste de choix sans rejouer la règle côté front.
 */
export interface RattachementDto {
  imControleur: string;
  nomControleur?: string;
  profil: 'MEMBRE' | 'VERIFICATEUR' | (string & {});
  idLocalite?: string | null;
  /** Rattaché courant — `null` = chaîne incomplète (état NORMAL : repli localité, pas une erreur). */
  imRattache?: string | null;
  nomRattache?: string | null;
  profilAttendu: 'VERIFICATEUR' | 'ASSISTANT_CONTROLEUR' | (string & {});
}

/** Fiche de la personne PRMP. PK = `idPrmp` = **matricule** (identifiant unifié, comme les contrôleurs). */
/** Statut d'un mandat PRMP — dérivé serveur à la date du jour (`ABROGE` prime, sinon la période décide). */
export type StatutMandat = 'ACTIF' | 'EN_TRANSITION' | 'ACHEVE' | 'ABROGE';

/**
 * Mandat PRMP (`/api/mandats`, t_mandat) — l'HABILITATION (3 ans, renouvelable une fois), distincte de
 * l'attribution des dossiers (figée). Une reconduction est un mandat DISTINCT (nouvel arrêté, numeroMandat 2) ;
 * ni PUT ni DELETE. `implicite: true` = mandat reconstitué depuis t_prmp (DATE_NOMIN + 3 ans, sans idMandat).
 */
export interface Mandat {
  idMandat: number | null;
  idPrmp: string;
  /** Nom figé à la nomination. */
  titulaire?: string;
  dateDebut: string;
  dateFin: string;
  refArrete?: string;
  statut: StatutMandat;
  /** 1 (initial) ou 2 (reconduction) — calculé serveur. */
  numeroMandat?: number;
  dateAbrogation?: string;
  motifAbrogation?: string;
  implicite?: boolean;
}

/** Corps de `POST /api/mandats` (ADMIN) — `numeroMandat` et le statut sont calculés serveur. */
export interface CreerMandatRequest {
  idPrmp: string;
  refArrete: string;
  dateDebut: string;
  dateFin?: string;
  titulaire?: string;
}

/** Corps de `POST /api/mandats/{id}/abroger` (ADMIN). */
export interface AbrogerMandatRequest {
  motif: string;
  dateAbrogation?: string;
}

export interface Prmp {
  /** = matricule de la PRMP (identifiant unifié). */
  idPrmp: string;
  nomPrmp: string;
  prenomsPrmp: string;
  arreteNomin: string;
  dateNomin: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailPrmp: string;
  telPrmp: string;
  // Pas d'idLocalite : la PRMP n'a pas de localité propre (dérivée de l'entité du dossier).
}

/**
 * Corps de `POST /api/prmps` (Admin) : `PrmpDto` + **compte optionnel** (`login`/`motDePasse`).
 * Fournis **ensemble** → crée aussi le compte PRMP **actif** (parité UGPM, connectable de suite).
 * Un seul des deux → **400** ; `idPrmp` ou `login` déjà pris → **409**.
 */
export interface CreerPrmpRequest extends Prmp {
  login?: string;
  motDePasse?: string;
}

/**
 * UGPM (Unité de Gestion de la Passation des Marchés), rattachée à **une** PRMP de tutelle.
 * `GET /api/ugpms` → `UgpmDto[]` (Admin). PK = idUgpm (string).
 */
export interface Ugpm {
  /** = matricule de l'UGPM (identifiant unifié, comme les contrôleurs). */
  idUgpm: string;
  libelle?: string;
  /** PRMP de tutelle (= matricule de la PRMP). */
  idPrmpTutelle: string;
  // Identité (alignée PRMP, sans arrêté/date de nomination) — champs obligatoires.
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  /** Login du compte associé, exposé en **lecture seule** (jamais le mot de passe) ; pré-remplit la réinitialisation. */
  login?: string;
}

/**
 * Corps de `POST /api/ugpms` (Admin) : crée l'UGPM **et** son compte d'authentification actif
 * (TYPE_ACTEUR='UGPM'). 409 si idPrmpTutelle inconnue, idUgpm déjà pris, ou login déjà utilisé ;
 * 400 si un champ d'identité obligatoire manque.
 */
export interface CreerUgpmRequest {
  /** = matricule de l'UGPM (identifiant unifié). */
  idUgpm: string;
  libelle?: string;
  idPrmpTutelle: string;
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
  login: string;
  motDePasse: string;
}

/**
 * Corps de `PUT /api/ugpms/{id}` (Admin) — **champs métier éditables uniquement** : ni `idUgpm`
 * (matricule, porté par l'URL), ni le compte (login/motDePasse). 404 si UGPM inconnue ;
 * 409 si la nouvelle `idPrmpTutelle` est inconnue (réaffectation possible).
 */
export interface ModifierUgpmRequest {
  libelle?: string;
  idPrmpTutelle: string;
  nomUgpm: string;
  prenomsUgpm: string;
  cin: string;
  dateCin: string;
  lieuCin: string;
  emailUgpm: string;
  telUgpm: string;
}

/** Organigramme d'un ministère. */
export interface Organigramme {
  idOrganigramme: number;
  idMinistere: number;
  libelle?: string;
  version?: string;
  dateValidation?: string;
  actif: boolean;
}

// ── Intérim désigné ───────────────────────────────────────────────────────────────────────────────

/** Dérivé SERVEUR à la date du jour, jamais reçu ni stocké : `REVOQUE` prime, puis la période décide. */
export type StatutInterim = 'A_VENIR' | 'ACTIF' | 'ACHEVE' | 'REVOQUE';
export type MotifInterim = 'CONGE' | 'MISSION' | 'MALADIE' | 'VACANCE_POSTE' | 'AUTRE';

/**
 * Intérim désigné (`/api/interims`, `t_interim` + `t_interim_piece` — demande 2026-09-21, backend `e867082`,
 * ADR-0008) : « X (titulaire) est absent du D1 au D2 ; Y (intérimaire) agit à sa place, dans SON périmètre, sous
 * sa PROPRE identité ». Lot 1 : le titulaire est un Président (← tout CC) ou un CC (← autre CC de la Centrale,
 * ou Membre de sa localité). Acte daté, jamais modifié ni effacé : ni PUT ni DELETE, une fin avant terme est une
 * révocation. Le titulaire désigne lui-même, l'Administrateur en repli.
 */
export interface Interim {
  idInterim: number;
  imTitulaire: string;
  /** Nom FIGÉ à la désignation (« NOM Prénoms »). */
  nomTitulaire: string;
  profilTitulaire: Role;
  /** `null` pour le Président. */
  idLocaliteTitulaire: string | null;
  imInterimaire: string;
  nomInterimaire: string;
  profilInterimaire: Role;
  idLocaliteInterimaire: string | null;
  /** Période INCLUSIVE ; `dateFin` obligatoire sauf `VACANCE_POSTE`. */
  dateDebut: string;
  dateFin: string | null;
  motif: MotifInterim;
  /** Note de service / décision de désignation. */
  reference: string;
  pieceNom: string | null;
  /** La pièce PDF (obligatoire) se lit par `GET /{id}/piece` — 403 PRMP/UGPM. */
  pieceDisponible: boolean;
  designePar: string;
  nomDesignePar: string | null;
  dateDesignation: string;
  statut: StatutInterim;
  dateRevocation: string | null;
  motifRevocation: string | null;
  revoquePar: string | null;
  /** Réponse du POST seulement : cumuls signalés (déjà intérimaire ailleurs, déjà attributaire) — jamais un refus. */
  avertissements?: string[] | null;
}

/** `GET /api/interims/mes` — le SIGNAL du front : qui je supplée, qui me supplée, ce qui vient. */
export interface MesInterims {
  /** ACTIFS où je suis l'intérimaire. */
  exerces: Interim[];
  /** ACTIF où je suis le titulaire ; `null` sinon. */
  subi: Interim | null;
  /** A_VENIR, titulaire ou intérimaire. */
  aVenir: Interim[];
}

/** Corps (partie `data`) de `POST /api/interims` — la pièce PDF est la partie `piece` du multipart. */
export interface CreerInterimRequest {
  imTitulaire: string;
  imInterimaire: string;
  dateDebut: string;
  /** Obligatoire sauf `VACANCE_POSTE` (400 sinon). */
  dateFin?: string;
  motif: MotifInterim;
  reference: string;
}

/** Corps de `POST /api/interims/{id}/revoquer` — jamais antérieure à aujourd'hui, jamais après `dateFin`. */
export interface RevoquerInterimRequest {
  motif: string;
  dateRevocation?: string;
}

/** `ControleurDto.interimEnCours` — le titulaire est absent : qui le supplée, jusqu'à quand. */
export interface InterimEnCours {
  idInterim: number;
  imInterimaire: string;
  nomInterimaire: string;
  dateFin: string | null;
}

/** `ControleurDto.interimPour` — l'intérimaire : qui il supplée, jusqu'à quand. */
export interface InterimPour {
  idInterim: number;
  imTitulaire: string;
  nomTitulaire: string;
  dateFin: string | null;
}
