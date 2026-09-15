import { isApiError } from '../../../core/errors/api-error';
import { libelleRole } from '../../../core/auth/libelles-profils';
import { AFaireTache, Dossier, ETAPE_CIRCUIT_PORTEURS, GesteAFaire, GestesDossier, ModeTache, Role } from '../../../models';
import { CIRCUIT_ETAPES, etapeIndexForDossier, statutDossierLabel } from '../../../shared/circuit/circuit-workflow';
import { GenreDelai, delaiLigne, jourMois } from '../../../shared/circuit/frise-delai';
import { NomIcone } from '../../../shared/ui/icone';
import { LIBELLES_GESTES, LIBELLES_MODES } from '../../home/a-faire/a-faire-libelles';
import { FaitApercu, echeanceTexte, faitsApercu, noteCourte } from '../../home/a-faire/a-faire-modele';
import { CibleGeste, cibleGeste } from '../../home/a-faire/a-faire-navigation';
import { estPartieControlee } from './page-dossier-modele';

/**
 * Page dossier, lot L4-F3 — l'étape en cours et ses gestes, en règles PURES. Le panneau n'affiche QUE
 * ce que sert `GET /api/dossiers/{id}/gestes` : rien n'est déduit du statut côté gestes (plan L4 §3.3).
 * Le statut ne sert qu'à situer l'étape sur la frise et à nommer celui qui la porte.
 *
 * ⚠️ Règle C2 (audit 2026-09-14, règle pilote du 06/09) : pour la PRMP et l'UGPM, ni nom ni matricule
 * de contrôleur, ni reste, ni échéance, ni urgence CNM — la pause seule. Double garde : le serveur met
 * déjà ces champs à `null`, la page ne les lit de toute façon pas pour elles.
 */

// ── État de la lecture des gestes ─────────────────────────────────────────────────────────────

/**
 * - `indisponible` : le backend ne sert pas la route (404, 405, 501, ou 400 du `main` sur une route de
 *   dossier inconnue), ou la refuse au profil (403, alors que le dossier a répondu) — la page reste en
 *   lecture seule, avec une mention discrète et sans toast ;
 * - `echec` : panne à réessayer.
 */
export type EtatGestes = { etat: 'chargement' } | { etat: 'pret'; gestes: GestesDossier } | { etat: 'indisponible' } | { etat: 'echec' };

export function classerEchecGestes(err: unknown): EtatGestes {
  if (isApiError(err) && [400, 403, 404, 405, 501].includes(err.status)) return { etat: 'indisponible' };
  return { etat: 'echec' };
}

// ── Gestes ────────────────────────────────────────────────────────────────────────────────────

/**
 * Où s'exécute un geste sur la page (§3.3) :
 * - `modale` : par-dessus la page (numérotation, dispatch, réattribution, pièces du dépôt) ;
 * - `lien` : l'écran de travail existant, avec `returnUrl` vers la page ;
 * - `provisoire` : navette du PV (lot F4) et décision de retrait (lot F5) — même cible qu'« À faire ».
 */
export type FamillePage = 'modale' | 'lien' | 'provisoire';

/** Lot F4 : ces gestes viendront DANS le panneau (`PvWorkflow`). */
const GESTES_NAVETTE_PV: readonly GesteAFaire[] = ['SOUMETTRE_PV', 'ACCEPTER', 'VISER', 'RETOURNER', 'SIGNER'];
/** Lot F5 : formulaire court dans le panneau. */
const GESTES_RETRAIT: readonly GesteAFaire[] = ['DECIDER_RETRAIT'];
/** Aucun bouton : une phrase d'état (§3.3). */
export const GESTES_ETAT: readonly GesteAFaire[] = ['VOIR', 'SUIVRE'];

export interface GesteBouton {
  /** `section|geste` : unique dans la réponse. */
  cle: string;
  geste: GesteAFaire;
  tache: AFaireTache;
  libelle: string;
  icone: NomIcone;
  /** À quel titre, si la ligne n'est pas celle du titulaire. */
  mode: string | null;
}

/**
 * Tous les gestes servis, dans l'ordre du serveur : pour chaque tâche (rang croissant), son geste puis
 * ses gestes secondaires. VOIR et SUIVRE n'en sont pas (phrase d'état). Un même code servi deux fois
 * (deux sections) ne donne qu'un bouton, celui de la tâche la mieux rangée.
 */
export function gestesBoutons(taches: readonly AFaireTache[]): GesteBouton[] {
  const vus = new Set<GesteAFaire>();
  const boutons: GesteBouton[] = [];
  for (const t of [...taches].sort((a, b) => a.rang - b.rang)) {
    for (const geste of [t.geste, ...t.gestesSecondaires]) {
      if (GESTES_ETAT.includes(geste) || vus.has(geste)) continue;
      vus.add(geste);
      const l = LIBELLES_GESTES[geste];
      boutons.push({ cle: `${t.section}|${geste}`, geste, tache: t, libelle: l.long, icone: l.icone, mode: t.mode === 'TITULAIRE' ? null : LIBELLES_MODES[t.mode] });
    }
  }
  return boutons;
}

export function famillePage(geste: GesteAFaire): FamillePage {
  if (GESTES_NAVETTE_PV.includes(geste) || GESTES_RETRAIT.includes(geste)) return 'provisoire';
  return ['NUMEROTER', 'DISPATCHER', 'REATTRIBUER', 'COMPLETER_PIECES_DEPOT'].includes(geste) ? 'modale' : 'lien';
}

/**
 * Cible d'un geste depuis la page. Même table que l'accueil (`cibleGeste`), à deux différences près :
 * - les écrans de travail reçoivent `returnUrl` vers la page (seule la rectification le lit aujourd'hui) ;
 * - la « consultation » (repli d'un dispatch sans réception) n'a pas lieu d'être : on y est — `null`.
 *
 * Lot F4 : SOUMETTRE_PV, ACCEPTER, VISER, RETOURNER et SIGNER mènent PROVISOIREMENT à la cible
 * d'« À faire » (la gestion du projet de PV), inchangée, en attendant la navette dans le panneau.
 * Lot F5 : DECIDER_RETRAIT mène PROVISOIREMENT à la liste des retraits, comme « À faire ».
 */
export function ciblePage(geste: GesteAFaire, t: AFaireTache, espace: string, urlPage: string): CibleGeste | null {
  const cible = cibleGeste(geste, t, espace);
  if (cible.type === 'modale') return cible.modale === 'consultation' ? null : cible;
  if (famillePage(geste) === 'provisoire') return cible;
  return { ...cible, queryParams: { ...cible.queryParams, returnUrl: urlPage } };
}

// ── Panneau ───────────────────────────────────────────────────────────────────────────────────

export interface DelaiEtape {
  genre: GenreDelai;
  texte: string;
}

export interface VueEtape {
  /** « Étape 3 sur 7 » ; vide hors circuit (dossier retiré). */
  etape: string;
  /** Abscisse de l'étape courante sur la frise (« 35.71% »), pour la pointe du panneau ; `null` hors circuit. */
  fleche: string | null;
  /** « à vous », « à vous par délégation », « chez Jean Claude Rakoto, Membre », « à la Commission nationale des marchés »… */
  porteur: string;
  /** Titre du panneau : le geste principal, sinon l'état de l'étape. */
  titre: string;
  /** Phrase guide, tirée des faits servis (« Numéroté le 11/09 », « 2 observations maintenues par la CNM »…). */
  note: string;
  delai: DelaiEtape | null;
  /** À quel titre le connecté agit, si ce n'est pas en titulaire. */
  mode: string | null;
  principal: GesteBouton | null;
  secondaires: GesteBouton[];
  faits: FaitApercu[];
}

const PORTEURS_MODE: Readonly<Record<ModeTache, string>> = {
  TITULAIRE: 'à vous',
  DELEGATION: 'à vous par délégation',
  INTERIM: 'à vous par intérim',
  COLLEGUE: "à vous, dossier d'un collègue",
  SUPPLEANCE: 'à vous en suppléance',
};

/** Faits déjà portés ailleurs sur la page (en-tête, badge, onglet « Pièces jointes ») : pas de redite dans le panneau. */
const FAITS_REDONDANTS = ['À quel titre', 'Plan de passation', 'Fin de traitement prévue', 'Pièces'];
/** PRMP et UGPM : les seuls faits qui ne disent rien de l'organisation interne de la CNM. */
const FAITS_PARTIE_CONTROLEE = ['Déposé le', 'Motif du retrait'];

/** Qui porte l'étape, quand le connecté n'y a pas de geste (contrôleurs seulement). */
function porteurCnm(d: Dossier, g: GestesDossier): string {
  const etape = g.etapeCourante?.delai.etape ?? null;
  const acteurs = d.acteursEtapes ?? {};
  const chez = (nom: string | null | undefined, role: Role): string => {
    const libelle = libelleRole(role);
    return nom ? `chez ${nom}, ${libelle}` : `chez ${/^[AEIOUÉ]/.test(libelle) ? `l'${libelle}` : `le ${libelle}`}`;
  };
  switch (etape) {
    case 'EXAMEN':
      // `acteursEtapes.DISPATCH` = l'ATTRIBUTAIRE courant, réattributions comprises.
      return acteurs['DISPATCH'] ? chez(acteurs['DISPATCH'], 'MEMBRE') : "à l'examen";
    case 'VERIFICATION':
    case 'TRANSMISSION_SIGMP':
      return chez(d.nomVerificateurCible, 'VERIFICATEUR');
    case 'ARCHIVAGE':
      return chez(d.nomAssistantCible, 'ASSISTANT_CONTROLEUR');
    case 'RECEPTION':
      return chez(null, ETAPE_CIRCUIT_PORTEURS.RECEPTION);
    case 'RECTIFICATION_PRMP':
      return 'chez la PRMP';
    case 'DISPATCH':
      // Central : le Président ; régional : le Chef de commission. Le front ne tranche pas.
      return 'en attente de dispatch';
    case 'VISA':
      return 'au visa du projet de PV';
    case 'COSIGNATURE':
      return 'à la signature du PV';
    default:
      return d.attentePrmp ? 'chez la PRMP' : '';
  }
}

/** Titre quand aucun geste n'est à faire : l'état du dossier. */
function titreEtat(d: Dossier, g: GestesDossier, partieControlee: boolean, gesteEtat: GesteAFaire | null): string {
  if (gesteEtat === 'SUIVRE') return 'En cours à la Commission nationale des marchés';
  if (gesteEtat === 'VOIR') return 'En attente de la PRMP';
  switch (d.statut) {
    case 'CLOTURE':
      return 'Circuit terminé : dossier clôturé';
    case 'RETIRE':
      return 'Dossier retiré du circuit';
    case 'REMPLACE':
      return 'Dossier remplacé par une version postérieure';
    case 'PV_SIGNE':
      return 'PV signé';
    case 'BROUILLON':
      return partieControlee ? 'Brouillon' : 'Brouillon, pas encore soumis à la CNM';
  }
  if (!g.etapeCourante) return statutDossierLabel(d.statut);
  if (partieControlee) return d.attentePrmp ? 'En attente de la PRMP' : 'En cours à la Commission nationale des marchés';
  const i = etapeIndexForDossier(d.statut);
  return i >= 0 ? `${CIRCUIT_ETAPES[i].label} en cours` : statutDossierLabel(d.statut);
}

/** Délai de l'étape. PRMP et UGPM : la pause seule, sans reste ni échéance (règle pilote du 06/09). */
function delaiEtape(g: GestesDossier, role: Role | null): DelaiEtape | null {
  const e = g.etapeCourante;
  if (!e) return null;
  if (estPartieControlee(role)) {
    if (e.urgence !== 'EN_PAUSE') return null;
    const depuis = e.delai.pauseDepuis ? ` depuis le ${jourMois(e.delai.pauseDepuis)}` : '';
    return { genre: 'pause', texte: `En pause · ${role === 'PRMP' ? 'chez vous' : 'chez la PRMP'}${depuis}` };
  }
  const l = delaiLigne(e);
  const echeance = ['EN_RETARD', 'BIENTOT', 'DANS_LES_DELAIS'].includes(e.urgence) ? echeanceTexte(e.delai.echeance) : '';
  const complement = echeance ? `avant ${echeance}` : l.genre === 'sans' ? l.sousTexte : '';
  return { genre: l.genre, texte: [l.texteApercu, complement].filter(Boolean).join(' · ') };
}

/** Vue du panneau de l'étape en cours, pour ce connecté. */
export function vueEtape(d: Dossier, g: GestesDossier, role: Role | null): VueEtape {
  const partieControlee = estPartieControlee(role);
  const taches = [...g.taches].sort((a, b) => a.rang - b.rang);
  const boutons = gestesBoutons(taches);
  const principal = boutons[0] ?? null;
  const tachePrincipale = principal?.tache ?? taches[0] ?? null;
  const gesteEtat = !principal && tachePrincipale && GESTES_ETAT.includes(tachePrincipale.geste) ? tachePrincipale.geste : null;

  const i = etapeIndexForDossier(d.statut);
  let porteur: string;
  if (principal) porteur = PORTEURS_MODE[principal.tache.mode];
  else if (partieControlee) porteur = d.attentePrmp ? (role === 'PRMP' ? 'à vous' : 'à la PRMP') : g.etapeCourante || gesteEtat ? 'à la Commission nationale des marchés' : '';
  else porteur = g.etapeCourante ? porteurCnm(d, g) : '';

  const note = tachePrincipale && (principal || gesteEtat === 'VOIR') ? noteCourte(tachePrincipale) : '';
  // Un fait que la phrase guide dit déjà (« Favorable ») n'est pas répété à côté.
  const faits = tachePrincipale ? faitsApercu(tachePrincipale).filter((f) => !FAITS_REDONDANTS.includes(f.libelle) && f.valeur !== note) : [];
  return {
    etape: i >= 0 ? `Étape ${i + 1} sur ${CIRCUIT_ETAPES.length}` : '',
    fleche: i >= 0 ? `${(((i + 0.5) / CIRCUIT_ETAPES.length) * 100).toFixed(2)}%` : null,
    porteur,
    titre: principal ? principal.libelle : titreEtat(d, g, partieControlee, gesteEtat),
    note,
    delai: delaiEtape(g, role),
    mode: principal?.mode ?? null,
    principal,
    secondaires: boutons.slice(1),
    faits: partieControlee ? faits.filter((f) => FAITS_PARTIE_CONTROLEE.includes(f.libelle)) : faits,
  };
}

/** Montant total du plan, s'il est servi dans les faits (les puces d'identité n'en ont pas). */
export function montantGestes(g: GestesDossier | null): string {
  const montant = g?.taches.find((t) => t.faits.montantTotal != null)?.faits.montantTotal;
  return montant == null ? '' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(montant)} Ar`;
}

/** `?geste=` : pris en compte seulement s'il est servi — une valeur forgée est ignorée (`null`). */
export function gesteDemande(brut: string | null | undefined, boutons: readonly GesteBouton[]): GesteBouton | null {
  return brut ? boutons.find((b) => b.geste === brut) ?? null : null;
}
