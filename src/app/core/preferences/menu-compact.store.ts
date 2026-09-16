import { Injectable, computed, signal } from '@angular/core';

/**
 * Menu latéral RÉDUIT EN RAIL d'icônes — bascule de l'utilisateur, mémorisée (refonte ergonomique,
 * lot 5 F4 ; décision de Mathieu du 2026-09-16 : « bascule utilisateur mémorisée, menu large par
 * défaut, rien d'automatique selon la largeur d'écran »).
 *
 * Replier automatiquement sous une certaine largeur retirerait le menu à quelqu'un qui ne l'a pas
 * demandé : le rail est un CHOIX, pas une conséquence du matériel. Le seul repli automatique de
 * l'application reste le mode concentration (route `data.concentration`), qui range la barre en
 * TIROIR — et qui n'est pas ce rail : `MainLayout.railActif()` l'y neutralise.
 *
 * **Stockage : `localStorage`, une clé, un booléen, AUCUN matricule** — calqué trait pour trait sur
 * `DelegationsAffichageStore` (28/08), pour les mêmes raisons :
 *
 * - le constat S9 de l'audit reproche la rémanence d'IDENTITÉ sur un poste partagé ; une clé
 *   `cnm.menu-compact.<matricule>` nommerait qui s'est connecté sur la machine, ce que cette
 *   préférence d'affichage ne justifie en rien ;
 * - n'étant l'identité de personne, la clé n'a pas à être purgée à la déconnexion — et c'est
 *   précisément ce qui fait tenir le réglage d'une session à l'autre ;
 * - le serveur n'est pas sollicité : le lot 5 ne pose aucune demande backend.
 *
 * **Conséquence assumée** : sur un poste partagé, le second utilisateur trouve le menu tel que le
 * premier l'a laissé. C'est la largeur d'une barre de navigation — elle ne dit rien de personne,
 * elle se voit immédiatement, et un clic sur un bouton toujours visible et libellé la rétablit.
 * Le même arbitrage a été rendu, et livré, pour le repli des délégations.
 */
@Injectable({ providedIn: 'root' })
export class MenuCompactStore {
  private static readonly CLE = 'cnm.menu-compact';

  private readonly compact = signal(MenuCompactStore.lire());

  /** Le menu est-il réduit au rail d'icônes ? (faux par défaut : menu large) */
  readonly reduit = computed(() => this.compact());

  /** Réduit le menu au rail, ou le redéploie. Le choix est retenu pour les sessions suivantes. */
  basculer(): void {
    const suivant = !this.compact();
    this.compact.set(suivant);
    try {
      localStorage.setItem(MenuCompactStore.CLE, suivant ? '1' : '0');
    } catch {
      // Stockage indisponible (mode privé, quota) : la préférence vaut pour la session en cours.
    }
  }

  private static lire(): boolean {
    try {
      return localStorage.getItem(MenuCompactStore.CLE) === '1';
    } catch {
      return false; // menu large par défaut
    }
  }
}
