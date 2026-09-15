/**
 * Césure syllabique du français pour les colonnes étroites des documents officiels (refonte
 * ergonomique, 2026-09-15 — défaut de recette « Fournit|ures », « COMPT|E », « Consultatio|n »).
 *
 * Pourquoi une césure calculée ici plutôt que `hyphens: auto` : la coupure automatique dépend d'un
 * dictionnaire que le navigateur n'a pas toujours (Chrome sans tête n'en a aucun : mesuré, le mot
 * déborde) ; une césure conditionnelle (U+00AD) est honorée partout, avec son trait d'union.
 *
 * Règles retenues (typographie française, version prudente) :
 * - on ne coupe jamais entre deux voyelles (« tion », « ciaire » restent entiers) ;
 * - une consonne entre deux voyelles part avec la syllabe suivante (« ta-tion ») ;
 * - deux consonnes se séparent (« con-sul ») ; au-delà, seule la dernière part (« comp-te ») ;
 * - restent soudés : consonne + l / r (bl, cr, tr…), ch, ph, th, gn, qu et gu devant voyelle ;
 * - pas de coupure autour d'un x entre deux voyelles (« exa-men » plutôt que « e-xa… ») ;
 * - au moins 2 lettres avant la coupure et 3 après ; pas de coupure avant une syllabe finale muette
 *   (« -re », « -res », « -te »…) : « four-ni-tures », jamais « fournitu-res ».
 *
 * Fonctions pures, sans Angular : testables à froid.
 */

/** Césure conditionnelle : invisible tant que le mot tient, trait d'union quand le mot se coupe. */
export const CESURE = '­';

const VOYELLE = /[aeiouyàâäéèêëîïôöùûüÿœæ]/;
const LETTRES = /[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+/g;
/** Groupes de consonnes qui ne se séparent pas. */
const SOUDEES = new Set(['bl', 'cl', 'fl', 'gl', 'pl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr', 'ch', 'ph', 'th', 'gn']);

interface Unite {
  debut: number;
  texte: string;
  voyelle: boolean;
}

const estVoyelle = (c: string | undefined): boolean => !!c && VOYELLE.test(c);

/** Lettres → unités phonétiques grossières (voyelle / consonne, groupes soudés compris). */
function unites(mot: string): Unite[] {
  const m = mot.toLowerCase();
  const out: Unite[] = [];
  for (let i = 0; i < m.length; ) {
    const c = m[i];
    const deux = m.slice(i, i + 2);
    if (estVoyelle(c)) {
      out.push({ debut: i, texte: c, voyelle: true });
      i += 1;
    } else if (deux === 'qu' || (deux === 'gu' && estVoyelle(m[i + 2])) || (deux.length === 2 && SOUDEES.has(deux))) {
      out.push({ debut: i, texte: deux, voyelle: false });
      i += 2;
    } else {
      out.push({ debut: i, texte: c, voyelle: false });
      i += 1;
    }
  }
  return out;
}

/**
 * Indices où une coupure est permise dans un mot fait de LETTRES seules (la coupure se place avant
 * le caractère d'indice donné). `gauche` / `droite` : nombre minimal de lettres de part et d'autre.
 */
export function pointsDeCesure(mot: string, gauche = 2, droite = 3): number[] {
  if (mot.length < gauche + droite) return [];
  const u = unites(mot);
  // Plages de voyelles consécutives : [indice de la première unité, indice de la dernière].
  const plages: [number, number][] = [];
  u.forEach((x, i) => {
    if (!x.voyelle) return;
    const derniere = plages[plages.length - 1];
    if (derniere && derniere[1] === i - 1) derniere[1] = i;
    else plages.push([i, i]);
  });
  // Syllabe finale muette (« e » ou « es » en fin de mot) : on ne la rejette pas seule à la ligne.
  const finale = plages[plages.length - 1];
  const texteDe = (de: number, a: number): string => u.slice(de, a).map((x) => x.texte).join('');
  const muette = !!finale && texteDe(finale[0], finale[1] + 1) === 'e' && ['', 's'].includes(texteDe(finale[1] + 1, u.length));
  const points: number[] = [];
  for (let p = 1; p < plages.length; p++) {
    if (muette && p === plages.length - 1) break;
    const a = plages[p - 1][1];
    const b = plages[p][0];
    const consonnes = b - a - 1;
    // Une consonne : elle part avec la syllabe suivante — sauf un x entre deux voyelles.
    if (consonnes === 1 && u[a + 1].texte === 'x') continue;
    const coupe = consonnes === 1 ? u[a + 1] : consonnes === 2 ? u[a + 2] : u[b - 1];
    points.push(coupe.debut);
  }
  return points.filter((i) => i >= gauche && mot.length - i >= droite);
}

/**
 * Coupures imposées, pour les intitulés que la règle générale laisse insécables alors que la
 * colonne du PDF est trop étroite (« COMPTE », 5 % de la table : sa seule coupure est muette).
 */
const CESURES_IMPOSEES: Readonly<Record<string, string>> = {
  COMPTE: `COMP${CESURE}TE`,
};

/** Mot prêt à l'affichage : césures conditionnelles posées dans chacune de ses suites de lettres. */
export function cesurerMot(mot: string): string {
  const imposee = CESURES_IMPOSEES[mot];
  if (imposee) return imposee;
  return mot.replace(LETTRES, (lettres) => {
    const points = pointsDeCesure(lettres);
    if (!points.length) return lettres;
    let out = '';
    let depuis = 0;
    for (const p of points) {
      out += lettres.slice(depuis, p) + CESURE;
      depuis = p;
    }
    return out + lettres.slice(depuis);
  });
}

const cache = new Map<string, readonly (readonly string[])[]>();
const TAILLE_CACHE = 2000;

/**
 * Texte d'une cellule découpé pour l'affichage : lignes (retours à la ligne de la saisie), puis mots
 * césurés. Mémoïsé : un plan répète les mêmes libellés (natures, modes) sur toutes ses lignes.
 */
export function decouperTexte(texte: string | null | undefined): readonly (readonly string[])[] {
  const t = texte ?? '';
  const connu = cache.get(t);
  if (connu) return connu;
  const lignes = t.split(/\r?\n/).map((ligne) => ligne.split(/\s+/).filter(Boolean).map(cesurerMot));
  if (cache.size >= TAILLE_CACHE) cache.clear();
  cache.set(t, lignes);
  return lignes;
}
