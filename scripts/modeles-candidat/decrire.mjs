// Décrit les six modèles du candidat à partir de l'extraction SANS PERTE (pdftotext -raw -nodiag), et
// pose les jetons de champ. Remplace `modeles-desc.mjs`.
//
// ⚠️ Le texte n'est JAMAIS retapé : il est lu dans `source-modeles.txt`. Ce qui est écrit ici, c'est
// la STRUCTURE (paragraphes, tableaux, cellules) et la CORRESPONDANCE (quel fragment devient un champ)
// — jamais le texte lui-même. Chaque ligne de la source est prise par son début, et une dérive de la
// source fait échouer le script au lieu de produire un modèle faux.
import fs from 'node:fs';

const SRC = fs.readFileSync('source-modeles.txt', 'utf8');
const droite = (s) => s.replace(/[’ʼ]/g, "'");

/** Les lignes utiles d'une page : sans le numéro de page. */
function lignes(page) {
  const d = SRC.indexOf(`===== PAGE ${page} =====`);
  const f = SRC.indexOf('===== PAGE', d + 10);
  return SRC.slice(d, f < 0 ? undefined : f)
    // ⚠️ S6 — la source porte des glyphes d'une police de symboles (U+F0F0 : case à cocher ou puce) devant sept
    // lignes des pages 23-25. Sans la police, ils ne se reproduisent pas : ils sont écartés, et signalés.
    .split('\n').slice(1).map((l) => l.replace(/[-]/g, '').trim())
    .filter((l) => l && l !== String(page));
}

/** Recolle les lignes d'un paragraphe coupé par la mise en page du PDF ; une nouvelle entrée commence à chaque début connu. */
function paragraphes(lignesPage, debuts) {
  const blocs = [];
  let courant = [];
  for (const l of lignesPage) {
    if (debuts.some((d) => droite(l).startsWith(droite(d))) && courant.length) {
      blocs.push(courant.join(' '));
      courant = [];
    }
    courant.push(l);
  }
  if (courant.length) blocs.push(courant.join(' '));
  return blocs;
}

// ── Outils de STRUCTURE ──────────────────────────────────────────────────────────────────────
const US = '\u001F';   // séparateur de cellules
const RS = '\u001E';   // saut de paragraphe dans une cellule

/** Le n-ième paragraphe qui commence par ce préfixe : une dérive de la source échoue ici. */
function celui(paras, prefixe, rang = 0) {
  const trouves = paras.filter((x) => droite(x).startsWith(droite(prefixe)));
  if (trouves.length <= rang) throw new Error(`« ${prefixe} » : ${trouves.length} paragraphe(s) trouvé(s), rang ${rang} demandé`);
  return trouves[rang];
}
/** Coupe une ligne de la source en deux, à la frontière donnée : deux cellules d'une même ligne du PDF. */
function couper(texte, frontiere) {
  const i = droite(texte).indexOf(droite(frontiere));
  if (i < 0) throw new Error(`frontière « ${frontiere} » absente de « ${texte} »`);
  return [texte.slice(0, i).trim(), texte.slice(i).trim()];
}
const cellule = (...paras) => paras.join(RS);
const T = (n) => ({ type: 'table', texte: String(n) });
const L = (...cellules) => ({ type: 'ligne', texte: cellules.join(US) });
const FIN = { type: 'fin_table', texte: '' };
const P = (texte) => ({ type: 'para', texte });
const ST = (texte) => ({ type: 'sous_titre', texte });
const D = (texte) => ({ type: 'droite', texte });
const C = (texte) => ({ type: 'centre', texte });
const VIDE = { type: 'vide', texte: '' };

/**
 * Jetons. `{{CODE}}` = valeur de la fiche · `.lettres` = en toutes lettres · `.doublet` = « cent cinquième
 * (105ème) » · `{{DERIVE.x}}` = calculé · `{{SI:…}}` / `{{FINSI:…}}` = section conditionnelle (N4), AJOUTÉE
 * sans remplacer de texte. Les blancs du CANDIDAT ne sont pas jetonnés : ils restent tels que la source les imprime.
 *
 * ⚠️ Codes ARRÊTÉS le 26/09 pour les deux durées d'antécédents (N3, rubrique « Capacité et qualifications des candidats »,
 * ouverte aux trois catégories) : `B03-CQ-09` (juridiques, défaut 5 ans) et `B03-CQ-10` (financiers, défaut 3 ans).
 */
const AO = '{{B02-OB-03}} — {{B02-OB-01}}';
const JETONS_CARTOUCHE = [
  ["N° D'appel d'offre et titre: _________________", `N° D'appel d'offre et titre: ${AO}`],
  ["No d'appel d'offres et titre : ____________________", `No d'appel d'offres et titre : ${AO}`],
  ["No. d'appel d'offres et titre : _____________________", `No. d'appel d'offres et titre : ${AO}`],
  ["No. d'appel d'offres et titre : ______________", `No. d'appel d'offres et titre : ${AO}`],
];
const JETONS_A1 = [
  ...JETONS_CARTOUCHE,
  ["Certificat d'immatriculation (NIF), Certificat d'existence (Numéro Statistique), Certificat de non faillite.", '{{B03-CQ-01}}'],
  ['au cours des cinq dernières années', 'au cours des {{B03-CQ-09.lettres}} dernières années'],
  ["[nombre d'années]", '{{B03-CQ-09}}'],
  ['(non applicable)', '{{A1B.mention}}'],
];
const JETONS_A3 = [
  ...JETONS_CARTOUCHE,
  ['pour les trois dernières années', 'pour les {{B03-CQ-10.lettres}} dernières années'],
  ['des bilans des trois années', 'des bilans des {{B03-CQ-10.lettres}} années'],
];
const JETONS_C1 = [
  ["(Nom et adresse de l'Acheteur)", '{{B01-AC-01}}, {{B01-AC-02}}'],
  ['[titre du Marché]', AO],
  ["[Nom de l'Organisme ayant lancé l'Appel d'offres]", '{{B01-AC-01}}'],
  ['[montant de la garantie en chiffres et en lettres]', '{{B05-GS-03}} ({{B05-GS-03.lettres}})'],
  ['trentième (30ème)', '{{DERIVE.delai-garantie.doublet}}'],
  ['cent cinquième (105ème)', '{{B05-GS-04.doublet}}'],
];
const JETONS_C2 = [
  ['[date fixée pour la remise des offres]', '{{B04-LR-03}}'],
  ["[date d'expiration de la validité de l'offre]", '{{DERIVE.fin-validite-offre}}'],
  ["[intitulé ou objet résumé du marché et références de l'appel d'offres]", AO],
  ["[dénomination et adresse complète de l'Autorité contractante]", '{{B01-AC-01}}, {{B01-AC-02}}'],
  ['[insérer le montant en chiffres et en lettres de la garantie de soumission]', '{{B05-GS-03}} ({{B05-GS-03.lettres}})'],
  ['trentième (30ème)', '{{DERIVE.delai-garantie.doublet}}'],
  ['cent cinquième (105ème)', '{{B05-GS-04.doublet}}'],
];

/** Applique les jetons (apostrophes droites ou courbes confondues pour la recherche, texte d'origine conservé). */
function jetonner(texte, table, trace) {
  let out = texte;
  for (const [source, jeton] of table) {
    const cible = droite(source);
    let i = droite(out).indexOf(cible);
    while (i >= 0) {
      const original = out.slice(i, i + source.length);
      out = out.slice(0, i) + jeton + out.slice(i + source.length);
      if (!trace.some((t) => droite(t.source) === cible)) trace.push({ source: original, jeton });
      i = droite(out).indexOf(cible, i + jeton.length);
    }
  }
  return out;
}
/** Jetonne tous les blocs d'un modèle, cellule par cellule. */
function jetonnerBlocs(blocs, table, trace) {
  return blocs.map((b) => {
    if (b.type === 'ligne') return { ...b, texte: b.texte.split(US).map((c) => c.split(RS).map((p) => jetonner(p, table, trace)).join(RS)).join(US) };
    if (b.type === 'table' || b.type === 'fin_table' || b.type === 'vide') return b;
    return { ...b, texte: jetonner(b.texte, table, trace) };
  });
}

// ══ A1 — pages 23, 24, 25 ═════════════════════════════════════════════════════════════════════
const a1a = lignes(23);
const a1b = lignes(24);
const a1c = lignes(25);
const traceA1 = [];

// A1-a : titres, cartouche à droite, puis les intitulés ligne à ligne. Les deux dernières lignes se recollent.
const pA1a = paragraphes(a1a.slice(2), [
  'Date:', "N° D'appel", 'Page [', 'Nom ou raison', 'Forme juridique', "Numéro d'immatriculation", 'Numéro de compte',
  'Personne habilitée', 'Nom :', 'Adresse :', 'Adresse électronique', 'Copies certifiées', 'Certificat', 'Description de procédure',
]);
const blocsA1a = [
  ST(a1a[1]),
  D(celui(pA1a, 'Date:')), D(celui(pA1a, "N° D'appel")), D(celui(pA1a, 'Page [')),
  ...['Nom ou raison', 'Forme juridique', "Numéro d'immatriculation", 'Numéro de compte', 'Personne habilitée', 'Nom :', 'Adresse :',
    'Adresse électronique', 'Copies certifiées', 'Certificat', 'Description de procédure'].map((d) => P(celui(pA1a, d))),
];
// A1-b : titre, mention, puis les intitulés — la section des champs est balisée pour N4 (cadrage groupement).
const pA1b = paragraphes(a1b.slice(1), [
  '(non applicable)', 'Nom ou raison', '[rappel', 'Nature du groupement', 'Date de constitution', 'Adresse du groupement',
  'Désignation et coordonnées', 'Nom :', 'Adresse :', 'N° télécopie', 'Adresse électronique', 'Les copies', 'Statuts ou', '_________________',
]);
const blocsA1b = [
  ST(a1b[0]),
  C(celui(pA1b, '(non applicable)')),
  P('{{SI:A1B}}'),
  ...['Nom ou raison', '[rappel', 'Nature du groupement', 'Date de constitution', 'Adresse du groupement', 'Désignation et coordonnées',
    'Nom :', 'Adresse :', 'N° télécopie', 'Adresse électronique', 'Les copies', 'Statuts ou'].map((d) => P(celui(pA1b, d))),
  P(celui(pA1b, '_________________', 0)), P(celui(pA1b, '_________________', 1)),
  P('{{FINSI:A1B}}'),
];
// A1-c : titre sur deux lignes, consigne tronquée (S5, gardée telle quelle), cartouche, deux tableaux à quatre colonnes.
const pA1c = paragraphes(a1c, [
  'A1', '[Le formulaire', 'Nom ou raison', 'Date :', "No d'appel", 'Page [', 'Marchés non exécutés', "Il n'y a pas eu", 'Marché(s) non',
  'Année Fraction', 'Identification du marché Montant', '______', '[indiquer le montant', 'Identification du marché :', 'Nom et adresse',
  'Raisons de non', '__________', 'Litiges au cours', 'Pas de litige', 'Litige(s) en instance', 'Année Règlement', 'Identification du marché',
  'Montant total', '_________', 'Objet du litige',
]);
const [annee1, fraction] = couper(celui(pA1c, 'Année Fraction'), 'Fraction non');
const [ident1, montant1] = couper(celui(pA1c, 'Identification du marché Montant'), 'Montant total');
const [annee2, reglement] = couper(celui(pA1c, 'Année Règlement'), 'Règlement en');
// Les blancs : la source en a plusieurs de longueurs proches (« ______ ______ » est aussi le DÉBUT de
// « ______ _______ »), on les prend par leur texte exact, jamais par leur début.
const exact = (paras, texte, rang = 0) => {
  const t = paras.filter((x) => x === texte);
  if (t.length <= rang) throw new Error(`« ${texte} » : ${t.length} occurrence(s), rang ${rang} demandé`);
  return t[rang];
};
const [b1, b2] = couper(exact(pA1c, '______ _______'), '_______');
const [b3, b4] = couper(exact(pA1c, '______ ______'), ' ______');
const blocsA1c = [
  ST(celui(pA1c, 'A1')),
  P(celui(pA1c, '[Le formulaire')),
  D(celui(pA1c, 'Nom ou raison')), D(celui(pA1c, 'Date :')), D(celui(pA1c, "No d'appel")), D(celui(pA1c, 'Page [')),
  C(celui(pA1c, 'Marchés non exécutés')),
  P(celui(pA1c, "Il n'y a pas eu")), P(celui(pA1c, 'Marché(s) non')),
  T(4),
  L(annee1, fraction, ident1, montant1),
  L(exact(pA1c, '______'), celui(pA1c, '[indiquer le montant'),
    cellule(celui(pA1c, 'Identification du marché :', 0), celui(pA1c, 'Nom et adresse', 0), celui(pA1c, 'Raisons de non')),
    exact(pA1c, '__________')),
  FIN,
  C(celui(pA1c, 'Litiges au cours')),
  P(celui(pA1c, 'Pas de litige')), P(celui(pA1c, 'Litige(s) en instance')),
  T(4),
  L(annee2, reglement, exact(pA1c, 'Identification du marché'), celui(pA1c, 'Montant total')),
  L(b1, b2, cellule(celui(pA1c, 'Identification du marché :', 1), celui(pA1c, 'Nom et adresse', 1), celui(pA1c, 'Objet du litige', 0)), exact(pA1c, '_________', 0)),
  L(b3, b4, cellule(celui(pA1c, 'Identification du marché :', 2), celui(pA1c, 'Nom et adresse', 2), celui(pA1c, 'Objet du litige', 1)), exact(pA1c, '_________', 1)),
  FIN,
];
const blocsA1 = jetonnerBlocs([...blocsA1a, VIDE, ...blocsA1b, VIDE, ...blocsA1c], JETONS_A1, traceA1);

// ══ A2 — pages 26, 27 ════════════════════════════════════════════════════════════════════════
const a2a = lignes(26);
const a2b = lignes(27);
const [nature, reste1] = couper(a2a[2], 'DESCRIPTION');   // quatre en-têtes sur une même ligne du PDF
const [description, reste2] = couper(reste1, 'DATE D');
const [dateAcq, statut] = couper(reste2, 'STATUT');
const pA2b = paragraphes(a2b.slice(1), ['Décrire', '[Note']);
const blocsA2 = [
  ST(a2a[1]),
  T(4),
  L(nature, description, dateAcq, statut),
  ...Array.from({ length: 6 }, () => L('', '', '', '')),   // lignes vides : le nombre est un choix de rendu, pas du texte
  FIN,
  VIDE,
  ST(a2b[0]),
  P(celui(pA2b, 'Décrire')),
  P(celui(pA2b, '[Note')),
];

// ══ A3 — pages 28, 29, 30 ════════════════════════════════════════════════════════════════════
const a3a = lignes(28);
const a3doc = lignes(29);
const a3b = lignes(30);
const traceA3 = [];

const pA3a = paragraphes(a3a.slice(2), [
  '[Chaque', 'Nom ou raison', 'Date :', 'No. d', 'Page [', '1. Renseignements', 'Renseignements financiers équivalent', 'Antécédents pour',
  'Année 1', 'Information du bilan', 'Total actif', 'Total passif', 'Patrimoine net', 'Disponibilités', 'Engagements', 'Information des comptes',
  'Recettes totales', 'Bénéfices',
]);
const [an1, resteAn] = couper(celui(pA3a, 'Année 1'), 'Année 2');
const [an2, an3] = couper(resteAn, 'Année 3');
const blocsA3a = [
  ST(a3a[1]),
  P(celui(pA3a, '[Chaque')),
  D(celui(pA3a, 'Nom ou raison')), D(celui(pA3a, 'Date :')), D(celui(pA3a, 'No. d')), D(celui(pA3a, 'Page [')),
  ST(celui(pA3a, '1. Renseignements')),
  T(4),
  L(celui(pA3a, 'Renseignements financiers équivalent'), celui(pA3a, 'Antécédents pour'), '', ''),
  L('', an1, an2, an3),
  L(celui(pA3a, 'Information du bilan'), '', '', ''),
  ...['Total actif', 'Total passif', 'Patrimoine net', 'Disponibilités', 'Engagements'].map((d) => L(celui(pA3a, d), '', '', '')),
  L(celui(pA3a, 'Information des comptes'), '', '', ''),
  ...['Recettes totales', 'Bénéfices'].map((d) => L(celui(pA3a, d), '', '', '')),
  FIN,
];
const pA3doc = paragraphes(a3doc, ['2. Documents', 'Le Candidat doit', 'a)', 'b)', 'c)', 'd)']);
const blocsA3doc = [ST(celui(pA3doc, '2. Documents')), ...['Le Candidat doit', 'a)', 'b)', 'c)', 'd)'].map((d) => P(celui(pA3doc, d)))];

const pA3b = paragraphes(a3b.slice(1), [
  '[Chaque', 'Nom ou raison', 'Date :', 'No. d', 'Page [', "Chiffre d'affaires hors taxes (général)", 'Exercice du', 'au',
  'Travaux', 'Fournitures', 'Services', 'Prestations intellectuelles', 'TOTAL', "Chiffre d'affaires hors taxes (prestations",
  'A3', 'PERMETTANT', '[Fournir',
]);
const exercice = (k) => cellule(celui(pA3b, 'Exercice du', k), celui(pA3b, 'au', k));
const titreA3c = celui(pA3b, 'A3') + ' ' + celui(pA3b, 'PERMETTANT');
const blocsA3b = [
  ST(a3b[0]),
  P(celui(pA3b, '[Chaque')),
  D(celui(pA3b, 'Nom ou raison')), D(celui(pA3b, 'Date :')), D(celui(pA3b, 'No. d')), D(celui(pA3b, 'Page [')),
  T(4),
  L(celui(pA3b, "Chiffre d'affaires hors taxes (général)"), '', '', ''),
  L('', exercice(0), exercice(1), exercice(2)),
  L(celui(pA3b, 'Travaux'), '', '', ''),
  L(celui(pA3b, 'Fournitures', 0), '', '', ''),
  L(celui(pA3b, 'Services', 0), '', '', ''),
  L(celui(pA3b, 'Prestations intellectuelles'), '', '', ''),
  L(celui(pA3b, 'TOTAL', 0), '', '', ''),
  FIN,
  T(4),
  L(celui(pA3b, "Chiffre d'affaires hors taxes (prestations"), '', '', ''),
  L('', exercice(3), exercice(4), exercice(5)),
  // ⚠️ N4 — ces lignes sont les natures DU MARCHÉ : le serveur les régénère entre les deux marqueurs.
  L('{{SI:A3B-NATURES}}' + celui(pA3b, 'Fournitures', 1), '', '', ''),
  L(celui(pA3b, 'Services', 1) + '{{FINSI:A3B-NATURES}}', '', '', ''),
  L(celui(pA3b, 'TOTAL', 1), '', '', ''),
  FIN,
  VIDE,
  ST(titreA3c),
  P(celui(pA3b, '[Fournir')),
];
const blocsA3 = jetonnerBlocs([...blocsA3a, VIDE, ...blocsA3doc, VIDE, ...blocsA3b], JETONS_A3, traceA3);

// ══ A4 — page 31 ═════════════════════════════════════════════════════════════════════════════
const a4 = lignes(31);
const pA4 = paragraphes(a4.slice(1), [
  'Identification du marché', '(indiquer les références', 'Valeur approximative', '(indiquer le montant',
  '_______ %', 'Nom et coordonnées', "Lieu d'exécution", 'Date de fin', '_____________',
]);
const [lieu, debut] = couper(celui(pA4, "Lieu d'exécution"), 'Date de début');
const blocsA4 = [
  T(2),
  L(cellule(celui(pA4, 'Identification du marché'), celui(pA4, '(indiquer les références')), ''),
  L(cellule(celui(pA4, 'Valeur approximative'), celui(pA4, '(indiquer le montant')), celui(pA4, '_______ %')),
  L(celui(pA4, 'Nom et coordonnées'), ''),
  L(lieu, cellule(debut, celui(pA4, 'Date de fin'), celui(pA4, '_____________'))),
  FIN,
];

// ══ C1, C2 — pages 33, 34 ════════════════════════════════════════════════════════════════════
const c1 = lignes(33);
const traceC1 = [];
const blocsC1 = paragraphes(c1.slice(1), [
  'A :', 'ATTENDU QUE', 'EN CONSEQUENCE', 'Nous renonçons', 'La présente garantie', 'Nous convenons', 'SIGNATURE', 'Nom de la Banque', 'Adresse', 'Date', 'Cachet',
]).map((t) => P(jetonner(t, JETONS_C1, traceC1)));
const c2 = lignes(34);
const traceC2 = [];
const blocsC2 = paragraphes(c2.slice(1), [
  'Nous soussignés', 'Nous engageons', 'a) que', 'b) qu', 'c) que', '- il', 'Le présent engagement', 'Fait à', 'SIGNATURE', 'Nom de la Banque', 'Adresse', 'Date', 'Cachet',
]).map((t) => P(jetonner(t, JETONS_C2, traceC2)));

// ══ Sortie ═══════════════════════════════════════════════════════════════════════════════════
const modeles = [
  { fichier: 'A1.docx', sigle: 'A1', pages: [23, 24, 25], titre: a1a[0], blocs: blocsA1, trace: traceA1, ajouts: ['{{SI:A1B}}', '{{FINSI:A1B}}'] },
  { fichier: 'A2.docx', sigle: 'A2', pages: [26, 27], titre: a2a[0], blocs: blocsA2, trace: [], ajouts: [] },
  { fichier: 'A3.docx', sigle: 'A3', pages: [28, 29, 30], titre: a3a[0], blocs: blocsA3, trace: traceA3, ajouts: ['{{SI:A3B-NATURES}}', '{{FINSI:A3B-NATURES}}'] },
  { fichier: 'A4.docx', sigle: 'A4', pages: [31], titre: a4[0], blocs: blocsA4, trace: [], ajouts: [] },
  { fichier: 'C1.docx', sigle: 'C1', pages: [33], titre: c1[0], blocs: blocsC1, trace: traceC1, ajouts: [] },
  { fichier: 'C2.docx', sigle: 'C2', pages: [34], titre: c2[0], blocs: blocsC2, trace: traceC2, ajouts: [] },
];

fs.mkdirSync('modeles', { recursive: true });
const voulus = process.argv.slice(2);
for (const m of modeles) {
  if (voulus.length && !voulus.includes(m.sigle)) continue;
  fs.writeFileSync(`modeles/${m.sigle}.json`, JSON.stringify(m, null, 1), 'utf8');
  const commande = [['FICHIER', m.fichier], ['TITRE', m.titre], ...m.blocs.map((x) => [x.type.toUpperCase(), x.texte])];
  fs.writeFileSync(`modeles/${m.sigle}.txt`, commande.map((l) => l.join('\t')).join('\n') + '\n', 'utf8');
  const nb = (t) => m.blocs.filter((x) => x.type === t).length;
  console.log(`${m.sigle} (p. ${m.pages.join('-')}) — ${nb('para') + nb('droite') + nb('centre') + nb('sous_titre')} paragraphes, ${nb('table')} tableau(x), ${m.trace.length} substitution(s), ${m.ajouts.length} marqueur(s)`);
  for (const s of m.trace) console.log(`     « ${s.source.slice(0, 64)} »  →  ${s.jeton}`);
}
