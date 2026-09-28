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
function paragraphes(fichier) {
  if (!fichier.toLowerCase().endsWith('.docx')) throw new Error('lot 0 : .docx seulement (le PDF viendra ensuite)');
  const lu = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // Une cellule de tableau compte comme un paragraphe (LireDocx sépare les cellules par une tabulation).
  return lu.replace(/\r\n?/g, '\n').split('\n').flatMap((l) => l.split('\t')).map(norm).filter(Boolean);
}

// ── Le modèle ─────────────────────────────────────────────────────────────────────────────────
/** Les paragraphes du modèle, chacun avec la pile des sections conditionnelles qui l'entourent. */
function unites(m) {
  const pile = [];
  const out = [];
  for (const b of m.blocs) {
    const si = /^\{\{SI:([A-Z0-9-]+)}}$/.exec(b.texte);
    const fin = /^\{\{FINSI:([A-Z0-9-]+)}}$/.exec(b.texte);
    if (si) { pile.push(si[1]); continue; }
    if (fin) { pile.pop(); continue; }
    if (['table', 'fin_table', 'vide'].includes(b.type)) continue;
    for (const t of b.type === 'ligne' ? b.texte.split('\u001F') : [b.texte]) if (t.trim()) out.push({ texte: t, sections: [...pile] });
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
  return { re: new RegExp(`^${re}$`, 'i'), jetons };
}

// ── Valeurs ───────────────────────────────────────────────────────────────────────────────────
/** Remet une valeur imprimée dans la forme de saisie du champ (le « normaliser » du serveur, côté lecture). */
function valeurSaisie(brut, type, suffixe) {
  const v = norm(brut);
  if (POINTILLES.test(v)) return null;   // un jeton vide s'imprime en pointillés (R2)
  const nombre = (s) => { const n = s.replace(/ariary|ar\.?|%|\s/gi, '').replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(n) ? n : null; };
  if (suffixe === 'chiffres' || ['NOMBRE', 'MONTANT', 'POURCENTAGE'].includes(type)) return nombre(v);
  if (type === 'DATE') { const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return d ? `${d[3]}-${d[2]}-${d[1]}` : null; }
  if (type === 'DATE_HEURE') { const d = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(v); return d ? `${d[3]}-${d[2]}-${d[1]}T${d[4]}:${d[5]}` : null; }
  return v;
}

/** Les réponses qu'implique une section retenue : chaque terme `cle = valeur` d'une conjonction (pas de `ou`, pas de `!=`). */
function implications(expression) {
  if (!expression || / ou /.test(expression)) return [];
  return expression.split(/\s+et\s+/).map((t) => /^([\w-]+)\s*=\s*(.+)$/.exec(t.trim())).filter(Boolean).map((x) => [x[1], x[2].trim()]);
}

// ── La lecture ────────────────────────────────────────────────────────────────────────────────
export function lire(fichier, sigle, champs = {}) {
  return lireParagraphes(Array.isArray(fichier) ? fichier : paragraphes(fichier), sigle, champs);
}

/** Les paragraphes du document, déjà extraits : un DAO en un seul fichier (avis, DPAC, AE à la suite) se lit modèle par modèle. */
export { paragraphes };

export function lireParagraphes(docLu, sigle, champs = {}) {
  const m = JSON.parse(fs.readFileSync(path.join(MODELES, `${sigle}.json`), 'utf8'));
  const us = unites(m);
  const doc = [...docLu];      // copie : un paragraphe fusionné par l'autorité y est redécoupé
  const trouves = new Map();   // indice de l'unité → indice du paragraphe du document
  const propositions = [];
  const sectionsVues = new Set();   // attestées par du TEXTE FIXE reconnu, jamais par un jeton seul
  const seulJeton = (u) => /^\{\{[^{}]+}}$/.test(u.texte.trim());

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
  us.forEach((u, k) => {
    if (seulJeton(u)) return;   // un jeton seul : borné par ses voisins, étape 2
    const { re, jetons } = motifParagraphe(u.texte);
    const finitParFixe = !/\}\}\s*$/.test(u.texte) && norm(u.texte.replace(JETON, '')).length > 0;
    const reTete = finitParFixe ? new RegExp(re.source.replace(/\$$/, ''), 'i') : null;
    // Tant que rien n'est reconnu, tout le document est cherché (le modèle peut commencer loin dans un DAO en un seul
    // fichier) ; ensuite, une fenêtre de 60 paragraphes après le dernier reconnu.
    const borne = trouves.size ? Math.min(doc.length, curseur + 60) : doc.length;
    for (let j = curseur; j < borne; j++) {
      let x = re.exec(doc[j]);
      let confiance = 'haute';
      // Un paragraphe qui finit par du texte fixe se reconnaît aussi EN TÊTE d'un paragraphe fusionné : le reste est relu.
      if (!x && reTete) {
        x = reTete.exec(doc[j]);
        if (x && doc[j].slice(x[0].length).trim()) { doc.splice(j + 1, 0, doc[j].slice(x[0].length).trim()); doc[j] = x[0]; confiance = 'moyenne'; }
      }
      if (!x) continue;
      trouves.set(k, j);
      curseur = j + 1;
      u.sections.forEach((s) => sectionsVues.add(s));
      jetons.forEach((jt, n) => {
        let brut = x[n + 1];
        let c = confiance;
        // Le dernier jeton d'un paragraphe qui finit par lui n'a pas de borne à droite : s'il contient le début d'un
        // paragraphe suivant du modèle, c'est une fusion — la valeur est coupée là, le reste relu, la confiance baisse.
        if (n === jetons.length - 1 && !finitParFixe) {
          const cp = couper(brut, k);
          if (cp) { brut = cp[0]; c = 'moyenne'; doc.splice(j + 1, 0, cp[1]); }
        }
        propositions.push({ jeton: jt, brut, confiance: c, source: 'paragraphe', paragraphe: j, finOuverte: n === jetons.length - 1 && !finitParFixe });
      });
      break;
    }
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
    const seul = /^\{\{([^{}]+)}}$/.exec(u.texte.trim());
    if (!seul) return;
    let a = k - 1; while (a >= 0 && !trouves.has(a)) a--;
    let b = k + 1; while (b < us.length && !trouves.has(b)) b++;
    if (a < 0 || b >= us.length) return;
    const cle = `${a}:${b}`;
    if (!intervalles.has(cle)) intervalles.set(cle, { a, b, jetons: [] });
    intervalles.get(cle).jetons.push({ jeton: seul[1], sections: u.sections, k });
  });
  const ressembleAuModele = (t) => debuts.some((d) => d && d.length >= 12 && norm(t).toLowerCase().startsWith(d));
  for (const { a, b, jetons } of intervalles.values()) {
    const entre = doc.slice(trouves.get(a) + 1, trouves.get(b));
    if (!entre.length || entre.length > 6) continue;
    if (jetons.length > 1) { ambigus.push({ candidats: jetons.map((j) => j.jeton), texte: entre.join('\n'), paragraphe: trouves.get(a) + 1 }); continue; }
    if (ressembleAuModele(entre[0])) continue;
    const j = jetons[0];
    const atteste = j.sections.every((s) => sectionsVues.has(s));
    let brut = entre.join('\n');
    const cp = couper(brut, j.k);
    if (cp) brut = cp[0];
    const confiance = atteste && entre.length === 1 && !cp ? 'moyenne' : 'basse';
    propositions.push({ jeton: j.jeton, brut, confiance, source: 'entre-voisins', paragraphe: trouves.get(a) + 1 });
  }

  // 3. Les réponses que disent les rédactions retenues.
  const cadrage = {};
  const conflits = [];
  for (const s of sectionsVues) {
    for (const [cle, valeur] of implications(m.conditions[s])) {
      if (cle in cadrage && cadrage[cle] !== valeur) conflits.push({ cle, valeurs: [cadrage[cle], valeur], section: s });
      else cadrage[cle] = valeur;
    }
  }

  // 4. Valeurs dans la forme de saisie ; un même champ lu deux fois différemment est un conflit, pas un choix.
  const parCode = new Map();
  for (const p of propositions) {
    const [code, suffixe] = p.jeton.split('.');
    if (!/^B\d\d-/.test(code) || suffixe === 'lettres') continue;   // LOT, DERIVE, montant en lettres : contrôles, pas des valeurs
    const valeur = valeurSaisie(p.brut, champs[code]?.type, suffixe);
    if (valeur == null) continue;
    // Ouverte à droite (rien du modèle ne la borne), une valeur de TEXTE peut avoir avalé un paragraphe ajouté : elle ne
    // reste haute que si son type la contraint (un nombre, un montant, une date collés à du texte ne se convertissent pas).
    const contrainte = suffixe === 'chiffres' || ['NOMBRE', 'MONTANT', 'POURCENTAGE', 'DATE', 'DATE_HEURE'].includes(champs[code]?.type);
    if (p.finOuverte && p.confiance === 'haute' && !contrainte) p.confiance = 'moyenne';
    // Un reflet du cadrage (`B08-AV-02` = `tauxAvance`) se propose comme RÉPONSE de cadrage, pas comme valeur de champ.
    if (champs[code]?.source === 'CADRAGE' && champs[code]?.cleCadrage) { cadrage[champs[code].cleCadrage] ??= valeur; continue; }
    const deja = parCode.get(code);
    if (deja && deja.valeur !== valeur) { conflits.push({ code, valeurs: [deja.valeur, valeur] }); deja.conflit = true; continue; }
    if (!deja || RANG[p.confiance] > RANG[deja.confiance]) parCode.set(code, { code, valeur, brut: norm(p.brut), confiance: p.confiance, source: p.source, paragraphe: p.paragraphe });
  }
  const final = [...parCode.values()].filter((p) => !p.conflit);
  const attendus = [...new Set(us.flatMap((u) => [...u.texte.matchAll(JETON)].map((x) => x[1].split('.')[0])).filter((c) => /^B\d\d-/.test(c)))];
  return { sigle, paragraphesDocument: doc.length, unitesModele: us.length, reconnues: trouves.size, propositions: final, cadrage, conflits, ambigus,
    nonTrouves: attendus.filter((c) => !parCode.has(c)) };
}

// ── En ligne de commande ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [fichier, sigle] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const sortie = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
  const r = lire(fichier, sigle);
  console.log(`${sigle} : ${r.reconnues}/${r.unitesModele} paragraphes du modèle reconnus dans ${r.paragraphesDocument} ; ${r.propositions.length} valeurs proposées ; cadrage ${JSON.stringify(r.cadrage)} ; ${r.conflits.length} conflit(s)`);
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(r, null, 1), 'utf8');
}
