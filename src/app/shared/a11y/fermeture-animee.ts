import { WritableSignal } from '@angular/core';

/** Durée de l'animation de fermeture — doit rester alignée sur `.modal-backdrop.closing`. */
export const DUREE_FERMETURE_MS = 150;

/**
 * Ferme un modal **en douceur** : pose l'état `closing` (le style `.modal-backdrop.closing` joue
 * l'animation de sortie), puis retire réellement le modal à la fin de celle-ci.
 *
 * Sans cela, le `@if` du template retire le modal du DOM instantanément : il disparaît d'un coup,
 * alors que son ouverture, elle, est animée. Cette asymétrie est ce que l'utilisateur perçoit comme
 * un à-coup — signalé sur « Mes dossiers » du Président, où la comparaison se faisait avec le modal
 * PRMP, le seul de l'application à animer sa fermeture.
 *
 * Réentrant : un second appel pendant l'animation est ignoré (double clic, Échap + clic voile).
 *
 * @param closing signal d'état porté par le composant hôte, lié à `[class.closing]` sur le voile
 * @param retirer action qui retire effectivement le modal (émission de sortie, `signal.set(null)`…)
 */
export function fermerAvecAnimation(closing: WritableSignal<boolean>, retirer: () => void): void {
  if (closing()) {
    return;
  }
  closing.set(true);
  setTimeout(() => {
    closing.set(false);
    retirer();
  }, DUREE_FERMETURE_MS);
}
