import { Extension, Extensions, Node } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { maintenantPoste } from '../../../../core/horloge/heure-serveur';

/**
 * ⚠️ 21/10 (option C', demande « modele-pv-page ») — les extensions de l'éditeur de page, sur le schéma du serveur
 * (`GET /api/modeles-pv/schema`) : seuls les nœuds, marques et attributs qu'il admet. Les nœuds métier :
 * - `variable` et `champ` : des étiquettes en ligne, insécables, qui portent leur code ;
 * - `bloc` (autour de paragraphes ou de tableaux) et `blocEnLigne` (dans une phrase) : le passage conditionnel, encadré à l'écran ;
 * - la ligne de tableau répétée : l'attribut `liste` de `tableRow` ;
 * - `pageBreak`, `numeroPage`, `nombrePages`, et `image` (une image de la bibliothèque des modèles, par son `idImage`).
 *
 * ⚠️ 22/10 (W2 et M1 « modeles-documents-marche ») :
 * - le **titre numéroté** : `numerotation` (gabarit avec `{n}`, ex. « Article {n} — ») et `id` sur `heading` ; le numéro est calculé
 *   au rendu, après les règles — l'écran en montre un numéro **indicatif** (compteurs CSS) ;
 * - `repetition` { liste } : des paragraphes répétés pour chaque élément d'une liste (un par titulaire d'un contrat-cadre) ;
 * - `renvoi` { cible } : le numéro d'un titre numéroté, cité par son `id`.
 */

/** Ce que l'éditeur demande à l'écran : les libellés à afficher et l'adresse des images. */
export interface ContexteEditeur {
  libelleVariable: (code: string) => string;
  libelleChamp: (code: string) => string;
  libelleCondition: (nom: string) => string;
  urlImage: (idImage: number) => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagePv: {
      /** Insère une étiquette de variable du catalogue. */
      insererVariable: (code: string, format?: string | null) => ReturnType;
      /** Insère une étiquette de champ saisi. */
      insererChamp: (code: string) => ReturnType;
      /** Encadre la sélection : dans une phrase, un cadre en ligne ; sinon, un cadre autour des paragraphes. */
      encadrer: (condition: string) => ReturnType;
      /** Retire le cadre conditionnel qui contient le curseur (son contenu reste). */
      retirerCadre: () => ReturnType;
      insererSautDePage: () => ReturnType;
      insererImagePage: (idImage: number, largeur?: number | null) => ReturnType;
      /** Marque (ou démarque) la ligne de tableau du curseur comme répétée pour une liste. */
      repeterLigne: (liste: string | null) => ReturnType;
      /** Répète les paragraphes sélectionnés pour chaque élément d'une liste (`repetition`). */
      repeterParagraphes: (liste: string) => ReturnType;
      /** Numérote (gabarit avec `{n}`) ou dénumérote (`null`) le titre du curseur ; un titre numéroté reçoit un `id`. */
      numeroterTitre: (gabarit: string | null) => ReturnType;
    };
  }
}

const etiquette = (name: string, classe: string, libelle: (n: { attrs: Record<string, unknown> }) => string) =>
  Node.create({
    name,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes: () => (name === 'variable' ? { code: { default: null }, format: { default: null } } : { code: { default: null } }),
    parseHTML: () => [{ tag: `span[data-${name}]`, getAttrs: (el) => ({ code: (el as HTMLElement).getAttribute(`data-${name}`), format: (el as HTMLElement).getAttribute('data-format') }) }],
    renderHTML: ({ node }) => [
      'span',
      { class: classe, [`data-${name}`]: node.attrs['code'], 'data-format': node.attrs['format'] ?? null, contenteditable: 'false' },
      libelle(node),
    ],
  });

/** Les attributs de mise en page que le schéma admet sur les paragraphes, tableaux et cellules (rendus pour l'écran). */
const AttributsPage = Extension.create({
  name: 'attributsPage',
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading'],
      attributes: {
        retrait: { default: null, renderHTML: (a) => (a['retrait'] ? { style: `margin-left:${a['retrait']}mm` } : {}) },
        retraitDroite: { default: null, renderHTML: (a) => (a['retraitDroite'] ? { style: `margin-right:${a['retraitDroite']}mm` } : {}) },
        retraitPremiereLigne: { default: null, renderHTML: (a) => (a['retraitPremiereLigne'] ? { style: `text-indent:${a['retraitPremiereLigne']}mm` } : {}) },
        espaceAvant: { default: null, renderHTML: (a) => (a['espaceAvant'] != null ? { style: `margin-top:${a['espaceAvant']}pt` } : {}) },
        espaceApres: { default: null, renderHTML: (a) => (a['espaceApres'] != null ? { style: `margin-bottom:${a['espaceApres']}pt` } : {}) },
        interligne: { default: null, renderHTML: (a) => (a['interligne'] ? { style: `line-height:${a['interligne']}` } : {}) },
      },
    },
    {
      types: ['heading'],
      attributes: {
        numerotation: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-numerotation'),
          renderHTML: (a) => {
            const g = a['numerotation'] as string | null;
            if (!g) return {};
            const [avant, apres = ''] = g.split('{n}');
            return { 'data-numerotation': g, 'data-num-avant': avant, 'data-num-apres': apres };
          },
        },
        id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => (a['id'] ? { 'data-id': a['id'] } : {}) },
      },
    },
    {
      types: ['table'],
      attributes: {
        bordures: { default: null, renderHTML: (a) => (a['bordures'] === false ? { 'data-sans-bordures': 'true' } : {}) },
        retrait: { default: null },
        largeur: { default: null, renderHTML: (a) => (a['largeur'] ? { style: `width:${a['largeur']}%` } : {}) },
      },
    },
    {
      types: ['tableRow'],
      attributes: {
        liste: { default: null, parseHTML: (el) => el.getAttribute('data-liste'), renderHTML: (a) => (a['liste'] ? { 'data-liste': a['liste'], class: 'pg-repetee' } : {}) },
      },
    },
    {
      types: ['tableCell', 'tableHeader'],
      attributes: {
        fond: { default: null, renderHTML: (a) => (a['fond'] ? { style: `background:${a['fond']}` } : {}) },
        alignementVertical: { default: null, renderHTML: (a) => (a['alignementVertical'] ? { style: `vertical-align:${({ haut: 'top', milieu: 'middle', bas: 'bottom' } as Record<string, string>)[a['alignementVertical'] as string] ?? 'top'}` } : {}) },
        bordures: { default: null, renderHTML: (a) => (a['bordures'] === false ? { 'data-sans-bordures': 'true' } : {}) },
      },
    },
  ],
});

export function extensionsPage(ctx: ContexteEditeur): Extensions {
  const Variable = etiquette('variable', 'pg-var', (n) => {
    const f = n.attrs['format'] as string | null;
    return ctx.libelleVariable(String(n.attrs['code'])) + (f ? ` (${f})` : '');
  });
  const Champ = etiquette('champ', 'pg-champ', (n) => ctx.libelleChamp(String(n.attrs['code'])));

  const Bloc = Node.create({
    name: 'bloc',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes: () => ({ condition: { default: null } }),
    parseHTML: () => [{ tag: 'div[data-bloc]', getAttrs: (el) => ({ condition: (el as HTMLElement).getAttribute('data-bloc') }) }],
    renderHTML: ({ node }) => ['div', { class: 'pg-bloc', 'data-bloc': node.attrs['condition'], 'data-libelle': ctx.libelleCondition(String(node.attrs['condition'])) }, 0],
  });
  const BlocEnLigne = Node.create({
    name: 'blocEnLigne',
    group: 'inline',
    inline: true,
    content: 'inline*',
    addAttributes: () => ({ condition: { default: null } }),
    parseHTML: () => [{ tag: 'span[data-bloc-ligne]', getAttrs: (el) => ({ condition: (el as HTMLElement).getAttribute('data-bloc-ligne') }) }],
    renderHTML: ({ node }) => ['span', { class: 'pg-bloc-ligne', 'data-bloc-ligne': node.attrs['condition'], title: ctx.libelleCondition(String(node.attrs['condition'])) }, 0],
  });
  const Repetition = Node.create({
    name: 'repetition',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes: () => ({ liste: { default: null } }),
    parseHTML: () => [{ tag: 'div[data-repetition]', getAttrs: (el) => ({ liste: (el as HTMLElement).getAttribute('data-repetition') }) }],
    renderHTML: ({ node }) => ['div', { class: 'pg-repetition', 'data-repetition': node.attrs['liste'] }, 0],
  });
  const Renvoi = Node.create({
    name: 'renvoi',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes: () => ({ cible: { default: null } }),
    parseHTML: () => [{ tag: 'span[data-renvoi]', getAttrs: (el) => ({ cible: (el as HTMLElement).getAttribute('data-renvoi') }) }],
    renderHTML: ({ node }) => ['span', { class: 'pg-var', 'data-renvoi': node.attrs['cible'], contenteditable: 'false' }, `n° de l’article « ${node.attrs['cible']} »`],
  });
  const SautDePage = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML: () => [{ tag: 'div[data-saut]' }],
    renderHTML: () => ['div', { class: 'pg-saut', 'data-saut': 'true', contenteditable: 'false' }, 'Saut de page'],
  });
  const marqueur = (name: string, texte: string) =>
    Node.create({ name, group: 'inline', inline: true, atom: true, parseHTML: () => [{ tag: `span[data-${name}]` }], renderHTML: () => ['span', { class: 'pg-var', [`data-${name}`]: 'true', contenteditable: 'false' }, texte] });
  const ImagePage = Node.create({
    name: 'image',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes: () => ({ idImage: { default: null }, largeur: { default: null }, alignement: { default: null } }),
    parseHTML: () => [{ tag: 'img[data-id-image]', getAttrs: (el) => ({ idImage: Number((el as HTMLElement).getAttribute('data-id-image')) }) }],
    renderHTML: ({ node }) => [
      'div',
      { class: 'pg-image', style: `text-align:${({ left: 'left', right: 'right', center: 'center' } as Record<string, string>)[node.attrs['alignement'] as string] ?? 'center'}` },
      ['img', { src: ctx.urlImage(Number(node.attrs['idImage'])), 'data-id-image': node.attrs['idImage'], alt: 'Image du modèle', style: `width:${node.attrs['largeur'] ?? 25}mm` }],
    ],
  });

  const Commandes = Extension.create({
    name: 'pagePv',
    addCommands: () => ({
      insererVariable: (code, format = null) => ({ chain }) => chain().focus().insertContent({ type: 'variable', attrs: { code, format } }).run(),
      insererChamp: (code) => ({ chain }) => chain().focus().insertContent({ type: 'champ', attrs: { code } }).run(),
      encadrer: (condition) => ({ state, tr, dispatch, commands }) => {
        const { from, to, $from, $to } = state.selection;
        if (from === to) return false;
        const memeParagraphe = $from.sameParent($to) && $from.parent.isTextblock;
        const toutLeParagraphe = memeParagraphe && $from.parentOffset === 0 && $to.parentOffset === $to.parent.content.size;
        if (memeParagraphe && !toutLeParagraphe) {
          const contenu = state.doc.slice(from, to).content;
          const noeud = state.schema.nodes['blocEnLigne'].create({ condition }, contenu);
          if (dispatch) dispatch(tr.replaceRangeWith(from, to, noeud));
          return true;
        }
        return commands.wrapIn('bloc', { condition });
      },
      retirerCadre: () => ({ state, tr, dispatch, commands }) => {
        const $from = state.selection.$from;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if (n.type.name === 'blocEnLigne') {
            const pos = $from.before(d);
            if (dispatch) dispatch(tr.replaceWith(pos, pos + n.nodeSize, n.content).setSelection(TextSelection.near(tr.doc.resolve(pos))));
            return true;
          }
          if (n.type.name === 'bloc') return commands.lift('bloc');
          if (n.type.name === 'repetition') return commands.lift('repetition');
        }
        return false;
      },
      insererSautDePage: () => ({ chain }) => chain().focus().insertContent({ type: 'pageBreak' }).run(),
      insererImagePage: (idImage, largeur = 25) => ({ chain }) => chain().focus().insertContent({ type: 'image', attrs: { idImage, largeur, alignement: 'center' } }).run(),
      repeterLigne: (liste) => ({ commands }) => commands.updateAttributes('tableRow', { liste }),
      repeterParagraphes: (liste) => ({ commands }) => commands.wrapIn('repetition', { liste }),
      numeroterTitre: (gabarit) => ({ state, commands }) => {
        const titre = state.selection.$from.parent;
        if (titre.type.name !== 'heading') return false;
        const id = gabarit ? ((titre.attrs['id'] as string | null) ?? `art-${maintenantPoste().toString(36)}`) : titre.attrs['id'];
        return commands.updateAttributes('heading', { numerotation: gabarit, id });
      },
    }),
  });

  return [
    // ⚠️ 22/10 — sans `trailingNode` : il ajoutait un paragraphe vide après un passage final, et changeait la page à chaque enregistrement.
    StarterKit.configure({ blockquote: false, code: false, codeBlock: false, horizontalRule: false, strike: false, link: false, trailingNode: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    AttributsPage,
    Variable,
    Champ,
    Bloc,
    BlocEnLigne,
    Repetition,
    Renvoi,
    SautDePage,
    marqueur('numeroPage', 'n° de page'),
    marqueur('nombrePages', 'nombre de pages'),
    ImagePage,
    Commandes,
  ];
}
