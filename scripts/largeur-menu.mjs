/**
 * Mesure de la LARGEUR DU MENU PRINCIPAL (barre horizontale), profil par profil et taille par taille.
 *
 * ⚠️ 30/10/2026 (design institutionnel) — remplace `hauteur-menu.mjs` : la barre latérale est devenue une barre
 * horizontale ; ce qui peut déborder n'est plus la hauteur du menu, c'est sa LARGEUR. Même méthode : un VRAI navigateur,
 * les VRAIES feuilles de style (`styles.scss` + `main-layout.scss`) et les VRAIES données de menu (`navigation.ts`,
 * `groupes-menu.ts`, `barre-menu.ts`, transpilés tels quels). jsdom n'a pas de moteur de rendu : la largeur d'un
 * libellé ne se devine pas.
 *
 *   node scripts/largeur-menu.mjs              # les dix profils, deux tailles
 *   node scripts/largeur-menu.mjs ADMINISTRATEUR
 *
 * Sortie : l'écart en pixels entre la largeur naturelle de la barre et la place disponible — `+n` = la barre déborde,
 * `−n` = la marge qui reste ; code de sortie 1 si une barre déborde (utilisable en garde-fou). À lancer après TOUTE entrée
 * ajoutée à `NAV_BY_ROLE`. Les rubriques sont mesurées FERMÉES (titre, marque, chevron), comme à l'ouverture d'un écran ;
 * les pastilles de compteur ne sont pas posées (elles varient avec les données).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TAILLES = [
  [1366, 768],
  [1229, 691],
];
/** Chrome, là où Windows l'installe. Passer CHROME_BIN pour un autre navigateur Chromium. */
const CHROMES = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const travail = mkdtempSync(join(tmpdir(), 'largeur-menu-'));

/** Les vrais modules de navigation, transpilés tels quels : la mesure porte sur les données livrées. */
async function chargerNavigation() {
  const { build } = await import(pathToFileURL(join(RACINE, 'node_modules/esbuild/lib/main.js')).href);
  const source = join(RACINE, 'src/app/core/navigation');
  const entree = join(travail, 'entree.ts');
  const chemin = (f) => JSON.stringify(join(source, f).replace(/\\/g, '/'));
  writeFileSync(
    entree,
    `export * from ${chemin('navigation.ts')};\nexport * from ${chemin('groupes-menu.ts')};\nexport * from ${chemin('barre-menu.ts')};\n`,
    'utf8',
  );
  const sortie = join(travail, 'navigation.mjs');
  await build({ entryPoints: [entree], bundle: true, format: 'esm', platform: 'neutral', outfile: sortie });
  return import(pathToFileURL(sortie).href);
}

/** Les feuilles de style réelles, compilées puis dé-encapsulées (`:host(x)` → `x`). */
async function compilerStyles() {
  const sass = await import(pathToFileURL(join(RACINE, 'node_modules/sass/sass.node.mjs')).href);
  const compiler = (fichier) =>
    sass.compile(fichier, { loadPaths: [join(RACINE, 'src')], sourceMap: false, silenceDeprecations: ['import'] }).css;
  const global = compiler(join(RACINE, 'src/styles.scss'));
  const coquille = compiler(join(RACINE, 'src/app/layout/main-layout/main-layout.scss'))
    .replace(/:host\(([^)]+)\)/g, '$1')
    .replace(/:host\b/g, '.coquille');
  return `${global}\n${coquille}`;
}

const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const icone = (taille, classe) =>
  `<app-icone class="${classe}" style="display:inline-flex;flex:none;line-height:0"><svg width="${taille}" height="${taille}" viewBox="0 0 24 24" style="display:block" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16" /></svg></app-icone>`;

/** La barre d'un profil, dans le même ordre d'éléments que `main-layout.html`. */
function barre(role, api) {
  const items = api.navFor(role);
  const sections = api.sectionsMenu(items);
  const pied = api.piedMenu(items);
  const entrees = api.barreDuMenu(sections, pied.length).map((e) =>
    e.lien
      ? `<li class="menu__entree"><a class="nav-item"><span class="nav-label">${echapper(e.lien.label)}</span>${e.lien.delegation ? icone(14, 'nav-deleg') : ''}</a></li>`
      : `<li class="menu__entree menu__entree--rubrique"><button type="button" class="nav-item nav-rubrique"><span class="nav-label">${echapper(e.titre)}</span>${e.marque ? icone(14, 'nav-deleg') : ''}${icone(14, 'nav-chevron')}</button></li>`,
  );
  const fin = pied.map((i) => `<li class="menu__entree menu__entree--pied"><a class="nav-item"><span class="nav-label">${echapper(i.label)}</span></a></li>`);
  return `<nav class="menu"><button type="button" class="menu__bascule">Menu</button><ul class="menu__liste">${[...entrees, ...fin].join('')}</ul></nav>`;
}

function page(css, contenu, [largeur]) {
  const cadre = `body{margin:0} .coquille{width:${largeur}px}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style><style>${cadre}</style></head>
<body><div class="coquille">${contenu}</div>
<pre id="mesure"></pre>
<script>
  const liste = document.querySelector('.menu__liste');
  const dispo = liste.clientWidth;
  // Largeur naturelle : chaque entrée à sa taille, sans la marge automatique qui pousse « Notifications » à droite.
  const entrees = Array.from(liste.children);
  const ecarts = parseFloat(getComputedStyle(liste).columnGap || '0') * Math.max(0, entrees.length - 1);
  const naturelle = entrees.reduce((n, li) => n + li.getBoundingClientRect().width, 0) + ecarts;
  document.getElementById('mesure').textContent = JSON.stringify({ dispo: Math.round(dispo), naturelle: Math.round(naturelle), vue: window.innerWidth });
</script></body></html>`;
}

function mesurer(chrome, fichier, [largeur, hauteur]) {
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      // Sans cela, Windows applique son échelle d'affichage (125 % sur le poste de recette) et la vue n'est plus celle demandée.
      '--force-device-scale-factor=1',
      `--window-size=${largeur},${hauteur}`,
      '--virtual-time-budget=3000',
      `--user-data-dir=${join(travail, 'profil')}`,
      '--dump-dom',
      pathToFileURL(fichier).href,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  const brut = /<pre id="mesure">([^<]*)<\/pre>/.exec(dom)?.[1];
  if (!brut) throw new Error('Chrome n’a rien rendu — la maquette ne s’est pas chargée.');
  return JSON.parse(brut.replace(/&quot;/g, '"'));
}

const chrome = CHROMES.find((c) => existsSync(c));
if (!chrome) {
  console.error('Aucun Chromium trouvé. Renseigner CHROME_BIN.');
  process.exit(2);
}

try {
  const api = await chargerNavigation();
  const css = await compilerStyles();
  const demandes = process.argv.slice(2);
  const roles = demandes.length ? demandes : Object.keys(api.NAV_BY_ROLE ?? {});
  if (!roles.length) throw new Error('Aucun profil à mesurer.');

  console.log('Largeur du menu principal — écart, en pixels : + déborde, − de marge\n');
  const entete = ['Profil'.padEnd(22), ...TAILLES.map(([l, h]) => `${l}×${h}`.padStart(10))];
  console.log(entete.join(' | '));
  console.log('-'.repeat(entete.join(' | ').length));

  let debordements = 0;
  for (const role of roles) {
    const cellules = [];
    for (const taille of TAILLES) {
      const fichier = join(travail, `${role}-${taille[0]}.html`);
      writeFileSync(fichier, page(css, barre(role, api), taille), 'utf8');
      const m = mesurer(chrome, fichier, taille);
      const ecart = m.naturelle - m.dispo;
      if (ecart > 0) debordements++;
      cellules.push(`${ecart > 0 ? '+' : ''}${ecart}`.padStart(10));
    }
    console.log([role.padEnd(22), ...cellules].join(' | '));
  }

  console.log(`\n${debordements === 0 ? '✔ Aucune barre ne déborde.' : `✘ ${debordements} configuration(s) en débordement.`}`);
  process.exitCode = debordements === 0 ? 0 : 1;
} finally {
  rmSync(travail, { recursive: true, force: true });
}
