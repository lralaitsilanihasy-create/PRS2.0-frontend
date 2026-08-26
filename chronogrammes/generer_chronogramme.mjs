/**
 * PRS 2.0 — Générateur de chronogrammes
 * =============================================================================
 * Lit `activites.yaml` et produit :
 *   - chronogramme_prs2.xlsx  (onglets Module_Planification, Global_PRS2, Jalons, Parametres)
 *   - chronogramme_prs2.html  (page autonome, imprimable en A4 paysage)
 *
 * AUCUNE donnée de planning n'est codée ici : tout vient du YAML.
 *
 * Choix de conception à connaître avant de lire le code
 * -----------------------------------------------------
 * 1. `debut` fait foi. Pour les activités passées, c'est une OBSERVATION (date du
 *    premier commit du thème). Le générateur ne replanifie donc PAS une activité
 *    derrière ses dépendances : il calcule `fin = debut + duree_jours` en jours
 *    ouvrés, et SIGNALE les séquencements incohérents au lieu de réécrire l'histoire.
 *    Les dépendances servent à trois choses : détecter les cycles, calculer le
 *    chemin critique, et produire ces avertissements.
 *
 * 2. Si `debut` tombe un jour non ouvré, l'activité est décalée au premier jour
 *    ouvré suivant, et le décalage est signalé (le dépôt PRS 2.0 contient du
 *    travail effectué un jour férié et plusieurs dimanches).
 *
 * 3. Une activité peut porter `duree_jours` OU `fin`. Avec `fin`, la durée est
 *    déduite en jours ouvrés.
 *
 * 4. Dans le .xlsx, toutes les DATES sont des formules ancrées sur
 *    `Parametres!$B$2` (date de démarrage) : modifier cette cellule décale tout le
 *    calendrier. Les REMPLISSAGES des barres de Gantt, eux, sont calculés à la
 *    génération — après un changement de date dans Excel, relancer le script.
 *
 * Usage : node generer_chronogramme.mjs [chemin/vers/activites.yaml]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ExcelJS from 'exceljs';
import YAML from 'yaml';

const DOSSIER = dirname(fileURLToPath(import.meta.url));

/** Erreur de cohérence du YAML : message explicite, sans pile d'appels parasite. */
export class ErreurChronogramme extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurChronogramme';
  }
}

// =============================================================================
// 1. Calendrier — arithmétique en jours ouvrés
// =============================================================================

const MS_JOUR = 86_400_000;

/** Normalise une valeur YAML (`Date` ou `'AAAA-MM-JJ'`) en Date UTC à minuit. */
export function versDate(valeur, contexte = 'date') {
  if (valeur instanceof Date) {
    return new Date(Date.UTC(valeur.getUTCFullYear(), valeur.getUTCMonth(), valeur.getUTCDate()));
  }
  if (typeof valeur === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur.trim());
    if (!m) throw new ErreurChronogramme(`${contexte} : format attendu AAAA-MM-JJ, reçu « ${valeur} ».`);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== +m[2] - 1) {
      throw new ErreurChronogramme(`${contexte} : date inexistante au calendrier (« ${valeur} »).`);
    }
    return d;
  }
  throw new ErreurChronogramme(`${contexte} : date absente ou de type inattendu (${typeof valeur}).`);
}

/** Date UTC → 'AAAA-MM-JJ'. */
export function enIso(d) {
  return d.toISOString().slice(0, 10);
}

/** Date UTC → 'JJ/MM/AAAA' (restitution française). */
export function enFr(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function ajouterJours(d, n) {
  return new Date(d.getTime() + n * MS_JOUR);
}

/**
 * Construit le calendrier de travail à partir des paramètres du YAML.
 * `joursOuvres: false` désactive l'exclusion week-ends + fériés (tout jour compte).
 */
export function construireCalendrier(parametres = {}) {
  const feries = new Set(
    (parametres.jours_feries ?? []).map((f, i) => enIso(versDate(f, `parametres.jours_feries[${i}]`))),
  );
  return { joursOuvres: parametres.jours_ouvres !== false, feries };
}

export function estJourOuvre(d, cal) {
  if (!cal.joursOuvres) return true;
  const jour = d.getUTCDay(); // 0 = dimanche, 6 = samedi
  if (jour === 0 || jour === 6) return false;
  return !cal.feries.has(enIso(d));
}

/** Premier jour ouvré à partir de `d` (`d` inclus). */
export function prochainJourOuvre(d, cal) {
  let cur = d;
  for (let garde = 0; garde < 400; garde++) {
    if (estJourOuvre(cur, cal)) return cur;
    cur = ajouterJours(cur, 1);
  }
  throw new ErreurChronogramme(
    `Aucun jour ouvré trouvé dans les 400 jours suivant le ${enFr(d)} — vérifier « jours_feries ».`,
  );
}

/**
 * Date de fin d'une activité de `duree` jours ouvrés démarrant à `debut`.
 * Le jour de début compte pour 1. `duree = 1` ⇒ fin = début.
 */
export function ajouterJoursOuvres(debut, duree, cal) {
  if (!Number.isInteger(duree) || duree < 1) {
    throw new ErreurChronogramme(`Durée invalide : ${duree} — attendu un entier ≥ 1.`);
  }
  let cur = prochainJourOuvre(debut, cal);
  let restant = duree - 1;
  while (restant > 0) {
    cur = ajouterJours(cur, 1);
    if (estJourOuvre(cur, cal)) restant--;
  }
  return cur;
}

/** Nombre de jours ouvrés entre `debut` et `fin`, bornes incluses. */
export function compterJoursOuvres(debut, fin, cal) {
  if (fin.getTime() < debut.getTime()) {
    throw new ErreurChronogramme(
      `Date de fin (${enFr(fin)}) antérieure à la date de début (${enFr(debut)}).`,
    );
  }
  let n = 0;
  for (let cur = debut; cur.getTime() <= fin.getTime(); cur = ajouterJours(cur, 1)) {
    if (estJourOuvre(cur, cal)) n++;
  }
  return n;
}

// =============================================================================
// 2. Chargement et validation
// =============================================================================

const STATUTS = ['termine', 'en_cours', 'a_venir', 'en_retard'];

export function chargerYaml(chemin) {
  let brut;
  try {
    brut = readFileSync(chemin, 'utf8');
  } catch {
    throw new ErreurChronogramme(`Fichier introuvable ou illisible : ${chemin}`);
  }
  try {
    return YAML.parse(brut);
  } catch (e) {
    throw new ErreurChronogramme(`YAML mal formé (${chemin}) : ${e.message}`);
  }
}

/**
 * Contrôle la cohérence du modèle. Lève une `ErreurChronogramme` au premier
 * problème bloquant, avec l'identifiant fautif dans le message.
 */
export function validerDonnees(donnees) {
  if (!donnees || typeof donnees !== 'object') {
    throw new ErreurChronogramme('Le YAML ne contient aucun document exploitable.');
  }
  const p = donnees.parametres;
  if (!p) throw new ErreurChronogramme('Section « parametres » absente.');
  versDate(p.date_demarrage, 'parametres.date_demarrage');
  versDate(p.date_arrete, 'parametres.date_arrete');
  if (p.date_fin_contractuelle) versDate(p.date_fin_contractuelle, 'parametres.date_fin_contractuelle');

  const lots = [
    ['module_planification', donnees.module_planification],
    ['global_prs2', donnees.global_prs2],
  ];
  const toutes = [];
  for (const [nom, lot] of lots) {
    if (!Array.isArray(lot)) throw new ErreurChronogramme(`Section « ${nom} » absente ou non listée.`);
    if (lot.length === 0) throw new ErreurChronogramme(`Section « ${nom} » vide.`);
    for (const a of lot) toutes.push({ ...a, _section: nom });
  }

  // -- Identifiants
  const vus = new Map();
  for (const a of toutes) {
    if (!a.id || typeof a.id !== 'string') {
      throw new ErreurChronogramme(`${a._section} : une activité n'a pas d'« id » exploitable (${JSON.stringify(a.libelle ?? a)}).`);
    }
    if (vus.has(a.id)) {
      throw new ErreurChronogramme(`Identifiant en double : « ${a.id} » apparaît dans ${vus.get(a.id)} et ${a._section}.`);
    }
    vus.set(a.id, a._section);
  }

  // -- Champs de chaque activité
  for (const a of toutes) {
    if (!STATUTS.includes(a.statut)) {
      throw new ErreurChronogramme(`${a.id} : statut « ${a.statut} » inconnu — attendu ${STATUTS.join(' | ')}.`);
    }
    if (!Number.isInteger(a.avancement) || a.avancement < 0 || a.avancement > 100) {
      throw new ErreurChronogramme(`${a.id} : avancement « ${a.avancement} » hors bornes — attendu un entier de 0 à 100.`);
    }
    if ((a.statut === 'termine' || a.statut === 'en_cours') && !a.preuve) {
      throw new ErreurChronogramme(
        `${a.id} : « preuve » obligatoire pour un élément ${a.statut} (commit, fichier ou test à citer).`,
      );
    }
    versDate(a.debut, `${a.id}.debut`);
    const aDuree = a.duree_jours !== undefined && a.duree_jours !== null;
    const aFin = a.fin !== undefined && a.fin !== null;
    if (!aDuree && !aFin) {
      throw new ErreurChronogramme(`${a.id} : ni « duree_jours » ni « fin » — impossible de placer l'activité.`);
    }
    if (aDuree && (!Number.isInteger(a.duree_jours) || a.duree_jours < 1)) {
      throw new ErreurChronogramme(`${a.id} : duree_jours = ${a.duree_jours} — attendu un entier ≥ 1.`);
    }
    if (aFin) {
      const debut = versDate(a.debut, `${a.id}.debut`);
      const fin = versDate(a.fin, `${a.id}.fin`);
      if (fin.getTime() < debut.getTime()) {
        throw new ErreurChronogramme(
          `${a.id} : date de fin (${enFr(fin)}) antérieure à la date de début (${enFr(debut)}).`,
        );
      }
    }
    if (!Array.isArray(a.dependances ?? [])) {
      throw new ErreurChronogramme(`${a.id} : « dependances » doit être une liste.`);
    }
  }

  // -- Dépendances existantes
  for (const a of toutes) {
    for (const dep of a.dependances ?? []) {
      if (!vus.has(dep)) {
        throw new ErreurChronogramme(`${a.id} : dépendance « ${dep} » inexistante.`);
      }
      if (dep === a.id) {
        throw new ErreurChronogramme(`${a.id} : dépendance sur elle-même.`);
      }
    }
  }

  // -- Jalons
  const jalons = donnees.jalons ?? [];
  if (!Array.isArray(jalons)) throw new ErreurChronogramme('Section « jalons » non listée.');
  const codes = new Set();
  for (const j of jalons) {
    if (!j.code) throw new ErreurChronogramme(`Jalon sans « code » : ${JSON.stringify(j.libelle ?? j)}.`);
    if (codes.has(j.code)) throw new ErreurChronogramme(`Code de jalon en double : « ${j.code} ».`);
    codes.add(j.code);
    versDate(j.date_cible, `jalon ${j.code}.date_cible`);
  }
  for (const a of toutes) {
    if (a.jalon && !codes.has(a.jalon)) {
      throw new ErreurChronogramme(`${a.id} : jalon « ${a.jalon} » non déclaré dans la section « jalons ».`);
    }
  }

  // -- Cycles (lève si le graphe n'est pas un DAG)
  ordonnerTopologique(toutes);

  return toutes;
}

/**
 * Tri topologique par parcours en profondeur. Lève une `ErreurChronogramme`
 * décrivant le cycle exact (`A → B → C → A`) s'il y en a un.
 */
export function ordonnerTopologique(activites) {
  const parId = new Map(activites.map((a) => [a.id, a]));
  const etat = new Map(); // 0 = non vu, 1 = en cours d'exploration, 2 = terminé
  const ordre = [];
  const pile = [];

  const visiter = (id) => {
    const marque = etat.get(id) ?? 0;
    if (marque === 2) return;
    if (marque === 1) {
      const depart = pile.indexOf(id);
      const cycle = [...pile.slice(depart), id].join(' → ');
      throw new ErreurChronogramme(`Cycle de dépendances détecté : ${cycle}`);
    }
    etat.set(id, 1);
    pile.push(id);
    for (const dep of parId.get(id)?.dependances ?? []) {
      if (parId.has(dep)) visiter(dep);
    }
    pile.pop();
    etat.set(id, 2);
    ordre.push(id);
  };

  for (const a of activites) visiter(a.id);
  return ordre;
}

// =============================================================================
// 3. Calculs — dates, chemin critique, retards
// =============================================================================

/**
 * Statut réel d'une activité à la date d'arrêté, indépendamment du statut déclaré.
 * Une activité dont la fenêtre est close alors que l'avancement n'atteint pas
 * 100 % est EN RETARD.
 */
export function statutCalcule(activite, dateArrete) {
  if (activite.avancement >= 100) return 'termine';
  if (activite.fin.getTime() < dateArrete.getTime()) return 'en_retard';
  if (activite.debut.getTime() > dateArrete.getTime()) return 'a_venir';
  return 'en_cours';
}

/**
 * Chemin critique : la chaîne de dépendances la plus lourde menant à la FIN du
 * projet.
 *
 * Le point d'arrivée est l'activité qui se termine le plus tard — pas celle dont
 * la chaîne cumule le plus de jours. La nuance compte : sur PRS 2.0, la chaîne la
 * plus lourde en jours (A01 → A02 → A09 → A10 → A12 → A13, 53 j) s'achève sur une
 * interruption de juillet-août, quand ce qui intéresse le pilotage est le chemin
 * qui conditionne la livraison de septembre. À date de fin égale, on départage
 * par la durée cumulée, puis par l'identifiant (résultat déterministe).
 *
 * Renvoie la liste ordonnée des identifiants.
 */
export function cheminCritique(activites) {
  const parId = new Map(activites.map((a) => [a.id, a]));
  const ordre = ordonnerTopologique(activites);
  const longueur = new Map();
  const precedent = new Map();

  for (const id of ordre) {
    const a = parId.get(id);
    let meilleure = 0;
    let via = null;
    for (const dep of a.dependances ?? []) {
      if (!parId.has(dep)) continue;
      const l = longueur.get(dep) ?? 0;
      if (l > meilleure) {
        meilleure = l;
        via = dep;
      }
    }
    longueur.set(id, meilleure + a.dureeJours);
    precedent.set(id, via);
  }

  // Point d'arrivée : la fin la plus tardive ; à égalité, la chaîne la plus
  // lourde ; à égalité encore, l'identifiant (pour un résultat reproductible).
  let terminal = null;
  for (const id of longueur.keys()) {
    if (terminal === null) {
      terminal = id;
      continue;
    }
    const a = parId.get(id);
    const b = parId.get(terminal);
    const rang =
      a.fin.getTime() - b.fin.getTime() ||
      longueur.get(id) - longueur.get(terminal) ||
      (id < terminal ? 1 : -1);
    if (rang > 0) terminal = id;
  }

  const chemin = [];
  for (let id = terminal; id; id = precedent.get(id)) chemin.unshift(id);
  return chemin;
}

/** Résout dates, durées, statuts, chemin critique et avertissements. */
export function calculerPlanning(donnees) {
  const toutes = validerDonnees(donnees);
  const cal = construireCalendrier(donnees.parametres);
  const dateDemarrage = versDate(donnees.parametres.date_demarrage);
  const dateArrete = versDate(donnees.parametres.date_arrete);
  const avertissements = [];

  const resolue = (a) => {
    const debutDeclare = versDate(a.debut, `${a.id}.debut`);
    const debut = prochainJourOuvre(debutDeclare, cal);
    if (debut.getTime() !== debutDeclare.getTime()) {
      avertissements.push(
        `${a.id} : début déclaré le ${enFr(debutDeclare)} (jour non ouvré) → décalé au ${enFr(debut)}.`,
      );
    }
    let fin;
    let dureeJours;
    if (a.fin !== undefined && a.fin !== null) {
      fin = versDate(a.fin, `${a.id}.fin`);
      dureeJours = compterJoursOuvres(debut, fin, cal);
      if (dureeJours === 0) {
        avertissements.push(`${a.id} : fenêtre ${enFr(debut)} → ${enFr(fin)} sans aucun jour ouvré.`);
        dureeJours = 1;
      }
    } else {
      dureeJours = a.duree_jours;
      fin = ajouterJoursOuvres(debut, dureeJours, cal);
    }
    return {
      ...a,
      debutDeclare,
      debut,
      fin,
      dureeJours,
      dependances: a.dependances ?? [],
      dureeCalendaire: Math.round((fin - debut) / MS_JOUR) + 1,
    };
  };

  const activites = (donnees.module_planification ?? []).map(resolue);
  const global = (donnees.global_prs2 ?? []).map(resolue);
  const parId = new Map([...activites, ...global].map((a) => [a.id, a]));

  // Statut réel + écarts avec le statut déclaré.
  for (const a of [...activites, ...global]) {
    a.statutCalcule = statutCalcule(a, dateArrete);
    a.enRetard = a.statutCalcule === 'en_retard';
    if (a.statutCalcule !== a.statut) {
      avertissements.push(
        `${a.id} : statut déclaré « ${a.statut} », calculé « ${a.statutCalcule} » (fin ${enFr(a.fin)}, avancement ${a.avancement} %).`,
      );
    }
    // Séquencement : on signale sans replanifier (cf. en-tête du fichier).
    for (const dep of a.dependances) {
      const d = parId.get(dep);
      if (d && a.debut.getTime() <= d.fin.getTime()) {
        avertissements.push(
          `${a.id} : démarre le ${enFr(a.debut)}, avant la fin de sa dépendance ${dep} (${enFr(d.fin)}) — chevauchement assumé, non replanifié.`,
        );
      }
    }
  }

  const critiqueModule = cheminCritique(activites);
  const critiqueGlobal = cheminCritique(global);
  const setCritique = new Set([...critiqueModule, ...critiqueGlobal]);
  for (const a of [...activites, ...global]) a.critique = setCritique.has(a.id);

  const jalons = (donnees.jalons ?? []).map((j) => ({
    ...j,
    dateCible: versDate(j.date_cible, `jalon ${j.code}.date_cible`),
    franchi: versDate(j.date_cible).getTime() <= dateArrete.getTime(),
  }));

  return {
    parametres: donnees.parametres,
    calendrier: cal,
    dateDemarrage,
    dateArrete,
    dateFinContractuelle: donnees.parametres.date_fin_contractuelle
      ? versDate(donnees.parametres.date_fin_contractuelle)
      : null,
    activites,
    global,
    jalons,
    critiqueModule,
    critiqueGlobal,
    avertissements,
    synthese: construireSynthese(activites, global, jalons, dateArrete),
  };
}

/** Encart de synthèse : avancement, jalons, prochaine échéance, retards. */
export function construireSynthese(activites, global, jalons, dateArrete) {
  const somme = activites.reduce((s, a) => s + a.avancement * a.dureeJours, 0);
  const poids = activites.reduce((s, a) => s + a.dureeJours, 0);
  const enRetard = activites.filter((a) => a.enRetard);
  const franchis = jalons.filter((j) => j.franchi);
  const aVenir = jalons
    .filter((j) => !j.franchi)
    .sort((x, y) => x.dateCible - y.dateCible);

  return {
    avancementPondere: poids ? Math.round(somme / poids) : 0,
    avancementModuleDeclare: global.length ? global[0].avancement : null,
    nbActivites: activites.length,
    nbTerminees: activites.filter((a) => a.statutCalcule === 'termine').length,
    nbEnCours: activites.filter((a) => a.statutCalcule === 'en_cours').length,
    nbAVenir: activites.filter((a) => a.statutCalcule === 'a_venir').length,
    enRetard,
    jalonsFranchis: franchis,
    jalonsAVenir: aVenir,
    prochaineEcheance: aVenir[0] ?? null,
    joursAvantEcheance: aVenir[0]
      ? Math.round((aVenir[0].dateCible - dateArrete) / MS_JOUR)
      : null,
  };
}

// =============================================================================
// 4. Grilles de Gantt — colonnes hebdomadaires et mensuelles
// =============================================================================

/**
 * Nombre de colonnes : au moins la valeur déclarée dans le YAML, étendu autant
 * qu'il faut pour couvrir `finMax`. Évite deux pièges symétriques — une grille
 * trop courte qui tronque une activité, et l'arithmétique approximative d'un
 * `Math.ceil` sur des mois de longueur variable.
 */
function nbColonnes(declare, fabrique, finMax) {
  let n = Math.max(declare ?? 1, 1);
  for (let garde = 0; garde < 600 && fabrique(n - 1).fin.getTime() < finMax.getTime(); garde++) n++;
  return n;
}

/**
 * Colonnes hebdomadaires : S1, S2… ancrées sur la date de démarrage.
 * L'étendue est bornée par les activités du module 1 ET par les seuls jalons
 * qu'elles portent — surtout pas par les jalons des modules 2 à 4, qui feraient
 * exploser la grille jusqu'en 2027.
 */
export function grilleSemaines(plan) {
  const jalonsDuModule = new Set(plan.activites.map((a) => a.jalon).filter(Boolean));
  const bornes = [
    ...plan.activites.map((a) => a.fin),
    ...plan.jalons.filter((j) => jalonsDuModule.has(j.code)).map((j) => j.dateCible),
  ];
  const finMax = bornes.reduce((m, f) => (f > m ? f : m), plan.dateDemarrage);
  const fabrique = (i) => {
    const debut = ajouterJours(plan.dateDemarrage, i * 7);
    return { index: i, code: `S${i + 1}`, debut, fin: ajouterJours(debut, 6), offset: i * 7 };
  };
  return Array.from({ length: nbColonnes(plan.parametres.semaines_gantt, fabrique, finMax) }, (_, i) =>
    fabrique(i),
  );
}

/** Colonnes mensuelles : M1, M2… en mois glissants depuis la date de démarrage. */
export function grilleMois(plan) {
  const finMax = plan.global.reduce((m, a) => (a.fin > m ? a.fin : m), plan.dateDemarrage);
  const moisApres = (i) =>
    new Date(
      Date.UTC(
        plan.dateDemarrage.getUTCFullYear(),
        plan.dateDemarrage.getUTCMonth() + i,
        plan.dateDemarrage.getUTCDate(),
      ),
    );
  const fabrique = (i) => ({
    index: i,
    code: `M${i + 1}`,
    debut: moisApres(i),
    fin: ajouterJours(moisApres(i + 1), -1),
  });
  return Array.from({ length: nbColonnes(plan.parametres.mois_gantt, fabrique, finMax) }, (_, i) =>
    fabrique(i),
  );
}

/** Une colonne est occupée si l'activité en chevauche l'intervalle. */
export function colonneOccupee(activite, colonne) {
  return activite.debut.getTime() <= colonne.fin.getTime() && activite.fin.getTime() >= colonne.debut.getTime();
}

/** Index de la colonne contenant une date (−1 si hors grille). */
export function colonneDe(date, colonnes) {
  return colonnes.findIndex((c) => date.getTime() >= c.debut.getTime() && date.getTime() <= c.fin.getTime());
}

// =============================================================================
// 5. Rendu Excel
// =============================================================================

const COULEURS = {
  termine: 'FF16A34A',
  en_cours: 'FF2563EB',
  a_venir: 'FF9CA3AF',
  en_retard: 'FFDC2626',
};
const ENTETE_BG = 'FF1E293B';
const SOUS_ENTETE_BG = 'FFE2E8F0';
const AUJOURDHUI = 'FFB45309';

const decalage = (date, origine) => Math.round((date - origine) / MS_JOUR);

/** Cellule date exprimée en formule ancrée sur Parametres!$B$2. */
function celluleDate(cellule, date, origine) {
  const n = decalage(date, origine);
  cellule.value = { formula: `Parametres!$B$2${n >= 0 ? '+' : '-'}${Math.abs(n)}`, result: date };
  cellule.numFmt = 'dd/mm/yyyy';
  cellule.alignment = { horizontal: 'center' };
}

function styleEntete(ligne, nbColonnes) {
  for (let c = 1; c <= nbColonnes; c++) {
    const cell = ligne.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENTETE_BG } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF475569' } } };
  }
}

const COLONNES_FIXES = [
  { cle: 'id', titre: 'ID', largeur: 6 },
  { cle: 'libelle', titre: 'Activité', largeur: 46 },
  { cle: 'livrable', titre: 'Livrable', largeur: 38 },
  { cle: 'responsable', titre: 'Responsable', largeur: 18 },
  { cle: 'statut', titre: 'Statut', largeur: 12 },
  { cle: 'avancement', titre: '%', largeur: 6 },
  { cle: 'debut', titre: 'Début', largeur: 11 },
  { cle: 'fin', titre: 'Fin', largeur: 11 },
  { cle: 'duree', titre: 'Durée (j)', largeur: 9 },
  { cle: 'dependances', titre: 'Dépend.', largeur: 12 },
  { cle: 'jalon', titre: 'Jalon', largeur: 7 },
  { cle: 'critique', titre: 'Critique', largeur: 8 },
  { cle: 'preuve', titre: 'Preuve / constat', largeur: 60 },
];

/** Construit un onglet de Gantt (hebdomadaire ou mensuel). */
function ongletGantt(classeur, nom, titre, activites, colonnes, plan) {
  const ws = classeur.addWorksheet(nom, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const nbFixes = COLONNES_FIXES.length;
  const nbTotal = nbFixes + colonnes.length;

  COLONNES_FIXES.forEach((c, i) => (ws.getColumn(i + 1).width = c.largeur));
  for (let i = 0; i < colonnes.length; i++) ws.getColumn(nbFixes + 1 + i).width = 4.4;

  // Ligne 1 — titre
  ws.mergeCells(1, 1, 1, Math.max(nbTotal, 2));
  const t = ws.getCell(1, 1);
  t.value = titre;
  t.font = { bold: true, size: 14, color: { argb: ENTETE_BG } };
  ws.getRow(1).height = 22;

  // Ligne 2 — contexte
  ws.mergeCells(2, 1, 2, Math.max(nbTotal, 2));
  const s = ws.getCell(2, 1);
  s.value =
    `Arrêté au ${enFr(plan.dateArrete)} · ${activites.length} lignes · ` +
    `démarrage ${enFr(plan.dateDemarrage)}` +
    (plan.dateFinContractuelle ? ` · échéance ${enFr(plan.dateFinContractuelle)}` : '');
  s.font = { size: 10, italic: true, color: { argb: 'FF475569' } };

  // Ligne 3 — en-têtes de colonnes + codes de période
  const l3 = ws.getRow(3);
  COLONNES_FIXES.forEach((c, i) => (l3.getCell(i + 1).value = c.titre));
  colonnes.forEach((c, i) => (l3.getCell(nbFixes + 1 + i).value = c.code));
  styleEntete(l3, nbTotal);
  l3.height = 26;

  // Ligne 4 — dates de période, par FORMULE depuis Parametres!$B$2
  const l4 = ws.getRow(4);
  l4.getCell(1).value = '—';
  colonnes.forEach((c, i) => {
    const cell = l4.getCell(nbFixes + 1 + i);
    if (nom === 'Global_PRS2') {
      cell.value = { formula: `EDATE(Parametres!$B$2,${c.index})`, result: c.debut };
    } else {
      cell.value = { formula: `Parametres!$B$2+${c.offset}`, result: c.debut };
    }
    cell.numFmt = 'dd/mm';
    cell.font = { size: 8, color: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', textRotation: 90 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOUS_ENTETE_BG } };
  });
  l4.height = 34;

  const colAujourdhui = colonneDe(plan.dateArrete, colonnes);

  // Lignes d'activités
  activites.forEach((a, idx) => {
    const r = ws.getRow(5 + idx);
    r.getCell(1).value = a.id;
    r.getCell(2).value = a.libelle;
    r.getCell(3).value = a.livrable ?? '';
    r.getCell(4).value = a.responsable ?? '';
    r.getCell(5).value = a.statutCalcule;
    const pct = r.getCell(6);
    pct.value = a.avancement / 100;
    pct.numFmt = '0 %';
    celluleDate(r.getCell(7), a.debut, plan.dateDemarrage);
    celluleDate(r.getCell(8), a.fin, plan.dateDemarrage);
    r.getCell(9).value = a.dureeJours;
    r.getCell(10).value = (a.dependances ?? []).join(', ');
    r.getCell(11).value = a.jalon ?? '';
    r.getCell(12).value = a.critique ? '◆ oui' : '';
    r.getCell(13).value = a.preuve ?? a.constat_initial ?? a.note ?? '';

    for (let c = 1; c <= nbFixes; c++) {
      const cell = r.getCell(c);
      cell.font = { size: 9 };
      cell.alignment = { vertical: 'top', wrapText: c === 2 || c === 3 || c === 13 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
    }
    r.getCell(5).font = { size: 9, bold: true, color: { argb: COULEURS[a.statutCalcule] } };
    if (a.critique) r.getCell(1).font = { size: 9, bold: true, color: { argb: AUJOURDHUI } };

    // Barre de Gantt
    const jalonCol = a.jalon
      ? colonneDe(plan.jalons.find((j) => j.code === a.jalon)?.dateCible ?? a.fin, colonnes)
      : -1;
    colonnes.forEach((c, i) => {
      const cell = r.getCell(nbFixes + 1 + i);
      if (colonneOccupee(a, c)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COULEURS[a.statutCalcule] } };
      }
      if (i === jalonCol) {
        cell.value = '◆';
        cell.font = { size: 11, bold: true, color: { argb: colonneOccupee(a, c) ? 'FFFFFFFF' : 'FF111827' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (i === colAujourdhui) {
        cell.border = { ...(cell.border ?? {}), left: { style: 'medium', color: { argb: AUJOURDHUI } } };
      }
    });
    r.height = 30;
  });

  // Ligne « aujourd'hui » sur l'en-tête
  if (colAujourdhui >= 0) {
    for (const ligne of [3, 4]) {
      const cell = ws.getRow(ligne).getCell(nbFixes + 1 + colAujourdhui);
      cell.border = { ...(cell.border ?? {}), left: { style: 'medium', color: { argb: AUJOURDHUI } } };
    }
    const marque = ws.getRow(5 + activites.length).getCell(nbFixes + 1 + colAujourdhui);
    marque.value = '▲';
    marque.font = { bold: true, color: { argb: AUJOURDHUI } };
    marque.alignment = { horizontal: 'center' };
    ws.getRow(5 + activites.length).getCell(1).value = `▲ ${enFr(plan.dateArrete)}`;
    ws.getRow(5 + activites.length).getCell(1).font = { size: 9, bold: true, color: { argb: AUJOURDHUI } };
  }

  // Légende
  const ligneLegende = 5 + activites.length + 2;
  ws.getCell(ligneLegende, 1).value = 'Légende';
  ws.getCell(ligneLegende, 1).font = { bold: true, size: 10 };
  const libelles = { termine: 'Terminé', en_cours: 'En cours', a_venir: 'À venir', en_retard: 'En retard' };
  Object.entries(libelles).forEach(([cle, lib], i) => {
    const c = ws.getCell(ligneLegende + 1 + i, 1);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COULEURS[cle] } };
    const l = ws.getCell(ligneLegende + 1 + i, 2);
    l.value = lib;
    l.font = { size: 9 };
  });
  ws.getCell(ligneLegende + 5, 2).value = '◆ jalon      ▲ / trait orange : date d’arrêté (« aujourd’hui »)';
  ws.getCell(ligneLegende + 5, 2).font = { size: 9 };
  ws.getCell(ligneLegende + 6, 2).value = '◆ en colonne « Critique » : activité du chemin critique';
  ws.getCell(ligneLegende + 6, 2).font = { size: 9 };

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 4 + activites.length, column: nbFixes } };
  return ws;
}

function ongletJalons(classeur, plan) {
  const ws = classeur.addWorksheet('Jalons', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [10, 52, 13, 22, 80, 60].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells(1, 1, 1, 6);
  ws.getCell(1, 1).value = 'PRS 2.0 — Jalons';
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: ENTETE_BG } };

  const l3 = ws.getRow(3);
  ['Code', 'Libellé', 'Date cible', 'Statut', 'Critères de validation', 'Preuve'].forEach(
    (t, i) => (l3.getCell(i + 1).value = t),
  );
  styleEntete(l3, 6);
  l3.height = 24;

  plan.jalons.forEach((j, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = `◆ ${j.code}`;
    r.getCell(2).value = j.libelle;
    celluleDate(r.getCell(3), j.dateCible, plan.dateDemarrage);
    r.getCell(4).value = j.statut ?? (j.franchi ? 'franchi' : 'a_venir');
    r.getCell(5).value = (j.criteres_validation ?? []).map((c) => `• ${c}`).join('\n');
    r.getCell(6).value = j.preuve ?? '';
    for (let c = 1; c <= 6; c++) {
      r.getCell(c).font = { size: 9 };
      r.getCell(c).alignment = { vertical: 'top', wrapText: true };
      r.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
    }
    const franchi = j.franchi;
    r.getCell(1).font = { size: 10, bold: true, color: { argb: franchi ? COULEURS.termine : COULEURS.a_venir } };
    r.height = Math.max(30, (j.criteres_validation ?? []).length * 14);
  });
  return ws;
}

function ongletParametres(classeur, plan) {
  const ws = classeur.addWorksheet('Parametres');
  [34, 22, 74].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell('A1').value = 'Paramètre';
  ws.getCell('B1').value = 'Valeur';
  ws.getCell('C1').value = 'Commentaire';
  styleEntete(ws.getRow(1), 3);

  // B2 est l'ANCRE de toutes les formules de date du classeur.
  ws.getCell('A2').value = 'Date de démarrage';
  ws.getCell('B2').value = plan.dateDemarrage;
  ws.getCell('B2').numFmt = 'dd/mm/yyyy';
  ws.getCell('B2').font = { bold: true };
  ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  ws.getCell('C2').value =
    "ANCRE du classeur : toutes les dates des autres onglets sont des formules « =Parametres!$B$2 + n ». "
    + 'Modifier cette cellule décale le calendrier ; relancer le script pour recalculer les couleurs des barres.';

  const lignes = [
    ["Date d'arrêté", plan.dateArrete, "Date d'observation — sert à la détection des retards et à la ligne « aujourd'hui »."],
    [
      'Date de fin contractuelle',
      plan.dateFinContractuelle,
      plan.dateFinContractuelle
        ? `Échéance. Écart au démarrage : ${Math.round((plan.dateFinContractuelle - plan.dateDemarrage) / MS_JOUR)} jours calendaires.`
        : 'Non renseignée.',
    ],
    ['Jours ouvrés', plan.calendrier.joursOuvres ? 'oui' : 'non', 'Week-ends exclus du calcul des durées.'],
    [
      'Jours fériés exclus',
      [...plan.calendrier.feries].join(', ') || '(aucun)',
      'Renseignés dans activites.yaml → parametres.jours_feries.',
    ],
    ['Équipe', (plan.parametres.equipe ?? []).join(', ') || '(non renseignée)', ''],
    ['', '', ''],
    ['SYNTHÈSE', '', ''],
    ['Activités module 1', plan.activites.length, `${plan.synthese.nbTerminees} terminées · ${plan.synthese.nbEnCours} en cours · ${plan.synthese.nbAVenir} à venir`],
    ['Avancement pondéré (durées)', `${plan.synthese.avancementPondere} %`, 'Σ(avancement × durée) / Σ(durée) sur le module 1.'],
    [
      'Avancement module 1 déclaré',
      plan.synthese.avancementModuleDeclare !== null ? `${plan.synthese.avancementModuleDeclare} %` : '(n/a)',
      'Valeur portée par la ligne globale, adossée à sa preuve.',
    ],
    ['Activités en retard', plan.synthese.enRetard.length, plan.synthese.enRetard.map((a) => a.id).join(', ') || '(aucune)'],
    ['Jalons franchis', plan.synthese.jalonsFranchis.length, plan.synthese.jalonsFranchis.map((j) => j.code).join(', ') || '(aucun)'],
    [
      'Prochaine échéance',
      plan.synthese.prochaineEcheance ? enFr(plan.synthese.prochaineEcheance.dateCible) : '(aucune)',
      plan.synthese.prochaineEcheance
        ? `${plan.synthese.prochaineEcheance.code} — ${plan.synthese.prochaineEcheance.libelle} (dans ${plan.synthese.joursAvantEcheance} jours)`
        : '',
    ],
    ['Chemin critique — module 1', plan.critiqueModule.join(' → '), `${plan.critiqueModule.length} activités.`],
    ['Chemin critique — global', plan.critiqueGlobal.join(' → '), `${plan.critiqueGlobal.length} lignes.`],
  ];

  lignes.forEach((l, i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = l[0];
    r.getCell(2).value = l[1];
    r.getCell(3).value = l[2];
    if (l[1] instanceof Date) r.getCell(2).numFmt = 'dd/mm/yyyy';
    if (l[0] === 'SYNTHÈSE') r.getCell(1).font = { bold: true, size: 11, color: { argb: ENTETE_BG } };
    for (let c = 1; c <= 3; c++) r.getCell(c).alignment = { vertical: 'top', wrapText: c === 3 };
  });

  if (plan.avertissements.length) {
    const base = 3 + lignes.length + 2;
    ws.getCell(base, 1).value = `AVERTISSEMENTS (${plan.avertissements.length})`;
    ws.getCell(base, 1).font = { bold: true, size: 11, color: { argb: AUJOURDHUI } };
    plan.avertissements.forEach((m, i) => {
      const c = ws.getCell(base + 1 + i, 1);
      c.value = `• ${m}`;
      c.font = { size: 9, color: { argb: 'FF7C2D12' } };
      ws.mergeCells(base + 1 + i, 1, base + 1 + i, 3);
    });
  }
  return ws;
}

export async function genererXlsx(plan, chemin) {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'generer_chronogramme.mjs';
  classeur.created = plan.dateArrete;

  ongletGantt(
    classeur,
    'Module_Planification',
    'PRS 2.0 — Module 1 : socle transversal et dossiers de planification (Gantt hebdomadaire)',
    plan.activites,
    grilleSemaines(plan),
    plan,
  );
  ongletGantt(
    classeur,
    'Global_PRS2',
    'PRS 2.0 — Vue globale des 4 modules (Gantt mensuel)',
    plan.global,
    grilleMois(plan),
    plan,
  );
  ongletJalons(classeur, plan);
  ongletParametres(classeur, plan);

  await classeur.xlsx.writeFile(chemin);
  return chemin;
}

// =============================================================================
// 6. Rendu HTML — page autonome, imprimable A4 paysage
// =============================================================================

const echapper = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function tableGantt(activites, colonnes, plan, titre) {
  const colAuj = colonneDe(plan.dateArrete, colonnes);
  const entetes = colonnes
    .map(
      (c, i) =>
        `<th class="p${i === colAuj ? ' auj' : ''}"><span class="code">${c.code}</span><span class="date">${enFr(c.debut).slice(0, 5)}</span></th>`,
    )
    .join('');

  const lignes = activites
    .map((a) => {
      const jalonDate = a.jalon ? plan.jalons.find((j) => j.code === a.jalon)?.dateCible : null;
      const jalonCol = jalonDate ? colonneDe(jalonDate, colonnes) : -1;
      const cellules = colonnes
        .map((c, i) => {
          const cls = ['p'];
          if (colonneOccupee(a, c)) cls.push('bar', a.statutCalcule);
          if (i === colAuj) cls.push('auj');
          const marque = i === jalonCol ? `<span class="jalon">◆</span>` : '';
          return `<td class="${cls.join(' ')}">${marque}</td>`;
        })
        .join('');
      return `<tr${a.critique ? ' class="critique"' : ''}>
        <td class="id">${echapper(a.id)}${a.critique ? ' <span class="cc" title="chemin critique">◆</span>' : ''}</td>
        <td class="lib"><strong>${echapper(a.libelle)}</strong><span class="livr">${echapper(a.livrable ?? '')}</span></td>
        <td class="resp">${echapper(a.responsable ?? '—')}</td>
        <td class="st"><span class="pastille ${a.statutCalcule}"></span>${echapper(a.statutCalcule.replace('_', ' '))}</td>
        <td class="pct"><span class="jauge"><i style="width:${a.avancement}%"></i></span>${a.avancement}%</td>
        <td class="dt">${enFr(a.debut)}</td>
        <td class="dt">${enFr(a.fin)}</td>
        <td class="dur">${a.dureeJours}</td>
        ${cellules}
      </tr>`;
    })
    .join('');

  return `<section class="bloc">
    <h2>${echapper(titre)}</h2>
    <div class="scroll"><table class="gantt">
      <thead><tr>
        <th class="id">ID</th><th class="lib">Activité / livrable</th><th class="resp">Resp.</th>
        <th class="st">Statut</th><th class="pct">Avanc.</th><th class="dt">Début</th>
        <th class="dt">Fin</th><th class="dur">j</th>${entetes}
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table></div>
  </section>`;
}

export function genererHtml(plan) {
  const s = plan.synthese;
  const retards = s.enRetard.length
    ? s.enRetard
        .map(
          (a) =>
            `<li><strong>${echapper(a.id)}</strong> — ${echapper(a.libelle)} <span class="muted">(fin ${enFr(a.fin)}, ${a.avancement} %, ${echapper(a.responsable ?? '—')})</span></li>`,
        )
        .join('')
    : '<li class="ok">Aucune activité en retard.</li>';

  const jalonsHtml = plan.jalons
    .map(
      (j) => `<tr class="${j.franchi ? 'franchi' : 'attente'}">
      <td class="code">◆ ${echapper(j.code)}</td>
      <td>${echapper(j.libelle)}</td>
      <td class="dt">${enFr(j.dateCible)}</td>
      <td class="st">${echapper(j.statut ?? (j.franchi ? 'franchi' : 'a_venir'))}</td>
      <td class="crit"><ul>${(j.criteres_validation ?? []).map((c) => `<li>${echapper(c)}</li>`).join('')}</ul></td>
    </tr>`,
    )
    .join('');

  const avert = plan.avertissements.length
    ? `<section class="bloc avert"><h2>Avertissements de cohérence (${plan.avertissements.length})</h2><ul>${plan.avertissements
        .map((m) => `<li>${echapper(m)}</li>`)
        .join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PRS 2.0 — Chronogramme</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #0f172a; background: #f8fafc; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 0 0 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }
  .sous { color: #475569; margin: 0 0 16px; font-size: 12px; }
  .bloc { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 14px;
          break-inside: avoid; }
  .scroll { overflow-x: auto; }

  /* Synthèse */
  .synthese { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .carte { background: #fff; border: 1px solid #cbd5e1; border-left: 4px solid #2563eb; border-radius: 6px; padding: 10px 12px; }
  .carte .v { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .carte .l { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .carte .d { color: #334155; font-size: 11px; margin-top: 4px; }
  .carte.vert { border-left-color: #16a34a; } .carte.rouge { border-left-color: #dc2626; }
  .carte.orange { border-left-color: #b45309; }

  /* Gantt */
  table.gantt { border-collapse: collapse; width: 100%; font-size: 10px; }
  table.gantt th, table.gantt td { border: 1px solid #e2e8f0; padding: 3px 5px; vertical-align: top; }
  table.gantt thead th { background: #1e293b; color: #fff; font-weight: 600; position: sticky; top: 0; }
  table.gantt th.p, table.gantt td.p { width: 20px; min-width: 20px; padding: 0; text-align: center; }
  table.gantt th.p .code { display: block; font-size: 9px; }
  table.gantt th.p .date { display: block; font-size: 7px; font-weight: 400; opacity: .75; }
  td.bar.termine   { background: #16a34a; } td.bar.en_cours { background: #2563eb; }
  td.bar.a_venir   { background: #9ca3af; } td.bar.en_retard { background: #dc2626; }
  th.auj, td.auj { border-left: 2px solid #b45309 !important; }
  .jalon { color: #111827; font-weight: 700; font-size: 11px; }
  td.bar .jalon { color: #fff; }
  td.id { font-weight: 700; white-space: nowrap; } .cc { color: #b45309; }
  tr.critique td.id { color: #b45309; }
  td.lib { min-width: 220px; } td.lib strong { display: block; }
  td.lib .livr { display: block; color: #64748b; font-size: 9px; margin-top: 2px; }
  td.resp, td.st, td.dt { white-space: nowrap; } td.dur, td.pct { text-align: center; white-space: nowrap; }
  .pastille { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
  .pastille.termine { background: #16a34a; } .pastille.en_cours { background: #2563eb; }
  .pastille.a_venir { background: #9ca3af; } .pastille.en_retard { background: #dc2626; }
  .jauge { display: inline-block; width: 34px; height: 6px; background: #e2e8f0; border-radius: 3px;
           overflow: hidden; margin-right: 4px; vertical-align: middle; }
  .jauge i { display: block; height: 100%; background: #2563eb; }

  /* Jalons */
  table.jalons { border-collapse: collapse; width: 100%; font-size: 11px; }
  table.jalons th, table.jalons td { border: 1px solid #e2e8f0; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.jalons thead th { background: #1e293b; color: #fff; }
  tr.franchi td.code { color: #16a34a; font-weight: 700; }
  tr.attente td.code { color: #9ca3af; font-weight: 700; }
  table.jalons ul { margin: 0; padding-left: 16px; } table.jalons li { margin: 1px 0; }

  /* Légende & divers */
  .legende { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 11px; }
  .legende .item { display: flex; align-items: center; gap: 5px; }
  .sw { width: 16px; height: 10px; border-radius: 2px; border: 1px solid #94a3b8; }
  .muted { color: #64748b; } .ok { color: #16a34a; }
  .avert ul { margin: 0; padding-left: 18px; color: #7c2d12; }
  .avert li { margin: 2px 0; }
  footer { color: #64748b; font-size: 10px; margin-top: 12px; }
  @media print { body { background: #fff; padding: 0; font-size: 9px; }
    .bloc { border-color: #94a3b8; } table.gantt thead th { position: static; }
    .synthese { grid-template-columns: repeat(4, 1fr); } }
</style>
</head>
<body>

<h1>PRS 2.0 — Chronogramme</h1>
<p class="sous">
  Contrôle de la passation des marchés publics ·
  démarrage <strong>${enFr(plan.dateDemarrage)}</strong> ·
  arrêté au <strong>${enFr(plan.dateArrete)}</strong>${plan.dateFinContractuelle ? ` · échéance contractuelle <strong>${enFr(plan.dateFinContractuelle)}</strong>` : ''}
</p>

<div class="synthese">
  <div class="carte">
    <div class="l">Avancement module 1</div>
    <div class="v">${s.avancementModuleDeclare !== null ? s.avancementModuleDeclare : s.avancementPondere} %</div>
    <div class="d">${s.avancementPondere} % pondéré par les durées · ${s.nbTerminees}/${s.nbActivites} activités terminées</div>
  </div>
  <div class="carte vert">
    <div class="l">Jalons franchis</div>
    <div class="v">${s.jalonsFranchis.length} / ${plan.jalons.length}</div>
    <div class="d">${s.jalonsFranchis.map((j) => echapper(j.code)).join(', ') || '—'}</div>
  </div>
  <div class="carte orange">
    <div class="l">Prochaine échéance</div>
    <div class="v">${s.prochaineEcheance ? enFr(s.prochaineEcheance.dateCible) : '—'}</div>
    <div class="d">${s.prochaineEcheance ? `${echapper(s.prochaineEcheance.code)} — ${echapper(s.prochaineEcheance.libelle)} · dans ${s.joursAvantEcheance} jours` : 'Aucune échéance à venir'}</div>
  </div>
  <div class="carte rouge">
    <div class="l">Activités en retard</div>
    <div class="v">${s.enRetard.length}</div>
    <div class="d">${s.enRetard.map((a) => echapper(a.id)).join(', ') || 'Aucune'}</div>
  </div>
</div>

${tableGantt(plan.activites, grilleSemaines(plan), plan, 'Module 1 — socle transversal et dossiers de planification (semaines)')}
${tableGantt(plan.global, grilleMois(plan), plan, 'Vue globale PRS 2.0 — les 4 modules (mois)')}

<section class="bloc">
  <h2>Jalons</h2>
  <table class="jalons">
    <thead><tr><th>Code</th><th>Libellé</th><th>Date cible</th><th>Statut</th><th>Critères de validation</th></tr></thead>
    <tbody>${jalonsHtml}</tbody>
  </table>
</section>

<section class="bloc">
  <h2>Activités en retard</h2>
  <ul>${retards}</ul>
</section>

<section class="bloc">
  <h2>Chemin critique</h2>
  <p><strong>Module 1 :</strong> ${plan.critiqueModule.map(echapper).join(' → ')}</p>
  <p><strong>Global :</strong> ${plan.critiqueGlobal.map(echapper).join(' → ')}</p>
  <p class="muted">Chaîne de dépendances de durée cumulée maximale. Les dates observées faisant foi, le générateur ne replanifie pas derrière les dépendances : les chevauchements sont signalés ci-dessous.</p>
</section>

<section class="bloc">
  <h2>Légende</h2>
  <div class="legende">
    <span class="item"><span class="sw" style="background:#16a34a"></span> Terminé</span>
    <span class="item"><span class="sw" style="background:#2563eb"></span> En cours</span>
    <span class="item"><span class="sw" style="background:#9ca3af"></span> À venir</span>
    <span class="item"><span class="sw" style="background:#dc2626"></span> En retard</span>
    <span class="item"><span class="jalon">◆</span> Jalon</span>
    <span class="item"><span class="sw" style="background:#fff;border-left:2px solid #b45309"></span> Ligne « aujourd'hui » (${enFr(plan.dateArrete)})</span>
    <span class="item"><span class="cc">◆</span> Activité du chemin critique</span>
  </div>
</section>

${avert}

<footer>
  Généré par <code>generer_chronogramme.mjs</code> depuis <code>activites.yaml</code> —
  jours ouvrés : ${plan.calendrier.joursOuvres ? 'oui' : 'non'} ·
  jours fériés exclus : ${[...plan.calendrier.feries].map(enFr_iso).join(', ') || 'aucun'}.
  Toute correction se fait dans le YAML, jamais dans cette page.
</footer>

</body>
</html>`;
}

/** 'AAAA-MM-JJ' → 'JJ/MM/AAAA' (pour les fériés stockés en chaîne). */
function enFr_iso(iso) {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

// =============================================================================
// 7. Point d'entrée
// =============================================================================

export async function principal(cheminYaml) {
  const yaml = cheminYaml ?? resolve(DOSSIER, 'activites.yaml');
  console.log(`Lecture   : ${yaml}`);
  const donnees = chargerYaml(yaml);
  const plan = calculerPlanning(donnees);

  console.log(
    `Modèle    : ${plan.activites.length} activités (module 1), ${plan.global.length} lignes globales, ${plan.jalons.length} jalons`,
  );
  console.log(
    `Fenêtre   : ${enFr(plan.dateDemarrage)} → ${enFr(plan.activites.reduce((m, a) => (a.fin > m ? a.fin : m), plan.dateDemarrage))} (arrêté au ${enFr(plan.dateArrete)})`,
  );
  console.log(`Critique  : ${plan.critiqueModule.join(' → ')}`);
  console.log(
    `Retards   : ${plan.synthese.enRetard.length ? plan.synthese.enRetard.map((a) => a.id).join(', ') : 'aucun'}`,
  );

  if (plan.avertissements.length) {
    console.log(`\nAvertissements (${plan.avertissements.length}) :`);
    for (const m of plan.avertissements) console.log(`  • ${m}`);
  }

  const xlsx = resolve(DOSSIER, 'chronogramme_prs2.xlsx');
  const html = resolve(DOSSIER, 'chronogramme_prs2.html');
  await genererXlsx(plan, xlsx);
  writeFileSync(html, genererHtml(plan), 'utf8');
  console.log(`\nÉcrit     : ${xlsx}`);
  console.log(`Écrit     : ${html}`);
  return plan;
}

const executeDirectement =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executeDirectement) {
  principal(process.argv[2]).catch((e) => {
    if (e instanceof ErreurChronogramme) {
      console.error(`\n✖ Modèle incohérent — ${e.message}\n`);
      process.exit(1);
    }
    console.error(e);
    process.exit(2);
  });
}
