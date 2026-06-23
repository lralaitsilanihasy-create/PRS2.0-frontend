import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Signal/flux partagés de synchronisation de la liste des dossiers PRMP.
 *
 * - `revision` : incrémenté après une mutation qui modifie l'ensemble des dossiers (ex. suppression
 *   d'un PPM depuis « Mes PPM & marchés ») → rechargement complet des écrans qui l'observent.
 * - `supprime$` : émet l'`idDossier` d'un dossier **supprimé** pour un **retrait local ciblé** (sans
 *   rechargement) dans tous les écrans qui le listent (tableau de bord, Mes PPM & marchés, …).
 *
 * `providedIn: 'root'` : l'instance survit à la navigation entre écrans.
 */
@Injectable({ providedIn: 'root' })
export class DossiersRefreshStore {
  /** Révision incrémentée à chaque changement signalé ; les listes l'observent pour se recharger. */
  readonly revision = signal(0);

  /** À appeler après une mutation affectant la liste des dossiers (suppression PPM, etc.). */
  notifierChangement(): void {
    this.revision.update((n) => n + 1);
  }

  private readonly _supprime = new Subject<number>();
  /** Émissions des `idDossier` supprimés ; à écouter pour retirer la ligne/carte localement. */
  readonly supprime$: Observable<number> = this._supprime.asObservable();

  /** À appeler après un `DELETE /api/dossiers/{id}` réussi (204) pour propager le retrait. */
  notifierSuppression(idDossier: number): void {
    this._supprime.next(idDossier);
  }
}
