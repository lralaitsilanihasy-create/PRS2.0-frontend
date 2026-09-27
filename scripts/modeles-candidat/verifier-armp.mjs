// Comparateur ARMP : le texte d'un `.docx` — le décalque du front, ou le rendu du serveur en mode « modèle »
// (jetons non substitués) — contre la section du DOCUMENT TYPE OFFICIEL qu'il reproduit (`source-armp.txt`).
// Deux sens, et il faut les deux :
//   1. rien ne MANQUE   : chaque fragment du gabarit se retrouve dans le rendu, jetons rejoués d'après le descripteur ;
//   2. rien n'est INVENTÉ : chaque fragment du rendu se retrouve dans le gabarit — c'est ce sens qui a refusé, le 27/09,
//      trois paragraphes de C1 complétés de mémoire depuis un affichage tronqué.
// Un fragment = une cellule ou un paragraphe, réduit à ses lettres et chiffres (`reduire`) ; en dessous de 8 caractères
// (blancs, « ou », labels) il ne prouve rien et n'est pas compté. Le comparateur neutralise donc la casse, les espaces,
// la ponctuation, les apostrophes, les tirets, les pointillés et les recollages de lignes (un titre du gabarit sur
// deux lignes, une cellule coupée en paragraphes) — pas l'ordre des mots dans un fragment, ni les accents.
//
//   node verifier-armp.mjs A2 A4 C1 C2                         # les décalques du front (modeles-docx-armp/)
//   node verifier-armp.mjs C1 --docx=C:/…/C1.docx              # un rendu du serveur, un seul sigle
//   node verifier-armp.mjs A2 A4 C1 C2 --dossier=C:/…/rendus   # les rendus du serveur, nommés <sigle>.docx
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { CP, JAVA, droite, lireSource, propre, reduire, section } from './armp-commun.mjs';

const SRC = lireSource();
const args = process.argv.slice(2);
const autreDocx = (args.find((a) => a.startsWith('--docx=')) ?? '').slice('--docx='.length) || null;
const dossier = (args.find((a) => a.startsWith('--dossier=')) ?? '').slice('--dossier='.length) || null;
const sigles = args.filter((a) => !a.startsWith('--'));
if (!sigles.length || (autreDocx && sigles.length !== 1)) {
  console.error('usage : node verifier-armp.mjs <sigle…> [--docx=<un seul>] [--dossier=<répertoire>]');
  process.exit(2);
}

/** Rejoue une substitution du descripteur sur le gabarit, apostrophes droites ou courbes confondues. */
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
const MIN = 8;
/** Les fragments probants d'une ligne : ses cellules, réduites, d'au moins MIN caractères. */
const fragments = (ligne) => ligne.split('\t').map((c) => ({ texte: c.trim(), reduit: reduire(c) })).filter((f) => f.reduit.length >= MIN);

let ecarts = 0;
for (const sigle of sigles) {
  const desc = JSON.parse(fs.readFileSync(`modeles-armp/${sigle}.json`, 'utf8'));
  const fichier = autreDocx ?? (dossier ? `${dossier.replace(/[\\/]+$/, '')}/${sigle}.docx` : `modeles-docx-armp/${desc.fichier}`);
  const quoi = autreDocx || dossier ? ` [${fichier}]` : '';
  if (!fs.existsSync(fichier)) {
    ecarts++;
    console.log(`${sigle}${quoi} — ABSENT`);
    continue;
  }
  // Les AJOUTS déclarés par le descripteur sont retirés du rendu : un marqueur `{{…}}` partout où il est, un label de
  // liste (« a) », « (a) ») seulement en TÊTE d'une cellule — « A3 - a) SITUATION… » garde son « a) ».
  const sansAjouts = (ligne) => ligne.split('\t').map((c) => desc.ajouts.reduce((t, a) => {
    if (a.startsWith('{{')) return t.split(a).join('');
    return t.trimStart().startsWith(a) ? t.trimStart().slice(a.length) : t;
  }, c)).join('\t');
  const rendu = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .replace(/\r\n?/g, '\n').split('\n')
    .map(sansAjouts)
    .filter((l) => l.trim());
  // Cellule par cellule : le texte rendu propre (blancs de Word réduits, glyphes de symboles écartés — comme le
  // descripteur l'a lu), puis les substitutions du descripteur rejouées.
  const gabarit = section(SRC, desc.section[0], desc.section[1] ?? undefined)
    .map((l) => l.split('\t').map((c) => desc.trace.reduce((t, s) => rejouer(t, s.source, s.jeton), propre(c))).join('\t'))
    .filter((l) => l.trim());

  const renduEntier = reduire(rendu.join(' '));
  const gabaritEntier = reduire(gabarit.join(' '));
  const manques = gabarit.flatMap(fragments).filter((f) => !renduEntier.includes(f.reduit));
  const inventes = rendu.flatMap(fragments).filter((f) => !gabaritEntier.includes(f.reduit));
  const nbGabarit = gabarit.flatMap(fragments).length;
  const nbRendu = rendu.flatMap(fragments).length;

  if (!manques.length && !inventes.length) {
    console.log(`${sigle}${quoi} — conforme au document type · ${nbGabarit} fragment(s) du gabarit retrouvés, ${nbRendu} du rendu tous fondés`);
    continue;
  }
  ecarts++;
  console.log(`${sigle}${quoi} — ÉCART · ${manques.length} fragment(s) du gabarit absent(s) du rendu, ${inventes.length} fragment(s) du rendu absent(s) du gabarit`);
  for (const f of manques) console.log(`   manque   : ${f.texte.slice(0, 110)}`);
  for (const f of inventes) console.log(`   inventé  : ${f.texte.slice(0, 110)}`);
}
console.log(ecarts ? `\n${ecarts} écart(s) — la livraison est bloquée.` : '\nAucun écart : les modèles sont ceux du document type.');
process.exit(ecarts ? 1 : 0);
