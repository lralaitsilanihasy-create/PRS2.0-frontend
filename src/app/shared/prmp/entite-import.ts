/**
 * Garde d'entité des imports PPM (PDF) — fonction PURE partagée par le réimport du détail PPM et
 * la rectification (⚠️ constat pilote 2026-09-05 : la rectification ne comparait que par id — un
 * PPM d'une entité HORS RÉFÉRENTIEL, « FONDS ROUTIER », passait la garde alors qu'une entité
 * connue, « MINISTÈRE DES TRAVAUX PUBLICS », était refusée).
 *
 * L'entité d'un dossier est FIXE : un PDF d'une autre entité injecterait des marchés étrangers.
 * Deux cas de blocage :
 *  1) le PDF **résout** à une entité connue **différente** de celle du dossier (comparaison id) ;
 *  2) le PDF **ne résout pas** (entité absente du référentiel) mais son autorité lue diffère du
 *     libellé de l'entité du dossier (comparaison par nom normalisé, quand les deux sont connus).
 */

/** Normalise un nom d'entité pour comparaison tolérante (majuscules, sans accents, espaces réduits). */
export function normaliserNomEntite(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** L'import PDF concerne-t-il une AUTRE entité contractante que le dossier ? */
export function entiteImportDifferente(
  idEntitePdf: number | null | undefined,
  autoritePdf: string | null | undefined,
  idEntiteDossier: number | null | undefined,
  libelleEntiteDossier: string | null | undefined,
): boolean {
  if (idEntitePdf != null) {
    return idEntiteDossier != null && idEntitePdf !== idEntiteDossier;
  }
  const dossNom = normaliserNomEntite(libelleEntiteDossier ?? '');
  const pdfNom = normaliserNomEntite(autoritePdf ?? '');
  return !!dossNom && !!pdfNom && dossNom !== pdfNom;
}
