/**
 * Tableaux en FICHES sur téléphone (pilote, 31/10/2026, direction « Espace de travail », lot 2).
 *
 * Sous 768 px, un tableau simple se lit mal : il défile de côté et l'on perd l'intitulé des colonnes. Ce module repère les
 * tableaux simples de toute l'application — UNE ligne d'en-tête, aucune cellule d'en-tête fusionnée — et recopie
 * l'intitulé de chaque colonne sur ses cellules (`data-label`) ; il marque le tableau `data-fiches`. Les styles globaux
 * (`styles/_responsive.scss`) affichent alors chaque ligne comme une fiche, chaque valeur précédée de son intitulé.
 *
 * Les tableaux complexes gardent leur défilement : documents officiels (`.doc-table`), plan de passation (`.ppm-table`),
 * tout ce qui vit dans une feuille de document, et tout tableau marqué `data-sans-fiches`. Une ligne qui fusionne ses
 * cellules (message « Aucun élément », total) reste une ligne pleine (`data-ligne-pleine`).
 *
 * Apparence seule : aucune donnée, aucun comportement ne change ; un tableau non retenu est laissé tel quel.
 */

/** Tableaux jamais mis en fiches. */
export const TABLEAUX_EXCLUS = '.doc-table, .ppm-table, [data-sans-fiches]';

/** Intitulés des colonnes d'un tableau simple, ou `null` s'il n'est pas simple (et ne doit pas passer en fiches). */
export function intitulesColonnes(table: HTMLTableElement): string[] | null {
  if (table.matches(TABLEAUX_EXCLUS) || table.closest('.doc-feuille')) return null;
  const lignes = table.tHead?.rows;
  if (!lignes || lignes.length !== 1) return null;
  const cellules = Array.from(lignes[0].cells);
  if (!cellules.length || cellules.some((c) => c.colSpan > 1 || c.rowSpan > 1)) return null;
  return cellules.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
}

/** Étiquette un tableau simple ; rend `true` s'il passe en fiches. Sans effet (et `false`) sur un tableau exclu ou complexe. */
export function etiqueterTableau(table: HTMLTableElement): boolean {
  const intitules = intitulesColonnes(table);
  if (!intitules) {
    table.removeAttribute('data-fiches');
    return false;
  }
  for (const corps of Array.from(table.tBodies)) {
    for (const ligne of Array.from(corps.rows)) {
      const cellules = Array.from(ligne.cells);
      if (cellules.some((c) => c.colSpan > 1)) {
        ligne.setAttribute('data-ligne-pleine', '');
        continue;
      }
      cellules.forEach((c, i) => {
        const intitule = intitules[i] ?? '';
        if (c.getAttribute('data-label') !== intitule) c.setAttribute('data-label', intitule);
      });
    }
  }
  if (!table.hasAttribute('data-fiches')) table.setAttribute('data-fiches', '');
  return true;
}

/**
 * Surveille le document : chaque tableau qui apparaît ou change (lignes chargées, page suivante) est étiqueté, au plus une
 * fois par image. Rend la fonction qui arrête la surveillance.
 */
export function activerTableauxEnFiches(doc: Document): () => void {
  const vue = doc.defaultView;
  if (!vue || typeof vue.MutationObserver === 'undefined') return () => undefined;
  let prevu = false;
  const passe = () => {
    prevu = false;
    for (const t of Array.from(doc.querySelectorAll('table'))) etiqueterTableau(t);
  };
  const planifier = () => {
    if (prevu) return;
    prevu = true;
    vue.requestAnimationFrame(passe);
  };
  const observateur = new vue.MutationObserver((mutations) => {
    // Nos propres attributs ne relancent rien : on n'observe que les ajouts et retraits de nœuds.
    if (mutations.some((m) => m.type === 'childList')) planifier();
  });
  observateur.observe(doc.body, { childList: true, subtree: true });
  planifier();
  return () => observateur.disconnect();
}
