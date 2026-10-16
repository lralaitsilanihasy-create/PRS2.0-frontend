// Prototype (16/10) — lire les SPÉCIFICATIONS TECHNIQUES d'un DAO PDF par ses TABLEAUX quadrillés : mots positionnés et filets
// (PdfGrille.java) → cellules → tableaux reconnus par leur en-tête → articles par lot (désignation, unité, quantités, exigences).
//   node lire-specs.mjs grille.tsv [--json=sortie.json]
import fs from 'node:fs';

const [fichier] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const sortie = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
// Deux désignations divergent si leurs nombres diffèrent (500ml / 100ml, B2 / B1) ou si plus de la moitié des mots
// significatifs de la première manquent à la seconde (les abréviations du DQE ne doivent pas déclencher d'alerte).
const nombresDe = (x) => (norm(x).match(/\d+(?:[,.]\d+)?/g) ?? []).join('|');
const motsDe = (x) => norm(x).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter((w) => w.length > 2 && !/^(DES|LES|POUR|AVEC|PAR|SUR|UNE)$/.test(w)).map((w) => w.replace(/S$/, ''));
const manque = (p, q) => { const mq = new Set(motsDe(q)), mp = motsDe(p); return mp.length && mp.filter((w) => !mq.has(w)).length / mp.length > 0.5; };
const ecart = (a, b) => nombresDe(a) !== nombresDe(b) || (manque(a, b) && manque(b, a));
// Désignation de bordereau sans son suffixe de prix : « , l'unité à… », « Le forfait à… », « (insérer le prix…) ».
const nettoie = (x) => x.replace(/\s*\(?\s*ins[ée]rer le prix.*$/i, '').replace(/\s*,?\s*(?:l['’]\s*|le\s+|la\s+)\p{L}+\s+à(?!\p{L}).*$/iu, '').trim();

// ── Lecture du TSV ──
const pages = new Map();
const page = (n) => { if (!pages.has(n)) pages.set(n, { mots: [], h: [], v: [] }); return pages.get(n); };
for (const l of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
  const c = l.split('\t');
  if (c[0] === 'M') page(+c[1]).mots.push({ x0: +c[2], y: +c[3], x1: +c[4], t: c.slice(5).join('\t') });
  else if (c[0] === 'H') page(+c[1]).h.push({ y: +c[2], x0: +c[3], x1: +c[4] });
  else if (c[0] === 'V') page(+c[1]).v.push({ x: +c[2], y0: +c[3], y1: +c[4] });
}

/** Valeurs proches regroupées (tolérance). */
function grappes(vals, tol = 2) {
  const s = [...vals].sort((a, b) => a - b), out = [];
  for (const v of s) { if (out.length && v - out.at(-1).max <= tol) { out.at(-1).max = v; out.at(-1).n++; } else out.push({ min: v, max: v, n: 1 }); }
  return out.map((g) => (g.min + g.max) / 2);
}

/**
 * Les tableaux d'une page : un tableau est un bloc de filets horizontaux et verticaux qui se touchent. On découpe par
 * « bande » verticale (des filets verticaux qui couvrent la même hauteur), puis on forme la grille lignes × colonnes. Les
 * cellules fusionnées sont gérées en ne coupant une ligne que là où un filet vertical la traverse réellement.
 */
function tableaux(p) {
  if (p.v.length < 3 || p.h.length < 2) return [];
  // Blocs : filets verticaux qui se recouvrent en hauteur.
  // Word trace souvent les filets verticaux cellule par cellule : les segments alignés et contigus sont recollés.
  const vs = [];
  for (const v of [...p.v].sort((a, b) => a.x - b.x || a.y0 - b.y0)) {
    const d = vs.at(-1);
    if (d && Math.abs(d.x - v.x) < 1.5 && v.y0 <= d.y1 + 2) d.y1 = Math.max(d.y1, v.y1); else vs.push({ ...v });
  }
  vs.sort((a, b) => a.y0 - b.y0);
  const blocs = [];
  for (const v of vs) {
    const b = blocs.find((x) => v.y0 <= x.y1 + 2 && v.y1 >= x.y0 - 2);
    if (b) { b.y0 = Math.min(b.y0, v.y0); b.y1 = Math.max(b.y1, v.y1); b.v.push(v); } else blocs.push({ y0: v.y0, y1: v.y1, v: [v] });
  }
  return blocs.filter((b) => b.v.length >= 3).map((b) => {
    const xs = grappes(b.v.map((v) => v.x));
    const ys = grappes(p.h.filter((h) => h.y >= b.y0 - 2 && h.y <= b.y1 + 2 && h.x1 > xs[0] && h.x0 < xs.at(-1)).map((h) => h.y));
    const lignes = [];
    for (let i = 0; i + 1 < ys.length; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      // Les séparateurs de colonnes RÉELS de cette ligne : un filet vertical qui la traverse.
      const coupes = xs.filter((x) => b.v.some((v) => Math.abs(v.x - x) < 2 && v.y0 <= y0 + 3 && v.y1 >= y1 - 3));
      const cellules = [];
      for (let j = 0; j + 1 < coupes.length; j++) {
        const x0 = coupes[j], x1 = coupes[j + 1];
        const mots = p.mots.filter((m) => { const cx = (m.x0 + m.x1) / 2, cy = m.y - 2; return cx > x0 && cx < x1 && cy > y0 && cy < y1; });
        // Lignes de la cellule : par ordonnée, puis abscisse.
        const parY = new Map();
        for (const m of mots.sort((a, c) => a.y - c.y || a.x0 - c.x0)) {
          const k = [...parY.keys()].find((y) => Math.abs(y - m.y) < 2.5) ?? m.y;
          if (!parY.has(k)) parY.set(k, []);
          parY.get(k).push(m);
        }
        // Les fragments qui se touchent (moins d'un point d'écart) appartiennent au même mot : « Systè » + « me ».
        const lignesC = [...parY.values()].map((ms) => {
          ms.sort((a, c) => a.x0 - c.x0);
          let t = '';
          ms.forEach((m, k) => { t += (k && m.x0 - ms[k - 1].x1 > 1.0 ? ' ' : '') + m.t; });
          return { t, x1: ms.at(-1).x1 };
        });
        const texte = lignesC.map((l) => l.t);
        // Texte « d'un seul tenant » : ses lignes (sauf la dernière) vont jusqu'au bord droit de la cellule.
        const pleines = lignesC.slice(0, -1).filter((l) => x1 - l.x1 < 22).length;
        const prose = lignesC.length > 1 && pleines >= (lignesC.length - 1) * 0.6;
        cellules.push({ x0, x1, lignes: texte, prose, texte: texte.join(' ').replace(/\s+/g, ' ').trim() });
      }
      lignes.push({ y0, y1, cellules });
    }
    // Le titre au-dessus du tableau (lot) : les mots des 60 pt qui précèdent son premier filet.
    const dessus = p.mots.filter((m) => m.y < ys[0] && m.y > ys[0] - 70).sort((a, c) => a.y - c.y || a.x0 - c.x0)
      .reduce((t, m, k, ms) => t + (k && (Math.abs(m.y - ms[k - 1].y) > 2 || m.x0 - ms[k - 1].x1 > 1.0) ? ' ' : '') + m.t, '');
    return { y0: ys[0], lignes, dessus, colonnes: xs };
  });
}

// ── Reconnaissance des tableaux par leur en-tête ──
const lotDe = (texte) => { const m = /\bLOT\s*(?:N\s*°?\s*)?(\d+)\s*:/i.exec(texte); return m ? +m[1] : null; };
const articles = new Map(); // `${lot}#${n}` → article
const art = (lot, n) => { const k = `${lot}#${n}`; if (!articles.has(k)) articles.set(k, { lot, n }); return articles.get(k); };
const journal = [];
let lotCourant = null;
// Le dernier tableau reconnu : un tableau SANS en-tête, numéroté dès sa première ligne, aux mêmes colonnes et sur la page
// suivante, en est la suite (l'en-tête n'est pas répété).
let precedent = null;
// « Définition des prix » (DAO de travaux) : cellules « Prix N° 520 » ; la description d'un prix peut se poursuivre
// sur les lignes suivantes, et sur la page suivante.
let defCourant = null, attente = null;
let serieCourante = null;
const prixDef = /^Prix\s*N\s*[°o]?\s*(\d{1,3})$/i;

for (const [n, p] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
  for (const t of tableaux(p)) {
    const lotTitre = lotDe(t.dessus);
    if (lotTitre) lotCourant = lotTitre;
    if (t.lignes.some((l) => prixDef.test(l.cellules[0]?.texte ?? ''))) {
      for (const l of t.lignes) {
        const c0 = l.cellules[0]?.texte ?? '', c1 = l.cellules.at(-1);
        // « Prix N° » et son numéro coupés par un filet (prix 621) : le numéro arrive avec la description.
        if (/^Prix\s*N\s*[°o]?$/i.test(c0)) { attente = c1?.texte; continue; }
        if (attente && /^\d{1,3}$/.test(c0)) {
          const a = art(lotCourant, +c0);
          a.code ??= c0; a.designationSpec = attente; a.exigences = [...(c1?.lignes ?? [])]; a.definition = true; a.pageSpec = n;
          defCourant = a; attente = null;
          continue;
        }
        const m = prixDef.exec(c0);
        if (m) {
          const a = art(lotCourant, +m[1]);
          a.code ??= m[1]; a.designationSpec = c1?.lignes?.[0]; a.exigences = c1?.lignes?.slice(1) ?? []; a.definition = true; a.pageSpec = n;
          defCourant = a;
        } else if (!c0 && defCourant && c1?.texte) defCourant.exigences.push(...c1.lignes);
      }
      journal.push(`p${n} : tableau DÉFINITION DES PRIX`);
      precedent = null;
      continue;
    }
    // Les colonnes se reconnaissent à leur intitulé (une ou deux lignes d'en-tête, cellules fusionnées comprises) : pour
    // chaque colonne de la grille, le texte d'en-tête qui la surplombe.
    const iPremier = t.lignes.findIndex((l) => /^\d{1,3}$/.test(l.cellules[0]?.texte ?? ''));
    const suite = (iPremier === 0 || (iPremier === 1 && !t.lignes[0].cellules[0]?.texte)) && precedent && precedent.page === n - 1 && precedent.colonnes.length === t.colonnes.length
      && precedent.colonnes.every((x, j) => Math.abs(x - t.colonnes[j]) < 3);
    const nEntete = suite ? 0 : iPremier > 0 ? iPremier : 1;
    const cellule = (l, j) => { if (j < 0) return null; const xm = (t.colonnes[j] + t.colonnes[j + 1]) / 2; return l.cellules.find((c) => c.x0 <= xm && c.x1 >= xm) ?? null; };
    const colonnes = t.colonnes.slice(0, -1).map((_, j) => norm(t.lignes.slice(0, nEntete).map((l) => cellule(l, j)?.texte ?? '').join(' ')));
    const col = (re, sauf) => colonnes.findIndex((c) => re.test(c) && !(sauf && sauf.test(c)));
    const herite = suite ? precedent.indices : null;
    const iDesig = herite?.iDesig ?? col(/DESIGNATION|DESCRIPTION/);
    const iSpec = herite?.iSpec ?? col(/SPECIFICATION|DESCRIPTION.*(?:DEMANDE|MINIMUM|REQUIS)/, /PROPOS|CANDIDAT|DESIGNATION/);
    const iUnite = herite?.iUnite ?? col(/\bUNITE\b/, /PRIX|DESIGNATION/);
    const iQte = herite?.iQte ?? col(/QUANTITE|\bQTE\b/);
    const iMin = herite?.iMin ?? col(/\bMIN\b/, /MONTANT/), iMax = herite?.iMax ?? col(/\bMAX\b/, /MONTANT/);
    const spec = iDesig >= 0 && iSpec >= 0;
    const bord = !spec && iDesig >= 0 && iUnite >= 0 && (iQte >= 0 || iMin >= 0);
    if (!spec && !bord) { precedent = null; continue; }
    const lot = suite ? precedent.lot : lotTitre ?? lotCourant;
    precedent = { page: n, colonnes: t.colonnes, lot, indices: { iDesig, iSpec, iUnite, iQte, iMin, iMax }, dernier: suite ? precedent.dernier : null };
    if (!suite) serieCourante = null;
    const nombre = (c) => { const v = c?.texte?.replace(/\s/g, ''); return v && /^\d+(?:[,.]\d+)?$/.test(v) ? Number(v.replace(',', '.')) : null; };
    for (const l of t.lignes.slice(nEntete)) {
      const num = /^\d{1,3}$/.test(l.cellules[0]?.texte ?? '') ? +l.cellules[0].texte : null;
      // Suite de tableau : la fin de l'article coupé par le saut de page complète le dernier article de la page précédente.
      if (num == null && suite && t.lignes.indexOf(l) < iPremier && precedent.dernier) {
        const d = precedent.dernier;
        if (spec) d.exigences = [...(d.exigences ?? []), ...(cellule(l, iSpec)?.lignes ?? [])];
        else { d.designationBrute = (d.designationBrute ?? '') + ' ' + (cellule(l, iDesig)?.texte ?? ''); d.designation = nettoie(d.designationBrute); }
        continue;
      }
      // Une ligne sans désignation (tableau MODÈLE laissé vide : BPU de la lettre d'invitation…) ne crée pas d'article.
      if (num == null || !cellule(l, iDesig)?.texte) continue;
      // Une ligne de SECTION de bordereau (000 Installation, 500 Ouvrages…) n'a pas d'unité : ce n'est pas un article.
      if (bord && !cellule(l, iUnite)?.texte) { serieCourante = { code: l.cellules[0].texte, libelle: cellule(l, iDesig).texte }; continue; }
      const a = art(lot, num);
      a.code ??= l.cellules[0].texte;
      precedent.dernier = a;
      if (spec) {
        a.designationSpec = cellule(l, iDesig)?.texte;
        a.exigences = cellule(l, iSpec)?.lignes ?? [];
        a.prose = !!cellule(l, iSpec)?.prose;
        a.pageSpec = n;
      } else {
        a.designationBrute = cellule(l, iDesig)?.texte ?? ''; a.designation = nettoie(a.designationBrute);
        if (serieCourante) { a.serie = serieCourante.code; a.serieLibelle = serieCourante.libelle; }
        a.unite = cellule(l, iUnite)?.texte;
        if (iMin >= 0) { a.min = nombre(cellule(l, iMin)); a.max = nombre(cellule(l, iMax)); }
        else a.quantite = nombre(cellule(l, iQte));
        a.pageBordereau = n;
      }
    }
    journal.push(`p${n} : tableau ${spec ? 'SPÉCIFICATIONS' : 'BORDEREAU'}${suite ? ' (suite)' : ''} — lot ${lot ?? '?'} (${t.lignes.length} lignes)`);
  }
}

/**
 * Les caractéristiques d'une cellule « spécifications minimales » : une ligne « Libellé : valeur » est une caractéristique ;
 * sinon le texte est découpé sur « ; » et « + » (les éléments d'un kit), puis sur les virgules qui séparent des éléments.
 */
function caracteristiques(lignes, prose) {
  // Un texte d'un seul tenant se découpe sur « ; », « + » (éléments d'un kit) et les virgules ; une cellule en lignes courtes
  // garde une caractéristique par ligne (une ligne qui ne commence pas un « Libellé : » prolonge la précédente).
  const morceaux = prose
    ? lignes.join(' ').split(/\s*(?:;|\s\+\s?|\+\s|,\s)\s*/)
    : lignes.reduce((acc, l) => {
        const suite = acc.length && (/^\S*[\d/]\S*$/.test(l.trim()) || /[,\-:/+]\s*$/.test(acc.at(-1)) || /\b(?:de|du|des|à|au|aux|et|ou|avec|pour|en|par|sur)\s*$/i.test(acc.at(-1)));
        if (!acc.length || (!suite && /^[\p{Lu}\d(«"]/u.test(l))) acc.push(l); else acc[acc.length - 1] += ' ' + l;
        return acc;
      }, []).flatMap((m) => m.split(/\s*;(?!\s*\d)\s*/));
  return morceaux.map((m) => m.replace(/\s+/g, ' ').trim()).filter((m) => m.length > 1).map((m) => {
    const i = m.indexOf(':');
    return i > 2 && i < 40 ? { libelle: m.slice(0, i).trim(), exigence: m.slice(i + 1).trim() } : { libelle: m, exigence: '' };
  });
}

const liste = [...articles.values()].sort((a, b) => (a.lot ?? 0) - (b.lot ?? 0) || a.n - b.n).map((a) => ({ ...a, caracteristiques: a.definition
  ? a.exigences.join(' ').split(/\s*[•✓]\s*/).map((m) => m.trim()).filter((m) => m.length > 1).map((m) => ({ libelle: m, exigence: '' }))
  : caracteristiques(a.exigences ?? [], a.prose) }));
console.log(journal.join('\n'));
console.log(`\n${liste.length} articles :`);
for (const a of liste) {
  console.log(`\nLot ${a.lot} · n° ${a.code ?? a.n} — ${a.designation ?? a.designationSpec} · ${a.unite ?? '?'} · ${a.quantite != null ? 'qté ' + a.quantite : 'min ' + (a.min ?? '?') + ' max ' + (a.max ?? '?')} (bordereau p${a.pageBordereau ?? '—'}, spécif. p${a.pageSpec ?? '—'})`);
  const sansPluriel = (x) => norm(x).replace(/(\w)S\b/g, '$1');
  if (a.designationSpec && a.designation && ecart(a.designation, a.designationSpec)) console.log(`   ⚠ désignation des spécifications : « ${a.designationSpec} »`);
  for (const c of a.caracteristiques) console.log(`   • ${c.libelle}${c.exigence ? ' : ' + c.exigence : ''}`);
}
if (sortie) fs.writeFileSync(sortie, JSON.stringify(liste, null, 1));
