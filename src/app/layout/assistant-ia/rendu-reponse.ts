/**
 * Mise en forme d'une réponse de l'assistant IA.
 *
 * ⚠️ Sécurité — le texte vient d'un modèle de langage : c'est une donnée NON FIABLE. Il n'est jamais
 * injecté comme du HTML (`innerHTML`) : il est découpé ici en blocs et segments typés, que le gabarit
 * affiche par interpolation, donc échappés par Angular. Seul un sous-ensemble du Markdown est reconnu
 * — paragraphes, listes à puces ou numérotées, `**gras**` — plus les citations `[n]`.
 *
 * Une citation dont le numéro ne correspond à aucun extrait fourni (le modèle en invente parfois :
 * « [8] » avec cinq extraits, recette du 2026-09-18) reste du texte simple : on ne rend pas cliquable
 * un renvoi qui ne mène nulle part.
 */

export type Segment =
  | { type: 'texte'; texte: string }
  | { type: 'gras'; texte: string }
  | { type: 'citation'; numero: number };

export type Bloc =
  | { type: 'paragraphe'; segments: Segment[] }
  | { type: 'liste'; ordonnee: boolean; elements: Segment[][] };

const PUCE = /^\s*(?:[-*•]|\d+[.)])\s+/;
const NUMEROTEE = /^\s*\d+[.)]\s+/;
const TITRE = /^\s*#{1,6}\s+/;
const JETON_EN_LIGNE = /\*\*([^*\n]+?)\*\*|\[(\d{1,3})\]/g;

/** Découpe la réponse en blocs affichables. Tolère un texte partiel (réponse en cours de génération). */
export function analyserReponse(texte: string, numerosConnus: ReadonlySet<number>): Bloc[] {
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let liste: { ordonnee: boolean; elements: string[] } | null = null;

  const fermerParagraphe = () => {
    if (paragraphe.length) {
      blocs.push({ type: 'paragraphe', segments: segmenter(paragraphe.join(' '), numerosConnus) });
      paragraphe = [];
    }
  };
  const fermerListe = () => {
    if (liste) {
      blocs.push({
        type: 'liste',
        ordonnee: liste.ordonnee,
        elements: liste.elements.map((e) => segmenter(e, numerosConnus)),
      });
      liste = null;
    }
  };

  for (const brute of texte.replace(/\r/g, '').split('\n')) {
    const ligne = brute.trim();
    if (!ligne) {
      fermerParagraphe();
      fermerListe();
      continue;
    }
    if (PUCE.test(brute)) {
      fermerParagraphe();
      const ordonnee = NUMEROTEE.test(brute);
      if (!liste || liste.ordonnee !== ordonnee) {
        fermerListe();
        liste = { ordonnee, elements: [] };
      }
      liste.elements.push(brute.replace(PUCE, '').trim());
      continue;
    }
    if (liste && /^\s{2,}/.test(brute)) {
      // Suite d'un élément de liste sur la ligne suivante (indentée).
      liste.elements[liste.elements.length - 1] += ' ' + ligne;
      continue;
    }
    fermerListe();
    // La consigne interdit les titres ; s'il en vient un, il s'affiche comme une ligne en gras.
    paragraphe.push(TITRE.test(ligne) ? `**${ligne.replace(TITRE, '')}**` : ligne);
  }
  fermerParagraphe();
  fermerListe();
  return blocs;
}

/** Découpe une ligne en texte, gras et citations. */
export function segmenter(ligne: string, numerosConnus: ReadonlySet<number>): Segment[] {
  const segments: Segment[] = [];
  let curseur = 0;
  for (const m of ligne.matchAll(JETON_EN_LIGNE)) {
    const debut = m.index ?? 0;
    if (debut > curseur) {
      ajouterTexte(segments, ligne.slice(curseur, debut));
    }
    if (m[1] !== undefined) {
      segments.push({ type: 'gras', texte: m[1] });
    } else {
      const numero = Number(m[2]);
      if (numerosConnus.has(numero)) {
        segments.push({ type: 'citation', numero });
      } else {
        ajouterTexte(segments, m[0]);
      }
    }
    curseur = debut + m[0].length;
  }
  if (curseur < ligne.length) {
    ajouterTexte(segments, ligne.slice(curseur));
  }
  return segments;
}

function ajouterTexte(segments: Segment[], texte: string): void {
  const dernier = segments[segments.length - 1];
  if (dernier?.type === 'texte') {
    dernier.texte += texte;
  } else {
    segments.push({ type: 'texte', texte });
  }
}
