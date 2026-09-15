import { isApiError } from '../../../core/errors/api-error';
import { ESPACES_A_FAIRE } from '../../../core/navigation/navigation';
import { Dossier, Role } from '../../../models';
import { EtapeFriseVue, friseDossier, jourMois, jourSemaineDate } from '../../../shared/circuit/frise-delai';

/**
 * Page dossier (refonte ergonomique, lot L4-F2) : règles PURES — chemin de retour, référence affichée,
 * frise par profil, classement d'un échec d'ouverture. Aucun appel ici.
 */

// ── Retour ────────────────────────────────────────────────────────────────────────────────────

/**
 * `returnUrl` accepté tel quel s'il désigne un chemin INTERNE : commence par `/`, pas par `//`, sans
 * antislash ni caractère de contrôle. Tout le reste est refusé (`null`) : `//exemple.org`, `https://…`,
 * `javascript:…` — un navigateur lit aussi `/\exemple.org` comme `//exemple.org`.
 */
export function retourInterne(returnUrl: string | null | undefined): string | null {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) return null;
  if (returnUrl.includes('\\') || [...returnUrl].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return null;
  return returnUrl;
}

export interface RetourPage {
  /** Chemin interne, paramètres compris. */
  url: string;
  /** « À faire » ou « Retour ». */
  libelle: string;
}

/** Retour du fil d'Ariane : le `returnUrl` s'il est interne, sinon l'accueil « À faire » de l'espace. */
export function retourPage(returnUrl: string | null | undefined, role: Role | null): RetourPage {
  const espace = role ? ESPACES_A_FAIRE[role] : undefined;
  const url = retourInterne(returnUrl) ?? (espace ? `/${espace}/a-faire` : '/');
  const chemin = url.split(/[?#]/)[0];
  return { url, libelle: chemin.endsWith('/a-faire') ? 'À faire' : 'Retour' };
}

// ── Identité ──────────────────────────────────────────────────────────────────────────────────

/** `:idDossier` de l'URL : entier positif, sinon `null` (la page affiche « introuvable » sans appel). */
export function lireIdDossier(brut: string | null): number | null {
  if (!brut || !/^\d{1,9}$/.test(brut)) return null;
  const id = Number(brut);
  return id > 0 ? id : null;
}

/** Référence du `h1` : la référence officielle, sinon « Dépôt du 11/09 », sinon « Dossier n° 42 ». */
export function referenceDossier(d: Dossier): string {
  if (d.refeDossier) return d.refeDossier;
  if (d.dateSoumission) return `Dépôt du ${jourMois(d.dateSoumission)}`;
  return `Dossier n° ${d.idDossier}`;
}

// ── Frise ─────────────────────────────────────────────────────────────────────────────────────

/** Préfixe de l'acteur par étape, dans l'ordre de la frise (le serveur sert des noms nus). */
const PREFIXES_ACTEUR: readonly string[] = [
  'Réceptionné par',
  'Attribué à',
  'Examiné par',
  'Projet de PV rédigé par',
  'Signé par',
  'Vérifié par',
  'Clôturé par',
];

export interface EtapePage extends EtapeFriseVue {
  numero: number;
  /** Infobulle : étape et date ; l'acteur en plus pour la CNM seulement. */
  infobulle: string;
  /** Texte lu par les lecteurs d'écran (l'infobulle ne l'est pas au clavier). */
  lu: string;
}

const ETATS_LUS: Record<EtapeFriseVue['etat'], string> = { faite: 'franchie', courante: 'en cours', pause: 'en pause', 'a-venir': 'à venir' };

/**
 * Frise de la page. ⚠️ Règle C2 (audit 2026-09-14) : pour la PRMP et l'UGPM, la DATE seule — aucun
 * acteur, même si une réponse en portait un (le serveur les met déjà à `null` : double garde).
 */
export function etapesPage(d: Dossier, acteursVisibles: boolean): EtapePage[] {
  return friseDossier(d).map((e, i) => {
    const acteur = acteursVisibles ? e.acteur : null;
    const date = jourSemaineDate(d.datesEtapes?.[e.cle]);
    const phraseActeur = acteur ? `${PREFIXES_ACTEUR[i]} ${acteur}` : '';
    return {
      ...e,
      acteur,
      numero: i + 1,
      infobulle: [e.libelle, date || ETATS_LUS[e.etat], phraseActeur].filter(Boolean).join(' · '),
      lu: [ETATS_LUS[e.etat], date, phraseActeur].filter(Boolean).join(', '),
    };
  });
}

/** Partie contrôlée : la PRMP et son UGPM ne voient aucune restitution interne CNM. */
export const estPartieControlee = (role: Role | null): boolean => role === 'PRMP' || role === 'UGPM';

// ── Ouverture ─────────────────────────────────────────────────────────────────────────────────

export type EchecOuverture = 'interdit' | 'introuvable' | 'echec';

/**
 * Ce qu'un geste réussi laisse attendre de la relecture. `retrait-accepte` (lot L4-F5) : le dossier est
 * redevenu un brouillon, son circuit effacé — hors du Président, les contrôleurs n'y ont plus accès (403).
 */
export type SuiteGeste = 'retrait-accepte' | null;

/** 403 : hors périmètre ; 404 (ou 400 sur l'identifiant) : introuvable ; le reste : échec à réessayer. */
export function classerEchec(err: unknown): EchecOuverture {
  if (!isApiError(err)) return 'echec';
  if (err.status === 403) return 'interdit';
  if (err.status === 404 || err.status === 400) return 'introuvable';
  return 'echec';
}
