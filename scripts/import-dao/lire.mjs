// Import du DAO — lot 0 (mesure), plan du 28/09 (`docs/plan-2026-09-28-import-dao.md`), décisions du pilote du 28/09 :
// les ANCRAGES viennent des modèles du lot D. Un DAO rédigé sur le document type se lit « à l'envers » : le texte fixe
// du modèle se retrouve dans le document, et ce qui occupe la place d'un jeton est la valeur ; la rédaction retenue
// d'une section conditionnelle dit la réponse (mono / multi-attributaire, reconductible ou non…).
//
// Prototype front, lecture seule : il PROPOSE, il n'écrit rien. C'est aussi la spécification de la route serveur
// (`POST /api/fiches-marche/{idDmc}/import`) : même algorithme, mêmes niveaux de confiance.
//
//   node lire.mjs <document.docx> <sigle du modèle> [--json=sortie.json]
//
// Sortie : { propositions: [{ code, valeur, brut, confiance, source, paragraphe }], cadrage: {cle: valeur},
//            conflits: [...], nonTrouves: [...] } — `confiance` : `haute` (paragraphe entier reconnu, texte fixe des
// deux côtés), `moyenne` (ancres locales, ou paragraphe fait d'un seul jeton, borné par ses voisins reconnus).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CP, JAVA } from '../modeles-dao/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODELES = path.resolve(ICI, '../modeles-dao/modeles');

// ── Normalisation commune au modèle et au document ─────────────────────────────────────────────
/** Apostrophes, tirets, espaces insécables, ligatures, pointillés : ce qui varie d'un traitement de texte à l'autre. */
export const norm = (s) => s.normalize('NFKC').replace(/[’ʼ‘`]/g, "'").replace(/[‐‑‒–—]/g, '-').replace(/[«»]/g, '"')
  .replace(/\u00A0|\u202F/g, ' ').replace(/\s+/g, ' ').trim();
const JETON = /\{\{([^{}]+)}}/g;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Un texte fixe en motif tolérant : blancs souples, espace facultative autour de la ponctuation. */
const motif = (fixe) => [...norm(fixe)].map((c) => (c === ' ' ? '\\s*' : /[,;:.!?()[\]"'\-/]/.test(c) ? `\\s*${esc(c)}\\s*` : esc(c)))
  .join('').replace(/(\\s\*)+/g, '\\s*');
const POINTILLES = /^[.…_\s]*$/;
/** Haute : bornée par le texte fixe des deux côtés, dans un paragraphe reconnu tel quel. Moyenne : bornée d'un côté,
 * ou paragraphe redécoupé. Basse : jeton seul d'une section non attestée, ou intervalle de plusieurs paragraphes. */
export const RANG = { basse: 1, moyenne: 2, haute: 3 };

// ── Le document ───────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ 30/09 (demande D4 §B6.3) — les paragraphes TELS QU'ÉCRITS (non normalisés, non vides une fois normalisés) : la
 * reconnaissance travaille sur `norm`, mais une valeur de texte est reprise dans le texte d'origine (« m³ », « ’ »,
 * « — », « « » » ne sont pas perdus).
 */
function paragraphesDOrigine(fichier) {
  if (/\.pdf$/i.test(fichier)) return paragraphesPdf(fichier);
  if (!/\.docx$/i.test(fichier)) throw new Error('un .docx ou un .pdf');
  // Paragraphes de cellule séparés (lot D2) : une cellule du DPAO enchaîne des rédactions, chacune se reconnaît seule.
  const lu = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', fichier, '--paragraphes'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return lu.replace(/\r\n?/g, '\n').split('\n').flatMap((l) => l.split(/[\t\u001E]/)).filter((l) => norm(l));
}
function paragraphes(fichier) {
  return paragraphesDOrigine(fichier).map(norm);
}

// ── La valeur reprise dans le texte d'origine (§B6.3) ─────────────────────────────────────────
const GRAPHEMES = new Intl.Segmenter('fr', { granularity: 'grapheme' });
/** `norm` sans le resserrement des blancs, appliqué à un seul graphème. */
const normGrapheme = (g) => g.normalize('NFKC').replace(/[’ʼ‘`]/g, "'").replace(/[‐‑‒–—]/g, '-').replace(/[«»]/g, '"').replace(/ | /g, ' ');
/**
 * Le texte normalisé d'un paragraphe et, pour chacune de ses positions, l'étendue du texte d'origine qui l'a produite
 * (NFKC change des longueurs : « ﬁ » → « fi », « … » → « ... »). `null` si la reconstruction ne redonne pas `norm`.
 */
function carteNormalisee(origine) {
  let texte = '';
  const debut = [], fin = [];
  let blanc = false;
  for (const { segment, index } of GRAPHEMES.segment(origine)) {
    for (const ch of normGrapheme(segment)) {
      if (/\s/.test(ch)) { blanc = true; continue; }
      if (blanc && texte) { texte += ' '; debut.push(-1); fin.push(-1); }
      blanc = false;
      texte += ch;
      for (let k = 0; k < ch.length; k++) { debut.push(index); fin.push(index + segment.length); }
    }
  }
  return texte === norm(origine) ? { texte, debut, fin, origine } : null;
}
/**
 * Une ligne de valeur (normalisée) retrouvée dans un paragraphe : son texte d'origine. Les blancs multiples, tabulations
 * et sauts de ligne deviennent une espace ; une espace insécable seule est gardée. `null` si la ligne n'est pas trouvée.
 */
function reprojeterLigne(ligne, cartes) {
  for (const c of cartes) {
    if (!c) continue;
    const i = c.texte.indexOf(ligne);
    if (i < 0) continue;
    return c.origine.slice(c.debut[i], c.fin[i + ligne.length - 1]).replace(/\s{2,}|[\t\r\n]/g, ' ');
  }
  return null;
}

/** PDFBox du dépôt Maven local (Q1 du plan : le PDF « texte » après le Word ; pas d'OCR). */
const M2 = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.m2/repository').replace(/\\/g, '/');
const CP_PDF = ['org/apache/pdfbox/pdfbox/3.0.3/pdfbox-3.0.3.jar', 'org/apache/pdfbox/fontbox/3.0.3/fontbox-3.0.3.jar',
  'org/apache/pdfbox/pdfbox-io/3.0.3/pdfbox-io-3.0.3.jar', 'commons-logging/commons-logging/1.3.5/commons-logging-1.3.5.jar']
  .map((j) => `${M2}/${j}`).join(process.platform === 'win32' ? ';' : ':');

/**
 * Les paragraphes d'un PDF « texte », refaits depuis la POSITION des lignes (`PdfLignes.java`) : l'extraction à plat
 * rend d'abord toutes les clauses d'une page puis toutes les valeurs (constat du 28/09 sur le 2463).
 *   1. les morceaux d'une même ligne de base, contigus, sont recollés (le PDF coupe « renseign » + « ements ») ;
 *   2. un saut d'abscisse sur la même ligne sépare deux COLONNES (le tableau « clause | données particulières ») ;
 *   3. dans une colonne, deux lignes successives font un paragraphe si l'interligne est normal ; un blanc plus grand
 *      ouvre un paragraphe ;
 *   4. l'ordre de lecture d'une page : par hauteur de début de paragraphe, puis de gauche à droite — la clause d'une
 *      rangée avant ses données, comme dans le Word.
 */
function paragraphesPdf(fichier) {
  const tsv = execFileSync(JAVA, ['-cp', CP_PDF, path.join(ICI, 'PdfLignes.java'), fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
  const morceaux = tsv.split(/\r?\n/).filter(Boolean).map((l) => {
    const [page, x, y, xFin, h, ...t] = l.split('\t');
    return { page: +page, x: +x, y: +y, xFin: +xFin, h: +h, texte: t.join(' ') };
  });
  // Les en-têtes et pieds de page (même texte au même endroit sur trois pages au moins) et les numéros de page seuls
  // ne sont pas du texte du DAO : ils se mêleraient aux paragraphes (« 37 ARTICLE 2 - PRIX », constat du 29/09).
  const hautBas = new Map();
  for (const m of morceaux) { const k = `${Math.round(m.y / 4)}|${norm(m.texte)}`; hautBas.set(k, (hautBas.get(k) ?? new Set()).add(m.page)); }
  const repete = (m) => (hautBas.get(`${Math.round(m.y / 4)}|${norm(m.texte)}`)?.size ?? 0) >= 3;
  const numeroDePage = (m) => /^\d{1,3}$/.test(norm(m.texte)) || /^page\s+\d+(\s+(sur|\/)\s+\d+)?$/i.test(norm(m.texte));
  const sortie = [];
  for (const page of [...new Set(morceaux.map((m) => m.page))]) {
    // 1-2. Lignes de la page (même ligne de base à 1,5 pt près), morceaux recollés ou séparés en colonnes.
    const ms = morceaux.filter((m) => m.page === page && !repete(m) && !numeroDePage(m)).sort((a, b) => a.y - b.y || a.x - b.x);
    const lignes = [];
    for (const m of ms) {
      const l = lignes.find((q) => Math.abs(q.y - m.y) <= 1.5 && m.x >= q.xFin - 1 && m.x - q.xFin <= 3);
      if (l) { l.texte += (m.x - l.xFin > 0.8 ? ' ' : '') + m.texte; l.xFin = m.xFin; } else lignes.push({ ...m });
    }
    lignes.sort((a, b) => a.y - b.y || a.x - b.x);
    // 3. Paragraphes par colonne : une ligne rejoint le paragraphe ouvert de sa colonne si elle le suit à interligne normal.
    // La frontière des colonnes se MESURE aussi (01/10, DAO travaux du MEN : la colonne des données commence à x ≈ 183,
    // libellés et valeurs mêlés sous le réglage fixe de 240 pris sur le 2463) : l'abscisse de départ la plus fréquente
    // d'un morceau qui suit, sur la même ligne de base, un morceau d'une autre colonne (saut de plus de 12 pt). Page sans
    // telle paire, ou paire trop rare : 240, comme avant.
    const departs = new Map();
    for (const l of lignes) {
      if (lignes.some((q) => q !== l && Math.abs(q.y - l.y) <= 1.5 && q.xFin + 12 < l.x)) { const x = Math.round(l.x); departs.set(x, (departs.get(x) ?? 0) + 1); }
    }
    const [frontiere, nbFrontiere] = [...departs.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [240, 0];
    const borne = nbFrontiere >= 3 ? frontiere - 2 : 240;
    const colonneDe = (x) => (x >= borne ? 1 : 0);
    // L'interligne d'un paragraphe se MESURE sur la page : le plus petit écart vertical fréquent entre deux lignes
    // successives d'une même colonne (9,7 pt dans le 2463 ; 15 pt dans nos PDF, où 18 pt sépare deux paragraphes).
    // Un réglage fixe, fait sur le 2463, ne rejoignait pas les lignes de nos propres PDF (constat backend du 29/09).
    const ecarts = new Map();
    for (const c of [0, 1]) {
      const ys = lignes.filter((l) => colonneDe(l.x) === c).map((l) => l.y);
      for (let i = 1; i < ys.length; i++) { const e = Math.round((ys[i] - ys[i - 1]) * 2) / 2; if (e >= 3) ecarts.set(e, (ecarts.get(e) ?? 0) + 1); }
    }
    const frequents = [...ecarts.entries()].filter(([, n]) => n >= 2).map(([e]) => e).sort((a, b) => a - b);
    const interligne = frequents[0] ?? 10;
    const ouverts = new Map();
    const pars = [];
    for (const l of lignes) {
      const c = colonneDe(l.x);
      const o = ouverts.get(c);
      const pas = interligne + 1;
      if (o && l.y - o.yDernier > 0 && l.y - o.yDernier <= pas) { o.texte += ' ' + l.texte; o.yDernier = l.y; continue; }
      const p = { colonne: c, y: l.y, yDernier: l.y, texte: l.texte };
      pars.push(p);
      ouverts.set(c, p);
    }
    // 4. Ordre de lecture.
    // Deux paragraphes qui commencent sur la même ligne de base À 1,5 PT PRÈS sont une même rangée : la clause d'abord
    // (01/10, DAO travaux du MEN : la valeur est posée 0,5 pt plus haut que son libellé, et passait devant lui).
    pars.sort((a, b) => a.y - b.y);
    const rangs = [];
    for (const p of pars) { const r = rangs.at(-1); if (r && p.y - r[0].y <= 1.5) r.push(p); else rangs.push([p]); }
    pars.splice(0, pars.length, ...rangs.flatMap((r) => r.sort((a, b) => a.colonne - b.colonne || a.y - b.y)));
    for (const p of pars) { const t = p.texte.replace(/(\w)- (\w)/g, '$1$2'); if (norm(t)) sortie.push(t); }   // non normalisé (§B6.3)
  }
  return sortie;
}

// ── Le modèle ─────────────────────────────────────────────────────────────────────────────────
/**
 * Les paragraphes du modèle, chacun avec la pile des sections conditionnelles qui l'entourent. Lot D2 : un marqueur
 * peut être un paragraphe, une LIGNE de tableau (première cellule `{{SI:X}}`, les autres vides : section de rangées)
 * ou un paragraphe DE CELLULE (section interne à la cellule) — lus comme le moteur du serveur les lit.
 */
function unites(m) {
  const pile = [];
  const out = [];
  const marqueur = (t) => /^\{\{(SI|FINSI):([A-Z0-9-]+)}}$/.exec(t.trim());
  for (const b of m.blocs) {
    if (['table', 'fin_table', 'vide'].includes(b.type)) continue;
    const cellules = b.type === 'ligne' ? b.texte.split('\u001F') : [b.texte];
    const mr = marqueur(cellules[0]);
    if (mr && cellules.slice(1).every((c) => !c.trim())) { if (mr[1] === 'SI') pile.push(mr[2]); else pile.pop(); continue; }
    for (const cel of cellules) {
      const local = [];
      for (const t of cel.split('\u001E')) {
        const mc = marqueur(t);
        if (mc) { if (mc[1] === 'SI') local.push(mc[2]); else local.pop(); continue; }
        if (t.trim()) out.push({ texte: t, sections: [...pile, ...local] });
      }
    }
  }
  return out;
}

/** Le motif d'un paragraphe du modèle : texte fixe littéral, chaque jeton capturé. `[[CLAUSE …]]` se lit tel quel. */
function motifParagraphe(texte) {
  const jetons = [];
  let re = '';
  let i = 0;
  for (const m of texte.matchAll(JETON)) {
    re += motif(texte.slice(i, m.index));
    re += '(.+?)';
    jetons.push(m[1]);
    i = m.index + m[0].length;
  }
  re += motif(texte.slice(i));
  // Le point final est facultatif (01/10, DAO travaux du MEN : « …sera de CENT VINGT (120) jours », sans point) —
  // seulement quand du texte fixe le précède : un jeton qui finirait le paragraphe garderait son point dans la valeur.
  if (/[^\s}]\s*\.\s*$/.test(texte)) re = re.replace(/\\s\*\\\.\\s\*$/, '(?:\\s*\\.)?\\s*');
  return { re: new RegExp(`^${re}$`, 'i'), jetons };
}

// ── Valeurs ───────────────────────────────────────────────────────────────────────────────────
/** Remet une valeur imprimée dans la forme de saisie du champ (le « normaliser » du serveur, côté lecture). */
function valeurSaisie(brut, type, suffixe) {
  const v = norm(brut);
  if (POINTILLES.test(v)) return null;   // un jeton vide s'imprime en pointillés (R2)
  // Une unité seule devant ou derrière des pointillés est une case laissée en blanc (01/10, AE du MEN : « Jours …. »).
  // Les caractères d'usage privé (U+E000-U+F8FF) sont des glyphes de police Symbol — ici l'astérisque de renvoi « ….* ».
  if (/[.…_]{2,}/.test(v) && POINTILLES.test(v.replace(/[-]/g, '').replace(/(?<![\p{L}])(?:jours?|mois|ans?|ann[ée]es?|heures?|semaines?|ariary|ar|%)(?![\p{L}])/giu, ''))) return null;
  const chiffres = (s) => { const n = s.replace(/ariary|ar\.?|%|\s/gi, '').replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(n) ? n : null; };
  // Règle « MOTS (n) » (01/10, DAO travaux du MEN) : l'usage écrit le nombre en lettres puis en chiffres entre
  // parenthèses — « CENT VINGT (120) », « Cinq (05) », « neuf cent mille Ariary (Ar 9 900 000) ». Les chiffres font foi ;
  // ce qui précède la parenthèse ne doit être que des lettres (aucun autre chiffre qui pourrait contredire).
  const nombre = (s) => {
    const p = /^[\p{L}\s'’.-]+\(\s*((?:ar\.?\s*)?[\d\s.,]+(?:\s*(?:ariary|ar\.?|%))?)\s*\)$/iu.exec(s.trim());
    return chiffres(p ? p[1] : s);
  };
  if (suffixe === 'chiffres' || ['NOMBRE', 'MONTANT', 'POURCENTAGE'].includes(type)) return nombre(v);
  if (type === 'DATE') { const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return d ? `${d[3]}-${d[2]}-${d[1]}` : null; }
  if (type === 'DATE_HEURE') { const d = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(v); return d ? `${d[3]}-${d[2]}-${d[1]}T${d[4]}:${d[5]}` : null; }
  // ⚠️ 30/09 (§B6) — la ponctuation de tête n'est pas la valeur : « - tranche conditionnelle 1 {{B02-LT-04}} » lu dans
  // « Tranche conditionnelle 1 : … » rendait « : … », en conflit avec la même valeur lue ailleurs.
  return v.replace(/^(?:[:;,.]\s*)+/, '') || null;
}
/** Les types dont la valeur se convertit depuis le texte normalisé : jamais reprojetés sur le texte d'origine. */
const TYPES_CONVERTIS = ['NOMBRE', 'MONTANT', 'POURCENTAGE', 'DATE', 'DATE_HEURE', 'LISTE', 'LISTE_MULTIPLE', 'OUI_NON'];

/** Les réponses qu'implique une section retenue : chaque terme `cle = valeur` d'une conjonction (pas de `ou`, pas de `!=`). */
// ⚠️ 30/09 — comme le DEBUT_TERME du serveur : « et » / « ou » ne séparent deux termes que s'ils sont suivis d'une clé et
// d'un opérateur ; sinon ils appartiennent à la valeur (« Au fur et à mesure des besoins »).
const ET = /\s+et\s+(?=[\w-]+\s*(?:!?=|contient\b|renseigne\b|vide\b))/;
const OU = /\s+ou\s+(?=[\w-]+\s*(?:!?=|contient\b|renseigne\b|vide\b))/;
function implications(expression) {
  if (!expression || OU.test(expression)) return [];
  return expression.split(ET).map((t) => /^([\w-]+)\s*(=|contient)\s*(.+)$/.exec(t.trim())).filter(Boolean).map((x) => [x[1], x[3].trim(), x[2]]);
}

// ── La lecture ────────────────────────────────────────────────────────────────────────────────
export function lire(fichier, sigle, champs = {}) {
  if (Array.isArray(fichier)) return lireParagraphes(fichier, sigle, champs);
  const origines = paragraphesDOrigine(fichier);
  return lireParagraphes(origines.map(norm), sigle, champs, origines);
}

/** Les paragraphes du document, déjà extraits : un DAO en un seul fichier (avis, DPAC, AE à la suite) se lit modèle par modèle. */
export { paragraphes, paragraphesDOrigine, carteNormalisee, reprojeterLigne };   // les deux dernières : pour test_reprojection.mjs

// `origines` : les mêmes paragraphes tels qu'écrits (§B6.3) ; sans eux, les valeurs restent normalisées (banc, texte déjà extrait).
export function lireParagraphes(docLu, sigle, champs = {}, origines = null) {
  const m = JSON.parse(fs.readFileSync(path.join(MODELES, `${sigle}.json`), 'utf8'));
  const us = unites(m);
  // Un paragraphe atteste ses sections s'il a assez de texte fixe (20 lettres) et qu'aucun paragraphe de même texte
  // n'existe hors de ces sections.
  const cleTexte = (u) => norm(u.texte.replace(JETON, '{}')).toLowerCase();
  // ⚠️ 01/10 (§B4.3) — les lettres d'un trou laissé au candidat (« <nom du Titulaire> ») ne comptent pas : ce n'est pas du
  // texte de clause, et il revient d'une annexe à l'autre. Sous bruit, « ATTENDU QUE » + « <nom du Titulaire> » fusionnés
  // (annexe de restitution d'avance) devenaient l'en-tête de l'annexe de bonne exécution, et attestaient B05-GE-01 = OUI.
  const distinctif = (u) => u.sections.length > 0 && u.texte.replace(JETON, ' ').replace(/<[^<>]*>/g, ' ').normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '').length >= 20
    && !us.some((v) => v !== u && cleTexte(v) === cleTexte(u) && v.sections.join('|') !== u.sections.join('|'));
  const doc = [...docLu];      // copie : un paragraphe fusionné par l'autorité y est redécoupé
  const trouves = new Map();   // indice de l'unité → indice du paragraphe du document
  const propositions = [];
  const sectionsVues = new Set();   // attestées par du TEXTE FIXE reconnu, jamais par un jeton seul
  // Un paragraphe dont le texte fixe n'a pas de lettre (« {{B05-MO-02}}. ») reconnaîtrait presque tout paragraphe
  // finissant par un point (constat du 29/09 sur le 2463 : « 6.6 » lu comme une devise, en confiance haute) : c'est un
  // jeton seul, lu entre ses voisins (étape 2).
  const lettresFixes = (t) => t.replace(JETON, ' ').normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '');
  const seulJeton = (u) => /\{\{/.test(u.texte) && lettresFixes(u.texte).length === 0;
  // Le nombre d'unités du modèle par texte fixe, compté une fois : « jumeau » et « répété » le relisent sans tout reparcourir.
  const occurrences = new Map();
  for (const v of us) occurrences.set(cleTexte(v), (occurrences.get(cleTexte(v)) ?? 0) + 1);
  const repeteAilleurs = (u) => occurrences.get(cleTexte(u)) > 1;
  const jumeau = (u) => /\{\{/.test(u.texte) && repeteAilleurs(u);
  // ⚠️ 01/10 (règle R-c, parité `LectureDao`, demande avis §B9) — deux VARIANTES d'un même paragraphe, sous des sections
  // différentes, reconnaissent le même paragraphe du document : la PLUS CONTRAINTE gagne, celle qui a le plus de texte
  // fixe (caractères hors blancs : « … de {{a}} ({{b}}) libellé » l'emporte sur « … de {{a.parLot}} libellé », dont le
  // trou unique avale tout). Constat du backend : sur un DPAC de contrat-cadre non alloti, la variante « par lot »,
  // placée en premier, prenait la phrase du montant ; l'import en déduisait « alloti = OUI » et ne lisait plus le montant.
  const fixe = (u) => norm(u.texte.replace(JETON, '')).replace(/\s/g, '').length;
  const motifs = new Map();
  const motifDe = (q) => { if (!motifs.has(q)) motifs.set(q, motifParagraphe(us[q].texte).re); return motifs.get(q); };
  const variantePlusContrainte = (u, k, paragraphe) => {
    for (let q = k + 1; q < Math.min(us.length, k + 9); q++) {
      const v = us[q];
      if (seulJeton(v) || v.sections.join('|') === u.sections.join('|') || fixe(v) <= fixe(u)) continue;
      if (motifDe(q).test(paragraphe)) return true;
    }
    return false;
  };

  // Les débuts de paragraphe du modèle (texte fixe avant le premier jeton, au moins 6 caractères) : retrouvés DANS une
  // valeur capturée, ils disent qu'un paragraphe suivant a été collé derrière (fusion), et où couper.
  const debuts = us.map((u) => norm(u.texte.split(/\{\{/)[0]).toLowerCase().slice(0, 40)).map((d) => (d.length >= 6 ? d : null));
  /** Coupe un texte au premier début d'un paragraphe SUIVANT du modèle (k + 1 … k + 40) ; null s'il n'y en a pas. */
  const couper = (texte, k) => {
    const t = texte.toLowerCase();
    let i = -1;
    for (let q = k + 1; q < Math.min(us.length, k + 41); q++) {
      if (!debuts[q]) continue;
      const p = t.indexOf(debuts[q], 1);
      if (p > 0 && (i < 0 || p < i)) i = p;
    }
    return i > 0 ? [texte.slice(0, i).trim(), texte.slice(i).trim()] : null;
  };

  // 1. Les paragraphes reconnus, dans l'ordre (un curseur empêche un texte répété de se lire deux fois).
  let curseur = 0;
  // ⚠️ 02/10 (règle 8, DAO routier du MTP) — RÉANCRAGE. La première accroche se cherche dans tout le document : elle
  // peut tomber sur le SOMMAIRE (« 1.2 Données Particulières de l'Appel d'Offres (DPAO) » ressemble au titre du modèle),
  // et la fenêtre de 60 paragraphes ne rejoignait jamais le vrai DPAO, 300 paragraphes plus loin (1 paragraphe reconnu
  // sur 161). Après REANCRAGE paragraphes distinctifs du modèle manqués d'affilée, un paragraphe distinctif se cherche
  // dans tout le reste du document ; la première reconnaissance remet le compte à zéro.
  const REANCRAGE = 5;
  let manques = 0;
  us.forEach((u, k) => {
    if (seulJeton(u)) return;   // un jeton seul : borné par ses voisins, étape 2
    const { re, jetons } = motifParagraphe(u.texte);
    const finitParFixe = !/\}\}\s*$/.test(u.texte) && norm(u.texte.replace(JETON, '')).length > 0;
    const reTete = finitParFixe ? new RegExp(re.source.replace(/\$$/, ''), 'i') : null;
    // Tant que rien n'est reconnu, tout le document est cherché (le modèle peut commencer loin dans un DAO en un seul
    // fichier) ; ensuite, une fenêtre de 60 paragraphes après le dernier reconnu.
    // ⚠️ 30/09 — un texte que le modèle répète ailleurs (« Non applicable ») ne se cherche que tout près du curseur :
    // absent du document, il se raccrochait au « Non applicable » d'un article plus loin et la lecture sautait tout ce
    // qui les séparait (CCAP-T, banc synthétique : les assurances de l'article 8 perdues).
    const repete = repeteAilleurs(u);
    const reancre = manques >= REANCRAGE && distinctif(u) && !repete;
    // ⚠️ 03/10 (règle 9, DPAO-F réimporté, constat du backend) — une unité dont le texte fixe compte moins de 8 lettres
    // (« {{B02-AU-04}} mois. ») ne prouve rien : absente du document (clause 1.2 du marché à commande, en quantité fixe),
    // elle s'accrochait à « … datée de moins de TROIS (03) mois » de la clause 6.2, et le curseur sautait tout ce qui les
    // séparait (25 unités reconnues sur 142 au lieu de 65). Au-delà des PRES paragraphes qui suivent le curseur, elle ne se
    // reconnaît plus que dans un paragraphe COURT (COURT caractères au plus) : une étiquette et sa valeur (« Lieu : … »,
    // « 07 jours »), jamais le bout d'une phrase. La forme proposée par le backend — tout près du curseur seulement — perdait
    // au DAO du MTP « Date : », « Lieu : » et « 07 jours », justes, 4 à 42 paragraphes plus loin (8 → 5 reconnus).
    const PRES = 3;
    const COURT = 60;
    // Sans aucune lettre (« 1 », un numéro d'annexe), même un paragraphe court ne prouve rien : tout près seulement (CCAP
    // du MEN : « 1 » reconnu 48 paragraphes plus loin, et la suite perdue).
    const lettres = lettresFixes(u.texte).length;
    const pauvre = lettres < 8;
    const borne = trouves.size && !reancre ? Math.min(doc.length, curseur + (repete ? 3 : 60)) : doc.length;
    const avant = trouves.size;
    for (let j = curseur; j < borne; j++) {
      if (pauvre && j >= curseur + PRES && (lettres === 0 || doc[j].length > COURT)) continue;
      let x = re.exec(doc[j]);
      // Un paragraphe dont un autre paragraphe du modèle a le même texte fixe (« {{B04-EP-03}} jours avant la date
      // limite… » / « {{B04-EP-04}} jours avant la date limite… ») peut prendre la place de son jumeau quand celui-ci
      // n'est pas reconnu : c'est l'ordre, pas le texte, qui les distingue — jamais la confiance haute (29/09).
      let confiance = lettresFixes(u.texte).length >= 8 && !jumeau(u) ? 'haute' : 'moyenne';
      // Un paragraphe qui finit par du texte fixe se reconnaît aussi EN TÊTE d'un paragraphe fusionné : le reste est relu.
      if (!x && reTete) {
        x = reTete.exec(doc[j]);
        if (x && doc[j].slice(x[0].length).trim()) { doc.splice(j + 1, 0, doc[j].slice(x[0].length).trim()); doc[j] = x[0]; confiance = 'moyenne'; }
      }
      if (!x) continue;
      // ⚠️ 03/10 (règle 9, suite — piste du backend) — loin du curseur, une unité pauvre ne se reconnaît que si chaque
      // valeur capturée a la FORME DE SON TYPE : un nombre pour un NOMBRE, une date pour une DATE. Le défaut réel de
      // B03-CQ-01 a une ligne de 54 caractères, « un certificat de non faillite datée de moins de 2 mois », sous le seuil
      // COURT : « {{B02-AU-04}} mois. » s'y accrochait encore, et lisait « un certificat … de 2 » pour un nombre.
      // Le type vient du référentiel ; à défaut (B02-AU-04 n'est pas servi en quantité fixe), du texte : un jeton suivi
      // d'une unité (« mois », « jours », « ans », « % »…) attend un nombre.
      if (pauvre && j >= curseur + PRES && !jetons.every((jt, n) => {
        const [code, suffixe] = jt.split('.');
        const type = champs[code.split('#')[0]]?.type;
        const apres = u.texte.slice(u.texte.indexOf(`{{${jt}}}`) + jt.length + 4);
        const unite = /^\s*(?:mois|jours?|ans?|ann[ée]es?|semaines?|heures?|%)(?![\p{L}])/iu.test(apres);
        // Une date s'écrit aussi en toutes lettres (« 22 octobre 2026 », DAO du MTP) : il lui suffit de porter une année.
        if (['DATE', 'DATE_HEURE'].includes(type) && !suffixe) return /\b(?:19|20)\d{2}\b/.test(x[n + 1]);
        const numerique = suffixe === 'chiffres' || unite || ['NOMBRE', 'MONTANT', 'POURCENTAGE'].includes(type);
        return !numerique || valeurSaisie(x[n + 1], type ?? (unite ? 'NOMBRE' : undefined), suffixe) != null;
      })) continue;
      if (variantePlusContrainte(u, k, doc[j])) break;   // R-c : le paragraphe revient à la variante plus contrainte
      trouves.set(k, j);
      curseur = j + 1;
      if (distinctif(u)) u.sections.forEach((x) => sectionsVues.add(x));
      jetons.forEach((jt, n) => {
        let brut = x[n + 1];
        let c = confiance;
        // Le dernier jeton d'un paragraphe qui finit par lui n'a pas de borne à droite : s'il contient le début d'un
        // paragraphe suivant du modèle, c'est une fusion — la valeur est coupée là, le reste relu, la confiance baisse.
        // ⚠️ 29/09 — y compris quand le paragraphe finit par du texte fixe (« … est {{B02-OB-01}}. ») : fusionné avec les
        // suivants, il se termine encore par un point, et la valeur les avalait en confiance haute (banc synthétique, AE du
        // contrat-cadre). Le texte fixe final revient alors au reste relu, pas à la valeur.
        if (n === jetons.length - 1) {
          const cp = couper(brut, k);
          if (cp) {
            brut = cp[0]; c = 'moyenne';
            const fin = finitParFixe ? norm(u.texte.slice(u.texte.lastIndexOf('}}') + 2)) : '';
            if (fin && brut.endsWith(fin)) brut = brut.slice(0, -fin.length).trimEnd();
            doc.splice(j + 1, 0, `${cp[1]}${fin}`);
          }
        }
        propositions.push({ jeton: jt, brut, confiance: c, source: 'paragraphe', paragraphe: j, finOuverte: n === jetons.length - 1 && !finitParFixe });
      });
      break;
    }
    if (trouves.size > avant) manques = 0; else if (distinctif(u)) manques++;
  });

  // 2. Un paragraphe fait d'un seul jeton (`{{B02-AL-02}}`, `{{B07-DE-02}}`) : ce qui sépare ses voisins reconnus.
  //    - Plusieurs tels paragraphes dans le même intervalle (`B07-DE-02` ou `B07-DE-03`, selon une réponse que rien
  //      n'imprime) : AMBIGU — la lecture le dit, elle ne choisit pas.
  //    - Dans une section que rien d'autre n'atteste (clause libre, garantie particulière…), ou sur plusieurs
  //      paragraphes : confiance BASSE — l'intervalle peut être un paragraphe ajouté par l'autorité.
  //    - Un intervalle qui commence comme un paragraphe du modèle est du texte du modèle mal reconnu : écarté.
  //    Un jeton seul n'atteste jamais sa section : il ne sert pas à déduire une réponse (étape 3).
  const ambigus = [];
  const intervalles = new Map();
  us.forEach((u, k) => {
    const seul = seulJeton(u) ? /\{\{([^{}]+)}}/.exec(u.texte) : null;
    if (!seul) return;
    let a = k - 1; while (a >= 0 && !trouves.has(a)) a--;
    let b = k + 1; while (b < us.length && !trouves.has(b)) b++;
    if (a < 0 || b >= us.length) return;
    const cle = `${a}:${b}`;
    if (!intervalles.has(cle)) intervalles.set(cle, { a, b, jetons: [] });
    intervalles.get(cle).jetons.push({ jeton: seul[1], sections: u.sections, k });
  });
  const ressembleAuModele = (t) => debuts.some((d) => d && d.length >= 12 && norm(t).toLowerCase().startsWith(d));
  // ⚠️ 30/09 — une section dont aucun paragraphe de texte fixe n'est reconnu, alors qu'elle en a, est ABSENTE du
  // document : ses jetons seuls ne rendent plus l'intervalle ambigu (CCAP-T : « {{B02-OT-02}}. » suivi de la liste
  // des lots, sous ALLOTI, sur un marché non alloti). Le jeton qui reste est lu en confiance basse.
  const absente = (s) => !sectionsVues.has(s)
    && us.some((u) => u.sections.includes(s) && distinctif(u))
    && !us.some((u, k) => u.sections.includes(s) && trouves.has(k));
  for (const iv of intervalles.values()) {
    const tous = iv.jetons;
    const presents = tous.filter((j) => !j.sections.some(absente));
    iv.filtre = presents.length === 1 && tous.length > 1;
    if (iv.filtre) iv.jetons = presents;
  }
  for (const { a, b, jetons, filtre } of intervalles.values()) {
    const entre = doc.slice(trouves.get(a) + 1, trouves.get(b));
    if (!entre.length || entre.length > 6) continue;
    if (jetons.length > 1) { ambigus.push({ candidats: jetons.map((j) => j.jeton), texte: entre.join('\n'), paragraphe: trouves.get(a) + 1 }); continue; }
    if (ressembleAuModele(entre[0])) continue;
    const j = jetons[0];
    const atteste = j.sections.every((s) => sectionsVues.has(s));
    let brut = entre.join('\n');
    const cp = couper(brut, j.k);
    if (cp) brut = cp[0];
    // Le texte fixe sans lettre qui entoure le jeton (« {{B05-GS-03.parLot}}. ») n'est pas la valeur : sinon « Lot n° 2 :
    // 500 000 Ariary. » ne se lit plus comme un montant (écart relevé par le backend le 29/09, porté ici par parité).
    const [avant, apres] = us[j.k].texte.split(/\{\{[^{}]+}}/).map((t) => t.trim());
    if (apres && brut.trimEnd().endsWith(apres)) brut = brut.trimEnd().slice(0, -apres.length).trimEnd();
    if (avant && brut.trimStart().startsWith(avant)) brut = brut.trimStart().slice(avant.length).trimStart();
    const confiance = atteste && entre.length === 1 && !cp && !filtre ? 'moyenne' : 'basse';
    // Plusieurs jetons séparés de ponctuation seule (« {{B02-OB-03}} — {{B02-OB-01}} ») : rien n'est proposé. Tout donner
    // au premier jeton est une fausse valeur, et le séparateur ne découpe pas sûrement (le tiret du modèle devient « - »
    // à la normalisation, comme les traits d'union des valeurs) — mesure du 29/09.
    if ([...us[j.k].texte.matchAll(JETON)].length > 1) continue;
    propositions.push({ jeton: j.jeton, brut, confiance, source: 'entre-voisins', paragraphe: trouves.get(a) + 1 });
  }

  // 3. Les réponses que disent les rédactions retenues.
  const cadrage = {};
  const conflits = [];
  // ⚠️ 01/10 (B05-GQ-02 en LISTE_MULTIPLE) — un terme `CODE contient Option` d'une section retenue ajoute l'option à la
  // liste du champ, si c'est une option ENTIÈRE du référentiel (« contient bancaire », fragment, ne dit rien) : un DAO qui
  // admet les trois formes de garantie donne les trois options.
  const multiples = new Map();
  for (const s of sectionsVues) {
    for (const [cle, valeur, op] of implications(m.conditions[s])) {
      if (op === 'contient') {
        const option = (champs[cle]?.options ?? []).find((o) => norm(o).toLowerCase() === norm(valeur).toLowerCase());
        if (option) { const l = multiples.get(cle) ?? []; if (!l.includes(option)) l.push(option); multiples.set(cle, l); }
        continue;
      }
      if (cle in cadrage && cadrage[cle] !== valeur) conflits.push({ cle, valeurs: [cadrage[cle], valeur], section: s });
      else cadrage[cle] = valeur;
    }
  }
  for (const [cle, options] of multiples) {
    // L'ordre est celui du référentiel, pas celui du document : deux lectures d'un même DAO donnent la même valeur.
    const valeur = options.sort((a, b) => champs[cle].options.indexOf(a) - champs[cle].options.indexOf(b)).join(',');
    if (cle in cadrage && cadrage[cle] !== valeur) conflits.push({ cle, valeurs: [cadrage[cle], valeur], section: 'contient' });
    else cadrage[cle] = valeur;
  }

  // 4. Valeurs dans la forme de saisie ; un même champ lu deux fois différemment est un conflit, pas un choix.
  const parCode = new Map();
  // Une valeur « par lot » d'un document commun (`{{CODE.parLot}}`, lot D2) : « Lot n° 1 : v1 ; Lot n° 2 : v2 » devient
  // CODE#1, CODE#2 ; sans mention de lot, la valeur seule (ligne non allotie).
  const etendues = propositions.flatMap((p) => {
    const [code, suffixe] = p.jeton.split('.');
    if (suffixe !== 'parLot') return [p];
    const parts = norm(p.brut).split(/lot\s*n\s*°?\s*(\d+)\s*:\s*/i);
    if (parts.length < 3) return [{ ...p, jeton: code }];
    const lots = [];
    for (let i = 1; i + 1 < parts.length; i += 2) lots.push({ ...p, jeton: `${code}#${parts[i]}`, brut: parts[i + 1].replace(/\s*;\s*$/, '') });
    return lots;
  });
  for (const p of etendues) {
    const [jeton, suffixe] = p.jeton.split('.');
    const code = jeton.split('#')[0];
    if (!/^B\d\d-/.test(code) || suffixe === 'lettres') continue;   // LOT, DERIVE, montant en lettres : contrôles, pas des valeurs
    const valeur = valeurSaisie(p.brut, champs[code]?.type, suffixe);
    if (valeur == null) continue;
    // Ouverte à droite (rien du modèle ne la borne), une valeur de TEXTE peut avoir avalé un paragraphe ajouté : elle ne
    // reste haute que si son type la contraint (un nombre, un montant, une date collés à du texte ne se convertissent pas).
    const contrainte = suffixe === 'chiffres' || ['NOMBRE', 'MONTANT', 'POURCENTAGE', 'DATE', 'DATE_HEURE'].includes(champs[code]?.type);
    if (p.finOuverte && p.confiance === 'haute' && !contrainte) p.confiance = 'moyenne';
    // Un reflet du cadrage (`B08-AV-02` = `tauxAvance`) se propose comme RÉPONSE de cadrage, pas comme valeur de champ.
    if (champs[code]?.source === 'CADRAGE' && champs[code]?.cleCadrage) { cadrage[champs[code].cleCadrage] ??= valeur; continue; }
    const deja = parCode.get(jeton);
    if (deja && deja.valeur !== valeur) { conflits.push({ code: jeton, valeurs: [deja.valeur, valeur] }); deja.conflit = true; continue; }
    if (!deja || RANG[p.confiance] > RANG[deja.confiance]) {
      const texte = suffixe !== 'chiffres' && !TYPES_CONVERTIS.includes(champs[code]?.type);
      parCode.set(jeton, { code: jeton, valeur, brut: norm(p.brut), confiance: p.confiance, source: p.source, paragraphe: p.paragraphe, lignes: texte ? p.brut.split('\n') : null });
    }
  }
  // ⚠️ 30/09 (§B6.3) — une valeur de texte est reprise dans le texte d'origine, ligne par ligne, APRÈS la détection des
  // conflits (qui reste sur le texte normalisé : pas de faux conflit). Une ligne introuvable garde la valeur normalisée.
  const cartes = origines ? new Array(origines.length) : null;
  const carte = (i) => (cartes[i] === undefined ? (cartes[i] = carteNormalisee(origines[i])) : cartes[i]);
  const reprojeter = (p) => {
    if (!origines || !p.lignes) return p.valeur;
    const lignes = p.lignes.map(norm).filter(Boolean);
    if (lignes.length) lignes[0] = lignes[0].replace(/^(?:[:;,.]\s*)+/, '');
    if (lignes.join(' ') !== p.valeur) return p.valeur;
    // D'abord à partir du paragraphe lu (quelques rangs plus tôt : un redécoupage de fusion décale les indices), puis le reste.
    const lo = Math.max(0, Math.min(origines.length, (p.paragraphe ?? 0) - 5));
    const toutes = { [Symbol.iterator]: function* () { for (let i = lo; i < origines.length; i++) yield carte(i); for (let i = 0; i < lo; i++) yield carte(i); } };
    const reprises = lignes.map((l) => reprojeterLigne(l, toutes));
    return reprises.every((r) => r != null) ? reprises.join(' ') : p.valeur;
  };
  const final = [...parCode.values()].filter((p) => !p.conflit).map(({ lignes, ...p }) => ({ ...p, valeur: reprojeter({ ...p, lignes }) }));
  const attendus = [...new Set(us.flatMap((u) => [...u.texte.matchAll(JETON)].map((x) => x[1].split('.')[0])).filter((c) => /^B\d\d-/.test(c)))];
  return { sigle, paragraphesDocument: doc.length, unitesModele: us.length, reconnues: trouves.size, propositions: final, cadrage, conflits, ambigus,
    nonTrouves: attendus.filter((c) => ![...parCode.keys()].some((k) => k.split('#')[0] === c)) };
}

// ── En ligne de commande ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [fichier, sigle] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const sortie = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
  const r = lire(fichier, sigle);
  console.log(`${sigle} : ${r.reconnues}/${r.unitesModele} paragraphes du modèle reconnus dans ${r.paragraphesDocument} ; ${r.propositions.length} valeurs proposées ; cadrage ${JSON.stringify(r.cadrage)} ; ${r.conflits.length} conflit(s)`);
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(r, null, 1), 'utf8');
}
