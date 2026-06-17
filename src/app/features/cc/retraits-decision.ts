import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DemandeRetrait, StatutDemandeRetrait } from '../../models';
import { DemandeRetraitService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Décision du Chef de commission sur les demandes de retrait (§3.3, module 11).
 * Approbation/rejet d'une demande EN_ATTENTE : `obsDecision` et `imCtrlCc` sont
 * obligatoires (le backend renvoie 409 sinon). Si APPROUVE, le dossier passe RETIRE.
 */
@Component({
  selector: 'app-cc-retraits-decision',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StatutBadge],
  template: `
    <section class="decisions">
      <h1 class="decisions__title">Demandes de retrait</h1>

      @if (loading()) {
        <p class="decisions__info">Chargement…</p>
      } @else {
        <ul class="decisions__list">
          @for (d of demandes(); track d.idDemandeRetrait) {
            <li class="decision-card">
              <div class="decision-card__head">
                <span class="decision-card__ref">Demande #{{ d.idDemandeRetrait }} · dossier {{ d.idDossier }}</span>
                <app-statut-badge [statut]="d.statut" />
              </div>
              <p class="decision-card__motif">Motif : {{ d.motifRetrait }}</p>

              @if (d.statut === 'EN_ATTENTE' && canDecide()) {
                <div class="decision-card__form">
                  <textarea
                    rows="2"
                    placeholder="Observation de décision (obligatoire)"
                    [(ngModel)]="obs[d.idDemandeRetrait]"
                  ></textarea>
                  @if (decisionErr(d.idDemandeRetrait)) {
                    <span class="cnm-field__hint">{{ decisionErr(d.idDemandeRetrait) }}</span>
                  }
                  <div class="decision-card__actions">
                    <button type="button" class="cnm-btn cnm-btn--success" (click)="decider(d, 'APPROUVE')">
                      Approuver
                    </button>
                    <button type="button" class="cnm-btn cnm-btn--danger" (click)="decider(d, 'REJETE')">
                      Rejeter
                    </button>
                  </div>
                </div>
              } @else if (d.obsDecision) {
                <p class="decision-card__obs">Décision : {{ d.obsDecision }}</p>
              }
            </li>
          } @empty {
            <li class="decisions__info">Aucune demande.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .decisions__title {
      margin: 0 0 1rem;
      font-size: 1.35rem;
      color: var(--cnm-text);
    }
    .decisions__info {
      color: var(--cnm-text-2);
      padding: 0.5rem 0;
    }
    .decisions__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .decision-card {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .decision-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .decision-card__ref {
      font-weight: 600;
      color: var(--cnm-text);
    }
    .decision-card__motif,
    .decision-card__obs {
      margin: 0;
      font-size: 0.85rem;
      color: var(--cnm-text-2);
    }
    .decision-card__form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .decision-card__form textarea {
      border: 1px solid var(--cnm-border-strong);
      border-radius: 0.375rem;
      padding: 0.5rem;
      font: inherit;
      resize: vertical;
    }
    .decision-card__actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
  `,
})
export class CcRetraitsDecision {
  private readonly service = inject(DemandeRetraitService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionsService);
  private readonly toast = inject(ToastService);

  readonly demandes = signal<DemandeRetrait[]>([]);
  readonly loading = signal(false);
  readonly canDecide = computed(() => this.permissions.can('DEMANDE_RETRAIT_DECISION'));

  /** Saisie de l'observation par demande (clé = idDemandeRetrait). */
  obs: Record<number, string> = {};
  /** Erreur de décision par demande (clé = idDemandeRetrait). */
  private readonly decisionErrors = signal<Record<number, string>>({});

  decisionErr(id: number): string | undefined {
    return this.decisionErrors()[id];
  }

  constructor() {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.demandes.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  decider(d: DemandeRetrait, statut: StatutDemandeRetrait): void {
    const observation = (this.obs[d.idDemandeRetrait] ?? '').trim();
    if (!observation) {
      this.toast.error("L'observation de décision est obligatoire.");
      return;
    }
    const body: DemandeRetrait = {
      ...d,
      statut,
      imCtrlCc: this.auth.ref() ?? '',
      obsDecision: observation,
      dateDecision: new Date().toISOString().slice(0, 19),
    };
    this.decisionErrors.update((e) => ({ ...e, [d.idDemandeRetrait]: '' }));
    this.service.update(d.idDemandeRetrait, body).subscribe({
      next: () => {
        this.toast.success(statut === 'APPROUVE' ? 'Retrait approuvé.' : 'Retrait rejeté.');
        this.charger();
      },
      error: (err: ApiError) => {
        // 400 → message du champ obsDecision sous la zone ; 409/autre → toast global (étape A).
        const msg = getFieldError(err, 'obsDecision');
        if (msg) {
          this.decisionErrors.update((e) => ({ ...e, [d.idDemandeRetrait]: msg }));
        }
      },
    });
  }
}
