import { EcartInstantane, EcartsInstantanes } from '../../../models';

/**
 * ⚠️ 01/11 (« ecarts-ecrans-figes », §B1) — ce qu'une carte du dossier dit de ses écrans figés comparés à leur état actuel :
 * - `ecarts` : au moins un écran comparable diffère (pastille « ≠ soumission ») ;
 * - `identique` : tous les écrans comparables sont identiques (un écran non comparable n'y change rien) ;
 * - `non-comparable` : aucun écran de la carte ne se recalcule pour l'appelant (ni ✓ ni ≠) ;
 * - `inconnu` : pas de comparaison pour cette soumission (réponse absente, écran hors réponse).
 */
export type EtatEcarts = 'ecarts' | 'identique' | 'non-comparable' | 'inconnu';

export interface LigneEcart extends EcartInstantane {
  ecran: string;
}

export interface BilanEcarts {
  etat: EtatEcarts;
  /** Les écarts des écrans de la carte, dans l'ordre de la carte. */
  lignes: readonly LigneEcart[];
  /** Un écran au moins a plus de 50 écarts : la liste est coupée. */
  tronque: boolean;
  /** Les écrans de la carte qui ne se comparent pas pour l'appelant (rappelés à côté de « ✓ identique »). */
  nonComparables: readonly string[];
}

export function bilanEcarts(reponse: EcartsInstantanes | null, ecrans: readonly string[]): BilanEcarts {
  const vide: BilanEcarts = { etat: 'inconnu', lignes: [], tronque: false, nonComparables: [] };
  if (!reponse || !ecrans.length) return vide;
  const retenus = ecrans.map((e) => reponse.ecrans.find((r) => r.ecran === e)).filter((r) => r !== undefined);
  if (!retenus.length) return vide;
  const comparables = retenus.filter((r) => r.comparable);
  const nonComparables = retenus.filter((r) => !r.comparable).map((r) => r.ecran);
  if (!comparables.length) return { ...vide, etat: 'non-comparable', nonComparables };
  const lignes = comparables.flatMap((r) => (r.identique === false ? r.ecarts.map((x) => ({ ...x, ecran: r.ecran })) : []));
  const differe = comparables.some((r) => r.identique === false);
  return { etat: differe ? 'ecarts' : 'identique', lignes, tronque: comparables.some((r) => r.tronque), nonComparables };
}
