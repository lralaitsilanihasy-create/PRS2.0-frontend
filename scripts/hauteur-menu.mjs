/**
 * Mesure de la HAUTEUR DU MENU LATÉRAL, profil par profil et taille par taille.
 *
 * Pourquoi un script : le critère du lot 5 puis du lot 6 — « le menu tient sans défilement à
 * 1366×768 et à 1229×691 » — a été vérifié à la main au lot 5 (cf. `6b6ac39`). Une mesure faite à
 * la main ne se rejoue pas : la prochaine entrée ajoutée à `NAV_BY_ROLE` repasse le menu de
 * l'Administrateur en défilement sans que personne ne le voie. Le calcul ne se devine pas non plus
 * (jsdom n'a pas de moteur de rendu) : on mesure donc dans un VRAI navigateur, sur les VRAIES
 * feuilles de style et les VRAIES données de menu.
 *
 * Comment : Chrome sans interface affiche une maquette de la barre latérale — le même DOM que
 * `main-layout.html`, le CSS compilé de `styles.scss` + `main-layout.scss` — et rend
 * `scrollHeight - clientHeight` de `.sidebar-nav`, c'est-à-dire exactement le nombre de pixels qui
 * DÉBORDENT. 0 = le menu tient.
 *
 *   node scripts/hauteur-menu.mjs              # les dix profils, deux tailles, menu large et rail
 *   node scripts/hauteur-menu.mjs ADMINISTRATEUR
 *
 * Sortie : un tableau, et un code de sortie 1 si un menu déborde (le script est donc utilisable
 * en garde-fou). Les sous-entrées (`children`) ne sont pas dépliées : aucun menu n'en porte
 * aujourd'hui, et elles sont repliées à l'ouverture.
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

const travail = mkdtempSync(join(tmpdir(), 'hauteur-menu-'));

function nettoyer() {
  rmSync(travail, { recursive: true, force: true });
}

/** Le vrai module de navigation, transpilé tel quel : la mesure porte sur les données livrées. */
async function chargerNavigation() {
  const { build } = await import(pathToFileURL(join(RACINE, 'node_modules/esbuild/lib/main.js')).href);
  const source = join(RACINE, 'src/app/core/navigation');
  const entree = join(travail, 'entree.ts');
  writeFileSync(
    entree,
    `export * from ${JSON.stringify(join(source, 'navigation.ts').replace(/\\/g, '/'))};\n` +
      `export * from ${JSON.stringify(join(source, 'groupes-menu.ts').replace(/\\/g, '/'))};\n`,
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
  // `main-layout.scss` est une feuille de composant : ses `:host(...)` ne sont pas du CSS valide
  // hors d'Angular. On les ramène à des classes que la maquette porte sur son conteneur — la
  // GÉOMÉTRIE est identique, c'est tout ce que l'on mesure ici.
  const coquille = compiler(join(RACINE, 'src/app/layout/main-layout/main-layout.scss'))
    .replace(/:host\(([^)]+)\)/g, '$1')
    .replace(/:host\b/g, '.coquille');
  return `${global}\n${coquille}`;
}

const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const icone = (taille = 18, classe = '') =>
  `<app-icone class="${classe}" style="display:inline-flex;flex:none;line-height:0"><svg width="${taille}" height="${taille}" viewBox="0 0 24 24" style="display:block" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16" /></svg></app-icone>`;

/** Une entrée de menu, dans le même ordre d'éléments que `main-layout.html`. */
function entree(item, nom, court) {
  return [
    '<a class="nav-item">',
    item.icon ? icone(18, 'nav-icon') : '',
    `<span class="nav-label">${echapper(nom)}</span>`,
    `<span class="nav-court">${echapper(court)}</span>`,
    item.delegation ? icone(14, 'nav-deleg') : '',
    '</a>',
  ].join('');
}

/** La barre latérale d'un profil : marque, rubriques, pied, carte de profil. */
function barre(role, api, rail) {
  const menu = api.navFor(role);
  const sections = api.sectionsMenu(menu);
  const pied = api.piedMenu(menu);
  const legende = (i) => api.libelleCourt(i, role);
  // `nomAccessible()` de la coquille : le libellé complet en menu large, le nom accessible élargi
  // en rail (WCAG 2.5.3) — où il est de toute façon rangé hors écran.
  const nomRail = (i) => (rail ? api.nomAccessibleRail(i, role) : i.label);

  const corps = sections
    .map((section) => {
      let titre = '';
      if (section.repliable) {
        titre =
          '<button type="button" class="sidebar-nav__titre sidebar-nav__titre--bouton">' +
          `<span class="sidebar-nav__titre-texte">${echapper(section.titre)}</span>` +
          icone(14, 'sidebar-nav__titre-marque') +
          icone(14, 'sidebar-nav__titre-chevron') +
          '</button>';
      } else if (section.titre) {
        titre =
          '<div class="sidebar-nav__titre sidebar-nav__titre--fixe">' +
          `<span class="sidebar-nav__titre-texte">${echapper(section.titre)}</span></div>`;
      }
      return titre + section.items.map((i) => entree(i, nomRail(i), legende(i))).join('');
    })
    .join('');

  const basDeBarre = pied.length
    ? `<div class="sidebar-nav__pied">${pied.map((i) => entree(i, nomRail(i), legende(i))).join('')}</div>`
    : '';

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="sidebar-logo-mark">MEF</span>
      <div class="sidebar-logo-text">
        <div class="name">PRS 2.0</div>
        <div class="sub">Commission nationale des marchés</div>
      </div>
    </div>
    <nav class="sidebar-nav">${corps}${basDeBarre}</nav>
    <div class="sidebar-profile">
      <div class="avatar">RA</div>
      <div class="info">
        <div class="name">Rakotoarisoa Andry</div>
        <div class="role">${echapper(role)}</div>
      </div>
    </div>
  </aside>`;
}

function page(css, contenu, rail, [largeur, hauteur]) {
  // La hauteur de la vue est imposée par le CONTENEUR, pas par la fenêtre du navigateur : sans
  // interface, Chrome rend une vue plus courte que la taille demandée (barre d'outils virtuelle).
  // `.sidebar` est `fixed; top:0; bottom:0` dans l'application — dans un conteneur de hauteur
  // exacte, `absolute` lui donne rigoureusement la même boîte. La LARGEUR, elle, reste celle de la
  // fenêtre : c'est d'elle que dépend la requête de média du rail (≥ 769 px).
  const cadre = `body{margin:0}
    .coquille{position:relative;width:${largeur}px;height:${hauteur}px;overflow:hidden}
    .coquille .sidebar{position:absolute}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style><style>${cadre}</style></head>
<body><div class="coquille app-layout${rail ? ' layout--rail' : ''}">${contenu}</div>
<pre id="mesure"></pre>
<script>
  const nav = document.querySelector('.sidebar-nav');
  const dispo = nav.clientHeight;
  // scrollHeight ne descend jamais sous clientHeight : il dit ce qui DÉBORDE, jamais ce qui RESTE.
  // Pour la marge, on relâche la contrainte de la boîte et on lit la hauteur naturelle du menu —
  // le margin-top:auto du pied retombe alors à zéro, comme quand le menu défile.
  const deborde = Math.max(0, Math.round(nav.scrollHeight - dispo));
  nav.style.flex = '0 0 auto';
  nav.style.overflow = 'visible';
  nav.style.height = 'auto';
  const contenu = Math.round(nav.getBoundingClientRect().height);
  document.getElementById('mesure').textContent = JSON.stringify({
    deborde,
    contenu,
    dispo: Math.round(dispo),
    vue: window.innerWidth,
  });
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
      // Sans cela, Windows applique son échelle d'affichage (125 % sur le poste de recette) et la
      // vue mesurée n'est plus celle demandée : 768 px de fenêtre rendaient 616 px de vue.
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
  if (!brut) {
    throw new Error('Chrome n’a rien rendu — la maquette ne s’est pas chargée.');
  }
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
  if (!roles.length) {
    throw new Error('Aucun profil à mesurer.');
  }

  console.log('Hauteur du menu latéral — écart de .sidebar-nav, en pixels : + défile, − de marge\n');
  const entete = ['Profil'.padEnd(22), ...TAILLES.flatMap(([l, h]) => [`${l}×${h} large`, `${l}×${h} rail`])];
  console.log(entete.join(' | '));
  console.log('-'.repeat(entete.join(' | ').length));

  let debordements = 0;
  for (const role of roles) {
    const cellules = [];
    for (const taille of TAILLES) {
      for (const rail of [false, true]) {
        const fichier = join(travail, `${role}-${taille[0]}-${rail ? 'rail' : 'large'}.html`);
        writeFileSync(fichier, page(css, barre(role, api, rail), rail, taille), "utf8");
        const m = mesurer(chrome, fichier, taille);
        if (m.vue < 769) {
          console.warn(`  ⚠ ${role} : vue de ${m.vue} px de large — sous le seuil du rail (769 px).`);
        }
        if (m.deborde > 0) debordements++;
        // Le SIGNE porte la lecture : `+n` = n pixels qui défilent, `-n` = n pixels de marge. Une
        // marge est une information utile — elle dit combien d'entrées le menu peut encore prendre.
        const ecart = m.contenu - m.dispo;
        cellules.push(`${ecart > 0 ? '+' : ''}${ecart}`.padStart(rail ? 15 : 16));
      }
    }
    console.log([role.padEnd(22), ...cellules].join(' | '));
  }

  console.log(
    `\n${debordements === 0 ? '✔ Aucun menu ne défile.' : `✘ ${debordements} configuration(s) en défilement.`}`,
  );
  process.exitCode = debordements === 0 ? 0 : 1;
} finally {
  nettoyer();
}
