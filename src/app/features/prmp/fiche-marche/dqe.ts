import { ArticleFiche } from '../../../models';

/**
 * ⚠️ DQE des travaux (chantier b, lot 1 — arbitrage du pilote du 02/10, Q2) : la PRMP a son détail quantitatif
 * dans un tableur. Plutôt qu'un import de fichier (retiré du plan de passation à dessein), elle **colle** les lignes
 * copiées : Excel les livre séparées par des retours à la ligne, cellules séparées par des tabulations. Ce module les
 * lit ; rien ne part au serveur avant « Enregistrer ».
 *
 * Formes reconnues, celles des deux DAO réels :
 * - **article** : `n° | désignation | unité | quantité` (les colonnes suivantes — prix, montant — sont ignorées) ;
 * - **intertitre de série** : un n° et un libellé sans unité ni quantité (« 500 | OUVRAGES »), ou une cellule seule
 *   (« SERIE 600 : CHAUSSEES ») ; il s'applique aux articles qui suivent ;
 * - **en-tête, totaux** (« N° | Désignation… », « Sous-total série 500 », « TOTAL HT ») : écartés, et dits.
 * Sans intertitre, la série se déduit du n° de prix pointé (« 2.4 » → « 2 », comme au DQE du MEN).
 */

/** Un article lu dans le collage, prêt à rejoindre la grille. */
export type ArticleColle = Pick<ArticleFiche, 'numeroPrix' | 'designation' | 'unite' | 'quantite' | 'serie' | 'serieLibelle' | 'libelleBordereau'>;

export interface LigneEcartee {
  /** Rang de la ligne dans le collage, à partir de 1. */
  rang: number;
  texte: string;
  raison: string;
}

export interface LectureCollage {
  articles: ArticleColle[];
  ecartees: LigneEcartee[];
}

const TOTAL = /^(sous[-\s]?total|total|r[ée]capitulation|montant|tva|net à payer)\b/i;
const ENTETE = /^(n[°º]|no\.?$|num[ée]ro|prix\s*n[°º])/i;
const SERIE_SEULE = /^(?:s[ée]rie|chapitre|section)?\s*([0-9A-Z][0-9A-Z.]*)\s*[-–:.]?\s+(.+)$/i;

/**
 * Un nombre écrit à la française ou à l'anglaise : « 2 054,50 », « 2054.5 », « 48 240,00 », « 1.516,44 ».
 * `null` s'il n'est pas lisible — la ligne est alors écartée plutôt que remplie d'une quantité fausse.
 */
export function lireNombre(brut: string): number | null {
  let s = brut.replace(/[\s\u00a0\u202f]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** « m3 » → « m³ » : la saisie au clavier ne connaît pas l'exposant ; le reste est gardé tel quel. */
export function normaliserUnite(u: string): string {
  return u.trim().replace(/^m3$/i, 'm³').replace(/^m2$/i, 'm²');
}

const BORDEREAU: Record<string, string> = {
  'm³': 'Le mètre cube',
  'm²': 'Le mètre carré',
  ml: 'Le mètre linéaire',
  m: 'Le mètre',
  km: 'Le kilomètre',
  kg: 'Le kilogramme',
  t: 'La tonne',
  l: 'Le litre',
  u: "L'unité",
  fft: 'Le forfait',
  ff: 'Le forfait',
  forfait: 'Le forfait',
  ens: "L'ensemble",
};

/**
 * Le libellé du bordereau des prix unitaires que l'unité appelle (« Le mètre cube à : …… Ariary »). Une
 * **proposition** : la PRMP le corrige — le DAO du MTP écrit « Le mètre carré » pour un prix en m³, et la fiche
 * imprime ce qu'elle a validé, pas ce que l'écran a deviné.
 */
export function libelleBordereauPropose(unite: string | null | undefined): string | null {
  return BORDEREAU[normaliserUnite(unite ?? '').toLowerCase()] ?? BORDEREAU[normaliserUnite(unite ?? '')] ?? null;
}

/** La série qu'un n° de prix pointé porte (« 2.4 » → « 2 ») ; rien pour un n° sans point (« 529 »). */
export function serieDuNumero(numero: string | null | undefined): string | null {
  const m = /^([^.]+)\.[^.]+$/.exec((numero ?? '').trim());
  return m ? m[1] : null;
}

/** Lit des lignes collées depuis un tableur. */
export function lireCollage(texte: string): LectureCollage {
  const articles: ArticleColle[] = [];
  const ecartees: LigneEcartee[] = [];
  let serie: { code: string; libelle: string } | null = null;

  for (const [i, ligne] of texte.split(/\r?\n/).entries()) {
    const cellules = ligne.split('\t').map((c) => c.trim());
    const pleines = cellules.filter(Boolean);
    if (!pleines.length) continue;
    const ecarter = (raison: string) => ecartees.push({ rang: i + 1, texte: pleines.join(' · '), raison });

    // L'en-tête d'abord : sa colonne « Montant » passerait sinon pour une ligne de total.
    if (ENTETE.test(pleines[0]) || pleines.some((c) => /^d[ée]signation$/i.test(c))) {
      ecarter('en-tête de colonnes');
      continue;
    }
    if (pleines.some((c) => TOTAL.test(c))) {
      ecarter('ligne de total');
      continue;
    }

    // Une cellule seule : un intertitre de série (« SERIE 600 : CHAUSSEES »), ou rien d'exploitable.
    if (pleines.length === 1) {
      const m = SERIE_SEULE.exec(pleines[0]);
      if (m && /\d/.test(m[1])) serie = { code: m[1].replace(/\.$/, ''), libelle: m[2].trim() };
      else ecarter('ni article ni série');
      continue;
    }

    const [numero, designation, unite, quantite] = cellules;
    // Un n° et un libellé, sans unité ni quantité : l'intertitre d'une série (« 500 | OUVRAGES »).
    if (numero && designation && !unite && !quantite) {
      serie = { code: numero.replace(/\.$/, ''), libelle: designation };
      continue;
    }
    const q = lireNombre(quantite ?? '');
    if (!designation) ecarter('désignation absente');
    else if (!unite) ecarter('unité absente');
    else if (q == null || q < 0) ecarter(`quantité illisible (« ${quantite ?? ''} »)`);
    else {
      const u = normaliserUnite(unite);
      articles.push({
        numeroPrix: numero || null,
        designation,
        unite: u,
        quantite: q,
        serie: serie?.code ?? serieDuNumero(numero),
        serieLibelle: serie?.libelle ?? null,
        libelleBordereau: libelleBordereauPropose(u),
      });
    }
  }
  return { articles, ecartees };
}

/** Une série du DQE, telle que la grille l'affiche en intertitre : son code, son libellé, ses articles. */
export interface SerieDqe<T> {
  code: string | null;
  libelle: string | null;
  articles: T[];
}

/**
 * Regroupe des articles par série, **dans l'ordre de leur première apparition** — l'ordre de saisie fait foi, comme
 * au bordereau. Le libellé d'une série est le premier non vide qu'un de ses articles porte.
 */
export function grouperParSerie<T extends Pick<ArticleFiche, 'serie' | 'serieLibelle'>>(articles: T[]): SerieDqe<T>[] {
  const series: SerieDqe<T>[] = [];
  for (const a of articles) {
    const code = a.serie?.trim() || null;
    let s = series.find((x) => x.code === code);
    if (!s) series.push((s = { code, libelle: null, articles: [] }));
    s.articles.push(a);
    if (!s.libelle && a.serieLibelle?.trim()) s.libelle = a.serieLibelle.trim();
  }
  return series;
}

/** Les n° de prix répétés dans un lot (400 du serveur, B1.2) — signalés avant l'envoi. */
export function numerosEnDouble(articles: Pick<ArticleFiche, 'numeroPrix'>[]): Set<string> {
  const vus = new Set<string>();
  const doubles = new Set<string>();
  for (const a of articles) {
    const n = a.numeroPrix?.trim();
    if (!n) continue;
    if (vus.has(n)) doubles.add(n);
    vus.add(n);
  }
  return doubles;
}
