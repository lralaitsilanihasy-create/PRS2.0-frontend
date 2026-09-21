import { Chronometrage, DelaiStandard } from '../../../models';

/**
 * Écran d'examen refondu (chantier « refonte ergonomique », lot 2 — maquettes `ExamenLigne` et
 * `ExamenSynthese` validées par Mathieu et ses chefs le 2026-09-14) : types partagés entre l'écran
 * et ses sous-composants, et règles PURES (parcours, délai, consigne, raison d'une validation
 * impossible), testables à froid.
 */

// ── Résultats saisis ──────────────────────────────────────────────────────────────────────────

/**
 * Une ligne « AU LIEU DE / LIRE » saisie pour un point non conforme, avec sa CELLULE visée
 * facultative (contrat V30 : `champ`, `idMarcheCible`, `idBenefCible`).
 */
export interface ObsLigne {
  auLieuDe: string;
  lire: string;
  champ?: string | null;
  idMarcheCible?: number | null;
  idBenefCible?: number | null;
}
/** Statut explicite d'un point de contrôle : `null` = non statué, `RAS` = conforme, `OBS` = avec observation. */
export type StatutPoint = 'RAS' | 'OBS' | null;
export interface RowState {
  statut: StatutPoint;
  /** Lignes d'observation (statut OBS) ; vide sinon. */
  observations: ObsLigne[];
}
/** Résultat d'examen d'une pièce jointe. */
export interface ResultatPiece {
  statut: StatutPoint;
  observation: string;
}

/** Une ligne d'observation porte-t-elle un texte ? (seules celles-là sont enregistrées et numérotées) */
export function aDuTexte(o: ObsLigne): boolean {
  return !!(o.auLieuDe.trim() || o.lire.trim());
}

// ── « Pas de texte = pas d'observation » (décision pilote 2026-09-21) ─────────────────────────
// Le bouton « Observation » n'est qu'une intention ; l'observation, c'est la correction écrite. Un point
// (ou une pièce) laissé « Observation » sans texte — clic accidentel — VAUT RAS : il ne bloque pas la
// validation, ne part pas au PV, ne pèse pas sur l'avis. La grille l'annonce avant le clic.

/** Un point est une observation EFFECTIVE : « Observation » ET au moins une correction renseignée. */
export function estObservationEffective(st: { statut: StatutPoint; observations: readonly ObsLigne[] }): boolean {
  return st.statut === 'OBS' && st.observations.some(aDuTexte);
}
/** Ramène un point « Observation » sans texte à RAS ; rend l'objet TEL QUEL sinon (identité = rien à réécrire). */
export function normaliserSansTexte(st: RowState): RowState {
  return st.statut === 'OBS' && !st.observations.some(aDuTexte) ? { statut: 'RAS', observations: [] } : st;
}
/** Même règle pour une pièce jointe : « Observation » sans texte = RAS. */
export function normaliserPieceSansTexte(r: ResultatPiece): ResultatPiece {
  return r.statut === 'OBS' && !r.observation.trim() ? { statut: 'RAS', observation: '' } : r;
}

// ── Modifications non enregistrées ────────────────────────────────────────────────────────────

/**
 * Empreinte d'un résultat de point, telle que le serveur le conserverait : statut, lignes
 * d'observation porteuses de texte (rognées), cellule visée. Deux résultats de même empreinte
 * donnent le même enregistrement ; une ligne vide ou un espace final ne sont pas des modifications.
 */
export function empreintePoint(st: RowState | undefined): string {
  if (!st || st.statut === null) return '';
  if (st.statut === 'RAS') return 'RAS';
  const lignes = st.observations
    .filter(aDuTexte)
    .map((o) => [o.auLieuDe.trim(), o.lire.trim(), o.champ ?? null, o.champ ? o.idMarcheCible ?? null : null, o.champ ? o.idBenefCible ?? null : null]);
  return 'OBS' + JSON.stringify(lignes);
}

/** Empreinte d'un résultat de pièce (même principe). */
export function empreintePiece(r: ResultatPiece | undefined): string {
  if (!r || r.statut === null) return '';
  return r.statut === 'RAS' ? 'RAS' : 'OBS' + r.observation.trim();
}

/**
 * Ce que l'écran rendrait à un rechargement (résultats persistés ou par défaut, synthèse, avis,
 * date), ou ce qu'il affiche maintenant : la comparaison des deux dit s'il reste des modifications
 * non enregistrées.
 */
export interface EmpreinteExamen {
  /** Clé de résultat (`idDetail:idPt`, `D:idPt`) → `empreintePoint`. */
  points: ReadonlyMap<string, string>;
  /** idPiece → `empreintePiece`. */
  pieces: ReadonlyMap<number, string>;
  synthese: string;
  avis: string | null;
  date: string;
}

function mapsDifferent<K>(a: ReadonlyMap<K, string>, b: ReadonlyMap<K, string>): boolean {
  for (const [k, v] of a) if ((b.get(k) ?? '') !== v) return true;
  for (const [k, v] of b) if ((a.get(k) ?? '') !== v) return true;
  return false;
}

/** L'état affiché diffère-t-il de l'état enregistré ? */
export function modificationsNonEnregistrees(courant: EmpreinteExamen, enregistre: EmpreinteExamen): boolean {
  return (
    courant.synthese.trim() !== enregistre.synthese.trim() ||
    (courant.avis ?? null) !== (enregistre.avis ?? null) ||
    courant.date !== enregistre.date ||
    mapsDifferent(courant.points, enregistre.points) ||
    mapsDifferent(courant.pieces, enregistre.pieces)
  );
}

// ── Parcours en six étapes ────────────────────────────────────────────────────────────────────

export type CleEtapeParcours = 'fiche' | 'lignes' | 'agpm' | 'pieces' | 'dossier' | 'synthese';
export type EtatEtapeParcours = 'a-faire' | 'en-cours' | 'terminee' | 'sans-objet';

export const LIBELLES_ETAPES: Readonly<Record<CleEtapeParcours, string>> = {
  fiche: 'Fiche de présentation',
  lignes: 'Lignes du plan',
  agpm: "Projet d'AGPM",
  pieces: 'Pièces jointes',
  dossier: 'Contrôles du dossier',
  synthese: 'Synthèse et avis',
};

/** Ce que l'écran sait d'une étape du parcours (entrée de `construireParcours`). */
export interface EntreeParcours {
  cle: CleEtapeParcours;
  /** Étape absente pour ce type de dossier (DMC/DDM : ni fiche, ni plan, ni AGPM) — non affichée. */
  masquee: boolean;
  /** Raison « sans objet » (étape présente mais sautée) ; `null` si l'étape a des contrôles. */
  sansObjet: string | null;
  /** Nombre de sous-étapes (lignes, pièces) ou 1 ; synthèse : 1. */
  total: number;
  /** Sous-étapes validées. */
  faites: number;
  nbObservations: number;
  courante: boolean;
  /** L'écran peut s'y rendre maintenant (règle séquentielle existante). */
  accessible: boolean;
}

export interface EtapeParcours extends EntreeParcours {
  numero: number;
  libelle: string;
  etat: EtatEtapeParcours;
  /** « 5 sur 14 · 1 observation », « Terminé · RAS », « Sans objet — fiche vide »… */
  resume: string;
  /** Avancement en % (barre de progression). */
  progression: number;
}

export function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

/**
 * Parcours affiché : état, résumé et progression de chaque étape. Les étapes masquées sont retirées
 * mais les numéros restent ceux du parcours complet (la synthèse reste « 6 »), comme la maquette.
 */
export function construireParcours(entrees: readonly EntreeParcours[]): EtapeParcours[] {
  return entrees
    .map((e, i) => ({ e, numero: i + 1 }))
    .filter(({ e }) => !e.masquee)
    .map(({ e, numero }) => {
      const obs = e.nbObservations ? ` · ${pluriel(e.nbObservations, 'observation')}` : '';
      let etat: EtatEtapeParcours;
      let resume: string;
      let progression = e.total ? Math.round((e.faites / e.total) * 100) : 0;
      if (e.cle === 'synthese') {
        etat = e.courante ? 'en-cours' : 'a-faire';
        resume = e.courante ? 'Dernière étape' : e.accessible ? 'Prête' : 'Après les contrôles';
        progression = e.courante ? 50 : 0;
      } else if (e.sansObjet) {
        etat = 'sans-objet';
        resume = e.sansObjet;
        progression = 0;
      } else {
        etat = e.total > 0 && e.faites >= e.total ? 'terminee' : e.courante || e.faites > 0 ? 'en-cours' : 'a-faire';
        const multiple = e.cle === 'lignes' || e.cle === 'pieces';
        if (multiple) {
          resume = `${e.faites} sur ${e.total}${obs}`;
        } else if (etat === 'terminee') {
          resume = `Terminé · ${e.nbObservations ? pluriel(e.nbObservations, 'observation') : 'RAS'}`;
        } else {
          resume = (e.courante ? 'En cours' : 'À faire') + obs;
        }
      }
      return { ...e, numero, libelle: LIBELLES_ETAPES[e.cle], etat, resume, progression };
    });
}

// ── Raison d'une validation impossible ────────────────────────────────────────────────────────

/** Un point de la grille courante, vu par la règle de validation. */
export interface PointAValider {
  /** Rang affiché dans la grille (1, 2…). */
  rang: number;
  statut: StatutPoint;
  observations: readonly ObsLigne[];
}

/**
 * Pourquoi « Valider » est inactif — mêmes règles que la validation (tout point statué ; un point
 * « Observation » porte au moins une ligne renseignée ; une pièce « Observation » porte son texte),
 * dites AVANT le clic. `objet` : « la ligne 6 », « la pièce 2 », « la fiche »… `null` = rien n'empêche.
 */
export function raisonValidationImpossible(p: {
  verrouille: boolean;
  objet: string;
  points: readonly PointAValider[];
  piece?: ResultatPiece | null;
}): string | null {
  if (p.verrouille) return 'Examen verrouillé : lecture seule.';
  // ⚠️ 21/09 (pilote) — une observation SANS texte ne bloque plus : elle vaudra RAS à la validation
  // (`normaliserSansTexte`). Seul un point ou une pièce NON STATUÉ empêche encore de valider.
  if (p.piece) return p.piece.statut === null ? `Choisissez RAS ou Observation pour valider ${p.objet}.` : null;
  const nonStatue = p.points.find((pt) => pt.statut === null);
  if (nonStatue) return `Renseignez le point ${nonStatue.rang} pour valider ${p.objet}.`;
  return null;
}

// ── Délai de l'examen (chronométrage) ─────────────────────────────────────────────────────────

const OUVERTURE_H = 8;
const FERMETURE_H = 16;

/** `yyyy-MM-ddTHH:mm[:ss]` ou `yyyy-MM-dd HH:mm` (heure locale du serveur) → Date ; `null` si illisible. */
export function lireHorodatage(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v.includes('T') ? v : v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function estOuvre(d: Date): boolean {
  return d.getDay() !== 0 && d.getDay() !== 6;
}

/**
 * Échéance d'une étape entrée à `debut` avec un délai de `heures` ouvrées — même fenêtre que le
 * serveur (`HeuresOuvrees.ajouter` : 08:00-16:00, du lundi au vendredi, jours fériés hors v1). Un
 * début hors fenêtre ne consomme rien avant l'ouverture suivante ; une échéance pile à la fermeture
 * reste à 16:00.
 */
export function ajouterHeuresOuvrees(debut: Date, heures: number): Date {
  if (heures <= 0) return new Date(debut);
  let restantes = heures * 60;
  let curseur = new Date(debut);
  for (let garde = 0; garde < 3660; garde++) {
    if (estOuvre(curseur)) {
      const ouverture = new Date(curseur.getFullYear(), curseur.getMonth(), curseur.getDate(), OUVERTURE_H);
      const fermeture = new Date(curseur.getFullYear(), curseur.getMonth(), curseur.getDate(), FERMETURE_H);
      const debutUtile = curseur > ouverture ? curseur : ouverture;
      if (fermeture > debutUtile) {
        const disponibles = Math.floor((fermeture.getTime() - debutUtile.getTime()) / 60000);
        if (restantes <= disponibles) return new Date(debutUtile.getTime() + restantes * 60000);
        restantes -= disponibles;
      }
    }
    curseur = new Date(curseur.getFullYear(), curseur.getMonth(), curseur.getDate() + 1, OUVERTURE_H);
  }
  return curseur;
}

/** « mer. 16/09, 09:00 » */
export function formatEcheance(d: Date): string {
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${jour} ${dd}/${mm}, ${hh}:${mi}`;
}

export interface DelaiAffiche {
  genre: 'ok' | 'bientot' | 'retard' | 'pause' | 'info';
  libelle: string;
}

/**
 * Puce de délai de l'en-tête, tirée du chronométrage (`GET /chronometrage`, étape EXAMEN en cours)
 * et du délai standard de l'étape (`GET /delais-standards`) : « Reste 10 h · avant mer. 16/09,
 * 09:00 », « En retard de 3 h · échéance … », « En attente de la PRMP ». Seuil « bientôt » : reste ≤
 * max(2 h, 35 % du standard), celui de la demande backend « À faire » (Q4). Sans étape EXAMEN en
 * cours, la date prévisionnelle de fin du dossier, si le serveur la donne.
 */
export function delaiExamen(chrono: Chronometrage | null, delais: readonly DelaiStandard[]): DelaiAffiche | null {
  if (!chrono) return null;
  if (chrono.attentePrmp) return { genre: 'pause', libelle: 'En attente de la PRMP' };
  const passage = [...chrono.etapes].reverse().find((e) => e.enCours && e.etape === 'EXAMEN');
  if (!passage) {
    const fin = lireHorodatage(chrono.datePrevisionnelleFin);
    if (!fin) return null;
    const dd = String(fin.getDate()).padStart(2, '0');
    const mm = String(fin.getMonth() + 1).padStart(2, '0');
    return { genre: 'info', libelle: `Fin de traitement prévue le ${dd}/${mm}/${fin.getFullYear()}` };
  }
  const standard = delais.find((d) => d.etape === 'EXAMEN')?.delaiHeures;
  if (standard == null) return { genre: 'info', libelle: `Examen en cours depuis ${passage.dureeHeuresOuvrees} h ouvrées` };
  const reste = standard - passage.dureeHeuresOuvrees;
  const entree = lireHorodatage(passage.entree);
  const echeance = entree ? formatEcheance(ajouterHeuresOuvrees(entree, standard)) : null;
  if (reste < 0) {
    return { genre: 'retard', libelle: `En retard de ${-reste} h` + (echeance ? ` · échéance ${echeance}` : '') };
  }
  const bientot = reste <= Math.max(2, Math.ceil(standard * 0.35));
  return { genre: bientot ? 'bientot' : 'ok', libelle: `Reste ${reste} h` + (echeance ? ` · avant ${echeance}` : '') };
}

// ── Consigne du dispatch ──────────────────────────────────────────────────────────────────────

/**
 * Lignes du plan désignées par la consigne du dispatch, quand le texte les nomme sans ambiguïté :
 * « ligne 6 », « lignes 6 à 9 », « lignes 3, 5 et 7 », « lignes 2-4 ». `null` si la consigne ne
 * désigne aucune ligne (on n'étiquette alors rien). Les numéros sont ceux du plan (rang 1, 2…).
 */
export function lignesViseesParConsigne(consigne: string | null | undefined): Set<number> | null {
  if (!consigne) return null;
  const visees = new Set<number>();
  const motif = /\blignes?\s+(?:n[°o]s?\s*)?(\d+(?:\s*(?:,|et|au|à|a|-|–)\s*\d+)*)/gi;
  for (const m of consigne.matchAll(motif)) {
    const jetons = m[1].split(/\s*(,|et|au|à|a|-|–)\s*/i);
    let precedent: number | null = null;
    let intervalle = false;
    for (const j of jetons) {
      if (/^\d+$/.test(j)) {
        const n = Number(j);
        if (intervalle && precedent != null && n >= precedent && n - precedent <= 500) {
          for (let k = precedent; k <= n; k++) visees.add(k);
        } else {
          visees.add(n);
        }
        precedent = n;
        intervalle = false;
      } else {
        intervalle = /^(à|a|au|-|–)$/i.test(j);
      }
    }
  }
  return visees.size ? visees : null;
}

/** Numéros en texte compact : « 6 à 9 », « 3, 5 et 7 ». */
export function numerosEnTexte(numeros: readonly number[]): string {
  const tries = [...new Set(numeros)].sort((a, b) => a - b);
  if (!tries.length) return '';
  const contigus = tries.length > 2 && tries[tries.length - 1] - tries[0] === tries.length - 1;
  if (contigus) return `${tries[0]} à ${tries[tries.length - 1]}`;
  return tries.length === 1 ? String(tries[0]) : `${tries.slice(0, -1).join(', ')} et ${tries[tries.length - 1]}`;
}

// ── Vues des sous-composants ──────────────────────────────────────────────────────────────────

/** Une observation numérotée (numérotation globale, dans l'ordre du parcours). */
export interface ObservationNumerotee {
  numero: number;
  groupe: Exclude<CleEtapeParcours, 'synthese'>;
  /** Index de l'étape séquentielle où la modifier. */
  etape: number;
  /** « Ligne 3 », « Pièce 4 », « Fiche de présentation »… */
  titre: string;
  /** Point de contrôle, ou nom de la pièce. */
  sousTitre: string;
  /** Intitulé de la cellule visée, s'il y en a une. */
  cellule: string | null;
  auLieuDe: string;
  lire: string;
  /** Observation libre d'une pièce. */
  texte: string | null;
  /** Clé du résultat (null = point évalué une fois), point, rang de la ligne d'observation. */
  idDetail: number | null;
  idPt: number | null;
  index: number;
  idPiece: number | null;
  champ: string | null;
  idMarcheCible: number | null;
  idBenefCible: number | null;
}

/** Option de « Cellule visée » (équivalent clavier du clic sur le document). */
export interface OptionCible {
  cle: string;
  libelle: string;
  champ: string;
  idBenef: number | null;
  valeur: string;
}

export interface ObsLigneVue {
  index: number;
  numero: number | null;
  auLieuDe: string;
  lire: string;
  cellule: string | null;
  cleCible: string;
}

export interface PointVue {
  idPt: number;
  rang: number;
  libelle: string;
  description: string | null;
  obligatoire: boolean;
  statut: StatutPoint;
  observations: ObsLigneVue[];
  erreur: string | null;
  /** « Observation » sans correction renseignée : vaudra RAS à la validation — annoncé sous le point. */
  seraRas: boolean;
}

export interface PieceVue {
  idPiece: number;
  libelle: string;
  statut: StatutPoint;
  observation: string;
  numero: number | null;
  erreur: string | null;
  /** « Observation » sans texte : vaudra RAS à la validation — annoncé sous la pièce. */
  seraRas: boolean;
}

export interface VueGrille {
  eyebrow: string;
  titre: string;
  puces: { texte: string; mono?: boolean; consigne?: boolean }[];
  justifications: { titre: string; texte: string }[];
  resume: { ras: number; obs: number; aRenseigner: number };
  points: PointVue[];
  piece: PieceVue | null;
  /** Options de cellule visée (vide = pas de sélecteur à cette étape). */
  options: OptionCible[];
  raison: string | null;
  libelleValider: string;
  libellePrecedent: string | null;
  verrouille: boolean;
}

export type ActionGrille =
  | { type: 'statut'; idPt: number; statut: 'RAS' | 'OBS' }
  | { type: 'auLieuDe' | 'lire'; idPt: number; index: number; valeur: string }
  | { type: 'ajouter'; idPt: number }
  | { type: 'retirer'; idPt: number; index: number }
  | { type: 'cible'; idPt: number; index: number; cle: string }
  | { type: 'statutPiece'; statut: 'RAS' | 'OBS' }
  | { type: 'observationPiece'; valeur: string }
  | { type: 'precedent' }
  | { type: 'valider' }
  | { type: 'basculer' };

/** Groupe du récapitulatif de synthèse. */
export interface GroupeRecap {
  cle: Exclude<CleEtapeParcours, 'synthese'>;
  numero: number;
  libelle: string;
  sansObjet: boolean;
  /** « 14 lignes examinées » ; `null` pour une étape unique. */
  sousTitre: string | null;
  statut: { texte: string; genre: 'ok' | 'obs' | 'na' };
  observations: ObservationNumerotee[];
  /** « 11 lignes sans observation » ; `null` si sans objet ou étape unique. */
  sansObservation: string | null;
}
