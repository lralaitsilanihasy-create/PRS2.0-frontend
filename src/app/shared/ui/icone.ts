import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tracés des icônes (grille 24, trait 1,8) — repris tels quels de l'objet `ICONS` des maquettes de
 * la refonte ergonomique (`maquettes-design/src/build.mjs`, validées le 2026-09-14). Chaque entrée
 * est l'attribut `d` d'un unique `<path>` : les sous-tracés s'enchaînent par `M`.
 */
const ICONES = {
  inbox: 'M3 13h5l1.5 3h5l1.5-3h5 M5.5 5h13L21 13v6H3v-6z',
  folder: 'M3 6.5h6l2 2h10V19H3z',
  board: 'M4 4h4.5v16H4z M10 4h4.5v10H10z M16 4h4v7h-4z',
  file: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6',
  undo: 'M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
  users: 'M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8z M2 21v-1a6 6 0 0 1 12 0v1 M16 3.5a4 4 0 0 1 0 7.5 M22 21v-1a6 6 0 0 0-4-5.6',
  layers: 'M12 2 2 7l10 5 10-5z M2 12l10 5 10-5 M2 17l10 5 10-5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  archive: 'M3 4h18v5H3z M5 9v11h14V9 M10 13h4',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
  pen: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M20 20l-4-4',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
  send: 'M21 3 10 14 M21 3l-6.5 18-4.5-7-7-4.5z',
  hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  clip: 'M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3 2',
  history: 'M3 12a9 9 0 1 0 2.6-6.4 M3 4v5h5 M12 8v4l3 2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12 M18 6 6 18',
  chev: 'M9 6l6 6-6 6',
  chevd: 'M6 9l6 6 6-6',
  chevl: 'M15 6l-6 6 6 6',
  alert: 'M12 4 2.5 20h19z M12 10v4.5 M12 17.5v.01',
  pause: 'M9 5v14 M15 5v14',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  expand: 'M14 4h6v6 M10 20H4v-6 M20 4l-7 7 M4 20l7-7',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  deleg: 'M7 17 17 7 M8 7h9v9',
  return: 'M20 12H5 M11 6l-6 6 6 6',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  printer: 'M7 9V3h10v6 M6 18H4v-7h16v7h-2 M7 14h10v7H7z',
  columns: 'M4 5h16v14H4z M10 5v14 M15 5v14',
  message: 'M4 5h16v11H9l-5 4z',
  exit: 'M14 4h5v16h-5 M10 8l-4 4 4 4 M6 12h10',
  table: 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14',
  save: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6',
  // Ajouts du 2026-09-15 (menu et accueil sans emoji) — même grille, même trait.
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
  key: 'M8 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M10.8 12.2 20 3 M17 6l3 3 M14.5 8.5l2 2',
} as const;

export type NomIcone = keyof typeof ICONES;

/**
 * Icône SVG en ligne (trait `currentColor`, 1,8 sur une grille 24) — remplace les emoji et glyphes
 * dans les écrans refondus (refonte ergonomique, lot 2). Purement décorative : `aria-hidden`, le
 * sens est toujours porté par le texte voisin ou par le libellé accessible du bouton qui l'entoure.
 */
@Component({
  selector: 'app-icone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="taille()"
      [attr.height]="taille()"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="trace()" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; line-height: 0; }
    svg { display: block; }
  `,
})
export class Icone {
  readonly nom = input.required<NomIcone>();
  /** Côté en pixels (défaut 18, taille des maquettes). */
  readonly taille = input(18);
  readonly trace = computed(() => ICONES[this.nom()]);
}

/** Noms disponibles (tests, documentation). */
export const NOMS_ICONES = Object.keys(ICONES) as NomIcone[];
