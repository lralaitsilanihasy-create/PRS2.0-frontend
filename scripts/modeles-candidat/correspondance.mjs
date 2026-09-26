// Tableaux de correspondance des six modèles, à partir des descripteurs et de leurs traces.
// Rien n'est saisi à la main : la colonne « source » vient de la trace des substitutions, le comptage
// se fait sur la SOURCE avant substitution, les blancs du candidat sont relevés dans le texte produit.
import fs from 'node:fs';

const SRC = fs.readFileSync('source-modeles.txt', 'utf8');
const droite = (s) => s.replace(/[’ʼ]/g, "'");
const pageSource = (page) => {
  const d = SRC.indexOf(`===== PAGE ${page} =====`);
  const f = SRC.indexOf('===== PAGE', d + 10);
  return SRC.slice(d, f < 0 ? undefined : f)
    .split('\n').slice(1).map((l) => l.replace(/[-]/g, '').trim())
    .filter((l) => l && l !== String(page)).join(' ');
};
const compter = (texte, source) => droite(texte).split(droite(source)).length - 1;

const QUI = {
  'B01-AC-01': ['Autorité contractante', 'fiche (PPM)'],
  'B01-AC-02': ["Adresse de l'autorité contractante", 'fiche (PPM)'],
  'B02-OB-01': ["Objet de l'appel d'offres", 'fiche'],
  'B02-OB-03': ["Numéro du dossier d'appel d'offres", 'fiche'],
  'B03-CQ-01': ["Pièces d'identification et situation juridique exigées", 'fiche'],
  'B03-CQ-09': ['Durée des antécédents juridiques (années) — N3', 'fiche (défaut administrable : 5)'],
  'B03-CQ-09.lettres': ['la même durée en toutes lettres', 'serveur'],
  'B03-CQ-10.lettres': ['Durée des antécédents financiers, en toutes lettres — N3', 'fiche (défaut administrable : 3)'],
  'B04-LR-03': ['Date limite de remise des offres', 'fiche'],
  'B05-GS-03': ['Garantie de soumission **du lot**', 'fiche (par lot)'],
  'B05-GS-03.lettres': ['le même montant en toutes lettres', 'serveur'],
  'B05-GS-04.doublet': ['l’ordinal « cent cinquième (105ème) »', 'serveur — **N1**'],
  'DERIVE.delai-garantie.doublet': ['l’ordinal « trentième (30ème) »', 'serveur — **N1 + N2**, `B05-GS-04 − B04-VO-01`'],
  'DERIVE.fin-validite-offre': ["fin de validité de l'offre", 'serveur — **N2**, `B04-LR-03 + B04-VO-01`'],
  'A1B.mention': ['« (non applicable) » quand le cadrage n’autorise pas le groupement, rien sinon', 'serveur — **N4**, cadrage `groupement`'],
};
const MARQUEURS = {
  '{{SI:A1B}}': 'ouvre la section des champs de A1-b : **omise** quand le cadrage n’autorise pas le groupement (N4)',
  '{{FINSI:A1B}}': 'referme cette section',
  '{{SI:A3B-NATURES}}': 'ouvre les lignes du second tableau de A3-b : **régénérées** avec les natures du marché (N4)',
  '{{FINSI:A3B-NATURES}}': 'referme ces lignes',
};
const STRUCTURE = {
  A1: [
    'A1-a, A1-c : le **cartouche** (nom, date, n° d’appel d’offres et titre, page x de y) est posé à droite, comme dans la source ; seul le n° et le titre sont pré-remplis.',
    'A1-b : titre conservé, mention sous le titre, champs entre `{{SI:A1B}}` et `{{FINSI:A1B}}` — c’est le comportement du 2463 (S3).',
    'A1-c : deux tableaux à quatre colonnes ; « Année » et « Fraction non exécutée du marché » tiennent une même ligne du PDF, séparés sans toucher au texte.',
    '**S6** — sept lignes des pages 23-25 sont précédées dans la source d’un glyphe d’une police de symboles (`U+F0F0`, une case à cocher ou une puce). La police n’étant pas identifiable, le glyphe n’est pas reproduit : la ligne commence au texte. **À arbitrer** : le remplacer par « ☐ », ou le laisser.',
  ],
  A2: [
    'A2-a : tableau à quatre colonnes, une ligne d’en-tête reprise mot pour mot ; **six lignes vides** en dessous — leur nombre est un choix de rendu, pas du texte.',
    '**E6** — la note de A2-b s’ouvre par « [Note : » et **ne se referme jamais**. Reproduite telle quelle.',
    '**E7** — la même note écrit « cette preuve **peut-être** apportée » (trait d’union) pour « peut être ». Reproduite telle quelle.',
  ],
  A3: [
    'A3-a : tableau à quatre colonnes ; « Information du bilan » et « Information des comptes de résultats » sont des lignes de sous-titre, comme la source les lit ; **trois** colonnes d’années, **fixes en V1** — aucun jeton ne porte leur nombre (R10).',
    'A3-b : deux tableaux. Le premier porte les **quatre** natures (Travaux, Fournitures, Services, Prestations intellectuelles), toujours. Le second porte les natures **du marché** — au 2463, Fournitures et Services — entre `{{SI:A3B-NATURES}}` et `{{FINSI:A3B-NATURES}}` (N4).',
    'A3-c : son titre tient sur deux lignes dans la source, recollées en un paragraphe.',
  ],
  A4: ['Tableau à deux colonnes, quatre lignes ; « Lieu d’exécution » et « Date de début : » tiennent une même ligne du PDF, séparés sans toucher au texte. L’appel de note « ¹ » du titre est reproduit sans note (S4).'],
  C1: [], C2: [],
};

const sortie = [];
for (const sigle of ['A1', 'A2', 'A3', 'A4', 'C1', 'C2']) {
  const d = JSON.parse(fs.readFileSync(`modeles/${sigle}.json`, 'utf8'));
  const source = d.pages.map(pageSource).join(' ');
  const corps = d.blocs.map((b) => b.texte).join('\n');
  sortie.push(`### ${sigle} — ${d.titre}\n`);
  sortie.push(`*Page${d.pages.length > 1 ? 's' : ''} **${d.pages.join(', ')}** du dossier 2463 · fidélité vérifiée au caractère près.*\n`);
  sortie.push('| # | ce que la source imprime | devient | ce que c’est | rempli par |');
  sortie.push('|---|---|---|---|---|');
  let n = 0;
  for (const s of d.trace) {
    const jetons = [...s.jeton.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
    const fois = compter(source, s.source);
    sortie.push(`| ${sigle}.${++n} | \`${s.source}\`${fois > 1 ? ` **(×${fois})**` : ''} | ${jetons.map((j) => `\`{{${j}}}\``).join(' ')} | ${jetons.map((j) => QUI[j]?.[0] ?? j).join(' + ')} | ${[...new Set(jetons.map((j) => QUI[j]?.[1] ?? '?'))].join(' + ')} |`);
  }
  for (const a of d.ajouts ?? []) sortie.push(`| ${sigle}.${++n} | *(rien)* | \`${a}\` | marqueur ajouté : ${MARQUEURS[a] ?? ''} | serveur |`);
  const crochets = [...new Set(corps.match(/\[[^\]{}]{4,}\]/g) ?? [])];
  for (const r of crochets) sortie.push(`| ${sigle}.${++n} | \`${r}\` | *inchangé* | ${r.startsWith('[Le formulaire') ? '**consigne tronquée (S5), pas un blanc**' : r.startsWith('[rappel') || r.startsWith('[Chaque') || r.startsWith('[Fournir') || r.startsWith('[Note') ? 'consigne au candidat' : 'blanc de l’offre'} | ${r.startsWith('[Le formulaire') ? '—' : 'candidat'} |`);
  const pointilles = (corps.match(/_{5,}/g) ?? []).length;
  if (pointilles) sortie.push(`| ${sigle}.${++n} | ${pointilles} pointillé(s) \`______\` | *inchangés* | blancs de l’offre | candidat |`);
  const intitules = d.blocs.filter((b) => b.type === 'para' && /:\s*$/.test(b.texte) && !b.texte.includes('{{')).length;
  if (intitules) sortie.push(`| ${sigle}.${++n} | ${intitules} intitulé(s) suivi(s) de « : » | *inchangés* | lignes à renseigner | candidat |`);
  if (STRUCTURE[sigle]?.length) {
    sortie.push('');
    for (const s of STRUCTURE[sigle]) sortie.push(`- ${s}`);
  }
  sortie.push('');
}
fs.writeFileSync('correspondance-six.md', sortie.join('\n'), 'utf8');
console.log('ok — correspondance-six.md, ' + sortie.length + ' lignes');
