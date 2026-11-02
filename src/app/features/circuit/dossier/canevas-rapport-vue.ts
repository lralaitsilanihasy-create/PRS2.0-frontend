import { CanevasRapport, CanevasSection } from '../../../models';

/**
 * ⚠️ 02/11 (pilote, maquette « Canevas de rapport », variante A) — la mise en forme du canevas pour l'écran en deux volets.
 * Deux doublons du canevas servi sont levés ici, sans rien retrancher :
 * - quand chaque rangée de la grille porte le libellé d'une ligne de la section (vérification de la qualification), l'exigence du
 *   DAO entre DANS la grille (Critère · Exigé par le DAO · Constat · Cote) au lieu d'être listée au-dessus ;
 * - quand toutes les rangées s'écrivent « Article — Caractéristique : exigence » (conformité pour l'essentiel), elles se rangent
 *   sous leur article, et la ligne qui ne fait que lister ces mêmes articles s'efface.
 */
export interface CritereFusionne { critere: string; exige: string }
export interface ArticleConformite { article: string; caracteristiques: { caracteristique: string; exigee: string }[] }

export interface SectionCanevasVue {
  code: string;
  numero: string;
  nom: string;
  partie: CanevasSection['partie'];
  /** Ce que contient la partie, pour le sommaire (« 15 critères à coter »). */
  quantite: string;
  /** Les informations du DAO qui restent en liste (repères). */
  reperes: CanevasSection['lignes'];
  /** La grille où l'exigence est fusionnée, sinon null. */
  criteres: CritereFusionne[] | null;
  /** La grille rangée par article, sinon null. */
  articles: ArticleConformite[] | null;
  /** La grille telle que servie (ni fusionnée ni rangée), sinon null. */
  tableau: CanevasSection['tableau'];
  colonnes: string[];
}

const ARTICLE = /^(.+?) — (.+?) : ([\s\S]+)$/;

export function vueCanevas(c: CanevasRapport | null): SectionCanevasVue[] {
  return (c?.sections ?? []).map((s) => vueSection(s));
}

export function vueSection(s: CanevasSection): SectionCanevasVue {
  const m = /^(\d+)\.\s*(.*)$/.exec(s.titre);
  const base = { code: s.code, numero: m?.[1] ?? '', nom: m?.[2] ?? s.titre, partie: s.partie, colonnes: s.tableau?.colonnes ?? [] };
  const t = s.tableau;
  const parLibelle = new Map(s.lignes.map((l) => [l.libelle, l.valeur]));

  if (t && t.rangees.length && t.rangees.every((r) => parLibelle.has(r))) {
    return {
      ...base, reperes: s.lignes.filter((l) => !t.rangees.includes(l.libelle)), articles: null, tableau: null,
      criteres: t.rangees.map((r) => ({ critere: r, exige: parLibelle.get(r) ?? '' })),
      quantite: `${t.rangees.length} critère${t.rangees.length > 1 ? 's' : ''} à coter`,
    };
  }

  if (t && t.rangees.length && t.rangees.every((r) => ARTICLE.test(r))) {
    const articles: ArticleConformite[] = [];
    for (const r of t.rangees) {
      const [, article, caracteristique, exigee] = ARTICLE.exec(r) ?? [];
      let a = articles.find((x) => x.article === article);
      if (!a) articles.push((a = { article, caracteristiques: [] }));
      a.caracteristiques.push({ caracteristique, exigee });
    }
    const noms = articles.map((a) => a.article);
    // La ligne qui ne fait que lister les articles (« Articles exigés ») est redite par le regroupement.
    const reperes = s.lignes.filter((l) => !noms.every((n) => l.valeur.includes(n)));
    return {
      ...base, reperes, criteres: null, articles, tableau: null,
      quantite: `${t.rangees.length} caractéristique${t.rangees.length > 1 ? 's' : ''} · ${articles.length} article${articles.length > 1 ? 's' : ''}`,
    };
  }

  const n = t ? t.rangees.length + t.rangeesVides : 0;
  let quantite = '';
  if (t && /signature/i.test(s.titre)) quantite = `${t.rangees.length} signataire${t.rangees.length > 1 ? 's' : ''}`;
  else if (t && t.rangees.length && t.colonnes.some((c) => /^Cote/.test(c))) quantite = `${t.rangees.length} vérification${t.rangees.length > 1 ? 's' : ''} à coter`;
  else if (t) quantite = `${n} rangée${n > 1 ? 's' : ''} à remplir`;
  else quantite = `${s.lignes.length} information${s.lignes.length > 1 ? 's' : ''}`;
  return { ...base, reperes: s.lignes, criteres: null, articles: null, tableau: t, quantite };
}
