// Comparateur de FIDÉLITÉ : le texte du .docx reconstitué contre celui des pages du dossier.
// Remplace `fidelite.mjs` ; sait qu'un modèle peut couvrir plusieurs pages, et qu'un MARQUEUR ajouté
// ({{SI:…}}, {{FINSI:…}}) ne remplace aucun texte : il est retiré du produit avant comparaison.
//
// Il ne normalise que ce qui n'a pas de sens typographique — espaces, césures du PDF, apostrophes
// droites ou courbes, tirets, points de suspension. Accents, majuscules, ponctuation et ORDRE sont
// comparés tels quels. Un jeton de champ n'est pas un écart : la substitution est rejouée sur la
// source d'après la trace du descripteur.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const CP = fs.readFileSync('cp.txt', 'utf8').trim() + ';out';
const SRC = fs.readFileSync('source-modeles.txt', 'utf8');

const normaliser = (t) =>
  t
    .replace(/[’ʼ]/g, "'")
    .replace(/[‐-―−­]/g, '-')
    .replace(/…/g, '...')
    .replace(/[-]/g, '')   // glyphes d'une police de symboles (S6)
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const droite = (s) => s.replace(/[’ʼ]/g, "'");

function pageSource(page) {
  const d = SRC.indexOf(`===== PAGE ${page} =====`);
  const f = SRC.indexOf('===== PAGE', d + 10);
  return SRC.slice(d, f < 0 ? undefined : f)
    .split('\n').slice(1).map((l) => l.trim())
    .filter((l) => l && l !== String(page)).join(' ');
}

/** Rejoue une substitution sur la source, apostrophes droites ou courbes confondues. */
function rejouer(texte, source, jeton) {
  const cible = droite(source);
  let out = texte;
  let i = droite(out).indexOf(cible);
  while (i >= 0) {
    out = out.slice(0, i) + jeton + out.slice(i + source.length);
    i = droite(out).indexOf(cible, i + jeton.length);
  }
  return out;
}

/**
 * ⚠️ `--docx=<chemin>` : vérifie CE fichier au lieu du décalque — c'est ainsi qu'un `.docx` produit par le moteur
 * du backend, rendu en mode « modèle » (jetons non substitués), se compare au dossier. Un seul sigle à la fois.
 *   node verifier.mjs C1 --docx=C:/…/C1-serveur.docx
 */
const args = process.argv.slice(2);
const autreDocx = (args.find((a) => a.startsWith('--docx=')) ?? '').slice('--docx='.length) || null;
/** `--dossier=<répertoire>` : les six rendus du serveur d'un coup, nommés `<sigle>.docx` — la recette de (c). */
const dossier = (args.find((a) => a.startsWith('--dossier=')) ?? '').slice('--dossier='.length) || null;
const sigles = args.filter((a) => !a.startsWith('--'));
if (autreDocx && sigles.length !== 1) {
  console.error('--docx= vaut pour un seul sigle ; pour plusieurs, --dossier=');
  process.exit(2);
}

let ecarts = 0;
for (const sigle of sigles) {
  const desc = JSON.parse(fs.readFileSync(`modeles/${sigle}.json`, 'utf8'));
  const fichier = autreDocx ?? (dossier ? `${dossier.replace(/[\\/]+$/, '')}/${sigle}.docx` : `modeles-docx/${desc.fichier}`);
  if (!fs.existsSync(fichier)) {
    ecarts++;
    console.log(`${sigle} — ABSENT : ${fichier}`);
    continue;
  }
  let produit = execFileSync('java', ['-cp', CP, 'LireDocx', fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const a of desc.ajouts ?? []) produit = produit.split(a).join('');

  let attendu = desc.pages.map(pageSource).join(' ');
  for (const s of desc.trace) attendu = rejouer(attendu, s.source, s.jeton);

  const a = normaliser(attendu);
  const b = normaliser(produit);
  const quoi = autreDocx || dossier ? ` [${fichier}]` : '';
  if (a === b) {
    console.log(`${sigle} (p. ${desc.pages.join('-')})${quoi} — identique · ${a.length} car.`);
    continue;
  }
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  ecarts++;
  console.log(`${sigle} (p. ${desc.pages.join('-')})${quoi} — ÉCART · source ${a.length} car., produit ${b.length} car., divergence à ${i}`);
  console.log(`   attendu : …${a.slice(Math.max(0, i - 50), i + 70)}…`);
  console.log(`   produit : …${b.slice(Math.max(0, i - 50), i + 70)}…`);
}
console.log(ecarts ? `\n${ecarts} écart(s) — la livraison est bloquée.` : '\nAucun écart : le décalque est fidèle.');
process.exit(ecarts ? 1 : 0);
