import { isApiError } from '../../../core/errors/api-error';
import { libelleRole } from '../../../core/auth/libelles-profils';
import { AFaireTache, Dossier, ETAPE_CIRCUIT_PORTEURS, GesteAFaire, GestesDossier, ModeTache, Role } from '../../../models';
import { CIRCUIT_ETAPES, etapeIndexForDossier, statutDossierLabel } from '../../../shared/circuit/circuit-workflow';
import { GenreDelai, delaiLigne, jourMois } from '../../../shared/circuit/frise-delai';
import { NomIcone } from '../../../shared/ui/icone';
import { LIBELLES_AVIS, LIBELLES_ETAPES_CIRCUIT, LIBELLES_GESTES, LIBELLES_MODES } from '../../home/a-faire/a-faire-libelles';
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
 * - `navette` : DANS le panneau, par `PvWorkflow` (lot F4 : soumettre, accepter, viser, retourner, signer) ;
 * - `retrait` : DANS le panneau, par `DecisionRetrait` (lot F5 : accepter, ou refuser avec motif).
 */
export type FamillePage = 'modale' | 'lien' | 'navette' | 'retrait';

/** Lot F4 : la navette du projet de PV, dans le panneau (`EtapePv`, qui monte `PvWorkflow` tel quel). */
export const GESTES_NAVETTE_PV: readonly GesteAFaire[] = ['SOUMETTRE_PV', 'ACCEPTER', 'VISER', 'RETOURNER', 'SIGNER'];
/** Lot F5 : formulaire court dans le panneau (`DecisionRetrait`). */
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
  if (GESTES_NAVETTE_PV.includes(geste)) return 'navette';
  if (GESTES_RETRAIT.includes(geste)) return 'retrait';
  return ['NUMEROTER', 'DISPATCHER', 'REATTRIBUER', 'COMPLETER_PIECES_DEPOT'].includes(geste) ? 'modale' : 'lien';
}

/**
 * Cible d'un geste depuis la page. Même table que l'accueil (`cibleGeste`), à deux différences près :
 * - les écrans de travail reçoivent `returnUrl` vers la page (seule la rectification le lit aujourd'hui) ;
 * - la « consultation » (repli d'un dispatch sans réception) n'a pas lieu d'être : on y est — `null`.
 *
 * Navette du PV (lot F4) : le geste s'exécute dans le panneau. La cible d'« À faire » (gestion du projet
 * de PV, `?gerer=<idPv>`) ne sert plus que de LIEN DE REPLI, quand `PvWorkflow` ne propose pas un geste
 * que le serveur sert (« geste indisponible sur cet écran ») ; cet écran ne lit pas `returnUrl`.
 * Décision de retrait (lot F5) : elle se prend dans le panneau ; la liste des demandes, cible d'« À faire »,
 * n'est plus une destination de la page.
 */
export function ciblePage(geste: GesteAFaire, t: AFaireTache, espace: string, urlPage: string): CibleGeste | null {
  const cible = cibleGeste(geste, t, espace);
  if (cible.type === 'modale') return cible.modale === 'consultation' ? null : cible;
  if (famillePage(geste) !== 'lien') return cible;
  return { ...cible, queryParams: { ...cible.queryParams, returnUrl: urlPage } };
}

// ── Panneau ───────────────────────────────────────────────────────────────────────────────────

export interface DelaiEtape {
  genre: GenreDelai;
  texte: string;
}

/**
 * ⚠️ Recette L4-Q2 (2026-09-16), défaut (j) — le TITRE du panneau dit la SITUATION, le bouton dit
 * l'ACTION. Le titre reprenait le libellé long du geste : « Dispatcher le dossier » s'affichait deux
 * fois, en titre et sur le bouton juste dessous. Table exhaustive : un code de geste nouveau ne
 * compile pas tant qu'il n'a pas sa phrase de situation. Chaîne vide = pas de geste à faire (VOIR,
 * SUIVRE) : le titre reste celui de l'état du dossier (`titreEtat`).
 *
 * Règle de rédaction : dire où EN EST le dossier et ce qui est attendu, jamais le verbe du bouton.
 */
export const TITRES_SITUATION: Readonly<Record<GesteAFaire, string>> = {
  NUMEROTER: 'Dépôt arrivé de la PRMP',
  DISPATCHER: 'En attente de dispatch',
  REATTRIBUER: "En attente d'attribution à un Membre",
  EXAMINER: 'Dossier attribué pour examen',
  REEXAMINER: 'Pièces complémentaires reçues',
  SOUMETTRE_PV: 'Examen terminé, projet de PV rédigé',
  REPRENDRE_EXAMEN: 'Projet de PV retourné pour rectification',
  ACCEPTER: 'Projet de PV soumis par le Membre',
  RETOURNER: 'Projet de PV soumis, décision attendue',
  VISER: 'Projet de PV en attente de visa',
  SIGNER: 'PV visé, en attente des signatures',
  SIGNER_LETTRE: 'Lettre de renvoi en attente de signature',
  DECIDER_RETRAIT: 'Retrait demandé par la PRMP',
  VERIFIER: 'Levée des observations à contrôler',
  TRANSMETTRE_DECISION: 'Vérification faite, SIGMP en attente',
  TRANSMETTRE_SIGMP: 'Vérification faite, SIGMP en attente',
  ARCHIVER_PV: 'Dernière étape avant la clôture',
  ARCHIVER_LETTRE: 'Lettre de renvoi signée',
  SOUMETTRE: 'Brouillon pas encore transmis à la CNM',
  COMPLETER_BROUILLON: 'Brouillon en préparation',
  COMPLETER_PIECES_DEPOT: 'Dépôt incomplet',
  TRANSMETTRE_COMPLEMENTS: 'Lettre de renvoi reçue',
  RECTIFIER: 'Dossier renvoyé par la CNM',
  VOIR: '',
  SUIVRE: '',
};

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
  /**
   * Lot F4 : la navette du projet de PV, si le serveur en sert un geste. Le panneau monte alors `EtapePv`
   * (`PvWorkflow` et le volet « Ce que dit le projet de PV », qui prend la place des faits).
   */
  navette: NavettePv | null;
  /**
   * Lot F5 : la décision de retrait, si le serveur la sert. Le panneau monte alors `DecisionRetrait`
   * (accepter, ou refuser avec motif, et le volet « La demande de la PRMP »).
   */
  retrait: RetraitADecider | null;
  /**
   * Avec la navette ou la décision de retrait : les AUTRES gestes servis (lettre, dispatch…), en boutons
   * à côté des formulaires du panneau. Vide sinon (le panneau de F3 : `principal` et `secondaires`).
   */
  horsPanneau: GesteBouton[];
}

// ── Décision de retrait (lot F5) ──────────────────────────────────────────────────────────────

/**
 * Demande de retrait à décider, telle que la sert la ligne RETRAITS_A_DECIDER : sa référence, le motif
 * de la PRMP et la date de la demande (l'entrée du délai de cette ligne, sans étape chronométrée).
 */
export interface RetraitADecider {
  tache: AFaireTache;
  idDemandeRetrait: number | null;
  motif: string | null;
  demandeeLe: string | null;
}

export function retraitADecider(boutons: readonly GesteBouton[]): RetraitADecider | null {
  const b = boutons.find((x) => famillePage(x.geste) === 'retrait');
  return b ? { tache: b.tache, idDemandeRetrait: b.tache.refs.idDemandeRetrait, motif: b.tache.faits.motifRetrait, demandeeLe: b.tache.delai.entree } : null;
}

// ── Navette du projet de PV (lot F4) ──────────────────────────────────────────────────────────

/**
 * Navette servie au connecté : les gestes de navette de TOUTES ses lignes, dans l'ordre du serveur, et
 * la ligne la mieux rangée qui en porte un (ses `refs.idPv`, ses `faits`). Un dossier n'a qu'un PV en cours.
 */
export interface NavettePv {
  tache: AFaireTache;
  idPv: number | null;
  gestes: GesteAFaire[];
}

export function navettePv(boutons: readonly GesteBouton[]): NavettePv | null {
  const miens = boutons.filter((b) => famillePage(b.geste) === 'navette');
  return miens.length ? { tache: miens[0].tache, idPv: miens[0].tache.refs.idPv, gestes: miens.map((b) => b.geste) } : null;
}

const LIBELLES_PARTS: Readonly<Record<string, string>> = { MEMBRE: 'Membre', CC: 'Chef de commission', PRESIDENT: 'Président' };

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Volet « Ce que dit le projet de PV » : avis, nombre d'observations, dernier retour de navette, parts de
 * signature attendues, examinateur — tirés des faits servis, sans appel.
 *
 * ⚠️ `nbObservations` : le compte de l'EXAMEN (points de contrôle et pièces non conformes), lu par
 * `EtapePv` — celui que la garde du visa oppose à l'avis. `faits.nbObservations` compte le périmètre FIGÉ
 * à la signature d'un PV FAVR : il est nul pendant toute la navette et ne sert que de repli.
 * `null` : compte inconnu (lecture en cours ou refusée) — la ligne est omise plutôt que fausse.
 */
export function voletPv(t: AFaireTache, nbObservations: number | null): FaitApercu[] {
  const f = t.faits;
  const out: FaitApercu[] = [];
  const pousser = (libelle: string, valeur: string | null | undefined): void => {
    if (valeur) out.push({ libelle, valeur });
  };
  pousser(t.section === 'PV_A_SIGNER' ? 'Avis arrêté au visa' : 'Avis du Membre', f.idAvis ? LIBELLES_AVIS[f.idAvis] ?? f.idAvis : 'Non renseigné');
  const n = nbObservations ?? f.nbObservations;
  pousser('Observations', n == null ? null : n ? pluriel(n, 'observation') : 'Aucune observation');
  pousser('Dernier retour', f.dernierRetourNavette ? `« ${f.dernierRetourNavette} »` : null);
  pousser('Parts attendues', f.partsAttendues?.length ? f.partsAttendues.map((p) => LIBELLES_PARTS[p] ?? p).join(' et ') : null);
  pousser('Examiné par', t.dossier.acteursEtapes?.EXAMEN);
  return out;
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
  if (d.attentePrmp || g.etapeCourante.urgence === 'EN_PAUSE') return 'En attente de la PRMP';
  if (partieControlee) return 'En cours à la Commission nationale des marchés';
  // L'étape chronométrée est plus précise que la colonne de la frise (« Archivage en cours » plutôt que « Vérification »).
  const chrono = g.etapeCourante.delai.etape;
  if (chrono) {
    const libelle = LIBELLES_ETAPES_CIRCUIT[chrono];
    return `${libelle.charAt(0).toUpperCase()}${libelle.slice(1)} en cours`;
  }
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

  // Navette du PV : jamais pour la partie contrôlée (règle C2) — le serveur ne la lui sert pas, et le
  // panneau n'en demanderait pas le PV quand bien même.
  const navette = partieControlee ? null : navettePv(boutons);
  // Décision de retrait : réservée au Président et au Chef de commission — jamais montée pour la partie
  // contrôlée, même sur une réponse qui la servirait.
  const retrait = partieControlee ? null : retraitADecider(boutons);
  const famillePrincipale = principal ? famillePage(principal.geste) : null;
  // Le geste principal se joue dans un formulaire du panneau, dont le volet dit déjà l'avis (navette) ou le
  // motif (retrait) : ni phrase guide qui le répète, ni colonne de faits concurrente.
  const volet = (navette !== null && famillePrincipale === 'navette') || (retrait !== null && famillePrincipale === 'retrait');
  const titre = principal ? TITRES_SITUATION[principal.geste] || principal.libelle : titreEtat(d, g, partieControlee, gesteEtat);
  const noteBrute = tachePrincipale && (principal || gesteEtat === 'VOIR') && !volet ? noteCourte(tachePrincipale) : '';
  // La phrase guide ne redit pas le titre (« Lettre de renvoi signée » de part et d'autre).
  const note = noteBrute === titre ? '' : noteBrute;
  // Un fait que la phrase guide dit déjà (« Favorable ») n'est pas répété à côté ; le volet du PV les remplace.
  // Le motif du retrait est aussi servi sur les autres lignes du dossier : le volet de la décision le porte déjà.
  const faits =
    tachePrincipale && !navette && !volet
      ? faitsApercu(tachePrincipale).filter((f) => !FAITS_REDONDANTS.includes(f.libelle) && f.valeur !== note && !(retrait && f.libelle === 'Motif du retrait'))
      : [];
  return {
    etape: i >= 0 ? `Étape ${i + 1} sur ${CIRCUIT_ETAPES.length}` : '',
    fleche: i >= 0 ? `${(((i + 0.5) / CIRCUIT_ETAPES.length) * 100).toFixed(2)}%` : null,
    porteur,
    titre,
    note,
    delai: delaiEtape(g, role),
    mode: principal?.mode ?? null,
    principal,
    secondaires: boutons.slice(1),
    faits: partieControlee ? faits.filter((f) => FAITS_PARTIE_CONTROLEE.includes(f.libelle)) : faits,
    navette,
    retrait,
    horsPanneau: navette || retrait ? boutons.filter((b) => !['navette', 'retrait'].includes(famillePage(b.geste))) : [],
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
