// Cohérence du DAO « Fournitures et services » : le classeur officiel (source) contre le référentiel servi.
// Usage : node scripts/coherence-dao.mjs [QUANTITE_FIXE|A_COMMANDE|CONTRAT_CADRE] — backend démarré, compte PRMP001.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FORME = process.argv[2] || 'QUANTITE_FIXE';
const FEUILLE = { QUANTITE_FIXE: 'Quantité fixe', CONTRAT_CADRE: 'Contrat-cadre', A_COMMANDE: 'à Commande' }[FORME];
const ICI = fileURLToPath(new URL('.', import.meta.url));

const brut = execFileSync('node', [`${ICI}lire-xlsx.mjs`, ICI + '../NatureMarches/DAO_Fournitures et Services.xlsx', '--json'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const classeur = JSON.parse(brut.trim().split('\n').pop());
const table = classeur[FEUILLE];

// — Le classeur : une ligne d'information par élément, sa rubrique, et le document qui la porte —
const lignes = [];
let rubrique = '';
table.forEach((l, i) => {
  const n = i + 1;
  if (n <= 2) return;
  const [rub, el, ppm, d1, ae, ccap] = [0, 1, 2, 3, 4, 5].map((k) => (l[k] || '').trim());
  if (rub) rubrique = rub;
  const libelle = el || rub;
  if (!libelle) return;
  // Légende du classeur : « S » = vient du plan · « AS » = à saisir dans ce document · « x » = y figure déjà (repris).
  const nomD1 = FORME === 'CONTRAT_CADRE' ? 'DPAC' : 'DPAO';
  const nomC3 = FORME === 'CONTRAT_CADRE' ? 'AE' : 'CCAP';
  const docs = [], reprises = [];
  for (const [v, nom] of [[d1, nomD1], [ae, 'AE'], [ccap, nomC3]]) {
    const m = v.toUpperCase();
    if (m.includes('AS')) docs.push(nom);
    else if (m.includes('X')) reprises.push(nom);
  }
  lignes.push({ n, rubrique, libelle, ppm: ppm.toUpperCase() === 'S', docs, reprises, aSaisir: docs.length > 0 });
});
const aSaisir = lignes.filter((l) => l.aSaisir);
const duPlan = lignes.filter((l) => l.ppm);

// — Le référentiel servi —
const login = await fetch('http://localhost:8080/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'PRMP001', motDePasse: 'Test@1234' }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0]).join('; ');
const ref = await (await fetch(`http://localhost:8080/api/champs-fiche-marche?typeMarche=${FORME}&categorie=FOURNITURES_SERVICES`, { headers: { Cookie: cookie } })).json();
const servis = ref.champs.filter((c) => c.source !== 'PPM');

// — Rapprochement par les mots —
const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'a', 'au', 'aux', 'en', 'dans', 'par', 'pour', 'sur', 'd', 'l', 'the', 'ce', 'cet', 'cette', 'est', 'sont', 'son', 'sa', 'ses', 'que', 'qui', 'si', 'ne', 'pas', 'plus', 'y', 'the']);
const mots = (s) => (s || '')
  .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  .filter((m) => m.length > 2 && !VIDES.has(m));
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
};

const motsServis = servis.map((c) => ({ c, m: mots(c.libelle + ' ' + (c.aide || '')) }));
const motsLignes = aSaisir.map((l) => ({ l, m: mots(l.rubrique + ' ' + l.libelle) }));

const apparies = new Map();   // code servi -> meilleure ligne
const orphelines = [];        // lignes du classeur sans champ servi
for (const { l, m } of motsLignes) {
  let meilleur = null, score = 0;
  for (const { c, m: mc } of motsServis) {
    const s = jaccard(m, mc);
    if (s > score) { score = s; meilleur = c; }
  }
  if (score >= 0.5) {
    const d = apparies.get(meilleur.code) ?? { champ: meilleur, lignes: [], score: 0 };
    d.lignes.push(l); d.score = Math.max(d.score, score);
    apparies.set(meilleur.code, d);
  } else orphelines.push({ l, score, proche: meilleur });
}
const inedits = servis.filter((c) => !apparies.has(c.code));
// Un champ non apparié n'est pas forcément absent du classeur : sa ligne a pu être attribuée à un champ voisin.
// On cherche donc, pour chacun, sa MEILLEURE ligne, et on ne l'annonce absent que si rien ne s'en approche.
const couverture = inedits.map((c) => {
  const mc = mots(c.libelle + ' ' + (c.aide || ''));
  let meilleure = null, score = 0;
  for (const { l, m } of motsLignes) { const s = jaccard(mc, m); if (s > score) { score = s; meilleure = l; } }
  return { c, meilleure, score };
});
const absents = couverture.filter((x) => x.score < 0.3);
const couverts = couverture.filter((x) => x.score >= 0.3);

console.log(`\n${'='.repeat(90)}\nDAO Fournitures et services — ${FEUILLE} (${FORME})\n${'='.repeat(90)}`);
console.log(`classeur  : ${lignes.length} lignes d'information · ${duPlan.length} reprises du plan · ${aSaisir.length} à saisir`);
console.log(`servi     : ${ref.champs.length} champs (${ref.champs.length - servis.length} du plan · ${servis.filter((c) => c.source === 'SAISIE').length} à saisir · ${servis.filter((c) => c.source === 'CADRAGE').length} reflets du cadrage)`);
console.log(`rapproché : ${apparies.size} champs servis couvrent ${[...apparies.values()].reduce((n, d) => n + d.lignes.length, 0)} lignes du classeur`);

console.log(`\n— Lignes du classeur SANS champ servi (${orphelines.length}) —`);
for (const o of orphelines) {
  console.log(`  L${String(o.l.n).padStart(3)} [${o.l.docs.join('+') || '—'}] ${o.l.rubrique.slice(0, 32)} › ${o.l.libelle.slice(0, 72)}`);
  if (o.proche && o.score > 0.28) console.log(`         ~ le plus proche servi (${o.score.toFixed(2)}) : ${o.proche.code} ${o.proche.libelle.slice(0, 62)}`);
}

console.log(`\n— Champs servis dont la ligne a été absorbée par un voisin (${couverts.length}, informatif) —`);
for (const x of couverts) console.log(`  ${x.c.code} ~ L${x.meilleure.n} (${x.score.toFixed(2)}) ${x.c.libelle.slice(0, 42)} ≈ ${x.meilleure.libelle.slice(0, 42)}`);
console.log(`\n— Champs servis SANS rien d'approchant au classeur (${absents.length}) —`);
for (const x of absents) console.log(`  ${x.c.code} [${x.c.source}/${x.c.documentMaitre}] ${x.c.libelle.slice(0, 66)}${x.meilleure ? ` — le plus proche : L${x.meilleure.n} (${x.score.toFixed(2)}) ${x.meilleure.libelle.slice(0, 36)}` : ''}`);

// Le classeur marque une information dans un ou plusieurs documents ; le référentiel dit « maître » + « reprises ».
// On compare donc les ENSEMBLES : ce que le classeur annonce et que le référentiel ne porte pas, et l'inverse.
const manques = [], surplus = [];
// ⚠️ Seuls les champs appariés à UNE SEULE ligne sont comparables : un champ qui consolide plusieurs branches
// (« caution / garantie bancaire / chèque » en une liste) hérite des marques de toutes, la comparaison n'a plus de sens.
const consolides = [...apparies.values()].filter((d) => d.lignes.length > 1);
for (const d of [...apparies.values()].filter((x) => x.lignes.length === 1)) {
  const attendus = new Set(d.lignes.flatMap((l) => [...l.docs, ...l.reprises]));
  // ⚠️ Les champs partagés portent DPAO/CCAP pour maître, quelle que soit la forme ; en contrat-cadre l'écran applique
  // la répartition du classeur (DPAO → DPAC, CCAP → AE). On compare donc au document EFFECTIF, comme l'écran l'affiche.
  const effectif = (x) => (FORME !== 'CONTRAT_CADRE' ? x : x === 'DPAO' ? 'DPAC' : x === 'CCAP' ? 'AE' : x);
  const portes = new Set([d.champ.documentMaitre, ...(d.champ.reprises ?? [])].filter(Boolean).map(effectif));
  const absents = [...attendus].filter((x) => !portes.has(x));
  const enTrop = [...portes].filter((x) => !attendus.has(x));
  if (absents.length) manques.push({ d, absents, attendus, portes });
  if (enTrop.length) surplus.push({ d, enTrop, attendus, portes });
}
console.log(`\n— Lignes du classeur portant un point d'interrogation (source elle-même incertaine) —`);
for (const l of lignes.filter((x) => /\?\?|^\?|INONA/i.test(x.libelle + ' ' + x.rubrique))) console.log(`  L${String(l.n).padStart(3)} ${l.rubrique.slice(0, 34)} › ${l.libelle.slice(0, 56)}`);

console.log(`\n${consolides.length} champ(s) consolident plusieurs lignes (comparaison des documents non applicable).`);
console.log(`\n— Documents annoncés par le classeur que le référentiel ne porte PAS (${manques.length}) —`);
for (const m of manques) console.log(`  ${m.d.champ.code} porte « ${[...m.portes].join('+')} », classeur « ${[...m.attendus].join('+')} » → manque ${m.absents.join('+')} — ${m.d.champ.libelle.slice(0, 46)}`);
console.log(`\n— Documents portés par le référentiel que le classeur n'annonce pas (${surplus.length}) —`);
for (const s of surplus) console.log(`  ${s.d.champ.code} porte « ${[...s.portes].join('+')} », classeur « ${[...s.attendus].join('+')} » → en trop ${s.enTrop.join('+')} — ${s.d.champ.libelle.slice(0, 46)}`);
