import { EtapeCircuit } from './circuit.model';
import { Role, StatutDossier, StatutPv } from './common.model';

/**
 * Accueil « À faire » — `GET /api/dossiers/a-faire?delegations=` (demande
 * `docs/demande-backend-2026-09-14-accueil-a-faire.md`, arbitrages adoptés le 2026-09-15). Le serveur
 * calcule les gestes attendus du connecté et ne sert que des CODES : les libellés vivent côté front
 * (`features/home/a-faire/a-faire-libelles.ts`).
 */

/** Sections, dans l'ordre du circuit (§3 du contrat) — l'ordre servi par `sections`. */
export type SectionAFaire =
  | 'A_RECEPTIONNER'
  | 'A_DISPATCHER'
  | 'A_EXAMINER'
  | 'A_REEXAMINER'
  | 'PV_A_SOUMETTRE'
  | 'PV_A_REPRENDRE'
  | 'PV_A_ACCEPTER'
  | 'PV_A_VISER'
  | 'PV_A_SIGNER'
  | 'LETTRES_A_SIGNER'
  | 'RETRAITS_A_DECIDER'
  | 'A_VERIFIER'
  | 'A_TRANSMETTRE_SIGMP'
  | 'A_ARCHIVER'
  | 'LETTRES_A_ARCHIVER'
  | 'EN_ATTENTE_PRMP'
  | 'BROUILLONS'
  | 'PIECES_DEPOT_A_COMPLETER'
  | 'COMPLEMENTS_A_TRANSMETTRE'
  | 'A_RECTIFIER'
  | 'EN_COURS_CNM';

/** Action proposée sur une ligne ; la garde de l'endpoint qui l'exécute fait foi. */
export type GesteAFaire =
  | 'NUMEROTER'
  | 'DISPATCHER'
  | 'EXAMINER'
  | 'REATTRIBUER'
  | 'REEXAMINER'
  | 'SOUMETTRE_PV'
  | 'REPRENDRE_EXAMEN'
  | 'ACCEPTER'
  | 'RETOURNER'
  | 'VISER'
  | 'SIGNER'
  | 'SIGNER_LETTRE'
  | 'DECIDER_RETRAIT'
  | 'VERIFIER'
  | 'TRANSMETTRE_DECISION'
  | 'TRANSMETTRE_SIGMP'
  | 'ARCHIVER_PV'
  | 'ARCHIVER_LETTRE'
  | 'VOIR'
  | 'SOUMETTRE'
  | 'COMPLETER_BROUILLON'
  | 'COMPLETER_PIECES_DEPOT'
  | 'TRANSMETTRE_COMPLEMENTS'
  | 'RECTIFIER'
  | 'SUIVRE';

/** À quel titre le connecté peut agir : seules les lignes `TITULAIRE` vont dans `taches`. */
export type ModeTache = 'TITULAIRE' | 'DELEGATION' | 'INTERIM' | 'COLLEGUE' | 'SUPPLEANCE';

/** Classe d'urgence, dans l'ordre du tri serveur. */
export type UrgenceTache = 'EN_RETARD' | 'BIENTOT' | 'DANS_LES_DELAIS' | 'SANS_DELAI' | 'HORS_DELAI' | 'EN_PAUSE' | 'SUIVI';

/** Les sept étapes de la frise (mêmes clés que `Dossier.datesEtapes`). */
export type EtapeFrise = 'RECEPTION' | 'DISPATCH' | 'EXAMEN' | 'PROJET_PV' | 'PV_SIGNE' | 'VERIFICATION' | 'CLOTURE';

/** Règle du contrat : `aFaire = enRetard + bientot + dansLesDelais + sansDelai` (CNM), `enPause + sansDelai` (PRMP). */
export interface AFaireCompteurs {
  aFaire: number;
  enRetard: number;
  bientot: number;
  dansLesDelais: number;
  sansDelai: number;
  enPause: number;
  suivi: number;
}

export interface AFaireSection {
  code: SectionAFaire;
  total: number;
  /** Délai standard de l'étape de la section ; `null` pour un geste non chronométré. */
  standardHeures: number | null;
}

export interface AFaireDossier {
  idDossier: number;
  /** `null` avant la réception (dépôt, brouillon). */
  refeDossier: string | null;
  dateSoumission: string | null;
  idTypeDossier: string | null;
  idSousType: string | null;
  idEntiteContract: number | null;
  libelleEntite: string | null;
  idLocalite: string | null;
  libelleLocalite: string | null;
  statut: StatutDossier;
  statutPv: StatutPv | null;
  /** Étage d'une navette à deux niveaux. `null` pour la PRMP et l'UGPM (règle C2). */
  niveauNavette: string | null;
  datesEtapes: Partial<Record<EtapeFrise, string | null>> | null;
  /** Noms « Prénoms Nom ». `null` pour la PRMP et l'UGPM (règle C2). */
  acteursEtapes: Partial<Record<EtapeFrise, string | null>> | null;
}

export interface AFaireDelai {
  /** Étape courante ; nulle pendant une attente PRMP et pour les gestes sans étape chronométrée. */
  etape: EtapeCircuit | null;
  entree: string | null;
  standardHeures: number | null;
  ecouleHeures: number | null;
  /** Négatif = retard. */
  restantHeures: number | null;
  echeance: string | null;
  pauseDepuis: string | null;
  pauseHeures: number | null;
  datePrevisionnelleFin: string | null;
}

export interface AFaireFaits {
  nbLignes: number | null;
  montantTotal: number | null;
  nbPieces: number | null;
  idAvis: string | null;
  nbObservations: number | null;
  /** `null` pour la PRMP et l'UGPM (règle C2). */
  consigneDispatch: string | null;
  /** Motif du dernier retour de navette. `null` pour la PRMP et l'UGPM (règle C2). */
  dernierRetourNavette: string | null;
  motifRetrait: string | null;
  examenEntame: boolean | null;
  /** Parts de signature encore attendues. `null` pour la PRMP et l'UGPM (règle C2). */
  partsAttendues: readonly string[] | null;
}

export interface AFaireRefs {
  idReception: number | null;
  /** `null` pour la PRMP et l'UGPM (règle C2). */
  idDispatch: number | null;
  idExamen: number | null;
  idPv: number | null;
  idLettre: number | null;
  idDemandeRetrait: number | null;
}

/** Une ligne. Clé : (`dossier.idDossier`, `section`). */
export interface AFaireTache {
  section: SectionAFaire;
  geste: GesteAFaire;
  gestesSecondaires: GesteAFaire[];
  mode: ModeTache;
  urgence: UrgenceTache;
  /** Rang du tri serveur, à partir de 1. */
  rang: number;
  dossier: AFaireDossier;
  delai: AFaireDelai;
  faits: AFaireFaits;
  refs: AFaireRefs;
}

export interface AFaireDelegations {
  total: number;
  parSection: { code: SectionAFaire; total: number }[];
  /** Vide sauf avec `delegations=true`. */
  taches: AFaireTache[];
}

export interface AFaire {
  profil: Role;
  genereLe: string;
  compteurs: AFaireCompteurs;
  sections: AFaireSection[];
  /** Lignes `TITULAIRE`, triées par le serveur (urgence, reste, date, `idDossier`). */
  taches: AFaireTache[];
  delegations: AFaireDelegations;
}

/**
 * Page dossier (refonte ergonomique, lot L4) — `GET /api/dossiers/{id}/gestes` : le calcul d'« À faire »
 * rejoué sur UN dossier (plan `docs/plan-refonte-L4-page-dossier.md`, §6). Toutes les clés sont toujours
 * présentes, à `null` quand elles ne s'appliquent pas.
 */

/**
 * Étape en cours du dossier, indépendamment des gestes du connecté : servie même quand `taches` est
 * vide (un Membre qui consulte le dossier d'un collègue voit le délai). Urgence : mêmes seuils que les
 * lignes chronométrées, `EN_PAUSE` sur un statut suspensif, `HORS_DELAI` pour un brouillon, **jamais**
 * `SUIVI`. ⚠️ Servie aussi à la PRMP et à l'UGPM : le front ne leur en montre que la pause (règle
 * pilote du 06/09).
 */
export interface EtapeCouranteDossier {
  urgence: UrgenceTache;
  delai: AFaireDelai;
}

export interface GestesDossier {
  idDossier: number;
  profil: Role;
  genereLe: string;
  /** `null` hors des statuts actifs de l'appelant (CLOTURE, RETIRE, REMPLACE, PV_SIGNE ; BROUILLON pour un contrôleur). */
  etapeCourante: EtapeCouranteDossier | null;
  /**
   * TOUTES les lignes du connecté sur ce dossier, de la forme exacte d'« À faire » : `TITULAIRE`
   * d'abord, puis délégation, intérim, collègue et suppléance ; `rang` numéroté depuis 1 sur toute la liste.
   */
  taches: AFaireTache[];
}
