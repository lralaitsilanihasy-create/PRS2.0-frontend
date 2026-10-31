/**
 * Raccourcis clavier de l'application (pilote, 31/10/2026, direction « Espace de travail », lot 5).
 *
 * - J / K : élément suivant / précédent d'une liste en deux volets (`app-deux-volets`) — il est choisi ET reçoit le focus ;
 * - Entrée : ouvre l'élément qui a le focus (rien à coder : chaque ligne de liste est un `<button>`) ;
 * - / : place le curseur dans la recherche de la page (à défaut, « Aller à un dossier » de l'en-tête) ;
 * - ? : affiche l'aide des raccourcis.
 *
 * Un raccourci ne se déclenche JAMAIS pendant une saisie (champ, zone de texte, liste déroulante, éditeur), avec Ctrl, Alt ou
 * ⌘, ni quand une modale est ouverte (elle garde la main : Échap, Tab).
 */
export type Raccourci = 'suivant' | 'precedent' | 'recherche' | 'aide';

/** L'aide affichée par « ? » — une ligne par raccourci, dans l'ordre de lecture. */
export const AIDE_RACCOURCIS: readonly { touches: readonly string[]; effet: string }[] = [
  { touches: ['J'], effet: 'Élément suivant de la liste (son détail s’affiche à droite)' },
  { touches: ['K'], effet: 'Élément précédent de la liste' },
  { touches: ['Entrée'], effet: 'Ouvrir l’élément sélectionné au clavier' },
  { touches: ['/'], effet: 'Aller à la recherche' },
  { touches: ['?'], effet: 'Afficher cette aide' },
  { touches: ['Échap'], effet: 'Fermer une fenêtre ou un menu' },
];

function enSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName);
}

/** Le raccourci que porte cette frappe, ou null (frappe ordinaire, saisie en cours, modale ouverte). */
export function raccourciDe(e: KeyboardEvent, doc: Document): Raccourci | null {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (enSaisie(e.target)) return null;
  if (doc.querySelector('.modal-backdrop')) return null;
  switch (e.key) {
    case 'j':
    case 'J':
      return 'suivant';
    case 'k':
    case 'K':
      return 'precedent';
    case '/':
      return 'recherche';
    case '?':
      return 'aide';
    default:
      return null;
  }
}

/**
 * Passe à l'élément suivant (+1) ou précédent (−1) de la première liste en deux volets de la page : le bouton de la ligne est
 * cliqué (l'écran garde la main sur sa sélection) puis reçoit le focus. Sans sélection, J prend le premier, K le dernier.
 * Rend false s'il n'y a pas de liste.
 */
export function deplacerDansLaListe(doc: Document, sens: 1 | -1): boolean {
  const boutons = Array.from(doc.querySelectorAll<HTMLButtonElement>('app-deux-volets .dv__liste button[aria-pressed]')).filter(
    (b) => !b.disabled,
  );
  if (!boutons.length) return false;
  const actif = doc.activeElement;
  let i = boutons.findIndex((b) => b === actif);
  if (i < 0) i = boutons.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
  const j = i < 0 ? (sens === 1 ? 0 : boutons.length - 1) : Math.min(boutons.length - 1, Math.max(0, i + sens));
  const cible = boutons[j];
  if (cible.getAttribute('aria-pressed') !== 'true') cible.click();
  cible.focus();
  cible.scrollIntoView?.({ block: 'nearest' });
  return true;
}

/** Place le curseur dans la recherche de la page, sinon dans celle de l'en-tête. Rend false s'il n'y en a aucune. */
export function focaliserRecherche(doc: Document): boolean {
  const champ =
    doc.querySelector<HTMLInputElement>('main input[type="search"]:not([disabled])') ??
    doc.querySelector<HTMLInputElement>('input[type="search"]:not([disabled])');
  if (!champ) return false;
  champ.focus();
  champ.select?.();
  return true;
}
