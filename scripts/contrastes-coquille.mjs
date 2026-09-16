/**
 * Contrastes WCAG 2.1 de la COQUILLE (barre latérale, barre du haut) — refonte ergonomique, lot 5.
 *
 *   node scripts/contrastes-coquille.mjs
 *
 * Sort la table avant/après de chaque paire et rend 1 si l'une d'elles passe sous son seuil APRÈS.
 * Les couleurs translucides de la barre sombre sont COMPOSITÉES sur leur fond réel avant mesure :
 * `rgba(255,255,255,.72)` n'est pas une couleur, c'est un calcul — le lire dans la feuille de style
 * ne dit rien du contraste obtenu. Le fond de référence est le HAUT du dégradé (#0c4a6e), pire cas.
 *
 * ⚠️ Les valeurs mesurées ici sont CALIBRÉES, pas décoratives : elles justifient les jetons
 * `--*-ink`, `--compteur-*` et les opacités du bloc `.sidebar` de `styles/_design-system.scss`.
 * Même règle que `--n-400` / `--n-500` (AUDIT.md A2) : on ne les éclaircit pas sans remesurer ici.
 */
const hex = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const blanc = (a) => [[255, 255, 255], a];
/** Compositing alpha (source-over) d'une couleur translucide sur un fond opaque. */
const sur = ([rgb, a], fond) => rgb.map((c, i) => Math.round(c * a + fond[i] * (1 - a)));
const canal = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
/** fg : '#rrggbb' ou blanc(alpha) ; bg : '#rrggbb' opaque. */
const mesure = (fg, bg) => {
  const fond = hex(bg);
  return ratio(Array.isArray(fg) ? sur(fg, fond) : hex(fg), fond);
};

// ── Fonds de référence ────────────────────────────────────────────────────────
const SIDEBAR_HAUT = '#0c4a6e'; // pire cas du dégradé (le bas, #082f49, est plus sombre)
const N100 = '#f0f2f8'; // fond de la pilule de recherche de la barre du haut
const P200 = '#bae6fd'; // bas du dégradé de l'avatar de la carte profil

// ── Profils : fond pâle, couleur d'AVANT (--*-color), encre d'APRÈS (--*-ink) ──
const PROFILS = [
  ['PRMP', '#f0f2ff', '#667eea', '#4462e5'],
  ['Président', '#e0f2fe', '#0369a1', '#0369a1'],
  ['Chef de commission', '#ecfdf5', '#0e7c5a', '#0e7c5a'],
  ['Membre', '#fef9c3', '#d97706', '#aa5d05'],
  ['Vérificateur', '#ede9fe', '#7c3aed', '#7c3aed'],
  ['Assistant contrôleur', '#fce7f3', '#db2777', '#c9226c'],
  ['Chargé de publication', '#fce7f3', '#db2777', '#c9226c'],
  ['Secrétaire', '#cffafe', '#0891b2', '#077792'],
  ['Administrateur', '#f3f4f6', '#374151', '#374151'],
];

const lignes = [];
const pousse = (element, seuil, fgAvant, bgAvant, fgApres, bgApres) =>
  lignes.push({ element, seuil, avant: mesure(fgAvant, bgAvant), apres: mesure(fgApres, bgApres) });
/** Paire qui n'existait pas avant (ou contre-épreuve : mesurée, jamais posée à l'écran). */
const nouveau = (element, seuil, fg, bg, contreEpreuve = false) =>
  lignes.push({ element, seuil, avant: NaN, apres: mesure(fg, bg), contreEpreuve });

// ── Barre latérale ────────────────────────────────────────────────────────────
pousse('Entrée de menu au repos', 4.5, blanc(0.72), SIDEBAR_HAUT, blanc(0.82), SIDEBAR_HAUT);
pousse('Sous-entrée (.nav-item--sub)', 4.5, blanc(0.6), SIDEBAR_HAUT, blanc(0.72), SIDEBAR_HAUT);
pousse('Intitulé de rubrique', 4.5, blanc(0.62), SIDEBAR_HAUT, blanc(0.72), SIDEBAR_HAUT);
pousse('Chevron de groupe (.nav-chevron)', 3, blanc(0.4), SIDEBAR_HAUT, blanc(0.55), SIDEBAR_HAUT);
pousse('Chevron de repli des délégations', 3, blanc(0.62), SIDEBAR_HAUT, blanc(0.72), SIDEBAR_HAUT);
pousse('Marque de délégation sur une entrée', 3, blanc(0.72 * 0.65), SIDEBAR_HAUT, blanc(0.82), SIDEBAR_HAUT);
pousse('Marque de délégation de l’intitulé', 3, blanc(0.62 * 0.8), SIDEBAR_HAUT, blanc(0.72), SIDEBAR_HAUT);
pousse('Marque « CNM »', 4.5, '#ffffff', SIDEBAR_HAUT, '#ffffff', SIDEBAR_HAUT);
pousse('Carte profil — nom', 4.5, '#ffffff', SIDEBAR_HAUT, '#ffffff', SIDEBAR_HAUT);
pousse('Carte profil — libellé de rôle', 4.5, blanc(0.55), SIDEBAR_HAUT, blanc(0.72), SIDEBAR_HAUT);
pousse('Carte profil — initiales de l’avatar', 4.5, '#0284c7', P200, '#075985', P200);
pousse('Carte profil — bordure (la carte est un lien chez la PRMP)', 3, blanc(0.1), SIDEBAR_HAUT, blanc(0.44), SIDEBAR_HAUT);
pousse('Repère de focus sur la barre latérale (--p-400)', 3, '#38bdf8', SIDEBAR_HAUT, '#38bdf8', SIDEBAR_HAUT);

// ── Entrée ACTIVE, pastille de profil, barre d'accent — les neuf profils ──────
for (const [nom, bg, couleur, encre] of PROFILS) {
  pousse(`Entrée ACTIVE — ${nom}`, 4.5, couleur, bg, encre, bg);
}
for (const [nom, bg, couleur, encre] of PROFILS) {
  pousse(`Pastille de profil (barre du haut) — ${nom}`, 4.5, couleur, bg, encre, bg);
}
// La barre d'accent de 3 px est peinte À L'INTÉRIEUR de la pastille claire : même paire que le texte.
for (const [nom, bg, , encre] of PROFILS) {
  nouveau(`Barre d’accent 3 px, dans la pastille — ${nom}`, 3, encre, bg);
}
// Contre-épreuve — c'est la raison du « à l'intérieur » : posée sur le fond sombre, elle disparaît.
nouveau('CONTRE-ÉPREUVE : accent posé sur le fond sombre — Administrateur', 3, '#374151', SIDEBAR_HAUT, true);

// ── Pastilles de compteur (ambre unique) et d'alerte (rouge, réservé) ─────────
pousse('Pastille de compteur — défaut, Président', 4.5, '#0369a1', '#e0f2fe', '#3b2500', '#fbbf24');
pousse('Pastille de compteur — défaut, Membre', 4.5, '#d97706', '#fef9c3', '#3b2500', '#fbbf24');
pousse('Pastille de compteur — .i (info)', 4.5, '#0284c7', '#f0f9ff', '#3b2500', '#fbbf24');
pousse('Pastille de compteur — .s (succès)', 4.5, '#059669', '#ecfdf5', '#3b2500', '#fbbf24');
pousse('Pastille de compteur — .w', 4.5, '#a16207', '#fef9c3', '#3b2500', '#fbbf24');
pousse('Pastille de compteur — .d', 4.5, '#b91c1c', '#fee2e2', '#3b2500', '#fbbf24');
pousse('Pastille d’ALERTE (inchangée)', 4.5, '#b91c1c', '#fee2e2', '#b91c1c', '#fee2e2');

// ── RAIL COMPACT (lot 5, F4) ──────────────────────────────────────────────────
// En rail, l'intitulé de rubrique passe hors écran et un FILET prend sa place : il n'est plus un
// ornement, c'est le seul repère visuel de regroupement du menu. Il est donc traité comme un
// élément non textuel porteur de sens (3:1), et non comme un séparateur décoratif — d'où 0,45,
// bien au-dessus du 0,12 du filet de pied, qui, lui, double un libellé toujours lisible.
nouveau('Filet de rubrique, en rail', 3, blanc(0.45), SIDEBAR_HAUT);
nouveau('CONTRE-ÉPREUVE : le même filet aux 0,12 du pied de menu', 3, blanc(0.12), SIDEBAR_HAUT, true);
// La légende sous l'icône (9 px) : même encre que l'entrée au repos, le corps ne change pas le ratio.
nouveau('Légende du rail sous l’icône', 4.5, blanc(0.82), SIDEBAR_HAUT);
// L'état courant en rail est celui du menu large : pastille claire + barre d'accent, déjà mesurés
// profil par profil ci-dessus. Rien de nouveau n'est peint — c'est tout l'intérêt d'un seul gabarit.

// ── Barre du haut ─────────────────────────────────────────────────────────────
// Bascule du rail : même gabarit que le bouton de tiroir (`_responsive.scss`). C'est le GLYPHE qui
// porte la commande ; la bordure `--n-200` reprise du bouton de tiroir n'est qu'un liseré de surface.
nouveau('Bascule du rail — glyphe', 3, '#4a5578', '#ffffff');
pousse('Recherche — loupe', 3, '#5b6784', N100, '#5b6784', N100);
pousse('Recherche — texte de substitution', 4.5, '#667299', N100, '#586586', N100);
pousse('Recherche — saisie', 4.5, '#1a1d2e', N100, '#1a1d2e', N100);
pousse('Nom de l’utilisateur', 4.5, '#1a1d2e', '#ffffff', '#1a1d2e', '#ffffff');
pousse('Cloche de notifications', 3, '#34405a', '#ffffff', '#34405a', '#ffffff');
pousse('Repère de focus sur la barre du haut', 3, '#38bdf8', '#ffffff', '#0369a1', '#ffffff');
pousse('Repère de focus sur la cloche', 3, '#38bdf8', '#ffffff', '#0369a1', '#ffffff');
// Le champ de recherche pose `outline: none` : son seul repère de focus est la bordure de la pilule.
pousse('Bordure de la recherche au focus', 3, '#38bdf8', '#ffffff', '#0369a1', '#ffffff');

// ── Sortie ────────────────────────────────────────────────────────────────────
const f = (v) => (Number.isNaN(v) ? '—' : `${v.toFixed(2).replace('.', ',')}:1`);
let echecs = 0;
console.log('| Élément | Seuil | Avant | Après | Verdict après |');
console.log('|---|---|---|---|---|');
for (const l of lignes) {
  const sousLeSeuil = !Number.isNaN(l.apres) && l.apres < l.seuil;
  if (sousLeSeuil && !l.contreEpreuve) echecs++;
  const verdict = l.contreEpreuve ? 'contre-épreuve' : sousLeSeuil ? 'SOUS LE SEUIL' : 'ok';
  const avant = `${f(l.avant)}${!Number.isNaN(l.avant) && l.avant < l.seuil ? ' (sous le seuil)' : ''}`;
  console.log(`| ${l.element} | ${l.seuil.toFixed(1).replace('.', ',')} | ${avant} | ${f(l.apres)} | ${verdict} |`);
}
console.log(`\n${lignes.length} paires mesurées — ${echecs} sous le seuil APRÈS.`);
process.exit(echecs === 0 ? 0 : 1);
