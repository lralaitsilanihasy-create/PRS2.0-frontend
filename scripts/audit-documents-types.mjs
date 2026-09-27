// Audit de cohérence : la fiche DAO d'une forme (défaut : fournitures « à commande ») CONTRE les documents types
// officiels (ARMP) du dossier « Documents Types/Fournitures et services » — IC, DPAO, formulaires de soumission, AE,
// CPS (CCAP + spécifications), CCAG.
//
// Pour chaque gabarit VARIABLE (DPAO, AE, CPS), le script découpe les clauses, relève leurs trous (`<indiquer …>`,
// pointillés), rattache à chaque clause les informations de la fiche dont le document maître est ce gabarit (rapprochement
// par les mots du libellé et de la rubrique — un premier tri, à relire), et sort les deux listes qui comptent :
// les TROUS SANS INFORMATION (le gabarit demande une donnée que la fiche ne porte pas) et les INFORMATIONS SANS TROU
// (la fiche porte une donnée que le gabarit ne demande pas). Les gabarits FIXES (IC, CCAG) ne sont comptés qu'en trous.
// Les formulaires A1-A4 et C1/C2 sont confrontés à nos modèles (décalques du 2463, puis modèles ARMP du 27/09 : part de
// lignes retrouvées dans le document type).
//
// Les .doc (Word 97-2003) sont lus depuis des textes extraits : `--textes=<dossier>` contenant type-1.txt … type-6.txt
// (extraction : paquet npm `word-extractor`, hors projet — voir docs/audit-…md). Backend démarré, compte PRMP.
// Sorties : le rapport `docs/audit-<jour>-….md` et la même chose en page `docs/audit-<jour>-….html` (artefact),
// `--html=<chemin>` pour l'écrire ailleurs.
//
// Usage : node scripts/audit-documents-types.mjs --textes=<dossier> [--forme=A_COMMANDE] [--categorie=FOURNITURES_SERVICES] [--prmp=LERAVO] [--html=<chemin>]
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

// ── Les formulaires officiels contre nos modèles ─────────────────────────────────────────────
// Deux jeux : les décalques du dossier 2463 (`modeles/`, 26/09) et les modèles décrits depuis le document type ARMP
// (`modeles-armp/`, 27/09, arbitrage « Ajuster par rapport aux officiels »). La mesure est la même pour les deux :
// la part des lignes du modèle (jetons retirés, labels de liste ajoutés retirés) retrouvées dans le texte du gabarit.
// La preuve fine (deux sens, cellule par cellule) est celle de `modeles-candidat/verifier-armp.mjs`, pas celle-ci.
const JEUX = { m2463: path.join(ICI, 'modeles-candidat', 'modeles'), armp: path.join(ICI, 'modeles-candidat', 'modeles-armp') };
const doc3 = lireType(3);
const sectionsDoc3 = {};
{
  // Le document commence par un sommaire qui répète les titres : on borne chaque formulaire sur sa PREMIÈRE occurrence
  // dans le CORPS (« A1 : IDENTIFICATION », « A1 - a) », « C 2 - Modèle… »), c'est-à-dire après le sommaire (les 40
  // premières lignes).
  const apresSommaire = doc3.split('\n').slice(0, 40).join('\n').length;
  const premiers = new Map();
  for (const t of doc3.matchAll(/^\s*(A|C)\s?([1-4])\s*[-.–:]\s*\S/gm)) {
    const sigle = t[1] + t[2];
    if (!['A1', 'A2', 'A3', 'A4', 'C1', 'C2'].includes(sigle) || t.index < apresSommaire || premiers.has(sigle)) continue;
    premiers.set(sigle, t.index);
  }
  const bornes = [...premiers.entries()].sort((a, b) => a[1] - b[1]);
  bornes.forEach(([sigle, debut], i) => { sectionsDoc3[sigle] = doc3.slice(debut, bornes[i + 1]?.[1] ?? doc3.length); });
}
const mesurer = (jeu, sigle) => {
  const f = path.join(JEUX[jeu], sigle + '.txt');
  if (!fs.existsSync(f) || !sectionsDoc3[sigle]) return { total: 0, trouvees: 0 };
  const officiel = squeeze(sectionsDoc3[sigle]);
  // une ligne de commande = type, tabulation, texte ; les cellules (US) et paragraphes (RS) d'une LIGNE se mesurent un à
  // un, et un jeton coupe le texte en fragments : de part et d'autre d'un jeton, le gabarit porte un crochet ou un blanc
  const fragments = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    .flatMap((l) => (l.split('\t').pop() ?? '').split(/[\u001F\u001E]/))
    .flatMap((t) => t.split(/\{\{[^}]+\}\}/))
    .map((t) => t.replace(/^\s*\(?[a-d]\)\s+/, '').replace(/\(\d\)/g, ' ').trim())
    .filter((t) => squeeze(t).length >= 12);
  const manques = fragments.filter((t) => !officiel.includes(squeeze(t)));
  return { total: fragments.length, trouvees: fragments.length - manques.length, manques };
};
const fidelite = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2'].map((sigle) => ({ sigle, m2463: mesurer('m2463', sigle), armp: mesurer('armp', sigle) }));
const part = (m) => (m.total ? Math.round((100 * m.trouvees) / m.total) + ' %' : '—');
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
L.push('## Formulaires de soumission (doc 3) contre nos modèles');
L.push('');
L.push('| modèle | décalque du 2463 (26/09) : lignes retrouvées | part | modèle ARMP (27/09) : lignes retrouvées | part |');
L.push('|---|---|---|---|---|');
for (const f of fidelite) L.push(`| ${f.sigle} | ${f.m2463.trouvees} / ${f.m2463.total} | ${part(f.m2463)} | ${f.armp.trouvees} / ${f.armp.total} | ${part(f.armp)} |`);
L.push('');
L.push('*Les décalques du 2463 s\'écartaient du document type ; depuis l\'arbitrage du 27/09 (« Ajuster par rapport aux officiels »), les six modèles servis sont décrits depuis le document type lui-même — la preuve fine, dans les deux sens, est `scripts/modeles-candidat/verifier-armp.mjs`. La mesure ci-dessus est grossière (un fragment de texte entre deux jetons, retrouvé ou non dans le texte extrait du .doc) ; ses fragments non retrouvés pour le jeu ARMP :*');
L.push('');
for (const f of fidelite) for (const m of f.armp.manques) L.push(`- ${f.sigle} — « ${cell(m.slice(0, 100))} »`);
if (!fidelite.some((f) => f.armp.manques.length)) L.push('- aucun');
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
console.log('formulaires (2463 → ARMP) : ' + fidelite.map((f) => `${f.sigle} ${part(f.m2463)} → ${part(f.armp)}`).join(' · ') + ` · trous IC ${trousFixes.IC}, CCAG ${trousFixes.CCAG}`);

// ── La page (artefact) — même contenu que le rapport, mis en page ────────────────────────────
const h = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nomRubrique = (c) => rubriques.get(`${c.bloc}:${c.rubrique.replace(c.bloc + '-', '')}`) ?? c.rubrique;
const infosHtml = (liste) => liste.sort((a, b) => b.score - a.score)
  .map((x) => `<span class="info${x.maitre ? ' info--maitre' : ''}" title="${h(x.c.libelle)}"><code>${h(x.c.code)}</code> ${h(x.c.libelle.length > 58 ? x.c.libelle.slice(0, 57) + '…' : x.c.libelle)}</span>`).join('');
const H = [];
H.push('<title>Fiche à commande vs ARMP</title>');
H.push('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">');
H.push(`<style>
:root{--papier:#fbfaf6;--encre:#1f2733;--sourd:#5f6b78;--regle:#e4dfd3;--panneau:#f3f0e8;--accent:#0f6e63;--accent-doux:#dcece8;--alerte:#a8681a;--alerte-doux:#f7ebd6;--ok:#2f7a3d;--code:#eae6dc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--papier:#14181d;--encre:#e7e2d8;--sourd:#a3aab4;--regle:#2c343d;--panneau:#1c2229;--accent:#5fc7b6;--accent-doux:#173b37;--alerte:#e2a94c;--alerte-doux:#3a2c15;--ok:#7bc98a;--code:#262d36}}
:root[data-theme="dark"]{--papier:#14181d;--encre:#e7e2d8;--sourd:#a3aab4;--regle:#2c343d;--panneau:#1c2229;--accent:#5fc7b6;--accent-doux:#173b37;--alerte:#e2a94c;--alerte-doux:#3a2c15;--ok:#7bc98a;--code:#262d36}
body{background:var(--papier);color:var(--encre);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:15px;line-height:1.5;padding-inline:16px;padding-block:0 64px}
.page{max-width:1080px;margin-inline:auto}
h1,h2,h3{font-family:"Source Serif 4",Georgia,serif;font-weight:600;text-wrap:balance;line-height:1.15}
h1{font-size:clamp(1.6rem,3.5vw,2.3rem);margin:8px 0 12px}
h2{font-size:1.45rem;margin:48px 0 6px;padding-top:24px;border-top:1px solid var(--regle)}
h3{font-size:1.1rem;margin:28px 0 10px;color:var(--accent)}
.sur{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sourd);margin:32px 0 0}
.chapeau{max-width:68ch;color:var(--sourd);margin:0 0 20px}
.chapeau strong{color:var(--encre)}
nav{position:sticky;top:env(safe-area-inset-top,0px);background:var(--papier);border-block:1px solid var(--regle);display:flex;flex-wrap:wrap;gap:4px 18px;padding:10px 0;font-size:.9rem;z-index:2}
nav a{color:var(--accent);text-decoration:none;font-weight:500}
nav a:hover,nav a:focus-visible{text-decoration:underline;outline:none}
.defilant{overflow-x:auto;border:1px solid var(--regle);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{padding:8px 10px;vertical-align:top;text-align:left;border-bottom:1px solid var(--regle)}
th{background:var(--panneau);font-weight:600;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--sourd);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.sans-info td:first-child{box-shadow:inset 4px 0 0 var(--alerte)}
tr.sans-info td{background:var(--alerte-doux)}
code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.82em;background:var(--code);padding:1px 5px;border-radius:4px}
.info{display:inline-block;margin:2px 6px 2px 0;padding:2px 6px 2px 2px;border-radius:4px;background:var(--panneau);color:var(--sourd);font-size:.84rem}
.info--maitre{background:var(--accent-doux);color:var(--encre)}
.info--maitre code{background:transparent;font-weight:500;color:var(--accent)}
.trous{color:var(--sourd);font-size:.86rem}
ul{padding-left:20px}li{margin:4px 0}
.vide{color:var(--ok);font-style:italic}
.barre{display:inline-block;height:8px;border-radius:4px;background:var(--regle);width:120px;vertical-align:middle;overflow:hidden;margin-right:8px}
.barre i{display:block;height:100%;background:var(--accent)}
.barre--avant i{background:var(--alerte)}
.pied{margin-top:56px;padding-top:16px;border-top:1px solid var(--regle);color:var(--sourd);font-size:.85rem}
@media (max-width:640px){h2{margin-top:36px}.barre{width:72px}}
</style>`);
H.push('<div class="page">');
H.push(`<p class="sur">Audit de cohérence · ${h(jour)} · généré par <code>scripts/audit-documents-types.mjs</code></p>`);
H.push(`<h1>La fiche DAO « ${h(FORME)} / ${h(CATEGORIE)} » contre les documents types officiels</h1>`);
H.push(`<p class="chapeau">Gabarits : <strong>Documents Types / Fournitures et services</strong> (ARMP, six fichiers Word). Référentiel : celui que sert l'API ce jour, <strong>${champs.length} informations</strong> saisies ou de cadrage. Le rattachement d'une information à une clause se fait sur les mots de son libellé : c'est un premier tri, à relire. Ce que l'audit met en évidence, ce sont les <strong>trous sans information</strong> (le gabarit demande une donnée que la fiche ne porte pas) et les <strong>informations sans trou</strong> (la fiche porte une donnée que le gabarit ne demande pas).</p>`);
H.push('<nav aria-label="Sections"><a href="#vue">Vue d’ensemble</a>' + Object.entries(GABARITS).map(([g, gab]) => `<a href="#${g}">${h(gab.nom)}</a>`).join('') + '<a href="#formulaires">Formulaires (doc 3)</a><a href="#lecture">Lecture</a></nav>');
H.push('<h2 id="vue">Vue d’ensemble</h2><div class="defilant"><table><thead><tr><th>Gabarit</th><th>Clauses</th><th>Trous à remplir</th><th>Informations rattachées</th><th>Trous sans information</th><th>Informations sans trou</th></tr></thead><tbody>');
for (const [g, gab] of Object.entries(GABARITS)) {
  const m = rattachements.get(g) ?? new Map();
  const rattaches = [...m.values()].reduce((n, l) => n + l.length, 0);
  const trousTotal = gab.clauses.reduce((n, c) => n + c.trous.length, 0);
  H.push(`<tr><td><a href="#${g}">${h(gab.nom)}</a></td><td class="n">${gab.clauses.length}</td><td class="n">${trousTotal}</td><td class="n">${rattaches}</td><td class="n">${resume[g].clausesTrouSansInfo.length} clause(s)</td><td class="n">${sansTrou[g].length}</td></tr>`);
}
H.push(`<tr><td>Instructions aux candidats (doc 1) — texte fixe</td><td class="n">—</td><td class="n">${trousFixes.IC}</td><td class="n">—</td><td class="n">—</td><td class="n">—</td></tr>`);
H.push(`<tr><td>CCAG (doc 6) — texte fixe</td><td class="n">—</td><td class="n">${trousFixes.CCAG}</td><td class="n">—</td><td class="n">—</td><td class="n">—</td></tr>`);
H.push('</tbody></table></div>');
for (const [g, gab] of Object.entries(GABARITS)) {
  const m = rattachements.get(g) ?? new Map();
  H.push(`<h2 id="${g}">${h(gab.nom)}</h2>`);
  H.push('<h3>Clause par clause</h3><div class="defilant"><table><thead><tr><th>Clause</th><th>Trous du gabarit</th><th>Informations de la fiche (document maître en couleur)</th></tr></thead><tbody>');
  gab.clauses.forEach((c, i) => {
    const infos = m.get(i) ?? [];
    if (!c.trous.length && !infos.length) return;
    const sansInfo = c.trous.length && !infos.length;
    // un blanc du gabarit (« ________ ») se montre court : sa longueur ne dit rien
    const trou = (t) => h(t.replace(/_{6,}/g, '______').slice(0, 70));
    H.push(`<tr${sansInfo ? ' class="sans-info"' : ''}><td>${h(c.titre)}</td><td class="trous">${c.trous.length ? c.trous.map(trou).join(' ; ') : '—'}</td><td>${infos.length ? infosHtml([...infos]) : '—'}</td></tr>`);
  });
  H.push('</tbody></table></div>');
  H.push('<h3>Trous sans information de la fiche</h3>');
  H.push(resume[g].clausesTrouSansInfo.length
    ? '<ul>' + resume[g].clausesTrouSansInfo.map((c) => `<li><strong>${h(c.titre)}</strong> — <span class="trous">${h(c.trous.map((t) => t.slice(0, 90)).join(' ; '))}</span></li>`).join('') + '</ul>'
    : '<p class="vide">Aucun : chaque clause à trous a au moins une information rattachée.</p>');
  H.push('<h3>Informations de la fiche sans clause rattachée dans ce gabarit</h3>');
  H.push(sansTrou[g].length
    ? '<ul>' + sansTrou[g].map((c) => `<li><code>${h(c.code)}</code> ${h(c.libelle)} <span class="trous">(${h(c.source)}${c.parLot ? ', par lot' : ''}) — rubrique « ${h(nomRubrique(c))} »</span></li>`).join('') + '</ul>'
    : '<p class="vide">Aucune.</p>');
}
H.push('<h2 id="formulaires">Formulaires de soumission (doc 3) contre nos modèles</h2>');
H.push('<p class="chapeau">Part des lignes de chaque modèle retrouvées dans le texte du document type : les décalques du dossier 2463 (26/09) puis les modèles décrits depuis le document type ARMP (27/09, arbitrage « Ajuster par rapport aux officiels »). La preuve fine, dans les deux sens, est <code>scripts/modeles-candidat/verifier-armp.mjs</code>.</p>');
H.push('<div class="defilant"><table><thead><tr><th>Modèle</th><th>Décalque du 2463</th><th>Part</th><th>Modèle ARMP</th><th>Part</th></tr></thead><tbody>');
const barre = (m, avant) => `<span class="barre${avant ? ' barre--avant' : ''}" aria-hidden="true"><i style="width:${m.total ? Math.round((100 * m.trouvees) / m.total) : 0}%"></i></span>${h(part(m))}`;
for (const f of fidelite) H.push(`<tr><td><strong>${h(f.sigle)}</strong></td><td class="n">${f.m2463.trouvees} / ${f.m2463.total}</td><td>${barre(f.m2463, true)}</td><td class="n">${f.armp.trouvees} / ${f.armp.total}</td><td>${barre(f.armp, false)}</td></tr>`);
H.push('</tbody></table></div>');
H.push('<h3>Fragments du jeu ARMP non retrouvés par cette mesure</h3>');
H.push('<p class="chapeau">La mesure est grossière : un fragment de texte entre deux jetons, retrouvé ou non dans le texte extrait du <code>.doc</code>. Ce qui reste ici s’explique par l’extraction (une note de bas de page absente du texte extrait) ou par un ajout voulu autour d’un jeton (l’unité après le montant) — le comparateur fin les juge conformes.</p>');
H.push(fidelite.some((f) => f.armp.manques.length)
  ? '<ul>' + fidelite.flatMap((f) => f.armp.manques.map((m) => `<li><strong>${h(f.sigle)}</strong> — <span class="trous">« ${h(m.slice(0, 100))} »</span></li>`)).join('') + '</ul>'
  : '<p class="vide">Aucun.</p>');
H.push('<h2 id="lecture">Lecture</h2><ul>');
H.push('<li>Un <strong>trou sans information</strong> est un manque possible de la fiche — ou un trou que la fiche remplit par une information rattachée ailleurs (le rattachement est lexical) : à confirmer clause par clause.</li>');
H.push('<li>Une <strong>information sans trou</strong> est soit une donnée que le gabarit ne demande pas (à garder si elle sert au contrôle, à retirer sinon), soit un libellé trop éloigné des mots du gabarit pour être rapproché automatiquement.</li>');
H.push(`<li>Les textes fixes (Instructions aux candidats : ${trousFixes.IC} trou(s), CCAG : ${trousFixes.CCAG}) sont les documents à reprendre tels quels pour le DAO complet (lot D) : leurs trous sont les seules mentions à servir.</li>`);
H.push('</ul>');
H.push(`<p class="pied">Même contenu que <code>${h(path.relative(RACINE, SORTIE).split(path.sep).join('/'))}</code>, régénéré à chaque exécution — rien n'est édité à la main.</p>`);
H.push('</div>');
const SORTIE_HTML = arg('html', SORTIE.replace(/\.md$/, '.html'));
fs.writeFileSync(SORTIE_HTML, H.join('\n') + '\n');
console.log('écrit ' + path.relative(RACINE, SORTIE_HTML));
