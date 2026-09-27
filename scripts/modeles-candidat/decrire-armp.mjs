// Décrit les modèles du candidat sur les DOCUMENTS TYPES OFFICIELS de l'ARMP (fournitures, formulaires de
// soumission) — arbitrage du pilote du 27/09 : « Ajuster par rapport aux officiels ». Même principe que `decrire.mjs`
// (le décalque du dossier 2463) : le texte n'est JAMAIS retapé, il est lu dans `source-armp.txt` (produit par
// `extraire-armp.mjs`) ; ce qui est écrit ici, c'est la STRUCTURE (paragraphes, tableaux, cellules) et la
// CORRESPONDANCE (quel crochet du gabarit devient un jeton de la fiche). Les crochets qui désignent une saisie du
// CANDIDAT restent des crochets. Une dérive de la source fait échouer le script au lieu de produire un modèle faux.
//
//   node decrire-armp.mjs [A1 A2 A3 A4 C1 C2]   → modeles-armp/<sigle>.txt (commande Decalque) et .json (descripteur)
import fs from 'node:fs';
import { cle, droite, lireSource, propre, section } from './armp-commun.mjs';

const SRC = lireSource();
const US = '\u001F';   // séparateur de cellules
const RS = '\u001E';   // saut de paragraphe dans une cellule

/**
 * Les lignes utiles d'une section : blancs de fin de ligne nettoyés — sauf les tabulations, qui sont les cellules
 * vides d'une ligne de tableau (« Total actif \t\t\t ») —, lignes vides et lignes de tableau vides écartées.
 */
const utiles = (lignes) => lignes.map((l) => l.replace(/[^\S\t]+$/, '')).filter((l) => l.trim());
/** Les lignes de tableau entièrement vides d'une section (des tabulations, des blancs) : l'espace laissé au candidat. */
const lignesVides = (lignes) => lignes.filter((l) => /^\s+$/.test(l) && l.includes('\t')).length;

/**
 * Le n-ième paragraphe qui commence par ce préfixe : une dérive de la source échoue ici. Le texte est rendu propre,
 * sauf `brut` — une ligne de tableau, dont les tabulations séparent les cellules (`cellules`).
 */
function celui(paras, prefixe, rang = 0, brut = false) {
  const trouves = paras.filter((x) => cle(x).startsWith(cle(prefixe)));
  if (trouves.length <= rang) throw new Error(`« ${prefixe} » : ${trouves.length} paragraphe(s) trouvé(s), rang ${rang} demandé`);
  return brut ? trouves[rang] : propre(trouves[rang]);
}
/** Coupe un texte en deux, à la frontière donnée (incluse dans la seconde part) : deux paragraphes d'une même cellule. */
function couper(texte, frontiere) {
  const t = propre(texte);
  const i = droite(t).indexOf(cle(frontiere));
  if (i < 0) throw new Error(`frontière « ${frontiere} » absente de « ${t} »`);
  return [propre(t.slice(0, i)), propre(t.slice(i))];
}
/** Le n-ième paragraphe dont la clé vérifie l'expression : les lignes de blancs (« ______ »), que rien d'autre ne distingue. */
function celle(paras, re, rang = 0, brut = false) {
  const trouves = paras.filter((x) => re.test(cle(x)));
  if (trouves.length <= rang) throw new Error(`${re} : ${trouves.length} paragraphe(s) trouvé(s), rang ${rang} demandé`);
  return brut ? trouves[rang] : propre(trouves[rang]);
}
/** Coupe un texte en n parts, aux frontières successives. */
function decouper(texte, ...frontieres) {
  const parts = [];
  let reste = texte;
  for (const f of frontieres) {
    const [avant, apres] = couper(reste, f);
    parts.push(avant);
    reste = apres;
  }
  parts.push(reste);
  return parts;
}
/** Les cellules d'une ligne de tableau de la source (séparées par une tabulation). */
const cellules = (ligne) => ligne.split('\t').map(propre);
const cellule = (...paras) => paras.join(RS);
const blancs = (n) => Array.from({ length: n }, () => '');
const T = (n) => ({ type: 'table', texte: String(n) });
const L = (...cellules) => ({ type: 'ligne', texte: cellules.join(US) });
const FIN = { type: 'fin_table', texte: '' };
const P = (texte) => ({ type: 'para', texte });
const ST = (texte) => ({ type: 'sous_titre', texte });
const D = (texte) => ({ type: 'droite', texte });
const C = (texte) => ({ type: 'centre', texte });
const VIDE = { type: 'vide', texte: '' };

/**
 * Jetons du contrat V47 (+ `.chiffres`, 27/09) : `{{CODE}}` = valeur de la fiche (un MONTANT s'imprime avec son
 * unité) · `.lettres` = en toutes lettres · `.chiffres` = le nombre nu · `{{DERIVE.x}}` = calculé par le serveur.
 * Seuls les crochets qui désignent une donnée DU DOSSIER sont jetonnés ; ceux du candidat restent tels quels.
 */
const AO = '{{B02-OB-03}} — {{B02-OB-01}}';   // numéro du dossier d'appel d'offres + objet
const JETONS_C1 = [
  ['[titre du Marché]', AO],
  ["[Nom de l'Organisme ayant lancé l'Appel d'offres]", '{{B01-AC-01}}'],
  // le gabarit veut « en lettres et en chiffres » ; `{{CODE}}` imprimerait l'unité une seconde fois (constat du backend, 27/09)
  ['[montant en lettres et en chiffres]', '{{B05-GS-03.lettres}} ({{B05-GS-03.chiffres}} Ariary)'],
  // « [durée de validité des offres + 30 jours] ème jour » : le nombre nu, suivi du « ème » du gabarit
  ['[durée de validité des offres + 30 jours]', '{{B05-GS-04}}'],
];
const JETONS_C2 = [
  ['[date fixée pour la remise des offres]', '{{B04-LR-03}}'],
  ["[date d'expiration de la validité de l'offre]", '{{DERIVE.fin-validite-offre}}'],
  ["[intitulé ou objet résumé du marché et références de l'appel d'offres]", AO],
  ["[dénomination et adresse complète de l'Autorité contractante]", '{{B01-AC-01}}, {{B01-AC-02}}'],
  ['[insérer le montant en chiffres et en lettres de la garantie de soumission]', '{{B05-GS-03}} ({{B05-GS-03.lettres}})'],
];
/**
 * Le cartouche « N° d'appel d'offres et titre : ______ » : le blanc devient le numéro et l'objet du dossier. La ligne
 * est lue dans la source (le nombre de tirets n'est jamais retapé), le blanc final remplacé.
 */
const jetonAO = (ligne) => [ligne, ligne.replace(/_+\s*$/, AO)];
/**
 * Durées des antécédents (N3, 26/09) : `B03-CQ-09` juridiques (défaut 5 ans), `B03-CQ-10` financiers (défaut 3 ans).
 * Le gabarit les fixe (« cinq », « trois ») ; la fiche les porte avec la même valeur par défaut — le rendu par défaut
 * est celui du gabarit, et la PRMP peut les régler. « [nombre d'années] » est un crochet du dossier, pas du candidat.
 */
const JETONS_A1_DUREES = [
  ['au cours des cinq dernières années', 'au cours des {{B03-CQ-09.lettres}} dernières années'],
  ["[nombre d'années]", '{{B03-CQ-09}}'],
];
const JETONS_A3_DUREES = [
  ['pour les trois dernières années', 'pour les {{B03-CQ-10.lettres}} dernières années'],
  ['des bilans des trois années', 'des bilans des {{B03-CQ-10.lettres}} années'],
];
/** L'appel de note du titre de A4 et sa note de bas de page : Decalque n'a pas de notes, on les rend par « (1) ». */
const NOTE_A4 = [
  ['[note:1]', ' (1)'],
  ['[note 1] ', '(1) '],
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

// ══ A1 — identification du candidat ══════════════════════════════════════════════════════════
const a1 = utiles(section(SRC, 'A1 : IDENTIFICATION DU CANDIDAT', 'A2 : CAPACITES TECHNIQUES'));
const traceA1 = [];
const JETONS_A1 = [jetonAO(celui(a1, "N°. d'appel")), jetonAO(celui(a1, "No. d'appel")), ...JETONS_A1_DUREES];
// A1-a : cartouche à droite, puis un tableau à UNE colonne (celui du gabarit), une ligne par renseignement ; les
// paragraphes d'une cellule (« Nom : », « Adresse : »…) et ses lignes vides sont ceux du document type.
const [habilitee, nom1, adresse1, telecopie1, courriel1] = decouper(celui(a1, 'Personne habilitée'), 'Nom :', 'Adresse :', 'Numéro de télécopie', 'Adresse électronique');
const [copies, statuts] = couper(celui(a1, 'Copies des documents'), 'Statuts');
const blocsA1a = [
  ST(celui(a1, 'A1 - a)')),
  D(celui(a1, 'Date:')),
  D(celui(a1, "N°. d'appel")),
  D(celui(a1, 'Page [', 0)),
  T(1),
  L(cellule(celui(a1, 'Nom ou raison sociale du candidat'), '')),
  L(cellule(celui(a1, 'Forme juridique'), '')),
  L(cellule(celui(a1, "Numéro d'immatriculation"), '')),
  L(cellule(celui(a1, 'Numéro de compte bancaire'), '')),
  L(cellule(habilitee, nom1, adresse1, telecopie1, courriel1)),
  L(cellule(copies, '', statuts, '')),
  L(cellule(celui(a1, 'Description de procédure'), '', '', '')),
  FIN,
];
// A1-b : titre, mention « (non applicable) » servie par le serveur, puis le tableau à une colonne entre les marqueurs
// de la section conditionnelle (cadrage groupement, contrat V47 R9) — trois lignes, comme le gabarit.
const [membres, rappel, nature, constitution, adresseGroupement] = decouper(celui(a1, 'Nom ou raison sociale de chaque membre'),
  '[rappel', 'Nature du groupement', 'Date de constitution', 'Adresse du groupement');
const [chefDeFile, nom2, adresse2, telecopie2, courriel2] = decouper(celui(a1, 'Désignation et coordonnées'), 'Nom :', 'Adresse :', 'Numéro de télécopie', 'Adresse électronique');
const [lesCopies, statutsGroupement, blancsStatuts] = decouper(celui(a1, 'Les copies des documents'), 'Statuts ou', '_________________');
const blocsA1b = [
  ST(celui(a1, 'A1 - b)')),
  C('{{A1B.mention}}'),
  P('{{SI:A1B}}'),
  T(1),
  L(cellule(membres, rappel, ...blancs(3), nature, ...blancs(3), constitution, ...blancs(3), adresseGroupement, ...blancs(4))),
  L(cellule(chefDeFile, nom2, adresse2, telecopie2, courriel2)),
  L(cellule(lesCopies, '', statutsGroupement, ...blancsStatuts.split(' '), '')),
  FIN,
  P('{{FINSI:A1B}}'),
];
// A1-c : consigne, cartouche, puis le tableau du gabarit (six colonnes fusionnées) rendu comme au 2463 : les lignes
// pleine largeur (titres, cases) en paragraphes, et deux tableaux à quatre colonnes.
const [nonExecute1, nonExecute2] = couper(celui(a1, "Il n'y a pas eu"), 'Marché(s) non');
const [litige1, litige2] = couper(celui(a1, 'Pas de litige'), 'Litige(s) en instance');
const enTete1 = cellules(celui(a1, 'Année Fraction', 0, true));
const ligneNonExecute = cellules(celui(a1, '______ [indiquer', 0, true));
const [identNE, autoriteNE, raisonsNE] = decouper(ligneNonExecute[2], 'Nom et adresse', 'Raisons de non');
const enTete2 = cellules(celui(a1, 'Année Règlement', 0, true));
const ligneLitige = (rang) => {
  const c = cellules(celle(a1, /^_+ _+ Identification/, rang, true));
  const [ident, autorite, objet] = decouper(c[2], 'Nom et adresse', 'Objet du litige');
  return L(cellule('', c[0]), cellule('', c[1]), cellule(ident, autorite, objet, '', ''), cellule('', c[3]));
};
const blocsA1c = [
  ST(celui(a1, 'A1 – c)')),
  P(celui(a1, '[Le formulaire')),
  D(celui(a1, 'Nom ou raison sociale légal')), D(celui(a1, 'Date :')), D(celle(a1, /^ou$/)),
  D(celui(a1, 'Nom ou raison sociale du membre')), D(celle(a1, /^_+$/, 0)), D(celle(a1, /^_+$/, 1)),
  D(celui(a1, "No. d'appel")), D(celui(a1, 'Page [', 1)),
  C(celui(a1, 'Marchés non exécutés')),
  P(nonExecute1), P(nonExecute2),
  T(4),
  L(...enTete1),
  L(cellule('', ligneNonExecute[0]), ligneNonExecute[1], cellule(identNE, '', autoriteNE, '', raisonsNE, '', ''), cellule('', ligneNonExecute[3])),
  FIN,
  C(celui(a1, 'Litiges au cours')),
  P(litige1), P(litige2),
  T(4),
  L(...enTete2),
  ligneLitige(0),
  ligneLitige(1),
  FIN,
];
const blocsA1 = jetonnerBlocs([...blocsA1a, VIDE, ...blocsA1b, VIDE, ...blocsA1c], JETONS_A1, traceA1);

// ══ A2 — capacités techniques ═════════════════════════════════════════════════════════════════
const sA2 = section(SRC, 'A2 : CAPACITES TECHNIQUES', 'A3 : CAPACITES FINANCIERES');
const a2 = utiles(sA2);
const blocsA2 = [
  ST(celui(a2, 'A2 - a)')),
  T(4),
  L(...cellules(celui(a2, 'NATURE', 0, true))),
  ...Array.from({ length: lignesVides(sA2) }, () => L('', '', '', '')),   // autant de lignes vides que le document type
  FIN,
  VIDE,
  ST(celui(a2, 'A2 - b)')),
  P(celui(a2, 'Décrire')),
  P(celui(a2, '[note')),
];

// ══ A3 — capacités financières ═══════════════════════════════════════════════════════════════
const a3 = utiles(section(SRC, 'A3 : CAPACITES FINANCIERES', 'A4'));
const traceA3 = [];
const JETONS_A3 = [jetonAO(celui(a3, "No. d'appel", 0)), jetonAO(celui(a3, "No. d'appel", 1)), ...JETONS_A3_DUREES];
/** Une ligne de tableau du gabarit, prise telle quelle (intitulé puis trois cellules vides). */
const ligne4 = (prefixe, rang = 0) => L(...cellules(celui(a3, prefixe, rang, true)));
/** Le cartouche des deux fiches A3-a et A3-b (rang 0 et 1), à droite comme dans le gabarit. */
const cartoucheA3 = (rang, nomCandidat) => [
  D(celui(a3, nomCandidat)), D(celui(a3, 'Date :', rang)), D(celle(a3, /^ou$/, rang)),
  D(celui(a3, 'Nom ou raison sociale des membres', rang)), D(celle(a3, /^_+$/, 2 * rang)), D(celle(a3, /^_+$/, 2 * rang + 1)),
  D(celui(a3, "No. d'appel", rang)), D(celui(a3, 'Page [', rang)),
];
// A3-a : le tableau à quatre colonnes du gabarit ; ses lignes fusionnées (en-tête des années, sous-titres) vont dans la
// première cellule, comme au 2463 — trois colonnes d'années, fixes (R10).
const [renseignements, antecedents] = cellules(celui(a3, 'Renseignements financiers équivalent', 0, true));
const blocsA3a = [
  ST(celui(a3, 'A3 - a)')),
  P(celui(a3, '[Chaque Candidat et chaque Membre')),
  ...cartoucheA3(0, 'Nom ou raison sociale du candidat'),
  ST(celui(a3, '1. Renseignements')),
  T(4),
  L(renseignements, antecedents, '', ''),
  L(...cellules(celui(a3, 'Année 1', 0, true))),
  L(celui(a3, 'Information du bilan'), '', '', ''),
  ligne4('Total actif'), ligne4('Total passif'), ligne4('Patrimoine net'), ligne4('Disponibilités'), ligne4('Engagements'),
  L(celui(a3, 'Information des comptes'), '', '', ''),
  ligne4('Recettes totales'), ligne4('Bénéfices'),
  FIN,
  ST(celui(a3, '2. Documents')),
  P(celui(a3, 'Le Candidat et en cas')),
  // liste Word « a) b) c) d) » (lowerLetter « %1) »)
  P('a) ' + celui(a3, 'refléter')),
  P('b) ' + celui(a3, 'avoir été vérifiés')),
  P('c) ' + celui(a3, 'être complets')),
  P('d) ' + celui(a3, 'correspondre aux')),
];
// A3-b : deux tableaux. Le premier porte les quatre natures, toujours ; le second les natures DU MARCHÉ, régénérées par
// le serveur entre les marqueurs (R7/R8). « Exercice du……… au……... » : deux paragraphes d'une cellule, comme le gabarit.
const exercices = (rang) => cellules(celui(a3, 'Exercice', rang, true)).map((c) => (c ? cellule(...couper(c, ' au')) : c));
const blocsA3b = [
  ST(celui(a3, 'A3 - b)')),
  P(celui(a3, '[Chaque Candidat et en cas')),
  ...cartoucheA3(1, 'Nom ou raison social du'),
  T(4),
  L(celui(a3, "Chiffre d'affaires hors taxes (général)"), '', '', ''),
  L(...exercices(0)),
  ligne4('Travaux'), ligne4('Fournitures', 0), ligne4('Services', 0), ligne4('Prestations intellectuelles'), ligne4('TOTAL', 0),
  FIN,
  T(4),
  L(celui(a3, "Chiffre d'affaires hors taxes (prestations"), '', '', ''),
  L(...exercices(1)),
  L('{{SI:A3B-NATURES}}' + celui(a3, 'Fournitures', 1), '', '', ''),
  L(celui(a3, 'Services', 1) + '{{FINSI:A3B-NATURES}}', '', '', ''),
  ligne4('TOTAL', 1),
  FIN,
  VIDE,
  ST(celui(a3, 'A3 – c)')),
  P(celui(a3, '[fournir')),
];
const blocsA3 = jetonnerBlocs([...blocsA3a, VIDE, ...blocsA3b], JETONS_A3, traceA3);

// ══ A4 — antécédents ═════════════════════════════════════════════════════════════════════════
const sA4 = section(SRC, 'A4', 'B. – Modèle');
const a4 = utiles(sA4);
const traceA4 = [];
const titreA4 = jetonner(propre(a4[0]), NOTE_A4, traceA4);   // « … NATURE[note:1] » → « … NATURE (1) »
const noteA4 = celui(a4, '[note 1]');
// Le tableau du gabarit a deux colonnes ; ses lignes 1, 2, 3 et 5 sont fusionnées sur les deux (elles vont ici dans la
// première, la seconde vide — comme le décalque du 2463). Les paragraphes vides sont ceux du document type : l'espace
// laissé au candidat pour écrire.
const [identification, consigneIdent] = couper(celui(a4, 'Identification du marché'), '(indiquer les références');
const [valeur, groupement, montantTotal, pourcentage, pct] = decouper(celui(a4, 'Valeur approximative'),
  'Dans le cas', '(indiquer le montant', '(indiquer le pourcentage', '_______ %');
const [lieu, dates] = cellules(celui(a4, "Lieu d'exécution", 0, true));
const [debut, fin] = couper(dates, 'Date de fin');
const blocsA4 = jetonnerBlocs([
  T(2),
  L(cellule(identification, consigneIdent, ...blancs(7)), ''),
  L(cellule(valeur, ...blancs(3), groupement, '', montantTotal, '', pourcentage, pct, ''), ''),
  L(cellule(celui(a4, 'Nom et coordonnées'), ...blancs(4)), ''),
  L(cellule(lieu, ...blancs(3)), cellule(debut, '', fin, '', '')),
  L(celui(a4, '_____________'), ''),
  FIN,
  P(noteA4),
], NOTE_A4, traceA4);

// ══ C1 — garantie bancaire de soumission ══════════════════════════════════════════════════════
const c1 = utiles(section(SRC, 'C 1 –', 'C 2 –'));
const traceC1 = [];
// Les trois conditions sont une liste Word numérotée « (a) (b) (c) » (numbering.xml, lowerLetter « (%1) ») :
// le dernier paragraphe les cite « aux paragraphes a), b) et c) ci-dessus ». Decalque n'a pas de listes : le label
// est écrit dans le texte, et déclaré comme AJOUT au comparateur.
const blocsC1 = jetonnerBlocs([
  P(celui(c1, 'ATTENDU QUE')),
  P(celui(c1, 'EN CONSEQUENCE')),
  P('(a) ' + celui(c1, 'Si le Candidat retire')),
  P('(b) ' + celui(c1, "Si le Candidat n'accepte")),
  P('(c) ' + celui(c1, "Si le Candidat s'étant")),
  P(celui(c1, '(c1)')),
  P(celui(c1, '(c2)')),
  P(celui(c1, 'Nous, Garant')),
  P(celui(c1, 'La présente garantie')),
  P(celui(c1, 'SIGNATURE')),
  P(celui(c1, 'Nom de la Banque')),
  P(celui(c1, 'Adresse')),
  P(celui(c1, 'Date')),
  P(celui(c1, 'Cachet')),
], JETONS_C1, traceC1);

// ══ C2 — caution personnelle et solidaire ═════════════════════════════════════════════════════
const c2 = utiles(section(SRC, 'C 2 –'));
const traceC2 = [];
// Titre sur deux lignes dans le gabarit, recollé. Les trois cas sont une liste « a) b) c) » (lowerLetter « %1) »).
const blocsC2 = jetonnerBlocs([
  P(celui(c2, 'Nous soussignés')),
  P(celui(c2, 'déclarons')),
  P(celui(c2, 'ladite caution')),
  P(celui(c2, 'Nous engageons')),
  P('a) ' + celui(c2, 'que son Offre')),
  P('b) ' + celui(c2, "qu'il n'a pas accepté")),
  P('c) ' + celui(c2, "que s'étant vu notifier")),
  P(celui(c2, '- il', 0)),
  P(celui(c2, '- il', 1)),
  P(celui(c2, 'Le présent engagement')),
  P(celui(c2, 'Fait à')),
  P(celui(c2, 'SIGNATURE')),
  P(celui(c2, 'Nom de la Banque')),
  P(celui(c2, 'Adresse')),
  P(celui(c2, 'Date')),
  P(celui(c2, 'Cachet')),
], JETONS_C2, traceC2);

// ══ Sortie ═══════════════════════════════════════════════════════════════════════════════════
const modeles = [
  { fichier: 'A1.docx', sigle: 'A1', section: ['A1 : IDENTIFICATION DU CANDIDAT', 'A2 : CAPACITES TECHNIQUES'], titre: celui(a1, 'A1 :'), blocs: blocsA1, trace: traceA1, ajouts: ['{{A1B.mention}}', '{{SI:A1B}}', '{{FINSI:A1B}}'] },
  { fichier: 'A2.docx', sigle: 'A2', section: ['A2 : CAPACITES TECHNIQUES', 'A3 : CAPACITES FINANCIERES'], titre: celui(a2, 'A2 :'), blocs: blocsA2, trace: [], ajouts: [] },
  { fichier: 'A3.docx', sigle: 'A3', section: ['A3 : CAPACITES FINANCIERES', 'A4'], titre: celui(a3, 'A3 :'), blocs: blocsA3, trace: traceA3, ajouts: ['a) ', 'b) ', 'c) ', 'd) ', '{{SI:A3B-NATURES}}', '{{FINSI:A3B-NATURES}}'] },
  { fichier: 'A4.docx', sigle: 'A4', section: ['A4', 'B. – Modèle'], titre: titreA4, blocs: blocsA4, trace: traceA4, ajouts: [] },
  { fichier: 'C1.docx', sigle: 'C1', section: ['C 1 –', 'C 2 –'], titre: celui(c1, 'C 1'), blocs: blocsC1, trace: traceC1, ajouts: ['(a) ', '(b) ', '(c) '] },
  { fichier: 'C2.docx', sigle: 'C2', section: ['C 2 –', null], titre: `${celui(c2, 'C 2')} ${celui(c2, 'de soumission')}`, blocs: blocsC2, trace: traceC2, ajouts: ['a) ', 'b) ', 'c) '] },
];

fs.mkdirSync('modeles-armp', { recursive: true });
const voulus = process.argv.slice(2);
for (const m of modeles) {
  if (voulus.length && !voulus.includes(m.sigle)) continue;
  fs.writeFileSync(`modeles-armp/${m.sigle}.json`, JSON.stringify(m, null, 1), 'utf8');
  const commande = [['FICHIER', m.fichier], ['TITRE', m.titre], ...m.blocs.map((x) => [x.type.toUpperCase(), x.texte])];
  fs.writeFileSync(`modeles-armp/${m.sigle}.txt`, commande.map((l) => l.join('\t')).join('\n') + '\n', 'utf8');
  const nb = (t) => m.blocs.filter((x) => x.type === t).length;
  console.log(`${m.sigle} — ${nb('para') + nb('sous_titre')} paragraphes, ${nb('table')} tableau(x), ${m.trace.length} substitution(s), ${m.ajouts.length} ajout(s)`);
  for (const s of m.trace) console.log(`     « ${s.source.slice(0, 72)} »  →  ${s.jeton}`);
}
