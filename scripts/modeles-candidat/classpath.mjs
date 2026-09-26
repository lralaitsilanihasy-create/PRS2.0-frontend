// Compose le classpath POI depuis le dépôt Maven local — les mêmes jars que le backend, aucune dépendance
// ajoutée au projet. Écrit `cp.txt`, lu par `verifier.mjs` et par les commandes javac/java du README.
//
//   node classpath.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const M2 = path.join(os.homedir(), '.m2', 'repository');
const jar = (rel) => {
  const p = path.join(M2, rel);
  if (!fs.existsSync(p)) throw new Error(`jar absent du dépôt Maven local : ${rel}`);
  return p.replace(/\\/g, '/');
};
/** La dernière version présente d'un artefact, pour ne pas figer des numéros qui bougent. */
const derniere = (groupe, artefact) => {
  const d = path.join(M2, ...groupe.split('.'), artefact);
  const versions = fs.readdirSync(d).filter((v) => /^\d/.test(v)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!versions.length) throw new Error(`aucune version de ${groupe}:${artefact}`);
  const v = versions[versions.length - 1];
  return jar(path.join(...groupe.split('.'), artefact, v, `${artefact}-${v}.jar`));
};

const cp = [
  derniere('org.apache.poi', 'poi'),
  derniere('org.apache.poi', 'poi-ooxml'),
  derniere('org.apache.poi', 'poi-ooxml-lite'),
  derniere('org.apache.xmlbeans', 'xmlbeans'),
  derniere('org.apache.commons', 'commons-compress'),
  derniere('commons-io', 'commons-io'),
  derniere('org.apache.logging.log4j', 'log4j-api'),
  derniere('org.apache.commons', 'commons-collections4'),
].join(process.platform === 'win32' ? ';' : ':');
fs.writeFileSync('cp.txt', cp, 'utf8');
console.log('cp.txt :', cp.split(/[;:]/).length, 'jars');
