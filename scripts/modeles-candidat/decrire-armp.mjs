// Décrit les modèles du candidat sur les DOCUMENTS TYPES OFFICIELS de l'ARMP (fournitures, formulaires de
// soumission) — arbitrage du pilote du 27/09 : « Ajuster par rapport aux officiels ». Même principe que `decrire.mjs`
// (le décalque du dossier 2463) : le texte n'est JAMAIS retapé, il est lu dans `source-armp.txt` (produit par
// `extraire-armp.mjs`) ; ce qui est écrit ici, c'est la STRUCTURE (paragraphes, tableaux, cellules) et la
// CORRESPONDANCE (quel crochet du gabarit devient un jeton de la fiche). Les crochets qui désignent une saisie du
// CANDIDAT restent des crochets. Une dérive de la source fait échouer le script au lieu de produire un modèle faux.
//
//   node decrire-armp.mjs [A2 A4 C1 C2]     → modeles-armp/<sigle>.txt (commande Decalque) et .json (descripteur)
import fs from 'node:fs';
import { cle, droite, lireSource, propre, section } from './armp-commun.mjs';

const SRC = lireSource();
const US = '\u001F';   // séparateur de cellules
const RS = '\u001E';   // saut de paragraphe dans une cellule

/** Les lignes utiles d'une section : fin de ligne nettoyée, lignes vides et lignes de tableau vides écartées. */
const utiles = (lignes) => lignes.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
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
  { fichier: 'A2.docx', sigle: 'A2', section: ['A2 : CAPACITES TECHNIQUES', 'A3 : CAPACITES FINANCIERES'], titre: celui(a2, 'A2 :'), blocs: blocsA2, trace: [], ajouts: [] },
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
