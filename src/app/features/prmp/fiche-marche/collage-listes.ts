import { MaterielExige, PersonnelExige, PieceExigee, RubriquePiece } from '../../../models';

/**
 * ⚠️ 03/10 — « Coller une liste » (matériel, personnel, pièces) : la PRMP copie le passage de son DAO Word et le colle ;
 * ce module le découpe en entrées. Choix du pilote (recommandation du 03/10) : coller plutôt qu'importer — l'import d'un
 * DAO ne retrouve pas ces passages de façon fiable (le MTP n'est pas lu, le MEN réécrit sa clause 6.3 et range ses pièces
 * à l'inverse du document type). Rien ne part au serveur avant « Enregistrer » ; l'aperçu se vérifie avant l'ajout.
 *
 * Formes reconnues, celles des DAO réels :
 * - une entrée par ligne, ou séparées par « ; », « - », « • » ; un « 1° » ou « 2°- » de tête est ôté ;
 * - les nombres à la malgache des marchés : « Un (01) », « trois (03) » — le chiffre entre parenthèses fait foi
 *   (« deux (03) mois » du MEN vaut 3) ; à défaut, le mot ou le chiffre ;
 * - une note finale commune, après « — » (« — en propriété ou en location », « — chacun appuyé d'un CV… »), mise à part :
 *   pour le personnel, elle donne les justificatifs de chaque poste.
 */

export interface LectureListe<T> {
  entrees: T[];
  /** La note commune mise à part (après « — »), dite à la PRMP. */
  note: string | null;
}

const MOTS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12 };

/** Majuscule initiale. */
const capitale = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Blancs réduits, ponctuation de bord ôtée. */
const net = (s: string): string => s.replace(/\s+/g, ' ').replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, '').trim();

/** Met à part la note commune finale (après « — ») et découpe le reste en entrées. */
function decouper(texte: string): { morceaux: string[]; note: string | null } {
  let corps = texte.replace(/\r\n?/g, '\n');
  let note: string | null = null;
  const i = corps.lastIndexOf(' — ');
  if (i > 0) {
    note = net(corps.slice(i + 3));
    corps = corps.slice(0, i);
  }
  const morceaux = corps
    .split(/\n|\s;\s|;\s|\s[-–•]\s|^[-–•]\s/m)
    // Les tabulations d'une ligne de tableau copiée séparent ses cellules : elles sont gardées ici.
    .map((m) => m.replace(/^\s*\d+\s*°\s*[-–]?\s*/, '').replace(/[^\S\t]+/g, ' ').replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, ''))
    .filter(Boolean);
  return { morceaux, note: note || null };
}

/** « Un (01) bétonnière… » → [1, « bétonnière… »] ; sans nombre en tête : [null, texte]. */
function nombreEnTete(s: string): [number | null, string] {
  // « une » avant « un » : sinon « une (01) voiture » se lirait « un » suivi de « e (01) voiture ».
  const m = /^(?:(une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|\d+)\b\s*)?(?:\((\d+)\)\s*)?/i.exec(s);
  if (!m || (!m[1] && !m[2])) return [null, s];
  const n = m[2] ? Number(m[2]) : /^\d+$/.test(m[1]) ? Number(m[1]) : (MOTS[m[1].toLowerCase()] ?? null);
  return [n, s.slice(m[0].length)];
}

/** Un nombre dans le corps du texte : « trois (03) » → 3 (le chiffre entre parenthèses fait foi), « 03 » → 3, « trois » → 3. */
function nombreDans(mot: string | undefined, entreParentheses: string | undefined, chiffres: string | undefined): number | null {
  if (entreParentheses) return Number(entreParentheses);
  if (chiffres) return Number(chiffres);
  return mot ? (MOTS[mot.toLowerCase()] ?? null) : null;
}

// ── Matériel ─────────────────────────────────────────────────────────────────────────────────

/**
 * « Un (01) bétonnière de 350 litres minimum » · « Camions bennes ≥ 10 000 kg⇥6⇥au moins 4 en propre » (une ligne de
 * tableau copiée : désignation, nombre, statut).
 */
export function lireMateriel(texte: string): LectureListe<MaterielExige> {
  const { morceaux, note } = decouper(texte);
  const entrees = morceaux.map((m): MaterielExige => {
    let nombre: number | null;
    let reste: string;
    let statut = '';
    const cellules = m.split('\t').map((c) => c.trim()).filter(Boolean);
    if (cellules.length >= 2 && /^\d+$/.test(cellules[1])) {
      reste = cellules[0];
      nombre = Number(cellules[1]);
      statut = cellules.slice(2).join(' ');
    } else {
      [nombre, reste] = nombreEnTete(m);
    }
    nombre ??= 1;
    const toutLeTexte = `${reste} ${statut}`;
    const auMoins = /(?:dont\s+)?au\s+moins\s+(\d+)\s+en\s+propre/i.exec(toutLeTexte);
    const minimumEnPropre = auMoins ? Number(auMoins[1]) : /\ben\s+propre\b/i.test(toutLeTexte) ? nombre : null;
    reste = net(reste.replace(/,?\s*(?:dont\s+)?(?:au\s+moins\s+\d+\s+)?en\s+propre/i, ''));
    const i = reste.indexOf('≥');
    const designation = capitale(net(i > 0 ? reste.slice(0, i) : reste));
    const caracteristique = i > 0 ? net(reste.slice(i)) : null;
    return { designation, caracteristique, nombre, minimumEnPropre, parLot: false };
  });
  return { entrees, note };
}

// ── Personnel ────────────────────────────────────────────────────────────────────────────────

/**
 * « Un (01) conducteur de travaux ayant un diplôme d'ingénieur en BTP ou équivalent (…), au moins trois (03) ans
 * d'expérience dans la réalisation de travaux de BTP ». La note « — chacun appuyé d'un CV avec photo et d'un diplôme
 * certifié » donne les justificatifs de chaque poste.
 */
export function lirePersonnel(texte: string): LectureListe<PersonnelExige> {
  const { morceaux, note } = decouper(texte);
  const appui = note ? /appuy[ée]+s?\s+d['’]une?\s+(.+)$/i.exec(note) : null;
  const justificatifs = appui ? net(appui[1].replace(/\s+et\s+d['’]une?\s+/gi, ' et ')) : null;
  const entrees = morceaux.map((m): PersonnelExige => {
    const [n, reste] = nombreEnTete(m);
    const poste = capitale(net(reste.split(/\s+ayant\s+|\s+titulaire\s+|,|\s:\s/i)[0]));
    const dip = /dipl[ôo]me\s+(?:d['’]|de\s+)(.+?)(?:,\s*(?:au\s+moins|avec|justifiant)|$)/i.exec(reste);
    const ans = /(?:au\s+moins\s+)?(?:(\w+)\s*)?(?:\((\d+)\)|(\d+))?\s*ans?\s+d['’]exp[ée]rience/i.exec(reste);
    const experienceAnnees = ans ? nombreDans(ans[1], ans[2], ans[3]) : null;
    const dom = /d['’]exp[ée]rience\s+(?:dans\s+(?:la\s+r[ée]alisation\s+de\s+)?|en\s+)(.+?)(?:[,;]|$)/i.exec(reste);
    return {
      poste,
      nombre: n ?? 1,
      diplome: dip ? capitale(net(dip[1])) : null,
      experienceAnnees,
      domaineExperience: dom ? net(dom[1]) : null,
      justificatifs,
      parLot: false,
    };
  });
  return { entrees, note };
}

// ── Pièces ───────────────────────────────────────────────────────────────────────────────────

// ⚠️ « photocopie » d'abord, et « copie » seulement hors de ce mot : sinon « Photocopie certifiée conforme… » (dossier
// 2463) se lisait « copie certifiée… » et laissait « Photo » dans le libellé (recette du 03/10, fiche 33).
const FORMES: [RegExp, string][] = [
  [/photocopie\s+certifi[ée]e\s+conforme\s+[àa]\s+l['’]original/i, 'photocopie certifiée conforme à l’original'],
  [/(?<!photo)copie\s+certifi[ée]e\s+conforme\s+[àa]\s+l['’]original/i, 'copie certifiée conforme à l’original'],
  [/photocopie\s+certifi[ée]e/i, 'photocopie certifiée'],
  [/copie\s+l[ée]galis[ée]e(?:\s+par\s+[^,;()]+)?/i, ''],
  [/\(\s*original(?:e)?\s*\)|\boriginal(?:e)?\b/i, 'original'],
];

/**
 * « Copie certifiée conforme à l'original de la Carte d'immatriculation fiscale de l'année 2026 datée de moins de trois
 * (03) mois » · « Un certificat de non faillite daté de moins de 03 mois (original) » · « 01 : Carte professionnelle ».
 * La rubrique est celle où la PRMP colle : le MEN range ses pièces administratives au 1°, l'écran ne devine pas.
 */
export function lirePieces(texte: string, rubrique: RubriquePiece): LectureListe<PieceExigee> {
  const { morceaux, note } = decouper(texte);
  const entrees = morceaux.map((m): PieceExigee => {
    let reste = m;
    const num = /^(\d{1,2}(?:-[a-z])?|\d-[a-z])\s*[:.)–-]\s+/i.exec(reste);
    const numero = num ? num[1] : null;
    if (num) reste = reste.slice(num[0].length);
    const anc = /,?\s*dat[ée]+e?s?\s+de\s+moins\s+de\s+(?:(\w+)\s*)?(?:\((\d+)\)|(\d+))?\s*mois/i.exec(reste);
    const ancienneteMaxMois = anc ? nombreDans(/^\d+$/.test(anc[1] ?? '') ? undefined : anc[1], anc[2], anc[3] ?? (/^\d+$/.test(anc[1] ?? '') ? anc[1] : undefined)) : null;
    if (anc) reste = reste.replace(anc[0], ' ');
    let forme: string | null = null;
    for (const [re, libelle] of FORMES) {
      const f = re.exec(reste);
      if (f) {
        forme = libelle || net(f[0]).toLowerCase();
        reste = reste.replace(f[0], ' ');
        break;
      }
    }
    // Ce que la forme laisse en tête (« de la Carte… », « Un certificat… ») n'appartient pas au libellé.
    const libelle = capitale(net(net(reste).replace(/^(?:de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|une?\s+)/i, '')));
    return { rubrique, numero, libelle, forme, ancienneteMaxMois, parLot: false, modele: null };
  });
  return { entrees, note };
}
