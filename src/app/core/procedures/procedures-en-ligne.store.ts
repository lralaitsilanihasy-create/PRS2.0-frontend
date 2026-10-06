import { Injectable, Injector, computed, inject, signal } from '@angular/core';

import { ProcedureInterne } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { AuthService } from '../auth/auth.service';

/**
 * ⚠️ 06/10 — les procédures en remise électronique du compte connecté (`GET /api/fiches-marche/en-ligne`) : celles dont il est
 * **responsable** (titulaire, ou par intérim), ou **toutes** pour l'Administrateur. Elles décident de l'entrée « Mes procédures en
 * ligne » (affichée seulement si la liste n'est pas vide) et nourrissent la file de l'Administrateur. Relues à l'ouverture et à
 * chaque navigation, comme la vacance PRMP et l'intérim. Silencieux : en échec, l'état connu reste.
 */
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

  verifier(): void {
    const role = this.auth.role();
    if (!role || this.enCours) return;
    this.enCours = true;
    this.injector.get(FicheMarcheService).enLigne().subscribe({
      next: (l) => {
        this.liste.set(l ?? []);
        this.chargee.set(true);
        this.enCours = false;
      },
      error: () => {
        this.enCours = false;
      },
    });
  }
}
