import { Dossier, FiliationDossier, NoeudFiliation } from '../../../models';

/** Où un dossier se lit dans le plan : les versions du plan de sa filiation, et la ligne de sa procédure (`null` : aucune ligne). */
export interface CibleDossier {
  plans: number[];
  idDetail: number | null;
  idLigneOrigine: number | null;
}

/**
 * ⚠️ 04/11 (pilote) — la ligne du plan d'un dossier, lue sur sa filiation (`GET /api/dossiers/{id}/filiation`) : le nœud du dossier,
 * puis le plus proche nœud, lui ou un ancêtre, qui porte une ligne (la mise en concurrence porte la ligne ; le marché et ses actes
 * de gestion en descendent). Les versions du plan sont la racine et ses versions suivantes : le plan en vigueur est l'une d'elles.
 */
export function cibleDuDossier(f: FiliationDossier, idDossier: number): CibleDossier {
  const plans: number[] = [];
  let chemin: NoeudFiliation[] | null = null;
  const parcourir = (n: NoeudFiliation, pile: NoeudFiliation[]): void => {
    if ((n.lien === 'RACINE' || n.lien === 'VERSION_SUIVANTE') && n.idDossier != null) plans.push(n.idDossier);
    const ici = [...pile, n];
    if (n.idDossier === idDossier && !chemin) chemin = ici;
    n.enfants.forEach((e) => parcourir(e, ici));
  };
  parcourir(f.racine, []);
  const porteur = (chemin as NoeudFiliation[] | null)?.slice().reverse().find((n) => n.ligne);
  const ligne = porteur?.ligne as (NoeudFiliation['ligne'] & { idLigneOrigine?: number | null }) | undefined;
  return { plans, idDetail: ligne?.idDetail ?? null, idLigneOrigine: ligne?.idLigneOrigine ?? null };
}

/** Familles dont le dossier est un plan de passation. */
const STATUTS_PLAN_EN_VIGUEUR: ReadonlySet<string> = new Set(['CLOTURE', 'DECISION_TRANSMISE_SIGMP']);

/**
 * ⚠️ 04/11 (pilote) — où mène une ligne de « Tous mes dossiers » : un plan signé s'ouvre dans l'écran du plan ; un dossier né d'une
 * ligne ouvre le plan sur cette ligne (`?dossier=`, l'écran du plan la retrouve par la filiation). Un plan encore en brouillon ou à la
 * Commission n'est pas un plan en vigueur : il garde la page du dossier (`null`).
 */
export function lienVersLePlan(
  d: Pick<Dossier, 'idDossier' | 'idTypeDossier' | 'statut'>,
  espace = '/prmp',
): { commandes: (string | number)[]; params: Record<string, number> } | null {
  // ⚠️ 04/11 — `espace` : « /prmp », « /president », « /cc » ou « /membre », qui ont tous l'écran du plan.
  if (d.idTypeDossier === 'DDP') return STATUTS_PLAN_EN_VIGUEUR.has(d.statut ?? '') ? { commandes: [espace + '/plan', d.idDossier], params: {} } : null;
  return { commandes: [espace + '/plan'], params: { dossier: d.idDossier } };
}
