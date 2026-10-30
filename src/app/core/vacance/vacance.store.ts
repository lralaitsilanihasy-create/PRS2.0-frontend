import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { MandatService } from '../../services/comptes.services';
import { AuthService } from '../auth/auth.service';

/**
 * État de VACANCE du poste PRMP (spec « Mandats PRMP », §5) : entre deux mandats, tout traitement des
 * dossiers côté PRMP / UGPM est en standby (dont la soumission — la « signature » de la PRMP). Le signal
 * est alimenté par `GET /api/mandats/actif` (**200** = un titulaire est en fonction, **404** = vacance),
 * appelé sans filtre : le backend scope sur le périmètre de l'appelant.
 *
 * Consommé par le layout (bannière explicite) et par les écrans d'action (boutons désactivés) — le
 * backend reste l'autorité (409 `VACANCE_PRMP` si une action passait quand même). Déblocage automatique :
 * il suffit de re-vérifier (navigation / rechargement) une fois le nouveau titulaire nommé.
 */
@Injectable({ providedIn: 'root' })
export class VacanceStore {
  private readonly auth = inject(AuthService);
  private readonly mandatService = inject(MandatService);

  /** `true` = aucun mandat PRMP actif sur le périmètre (poste vacant) — actions de traitement bloquées. */
  readonly vacance = signal(false);

  /** ⚠️ 30/10 (mesure de performance) — un seul appel à la fois : au démarrage, le layout en lançait deux ensemble. */
  private enCours = false;

  /** (Re)vérifie l'état — sans objet hors PRMP/UGPM (le circuit CNM n'est jamais suspendu par la vacance). */
  verifier(): void {
    const role = this.auth.role();
    if (role !== 'PRMP' && role !== 'UGPM') {
      this.vacance.set(false);
      return;
    }
    if (this.enCours) return;
    this.enCours = true;
    this.mandatService.actif().pipe(finalize(() => (this.enCours = false))).subscribe({
      next: () => this.vacance.set(false),
      error: (e: { status?: number }) => this.vacance.set(e?.status === 404),
    });
  }
}
