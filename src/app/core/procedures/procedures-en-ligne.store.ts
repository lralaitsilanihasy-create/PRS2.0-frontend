import { Injectable, Injector, computed, inject, signal } from '@angular/core';

import { ProcedureInterne } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { AuthService } from '../auth/auth.service';

/**
 * ⚠️ 06/10 — les procédures en remise électronique du compte connecté (`GET /api/fiches-marche/en-ligne`) : celles dont il est
 * **responsable** (titulaire, ou par intérim), ou **toutes** pour l'Administrateur. Elles décident de l'entrée « Mes procédures en
 * ligne » (affichée seulement si la liste n'est pas vide) et nourrissent la file de l'Administrateur. Relues à l'ouverture, puis au plus
 * toutes les 5 minutes (⚠️ 30/10, voir `verifier`). Silencieux : en échec, l'état connu reste.
 */
/** ⚠️ 30/10 — l'intervalle minimal entre deux relectures du même compte. */
export const RELECTURE_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ProceduresEnLigneStore {
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  readonly liste = signal<readonly ProcedureInterne[]>([]);
  /** La liste a été lue au moins une fois pour ce compte. */
  readonly chargee = signal(false);
  readonly nombre = computed(() => this.liste().length);
  /** Pour l'Administrateur : les procédures qui attendent la désignation de leur responsable. */
  readonly sansResponsable = computed(() => this.liste().filter((p) => !p.responsable).length);
  private enCours = false;
  /** Le compte et l'instant (horloge monotone du navigateur, en ms) de la dernière lecture réussie. */
  private luPour: string | null = null;
  private luA = 0;

  /**
   * ⚠️ 30/10 (mesure de performance) — relue à chaque navigation, la liste coûtait jusqu'à 404 requêtes SQL au serveur pour
   * l'Administrateur et le responsable de procédure, à chaque changement d'écran. Elle n'est plus relue qu'au changement de
   * compte, ou au plus toutes les {@link RELECTURE_MS} ; `forcer` relit tout de suite (après un geste qui la change).
   * L'écran « Procédures en ligne » la remplace de toute façon à son ouverture.
   */
  verifier(forcer = false): void {
    const role = this.auth.role();
    if (!role || this.enCours) return;
    const compte = `${role}:${this.auth.ref() ?? ''}`;
    if (!forcer && this.chargee() && this.luPour === compte && performance.now() - this.luA < RELECTURE_MS) return;
    this.enCours = true;
    this.injector.get(FicheMarcheService).enLigne().subscribe({
      next: (l) => {
        this.liste.set(l ?? []);
        this.chargee.set(true);
        this.luPour = compte;
        this.luA = performance.now();
        this.enCours = false;
      },
      error: () => {
        this.enCours = false;
      },
    });
  }
}
