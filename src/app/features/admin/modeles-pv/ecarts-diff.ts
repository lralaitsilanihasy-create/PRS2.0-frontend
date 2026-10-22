/**
 * ⚠️ 22/10 (D-ARMP, lisibilité du panneau des écarts, demande du pilote) — un écart arrive comme deux lignes entières du fichier de
 * commande (« [LIGNE] … ¶ … {{SI:X}} … »). On les rend lisibles : sans les codes techniques, et en ne gardant que les mots qui changent,
 * avec un peu de contexte autour.
 */

export interface SegmentEcart {
  type: 'egal' | 'retire' | 'ajoute' | 'coupure';
  texte: string;
}

/** Retire le mot-clé de ligne (« [PARA] »), les marqueurs de passage, et rend les séparateurs de cellules et de lignes lisibles. */
export function nettoyer(ligne: string | null | undefined): string {
  // Les séparateurs du fichier de commande : U+001E (retour à la ligne dans une cellule) et U+001F (cellule).
  const sans = (ligne ?? '').split(String.fromCharCode(0x1e)).join(' · ').split(String.fromCharCode(0x1f)).join(' | ');
  return sans
    .replace(/^\[[A-Z_]+\]\s*/, '')
    .replace(/\{\{FINSI:[^}]*\}\}/g, '')
    .replace(/\{\{SI:([^}]*)\}\}/g, '')
    .replace(/¶/g, ' · ')
    .replace(/\|/g, ' | ')
    .replace(/\{\{([^}]*)\}\}/g, '‹$1›')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Les mots et les espaces, comme unités de comparaison (un espace reste une unité : « ci - après » → « ci-après » se voit). */
const mots = (s: string): string[] => s.match(/\s+|[^\s]+/g) ?? [];

/** La différence mot à mot (plus longue sous-suite commune). */
export function diffMots(avant: string, apres: string): SegmentEcart[] {
  const a = mots(avant);
  const b = mots(apres);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: SegmentEcart[] = [];
  const pousser = (type: SegmentEcart['type'], texte: string) => {
    const dernier = out[out.length - 1];
    if (dernier?.type === type) dernier.texte += texte;
    else out.push({ type, texte });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pousser('egal', a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) pousser('retire', a[i++]);
    else pousser('ajoute', b[j++]);
  }
  while (i < n) pousser('retire', a[i++]);
  while (j < m) pousser('ajoute', b[j++]);
  return out;
}

/** Ne garde, des parties inchangées, que quelques mots autour de chaque changement ; le reste devient « … ». */
export function resserrer(segments: readonly SegmentEcart[], contexte = 6): SegmentEcart[] {
  const out: SegmentEcart[] = [];
  segments.forEach((s, k) => {
    if (s.type !== 'egal') { out.push({ ...s }); return; }
    const u = mots(s.texte);
    const premier = k === 0;
    const dernier = k === segments.length - 1;
    const garder = (premier || dernier ? contexte : contexte * 2) * 2; // mots + espaces
    if (u.length <= garder) { out.push({ ...s }); return; }
    const debut = premier ? [] : u.slice(0, contexte * 2);
    const fin = dernier ? [] : u.slice(u.length - contexte * 2);
    if (debut.length) out.push({ type: 'egal', texte: debut.join('') });
    out.push({ type: 'coupure', texte: ' … ' });
    if (fin.length) out.push({ type: 'egal', texte: fin.join('') });
  });
  return out;
}

/**
 * Le texte à chercher dans la page pour « Aller à l'endroit » : les mots ajoutés au premier changement, avec un ou deux mots autour,
 * sans code technique (une donnée de la fiche coupe le texte dans la page). Plusieurs propositions, de la plus précise à la plus large.
 */
export function passagesARechercher(avant: string, apres: string): string[] {
  const seg = diffMots(nettoyer(avant), nettoyer(apres));
  const k = seg.findIndex((s) => s.type !== 'egal');
  if (k < 0) return [];
  const ajoute = seg.slice(k).find((s) => s.type === 'ajoute')?.texte ?? '';
  const avantMots = mots(seg[k - 1]?.type === 'egal' ? seg[k - 1].texte : '').slice(-4).join('');
  const apresSeg = seg.slice(k).find((s, i) => i > 0 && s.type === 'egal');
  const apresMots = mots(apresSeg?.texte ?? '').slice(0, 4).join('');
  const propre = (s: string) => (/[‹›·|]/.test(s) ? '' : s);
  return [propre(avantMots + ajoute + apresMots), propre(avantMots + ajoute), propre(ajoute + apresMots), propre(ajoute.trim()), propre(avantMots.trim())]
    .map((s) => s.trim())
    .filter((s, i, l) => s.length >= 3 && l.indexOf(s) === i);
}
