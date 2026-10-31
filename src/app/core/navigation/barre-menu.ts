import type { NomIcone } from '../../shared/ui/icone';
import { NavItem } from './navigation';

/**
 * Entrée de la barre du menu principal (design institutionnel, 30/10/2026) : un LIEN direct, ou une RUBRIQUE
 * (« Mon travail », « Décisions »…) en menu déroulant. Dérivée des sections de `groupes-menu.ts`, sans second classement.
 */
export interface EntreeBarre {
  cle: string;
  lien?: NavItem;
  titre?: string;
  items: NavItem[];
  /** Marque de la rubrique « Exercé par délégation » / « Exercé par intérim ». */
  marque?: NomIcone;
}

/** Au-delà de ce nombre d'entrées de premier niveau, les rubriques se regroupent en menus déroulants. */
export const ENTREES_A_PLAT_MAX = 7;

/**
 * Barre du menu principal, à partir des sections du menu (`sectionsMenu`) :
 *  - un menu de {@link ENTREES_A_PLAT_MAX} entrées ou moins reste À PLAT ;
 *  - au-delà, chaque rubrique devient un menu déroulant — sauf l'accueil, et une rubrique d'UNE entrée, qui
 *    restent des liens directs (un déroulant d'un seul élément coûterait un clic pour rien) ;
 *  - « Exercé par délégation » et « Exercé par intérim » sont toujours des déroulants à leur nom : ce qu'on exerce
 *    à la place d'un autre ne se mêle jamais à ses propres entrées.
 * Les sous-entrées éventuelles d'une entrée (`children`) sont rangées à sa suite dans le déroulant.
 */
export function barreDuMenu(sections: { cle: string; titre: string | null; items: NavItem[] }[], nbPied = 0): EntreeBarre[] {
  const aPlat = (items: NavItem[]) => items.flatMap((i) => (i.children?.length ? [i, ...i.children] : [i]));
  const total = sections.reduce((n, sec) => n + sec.items.length, nbPied);
  const barre: EntreeBarre[] = [];
  for (const sec of sections) {
    // « À faire », l'accueil des profils du circuit, ouvre la barre en lien direct, comme l'accueil de l'Administrateur.
    const accueils = sec.cle === 'travail' ? sec.items.filter((i) => i.path.endsWith('/a-faire')) : [];
    for (const i of accueils) barre.push({ cle: i.path, lien: i, items: [i] });
    const items = aPlat(sec.items.filter((i) => !accueils.includes(i)));
    if (!items.length) continue;
    const marque: NomIcone | undefined = sec.cle === 'delegation' ? 'deleg' : sec.cle === 'interim' ? 'users' : undefined;
    const direct = !marque && (total <= ENTREES_A_PLAT_MAX || sec.cle === 'accueil' || items.length === 1 || !sec.titre);
    if (direct) for (const i of items) barre.push({ cle: i.path, lien: i, items: [i] });
    else barre.push({ cle: sec.cle, titre: sec.titre ?? '', items, marque });
  }
  return barre;
}
