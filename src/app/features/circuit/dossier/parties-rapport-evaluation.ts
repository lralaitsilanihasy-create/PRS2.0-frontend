/**
 * ⚠️ 05/11 (pilote, « établir les données du rapport d'évaluation ») — les HUIT parties du rapport d'évaluation tel que l'examen d'un
 * dossier de marché le lit (`docs/examen-rapport-evaluation-donnees-2026-11-05.md`, § 4), chacune nommant les points de la grille
 * qu'elle sert. La grille mène à la partie d'un point (`partieDuPoint`) ; le rattachement se fait au libellé du point, stable d'une base
 * à l'autre (les identifiants ne le sont pas).
 */
export interface PartieRapport {
  cle: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  libelle: string;
  /** Les points de la grille servis par la partie, en clair (tels que le référentiel les libelle). */
  points: readonly string[];
  motif: RegExp;
}

export const PARTIES_RAPPORT: readonly PartieRapport[] = [
  { cle: 'A', libelle: 'Commission et déclarations', points: ['CAO désignée, membres déclarés'], motif: /CAO d[ée]sign[ée]e/i },
  { cle: 'B', libelle: 'Synthèse et classement', points: ['Rejets motivés par le DAO', 'Classement et attributaire proposé'], motif: /rejets motiv[ée]s|classement et attributaire/i },
  { cle: 'C', libelle: 'Examen préliminaire', points: ['Conformité des documents essentiels'], motif: /documents essentiels/i },
  { cle: 'D', libelle: 'Montant évalué', points: ['Montant évalué conforme au DAO'], motif: /montant [ée]valu[ée] conforme/i },
  { cle: 'E', libelle: 'Offres anormales et moralité des prix', points: ['Offres anormales : justification demandée', 'Offres anormales : processus et seuils', 'Moralité des prix'], motif: /offres anormales|moralit[ée] des prix/i },
  { cle: 'F', libelle: 'Spécifications techniques', points: ['Spécifications techniques'], motif: /sp[ée]cifications techniques/i },
  { cle: 'G', libelle: 'Post-qualification', points: ['Post-qualification sur les seuls critères du DAO', 'Qualification : activités et critères'], motif: /post-qualification|qualification : activit/i },
  { cle: 'H', libelle: 'Rapport signé — PV de validation', points: ['Rapport signé de tous les membres', 'PV de validation cohérent'], motif: /rapport sign[ée]|PV de validation/i },
];

/** La partie du rapport qui sert un point de la grille, par son libellé ; `null` : le point ne se lit pas dans le rapport. */
export function partieDuPoint(libelle: string | null | undefined): Pick<PartieRapport, 'cle' | 'libelle'> | null {
  const p = libelle ? PARTIES_RAPPORT.find((x) => x.motif.test(libelle)) : undefined;
  return p ? { cle: p.cle, libelle: p.libelle } : null;
}

/** L'identifiant DOM d'une partie (cible du défilement depuis la grille). */
export const idPartieRapport = (cle: string): string => `rapport-partie-${cle}`;
