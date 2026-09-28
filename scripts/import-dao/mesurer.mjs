// Import du DAO — lot 0 : MESURE de la lecture (`lire.mjs`) sur les documents qu'une fiche validée a produits,
// confrontés aux valeurs de cette même fiche (l'aller-retour). Critère du plan (Q10) : zéro fausse valeur proposée
// en confiance haute ; le taux de valeurs retrouvées est dit, pas imposé.
//
//   node mesurer.mjs --dmc=27 --login=PRMP001 --dpac=<DPAC.docx> --ae=<AE.docx>
//
// ⚠️ L'aller-retour prouve la LOGIQUE (le modèle inversé retrouve ce qu'il a imprimé) ; il ne prouve pas la tenue sur
// un DAO écrit par une autre autorité, avec son traitement de texte et ses retouches du modèle. Aucun autre DAO réel
// n'est disponible au 28/09 (pilote) : c'est la limite de cette mesure, à dire avec son résultat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RANG, lire, norm, paragraphes } from './lire.mjs';

const API = 'http://localhost:8080';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ID = arg('dmc') ?? '27', LOGIN = arg('login') ?? 'PRMP001';

const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: LOGIN, motDePasse: 'Test@1234' }) });
const jar = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const get = async (u) => (await fetch(API + u, { headers: { Cookie: jar } })).json();
const fiche = await get(`/api/fiches-marche/${ID}`);
const ref = await get(`/api/champs-fiche-marche?typeMarche=${fiche.typeMarche}&categorie=${fiche.categorie}`);
const champs = Object.fromEntries(ref.champs.map((c) => [c.code, { type: c.type, source: c.source, cleCadrage: c.cleCadrage }]));

// Ce que la fiche vaut : ses valeurs, les reprises du plan, et le cadrage avec ses défauts (modeRemise absent = PAPIER).
const cadrageFiche = { modeRemise: 'PAPIER', ...(fiche.cadrage ?? {}) };
const valeursFiche = { ...(fiche.valeursPpm ?? {}), ...(fiche.valeurs ?? {}) };
const vautFiche = (cle) => (cle in cadrageFiche ? cadrageFiche[cle] : valeursFiche[cle]);

// Le moteur de conditions du lot D, côté mesure (même grammaire : =, !=, contient, renseigne, vide ; et avant ou).
const cmp = (s) => norm(String(s ?? '')).toLowerCase();
const terme = (t) => {
  let x;
  if ((x = /^([\w-]+)\s+renseigne$/.exec(t))) return cmp(vautFiche(x[1])) !== '';
  if ((x = /^([\w-]+)\s+vide$/.exec(t))) return cmp(vautFiche(x[1])) === '';
  if ((x = /^([\w-]+)\s+contient\s+(.+)$/.exec(t))) return cmp(vautFiche(x[1])).includes(cmp(x[2]));
  if ((x = /^([\w-]+)\s*!=\s*(.+)$/.exec(t))) return cmp(vautFiche(x[1])) !== cmp(x[2]);
  if ((x = /^([\w-]+)\s*=\s*(.+)$/.exec(t))) return cmp(vautFiche(x[1])) === cmp(x[2]);
  throw new Error(`terme illisible : ${t}`);
};
const vraie = (e) => e.split(/\s+ou\s+/).some((c) => c.split(/\s+et\s+/).every((t) => terme(t.trim())));

/** Les codes qu'un modèle IMPRIME pour cette fiche : jetons hors sections fausses. */
function imprimes(sigle) {
  const m = JSON.parse(fs.readFileSync(path.resolve(ICI, '../modeles-dao/modeles', `${sigle}.json`), 'utf8'));
  const pile = [];
  const out = new Set();
  for (const b of m.blocs) {
    const si = /^\{\{SI:([A-Z0-9-]+)}}$/.exec(b.texte);
    if (si) { pile.push(vraie(m.conditions[si[1]])); continue; }
    if (/^\{\{FINSI:/.test(b.texte)) { pile.pop(); continue; }
    if (pile.every(Boolean)) for (const j of b.texte.matchAll(/\{\{([^{}]+)}}/g)) { const [code, suf] = j[1].split('.'); if (/^B\d\d-/.test(code) && suf !== 'lettres') out.add(code); }
  }
  return out;
}

const docs = [['DPAC-CC', arg('dpac')], ['AE-CC', arg('ae')]].filter(([, f]) => f);
// --un-fichier : le DAO arrive en un seul document (DPAC puis AE à la suite, comme le document type) ; chaque modèle y
// cherche sa partie.
const unFichier = process.argv.includes('--un-fichier');
// --bruit=<graine> : ce qu'un DAO écrit ailleurs fait subir au texte, de façon reproductible — typographie (apostrophes
// droites, espaces insécables avant la ponctuation, espaces doublées), un paragraphe sur dix FUSIONNÉ avec le suivant,
// un sur vingt suivi d'un paragraphe AJOUTÉ par l'autorité. La lecture peut y perdre du rappel ; elle ne doit JAMAIS y
// gagner une fausse valeur en confiance haute.
const graine = arg('bruit');
function bruiter(ps) {
  let x = Number(graine) || 1;
  const hasard = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    let p = ps[i].replace(/’/g, "'").replace(/ ([:;?!])/g, ' $1').replace(/, /g, hasard() < 0.3 ? ',  ' : ', ');
    if (hasard() < 0.1 && i + 1 < ps.length) { p = `${p} ${ps[++i]}`; }
    out.push(p);
    if (hasard() < 0.05) out.push('Le présent article est complété par les dispositions de la note de service jointe.');
  }
  return out;
}
const lu = (f) => (graine ? bruiter(paragraphes(f)) : paragraphes(f));
const tout = unFichier ? docs.flatMap(([, f]) => lu(f)) : null;
const lectures = docs.map(([s, f]) => lire(unFichier ? tout : graine ? lu(f) : f, s, champs));
if (graine) console.log(`document bruité (graine ${graine})`);
if (unFichier) console.log(`un seul fichier de ${tout.length} paragraphes`);

// Fusion des deux documents : un champ imprimé dans les deux doit y dire la même chose.
const propositions = new Map();
const conflits = lectures.flatMap((l) => l.conflits.map((c) => ({ ...c, document: l.sigle })));
for (const l of lectures) for (const p of l.propositions) {
  const deja = propositions.get(p.code);
  if (deja && deja.valeur !== p.valeur) { conflits.push({ code: p.code, valeurs: [deja.valeur, p.valeur], document: 'DPAC ≠ AE' }); deja.conflit = true; }
  else if (!deja || RANG[p.confiance] > RANG[deja.confiance]) propositions.set(p.code, { ...p, document: l.sigle });
}
const cadrage = Object.assign({}, ...lectures.map((l) => l.cadrage));
const ambigus = lectures.flatMap((l) => l.ambigus.map((a) => ({ ...a, document: l.sigle })));

const egal = (a, b) => {
  if (a == null || b == null) return false;
  const x = norm(String(a)), y = norm(String(b));
  return x.toLowerCase() === y.toLowerCase() || (x !== '' && !Number.isNaN(Number(x)) && Number(x) === Number(y));
};
const lignes = [];
let justes = 0, fausses = 0, faussesHautes = 0;
const parConfiance = { haute: [0, 0], moyenne: [0, 0], basse: [0, 0] };
for (const p of [...propositions.values()].filter((p) => !p.conflit)) {
  const bon = egal(p.valeur, valeursFiche[p.code]);
  parConfiance[p.confiance][bon ? 0 : 1]++;
  if (bon) { justes++; continue; }
  fausses++; if (p.confiance === 'haute') faussesHautes++;
  lignes.push(`   ✗ ${p.code} [${p.confiance}, ${p.document}] lu « ${String(p.valeur).slice(0, 60)} » — fiche « ${String(valeursFiche[p.code] ?? '∅').slice(0, 60)} »`);
}
let cadJustes = 0, cadFaux = 0;
for (const [cle, v] of Object.entries(cadrage)) {
  if (egal(v, vautFiche(cle))) cadJustes++; else { cadFaux++; lignes.push(`   ✗ réponse ${cle} lue « ${v} » — fiche « ${vautFiche(cle) ?? '∅'} »`); }
}
// Le rappel : les valeurs (non vides) que les documents IMPRIMENT pour cette fiche, hors reflets du cadrage.
const aRetrouver = [...new Set(docs.flatMap(([s]) => [...imprimes(s)]))]
  .filter((c) => champs[c]?.source !== 'CADRAGE' && valeursFiche[c] != null && valeursFiche[c] !== '');
const retrouves = aRetrouver.filter((c) => propositions.has(c) && !propositions.get(c).conflit && egal(propositions.get(c).valeur, valeursFiche[c]));
const manques = aRetrouver.filter((c) => !retrouves.includes(c));

for (const l of lectures) console.log(`${l.sigle} : ${l.reconnues}/${l.unitesModele} paragraphes du modèle reconnus (${l.paragraphesDocument} dans le document), ${l.propositions.length} valeurs, ${l.ambigus.length} ambigu(s), ${l.conflits.length} conflit(s)`);
console.log(`\nvaleurs proposées : ${justes + fausses} — ${justes} justes, ${fausses} fausses dont ${faussesHautes} en confiance HAUTE`);
console.log(`par confiance (justes/fausses) : haute ${parConfiance.haute.join('/')}, moyenne ${parConfiance.moyenne.join('/')}, basse ${parConfiance.basse.join('/')}`);
console.log(`réponses de cadrage ou de liste déduites : ${cadJustes + cadFaux} — ${cadJustes} justes, ${cadFaux} fausses`);
console.log(`rappel : ${retrouves.length}/${aRetrouver.length} valeurs imprimées retrouvées (${Math.round((100 * retrouves.length) / Math.max(1, aRetrouver.length))} %)`);
console.log(`conflits : ${conflits.length}${conflits.length ? ' — ' + conflits.map((c) => c.code ?? c.cle).join(', ') : ''}`);
for (const a of ambigus) console.log(`ambigu (${a.document}) : ${a.candidats.join(' ou ')} ← « ${a.texte.slice(0, 70)} »`);
lignes.forEach((l) => console.log(l));
if (manques.length) console.log(`non retrouvées : ${manques.join(', ')}`);
console.log(`\ncritère Q10 (0 fausse valeur en confiance haute) : ${faussesHautes === 0 ? '✓ tenu' : '✗ NON tenu'}`);
process.exit(faussesHautes === 0 ? 0 : 1);
