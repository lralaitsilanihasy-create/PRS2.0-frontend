// Resynchronise un modèle du banc sur celui du serveur (15/10) : le backend édite `src/main/resources/modeles/dao/<sigle>.txt` ;
// le front recopie le .txt et régénère les `conditions`, `titre` et `blocs` de `modeles/<sigle>.json` (lus par lire.mjs et banc.mjs).
// Les métadonnées de description (`trace`, `retraits`, `ajouts`, `source`, `fichier`) du .json existant sont gardées.
//   node resynchroniser.mjs AE-CC DPAC-CC        # recopie et régénère
//   node resynchroniser.mjs --verifier DPAO-F    # contrôle : le .json régénéré du .txt égale le .json en place
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const SERVEUR = 'C:/Users/LANTO/eclipse-workspace/PRS20/src/main/resources/modeles/dao';
const verifier = process.argv.includes('--verifier');
const sigles = process.argv.slice(2).filter((a) => !a.startsWith('--'));

/** Le .txt (TYPE<TAB>texte ; CONDITION<TAB>nom<US>expression) → titre, conditions, blocs. */
function lire(txt) {
  const conditions = {}; const blocs = []; let titre = null;
  for (const l of txt.replace(/\r\n/g, '\n').split('\n')) {
    if (!l) continue;
    const i = l.indexOf('\t');
    const type = i < 0 ? l : l.slice(0, i); const texte = i < 0 ? '' : l.slice(i + 1);
    if (type === 'FICHIER') continue;
    if (type === 'TITRE') { titre = texte; continue; }
    if (type === 'CONDITION') { const [nom, expr] = texte.split('\u001F'); conditions[nom] = expr; continue; }
    blocs.push({ type: type.toLowerCase(), texte });
  }
  return { titre, conditions, blocs };
}

let ko = 0;
for (const s of sigles) {
  const cheminJson = `${ICI}modeles/${s}.json`;
  const ancien = JSON.parse(fs.readFileSync(cheminJson, 'utf8'));
  const txt = fs.readFileSync(verifier ? `${ICI}modeles/${s}.txt` : `${SERVEUR}/${s}.txt`, 'utf8');
  const lu = lire(txt);
  if (verifier) {
    const egal = JSON.stringify({ titre: ancien.titre, conditions: ancien.conditions, blocs: ancien.blocs }) === JSON.stringify(lu);
    console.log(`${s} : ${egal ? 'identique' : 'DIFFÉRENT'}`);
    if (!egal) ko++;
    continue;
  }
  fs.writeFileSync(`${ICI}modeles/${s}.txt`, txt);
  const neuf = { ...ancien, titre: lu.titre ?? ancien.titre, conditions: lu.conditions, blocs: lu.blocs };
  fs.writeFileSync(cheminJson, JSON.stringify(neuf, null, 1) + '\n');
  console.log(`${s} : ${Object.keys(ancien.conditions).length} → ${Object.keys(lu.conditions).length} conditions, ${ancien.blocs.length} → ${lu.blocs.length} blocs`);
}
process.exit(ko ? 1 : 0);
