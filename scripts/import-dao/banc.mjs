// Banc de non-régression de la lecture (29/09) — les fiches de recette 27 et 16, qui servaient à mesurer.mjs, ont
// disparu avec le vidage de DBPRS20. Pour CHAQUE modèle décrit : une fiche fictive (valeurs générées selon le type du
// champ servi par le référentiel, deux cadrages opposés « tout oui » / « tout non »), rendue comme le moteur du serveur
// (sections retenues, jetons imprimés), puis relue par lire.mjs. Critère Q10 : aucune fausse valeur en confiance haute.
//   node banc.mjs                    # rendu propre
//   node banc.mjs --bruit=<graine>   # le bruit de mesurer.mjs (fusions, paragraphes ajoutés, typographie)
//   node banc.mjs --lire=<module>    # une autre version de la lecture (comparaison)
//   node banc.mjs --manques=CCAP-T   # le détail des champs non relus d'un modèle
// Prérequis : le serveur de recette (le référentiel des champs est lu par l'API, sous PRMP001).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const lirePath = process.argv.find((a) => a.startsWith('--lire='))?.slice(7) ?? './lire.mjs';
const { lireParagraphes, norm } = await import(lirePath);
const MOD = fileURLToPath(new URL('../modeles-dao/modeles', import.meta.url));
const bruit = process.argv.some((a) => a.startsWith('--bruit'));
const manques = process.argv.find((a) => a.startsWith('--manques='))?.slice(10);   // les champs non relus d'un modèle
const API = 'http://localhost:8080';

let refs = null;
const FORMES = { 'DPAC-CC': ['CONTRAT_CADRE', 'FOURNITURES_SERVICES'], 'AE-CC': ['CONTRAT_CADRE', 'FOURNITURES_SERVICES'], 'DPAO-F': ['A_COMMANDE', 'FOURNITURES_SERVICES'],
  'AE-F': ['A_COMMANDE', 'FOURNITURES_SERVICES'], 'CCAP-F': ['A_COMMANDE', 'FOURNITURES_SERVICES'], 'DPIC-PI': ['QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES'],
  'AE-PI': ['QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES'], 'CPS-PI': ['QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES'],
  'DPAO-T': ['QUANTITE_FIXE', 'TRAVAUX'], 'AE-T': ['QUANTITE_FIXE', 'TRAVAUX'], 'CCAP-T': ['QUANTITE_FIXE', 'TRAVAUX'] };
if (!refs) {
  const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'PRMP001', motDePasse: 'Test@1234' }) });
  const jar = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  refs = {};
  for (const [t, c] of new Set(Object.values(FORMES).map((x) => x.join('|'))).values().map((s) => s.split('|'))) {
    const ref = await (await fetch(`${API}/api/champs-fiche-marche?typeMarche=${t}&categorie=${c}`, { headers: { Cookie: jar } })).json();
    refs[`${t}|${c}`] = Object.fromEntries(ref.champs.map((x) => [x.code, { type: x.type, source: x.source, cleCadrage: x.cleCadrage, options: x.options }]));
  }
}
const NOUVEAUX = { 'B04-EP-04': 'NOMBRE', 'B05-PF-13': 'MONTANT', 'B06-TP-07': 'NOMBRE', 'B06-CS-02': 'NOMBRE', 'B06-CS-03': 'NOMBRE', 'B02-OP-04': 'TEXTE', 'B08-AI-03': 'POURCENTAGE', 'B09-OP-02': 'NOMBRE',
  // Lot D4 (travaux) : champs demandés en T-1.
  'B02-MW-04': 'TEXTE_LONG', 'B02-LT-06': 'TEXTE', 'B02-LT-07': 'TEXTE', 'B04-VL-02': 'OUI_NON', 'B05-GE-05': 'POURCENTAGE', 'B09-BT-01': 'OUI_NON',
  // 01/10 (correspondance DAO du MEN) : période de référence des marchés similaires.
  'B03-QT-12': 'NOMBRE', 'B03-QT-13': 'TEXTE_LONG', 'B03-QT-14': 'MONTANT' };

const n = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function vraie(expr, vaut) {
  return expr.split(/\s+ou\s+/).some((c) => c.split(/\s+et\s+/).every((t) => {
    let x; t = t.trim();
    if ((x = /^([\w-]+)\s+renseigne$/.exec(t))) return n(vaut(x[1])) !== '';
    if ((x = /^([\w-]+)\s+vide$/.exec(t))) return n(vaut(x[1])) === '';
    if ((x = /^([\w-]+)\s+contient\s+(.+)$/.exec(t))) { const v = n(vaut(x[1])); return v !== '' && v.includes(n(x[2])); }
    if ((x = /^([\w-]+)\s*!=\s*(.+)$/.exec(t))) { const v = n(vaut(x[1])); return !(v !== '' && v === n(x[2])); }
    if ((x = /^([\w-]+)\s*=\s*(.+)$/.exec(t))) { const v = n(vaut(x[1])); return v !== '' && v === n(x[2]); }
    throw new Error(`terme illisible : ${t}`);
  }));
}
const milliers = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const MOTS = ['alpha', 'bravo', 'charlie', 'delta', 'écho', 'foxtrot', 'golf', 'hôtel', 'india', 'juliette'];
function valeurPour(code, type, i, options) {
  if (options?.length) return options[i % options.length];
  switch (type) {
    case 'NOMBRE': return 11 + i;
    case 'MONTANT': return (i + 1) * 1250000;
    case 'POURCENTAGE': return 3 + (i % 9);
    case 'DATE': return `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(10 + (i % 18)).padStart(2, '0')}`;
    case 'DATE_HEURE': return `2026-11-${String(10 + (i % 18)).padStart(2, '0')}T09:30`;
    case 'OUI_NON': return i % 2 ? 'OUI' : 'NON';
    case 'URL': return `https://essai-${i}.gov.mg`;
    default: return `Texte ${MOTS[i % MOTS.length]} ${MOTS[(i * 3) % MOTS.length]} pour ${code}`;
  }
}
function imprime(type, suffixe, v) {
  if (v == null || v === '') return '……';
  if (suffixe === 'chiffres') return String(v).replace('.', ',');
  if (suffixe === 'lettres') return `${MOTS[String(v).length % MOTS.length]} millions en lettres`;   // 01/10 — sans parenthèse ni chiffre, comme un vrai montant en lettres
  if (type === 'DATE') { const [a, m, j] = String(v).split('-'); return `${j}/${m}/${a}`; }
  if (type === 'DATE_HEURE') { const [d, h] = String(v).split('T'); const [a, m, j] = d.split('-'); return `${j}/${m}/${a} ${h}`; }
  if (type === 'MONTANT') return `${milliers(v)} Ariary`;
  if (type === 'POURCENTAGE') return `${String(v).replace('.', ',')} %`;
  if (type === 'OUI_NON') return v === 'OUI' ? 'Oui' : 'Non';
  return String(v);
}
const CADRAGES = {
  oui: { alloti: 'NON', variantes: 'OUI', groupement: 'OUI', formeGroupement: 'CONJOINT_OU_SOLIDAIRE', typePrix: 'UNITAIRES', prixRevisable: 'OUI', garantieSoumission: 'OUI', modeRemise: 'PAPIER', avance: 'OUI', tauxAvance: '15', penalites: 'CCAG', provenance: 'NATIONAL', attributaires: 'MULTI' },
  non: { alloti: 'NON', variantes: 'NON', groupement: 'NON', typePrix: 'FORFAITAIRE', prixRevisable: 'NON', garantieSoumission: 'NON', modeRemise: 'PAPIER', avance: 'NON', penalites: 'NON', provenance: 'IMPORTEES', attributaires: 'MONO' },
};
function rendre(sigle, cadrage, champs) {
  const m = JSON.parse(fs.readFileSync(`${MOD}/${sigle}.json`, 'utf8'));
  const [typeMarche, categorie] = FORMES[sigle];
  const codes = [...new Set(m.blocs.flatMap((b) => [...b.texte.matchAll(/\{\{(B\d\d-[A-Z]{2}-\d\d)(?:\.\w+)?}}/g)].map((x) => x[1])))];
  const valeurs = Object.fromEntries(codes.map((c, i) => [c, valeurPour(c, champs[c]?.type, i + (cadrage === CADRAGES.non ? 1 : 0), champs[c]?.options)]));
  const vaut = (k) => (k in cadrage ? cadrage[k] : k === 'typeMarche' ? typeMarche : k === 'categorie' ? categorie : valeurs[k]);
  const pile = []; const actif = () => pile.every(Boolean);
  const imprimes = new Set(); const sortie = [];
  const remplir = (t) => t.replace(/\{\{([^{}.]+)(?:\.(\w+))?}}/g, (_, code, suf) => {
    if (code === 'LOT') return '1';
    if (code.startsWith('DERIVE')) return '31/12/2026';
    if (valeurs[code] != null && valeurs[code] !== '' && suf !== 'lettres') imprimes.add(code);
    return imprime(champs[code]?.type, suf, valeurs[code]);
  });
  const texte = (t) => {
    const si = /^\{\{SI:([^}]+)}}$/.exec(t), fin = /^\{\{FINSI:([^}]+)}}$/.exec(t);
    if (si) { pile.push(vraie(m.conditions[si[1]], vaut)); return; }
    if (fin) { pile.pop(); return; }
    if (actif() && t.trim()) sortie.push(remplir(t));
  };
  for (const b of m.blocs) {
    if (['table', 'fin_table', 'vide'].includes(b.type)) continue;
    if (b.type !== 'ligne') { texte(b.texte); continue; }
    const cellules = b.texte.split('\u001F');
    if (/^\{\{(SI|FINSI):[^}]+}}$/.test(cellules[0]) && cellules.slice(1).every((c) => !c)) { texte(cellules[0]); continue; }
    for (const c of cellules) for (const p of c.split('\u001E')) texte(p);
  }
  return { paragraphes: sortie.map(norm), imprimes, valeurs };
}
// Le bruit de mesurer.mjs, à l'identique (appliqué APRÈS la normalisation, comme lui) : typographie, un paragraphe sur
// dix fusionné avec le suivant, un sur vingt suivi d'un paragraphe ajouté par l'autorité.
const graine = Number(process.argv.find((a) => a.startsWith('--bruit='))?.slice(8)) || 1;
function bruiter(ps) {
  let x = graine;
  const hasard = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    let p = ps[i].replace(/’/g, "'").replace(/ ([:;?!])/g, ' $1').replace(/, /g, hasard() < 0.3 ? ',  ' : ', ');
    if (hasard() < 0.1 && i + 1 < ps.length) { p = `${p} ${ps[++i]}`; }
    out.push(p);
    if (hasard() < 0.05) out.push('Le présent article est complété par les dispositions de la note de service jointe.');
  }
  return out;
}
const egal = (type, lu, attendu) => (['NOMBRE', 'MONTANT', 'POURCENTAGE'].includes(type)
  ? Number(String(lu).replace(',', '.')) === Number(String(attendu).replace(',', '.'))
  : type === 'DATE_HEURE' ? String(lu).slice(0, 16) === String(attendu).slice(0, 16) : norm(String(lu)).toLowerCase() === norm(String(attendu)).toLowerCase());

let totalFH = 0; const lignes = [];
for (const sigle of Object.keys(FORMES)) {
  const champs = { ...refs[FORMES[sigle].join('|')] };
  for (const [c, t] of Object.entries(NOUVEAUX)) champs[c] ??= { type: t };
  for (const [nomCad, cad] of Object.entries(CADRAGES)) {
    const r0 = rendre(sigle, cad, champs);
    const r = lireParagraphes(bruit ? bruiter(r0.paragraphes) : r0.paragraphes, sigle, champs);
    const attendus = [...r0.imprimes].filter((c) => champs[c]?.source !== 'CADRAGE');
    const props = r.propositions.filter((p) => !p.code.includes('#'));
    const justes = props.filter((p) => egal(champs[p.code]?.type, p.valeur, r0.valeurs[p.code]));
    const fausses = props.filter((p) => !justes.includes(p));
    const fh = fausses.filter((p) => p.confiance === 'haute');
    totalFH += fh.length;
    const ret = attendus.filter((c) => justes.some((p) => p.code === c)).length;
    if (manques === sigle) {
      for (const a of r.ambigus) lignes.push(`   ${nomCad} ambigu ${a.candidats.join(', ')} : ${a.texte.split('\n').length} paragraphe(s)`);
      for (const c of attendus.filter((c) => !justes.some((p) => p.code === c))) {
        const lu = props.find((p) => p.code === c);
        lignes.push(`   ${nomCad} manque ${c} (${champs[c]?.type}) attendu « ${String(r0.valeurs[c]).slice(0, 30)} »${lu ? ` lu « ${String(lu.valeur).slice(0, 30)} »` : ''}`);
      }
    }
    lignes.push(`${sigle.padEnd(8)} ${nomCad.padEnd(4)} rappel ${String(ret).padStart(3)}/${String(attendus.length).padEnd(3)} (${String(Math.round(100 * ret / Math.max(1, attendus.length))).padStart(3)} %)  fausses ${fausses.length} dont haute ${fh.length}${fh.length ? '  ← ' + fh.map((p) => `${p.code} « ${String(p.valeur).slice(0, 30)} »`).join(' ; ') : ''}`);
  }
}
console.log(lignes.join('\n'));
console.log(`\n${bruit ? '[bruité] ' : ''}critère Q10 (0 fausse valeur en confiance haute) : ${totalFH ? `✗ ${totalFH}` : '✓ tenu'}`);
