import { DocumentPage, NoeudPage } from '../../../../models';

/**
 * ⚠️ 21/10 (option C') — le passage entre le document du serveur et celui de l'éditeur. Deux différences seulement :
 * - **le bloc conditionnel** : le serveur n'a qu'un type `bloc`, en bloc (autour de paragraphes ou de tableaux) ou en ligne (dans un
 *   paragraphe : « Commission {Centrale | Régionale} »). Dans l'éditeur, un nœud est soit bloc soit en ligne : le bloc en ligne
 *   s'appelle donc `blocEnLigne` côté éditeur, et redevient `bloc` à l'enregistrement ;
 * - **les valeurs par défaut** : Tiptap écrit les attributs absents à `null` ; le serveur tolère un attribut inconnu nul, mais refuse un
 *   attribut inconnu valué. On retire donc tout `null`, et l'image ne garde que ses trois attributs du schéma.
 */

/** Les nœuds dont le contenu est en ligne : un `bloc` qui s'y trouve est un bloc en ligne. */
const CONTENU_EN_LIGNE = new Set(['paragraph', 'heading', 'blocEnLigne']);
const ATTRS_IMAGE = ['idImage', 'largeur', 'alignement'];

/** Un `doc` vide, pour une zone absente (en-tête, pied de page). */
export const docVide = (): NoeudPage => ({ type: 'doc', content: [{ type: 'paragraph' }] });

function attrsPropres(attrs: Record<string, unknown> | undefined, garder?: readonly string[]): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (garder && !garder.includes(k)) continue;
    r[k] = v;
  }
  return Object.keys(r).length ? r : undefined;
}

/** Du serveur vers l'éditeur : le `bloc` placé dans un contenu en ligne devient `blocEnLigne`. */
export function depuisServeur(n: NoeudPage | null | undefined, parent: string | null = null): NoeudPage {
  if (!n) return docVide();
  const enLigne = n.type === 'bloc' && (n.attrs?.['enLigne'] === true || (parent !== null && CONTENU_EN_LIGNE.has(parent)));
  const type = enLigne ? 'blocEnLigne' : n.type;
  const attrs = n.type === 'bloc' ? { condition: n.attrs?.['condition'] ?? null } : n.attrs;
  const r: NoeudPage = { type };
  if (attrs) r.attrs = { ...attrs };
  if (n.text !== undefined) r.text = n.text;
  if (n.marks?.length) r.marks = n.marks.map((m) => ({ ...m }));
  if (n.content) r.content = n.content.map((c) => depuisServeur(c, type));
  return r;
}

/** De l'éditeur vers le serveur : `blocEnLigne` redevient `bloc`, les `null` disparaissent, l'image garde ses seuls attributs. */
export function versServeur(n: NoeudPage): NoeudPage {
  const type = n.type === 'blocEnLigne' ? 'bloc' : n.type;
  const r: NoeudPage = { type };
  const attrs = attrsPropres(n.attrs, type === 'image' ? ATTRS_IMAGE : undefined);
  if (attrs) r.attrs = attrs;
  if (n.text !== undefined) r.text = n.text;
  const marks = (n.marks ?? []).map((m) => ({ type: m.type, attrs: attrsPropres(m.attrs) })).filter((m) => m.type !== 'textStyle' || m.attrs);
  if (marks.length) r.marks = marks.map((m) => (m.attrs ? m : { type: m.type }));
  if (n.content?.length) r.content = n.content.map(versServeur);
  return r;
}

/** Une zone est vide si elle n'a qu'un paragraphe sans contenu : on ne l'envoie pas. */
export function zoneVide(n: NoeudPage | null | undefined): boolean {
  if (!n?.content?.length) return true;
  return n.content.length === 1 && n.content[0].type === 'paragraph' && !n.content[0].content?.length;
}

/** L'enveloppe à enregistrer, depuis les trois zones de l'éditeur. */
export function enveloppe(page: DocumentPage['page'], entete: NoeudPage, corps: NoeudPage, pied: NoeudPage, surPremiere: boolean): DocumentPage {
  const d: DocumentPage = { page, corps: versServeur(corps) };
  if (!zoneVide(entete)) {
    d.entete = versServeur(entete);
    if (surPremiere) d.enteteSurPremiereSeulement = true;
  }
  if (!zoneVide(pied)) d.piedDePage = versServeur(pied);
  return d;
}

/** Le nœud désigné par un `chemin` du rapport (`corps/1/1`), pour y amener le curseur ; `null` si le chemin ne mène à rien. */
export function cheminVersZone(chemin: string | null | undefined): { zone: 'entete' | 'corps' | 'piedDePage'; rangs: number[] } | null {
  if (!chemin) return null;
  const [zone, ...reste] = chemin.split('/');
  if (zone !== 'entete' && zone !== 'corps' && zone !== 'piedDePage') return null;
  const rangs = reste.map(Number);
  return rangs.every((r) => Number.isInteger(r) && r >= 0) ? { zone, rangs } : null;
}
