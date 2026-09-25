// Lecture d'un .xlsx SANS aucune dépendance : un classeur est une archive ZIP de XML.
// Usage : node lire-xlsx.mjs <chemin.xlsx> [numéro ou nom de feuille] [nb lignes] [--json]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fichier = process.argv[2];
if (!fichier || !fs.existsSync(fichier)) { console.error('fichier introuvable : ' + fichier); process.exit(1); }
const json = process.argv.includes('--json');
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-'));
execFileSync('unzip', ['-o', '-q', fichier, '-d', dossier]);

const lire = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const detag = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const ss = lire(path.join(dossier, 'xl', 'sharedStrings.xml'));
const chaines = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => detag(m[1]));

const wb = lire(path.join(dossier, 'xl', 'workbook.xml'));
const feuilles = [...wb.matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((m, i) => ({ nom: detag(m[1]), rang: i + 1 }));
if (!json) console.log(`${feuilles.length} feuille(s) : ${feuilles.map((f, i) => `${i + 1}. ${f.nom}`).join(' · ')}`);

const choix = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const cibles = !choix ? feuilles : feuilles.filter((f, i) => f.nom === choix || String(i + 1) === choix);
const maxLignes = Number(process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : 40);

const colonne = (ref) => { const l = ref.replace(/\d+/g, ''); let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n; };

const sortie = {};
for (const f of cibles) {
  const xml = lire(path.join(dossier, 'xl', 'worksheets', `sheet${f.rang}.xml`));
  if (!xml) { if (!json) console.log(`\n=== ${f.nom} : feuille illisible ===`); continue; }
  const table = [];
  let largeur = 0;
  for (const l of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const num = Number(l[1]);
    const ligne = [];
    // ⚠️ Une cellule vide est AUTO-FERMÉE (`<c r="B6" s="52"/>`) : sans ce cas, l'analyse avale la cellule suivante
    // et décale toute la ligne — c'est ce qui faisait apparaître des index de style à la place des libellés.
    for (const c of l[2].matchAll(/<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = colonne(c[1]);
      const attrs = c[2] || '';
      const contenu = c[3] || '';
      const type = (attrs.match(/t="([^"]*)"/) || [])[1];
      const brut = (contenu.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val;
      if (type === 's') val = chaines[Number(brut)] ?? '';
      else if (type === 'inlineStr') val = detag(contenu);
      else val = brut != null ? brut : detag(contenu);
      ligne[col - 1] = (val ?? '').toString().replace(/\s+/g, ' ').trim();
    }
    largeur = Math.max(largeur, ligne.length);
    table[num - 1] = ligne;
  }
  for (let i = 0; i < table.length; i++) if (!table[i]) table[i] = [];
  sortie[f.nom] = table.map((l) => { const r = []; for (let c = 0; c < largeur; c++) r.push(l[c] ?? ''); return r; });
  if (json) continue;
  console.log(`\n=== ${f.nom} — ${table.length} lignes, ${largeur} colonnes ===`);
  for (const [n, ligne] of table.slice(0, maxLignes).entries()) {
    const cells = [];
    for (let c = 0; c < largeur; c++) cells.push((ligne[c] ?? '').slice(0, 46));
    if (cells.every((x) => !x)) continue;
    console.log(String(n + 1).padStart(4) + ' | ' + cells.join(' | '));
  }
  if (table.length > maxLignes) console.log(`   … ${table.length - maxLignes} lignes de plus`);
}
if (json) console.log(JSON.stringify(sortie));
fs.rmSync(dossier, { recursive: true, force: true });
