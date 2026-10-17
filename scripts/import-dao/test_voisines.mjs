// ⚠️ 17/10 — demande « lecture-valeurs-voisines » : les cas de LectureDaoVoisinesTest (backend b7e3400), rejoués sur lire.mjs
// pour garder la parité. Lancement : node --test test_voisines.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireParagraphes, norm, titreDeClause, valeurSaisie, voisines } from './lire.mjs';

const valeurs = (paires) => paires?.map(([, v]) => v) ?? null;

test('B1 — une valeur connue (plan) au bord du texte lu : l’autre est le reste, séparateur ôté ; absente du bord : rien', () => {
  assert.deepEqual(valeurs(voisines('{{B02-OB-03}} — {{B02-OB-01}}', '001-DAOO/MEN/PRMP — Acquisition de matériels informatiques',
    { 'B02-OB-01': 'Acquisition de matériels informatiques' }, [], {})), ['001-DAOO/MEN/PRMP', 'Acquisition de matériels informatiques']);
  // Le numéro contient lui-même le séparateur : B2 ne couperait pas, B1 le peut (normalisé : le tiret long devient « - »).
  assert.deepEqual(valeurs(voisines('{{B02-OB-03}} — {{B02-OB-01}}', '07 — CC/MEF — Fourniture de papier',
    { 'B02-OB-01': 'Fourniture de papier' }, [], {})), ['07 - CC/MEF', 'Fourniture de papier']);
  assert.equal(voisines('{{B02-OB-03}} — {{B02-OB-01}}', '07 — CC/MEF — Fourniture de papier', { 'B02-OB-01': 'Autre objet' }, [], {}), null);
});

test('B2 — un séparateur présent une seule fois ; « ( » seulement refermé par le modèle ; deux occurrences : rien ; un type à respecter', () => {
  assert.deepEqual(valeurs(voisines('{{B02-SG-01}} ({{B02-SG-02}}).', 'RAKOTO Jean (Décision n° 031-MEF/SG du 6 janvier 2027).', {}, [], {})),
    ['RAKOTO Jean', 'Décision n° 031-MEF/SG du 6 janvier 2027']);
  assert.deepEqual(valeurs(voisines('{{B02-LT-06}} ; {{B02-LT-07}}', 'Lot 1 : voirie ; Lot 2 : assainissement', {}, [], {})),
    ['Lot 1 : voirie', 'Lot 2 : assainissement']);
  assert.equal(voisines('{{B02-SG-01}} ({{B02-SG-02}}).', 'RAKOTO (Jean) (Décision n° 031)', {}, [], {}), null);
  assert.equal(voisines('{{A}} ; {{B}}', 'un ; deux ; trois', {}, [], {}), null);
  // Un champ numérique doit se lire comme un nombre.
  assert.equal(voisines('{{B04-VO-01}} ; {{B02-LT-07}}', 'cent vingt ; Lot 2', {}, [], { 'B04-VO-01': { type: 'NOMBRE' } }), null);
});

test('Un titre d’article (lettres espacées comprises) ou une clause numérotée n’est pas une valeur ; un trou du modèle non plus', () => {
  assert.equal(titreDeClause('AR TIC L E4.- GR O U P E ME N T S (CCAG AR TI C L E5)'), true);
  assert.equal(titreDeClause('ARTICLE PREMIER : OBJET'), true);
  assert.equal(titreDeClause('1.1-Lots, Lot : Lot unique et indivisible'), true);
  assert.equal(titreDeClause('Un (01) millième du montant du Marché'), false);
  assert.equal(titreDeClause('Articles de bureau et consommables'), false);
  assert.equal(valeurSaisie('<insérer l’adresse complète>', null, null), null);
  assert.equal(valeurSaisie('Analakely', null, null), 'Analakely');
});

test('Accroche confirmée — l’AE-CC qui suit un DPAC au même bloc d’autorité : son préambule est relu (B02-SG-01 à 03)', () => {
  const doc = [
    // Le DPAC : le même en-tête d'autorité que l'AE-CC, puis son propre texte.
    "MINISTERE DE L'ECONOMIE ET DES FINANCES", 'Antananarivo', 'Personne responsable des marchés publics : RAKOTO Jean',
    'Courriel : prmp@mef.mg – Téléphone : 0330000001', 'MARCHE DE : Fournitures et services', 'NUMÉRO : 07-CC/MEF',
    ...Array.from({ length: 70 }, (_, i) => `Clause ${i} du règlement de la consultation, sans rapport avec l'acte d'engagement.`),
    // L'AE-CC.
    "MINISTERE DE L'ECONOMIE ET DES FINANCES", 'Antananarivo', 'Personne responsable des marchés publics : RAKOTO Jean',
    'Courriel : prmp@mef.mg – Téléphone : 0330000001', 'Fourniture de papier', "CONTRAT-CADRE Valant acte d'engagement et CCAP UNIQUE",
    'Code des marchés publics (Article 67)', 'PREAMBULE – DISPOSITIONS GENERALES',
    "Personne Publique contractante : MINISTERE DE L'ECONOMIE ET DES FINANCES, Antananarivo",
    'Personne habilitée à signer le contrat-cadre : RAKOTO Jean.',
    'Personne responsable des marchés passés sur la base du présent contrat-cadre : RAKOTO Jean (Décision n° 031-MEF/SG du 6 janvier 2027).',
    'Procédure de passation du contrat-cadre :', 'ARTICLE 1er – Contractants (1)', 'Le contrat-cadre est conclu entre :',
    "- D'une part, MINISTERE DE L'ECONOMIE ET DES FINANCES, ci-après dénommée « l'autorité contractante »,",
    'Représentée par : RAKOTO Jean, nommée par Arrêté n° 0457/2027-MEF du 4 janvier 2027.',
  ].map(norm);
  const r = lireParagraphes(doc, 'AE-CC');
  const codes = r.propositions.map((p) => p.code);
  for (const c of ['B02-SG-01', 'B02-SG-02', 'B02-SG-03']) assert.ok(codes.includes(c), `${c} absent de ${codes.join(', ')}`);
  assert.equal(r.propositions.find((p) => p.code === 'B02-SG-03').valeur, 'Arrêté n° 0457/2027-MEF du 4 janvier 2027');
});
