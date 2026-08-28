import { Injectable, computed, signal } from '@angular/core';

/**
 * Affichage des tâches exercées par DÉLÉGATION ascendante : repliable, affiché par défaut.
 *
 * ⚠️ Demande user (2026-08-28). À ne pas confondre avec les « interrupteurs de délégation » du
 * 15/08, retirés le même jour (`23d7e7f`) :
 *
 * | | Interrupteurs (15/08, retirés) | Ce repli (28/08) |
 * |---|---|---|
 * | Nature | opt-in de PERMISSION — la délégation n'était pas exercée | repli d'AFFICHAGE — la délégation reste exercée |
 * | Défaut | tout désactivé | tout affiché |
 * | Granularité | un par profil délégué | un seul, pour l'ensemble |
 * | Effet | boutons et actions réellement absents | les sections se replient, rien d'autre |
 *
 * Autrement dit : replier ne retire aucun droit. Un dossier reste attribuable, une réception reste
 * enregistrable — l'utilisateur a seulement rangé les rubriques qu'il n'utilise pas aujourd'hui.
 *
 * **La préférence est stockée sans matricule, volontairement.** L'ancienne clé
 * `cnm.delegations-exercees.<matricule>` nommait qui s'était connecté sur le poste, ce que le
 * constat S9 de l'audit reprochait (rémanence d'identité sur poste partagé). Ici la clé ne contient
 * qu'un booléen : elle ne dit rien de personne, et n'a donc pas à être purgée à la déconnexion.
 */
@Injectable({ providedIn: 'root' })
export class DelegationsAffichageStore {
  private static readonly CLE = 'cnm.delegations-repliees';

  private readonly repliees = signal(DelegationsAffichageStore.lire());

  /** Les sections « Exercé par délégation » sont-elles dépliées ? (vrai par défaut) */
  readonly affichees = computed(() => !this.repliees());

  /** Replie ou déplie les sections déléguées, partout à la fois (barre latérale et cartes). */
  basculer(): void {
    const suivant = !this.repliees();
    this.repliees.set(suivant);
    try {
      localStorage.setItem(DelegationsAffichageStore.CLE, suivant ? '1' : '0');
    } catch {
      // Stockage indisponible (mode privé, quota) : la préférence vaut pour la session.
    }
  }

  private static lire(): boolean {
    try {
      return localStorage.getItem(DelegationsAffichageStore.CLE) === '1';
    } catch {
      return false; // affiché par défaut
    }
  }
}
