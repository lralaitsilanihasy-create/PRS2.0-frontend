import { Dossier } from '../../../models';

/**
 * ⚠️ 01/11 (pilote, maquette « Tous mes dossiers », variante B) — la FAMILLE d'un dossier, lue sur son type (`idTypeDossier`) :
 * plan (DDP), mise en concurrence (DMC), marché (DDM) ; les autres (actes de gestion, sans suite…) restent neutres. Elle donne la
 * couleur du filet de la ligne (classes globales `.fam-<famille>` de styles.scss) et le filtre « Famille » des listes.
 */
export type FamilleDossier = 'plan' | 'mec' | 'marche' | 'autre';

export const LIBELLES_FAMILLE: Readonly<Record<FamilleDossier, string>> = {
  plan: 'Plans',
  mec: 'Mises en concurrence',
  marche: 'Marchés',
  autre: 'Autres dossiers',
};

export function familleDossier(d: Pick<Dossier, 'idTypeDossier'>): FamilleDossier {
  switch (d.idTypeDossier) {
    case 'DDP': return 'plan';
    case 'DMC': return 'mec';
    case 'DDM': return 'marche';
    default: return 'autre';
  }
}
