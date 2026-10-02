// Ce que partagent les trois scripts de la chaîne ARMP (`extraire-armp.mjs`, `decrire-armp.mjs`,
// `verifier-armp.mjs`) : où sont Java et les jars, comment se lit `source-armp.txt`, comment on y découpe la
// section d'un formulaire, et les deux normalisations — celle du texte reproduit (`propre`) et celle de la
// comparaison (`reduire`).
import fs from 'node:fs';

export const CP = () => fs.readFileSync('cp.txt', 'utf8').trim() + (process.platform === 'win32' ? ';out' : ':out');

/** `java` là où il est : `JAVA_HOME`, puis le JDK connu du poste, puis le PATH (constat du backend, 26/09). */
export const JAVA = (() => {
  const candidats = [
    process.env.JAVA_HOME && `${process.env.JAVA_HOME}/bin/java${process.platform === 'win32' ? '.exe' : ''}`,
    'C:/Program Files/Java/jdk-21.0.11/bin/java.exe',
  ].filter(Boolean);
  return candidats.find((c) => fs.existsSync(c)) ?? 'java';
})();

/** Apostrophes droites ou courbes confondues, pour chercher un fragment sans le retaper. */
export const droite = (s) => s.replace(/[’ʼ]/g, "'");
/** La clé de recherche d'un texte : apostrophes confondues, blancs réduits (Word sème des espaces insécables : « A3 : »). */
export const cle = (s) => droite(propre(s));

/**
 * Les documents types des formulaires : celui des fournitures (A1-A4, C1, C2) et, depuis le 02/10, celui des travaux,
 * dont on ne prend que les garanties de soumission B1 et B2 (mêmes modèles que C1 / C2, mais numérotés B et renvoyant
 * aux clauses « (travaux) » des Instructions aux candidats).
 */
export const SOURCES = {
  fournitures: {
    doc: "Documents Types/Fournitures et services/3-Document type d'appel d'offres_Fournitures_Formulaires de soumission.doc",
    docx: 'armp/formulaires-fournitures.docx',
    texte: 'source-armp.txt',
  },
  travaux: {
    doc: "Documents Types/Travaux/3-Dossier type d'appel d'offres_Travaux_Formulaire de soumission.doc",
    docx: 'armp/formulaires-travaux.docx',
    texte: 'source-armp-travaux.txt',
  },
};

/** Les lignes du document type (LireDocx : un paragraphe par ligne, une ligne de tableau par ligne, cellules séparées par une tabulation). */
export function lireSource(cleSource = 'fournitures') {
  const f = SOURCES[cleSource].texte;
  if (!fs.existsSync(f)) throw new Error(`${f} absent : lancer d’abord \`node extraire-armp.mjs ${cleSource}\``);
  return fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n').split('\n');
}

/**
 * Les lignes d'une section du document type, de son titre (inclus) au titre suivant (exclu). La recherche commence
 * APRÈS la « Note aux Utilisateurs », donc après le sommaire, dont les entrées ressemblent aux titres (« A4 - … »).
 * `fin` absent : jusqu'à la fin du document.
 */
export function section(src, debut, fin) {
  // « Utilisateurs » aux fournitures, « utilisateurs » aux travaux
  const corps = src.findIndex((l) => l.trim().toLowerCase().startsWith('note aux utilisateurs'));
  if (corps < 0) throw new Error('« Note aux Utilisateurs » absente : source-armp.txt n’est pas le document type des formulaires');
  const i = src.findIndex((l, k) => k > corps && cle(l).startsWith(cle(debut)));
  if (i < 0) throw new Error(`section « ${debut} » absente de source-armp.txt`);
  const j = fin ? src.findIndex((l, k) => k > i && cle(l).startsWith(cle(fin))) : src.length;
  if (j < 0) throw new Error(`fin de section « ${fin} » absente après « ${debut} »`);
  return src.slice(i, j);
}

/**
 * Le texte tel qu'on le reproduit : blancs multiples réduits à un (frappes de Word), trait d'union insécable
 * (U+2011, « ci‑après ») rendu par un tiret simple — les polices du PDF du serveur ne l'ont pas toutes.
 */
// \u2026 et les glyphes d'une police de symboles (zone priv\u00e9e U+E000\u2013U+F8FF : cases \u00e0 cocher et leurs espaces, devant
// trois lignes d'A1) sont \u00e9cart\u00e9s, comme au 2463 (S6, arbitrage du 26/09 : absents).
export const propre = (t) => t.replace(/[\ue000-\uf8ff]/g, '').replace(/\u2011/g, '-').replace(/\s+/g, ' ').trim();

/**
 * Ce que compare `verifier-armp.mjs` : lettres et chiffres seulement (NFKC — ligatures dépliées —, minuscules).
 * Casse, espaces, ponctuation, apostrophes, tirets et pointillés ne comptent pas ; les accents et l'ORDRE, si.
 */
export const reduire = (t) => t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
