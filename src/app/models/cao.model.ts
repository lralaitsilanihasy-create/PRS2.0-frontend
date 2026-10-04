import { ProcedureEnLigne } from './candidat.model';
import { EtatCao, EtatCeremonie } from './fiche-marche.model';

/**
 * Soumission en ligne — lot 2a, la **commission d'appel d'offres** (demande `docs/demande-backend-2026-10-04-commission-
 * appel-offres.md`, V67, décision Q11 du pilote) et lot 2b, la **cérémonie des clés** (demande
 * `docs/demande-backend-2026-10-04-ceremonie-des-cles.md`, V66, ADR-0013). Contrat : `docs/api-endpoints.md`, § *La
 * commission d'appel d'offres (CAO)* et § *La cérémonie des clés et la procédure de secours*.
 */

// ── La CAO (lot 2a) ───────────────────────────────────────────────────────────────────────────────────────────

/** `MEMBRE` siège et détient une part ; `EXPERT_ADJOINT` évalue, sans part, sans compte, jamais président. */
export type QualiteMembreCao = 'MEMBRE' | 'EXPERT_ADJOINT';

/** L'origine d'un membre (précision du pilote, 04/10) : agent de l'entité contractante, ou expert de l'objet du DAO. */
export type OrigineMembreCao = 'ENTITE_CONTRACTANTE' | 'EXPERT_OBJET';

export type EtatCompteCao = 'A_INVITER' | 'INVITE' | 'ACTIF' | 'ARCHIVE';

/** Un membre tel que la PRMP le déclare (`PUT …/cao`). `id` absent crée, présent met à jour ; un membre omis est retiré. */
export interface MembreCaoCorps {
  id?: number | null;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  qualite: QualiteMembreCao;
  /** Obligatoire pour un `MEMBRE` ; absent pour un expert adjoint. */
  origine?: OrigineMembreCao | null;
  fonction?: string | null;
  /** Obligatoire pour `ENTITE_CONTRACTANTE`. */
  service?: string | null;
  organisme?: string | null;
  /** Obligatoire pour `EXPERT_OBJET` ; attendu d'un expert adjoint. */
  domaine?: string | null;
  president?: boolean;
}

/** Le compte `MEMBRE_CAO` d'un membre : créé à la désignation, activé par courriel. `null` pour un expert adjoint. */
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
}

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
