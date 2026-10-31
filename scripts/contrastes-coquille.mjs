/**
 * Contrastes WCAG 2.1 de la COQUILLE et des styles communs — design institutionnel (30/10/2026).
 *
 *   node scripts/contrastes-coquille.mjs
 *
 * Lit les couleurs dans `src/styles.scss` (le bloc `:root` du design institutionnel, source unique) et mesure chaque paire
 * texte / fond posée par la coquille (bandeau, en-tête, menu, menus déroulants, pied) et par les styles communs (tableaux,
 * formulaires, boutons, pastilles, alertes). Rend 1 si une paire passe sous son seuil : 4,5:1 pour un texte, 3:1 pour un
 * contour de champ ou un repère de focus (WCAG 1.4.11).
 *
 * ⚠️ Toute nouvelle paire de couleurs posée dans la coquille ou les styles communs s'ajoute à `PAIRES`, sinon elle n'est
 * jamais mesurée. Deux valeurs de la palette demandée ont été corrigées le 30/10 pour passer ce script, avec l'accord du
 * pilote : --favorable-texte (#1B7F4B → #187547) et --bordure-champ (ajoutée, #868E96).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scss = readFileSync(join(RACINE, 'src/styles.scss'), 'utf8');

/** Les variables `--nom: #rrggbb` de styles.scss. */
const palette = Object.fromEntries([...scss.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
const canal = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const ratio = (a, b) => {
  const [l1, l2] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXTE = 4.5;
const CONTOUR = 3;
/** [où, variable du premier plan, variable du fond, seuil]. */
const PAIRES = [
  ['Menu : entrée au repos', 'texte-menu', 'menu-fond', TEXTE],
  ['Menu : entrée survolée', 'texte-menu', 'menu-survol', TEXTE],
  ['Menu : entrée active', 'texte', 'onglet-actif-fond', TEXTE],
  ['Menu : repère de focus (or)', 'or', 'menu-fond', CONTOUR],
  ['Menu : pastille de compteur', 'texte', 'or', TEXTE],
  ['Menu : pastille d’alerte', 'retard-texte', 'retard-fond', TEXTE],
  ['Déroulant : intitulé de rubrique', 'or', 'section-fond', TEXTE],
  ['Déroulant : entrée', 'texte', 'carte-fond', TEXTE],
  ['Déroulant : entrée survolée', 'texte', 'ligne-survol', TEXTE],
  ['Déroulant : entrée active', 'texte', 'onglet-actif-fond', TEXTE],
  // ⚠️ 31/10 (Espace de travail) — l'en-tête est sombre (--section-fond) et le pied réduit, en texte secondaire clair.
  ['En-tête sombre : nom de l’application, utilisateur', 'texte-menu', 'section-fond', TEXTE],
  ['En-tête sombre : institution, outils', 'texte-menu-secondaire', 'section-fond', TEXTE],
  ['En-tête sombre : recherche (texte d’aide)', 'texte-menu-secondaire', 'menu-fond', TEXTE],
  ['En-tête sombre : saisie de la recherche', 'texte-menu', 'menu-fond', TEXTE],
  ['En-tête sombre : contour de la recherche, des boutons', 'texte-menu-secondaire', 'section-fond', CONTOUR],
  ['En-tête sombre : avatar, pastille du profil', 'texte-menu', 'menu-survol', TEXTE],
  ['En-tête sombre : repère de focus (or)', 'or', 'section-fond', CONTOUR],
  ['Pied de page réduit : texte', 'texte-menu-secondaire', 'section-fond', TEXTE],
  ['Pied de page : lien', 'or', 'menu-fond', TEXTE],
  ['Page : texte courant', 'texte', 'page-fond', TEXTE],
  ['Page : fil d’Ariane, texte secondaire', 'texte-secondaire', 'page-fond', TEXTE],
  ['Tableau : en-tête', 'texte', 'tableau-entete', TEXTE],
  ['Tableau : texte secondaire en en-tête', 'texte-secondaire', 'tableau-entete', TEXTE],
  ['Tableau : ligne survolée', 'texte', 'ligne-survol', TEXTE],
  ['Formulaire : libellé', 'texte-secondaire', 'carte-fond', TEXTE],
  ['Formulaire : contour du champ', 'bordure-champ', 'carte-fond', CONTOUR],
  ['Formulaire : message d’erreur', 'retard-texte', 'carte-fond', TEXTE],
  ['Repère de focus (bouton principal)', 'bouton-principal', 'carte-fond', CONTOUR],
  ['Repère de focus sur la page', 'bouton-principal', 'page-fond', CONTOUR],
  ['Bouton principal', 'texte-menu', 'bouton-principal', TEXTE],
  ['Bouton de suppression', 'retard-texte', 'carte-fond', TEXTE],
  ['Bouton vert plein (valider)', 'texte-menu', 'favorable-texte', TEXTE],
  ['Pastille retard', 'retard-texte', 'retard-fond', TEXTE],
  ['Pastille examen', 'examen-texte', 'examen-fond', TEXTE],
  ['Pastille favorable', 'favorable-texte', 'favorable-fond', TEXTE],
  ['Pastille neutre', 'neutre-texte', 'neutre-fond', TEXTE],
  ['Bandeau de section', 'or', 'section-fond', TEXTE],
  ['Lien d’évitement', 'texte-menu', 'bouton-principal', TEXTE],
];

let echecs = 0;
console.log('Contrastes de la coquille et des styles communs (WCAG 2.1)\n');
for (const [ou, avant, fond, seuil] of PAIRES) {
  const [a, b] = [palette[avant], palette[fond]];
  if (!a || !b) {
    console.log(`✘ ${ou} : variable absente de styles.scss (--${!a ? avant : fond})`);
    echecs++;
    continue;
  }
  const r = ratio(a, b);
  const ok = r >= seuil;
  if (!ok) echecs++;
  console.log(`${ok ? '✔' : '✘'} ${ou.padEnd(40)} --${avant} ${a} sur --${fond} ${b} : ${r.toFixed(2)}:1 (seuil ${seuil}:1)`);
}
console.log(`\n${echecs === 0 ? '✔ Toutes les paires passent.' : `✘ ${echecs} paire(s) sous leur seuil.`}`);
process.exitCode = echecs === 0 ? 0 : 1;
