// Lecture PAR CLAUSE (option A de la note de décision du 03/10, retenue par le pilote) — premier temps.
//
// La lecture par le modèle (lire.mjs, règles 1 à 9) reste la source sûre, et la seule à donner la confiance haute. Cette
// passe la COMPLÈTE quand un DAO s'écarte du document type (DPAO du MTP lu à 5 %, clause 6.3 du MEN réécrite) :
// - elle ne cherche que dans la SECTION des données particulières, repérée par la phrase d'introduction du document type
//   (« Les données particulières ci-après complètent… »), à défaut par un titre numéroté — sinon les Instructions aux
//   candidats, qui parlent des mêmes choses en général, prennent la place (essai du 03/10 : 4/14 au lieu de 12/14) ;
// - chaque information du CATALOGUE se repère par les mots de sa clause, et sa valeur par sa FORME (une durée, un montant)
//   dans les quelques paragraphes qui suivent ;
// - ses propositions sont toujours en confiance MOYENNE, source « clause », et seulement pour les champs que la lecture
//   par le modèle n'a pas trouvés ;
// - pour les LISTES (matériel, personnel, pièces), elle ne découpe rien : elle repère le PASSAGE, que l'écran propose dans
//   la fenêtre « Coller une liste ». Découper sans comprendre se trompait (essai : 1 liste juste sur 6).

/** La section des données particulières : ses paragraphes, et l'indice où elle commence dans le document. */
export function sectionDonneesParticulieres(doc, longueur = 700) {
  let debut = doc.findIndex((p) => /donn[ée]es particuli[èe]res ci-apr[èe]s compl[èe]tent/i.test(p));
  if (debut < 0) debut = doc.findIndex((p) => /^\d+\.\d+\.?\s*-\s*donn[ée]es particuli[èe]res/i.test(p));
  if (debut < 0) return null;
  return { debut, paragraphes: doc.slice(debut, debut + longueur) };
}

// Devant le nombre entre parenthèses, seulement des MOTS DE NOMBRE (« CENT VINGT (120) », « Six (06) ») : sinon la valeur
// emportait « le délai de Six (06) mois ».
const MOTS_NOMBRE = '(?:(?:un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|cents|mille|et)[\\s-]+)*';
// Second temps (03/10) : « soixante-quinze (75j)jours » (2463) — l'abréviation « j » dans la parenthèse est admise.
const DUREE = new RegExp(`\\b${MOTS_NOMBRE}(?:\\(\\s*\\d+\\s*j?\\s*\\)|\\d+)\\s*(?:jours?|mois)\\b`, 'i');
const MONTANT = /\d{1,3}(?:[\s.]\d{3})+(?:,\d+)?|\d{6,}/;
const POURCENT = /\d+(?:[.,]\d+)?\s*%/;

/**
 * Le catalogue du premier temps : 5 informations simples, par catégorie (le code du champ diffère). `ancre` repère la
 * clause, `forme` la valeur ; `n` paragraphes suivants sont fouillés. Un catalogue court et mesuré : il ne s'étend que si
 * la mesure tient (note de décision, §4).
 */
export const CATALOGUE = [
  // Second temps : « délai de validité DE L'OFFRE » (2463) ; la garantie du MEN a ses montants 4 paragraphes après
  // l'ancre (les formes admises s'intercalent), d'où une fenêtre de 4.
  { info: 'validite', codes: { TRAVAUX: 'B04-VO-01', FOURNITURES_SERVICES: 'B04-VO-01' }, ancre: /validit[ée] (?:des offres|de l['’]offre)/i, forme: DUREE },
  { info: 'garantie', codes: { TRAVAUX: 'B05-GQ-03', FOURNITURES_SERVICES: 'B05-GS-03' }, ancre: /garantie de soumission/i, forme: MONTANT, n: 4 },
  { info: 'delai', codes: { TRAVAUX: 'B09-DL-01' }, ancre: /d[ée]lai d['’]ex[ée]cution/i, forme: DUREE },
  { info: 'liquidite', codes: { TRAVAUX: 'B03-QT-14' }, codesPourcent: { TRAVAUX: 'B03-QT-15' }, ancre: /liquidit[ée]|ligne de cr[ée]dit/i, forme: new RegExp(`${POURCENT.source}|${MONTANT.source}`), n: 2 },
  { info: 'lieu', codes: { TRAVAUX: 'B04-OV-01', FOURNITURES_SERVICES: 'B04-OP-01' }, ancre: /ouverture des plis/i, forme: /(?:Lieu|Bureau)\s*:\s*([^.;]{6,80})/i, groupe: 1 },
];

/** Les passages de listes à proposer dans « Coller une liste » (travaux : clauses 6.2 et 6.3 du DPAO). */
export const PASSAGES = [
  { liste: 'MATERIEL', categories: ['TRAVAUX'], ancre: /(?:gros )?mat[ée]riels?[^:]{0,80}:/i, fin: /^\(?[d-f]\)|personnel|directeur de travaux/i },
  // Second temps : « listes des personnels répondant aux critères suivants : » (MEN), « le personnel ci-après (CV…) : »
  // (MTP) ; la note « NB : » qui suit le MTP ferme le passage.
  { liste: 'PERSONNEL', categories: ['TRAVAUX'], ancre: /personnels? (?:cl[ée]|par lot|minimum|suivant|ci-apr[èe]s|r[ée]pondant aux crit[èe]res)[^:]{0,120}:/i, fin: /^\(?[d-g]\)|liquidit|r[ée]f[ée]rence|^NB\b/i },
  { liste: 'PIECES', categories: ['TRAVAUX', 'FOURNITURES_SERVICES'], ancre: /documents ou pi[èe]ces [àa] remettre en sus[^:]*:/i, fin: /^6\.3|capacit[ée]s|^4\s*°|^\d+\.\d+\.?\s/i },
];

/** Les montants « par lot » d'une même clause : « 9 900 000 Ar (lot 1) / 7 200 000 Ar (lot 2) », « Lot n° 2 : … ». */
function parLot(texte) {
  // « Lot n° 2 : 2 170 000 » d'abord : le lot PRÉCÈDE son montant. La forme « 9 900 000 Ar (lot 1) », où il le suit, ne
  // sert qu'à défaut — tentée en premier, elle appariait un montant au « Lot » de la ligne suivante (2463 : tout décalé).
  const lots = [];
  // Le montant peut suivre un long « en lettres » : « Lot n° 1 : UN MILLION SIX CENT MILLE ARIARY (Ar 1 600 000) » (2463).
  for (const m of texte.matchAll(/lot\s*(?:n\s*°\s*)?(\d+)\s*:\s*[^\d]{0,120}?(\d{1,3}(?:[\s.]\d{3})+|\d{6,})/gi)) lots.push({ lot: Number(m[1]), brut: m[2] });
  if (lots.length < 2) {
    lots.length = 0;
    // « (Ar 99 000 000) pour le lot n°1 » (MEN) ou « 9 900 000 Ar (lot 1) ».
    for (const m of texte.matchAll(/(\d{1,3}(?:[\s.]\d{3})+|\d{6,})[^/;\n\d]{0,25}?(?:\(\s*|pour\s+le\s+)lot\s*(?:n\s*°\s*)?0*(\d+)/gi)) lots.push({ lot: Number(m[2]), brut: m[1] });
  }
  const vus = new Map();
  for (const l of lots) if (!vus.has(l.lot)) vus.set(l.lot, l);
  return vus.size >= 2 ? [...vus.values()].sort((a, b) => a.lot - b.lot) : [];
}

/**
 * La passe par clause sur un document (ses paragraphes normalisés). `dejaTrouves` : les codes (nus) que la lecture par
 * le modèle a déjà proposés — la passe ne les remplace jamais. Rend des propositions brutes, à convertir par l'appelant
 * (`valeurSaisie`), et des passages de listes.
 */
export function lireParClause(doc, categorie, dejaTrouves = new Set()) {
  const section = sectionDonneesParticulieres(doc);
  if (!section) return { propositions: [], passages: [], section: null };
  const ps = section.paragraphes;
  const propositions = [];
  for (const c of CATALOGUE) {
    const code = c.codes[categorie];
    if (!code || dejaTrouves.has(code) || (c.codesPourcent?.[categorie] && dejaTrouves.has(c.codesPourcent[categorie]))) continue;
    trouve: for (let i = 0; i < ps.length; i++) {
      if (!c.ancre.test(ps[i])) continue;
      for (let k = i; k <= Math.min(ps.length - 1, i + (c.n ?? 3)); k++) {
        const texte = k === i ? ps[k].slice(ps[k].search(c.ancre)) : ps[k];
        const m = c.forme.exec(texte);
        if (!m) continue;
        const paragraphe = section.debut + k;
        const lots = c.info === 'garantie' || c.info === 'liquidite' ? parLot(ps.slice(i, i + (c.n ?? 3) + 1).join(' ')) : [];
        if (lots.length) {
          for (const l of lots) propositions.push({ code: `${code}#${l.lot}`, brut: l.brut, paragraphe, info: c.info });
        } else if (/%/.test(m[0]) && c.codesPourcent?.[categorie]) {
          propositions.push({ code: c.codesPourcent[categorie], brut: m[0], paragraphe, info: c.info });
        } else {
          propositions.push({ code, brut: (c.groupe ? m[c.groupe] : m[0]).trim(), paragraphe, info: c.info });
        }
        break trouve;
      }
    }
  }
  const passages = [];
  for (const p of PASSAGES) {
    if (!p.categories.includes(categorie)) continue;
    const i = ps.findIndex((x) => p.ancre.test(x));
    if (i < 0) continue;
    let texte = ps[i].slice(ps[i].search(p.ancre)).replace(p.ancre, '').trim();
    for (let k = i + 1; k < Math.min(ps.length, i + 25) && !p.fin.test(ps[k]); k++) texte += '\n' + ps[k];
    const coupe = p.fin.exec(texte);
    if (coupe && coupe.index > 0) texte = texte.slice(0, coupe.index);
    texte = texte.trim();
    if (texte.length >= 10) passages.push({ liste: p.liste, texte, paragraphe: section.debut + i });
  }
  return { propositions, passages, section: section.debut };
}
