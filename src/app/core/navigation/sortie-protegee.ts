import { CanDeactivateFn } from '@angular/router';

/**
 * Écran qui peut retenir l'utilisateur au moment de le quitter (modifications non enregistrées).
 * L'écran décide seul : il répond tout de suite (`true` = rien à perdre), ou ouvre sa propre
 * confirmation et rend une promesse résolue par le choix de l'utilisateur.
 */
export interface SortieProtegee {
  autoriserSortie(): boolean | Promise<boolean>;
}

/**
 * Garde `canDeactivate` des écrans {@link SortieProtegee} : délègue la décision à l'écran. Un
 * composant qui n'implémente pas l'interface (ou pas encore instancié) laisse passer.
 *
 * La fermeture ou le rechargement de l'onglet échappent au routeur : l'écran les couvre de son côté
 * par `beforeunload` (boîte native du navigateur, seule autorisée à ce moment-là).
 */
export const sortieProtegeeGuard: CanDeactivateFn<SortieProtegee> = (ecran) =>
  typeof ecran?.autoriserSortie === 'function' ? ecran.autoriserSortie() : true;
