import { AFaireTache, Dossier, EtapeFrise } from '../../models';
import { CIRCUIT_ETAPES, etapeIndexForDossier } from './circuit-workflow';

/**
 * Frise des sept étapes et délai d'une étape, en règles PURES : aucun appel, aucun recalcul de délai
 * (le serveur sert reste, échéance et urgence). Extraites de l'accueil « À faire » (lot L4-F2) pour
 * servir aussi sur un `Dossier` — la page dossier — sans dupliquer la règle ; `a-faire-modele.ts`
 * les réexporte, l'accueil ne change pas.
 */

// ── Dates ─────────────────────────────────────────────────────────────────────────────────────

/** `yyyy-MM-ddTHH:mm[:ss]` ou `yyyy-MM-dd` (heure locale du serveur) → Date ; `null` si illisible. */
export function lireDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
const deux = (n: number): string => String(n).padStart(2, '0');
/** « 11/09 » */
export function jourMois(v: string | null | undefined): string {
  const d = lireDate(v);
  return d ? `${deux(d.getDate())}/${deux(d.getMonth() + 1)}` : '';
}
/** « jeu. 24/09/2026 » — date d'une fin de traitement prévue ; vide si illisible. */
export function jourSemaineDate(v: string | null | undefined): string {
  const d = lireDate(v);
  if (!d) return '';
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  return `${jour} ${jourMois(v)}/${d.getFullYear()}`;
}
/** Heures ouvrées : entier, ou une décimale au plus. */
export function heures(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(n));
}

// ── Délai ─────────────────────────────────────────────────────────────────────────────────────

export type GenreDelai = 'retard' | 'bientot' | 'ok' | 'sans' | 'pause' | 'suivi';

export interface DelaiLigne {
  genre: GenreDelai;
  /**
   * Ligne : « Reste 5 h », « 1 h de retard », « En pause », « Fin prévue le 24/09 »… — COURT : la
   * colonne du délai fait 9,25 rem. ⚠️ 2026-09-15 (recette) : « En pause · depuis le 12/09 » y était
   * tronqué ; la date passe au sous-texte, rien n'est perdu.
   */
  texte: string;
  /** Ligne, sous la barre : « 9 h sur 8 h », « Depuis le 12/09 », « Compteur suspendu »… */
  sousTexte: string;
  /** Aperçu (plus large) : la phrase entière, « En pause · depuis le 12/09 » ; l'échéance s'y ajoute. */
  texteApercu: string;
  /** Remplissage de la barre (0-100). */
  pourcentage: number;
}

/**
 * Ce que lit le délai : une tâche d'« À faire », ou l'étape courante d'un dossier servie avec ses
 * gestes (`GET /api/dossiers/{id}/gestes`, même paire `urgence` + `delai`).
 */
export type SourceDelai = Pick<AFaireTache, 'urgence' | 'delai'>;

/** Délai lu dans `delai` selon la classe d'urgence servie (aucun recalcul). */
export function delaiLigne(t: SourceDelai): DelaiLigne {
  const d = t.delai;
  const sur = d.ecouleHeures != null && d.standardHeures ? `${heures(d.ecouleHeures)} h sur ${heures(d.standardHeures)} h` : '';
  const simple = (genre: GenreDelai, texte: string, sousTexte: string, pourcentage: number): DelaiLigne => ({ genre, texte, sousTexte, texteApercu: texte, pourcentage });
  switch (t.urgence) {
    case 'EN_RETARD':
      if (d.restantHeures == null) break;
      return simple('retard', `${heures(d.restantHeures)} h de retard`, sur, 100);
    case 'BIENTOT':
    case 'DANS_LES_DELAIS': {
      if (d.restantHeures == null) break;
      const pct = d.ecouleHeures != null && d.standardHeures ? Math.min(100, Math.max(0, Math.round((d.ecouleHeures / d.standardHeures) * 100))) : 0;
      return simple(t.urgence === 'BIENTOT' ? 'bientot' : 'ok', `Reste ${heures(d.restantHeures)} h`, sur, pct);
    }
    case 'EN_PAUSE': {
      const depuis = d.pauseDepuis ? jourMois(d.pauseDepuis) : '';
      return {
        genre: 'pause',
        texte: 'En pause',
        sousTexte: depuis ? `Depuis le ${depuis}` : 'Compteur suspendu',
        texteApercu: depuis ? `En pause · depuis le ${depuis}` : 'En pause · compteur suspendu',
        pourcentage: 100,
      };
    }
    case 'SUIVI':
      return simple('suivi', d.datePrevisionnelleFin ? `Fin prévue le ${jourMois(d.datePrevisionnelleFin)}` : 'En cours', 'Suivi seulement', 0);
    case 'HORS_DELAI':
      return simple('sans', 'Hors délai CNM', 'Pas encore transmis', 0);
    case 'SANS_DELAI':
      break;
  }
  return simple('sans', 'Sans délai', d.entree ? `Depuis le ${jourMois(d.entree)}` : '', 0);
}

// ── Frise ─────────────────────────────────────────────────────────────────────────────────────

export interface EtapeFriseVue {
  cle: EtapeFrise;
  libelle: string;
  etat: 'faite' | 'courante' | 'pause' | 'a-venir';
  /** « 11/09 », « en cours », « en pause » ou vide. */
  date: string;
  /** Acteur de l'étape ; `null` pour la PRMP et l'UGPM (règle C2) ou étape non franchie. */
  acteur: string | null;
}

/** Dates et acteurs par étape, sous la forme d'« À faire » comme sous celle de `Dossier`. */
interface EtapesDatees {
  statut?: string | null;
  datesEtapes?: Partial<Record<string, string | null>> | null;
  acteursEtapes?: Partial<Record<string, string | null>> | null;
}

const estTache = (source: AFaireTache | Dossier): source is AFaireTache => 'section' in source && 'dossier' in source;

/**
 * Frise des sept étapes, depuis `datesEtapes` et `acteursEtapes` (absents pour la PRMP et l'UGPM).
 * - Tâche d'« À faire » : l'étape courante est en pause quand l'urgence servie est `EN_PAUSE`.
 * - Dossier : quand la balle est chez la PRMP (`attentePrmp`, statut suspensif), même règle serveur.
 */
export function friseDossier(source: AFaireTache | Dossier): EtapeFriseVue[] {
  return estTache(source) ? frise(source.dossier, source.urgence === 'EN_PAUSE') : frise(source, source.attentePrmp === true);
}

/**
 * ⚠️ Recette L4-Q2 (2026-09-16), défaut (i) — un dossier revenu en BROUILLON après un retrait accepté
 * garde les dates et les acteurs de son ancien circuit : le serveur les sert encore, mais le circuit à
 * la CNM a été effacé et ces traces ne disent plus rien (« Réception 15/09 » sur un brouillon qui
 * n'a plus été reçu). La frise d'un brouillon repart donc VIERGE — aucune date, aucun acteur ; seule
 * l'étape courante reste marquée, puisque le dossier attend bien d'être soumis.
 *
 * Un brouillon jamais soumis n'a de toute façon ni date ni acteur : la règle ne change que le cas du
 * retrait. Elle est posée ici, à l'affichage, et vaut aussi pour la frise d'« À faire ».
 */
function frise(d: EtapesDatees, pause: boolean): EtapeFriseVue[] {
  const courante = etapeIndexForDossier(d.statut ?? undefined);
  const vierge = d.statut === 'BROUILLON';
  return CIRCUIT_ETAPES.map((e, i) => {
    const cle = e.key as EtapeFrise;
    const date = (vierge ? null : d.datesEtapes?.[cle]) ?? null;
    const etat = i < courante ? 'faite' : i === courante ? (pause ? 'pause' : 'courante') : 'a-venir';
    return {
      cle,
      libelle: e.label,
      etat,
      date: date ? jourMois(date) : etat === 'courante' ? 'en cours' : etat === 'pause' ? 'en pause' : '',
      acteur: (vierge ? null : d.acteursEtapes?.[cle]) ?? null,
    };
  });
}
