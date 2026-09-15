import { isApiError } from '../../../core/errors/api-error';
import { AFaire, AFaireCompteurs, AFaireTache, EtapeFrise, Role, SectionAFaire } from '../../../models';
import { CIRCUIT_ETAPES, etapeIndexForDossier, statutDossierLabel } from '../../../shared/circuit/circuit-workflow';
import { NomIcone } from '../../../shared/ui/icone';
import {
  LIBELLES_AVIS,
  LIBELLES_ETAPES_CIRCUIT,
  LIBELLES_GESTES,
  LIBELLES_MODES,
  LIBELLES_SECTIONS,
  TITRE_BROUILLONS_UGPM,
} from './a-faire-libelles';

/**
 * Accueil « À faire » (refonte ergonomique, maquette `Main` validée le 2026-09-14) : règles PURES —
 * regroupement client, délai, note courte, frise, faits de l'aperçu, phrase d'accueil. Aucune règle
 * de « qui agit » ici : le serveur les calcule (contrat 2026-09-14-accueil-a-faire), l'écran les montre.
 */

// ── Formats ───────────────────────────────────────────────────────────────────────────────────

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
/** « 11/09/2026 » */
export function dateComplete(v: string | null | undefined): string {
  const d = lireDate(v);
  return d ? `${jourMois(v)}/${d.getFullYear()}` : '';
}
/** « 11/09 à 09:30 » */
export function jourMoisHeure(v: string | null | undefined): string {
  const d = lireDate(v);
  return d ? `${jourMois(v)} à ${deux(d.getHours())}:${deux(d.getMinutes())}` : '';
}
/** « mar. 15/09, 12:00 » */
export function echeanceTexte(v: string | null | undefined): string {
  const d = lireDate(v);
  if (!d) return '';
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  return `${jour} ${jourMois(v)}, ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}
/** Heures ouvrées : entier, ou une décimale au plus. */
export function heures(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(n));
}
function pluriel(n: number, singulier: string, plurielForme = singulier + 's'): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

// ── Profil ────────────────────────────────────────────────────────────────────────────────────

/** Atterrissage historique de chaque espace (repli quand l'accueil n'est pas servi). */
export function atterrissageHistorique(espace: string): string {
  return espace === 'verificateur' ? '/verificateur/a-verifier' : `/${espace}/tableau-de-bord`;
}

const estPartieControlee = (profil: Role | null): boolean => profil === 'PRMP' || profil === 'UGPM';

/** `nomAffichage` est « Nom Prénoms » : le premier prénom, sinon le nom tel quel. */
export function prenomDe(nomAffichage: string | null | undefined): string {
  const mots = (nomAffichage ?? '').trim().split(/\s+/).filter(Boolean);
  return mots.length > 1 ? mots[1] : mots[0] ?? '';
}

/**
 * L'endpoint n'est pas (encore) servi : 404 / 405 / 501, 403 pour un profil hors contrat, et 400 sur
 * le paramètre `id` — sur le backend qui ne connaît pas la route, `/dossiers/a-faire` tombe sur
 * `GET /dossiers/{id}` et le type de `id` est refusé.
 */
export function estAFaireIndisponible(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if ([403, 404, 405, 501].includes(err.status)) return true;
  return err.status === 400 && !!err.fieldErrors && 'id' in err.fieldErrors;
}

// ── Phrase d'accueil et compteurs ─────────────────────────────────────────────────────────────

/** « 5 actions vous attendent, dont 1 en retard. » */
export function phraseAccueil(c: AFaireCompteurs, profil: Role | null): string {
  const n = c.aFaire;
  if (estPartieControlee(profil)) {
    if (!n) return "Aucun dossier n'attend d'action de votre part.";
    return n === 1 ? '1 dossier attend une action de votre part.' : `${n} dossiers attendent une action de votre part.`;
  }
  if (!n) return 'Aucune action ne vous attend.';
  if (n === 1) return c.enRetard ? '1 action vous attend, en retard.' : '1 action vous attend.';
  return c.enRetard ? `${n} actions vous attendent, dont ${c.enRetard} en retard.` : `${n} actions vous attendent. Aucune n'est en retard.`;
}

export type GenreDelai = 'retard' | 'bientot' | 'ok' | 'sans' | 'pause' | 'suivi';

export interface CompteurAffiche {
  cle: keyof AFaireCompteurs;
  nombre: number;
  libelle: string;
  genre: GenreDelai;
}

/** Ligne de compteurs sous le titre : les trois classes chronométrées toujours, le reste s'il existe. */
export function compteursAffiches(c: AFaireCompteurs, profil: Role | null): CompteurAffiche[] {
  if (estPartieControlee(profil)) {
    const prmp: CompteurAffiche[] = [
      { cle: 'enPause', nombre: c.enPause, libelle: c.enPause > 1 ? 'bloquent le circuit' : 'bloque le circuit', genre: 'bientot' },
      { cle: 'sansDelai', nombre: c.sansDelai, libelle: 'hors délai CNM', genre: 'sans' },
      { cle: 'suivi', nombre: c.suivi, libelle: 'en cours à la CNM', genre: 'suivi' },
    ];
    return prmp.filter((x) => x.nombre > 0 || x.cle === 'enPause');
  }
  const cnm: CompteurAffiche[] = [
    { cle: 'enRetard', nombre: c.enRetard, libelle: 'en retard', genre: 'retard' },
    { cle: 'bientot', nombre: c.bientot, libelle: 'bientôt à échéance', genre: 'bientot' },
    { cle: 'dansLesDelais', nombre: c.dansLesDelais, libelle: 'dans les délais', genre: 'ok' },
    { cle: 'sansDelai', nombre: c.sansDelai, libelle: 'sans délai', genre: 'sans' },
    { cle: 'enPause', nombre: c.enPause, libelle: 'chez la PRMP', genre: 'pause' },
    { cle: 'suivi', nombre: c.suivi, libelle: 'en suivi', genre: 'suivi' },
  ];
  return cnm.filter((x) => x.nombre > 0 || ['enRetard', 'bientot', 'dansLesDelais'].includes(x.cle));
}

// ── Ligne ─────────────────────────────────────────────────────────────────────────────────────

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

/** Délai d'une ligne, lu dans `delai` selon la classe d'urgence servie (aucun recalcul). */
export function delaiLigne(t: AFaireTache): DelaiLigne {
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

/** Référence en police mono, ou « Dépôt du 11/09 à 09:30 » avant la réception. */
export function referenceLigne(t: AFaireTache): { texte: string; sansReference: boolean } {
  const d = t.dossier;
  if (d.refeDossier) return { texte: d.refeDossier, sansReference: false };
  if (d.dateSoumission) return { texte: `Dépôt du ${jourMoisHeure(d.dateSoumission)}`, sansReference: true };
  return { texte: d.statut === 'BROUILLON' ? 'Brouillon sans référence' : `Dossier n° ${d.idDossier}`, sansReference: true };
}

function avisEtObservations(t: AFaireTache): string {
  const f = t.faits;
  const avis = f.idAvis ? LIBELLES_AVIS[f.idAvis] ?? f.idAvis : null;
  const obs = f.nbObservations == null ? null : f.nbObservations ? pluriel(f.nbObservations, 'observation') : 'sans observation';
  return [avis, obs].filter(Boolean).join(' · ');
}

/** Note courte de la ligne, tirée de `faits` (et des dates du dossier) selon la section. */
export function noteCourte(t: AFaireTache): string {
  const f = t.faits;
  const dates = t.dossier.datesEtapes ?? {};
  switch (t.section) {
    case 'A_RECEPTIONNER':
      return f.nbPieces != null ? pluriel(f.nbPieces, 'pièce jointe', 'pièces jointes') : 'Dépôt à contrôler';
    case 'A_DISPATCHER':
      return dates.RECEPTION ? `Numéroté le ${jourMois(dates.RECEPTION)}` : 'Numéroté';
    case 'A_EXAMINER':
      return [dates.DISPATCH ? `Dispatché le ${jourMois(dates.DISPATCH)}` : 'Dispatché', f.nbLignes ? pluriel(f.nbLignes, 'ligne') : null, f.examenEntame ? 'examen entamé' : null]
        .filter(Boolean)
        .join(' · ');
    case 'A_REEXAMINER':
      return 'Pièces complémentaires reçues';
    case 'PV_A_REPRENDRE':
      return f.dernierRetourNavette ? `« ${f.dernierRetourNavette} »` : 'Retourné pour rectification';
    case 'PV_A_SOUMETTRE':
    case 'PV_A_ACCEPTER':
    case 'PV_A_VISER':
    case 'PV_A_SIGNER':
    case 'A_VERIFIER':
      return avisEtObservations(t) || 'Projet de PV';
    case 'LETTRES_A_SIGNER':
      return 'Lettre de renvoi soumise';
    case 'LETTRES_A_ARCHIVER':
      return 'Lettre de renvoi signée';
    case 'RETRAITS_A_DECIDER':
      return f.motifRetrait ? `Motif : ${f.motifRetrait}` : 'Demande de retrait de la PRMP';
    case 'A_TRANSMETTRE_SIGMP':
      return 'Observations levées par la PRMP';
    case 'A_ARCHIVER':
      return 'Décision transmise à SIGMP';
    case 'EN_ATTENTE_PRMP':
      return statutDossierLabel(t.dossier.statut);
    case 'BROUILLONS':
      return f.nbLignes ? `Plan de passation · ${pluriel(f.nbLignes, 'ligne')}` : 'Brouillon';
    case 'PIECES_DEPOT_A_COMPLETER':
      return 'Pièces obligatoires manquantes au dépôt';
    case 'COMPLEMENTS_A_TRANSMETTRE':
      return 'Pièces demandées par la lettre de renvoi';
    case 'A_RECTIFIER':
      return f.nbObservations ? `${pluriel(f.nbObservations, 'observation maintenue', 'observations maintenues')} par la CNM` : 'Observations de la CNM à lever';
    case 'EN_COURS_CNM':
      return t.delai.etape ? `Étape : ${LIBELLES_ETAPES_CIRCUIT[t.delai.etape]}` : statutDossierLabel(t.dossier.statut);
  }
}

export interface LigneAFaire {
  /** (`idDossier`, `section`) : clé d'une ligne selon le contrat. */
  cle: string;
  tache: AFaireTache;
  reference: string;
  sansReference: boolean;
  entite: string;
  type: string;
  localite: string;
  note: string;
  delai: DelaiLigne;
  action: { libelle: string; icone: NomIcone };
  /** Ligne du bloc délégation : à quel titre. */
  mode: string | null;
}

export const cleTache = (t: AFaireTache): string => `${t.dossier.idDossier}|${t.section}`;

export function ligneAFaire(t: AFaireTache): LigneAFaire {
  const ref = referenceLigne(t);
  const geste = LIBELLES_GESTES[t.geste];
  return {
    cle: cleTache(t),
    tache: t,
    reference: ref.texte,
    sansReference: ref.sansReference,
    entite: t.dossier.libelleEntite ?? '',
    type: t.dossier.idSousType ?? t.dossier.idTypeDossier ?? '',
    localite: t.dossier.libelleLocalite ?? t.dossier.idLocalite ?? '',
    note: noteCourte(t),
    delai: delaiLigne(t),
    action: { libelle: geste.court, icone: geste.icone },
    mode: t.mode === 'TITULAIRE' ? null : LIBELLES_MODES[t.mode],
  };
}

// ── Regroupement client ───────────────────────────────────────────────────────────────────────

export type VueAFaire = 'urgence' | 'etape' | 'localite';

export interface GroupeAFaire {
  cle: string;
  titre: string;
  /** « Délai standard 8 h », « Compteur suspendu »… ; `null` pour une localité. */
  sousTitre: string | null;
  section: SectionAFaire | null;
  lignes: LigneAFaire[];
}

export function titreSection(code: SectionAFaire, profil: Role | null): string {
  return code === 'BROUILLONS' && profil === 'UGPM' ? TITRE_BROUILLONS_UGPM : LIBELLES_SECTIONS[code].titre;
}

/**
 * Groupes affichés. Les lignes gardent TOUJOURS l'ordre servi (tri serveur : urgence, reste, date,
 * `idDossier`) ; seule change la clé de regroupement et l'ordre des groupes :
 * - « Par urgence » : sections par geste, la plus urgente d'abord (rang de sa première ligne) ;
 * - « Par étape » : sections dans l'ordre du circuit, celui de `sections` ;
 * - « Par localité » : localités, la plus urgente d'abord.
 */
export function grouperTaches(taches: readonly AFaireTache[], vue: VueAFaire, a: Pick<AFaire, 'sections'> | null, profil: Role | null): GroupeAFaire[] {
  const groupes = new Map<string, GroupeAFaire>();
  for (const t of taches) {
    const parLocalite = vue === 'localite';
    const cle = parLocalite ? `loc:${t.dossier.idLocalite ?? '-'}` : `sec:${t.section}`;
    let g = groupes.get(cle);
    if (!g) {
      const standard = a?.sections.find((s) => s.code === t.section)?.standardHeures ?? null;
      g = parLocalite
        ? { cle, titre: t.dossier.libelleLocalite ?? t.dossier.idLocalite ?? 'Sans localité', sousTitre: null, section: null, lignes: [] }
        : {
            cle,
            titre: titreSection(t.section, profil),
            sousTitre: standard ? `Délai standard ${heures(standard)} h` : LIBELLES_SECTIONS[t.section].sansStandard,
            section: t.section,
            lignes: [],
          };
      groupes.set(cle, g);
    }
    g.lignes.push(ligneAFaire(t));
  }
  const liste = [...groupes.values()];
  if (vue === 'etape') {
    const ordre = (a?.sections ?? []).map((s) => s.code);
    const rangSection = (g: GroupeAFaire): number => {
      const i = ordre.indexOf(g.section as SectionAFaire);
      return i < 0 ? ordre.length + Object.keys(LIBELLES_SECTIONS).indexOf(g.section as string) : i;
    };
    return liste.sort((x, y) => rangSection(x) - rangSection(y));
  }
  // Map garde l'ordre de première apparition, c'est-à-dire l'ordre de la ligne la plus urgente.
  return liste;
}

// ── Aperçu ────────────────────────────────────────────────────────────────────────────────────

export interface EtapeFriseVue {
  cle: EtapeFrise;
  libelle: string;
  etat: 'faite' | 'courante' | 'pause' | 'a-venir';
  /** « 11/09 », « en cours », « en pause » ou vide. */
  date: string;
  /** Acteur de l'étape ; `null` pour la PRMP et l'UGPM (règle C2) ou étape non franchie. */
  acteur: string | null;
}

/** Frise des sept étapes, depuis `datesEtapes` et `acteursEtapes` (absents pour la PRMP et l'UGPM). */
export function friseDossier(t: AFaireTache): EtapeFriseVue[] {
  const courante = etapeIndexForDossier(t.dossier.statut);
  const pause = t.urgence === 'EN_PAUSE';
  return CIRCUIT_ETAPES.map((e, i) => {
    const cle = e.key as EtapeFrise;
    const date = t.dossier.datesEtapes?.[cle] ?? null;
    const etat = i < courante ? 'faite' : i === courante ? (pause ? 'pause' : 'courante') : 'a-venir';
    return {
      cle,
      libelle: e.label,
      etat,
      date: date ? jourMois(date) : etat === 'courante' ? 'en cours' : etat === 'pause' ? 'en pause' : '',
      acteur: t.dossier.acteursEtapes?.[cle] ?? null,
    };
  });
}

export interface FaitApercu {
  libelle: string;
  valeur: string;
}

/** Faits de l'aperçu : ce que le serveur sert, sans appel supplémentaire. */
export function faitsApercu(t: AFaireTache): FaitApercu[] {
  const f = t.faits;
  const acteurs = t.dossier.acteursEtapes ?? {};
  const out: FaitApercu[] = [];
  const pousser = (libelle: string, valeur: string | null | undefined): void => {
    if (valeur) out.push({ libelle, valeur });
  };
  if (t.mode !== 'TITULAIRE') pousser('À quel titre', LIBELLES_MODES[t.mode]);
  pousser('Consigne', f.consigneDispatch ? `« ${f.consigneDispatch} »` : null);
  pousser('Dernier retour', f.dernierRetourNavette ? `« ${f.dernierRetourNavette} »` : null);
  pousser('Motif du retrait', f.motifRetrait);
  if (t.section === 'A_DISPATCHER') pousser('Numéroté par', acteurs.RECEPTION);
  if (['A_EXAMINER', 'A_REEXAMINER'].includes(t.section)) pousser('Attribué à', acteurs.DISPATCH);
  pousser('Examiné par', t.section.startsWith('PV_') || t.section === 'A_VERIFIER' ? acteurs.EXAMEN : null);
  pousser(t.section === 'A_VERIFIER' ? 'Avis du PV' : 'Avis du Membre', f.idAvis ? avisEtObservations(t) : null);
  if (f.nbLignes) {
    const montant = f.montantTotal != null ? ` · ${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(f.montantTotal)} Ar` : '';
    pousser('Plan de passation', `${pluriel(f.nbLignes, 'ligne')}${montant}`);
  }
  pousser('Pièces', f.nbPieces != null ? pluriel(f.nbPieces, 'jointe') : null);
  pousser('Parts attendues', f.partsAttendues?.length ? f.partsAttendues.join(', ') : null);
  pousser('Déposé le', !t.dossier.refeDossier && t.dossier.dateSoumission ? jourMoisHeure(t.dossier.dateSoumission) : null);
  pousser('Fin de traitement prévue', dateComplete(t.delai.datePrevisionnelleFin) || null);
  return out;
}
