// Extraction SANS PERTE des pages 22 à 34 du dossier 2463 — la source de tout décalque.
//
// ⚠️ `-nodiag` écarte le texte DIAGONAL, c'est-à-dire le filigrane « RANDRIAMAMONJY Marie Lucienne » qui
// s'intercale lettre à lettre dans le texte ; il n'écarte rien d'autre. `-enc UTF-8` garde les glyphes vrais
// (apostrophes courbes, points de suspension) : un décodage latin1 les altérait. Ne jamais repartir de la
// copie de lecture du dossier (`dao-ac-propre.txt`), dont le nettoyage jette les lignes courtes.
//
//   node extraire.mjs            → source-modeles.txt
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.resolve(ICI, '../../NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf');
const DE = 22;
const A = 34;

const brut = execFileSync('pdftotext', ['-raw', '-nodiag', '-enc', 'UTF-8', '-f', String(DE), '-l', String(A), PDF, '-'], {
  encoding: 'utf8',
  maxBuffer: 64e6,
});
const pages = brut.split('\f');
const sortie = pages
  .map((p, i) => `\n===== PAGE ${DE + i} =====\n${p.split('\n').map((l) => l.replace(/[ \t]+$/, '')).filter((l) => l).join('\n')}`)
  .join('\n');
fs.writeFileSync(path.join(ICI, 'source-modeles.txt'), sortie, 'utf8');
const residu = (sortie.match(/RANDRIAMAMONJY|cienne/g) ?? []).length;
console.log(`pages ${DE} → ${A} : ${sortie.length} caractères · résidu de filigrane : ${residu}`);
if (residu) process.exit(1);
