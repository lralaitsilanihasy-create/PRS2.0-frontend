// Lot D — juge un `.docx` rendu (le décalque de relecture, ou le rendu BRUT du serveur, jetons et marqueurs non
// substitués) contre le modèle décrit. La preuve se fait en deux maillons :
//
//   1. modèle ≡ document type — tenu à la CONSTRUCTION par `decrire.mjs` : chaque paragraphe est lu dans la source,
//      chaque trou est tracé (jeton, choix mot pour mot, retrait), aucune ligne n'est perdue sans raison déclarée ;
//   2. rendu ≡ modèle — vérifié ICI, dans les deux sens : chaque paragraphe (ou cellule) du modèle se retrouve dans
//      le rendu, dans l'ordre, et le rendu ne dit rien que le modèle ne dise.
//
// La comparaison est celle de la chaîne du candidat (`reduire` : lettres et chiffres, casse, blancs et ponctuation
// ignorés). Les déclarations `CONDITION` ne s'impriment pas ; les marqueurs `{{SI:…}}` s'impriment dans un rendu brut.
//
//   node verifier.mjs DPAC-CC                               # le décalque modeles-docx/DPAC-CC.docx
//   node verifier.mjs DPAC-CC --docx=C:/…/DPAC-CC.docx      # un rendu brut du serveur
//   node verifier.mjs DPAC-CC AE-CC --dossier=C:/…/rendus    # plusieurs, nommés <sigle>.docx
// Code 1 au premier écart.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { CP, JAVA, reduire } from './commun.mjs';

const args = process.argv.slice(2);
const option = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const sigles = args.filter((a) => !a.startsWith('--'));
if (!sigles.length) { console.error('usage : node verifier.mjs <sigle> [--docx=…]'); process.exit(2); }

let ecarts = 0;
for (const sigle of sigles) {
  const m = JSON.parse(fs.readFileSync(`modeles/${sigle}.json`, 'utf8'));
  const docx = option('docx') ?? (option('dossier') ? `${option('dossier')}/${sigle}.docx` : `modeles-docx/${sigle}.docx`);
  if (!fs.existsSync(docx)) { console.log(`✗ ${sigle} : ${docx} absent`); ecarts++; continue; }
  // Paragraphes de cellule séparés (RS) : le DPAO est un tableau de rédactions, chaque paragraphe se compare seul.
  const lu = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', docx, '--paragraphes'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

  // Les unités comparées : un paragraphe, ou une cellule de tableau (LireDocx sépare les cellules par une tabulation).
  const rendu = lu.replace(/\r\n?/g, '\n').split('\n').flatMap((l) => l.split(/[\t\u001E]/)).map(reduire).filter(Boolean);
  const attendu = [...(m.titre ? [m.titre] : []), ...m.blocs.filter((b) => !['table', 'fin_table', 'vide'].includes(b.type))
    .flatMap((b) => b.texte.split(/[\u001E\u001F]/))].map(reduire).filter(Boolean);

  // Sens 1 : le modèle, dans l'ordre, se retrouve dans le rendu.
  let k = 0;
  const manquants = [];
  for (const a of attendu) {
    const j = rendu.indexOf(a, k);
    if (j < 0) manquants.push(a); else k = j + 1;
  }
  // Sens 2 : le rendu ne dit rien que le modèle ne dise.
  const connus = new Set(attendu);
  const inventes = rendu.filter((r) => !connus.has(r));

  const ok = !manquants.length && !inventes.length;
  console.log(`${ok ? '✓' : '✗'} ${sigle} (${docx}) : ${attendu.length} unités attendues, ${rendu.length} rendues — ${manquants.length} manquante(s) ou hors d'ordre, ${inventes.length} inventée(s)`);
  for (const x of manquants.slice(0, 5)) console.log(`     manque : ${x.slice(0, 100)}`);
  for (const x of inventes.slice(0, 5)) console.log(`     inventé : ${x.slice(0, 100)}`);
  if (!ok) ecarts++;
}
process.exit(ecarts ? 1 : 0);
