// Ce que partagent les scripts du lot D (`extraire.mjs`, `decrire.mjs`, `verifier.mjs`). Les outils Java et les
// normalisations sont ceux de la chaîne des formulaires du candidat (`../modeles-candidat/`), réutilisés tels quels :
// une seule définition de « propre » et de « réduire » pour tout ce qui compare un rendu à un document type.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export { JAVA, cle, droite, propre, reduire } from '../modeles-candidat/armp-commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CANDIDAT = path.resolve(ICI, '../modeles-candidat');

/** Le classpath des outils Java de la chaîne du candidat (POI + LireDocx + Decalque compilés dans son `out/`). */
export const CP = () => {
  const cp = path.join(CANDIDAT, 'cp.txt');
  if (!fs.existsSync(cp)) throw new Error('../modeles-candidat/cp.txt absent : lancer `node classpath.mjs` dans ../modeles-candidat');
  return fs.readFileSync(cp, 'utf8').trim() + (process.platform === 'win32' ? ';' : ':') + path.join(CANDIDAT, 'out');
};

/** Les lignes d'une source (LireDocx : un paragraphe par ligne, une ligne de tableau par ligne, cellules séparées par une tabulation). */
export function lireSource(cleSource) {
  const f = path.join(ICI, 'sources', `${cleSource}.txt`);
  if (!fs.existsSync(f)) throw new Error(`sources/${cleSource}.txt absent : lancer d’abord \`node extraire.mjs ${cleSource}\``);
  return fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n').split('\n');
}
