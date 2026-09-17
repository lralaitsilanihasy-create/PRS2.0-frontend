import { Mandat } from './comptes.model';
import { TypeActeur } from './common.model';

/** Sécurité & administration (réservé ADMINISTRATEUR pour toutes les opérations). */

/** Entrée du journal d'audit (alimenté automatiquement ; immuable, DELETE → 409). */
export interface AuditLog {
  idLog: number;
  dateAction: string;
  imActeur?: string;
  nomTable?: string;
  idEnregistrement?: string;
  typeAction?: string;
  champModifie?: string;
  ancienneValeur?: string;
  nouvelleValeur?: string;
  ipAdresse?: string;
  sessionId?: string;
}

/**
 * Une ligne du **journal des connexions** (`GET /api/sessions`, lot 6 — besoin backend B4 livré le
 * 2026-09-17), **ADMINISTRATEUR seul** et en **lecture seule**.
 *
 * ⚠️ Elle remplace `SessionUtilisateur`, qui décrivait le CRUD `/api/session-utilisateurs`
 * **retiré** (404 désormais) : un journal de preuve que l'Administrateur pouvait écrire, corriger et
 * effacer est pire qu'absent. Ni POST, ni PUT, ni DELETE — la table n'est écrite que par
 * `POST /api/auth/login` (une ligne par tentative examinée, réussie ou refusée) et
 * `POST /api/auth/logout` (la date de fin). Voir `backend/docs/adr/ADR-0006-journal-des-connexions.md`.
 *
 * ⚠️ `idSession` n'est **pas** exposé : c'est l'empreinte SHA-256 du jeton émis, elle n'a aucun
 * usage à l'écran.
 */
export interface SessionConnexion {
  /**
   * Référence de la personne connectée (`IM_CONTROLEUR`, `ID_PRMP` ou `ID_UGPM`).
   * `null` quand la tentative a échoué sur un **login inconnu** : il n'y a alors personne à désigner
   * — et c'est précisément la ligne qu'on vient regarder.
   */
  acteur: string | null;
  /** Identifiant **tenté**, renseigné dans tous les cas (tronqué à 100 caractères par le serveur). */
  login: string;
  /** Horodatage de la tentative. */
  dateConnexion: string;
  /**
   * Fermeture par `POST /api/auth/logout` ; `null` si la session est encore ouverte — **ou** si
   * l'utilisateur a simplement fermé son onglet, ce que rien ne permet de distinguer.
   */
  dateDeconnexion: string | null;
  /** Durée de la session ; `null` tant qu'elle n'est pas fermée, et pour un échec, qui n'en a pas. */
  dureeSecondes: number | null;
  /** Adresse de l'appelant. */
  ipAdresse: string | null;
  /** Le « poste » de la maquette : l'en-tête `User-Agent` du navigateur. */
  userAgent: string | null;
  /** `true` si les identifiants ont été acceptés. */
  succes: boolean;
}

/** Filtres de `GET /api/sessions` — tous facultatifs, tous cumulables, tous appliqués au SERVEUR. */
export interface FiltresSessions {
  /**
   * Référence d'acteur **ou** login tenté (sans la casse sur le login). Les deux, parce qu'un échec
   * sur un login inconnu ne porte aucune référence : filtrer sur la seule référence masquerait ce
   * qu'on vient chercher.
   */
  acteur?: string;
  /** `true` = connexions acceptées, `false` = tentatives refusées ; absent = les deux. */
  succes?: boolean;
  /** Bornes `AAAA-MM-JJ`, **journées entières incluses** (même calcul que `/api/audit-logs`). */
  du?: string;
  au?: string;
}

/** Résumé d'un compte d'authentification (réservé ADMINISTRATEUR ; mot de passe jamais exposé). */
export interface CompteAuthResume {
  login: string;
  typeActeur: TypeActeur;
  refActeur: string;
  /** `true` si le compte peut se connecter. */
  actif: boolean;
}

/** Corps de POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe. */
export interface ReinitMotDePasseRequest {
  nouveauMotDePasse: string;
}

/** Entité déclarée dans une inscription PRMP (existante et/ou proposée). */
export interface InscriptionEntiteDeclaree {
  idEntiteContract?: number;
  libelle?: string;
  /** `true` si l'entité existante est encore disponible (non rattachée à une autre PRMP). */
  disponible?: boolean;
}

/**
 * Inscription en attente de validation Administrateur (`GET /api/inscriptions/en-attente`).
 * Couvre les inscriptions **PRMP et UGPM** (`type`) ; une UGPM porte `idPrmpTutelle` et n'a pas d'entités.
 */
export interface InscriptionEnAttente {
  login: string;
  /** PRMP ou UGPM. */
  type: 'PRMP' | 'UGPM';
  /** Identifiant de l'acteur (matricule PRMP/UGPM), si exposé. */
  refActeur?: string;
  /**
   * Identité — le backend type l'identité « en Prmp générique » : selon la sérialisation, les champs
   * peuvent être unifiés (`nom`/`prenoms`/`email`) ou typés (`nomPrmp`/`nomUgpm`…). On lit les deux.
   */
  nom?: string;
  prenoms?: string;
  email?: string;
  nomPrmp?: string;
  prenomsPrmp?: string;
  emailPrmp?: string;
  nomUgpm?: string;
  prenomsUgpm?: string;
  emailUgpm?: string;
  /** Renseigné pour une UGPM : matricule de la PRMP de tutelle. */
  idPrmpTutelle?: string;
  /** Entités déclarées (PRMP uniquement ; vide pour une UGPM). */
  entitesDeclarees?: InscriptionEntiteDeclaree[];
}

/** Corps de POST /api/inscriptions/{login}/refuser. */
export interface RefusInscriptionRequest {
  motif: string;
}

/* ────────────────────────── Annuaire des personnes (lot 6, B2/B3) ────────────────────────── */

/**
 * État d'accès d'une personne (`AnnuairePersonneDto.statutCompte`).
 *
 * ⚠️ `SUSPENDU` et `REFUSE` **ne se recouvrent jamais** : un compte fermé après validation
 * (`ACTIF = false`, `STATUT` inchangé) et une inscription rejetée (`STATUT = REFUSE`) sont deux
 * histoires sans rapport. Ensemble **fermé** côté serveur : une valeur inconnue part en 400.
 */
export type StatutCompteAnnuaire = 'ACTIF' | 'SUSPENDU' | 'REFUSE' | 'EN_ATTENTE' | 'SANS_COMPTE';

/** Sens d'une délégation de profil : la personne exerce, ou son profil est exercé par un autre. */
export type SensDelegation = 'EXERCE' | 'EXERCEE_PAR';

/**
 * Une ligne de l'annuaire (`GET /api/annuaire`) — une **personne**, quelle que soit sa population.
 * Les champs sans objet pour une population sont `null`, jamais inventés.
 */
export interface AnnuairePersonne {
  /** `IM_CONTROLEUR` (7), `ID_PRMP` ou `ID_UGPM` (10). */
  ref: string;
  type: TypeActeur;
  nom: string;
  prenoms: string;
  /** Profil du contrôleur ; `null` pour une PRMP et une UGPM, dont le type tient lieu de rôle. */
  profil: string | null;
  /** **Code** de localité (`ANT`), pas le libellé — celui-ci vient de `/api/localites`. `null` hors contrôleurs. */
  localite: string | null;
  /** Entité(s) de rattachement séparées par « · » ; celles de la tutelle pour une UGPM. `null` pour un contrôleur. */
  entite: string | null;
  login: string | null;
  statutCompte: StatutCompteAnnuaire;
}

/** Une personne citée par une fiche sans en être le sujet (le supérieur hiérarchique). */
export interface AnnuairePersonneCitee {
  ref: string;
  nom: string;
  prenoms: string;
  profil: string | null;
  localite: string | null;
}

/** Un maillon de la chaîne de contrôle ; `lui` marque la personne de la fiche (toujours le premier). */
export interface AnnuaireMaillon {
  ref: string;
  nom: string;
  prenoms: string;
  profil: string | null;
  lui: boolean;
}

/**
 * Une délégation de profil **active**. Elle est portée par le PROFIL, pas par la personne : une
 * paire active vaut pour tous les titulaires du profil. La fiche la montre parce que c'est ce qui
 * explique qu'une personne agisse là où son profil seul ne le permettrait pas.
 */
export interface AnnuaireDelegation {
  sens: SensDelegation;
  /** L'autre profil de la paire. */
  profil: string;
}

/**
 * Fiche d'une personne (`GET /api/annuaire/{type}/{ref}`) — les neuf premiers champs sont ceux de
 * `AnnuairePersonne`, calculés par le même code serveur : la ligne et la fiche ne peuvent pas se
 * contredire.
 *
 * ⚠️ `derniereConnexion` et `echecs30j` sont servis **toujours nuls** : aucune connexion n'est
 * tracée durablement tant que le besoin backend **B4** n'est pas livré. Ils existent au contrat pour
 * que sa livraison change la *valeur* et non la *forme*. L'écran ne les affiche pas — ni à zéro, ni
 * avec un tiret : absents (plan L6 §6).
 */
export interface AnnuaireFiche extends AnnuairePersonne {
  /**
   * Date de la **décision d'ouverture** du compte (`t_compte_auth.DATE_DECISION`).
   * `null` tant que l'inscription n'est pas validée **et pour une inscription refusée** : la colonne
   * porte alors la date du refus, qui n'est pas une date d'activation.
   */
  dateActivation: string | null;
  /** Toujours `null` — dépend de B4 (non livré). */
  derniereConnexion: string | null;
  /** Toujours `null` — même raison. */
  echecs30j: number | null;
  superieur: AnnuairePersonneCitee | null;
  /** `null` hors contrôleurs. */
  transversal: boolean | null;
  /** La personne en tête (`lui: true`), puis ses rattachés ; un seul maillon = chaîne incomplète. Vide hors contrôleurs. */
  chaineControle: AnnuaireMaillon[];
  /** Vide hors contrôleurs. */
  delegations: AnnuaireDelegation[];
  /** Mandat en fonction ce jour — **PRMP seulement** ; `null` pour un contrôleur, une UGPM et une PRMP en vacance. */
  mandat: Mandat | null;
  /** Écritures portées à son nom au journal d'audit sur 30 jours glissants. */
  actionsJournal30j: number;
}
