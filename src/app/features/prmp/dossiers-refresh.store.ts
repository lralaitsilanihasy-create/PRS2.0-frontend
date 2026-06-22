import { Injectable, signal } from '@angular/core';

/**
 * Signal partagé de rafraîchissement de la liste des dossiers PRMP.
 *
 * Incrémenté après une mutation qui modifie l'ensemble des dossiers (ex. suppression d'un PPM
 * depuis « Mes PPM & marchés ») afin que les écrans qui listent les dossiers (ex. « Mes
 * brouillons ») se rechargent automatiquement, sans dépendre d'un rechargement manuel de la page.
 *
 * `providedIn: 'root'` : l'instance survit à la navigation entre écrans.
 */
@Injectable({ providedIn: 'root' })
export class DossiersRefreshStore {
  /** Révision incrémentée à chaque changement signalé ; les listes l'observent pour se recharger. */
  readonly revision = signal(0);

  /** À appeler après une mutation affectant la liste des dossiers (suppression, etc.). */
  notifierChangement(): void {
    this.revision.update((n) => n + 1);
  }
}
