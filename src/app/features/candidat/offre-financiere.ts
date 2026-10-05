import { FormulairesOffre, TotauxOffre } from '../../core/securite/scellement';
import { ArticleBesoin, CategorieDao, FormulaireOffre, LotBesoin } from '../../models';

/**
 * L'**offre financière saisie en ligne** (lot 5a, `demande-backend-2026-10-05-formulaires-en-ligne`) : des calculs purs, partagés
 * par le formulaire et le dépôt. Le serveur recalcule tout à l'ouverture et signale les écarts ; ici, on calcule pour que le
 * candidat voie ce qu'il scelle, et pour dériver les montants de l'acte d'engagement.
 */

/** Ce que le candidat a saisi, par `idArticle` (les articles des autres lots y restent sans être scellés). */
export interface SaisieOffre {
  prix: Record<number, number | null>;
  dates: Record<number, string>;
  conformite: Record<number, ConformiteSaisie>;
}

export interface ConformiteSaisie {
  marque: string;
  modele: string;
  caracteristiques: Record<number, { proposee: string; conforme: boolean | null }>;
}

export function saisieVide(): SaisieOffre {
  return { prix: {}, dates: {}, conformite: {} };
}

/**
 * Les formulaires que le front **livre** : lot 5a (bordereau, conformité, calendrier ; DQE) et lot 5b aux travaux (K1, sous-détail,
 * capacités, personnel, matériel). Une pièce marquée d'un autre formulaire (le calendrier des travaux) reste à joindre.
 */
export function formulairesLivres(categorie: CategorieDao | null): ReadonlySet<FormulaireOffre> {
  if (categorie === 'TRAVAUX') return new Set<FormulaireOffre>(['BORDEREAU', 'DQE', 'K1', 'SOUS_DETAIL', 'CAPACITES', 'PERSONNEL', 'MATERIEL']);
  if (categorie === 'FOURNITURES_SERVICES') return new Set<FormulaireOffre>(['BORDEREAU', 'CONFORMITE', 'CALENDRIER']);
  return new Set();
}

export const estTravaux = (categorie: CategorieDao | null): boolean => categorie === 'TRAVAUX';

/** Marché à commande : quantités minimum et maximum ; sinon la quantité seule (quantité fixe, contrat-cadre — H2). */
export function aCommande(lot: LotBesoin): boolean {
  return lot.articles.some((a) => a.quantiteMax != null);
}

/** La quantité qui fait le montant de l'acte d'engagement (le maximum à commande — H1) et le minimum, s'il y en a un. */
export function quantites(a: ArticleBesoin): { q: number; min: number | null } {
  if (a.quantiteMax != null) return { q: a.quantiteMax, min: a.quantiteMin ?? a.quantiteMax };
  return { q: a.quantite ?? 0, min: null };
}

export function montantLigne(a: ArticleBesoin, prix: number | null | undefined): number | null {
  return prix == null ? null : Math.round(prix * quantites(a).q);
}

/** Les totaux de l'offre, au maximum des quantités ; au minimum aussi pour un marché à commande ; par série aux travaux. */
export function calculerTotaux(lot: LotBesoin, saisie: SaisieOffre, tauxTva: number, travaux: boolean): TotauxOffre {
  let ht = 0;
  let htMin = 0;
  const series = new Map<string, number>();
  for (const a of lot.articles) {
    const pu = saisie.prix[a.idArticle] ?? 0;
    const { q, min } = quantites(a);
    const m = Math.round(pu * q);
    ht += m;
    if (min != null) htMin += Math.round(pu * min);
    if (travaux) series.set(a.serie ?? '', (series.get(a.serie ?? '') ?? 0) + m);
  }
  const ttc = (x: number) => x + Math.round((x * tauxTva) / 100);
  const commande = aCommande(lot);
  return {
    ht,
    tva: ttc(ht) - ht,
    ttc: ttc(ht),
    htMin: commande ? htMin : null,
    ttcMin: commande ? ttc(htMin) : null,
    parSerie: travaux ? [...series].map(([serie, h]) => ({ serie, ht: h })) : null,
  };
}

/** Les articles sans prix : le seul manque qui bloque le dépôt (un prix vide ne se lit pas en séance). */
export function prixManquants(lot: LotBesoin, saisie: SaisieOffre): ArticleBesoin[] {
  return lot.articles.filter((a) => !(saisie.prix[a.idArticle]! > 0));
}

/**
 * Ce que la séance signalerait, dit **avant** le dépôt : des avertissements, jamais des refus — la commission décide. Mêmes
 * règles que les alertes du serveur (B3), sauf le délai, compté ici depuis la date limite faute de date d'ouverture.
 */
export function avertissements(lot: LotBesoin, saisie: SaisieOffre, categorie: CategorieDao | null, dateLimite: string | null, totaux: TotauxOffre): string[] {
  const m: string[] = [];
  if (estTravaux(categorie)) {
    for (const a of lot.articles) {
      const ligne = montantLigne(a, saisie.prix[a.idArticle]);
      if (a.plafond != null && ligne != null && totaux.ht > 0 && (ligne / totaux.ht) * 100 > a.plafond) {
        m.push(`Prix ${a.numeroPrix ?? ''} « ${a.designation} » : ${formaterPourcent((ligne / totaux.ht) * 100)} du montant des travaux, au-delà du plafond de ${a.plafond} %.`);
      }
    }
    return m;
  }
  if (categorie !== 'FOURNITURES_SERVICES') return m;
  const sansDate = lot.articles.filter((a) => !saisie.dates[a.idArticle]);
  if (sansDate.length) m.push(`${sansDate.length} date(s) de livraison à saisir.`);
  const delai = lot.delaiExecution?.valeur;
  if (delai && dateLimite) {
    const borne = new Date(dateLimite.slice(0, 10) + 'T00:00:00');
    borne.setDate(borne.getDate() + delai);
    const tardifs = lot.articles.filter((a) => saisie.dates[a.idArticle] && new Date(saisie.dates[a.idArticle] + 'T00:00:00') > borne);
    if (tardifs.length) m.push(`${tardifs.length} date(s) de livraison au-delà du délai de ${delai} jours fixé par le dossier.`);
  }
  let aRemplir = 0;
  let nonConformes = 0;
  for (const a of lot.articles) {
    const c = saisie.conformite[a.idArticle];
    if (!c?.marque.trim() || !c.modele.trim()) aRemplir++;
    for (const k of a.caracteristiques) {
      const v = c?.caracteristiques[k.idCaracteristique ?? -1];
      if (!v?.proposee.trim() || v.conforme == null) aRemplir++;
      else if (v.conforme === false) nonConformes++;
    }
  }
  if (aRemplir) m.push(`Conformité technique : ${aRemplir} réponse(s) à compléter (marque, modèle, caractéristique proposée, conforme ou non).`);
  if (nonConformes) m.push(`${nonConformes} caractéristique(s) déclarée(s) non conforme(s) : la commission le lira.`);
  return m;
}

/** Les formulaires scellés pour le lot choisi — format 3 du manifeste. */
export function construireFormulaires(lot: LotBesoin, saisie: SaisieOffre, categorie: CategorieDao | null, tauxTva: number): FormulairesOffre {
  const travaux = estTravaux(categorie);
  return {
    bordereau: lot.articles.map((a) => {
      const pu = saisie.prix[a.idArticle] ?? 0;
      return { idArticle: a.idArticle, prixUnitaireHt: pu, prixEnLettres: enLettres(pu), ...(travaux ? {} : { dateLivraison: saisie.dates[a.idArticle] || null }) };
    }),
    conformite: travaux
      ? null
      : lot.articles.map((a) => {
          const c = saisie.conformite[a.idArticle];
          return {
            idArticle: a.idArticle,
            marque: c?.marque.trim() ?? '',
            modele: c?.modele.trim() ?? '',
            caracteristiques: a.caracteristiques.map((k) => {
              const v = c?.caracteristiques[k.idCaracteristique ?? -1];
              return { idCaracteristique: k.idCaracteristique!, proposee: v?.proposee.trim() ?? '', conforme: v?.conforme ?? null };
            }),
          };
        }),
    totaux: calculerTotaux(lot, saisie, tauxTva, travaux),
  };
}

function formaterPourcent(x: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(x)} %`;
}

// ── Les nombres en toutes lettres ─────────────────────────────────────────────────────────────────────────────

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function moinsDeCent(n: number, finale: boolean): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) return DIZAINES[d] + (d === 7 && u === 1 ? ' et ' : '-') + UNITES[10 + u];
  if (u === 0) return DIZAINES[d] + (d === 8 && finale ? 's' : '');
  return DIZAINES[d] + (u === 1 && d !== 8 ? ' et un' : '-' + UNITES[u]);
}

function moinsDeMille(n: number, finale: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let t = c === 0 ? '' : c === 1 ? 'cent' : UNITES[c] + ' cent' + (r === 0 && finale ? 's' : '');
  if (r) t += (t ? ' ' : '') + moinsDeCent(r, finale);
  return t;
}

/**
 * Un entier en toutes lettres, **orthographe traditionnelle** (reprise de la maquette routière) : « vingt et un »,
 * « quatre-vingts » et « deux cents » en fin de nombre ou devant million et milliard, qui sont des noms ; « quatre-vingt mille »,
 * « deux cent mille » (mille est invariable). Aux travaux, **ce sont les lettres qui font foi** ; le serveur les relit (B2.1).
 */
export function enLettres(valeur: number): string {
  let n = Math.round(valeur);
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  for (const [val, sing, plur] of [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions']] as const) {
    const q = Math.floor(n / val);
    n %= val;
    if (q) parts.push(moinsDeMille(q, true) + ' ' + (q > 1 ? plur : sing));
  }
  const m = Math.floor(n / 1000);
  n %= 1000;
  if (m) parts.push(m === 1 ? 'mille' : moinsDeMille(m, false) + ' mille');
  if (n) parts.push(moinsDeMille(n, true));
  return parts.join(' ');
}
