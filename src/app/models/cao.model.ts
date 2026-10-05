import { ProcedureEnLigne } from './candidat.model';
import { EtatCao, EtatCeremonie } from './fiche-marche.model';

/**
 * Soumission en ligne — lot 2a, la **commission d'appel d'offres** (demande `docs/demande-backend-2026-10-04-commission-
 * appel-offres.md`, V67, décision Q11 du pilote) et lot 2b, la **cérémonie des clés** (demande
 * `docs/demande-backend-2026-10-04-ceremonie-des-cles.md`, V66, ADR-0013). Contrat : `docs/api-endpoints.md`, § *La
 * commission d'appel d'offres (CAO)* et § *La cérémonie des clés et la procédure de secours*.
 */

// ── La CAO (lot 2a) ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * L'origine d'un membre (précision du pilote, 04/10) : agent de l'entité contractante, ou expert de l'objet du DAO. Les
 * deux siègent et détiennent une part. ⚠️ « Un expert est suffisant dans la CAO » (pilote, 04/10 bis) : **un seul**
 * membre `EXPERT_OBJET` par commission, et pas d'« expert adjoint » sans part — la catégorie a été retirée (§B6).
 */
export type OrigineMembreCao = 'ENTITE_CONTRACTANTE' | 'EXPERT_OBJET';

export type EtatCompteCao = 'A_INVITER' | 'INVITE' | 'ACTIF' | 'ARCHIVE';

/** Un membre tel que la PRMP le déclare (`PUT …/cao`). `id` absent crée, présent met à jour ; un membre omis est retiré. */
export interface MembreCaoCorps {
  id?: number | null;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  /** Obligatoire ; `EXPERT_OBJET` une fois au plus. */
  origine: OrigineMembreCao;
  fonction?: string | null;
  /** Obligatoire pour `ENTITE_CONTRACTANTE`. */
  service?: string | null;
  organisme?: string | null;
  /** Obligatoire pour `EXPERT_OBJET`. */
  domaine?: string | null;
  president?: boolean;
}

/** Le compte `MEMBRE_CAO` d'un membre : créé à la désignation, activé par courriel. */
export interface CompteMembreCao {
  etat: EtatCompteCao;
  /** Identifiant court `K` + 9 chiffres. */
  idCompte: string | null;
  dateInvitation: string | null;
  dateActivation: string | null;
}

export interface MembreCao extends MembreCaoCorps {
  id: number;
  president: boolean;
  /** Servi par V67 tant que §B6 n'est pas porté : `EXPERT_ADJOINT` désigne un ancien expert sans part, à reclasser. */
  qualite?: 'MEMBRE' | 'EXPERT_ADJOINT' | null;
  /** `null` seulement pour un ancien expert adjoint (V67, avant §B6). */
  compte: CompteMembreCao | null;
}

export interface DecisionCaoCorps {
  reference: string;
  /** `AAAA-MM-JJ`. */
  date: string;
}

export interface DecisionCao {
  reference: string | null;
  date: string | null;
  /** Le PDF de la décision signée est joint (facultatif : anomalie `DECISION_SANS_FICHIER`, non bloquante). */
  fichier: boolean;
}

export interface CaoCorps {
  decision: DecisionCaoCorps;
  membres: MembreCaoCorps[];
}

/** `GET /api/fiches-marche/{idDmc}/cao` — lisible par qui lit la fiche ; écrite par la PRMP de la fiche seule. */
export interface Cao {
  idDmc: number;
  decision: DecisionCao;
  membres: MembreCao[];
  etat: EtatCao;
  /** `CAO_INCOMPLETE`, `DECISION_SANS_FICHIER`, `COMPTES_NON_ACTIVES`. */
  anomalies: { regle: string; message: string }[];
}

/** Corps de `POST /api/cao/activation` (public) : le code reçu par courriel vaut 72 heures, 5 essais. */
export interface ActivationCaoCorps {
  email: string;
  code: string;
  motDePasse: string;
}

/** `GET /api/cao/mes-procedures` — les procédures où le membre connecté siège. */
export interface MaProcedureCao {
  idDmc: number;
  reference: string | null;
  objet: string | null;
  autoriteContractante: string | null;
  president: boolean;
  dateLimite: string | null;
  etatCeremonie: EtatCeremonie | null;
  etatPart: EtatPart;
}

/** `GET /api/cao/procedures/{idDmc}` — la vue du membre : la procédure (version courante de la fiche) et sa CAO. */
export interface VueProcedureCao {
  procedure: ProcedureEnLigne;
  president: boolean;
  cao: Cao;
}

// ── La cérémonie des clés (lot 2b) ────────────────────────────────────────────────────────────────────────────

export type RoleDetenteur = 'MEMBRE' | 'SECOURS';

export type EtatPart = 'ABSENTE' | 'PUBLIEE' | 'VERIFIEE' | 'PERDUE';

/** Un détenteur de part : un membre de la CAO, ou la part de secours (`im` nul, `nom` = le dépositaire). Jamais une enveloppe. */
export interface Detenteur {
  role: RoleDetenteur;
  im: string | null;
  nom: string;
  /** SHA-256 de la forme SPKI de la clé publique, hexadécimal minuscule. */
  empreinte: string | null;
  /** SPKI en base64. */
  clePublique: string | null;
  datePublication: string | null;
  etatPart: EtatPart;
  derniereVerification: string | null;
  remplacements: number;
  /**
   * ⚠️ V71 — qui a généré la clé de secours publiée : `RESPONSABLE` (ancien geste, avant le 05/10) ou `DEPOSITAIRE` ;
   * `null` pour un membre ou une part absente.
   */
  generePar?: GenerePar | null;
}

/** ⚠️ V71 — l'auteur de la clé de secours active. */
export type GenerePar = 'RESPONSABLE' | 'DEPOSITAIRE';

/** `GET /api/fiches-marche/{idDmc}/ceremonie` — responsable et membres de la CAO ; 403 aux autres. */
export interface Ceremonie {
  idDmc: number;
  etat: EtatCeremonie;
  dateCeremoniePrevue: string | null;
  dateCloture: string | null;
  quorum: number | null;
  /** Membres + 1 (la part de secours). */
  n: number;
  /** Posé par le lot 3 à la première offre scellée ; toujours `false` au lot 2. */
  premierDepot: boolean;
  /** Les membres dans l'ordre des paramètres internes, puis la part de secours. */
  detenteurs: Detenteur[];
  /** `SE_MARGE_EPUISEE`, servi cérémonie close seulement. */
  avertissements: { regle: string; message: string }[];
}

/**
 * La clé privée **enveloppée** (`wrapKey('pkcs8')`, AES-256-GCM, clé dérivée de la phrase secrète par PBKDF2-SHA-256,
 * 600 000 itérations). Le serveur la garde pour la rendre à son propriétaire, et ne peut pas la lire.
 */
export interface Enveloppe {
  /** PKCS#8 enveloppé, base64. */
  chiffre: string;
  /** 12 octets, base64. */
  iv: string;
  /** 16 octets, base64. */
  sel: string;
  iterations: number;
  kdf: 'PBKDF2-SHA-256';
  algorithme: 'AES-256-GCM';
}

/** Corps de `POST` / `PUT …/ceremonie/cles` (et `/secours`). */
export interface CleCorps {
  /** SPKI en base64, RSA-OAEP 3072. */
  clePublique: string;
  /** SHA-256 de la SPKI, hexadécimal — recalculée par le serveur (400 `EMPREINTE_INVALIDE`). */
  empreinte: string;
  enveloppe: Enveloppe;
}

/** `POST …/ceremonie/defi` → les 32 octets chiffrés pour la clé publique du détenteur ; cinq minutes, usage unique. */
export interface DefiOuvert {
  idDefi: string;
  /** RSA-OAEP du défi, base64. */
  chiffre: string;
  expire: string;
}

/** `GET /api/procedures-en-ligne/{idDmc}/cles` (public) — sans matricule ni nom ; 404 tant que la cérémonie n'est pas close. */
export interface ClesPubliques {
  idDmc: number;
  quorum: number;
  n: number;
  algorithmes: string[];
  dateCloture: string | null;
  detenteurs: { role: RoleDetenteur; empreinte: string; clePublique: string }[];
}

// ── La séance d'ouverture des plis (lot 4, V69) ───────────────────────────────────────────────────────────────

/** ⚠️ V70 (arbitrages du 04/10, §B2) : `PV_A_SIGNER` entre le PV produit et la dernière signature des membres présents. */
export type EtatSeance = 'A_VENIR' | 'OUVERTE' | 'DECHIFFREE' | 'PV_A_SIGNER' | 'ILLISIBLE' | 'CLOSE';
export type IntegriteOffre = 'INTACTE' | 'ALTEREE' | 'LECTURE_IMPOSSIBLE';

/** `GET /api/fiches-marche/{idDmc}/seance` — responsable, membres de la CAO, PRMP et UGPM de la fiche. */
export interface Seance {
  idDmc: number;
  etat: EtatSeance;
  /** `B04-OP-02` + `B04-OP-03`, à l'horloge du serveur. */
  heureOuverture: string | null;
  ouverteLe: string | null;
  /** Secondes avant l'heure d'ouverture ; `null` une fois passée. */
  ouverteDans: number | null;
  quorum: number;
  membres: { im: string; nom: string; president: boolean; present: boolean; partsApportees: boolean }[];
  autres: { nom: string; qualite: string | null }[];
  secoursEmploye: boolean;
  /** `etat` : l'intégrité une fois l'offre ouverte, sinon l'état de l'offre. */
  offres: { numero: number | null; lot: number | null; etat: string; partsRecues: number }[];
  dechiffreeLe: string | null;
  pv: PvSeance | null;
  /** ⚠️ V71 — la demande de la part de secours par le responsable (motif porté au PV), `null` sans demande. */
  secoursDemande?: { motif: string; date: string } | null;
  /** ⚠️ V71 — qui a généré la clé de secours : décide entre « Demander la part de secours » et l'ancien geste. */
  secoursGenerePar?: GenerePar | null;
}

/** ⚠️ V71 — `GET /api/depositaire/procedures` : les procédures dont le dépositaire connecté garde la part de secours. */
export interface ProcedureDepositaire {
  idDmc: number;
  reference: string;
  objet: string;
  etatCeremonie: EtatCeremonie;
  /** L'état de SA clé (`ABSENTE` sinon). */
  etatPart: EtatPart;
  etatSeance: EtatSeance | null;
  generePar: GenerePar | null;
  /** Une clé active qui n'est pas la sienne (ancien geste, ou ancien dépositaire) : il la remplace. */
  cleARemplacer: boolean;
  secoursDemande: { motif: string; date: string } | null;
}

/** Une signature du PV d'ouverture (V70, §B2) — ou un empêchement constaté (`empechement`, avec son motif et qui l'a constaté). */
export interface SignaturePv {
  im: string;
  nom: string;
  president: boolean;
  date: string;
  empechement: boolean;
  motif: string | null;
  constatePar: string | null;
}

/**
 * Le PV de la séance. ⚠️ V70 : signé électroniquement par chaque membre présent (signataires figés à la production) ; l'extrait
 * n'est publié qu'à la dernière signature. `signe` dit aussi la signature d'un PV de constat (S5), séance restée `ILLISIBLE`.
 */
export interface PvSeance {
  produit: boolean;
  publie: boolean;
  signe?: boolean;
  signatures?: SignaturePv[];
  signaturesAttendues?: { im: string; nom: string }[];
}

/** Une part chiffrée pour la clé de l'appelant ; `enveloppe` seulement si l'offre a été scellée pour une clé archivée (S4). */
export interface PartChiffree {
  idOffre: string;
  empreinteCle: string;
  part: string;
  enveloppe: Enveloppe | null;
}

export interface OffreLue {
  numero: number | null;
  idOffre: string;
  lot: number | null;
  etat: string;
  integrite: IntegriteOffre;
  motif: string | null;
  entreprise: { nif: string; raisonSociale: string; verification: { statut: string; source: string | null } | null; exclusion: unknown | null };
  groupement: { nif: string; raisonSociale: string; mandataire: boolean }[] | null;
  acteEngagement: { montantHt: number; montantTtc: number; delai: number; delaiUnite: 'JOURS' | 'MOIS'; validiteJours: number; rabais: string | null } | null;
  /** ⚠️ V70 (§B3) : `montant`, `monnaie`, `emetteur` lus au manifeste de format 2 ; `null` pour une offre de format 1 ou illisibles. */
  garantie: { codeVerification: string; presente: boolean; montant?: number | null; monnaie?: string | null; emetteur?: string | null } | null;
  pieces: { code: string; libelle: string; presente: boolean; nomFichier: string | null; empreinteConforme: boolean | null }[];
  piecesManquantes: string[];
  alertes: { type: TypeAlerteLecture; message: string }[];
  /** ⚠️ Lot 5 (05/10) — l'offre porte des formulaires (manifeste de format 3). */
  formulaires?: boolean | null;
  /** ⚠️ Lot 5 — les totaux **recalculés par le serveur** depuis le bordereau ; `htMin`/`ttcMin` en marché à commande. */
  totaux?: { ht: number; tva: number; ttc: number; htMin: number | null; ttcMin: number | null } | null;
}

/** Les alertes lues en séance — V70, puis les contrôles des formulaires du lot 5 (05/10). Jamais un refus : la commission décide. */
export type TypeAlerteLecture =
  | 'RAPPROCHEMENT'
  | 'EXCLUSION'
  | 'GARANTIE_INSUFFISANTE'
  | 'TOTAL_DIVERGENT'
  | 'AE_DIVERGENT'
  | 'PRIX_MANQUANT'
  | 'LETTRES_DIVERGENTES'
  | 'PLAFOND_DEPASSE'
  | 'NON_CONFORME'
  | 'LIVRAISON_HORS_DELAI'
  | 'CA_INSUFFISANT'
  | 'LIQUIDITE_INSUFFISANTE'
  | 'REFERENCES_INSUFFISANTES'
  | 'PERSONNEL_INCOMPLET'
  | 'MATERIEL_INCOMPLET'
  | 'SOUS_DETAIL_INCOHERENT'
  | 'FORMULAIRES_ILLISIBLES';

/** ⚠️ Lot 5 — les documents remplis que la commission imprime (`…/formulaires/{type}.pdf`) ; `DQE` = `BORDEREAU` aux travaux. */
export type DocumentFormulaire = 'BORDEREAU' | 'DQE' | 'CONFORMITE' | 'CAPACITES';

/** `GET …/seance/lecture` — après le déchiffrement seulement (409 `SEANCE_NON_DECHIFFREE`). */
export interface Lecture {
  offres: OffreLue[];
  nonOuvertes: { numero: number | null; entreprise: string; etat: string; motif: string | null }[];
}
