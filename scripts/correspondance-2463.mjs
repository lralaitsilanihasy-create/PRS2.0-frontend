// Correspondance « fiche DAO ↔ dossier réel 2463 », GÉNÉRÉE — ne pas éditer le .md à la main.
//
// Trois sources, aucune valeur retapée :
//   · scripts/demo-dao-valeurs.mjs — les valeurs du jeu (VALEURS_2463, VALEURS_2463_PAR_LOT, CADRAGE_2463) et, dans
//     leurs commentaires, la NATURE de chaque information ([R] repris tel quel, [D] déduit, [H] hypothèse) et sa
//     SOURCE (page, clause) — celles de docs/jeu-donnees-2463-faits.md ;
//   · le référentiel servi par le backend (libellés, types, document maître) ;
//   · les documents produits par la validation de la fiche (PDF) : chaque texte [R] d'au moins 25 caractères est
//     recherché tel quel dans le PDF de son document maître (DPAO, CCAP, AE du lot 1) — « imprimé » oui/non.
//
// Usage : node scripts/correspondance-2463.mjs [--documents=<dossier des PDF>] [--fiche=<idDmc>] [--prmp=LERAVO]
//   backend démarré ; pdftotext (xpdf) dans le PATH. Écrit docs/correspondance-2026-09-27-fiche-dao-vs-dossier-2463.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || d;
const DOCS = arg('documents', 'C:/Users/LANTO/eclipse-workspace/PRS20/docs/export/2463/documents');
const ID_DMC = Number(arg('fiche', '0')) || null;
const PRMP = arg('prmp', 'LERAVO');
const API = 'http://localhost:8080';
const SORTIE = path.join(RACINE, 'docs', 'correspondance-2026-09-27-fiche-dao-vs-dossier-2463.md');

const { VALEURS_2463, VALEURS_2463_PAR_LOT, CADRAGE_2463 } = await import('./demo-dao-valeurs.mjs');

// ── 1. Nature et source de chaque code, lues dans les commentaires du jeu ────────────────────
const source = fs.readFileSync(path.join(ICI, 'demo-dao-valeurs.mjs'), 'utf8').replace(/\r\n/g, '\n');
const bloc = (debut) => {
  const i = source.indexOf(debut);
  if (i < 0) return '';
  const fin = source.indexOf('\n};', i);
  return source.slice(i, fin);
};
const NATURES = new Map(); // code → { nature, source }
const lireNatures = (texte) => {
  const lignes = texte.split('\n');
  let enAttente = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i].trim();
    const entree = l.match(/^'([A-Z0-9-]+)'\s*:/);
    if (l.startsWith('//')) { enAttente.push(l.slice(2).trim()); continue; }
    if (entree) {
      const code = entree[1];
      // Le commentaire de fin peut être sur la dernière ligne d'une valeur écrite sur plusieurs lignes (`+ '…', // [R] …`).
      const apres = [(l.match(/\/\/\s*(.*)$/) ?? [])[1] ?? ''];
      // Une continuation commence par `+`, `'` ou `"` — mais jamais par une NOUVELLE entrée `'CODE':`.
      for (let j = i + 1; j < lignes.length && /^\s*(\+ |'|")/.test(lignes[j]) && !/^\s*'[A-Z0-9-]+'\s*:/.test(lignes[j]); j++) apres.push((lignes[j].match(/\/\/\s*(.*)$/) ?? [])[1] ?? '');
      const tout = [...enAttente, ...apres].join(' ');
      const m = tout.match(/\[(R|D|H)\]\s*([^;—]*)/);
      if (m) NATURES.set(code, { nature: m[1], source: m[2].replace(/\s+\+?\s*constat.*$/, '').trim() });
      else if (!NATURES.has(code)) NATURES.set(code, { nature: '?', source: '' });
      enAttente = [];
    } else if (!l.startsWith("'") && !l.startsWith('+') && l !== '') enAttente = [];
  }
};
lireNatures(bloc('export const VALEURS_2463 = {'));
lireNatures(bloc('export const VALEURS_2463_PAR_LOT = {'));
// Le cadrage : natures de la fiche des faits (§2, §6, §7).
// Les informations héritées du jeu « à commande » sans étiquette propre : la fiche des faits (§10) les nomme.
const HERITEES = {
  'B06-AN-02': ['H', 'paraphrase des IC — §10'], 'B06-EO-06': ['H', 'paraphrase des IC — §10'], 'B06-EO-08': ['H', 'paraphrase des IC — §10'],
  'B08-AV-04': ['H', '§7 : garantie de restitution bancaire'], 'B08-AV-05': ['H', '§7 / §10 : remboursement par précompte'], 'B08-AV-06': ['H', '§10 : précompte 20 %'],
  'B08-PA-08': ['H', '§10 : délai de paiement 30 jours'], 'B04-LA-01': ['D', '§10 : aucune langue en plus du français'],
  'B09-CR-01': ['R', 'CCAP art. 19 p.52'], 'B09-MC-01': ['R', 'CCAP art. 13 p.51'], 'B09-DX-01': ['R', 'CCAP 10.a p.50'], 'B09-DX-02': ['R', 'CCAP 10.a p.50'],
  'B09-OM-03': ['R', 'CCAP art. 6 et 10.b p.50'], 'B10-IR-01': ['R', 'CCAP art. 23 p.52'], 'B02-AU-04': ['R', 'DPAO 1.2 p.17, CCAP 10.b p.50'],
};
const CADRAGE_SOURCES = {
  alloti: ['R', 'DPAO 1.1 p.17'], nbLots: ['R', 'p.1, DPAO 1.1 p.17'], variantes: ['R', 'DPAO 1.1 p.17'],
  groupement: ['R', 'DPAO 2 p.17, CCAP art. 4 p.49'], provenance: ['R', 'DPAO 6.5.1 p.18'], typePrix: ['D', 'bordereaux des prix p.40-44'],
  prixRevisable: ['R', 'DPAO 6.5.2 p.18, CCAP 8.2 p.50'], garantieSoumission: ['R', 'DPAO 6.6 p.18'],
  avance: ['H', 'CCAP 9.1.a p.50 en blanc — §7'], tauxAvance: ['H', 'plafond CCAG art. 9.1 p.74 — §7'], penalites: ['R', 'CCAP art. 11 p.50-51'],
};

// ── 2. Le référentiel servi ──────────────────────────────────────────────────────────────────
const session = async (login) => {
  const s = { cookie: '' };
  const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, motDePasse: 'Test@1234' }) });
  s.cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!r.ok) throw new Error('connexion ' + login + ' : ' + r.status);
  return s;
};
const s = await session(PRMP);
const lire = async (u) => (await fetch(API + u, { headers: { Cookie: s.cookie } })).json();
const ref = await lire('/api/champs-fiche-marche?typeMarche=A_COMMANDE&categorie=FOURNITURES_SERVICES');
const champs = new Map(ref.champs.filter((c) => c.actif !== false).map((c) => [c.code, c]));
const blocs = [...ref.blocs].sort((a, b) => a.rang - b.rang);
let fiche = null;
if (ID_DMC) fiche = await lire('/api/fiches-marche/' + ID_DMC).catch(() => null);

// ── 3. Les documents produits, en texte ──────────────────────────────────────────────────────
// Comparaison \u00ab au caract\u00e8re pr\u00e8s \u00bb sur les lettres et chiffres seuls : la mise en page du PDF (retours \u00e0 la ligne,
// c\u00e9sures, guillemets, espaces ins\u00e9cables) ne compte pas, le texte, oui.
// NFKC : les ligatures des polices (« ﬁ », « ﬂ ») redeviennent « fi », « fl » — sinon « fixé » du PDF ne vaut pas « fixé » du jeu.
const norm = (t) => t.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const texteDoc = new Map();
const chercherPdf = (prefixe, lot) => {
  if (!fs.existsSync(DOCS)) return null;
  const f = fs.readdirSync(DOCS).find((n) => n.startsWith(prefixe + '_') && n.endsWith('.pdf') && (lot ? n.includes(`_lot${lot}_`) : !n.includes('_lot')));
  return f ? path.join(DOCS, f) : null;
};
for (const doc of ['DPAO', 'CCAP', 'AE']) {
  const pdf = chercherPdf(doc, doc === 'AE' ? 1 : null);
  if (!pdf) continue;
  try {
    const brut = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    // Les en-têtes et pieds de page courants (référence du plan, numéro de ligne, folio) s'intercalent au milieu d'un
    // paragraphe coupé par un saut de page : on les retire avant de comparer.
    const sansCartouche = brut.split('\n').filter((l) => !/\d{5}\/PPM-AGPM\/CNM\/\d{4}|ligne\s+\d{6}|^\s*(page\s+)?\d{1,3}(\s*\/\s*\d{1,3})?\s*$|^\f?\s*$/i.test(l)).join('\n');
    texteDoc.set(doc, norm(sansCartouche));
  } catch { /* pdftotext absent : colonne « imprimé » vide */ }
};
const imprime = (c, valeur) => {
  const doc = c.documentMaitre === 'DPAC' ? 'DPAO' : c.documentMaitre;
  const t = texteDoc.get(doc);
  if (!t) return '';
  const v = String(valeur ?? '');
  if (v.length < 25 || !['TEXTE', 'TEXTE_LONG'].includes(c.type)) return '·';
  return t.includes(norm(v)) ? 'oui' : 'non';
};

// ── 4. Le document ───────────────────────────────────────────────────────────────────────────
const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const court = (t, n = 110) => (String(t ?? '').length > n ? String(t).slice(0, n - 1) + '…' : String(t ?? ''));
const L = [];
const aujourdhui = new Date().toISOString().slice(0, 10);
L.push(`# Fiche DAO ↔ dossier réel 2463 — correspondance (générée le ${aujourdhui})`);
L.push('');
L.push(`*Généré par \`node scripts/correspondance-2463.mjs\` — ne pas éditer à la main. Source des faits : \`docs/jeu-donnees-2463-faits.md\` ;*`);
L.push(`*valeurs et natures : \`scripts/demo-dao-valeurs.mjs\` (section E) ; référentiel et fiche : l'API ; documents produits : \`${DOCS}\`.*`);
if (fiche) L.push(`*Fiche ${fiche.idDmc} (ligne ${fiche.idDetail}, ${fiche.refeDossier ?? ''}), version ${fiche.version} ${fiche.statut === 'VALIDEE' ? 'validée' : 'brouillon'}.*`);
L.push('');
L.push('| nature | sens |');
L.push('|---|---|');
L.push('| **[R]** | repris tel quel du dossier `DAO_2463_MAT_INFO_VERSION_FINAL_1.pdf`, page et clause citées |');
L.push('| **[D]** | déduit d\'une valeur du dossier, calcul écrit dans la fiche des faits |');
L.push('| **[H]** | hypothèse : le dossier est muet ou en blanc ; jamais présentée comme venant du dossier (§10 de la fiche des faits) |');
L.push('| imprimé | le texte [R] se retrouve **tel quel** dans le PDF produit de son document maître (oui / non ; « · » = valeur courte ou non textuelle, non vérifiée) |');
L.push('');
const stats = { R: 0, D: 0, H: 0, '?': 0, imprimeOui: 0, imprimeNon: 0 };
const ligneTable = (c, valeur, lot) => {
  const lue = NATURES.get(c.code);
  const n = lue && lue.nature !== '?' ? lue : HERITEES[c.code] ? { nature: HERITEES[c.code][0], source: HERITEES[c.code][1] } : { nature: '?', source: '' };
  stats[n.nature] = (stats[n.nature] ?? 0) + 1;
  const imp = imprime(c, valeur);
  if (imp === 'oui') stats.imprimeOui++; else if (imp === 'non') stats.imprimeNon++;
  return `| \`${c.code}${lot ? '#' + lot : ''}\` | ${cell(c.libelle)}${lot ? ` — lot ${lot}` : ''} | ${cell(court(valeur))} | **[${n.nature}]** | ${cell(n.source)} | ${imp} |`;
};
L.push('## Le cadrage');
L.push('');
L.push('| question | réponse | nature | source |');
L.push('|---|---|---|---|');
for (const [cle, v] of Object.entries(CADRAGE_2463)) {
  const [nat, src] = CADRAGE_SOURCES[cle] ?? ['?', ''];
  stats[nat] = (stats[nat] ?? 0) + 1;
  L.push(`| ${cle} | ${cell(v)} | **[${nat}]** | ${cell(src)} |`);
}
L.push('');
for (const b of blocs) {
  const codes = [...champs.values()].filter((c) => c.bloc === b.code && c.source === 'SAISIE' && c.type !== 'PIECE').sort((x, y) => x.code.localeCompare(y.code));
  const lignes = [];
  for (const c of codes) {
    if (c.parLot && VALEURS_2463_PAR_LOT[c.code]) for (const [lot, v] of Object.entries(VALEURS_2463_PAR_LOT[c.code])) lignes.push(ligneTable(c, v, lot));
    else if (VALEURS_2463[c.code] !== undefined) lignes.push(ligneTable(c, VALEURS_2463[c.code], null));
  }
  if (!lignes.length) continue;
  L.push(`## ${b.code} — ${b.libelle}`);
  L.push('');
  L.push('| code | information | valeur | nature | source (page, clause) | imprimé |');
  L.push('|---|---|---|---|---|---|');
  L.push(...lignes);
  L.push('');
}
L.push('## Bilan');
L.push('');
L.push(`- Informations saisies : **${stats.R + stats.D + stats.H + (stats['?'] ?? 0)}** — [R] ${stats.R}, [D] ${stats.D}, [H] ${stats.H}${stats['?'] ? `, sans étiquette ${stats['?']} (à étiqueter dans le jeu)` : ''}.`);
L.push(`- Textes [R] vérifiés dans les PDF produits : **${stats.imprimeOui} imprimés tels quels**, ${stats.imprimeNon} non retrouvés${stats.imprimeNon ? ' (voir la colonne « imprimé »)' : ''}.`);
L.push('- Les anomalies du dossier réel sont **conservées** (fiche des faits §9) : mention « AOO N° 2461/MT » sur les plis (`B04-RO-02`), « matériels et mobiliers de logements » (`B02-OB-02`), article 24 du CCAP sans le plafond de 10 %, une destination au DPAO 6.5.1 contre cinq au CCAP.');
L.push('- Ce que la fiche ne porte pas, et pourquoi : fiche des faits §10 (valeurs exigées par le modèle, absentes du dossier) et §11 (hypothèses du circuit : compte PRMP, sigle, référence).');
L.push('');
L.push(`*Remplace \`correspondance-2026-09-25-fiche-dao-vs-dossier-2463.md\` (fiche 13, avant la fiche des faits et les modèles officiels).*`);
fs.writeFileSync(SORTIE, L.join('\n') + '\n');

// ── 5. Le même document en HTML (autonome, imprimable) ───────────────────────────────────────
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) => esc(t).replace(/\\\|/g, '|').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const classeCellule = (t) => (/^\*\*\[R\]\*\*$/.test(t) ? ' class="n n-r"' : /^\*\*\[D\]\*\*$/.test(t) ? ' class="n n-d"' : /^\*\*\[H\]\*\*$/.test(t) ? ' class="n n-h"' : /^\*\*\[\?\]\*\*$/.test(t) ? ' class="n n-q"' : t === 'oui' ? ' class="imp-oui"' : t === 'non' ? ' class="imp-non"' : '');
const cellules = (ligne) => ligne.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
const H = [];
for (let i = 0; i < L.length; i++) {
  const l = L[i];
  if (l.startsWith('# ')) H.push(`<h1>${inline(l.slice(2))}</h1>`);
  else if (l.startsWith('## ')) H.push(`<h2>${inline(l.slice(3))}</h2>`);
  else if (l.startsWith('|')) {
    const tete = cellules(l);
    const lignes = [];
    i += 2; // la ligne de séparation
    while (i < L.length && L[i].startsWith('|')) lignes.push(cellules(L[i++]));
    i--;
    H.push('<table><thead><tr>' + tete.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + lignes.map((r) => '<tr>' + r.map((c) => `<td${classeCellule(c)}>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
  } else if (l.startsWith('- ')) {
    const items = [];
    while (i < L.length && L[i].startsWith('- ')) items.push(L[i++].slice(2));
    i--;
    H.push('<ul>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>');
  } else if (l.startsWith('*') && l.endsWith('*')) H.push(`<p class="note">${inline(l.slice(1, -1))}</p>`);
  else if (l.trim()) H.push(`<p>${inline(l)}</p>`);
}
const HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Fiche DAO ↔ dossier 2463 — correspondance</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --enc: #152033; --gris: #5b6784; --bord: #d5dbe5; --r: #15803d; --d: #1d4ed8; --h: #b45309; --q: #b91c1c; }
  body { margin: 0; padding: 24px 16px 48px; font: 14px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--enc); background: #fff; max-width: 1400px; margin-inline: auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; } h2 { font-size: 1.1rem; margin: 1.8rem 0 .5rem; border-bottom: 2px solid var(--bord); padding-bottom: .25rem; }
  p.note { color: var(--gris); font-style: italic; margin: .15rem 0; font-size: .9rem; }
  table { border-collapse: collapse; width: 100%; margin: .4rem 0 1rem; font-size: .85rem; }
  th, td { border: 1px solid var(--bord); padding: .3rem .5rem; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
  th { background: #f1f5f9; font-weight: 700; white-space: nowrap; }
  td:first-child code { white-space: nowrap; }
  td.n { white-space: nowrap; font-weight: 700; } td.n-r { color: var(--r); } td.n-d { color: var(--d); } td.n-h { color: var(--h); } td.n-q { color: var(--q); }
  td.imp-oui { color: var(--r); font-weight: 700; } td.imp-non { color: var(--q); font-weight: 700; }
  code { font-family: Consolas, "Courier New", monospace; font-size: .85em; background: #f8fafc; padding: 0 .2em; border-radius: 3px; }
  ul { padding-left: 1.2rem; }
  @media print { body { padding: 0; font-size: 11px; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head><body>
${H.join('\n')}
</body></html>
`;
const SORTIE_HTML = SORTIE.replace(/\.md$/, '.html');
fs.writeFileSync(SORTIE_HTML, HTML);
console.log('écrit ' + path.relative(RACINE, SORTIE_HTML));
console.log('écrit ' + path.relative(RACINE, SORTIE) + ' — [R] ' + stats.R + ' · [D] ' + stats.D + ' · [H] ' + stats.H + (stats['?'] ? ' · ? ' + stats['?'] : '') + ' · imprimés ' + stats.imprimeOui + '/' + (stats.imprimeOui + stats.imprimeNon) + ' · documents lus : ' + [...texteDoc.keys()].join(', '));
