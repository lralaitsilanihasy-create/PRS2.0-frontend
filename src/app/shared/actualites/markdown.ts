/**
 * Rendu markdown **sans injection HTML** pour les actualités (`docs/spec-actualites.md`).
 *
 * ⚠️ Pourquoi ce parseur maison plutôt qu'une bibliothèque : toutes produisent une chaîne HTML,
 * qu'il faudrait poser avec `[innerHTML]`. Le contenu est rédigé par un administrateur, mais un
 * compte compromis suffirait alors à exécuter du script dans l'origine de l'application — la faille
 * exacte que l'audit des 16-17/08 a fermée (blobs, téléversements). Ici, le markdown est converti en
 * **structure de données typée** que le gabarit Angular rend avec de vraies balises : aucune chaîne
 * n'est jamais interprétée comme du HTML, quel que soit le contenu saisi.
 *
 * Sous-ensemble couvert : titres (`#`..`###`), paragraphes, listes à puces et numérotées, citations,
 * séparateurs ; en ligne : `**gras**`, `*italique*`, `` `code` ``, `[texte](lien)`.
 */

export type FragmentMd =
  | { type: 'texte'; texte: string }
  | { type: 'gras'; texte: string }
  | { type: 'italique'; texte: string }
  | { type: 'code'; texte: string }
  | { type: 'lien'; texte: string; href: string };

export type BlocMd =
  | { type: 'titre'; niveau: 1 | 2 | 3; contenu: FragmentMd[] }
  | { type: 'paragraphe'; contenu: FragmentMd[] }
  | { type: 'liste'; ordonnee: boolean; elements: FragmentMd[][] }
  | { type: 'citation'; contenu: FragmentMd[] }
  | { type: 'separateur' };

/** Protocoles admis dans un lien. `javascript:` et `data:` sont donc rendus en texte, pas en lien. */
const PROTOCOLES_SURS = /^(https?:\/\/|mailto:)/i;

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Découpe une ligne en fragments (gras, italique, code, liens) et texte simple. */
export function fragmentsMd(ligne: string): FragmentMd[] {
  const out: FragmentMd[] = [];
  let curseur = 0;
  INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(ligne)) !== null) {
    if (m.index > curseur) {
      out.push({ type: 'texte', texte: ligne.slice(curseur, m.index) });
    }
    if (m[1] !== undefined) {
      out.push({ type: 'gras', texte: m[1] });
    } else if (m[2] !== undefined || m[3] !== undefined) {
      out.push({ type: 'italique', texte: (m[2] ?? m[3]) as string });
    } else if (m[4] !== undefined) {
      out.push({ type: 'code', texte: m[4] });
    } else if (m[5] !== undefined && m[6] !== undefined) {
      // Lien à protocole non sûr : restitué en texte brut, jamais en ancre cliquable.
      out.push(
        PROTOCOLES_SURS.test(m[6])
          ? { type: 'lien', texte: m[5], href: m[6] }
          : { type: 'texte', texte: `${m[5]} (${m[6]})` },
      );
    }
    curseur = m.index + m[0].length;
  }
  if (curseur < ligne.length) {
    out.push({ type: 'texte', texte: ligne.slice(curseur) });
  }
  return out.length ? out : [{ type: 'texte', texte: ligne }];
}

/** Convertit un markdown en blocs typés, prêts à être rendus par le gabarit. */
export function blocsMd(markdown: string): BlocMd[] {
  const blocs: BlocMd[] = [];
  const lignes = (markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  let paragraphe: string[] = [];
  let liste: { ordonnee: boolean; elements: FragmentMd[][] } | null = null;

  const viderParagraphe = () => {
    if (paragraphe.length) {
      blocs.push({ type: 'paragraphe', contenu: fragmentsMd(paragraphe.join(' ')) });
      paragraphe = [];
    }
  };
  const viderListe = () => {
    if (liste) {
      blocs.push({ type: 'liste', ordonnee: liste.ordonnee, elements: liste.elements });
      liste = null;
    }
  };
  const vider = () => {
    viderParagraphe();
    viderListe();
  };

  for (const brute of lignes) {
    const ligne = brute.trimEnd();
    if (!ligne.trim()) {
      vider();
      continue;
    }
    const titre = /^(#{1,3})\s+(.*)$/.exec(ligne);
    if (titre) {
      vider();
      blocs.push({ type: 'titre', niveau: titre[1].length as 1 | 2 | 3, contenu: fragmentsMd(titre[2]) });
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(ligne)) {
      vider();
      blocs.push({ type: 'separateur' });
      continue;
    }
    const citation = /^>\s?(.*)$/.exec(ligne);
    if (citation) {
      vider();
      blocs.push({ type: 'citation', contenu: fragmentsMd(citation[1]) });
      continue;
    }
    const puce = /^\s*[-*]\s+(.*)$/.exec(ligne);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);
    if (puce || numero) {
      viderParagraphe();
      const ordonnee = !!numero;
      if (!liste || liste.ordonnee !== ordonnee) {
        viderListe();
        liste = { ordonnee, elements: [] };
      }
      liste.elements.push(fragmentsMd((puce ? puce[1] : numero![1]) ?? ''));
      continue;
    }
    viderListe();
    paragraphe.push(ligne.trim());
  }
  vider();
  return blocs;
}
