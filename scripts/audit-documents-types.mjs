// Audit de cohérence : la fiche DAO d'une forme (défaut : fournitures « à commande ») CONTRE les documents types
// officiels (ARMP) du dossier « Documents Types/Fournitures et services » — IC, DPAO, formulaires de soumission, AE,
// CPS (CCAP + spécifications), CCAG.
//
// Pour chaque gabarit VARIABLE (DPAO, AE, CPS), le script découpe les clauses, relève leurs trous (`<indiquer …>`,
// pointillés), rattache à chaque clause les informations de la fiche dont le document maître est ce gabarit (rapprochement
// par les mots du libellé et de la rubrique — un premier tri, à relire), et sort les deux listes qui comptent :
// les TROUS SANS INFORMATION (le gabarit demande une donnée que la fiche ne porte pas) et les INFORMATIONS SANS TROU
// (la fiche porte une donnée que le gabarit ne demande pas). Les gabarits FIXES (IC, CCAG) ne sont comptés qu'en trous.
// Les formulaires A1-A4 et C1/C2 sont confrontés à nos modèles reconstitués du 2463 (part de lignes retrouvées).
//
// Les .doc (Word 97-2003) sont lus depuis des textes extraits : `--textes=<dossier>` contenant type-1.txt … type-6.txt
// (extraction : paquet npm `word-extractor`, hors projet — voir docs/audit-…md). Backend démarré, compte PRMP.
//
// Usage : node scripts/audit-documents-types.mjs --textes=<dossier> [--forme=A_COMMANDE] [--categorie=FOURNITURES_SERVICES] [--prmp=LERAVO]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || d;
const TEXTES = arg('textes', '');
const FORME = arg('forme', 'A_COMMANDE');
const CATEGORIE = arg('categorie', 'FOURNITURES_SERVICES');
const PRMP = arg('prmp', 'LERAVO');
const API = 'http://localhost:8080';
if (!TEXTES || !fs.existsSync(path.join(TEXTES, 'type-2.txt'))) { console.error('--textes=<dossier> avec type-1.txt … type-6.txt (textes extraits des .doc)'); process.exit(2); }
const lireType = (n) => fs.readFileSync(path.join(TEXTES, `type-${n}.txt`), 'utf8').replace(/\r\n?/g, '\n');

// ── Normalisation et mots-clés ───────────────────────────────────────────────────────────────
const sansAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => sansAccents(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const VIDES = new Set('de la le les des du et ou en au aux pour par sur dans avec sans une un d l a que qui est sont son sa ses leur leurs ce cette ces cas tout tous toute toutes autre autres non oui plus non applicable exige exigee exigees exiges'.split(' '));
const mots = (t) => [...new Set(norm(t).split(' ').filter((m) => m.length >= 4 && !VIDES.has(m)))];
const squeeze = (t) => sansAccents(t).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

// ── Découpage des gabarits en clauses ────────────────────────────────────────────────────────
const TROU = /<[^<>]{3,}>|…{2,}|\.{4,}|_{4,}/g;
const decouper = (texte, estTitre) => {
  const clauses = [];
  let courante = null;
  for (const brut of texte.split('\n')) {
    const l = brut.replace(/\t+/g, ' ').trim();
    if (!l) continue;
    if (estTitre(l)) { courante = { titre: l.slice(0, 120), lignes: [], trous: [] }; clauses.push(courante); continue; }
    if (!courante) continue;
    courante.lignes.push(l);
    for (const t of l.match(TROU) ?? []) courante.trous.push(t.slice(0, 110));
  }
  return clauses.filter((c) => c.lignes.length || c.trous.length);
};
// DPAO : « 6.5. Délai de validité … » ; on ignore la table des matières (lignes finissant par un numéro de page seul).
const titreDpao = (l) => /^\d{1,2}(\.\d{1,2}){0,2}\.?\s*[-–]?\s*[A-ZÉÈÀ«]/.test(l) && !/\s\d{1,2}$/.test(l);
// CPS / AE : « Article 12. - … » hors table des matières.
const titreArticle = (l) => /^ARTICLE\s+\d+|^Article\s+\d+/i.test(l) && !/\t?\s\d{1,2}$/.test(l) && !/\.{3,}/.test(l);
const GABARITS = {
  DPAO: { n: 2, nom: 'Données particulières (doc 2)', clauses: decouper(lireType(2), titreDpao) },
  AE: { n: 4, nom: "Cadre d'acte d'engagement (doc 4)", clauses: decouper(lireType(4), titreArticle) },
  CCAP: { n: 5, nom: 'CPS — CCAP et spécifications (doc 5)', clauses: decouper(lireType(5), titreArticle) },
};

// ── Le référentiel servi ─────────────────────────────────────────────────────────────────────
const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: PRMP, motDePasse: 'Test@1234' }) });
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
if (!login.ok) { console.error('connexion refusée : ' + login.status); process.exit(1); }
const ref = await (await fetch(`${API}/api/champs-fiche-marche?typeMarche=${FORME}&categorie=${CATEGORIE}`, { headers: { Cookie: cookie } })).json();
const rubriques = new Map();
for (const b of ref.blocs) for (const r of b.rubriques) rubriques.set(`${b.code}:${r.code.replace(b.code + '-', '')}`, r.libelle);
const champs = ref.champs.filter((c) => c.actif !== false && c.type !== 'PIECE' && c.typesMarche?.includes(FORME));

// ── Rapprochement information ↔ clause ───────────────────────────────────────────────────────
const scorer = (champ, clause) => {
  const cles = mots(champ.libelle);
  const titre = norm(clause.titre);
  const trous = norm(clause.trous.join(' '));
  const corps = norm(clause.lignes.join(' '));
  let s = 0;
  for (const m of cles) { if (titre.includes(m) || trous.includes(m)) s += 2; else if (corps.includes(m)) s += 1; }
  return s;
};
const rattachements = new Map(); // gabarit → Map(indexClause → champs[])
const sansTrou = { DPAO: [], AE: [], CCAP: [] };
for (const c of champs) {
  const cibles = [c.documentMaitre, ...(c.reprises ?? [])].map((d) => (d === 'DPAC' || d === 'DPIC' ? 'DPAO' : d)).filter((d) => GABARITS[d]);
  for (const g of [...new Set(cibles)]) {
    const clauses = GABARITS[g].clauses;
    let meilleur = -1, score = 0;
    clauses.forEach((cl, i) => { const s = scorer(c, cl); if (s > score) { score = s; meilleur = i; } });
    const seuil = mots(c.libelle).length >= 3 ? 3 : 2;
    if (meilleur >= 0 && score >= seuil) {
      if (!rattachements.has(g)) rattachements.set(g, new Map());
      const m = rattachements.get(g);
      m.set(meilleur, [...(m.get(meilleur) ?? []), { c, score, maitre: c.documentMaitre === g || (g === 'DPAO' && ['DPAC', 'DPIC'].includes(c.documentMaitre)) }]);
    } else if (c.documentMaitre === g || (g === 'DPAO' && ['DPAC', 'DPIC'].includes(c.documentMaitre))) sansTrou[g].push(c);
  }
}

// ── Les formulaires officiels contre nos modèles reconstitués ────────────────────────────────
const MODELES = path.join(ICI, 'modeles-candidat', 'modeles');
const doc3 = lireType(3);
const sectionsDoc3 = {};
{
  // Le document commence par un sommaire qui répète les titres : on borne chaque formulaire sur sa PREMIÈRE occurrence
  // dans le CORPS (« A 1. », « A1 - », « C 2. Modèle… »), c'est-à-dire après le sommaire (les 40 premières lignes).
  const apresSommaire = doc3.split('\n').slice(0, 40).join('\n').length;
  const premiers = new Map();
  for (const t of doc3.matchAll(/^(A|C)\s?([1-4])\s*[-.–]\s*\S/gm)) {
    const sigle = t[1] + t[2];
    if (!['A1', 'A2', 'A3', 'A4', 'C1', 'C2'].includes(sigle) || t.index < apresSommaire || premiers.has(sigle)) continue;
    premiers.set(sigle, t.index);
  }
  const bornes = [...premiers.entries()].sort((a, b) => a[1] - b[1]);
  bornes.forEach(([sigle, debut], i) => { sectionsDoc3[sigle] = doc3.slice(debut, bornes[i + 1]?.[1] ?? doc3.length); });
}
const fidelite = [];
for (const sigle of ['A1', 'A2', 'A3', 'A4', 'C1', 'C2']) {
  const f = path.join(MODELES, sigle + '.txt');
  if (!fs.existsSync(f) || !sectionsDoc3[sigle]) { fidelite.push({ sigle, total: 0, trouvees: 0 }); continue; }
  const officiel = squeeze(sectionsDoc3[sigle]);
  const lignes = fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.split('\t').pop()?.replace(/\{\{[^}]+\}\}/g, ' ').trim() ?? '').filter((t) => squeeze(t).length >= 12);
  const trouvees = lignes.filter((t) => officiel.includes(squeeze(t))).length;
  fidelite.push({ sigle, total: lignes.length, trouvees });
}
const trousFixes = { IC: (lireType(1).match(TROU) ?? []).length, CCAG: (lireType(6).match(TROU) ?? []).length };

// ── Le rapport ───────────────────────────────────────────────────────────────────────────────
const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const L = [];
const jour = new Date().toISOString().slice(0, 10);
L.push(`# Audit de cohérence — fiche DAO « ${FORME} / ${CATEGORIE} » contre les documents types officiels (${jour})`);
L.push('');
L.push('*Généré par `node scripts/audit-documents-types.mjs` — ne pas éditer à la main. Gabarits : `Documents Types/Fournitures et services` (ARMP, .doc), référentiel : l\'API.*');
L.push('*Le rattachement d\'une information à une clause se fait sur les mots de son libellé : c\'est un premier tri, à relire ; les deux listes « trous sans information » et « informations sans trou » sont ce que l\'audit met en évidence.*');
L.push('');
L.push('## Vue d\'ensemble');
L.push('');
L.push('| gabarit | clauses | trous à remplir | informations de la fiche rattachées | trous sans information | informations sans trou |');
L.push('|---|---|---|---|---|---|');
const resume = {};
for (const [g, gab] of Object.entries(GABARITS)) {
  const m = rattachements.get(g) ?? new Map();
  const rattaches = [...m.values()].reduce((n, l) => n + l.length, 0);
  const trousTotal = gab.clauses.reduce((n, c) => n + c.trous.length, 0);
  const clausesTrouSansInfo = gab.clauses.filter((c, i) => c.trous.length && !m.has(i));
  resume[g] = { clausesTrouSansInfo };
  L.push(`| ${gab.nom} | ${gab.clauses.length} | ${trousTotal} | ${rattaches} | ${clausesTrouSansInfo.length} clauses | ${sansTrou[g].length} |`);
}
L.push(`| Instructions aux candidats (doc 1) — texte fixe | — | ${trousFixes.IC} | — | — | — |`);
L.push(`| CCAG (doc 6) — texte fixe | — | ${trousFixes.CCAG} | — | — | — |`);
L.push('');
for (const [g, gab] of Object.entries(GABARITS)) {
  const m = rattachements.get(g) ?? new Map();
  L.push(`## ${gab.nom}`);
  L.push('');
  L.push('### Clause par clause');
  L.push('');
  L.push('| clause | trous du gabarit | informations de la fiche (maître en gras) |');
  L.push('|---|---|---|');
  gab.clauses.forEach((c, i) => {
    const infos = (m.get(i) ?? []).sort((a, b) => b.score - a.score).map((x) => (x.maitre ? `**\`${x.c.code}\`**` : `\`${x.c.code}\``) + ' ' + cell(x.c.libelle.slice(0, 60))).join(' · ');
    if (!c.trous.length && !infos) return;
    L.push(`| ${cell(c.titre)} | ${c.trous.length ? cell(c.trous.map((t) => t.slice(0, 70)).join(' ; ')) : '—'} | ${infos || '—'} |`);
  });
  L.push('');
  L.push('### Trous sans information de la fiche');
  L.push('');
  if (!resume[g].clausesTrouSansInfo.length) L.push('Aucun : chaque clause à trous a au moins une information rattachée.');
  else for (const c of resume[g].clausesTrouSansInfo) L.push(`- **${cell(c.titre)}** — ${cell(c.trous.map((t) => t.slice(0, 90)).join(' ; '))}`);
  L.push('');
  L.push('### Informations de la fiche sans clause rattachée dans ce gabarit');
  L.push('');
  if (!sansTrou[g].length) L.push('Aucune.');
  else for (const c of sansTrou[g]) L.push(`- \`${c.code}\` ${cell(c.libelle)} (${c.source}${c.parLot ? ', par lot' : ''}) — rubrique « ${cell(rubriques.get(`${c.bloc}:${c.rubrique.replace(c.bloc + '-', '')}`) ?? c.rubrique)} »`);
  L.push('');
}
L.push('## Formulaires de soumission (doc 3) contre nos modèles reconstitués du 2463');
L.push('');
L.push('| modèle | lignes du modèle | retrouvées dans le document type | part |');
L.push('|---|---|---|---|');
for (const f of fidelite) L.push(`| ${f.sigle} | ${f.total} | ${f.trouvees} | ${f.total ? Math.round((100 * f.trouvees) / f.total) + ' %' : '—'} |`);
L.push('');
L.push('*Une part inférieure à 100 % dit que le dossier 2463 s\'écarte du document type sur ces lignes (ou l\'inverse) : à relire ligne à ligne avant de choisir lequel des deux textes fait modèle.*');
L.push('');
L.push('## Lecture');
L.push('');
L.push('- Un **trou sans information** est un manque possible de la fiche — ou un trou que la fiche remplit par une information rattachée ailleurs (le rattachement est lexical) : à confirmer clause par clause.');
L.push('- Une **information sans trou** est soit une donnée que le gabarit ne demande pas (à garder si elle sert au contrôle, à retirer sinon), soit un libellé trop éloigné des mots du gabarit pour être rapproché automatiquement.');
L.push(`- Les textes fixes (IC : ${trousFixes.IC} trous, CCAG : ${trousFixes.CCAG}) sont les documents à reprendre tels quels pour le DAO complet (lot D) : leurs trous sont les seules mentions à servir.`);
const SORTIE = path.join(RACINE, 'docs', `audit-${jour}-coherence-fiche-${FORME.toLowerCase().replace('_', '-')}-vs-documents-types.md`);
fs.writeFileSync(SORTIE, L.join('\n') + '\n');
console.log('écrit ' + path.relative(RACINE, SORTIE));
for (const [g, gab] of Object.entries(GABARITS)) console.log(`${g} : ${gab.clauses.length} clauses, ${gab.clauses.reduce((n, c) => n + c.trous.length, 0)} trous, ${resume[g].clausesTrouSansInfo.length} clauses à trous sans information, ${sansTrou[g].length} informations sans trou`);
console.log('formulaires : ' + fidelite.map((f) => `${f.sigle} ${f.total ? Math.round((100 * f.trouvees) / f.total) : '—'}%`).join(' · ') + ` · trous IC ${trousFixes.IC}, CCAG ${trousFixes.CCAG}`);
