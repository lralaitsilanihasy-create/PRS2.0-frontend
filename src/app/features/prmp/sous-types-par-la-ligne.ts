import { SousTypeDossier } from '../../models';
import { SOUS_TYPE_MEC_DU_MARCHE } from './dossier-marche-procedures';

/**
 * ⚠️ 04/11 (pilote, maquette « menu PRMP recentré », temps 1) — les sous-types qui se créent DEPUIS la ligne du plan, jamais depuis
 * « Créer un dossier » sans ligne : le rapport justificatif et le marché de gré à gré (V163 : rattachés à la ligne, ils entrent dans sa
 * chaîne — créés sans ligne, ils n'y paraîtraient jamais) ; les dossiers d'appel d'offres et de consultation, que le serveur refuse de
 * toute façon hors de la fiche (`DOSSIER_PAR_FICHE`). Le dossier de marché, lui, passe déjà par « Choisir la procédure ».
 */
export const SOUS_TYPES_PAR_LA_LIGNE: ReadonlySet<string> = new Set(['RJ', 'MGG', ...Object.values(SOUS_TYPE_MEC_DU_MARCHE)]);

/** Les sous-types à proposer dans le choix (`proposes`), et ceux retenus parce qu'ils se créent depuis la ligne (`parLaLigne`). */
export function trierSousTypesCreables(rows: readonly SousTypeDossier[], avecLigne: boolean): { proposes: SousTypeDossier[]; parLaLigne: SousTypeDossier[] } {
  if (avecLigne) return { proposes: [...rows], parLaLigne: [] };
  return {
    proposes: rows.filter((t) => !SOUS_TYPES_PAR_LA_LIGNE.has(t.idSousType)),
    parLaLigne: rows.filter((t) => SOUS_TYPES_PAR_LA_LIGNE.has(t.idSousType)),
  };
}
