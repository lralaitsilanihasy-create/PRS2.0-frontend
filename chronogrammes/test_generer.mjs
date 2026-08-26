/**
 * PRS 2.0 — Tests du générateur de chronogrammes
 * =============================================================================
 * Exécution : node --test test_generer.mjs   (ou npm test depuis chronogrammes/)
 *
 * Couverture exigée par le cahier des charges :
 *   1. calcul en jours ouvrés (week-ends et fériés exclus)
 *   2. détection de cycle de dépendances
 *   3. détection de retard par rapport à la date d'arrêté
 *   4. chemin critique
 * Complétée par les autres gardes de cohérence du YAML et un test d'intégration
 * sur le fichier réel `activites.yaml`.
 */

import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ErreurChronogramme,
  ajouterJoursOuvres,
  calculerPlanning,
  chargerYaml,
  cheminCritique,
  colonneDe,
  colonneOccupee,
  compterJoursOuvres,
  construireCalendrier,
  enFr,
  enIso,
  estJourOuvre,
  grilleMois,
  grilleSemaines,
  ordonnerTopologique,
  prochainJourOuvre,
  statutCalcule,
  validerDonnees,
  versDate,
} from './generer_chronogramme.mjs';

const DOSSIER = dirname(fileURLToPath(import.meta.url));

/** Calendrier de référence des tests : jours ouvrés, 26/06 et 15/08 fériés. */
const CAL = construireCalendrier({
  jours_ouvres: true,
  jours_feries: ['2026-06-26', '2026-08-15'],
});

const d = (iso) => versDate(iso);

/** Fabrique un modèle minimal valide, surchargé par `patch`. */
function modele(patch = {}) {
  return {
    parametres: {
      date_demarrage: '2026-06-17',
      date_arrete: '2026-08-26',
      date_fin_contractuelle: '2026-09-16',
      jours_ouvres: true,
      jours_feries: ['2026-06-26', '2026-08-15'],
      semaines_gantt: 13,
      mois_gantt: 12,
      ...(patch.parametres ?? {}),
    },
    module_planification: patch.module_planification ?? [
      {
        id: 'A01',
        libelle: 'Socle',
        debut: '2026-06-17',
        duree_jours: 3,
        statut: 'termine',
        avancement: 100,
        dependances: [],
        preuve: 'commit 62f5f9a',
      },
    ],
    global_prs2: patch.global_prs2 ?? [
      {
        id: 'G01',
        libelle: 'Module 1',
        debut: '2026-06-17',
        fin: '2026-09-16',
        statut: 'en_cours',
        avancement: 82,
        dependances: [],
        preuve: 'inventaire du 26/08',
      },
    ],
    jalons: patch.jalons ?? [
      { code: 'J1', libelle: 'Jalon 1', date_cible: '2026-06-25', criteres_validation: ['critère'] },
    ],
  };
}

const activite = (id, patch = {}) => ({
  id,
  libelle: id,
  debut: '2026-06-17',
  duree_jours: 1,
  statut: 'a_venir',
  avancement: 0,
  dependances: [],
  ...patch,
});

// =============================================================================
describe('1. Calcul en jours ouvrés', () => {
  test('le jour de début compte pour un : durée 1 ⇒ fin = début', () => {
    assert.equal(enIso(ajouterJoursOuvres(d('2026-06-17'), 1, CAL)), '2026-06-17');
  });

  test('trois jours ouvrés depuis le mercredi 17/06 mènent au vendredi 19/06', () => {
    assert.equal(enIso(ajouterJoursOuvres(d('2026-06-17'), 3, CAL)), '2026-06-19');
  });

  test('le week-end est enjambé : vendredi 19/06 + 2 jours ⇒ lundi 22/06', () => {
    assert.equal(enIso(ajouterJoursOuvres(d('2026-06-19'), 2, CAL)), '2026-06-22');
  });

  test('un jour férié est enjambé : jeudi 25/06 + 2 jours ⇒ lundi 29/06 (26/06 férié)', () => {
    assert.equal(enIso(ajouterJoursOuvres(d('2026-06-25'), 2, CAL)), '2026-06-29');
  });

  test('samedi et dimanche ne sont pas ouvrés, le vendredi férié non plus', () => {
    assert.equal(estJourOuvre(d('2026-06-20'), CAL), false, 'samedi');
    assert.equal(estJourOuvre(d('2026-06-21'), CAL), false, 'dimanche');
    assert.equal(estJourOuvre(d('2026-06-26'), CAL), false, 'vendredi férié');
    assert.equal(estJourOuvre(d('2026-06-25'), CAL), true, 'jeudi ouvré');
  });

  test('un début tombant un samedi est reporté au lundi suivant', () => {
    assert.equal(enIso(prochainJourOuvre(d('2026-06-20'), CAL)), '2026-06-22');
  });

  test('un début tombant le vendredi férié est reporté au lundi suivant', () => {
    assert.equal(enIso(prochainJourOuvre(d('2026-06-26'), CAL)), '2026-06-29');
  });

  test('comptage bornes incluses du 17/06 au 30/06 : 9 jours ouvrés', () => {
    // 17,18,19 · 22,23,24,25 · 29,30 — le 26 est férié, les 20/21 et 27/28 sont des week-ends.
    assert.equal(compterJoursOuvres(d('2026-06-17'), d('2026-06-30'), CAL), 9);
  });

  test('jours_ouvres: false ⇒ tous les jours comptent, fériés compris', () => {
    const cal = construireCalendrier({ jours_ouvres: false, jours_feries: ['2026-06-26'] });
    assert.equal(enIso(ajouterJoursOuvres(d('2026-06-19'), 2, cal)), '2026-06-20', 'samedi accepté');
    assert.equal(compterJoursOuvres(d('2026-06-17'), d('2026-06-30'), cal), 14);
  });

  test('une durée nulle ou négative est refusée', () => {
    assert.throws(() => ajouterJoursOuvres(d('2026-06-17'), 0, CAL), ErreurChronogramme);
    assert.throws(() => ajouterJoursOuvres(d('2026-06-17'), -3, CAL), ErreurChronogramme);
  });

  test('le décalage d’un début non ouvré est signalé, pas silencieux', () => {
    const plan = calculerPlanning(
      modele({
        module_planification: [
          activite('A01', {
            debut: '2026-06-26', // vendredi férié
            duree_jours: 2,
            statut: 'termine',
            avancement: 100,
            preuve: '50 commits ce jour-là',
          }),
        ],
      }),
    );
    assert.equal(enIso(plan.activites[0].debut), '2026-06-29');
    assert.equal(enIso(plan.activites[0].debutDeclare), '2026-06-26');
    assert.ok(
      plan.avertissements.some((m) => m.includes('A01') && m.includes('non ouvré')),
      'un avertissement de décalage doit être émis',
    );
  });
});

// =============================================================================
describe('2. Détection de cycle et de dépendance invalide', () => {
  test('un cycle A → B → C → A est refusé, et le cycle est nommé', () => {
    const acts = [
      activite('A', { dependances: ['C'] }),
      activite('B', { dependances: ['A'] }),
      activite('C', { dependances: ['B'] }),
    ];
    assert.throws(
      () => ordonnerTopologique(acts),
      (e) => e instanceof ErreurChronogramme && /Cycle de dépendances/.test(e.message) && /→/.test(e.message),
    );
  });

  test('un cycle court A ⇄ B est refusé', () => {
    assert.throws(
      () => ordonnerTopologique([activite('A', { dependances: ['B'] }), activite('B', { dependances: ['A'] })]),
      ErreurChronogramme,
    );
  });

  test('une auto-dépendance est refusée', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { dependances: ['A01'] })] })),
      (e) => e instanceof ErreurChronogramme && /elle-même/.test(e.message),
    );
  });

  test('une dépendance inexistante est refusée et l’identifiant fautif est cité', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { dependances: ['ZZ99'] })] })),
      (e) => e instanceof ErreurChronogramme && /ZZ99/.test(e.message) && /inexistante/.test(e.message),
    );
  });

  test('un graphe acyclique passe et sort les dépendances avant leurs dépendants', () => {
    const acts = [
      activite('C', { dependances: ['B'] }),
      activite('A'),
      activite('B', { dependances: ['A'] }),
    ];
    const ordre = ordonnerTopologique(acts);
    assert.ok(ordre.indexOf('A') < ordre.indexOf('B'));
    assert.ok(ordre.indexOf('B') < ordre.indexOf('C'));
  });
});

// =============================================================================
describe('3. Détection de retard par rapport à la date d’arrêté', () => {
  const arrete = d('2026-08-26');

  test('fenêtre close et avancement incomplet ⇒ en retard', () => {
    const a = { debut: d('2026-08-17'), fin: d('2026-08-19'), avancement: 77 };
    assert.equal(statutCalcule(a, arrete), 'en_retard');
  });

  test('avancement à 100 % ⇒ terminé, même avec une fenêtre close', () => {
    const a = { debut: d('2026-06-17'), fin: d('2026-06-19'), avancement: 100 };
    assert.equal(statutCalcule(a, arrete), 'termine');
  });

  test('début postérieur à la date d’arrêté ⇒ à venir', () => {
    const a = { debut: d('2026-09-10'), fin: d('2026-09-16'), avancement: 0 };
    assert.equal(statutCalcule(a, arrete), 'a_venir');
  });

  test('fenêtre à cheval sur la date d’arrêté ⇒ en cours', () => {
    const a = { debut: d('2026-08-24'), fin: d('2026-08-28'), avancement: 40 };
    assert.equal(statutCalcule(a, arrete), 'en_cours');
  });

  test('le retard est recalculé même si le YAML déclare « en_cours », et l’écart est signalé', () => {
    const plan = calculerPlanning(
      modele({
        module_planification: [
          activite('A17', {
            debut: '2026-08-17',
            duree_jours: 3,
            statut: 'en_cours',
            avancement: 77,
            preuve: '27 constats clos sur 35',
          }),
        ],
      }),
    );
    const a = plan.activites[0];
    assert.equal(a.statut, 'en_cours', 'le statut déclaré est conservé tel quel');
    assert.equal(a.statutCalcule, 'en_retard', 'le statut calculé prime pour l’alerte');
    assert.equal(a.enRetard, true);
    assert.equal(plan.synthese.enRetard.length, 1);
    assert.ok(plan.avertissements.some((m) => m.includes('A17') && m.includes('calculé')));
  });

  test('aucune activité en retard quand tout est terminé ou à venir', () => {
    const plan = calculerPlanning(
      modele({
        module_planification: [
          activite('A01', { statut: 'termine', avancement: 100, preuve: 'commit' }),
          activite('A99', { debut: '2026-09-10', duree_jours: 5 }),
        ],
      }),
    );
    assert.equal(plan.synthese.enRetard.length, 0);
  });
});

// =============================================================================
describe('4. Chemin critique', () => {
  test('la chaîne de durée cumulée maximale est retenue, pas la plus longue en nombre d’étapes', () => {
    // X1(5) ─┬─ X2(2) ─┐            chaîne courte : 5 + 2 + 1 =  8
    //        └─ X3(10) ┴─ X4(1)     chaîne lourde : 5 + 10 + 1 = 16  ← critique
    const acts = [
      { ...activite('X1'), dureeJours: 5, fin: d('2026-06-23') },
      { ...activite('X2', { dependances: ['X1'] }), dureeJours: 2, fin: d('2026-06-25') },
      { ...activite('X3', { dependances: ['X1'] }), dureeJours: 10, fin: d('2026-07-07') },
      { ...activite('X4', { dependances: ['X2', 'X3'] }), dureeJours: 1, fin: d('2026-07-08') },
    ];
    assert.deepEqual(cheminCritique(acts), ['X1', 'X3', 'X4']);
  });

  test('sans aucune dépendance, le chemin se réduit à l’activité la plus longue', () => {
    const acts = [
      { ...activite('A'), dureeJours: 3, fin: d('2026-06-19') },
      { ...activite('B'), dureeJours: 9, fin: d('2026-06-29') },
    ];
    assert.deepEqual(cheminCritique(acts), ['B']);
  });

  test('une chaîne linéaire est intégralement critique', () => {
    const acts = [
      { ...activite('A'), dureeJours: 2, fin: d('2026-06-18') },
      { ...activite('B', { dependances: ['A'] }), dureeJours: 2, fin: d('2026-06-22') },
      { ...activite('C', { dependances: ['B'] }), dureeJours: 2, fin: d('2026-06-24') },
    ];
    assert.deepEqual(cheminCritique(acts), ['A', 'B', 'C']);
  });

  test('le chemin mène à la fin du projet, pas à la chaîne la plus lourde qui s’arrête en route', () => {
    // Régression : une chaîne historique très lourde (Z1→Z2, 30 j, finie en juillet)
    // captait le chemin critique au détriment de celle qui porte la livraison.
    const acts = [
      { ...activite('Z1'), dureeJours: 20, fin: d('2026-07-10') },
      { ...activite('Z2', { dependances: ['Z1'] }), dureeJours: 10, fin: d('2026-07-24') },
      { ...activite('L1'), dureeJours: 2, fin: d('2026-08-04') },
      { ...activite('L2', { dependances: ['L1'] }), dureeJours: 3, fin: d('2026-09-16') },
    ];
    assert.deepEqual(cheminCritique(acts), ['L1', 'L2'], 'la livraison du 16/09 fixe le point d’arrivée');
  });

  test('les activités du chemin critique sont marquées dans le planning calculé', () => {
    const plan = calculerPlanning(
      modele({
        module_planification: [
          activite('A01', { duree_jours: 5, statut: 'termine', avancement: 100, preuve: 'c' }),
          activite('A02', { duree_jours: 10, dependances: ['A01'], debut: '2026-06-24' }),
          activite('A03', { duree_jours: 1, dependances: ['A01'], debut: '2026-06-24' }),
        ],
      }),
    );
    const parId = new Map(plan.activites.map((a) => [a.id, a]));
    assert.equal(parId.get('A01').critique, true);
    assert.equal(parId.get('A02').critique, true);
    assert.equal(parId.get('A03').critique, false);
    assert.deepEqual(plan.critiqueModule, ['A01', 'A02']);
  });
});

// =============================================================================
describe('5. Gardes de cohérence du YAML', () => {
  test('une date de fin antérieure au début est refusée', () => {
    assert.throws(
      () =>
        validerDonnees(
          modele({ module_planification: [activite('A01', { debut: '2026-07-10', fin: '2026-07-01' })] }),
        ),
      (e) => e instanceof ErreurChronogramme && /antérieure à la date de début/.test(e.message),
    );
  });

  test('une preuve manquante sur un élément terminé est refusée', () => {
    assert.throws(
      () =>
        validerDonnees(
          modele({
            module_planification: [activite('A01', { statut: 'termine', avancement: 100, preuve: null })],
          }),
        ),
      (e) => e instanceof ErreurChronogramme && /preuve/.test(e.message),
    );
  });

  test('une preuve manquante sur un élément en cours est refusée', () => {
    assert.throws(
      () =>
        validerDonnees(
          modele({ module_planification: [activite('A01', { statut: 'en_cours', avancement: 40 })] }),
        ),
      ErreurChronogramme,
    );
  });

  test('un statut hors nomenclature est refusé', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { statut: 'presque' })] })),
      (e) => e instanceof ErreurChronogramme && /statut/.test(e.message),
    );
  });

  test('un avancement hors de 0-100 est refusé', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { avancement: 140 })] })),
      ErreurChronogramme,
    );
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { avancement: -5 })] })),
      ErreurChronogramme,
    );
  });

  test('un identifiant en double est refusé', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01'), activite('A01')] })),
      (e) => e instanceof ErreurChronogramme && /double/.test(e.message),
    );
  });

  test('une activité sans durée ni fin est refusée', () => {
    const a = activite('A01');
    delete a.duree_jours;
    assert.throws(
      () => validerDonnees(modele({ module_planification: [a] })),
      (e) => e instanceof ErreurChronogramme && /duree_jours/.test(e.message),
    );
  });

  test('un jalon référencé mais non déclaré est refusé', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { jalon: 'J9' })] })),
      (e) => e instanceof ErreurChronogramme && /J9/.test(e.message),
    );
  });

  test('un code de jalon en double est refusé', () => {
    assert.throws(
      () =>
        validerDonnees(
          modele({
            jalons: [
              { code: 'J1', libelle: 'a', date_cible: '2026-06-25' },
              { code: 'J1', libelle: 'b', date_cible: '2026-07-25' },
            ],
          }),
        ),
      ErreurChronogramme,
    );
  });

  test('une date malformée est refusée avec son contexte', () => {
    assert.throws(
      () => validerDonnees(modele({ module_planification: [activite('A01', { debut: '17/06/2026' })] })),
      (e) => e instanceof ErreurChronogramme && /A01\.debut/.test(e.message),
    );
  });

  test('une date inexistante au calendrier est refusée', () => {
    assert.throws(() => versDate('2026-02-30', 'test'), ErreurChronogramme);
  });

  test('la section parametres est obligatoire', () => {
    const m = modele();
    delete m.parametres;
    assert.throws(() => validerDonnees(m), (e) => /parametres/.test(e.message));
  });

  test('un fichier introuvable donne un message explicite', () => {
    assert.throws(
      () => chargerYaml(resolve(DOSSIER, 'inexistant.yaml')),
      (e) => e instanceof ErreurChronogramme && /introuvable/.test(e.message),
    );
  });
});

// =============================================================================
describe('6. Grilles de Gantt', () => {
  const plan = calculerPlanning(modele());

  test('les colonnes hebdomadaires sont ancrées sur la date de démarrage', () => {
    const cols = grilleSemaines(plan);
    assert.equal(cols[0].code, 'S1');
    assert.equal(enIso(cols[0].debut), '2026-06-17');
    assert.equal(enIso(cols[0].fin), '2026-06-23');
    assert.equal(enIso(cols[1].debut), '2026-06-24');
  });

  test('la grille s’étend au-delà des semaines déclarées si une activité déborde', () => {
    const cols = grilleSemaines(plan);
    const finMax = plan.activites.reduce((m, a) => (a.fin > m ? a.fin : m), plan.dateDemarrage);
    assert.ok(cols.at(-1).fin >= finMax, 'la dernière colonne doit couvrir la dernière fin');
    assert.ok(cols.length >= plan.parametres.semaines_gantt);
  });

  test('les colonnes mensuelles glissent de mois en mois depuis le démarrage', () => {
    const cols = grilleMois(plan);
    assert.equal(cols[0].code, 'M1');
    assert.equal(enIso(cols[0].debut), '2026-06-17');
    assert.equal(enIso(cols[1].debut), '2026-07-17');
    assert.equal(enIso(cols[0].fin), '2026-07-16');
  });

  test('une activité occupe toutes les colonnes qu’elle chevauche, et elles seules', () => {
    const cols = grilleSemaines(plan);
    const a = { debut: d('2026-06-24'), fin: d('2026-07-02') }; // S2 et S3
    assert.equal(colonneOccupee(a, cols[0]), false);
    assert.equal(colonneOccupee(a, cols[1]), true);
    assert.equal(colonneOccupee(a, cols[2]), true);
    assert.equal(colonneOccupee(a, cols[3]), false);
  });

  test('la colonne « aujourd’hui » est celle qui contient la date d’arrêté', () => {
    const cols = grilleSemaines(plan);
    const i = colonneDe(plan.dateArrete, cols);
    assert.ok(i >= 0, 'la date d’arrêté doit tomber dans la grille');
    assert.ok(plan.dateArrete >= cols[i].debut && plan.dateArrete <= cols[i].fin);
  });

  test('une date hors grille renvoie −1', () => {
    assert.equal(colonneDe(d('2020-01-01'), grilleSemaines(plan)), -1);
  });

  test('la grille hebdomadaire ignore les jalons qui ne sont portés que par le global', () => {
    // Régression : un jalon lointain des modules 2-4 (J8, juin 2027) étirait la
    // grille du module 1 à 53 colonnes au lieu de 14.
    const p = calculerPlanning(
      modele({
        module_planification: [
          activite('A01', { duree_jours: 3, jalon: 'J1', statut: 'termine', avancement: 100, preuve: 'c' }),
        ],
        global_prs2: [
          { ...activite('G01', { jalon: 'J8' }), debut: '2026-06-17', fin: '2027-06-16', duree_jours: null },
        ],
        jalons: [
          { code: 'J1', libelle: 'proche', date_cible: '2026-06-25', criteres_validation: [] },
          { code: 'J8', libelle: 'lointain', date_cible: '2027-06-16', criteres_validation: [] },
        ],
      }),
    );
    assert.equal(grilleSemaines(p).length, 13, 'la grille reste bornée aux semaines déclarées');
    assert.ok(grilleMois(p).length >= 12, 'la grille mensuelle, elle, couvre bien 2027');
  });

  test('la grille mensuelle ne déborde pas d’un mois : M12 se termine le jour attendu', () => {
    // Régression : un décompte de mois par différence d'index produisait 13 colonnes
    // là où la 12e couvre déjà la dernière fin (16/06/2027).
    const p = calculerPlanning(
      modele({
        global_prs2: [
          { ...activite('G01'), debut: '2026-06-17', fin: '2027-06-16', duree_jours: null, statut: 'en_cours', avancement: 50, preuve: 'c' },
        ],
      }),
    );
    const cols = grilleMois(p);
    assert.equal(cols.length, 12);
    assert.equal(enIso(cols.at(-1).fin), '2027-06-16');
  });

  test('la grille s’étend bien quand une activité du module dépasse les semaines déclarées', () => {
    const p = calculerPlanning(
      modele({
        parametres: { semaines_gantt: 2 },
        module_planification: [activite('A01', { debut: '2026-06-17', duree_jours: 30 })],
      }),
    );
    const cols = grilleSemaines(p);
    assert.ok(cols.length > 2, 'la valeur déclarée est un plancher, pas un plafond');
    assert.ok(cols.at(-1).fin >= p.activites[0].fin);
  });
});

// =============================================================================
describe('7. Synthèse', () => {
  test('l’avancement pondéré tient compte de la durée des activités', () => {
    const plan = calculerPlanning(
      modele({
        module_planification: [
          activite('A01', { duree_jours: 9, statut: 'termine', avancement: 100, preuve: 'c' }),
          activite('A02', { duree_jours: 1, debut: '2026-09-10' }),
        ],
      }),
    );
    // (100×9 + 0×1) / 10 = 90 — et non 50 comme une moyenne simple.
    assert.equal(plan.synthese.avancementPondere, 90);
  });

  test('les jalons sont classés franchis / à venir selon la date d’arrêté', () => {
    const plan = calculerPlanning(
      modele({
        jalons: [
          { code: 'J1', libelle: 'passé', date_cible: '2026-06-25', criteres_validation: [] },
          { code: 'J2', libelle: 'futur', date_cible: '2026-09-16', criteres_validation: [] },
        ],
      }),
    );
    assert.deepEqual(plan.synthese.jalonsFranchis.map((j) => j.code), ['J1']);
    assert.equal(plan.synthese.prochaineEcheance.code, 'J2');
    assert.equal(plan.synthese.joursAvantEcheance, 21); // 26/08 → 16/09
  });
});

// =============================================================================
describe('8. Intégration — le fichier activites.yaml réel', () => {
  const donnees = chargerYaml(resolve(DOSSIER, 'activites.yaml'));

  test('il se charge et passe toutes les gardes de cohérence', () => {
    assert.doesNotThrow(() => validerDonnees(donnees));
  });

  test('il se calcule intégralement', () => {
    const plan = calculerPlanning(donnees);
    assert.ok(plan.activites.length > 0);
    assert.ok(plan.global.length > 0);
    assert.ok(plan.jalons.length > 0);
    assert.ok(plan.critiqueModule.length > 0);
  });

  test('toute activité terminée ou en cours porte une preuve', () => {
    const plan = calculerPlanning(donnees);
    const sansPreuve = [...plan.activites, ...plan.global]
      .filter((a) => ['termine', 'en_cours'].includes(a.statut) && !a.preuve)
      .map((a) => a.id);
    assert.deepEqual(sansPreuve, []);
  });

  test('aucune fin ne précède son début', () => {
    const plan = calculerPlanning(donnees);
    for (const a of [...plan.activites, ...plan.global]) {
      assert.ok(a.fin >= a.debut, `${a.id} : ${enFr(a.fin)} < ${enFr(a.debut)}`);
    }
  });
});
