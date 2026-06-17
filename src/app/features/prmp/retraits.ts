import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, getFieldError } from '../../core/errors/api-error';
import { DemandeRetrait } from '../../models';
import { DemandeRetraitService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Demandes de retrait de la PRMP : suivi de ses demandes + création motivée.
 * À la création, `statut` est forcé EN_ATTENTE et `dateDemande` horodatée côté client.
 * La décision (APPROUVE/REJETE) appartient au CC (espace dédié) ; ici lecture seule.
 */
@Component({
  selector: 'app-prmp-retraits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatutBadge],
  template: `
    <section class="retraits">
      <header class="retraits__header">
        <h1 class="retraits__title">Demandes de retrait</h1>
        @if (canCreate()) {
          <button type="button" class="cnm-btn cnm-btn--primary" (click)="toggleForm()">
            {{ formOpen() ? 'Fermer' : '+ Nouvelle demande' }}
          </button>
        }
      </header>

      @if (formOpen()) {
        <form class="retraits__form" [formGroup]="form" (ngSubmit)="creer()" novalidate>
          <label class="field">
            <span class="field__label">Identifiant demande *</span>
            <input type="number" formControlName="idDemandeRetrait" />
            @if (fieldErr('idDemandeRetrait')) { <span class="cnm-field__hint">{{ fieldErr('idDemandeRetrait') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Dossier *</span>
            <input type="number" formControlName="idDossier" />
            @if (fieldErr('idDossier')) { <span class="cnm-field__hint">{{ fieldErr('idDossier') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Motif du retrait *</span>
            <textarea rows="3" formControlName="motifRetrait"></textarea>
            @if (fieldErr('motifRetrait')) { <span class="cnm-field__hint">{{ fieldErr('motifRetrait') }}</span> }
          </label>
          <div class="retraits__form-actions">
            <button type="submit" class="cnm-btn cnm-btn--primary">Soumettre la demande</button>
          </div>
        </form>
      }

      @if (loading()) {
        <p class="retraits__info">Chargement…</p>
      } @else {
        <table class="retraits__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Dossier</th>
              <th>Motif</th>
              <th>Statut</th>
              <th>Observation décision</th>
            </tr>
          </thead>
          <tbody>
            @for (d of demandes(); track d.idDemandeRetrait) {
              <tr>
                <td>{{ d.idDemandeRetrait }}</td>
                <td>{{ d.idDossier }}</td>
                <td>{{ d.motifRetrait }}</td>
                <td><app-statut-badge [statut]="d.statut" /></td>
                <td>{{ d.obsDecision || '—' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="retraits__info">Aucune demande.</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .retraits__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--cnm-space-4);
    }
    .retraits__title {
      margin: 0;
      font-size: var(--cnm-fs-lg);
    }
    .retraits__info {
      color: var(--cnm-text-2);
      text-align: center;
      padding: var(--cnm-space-3);
    }
    .retraits__form {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius);
      padding: var(--cnm-space-4);
      margin-bottom: var(--cnm-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-3);
      max-width: 32rem;
    }
    .retraits__form-actions {
      display: flex;
      justify-content: flex-end;
    }
    .retraits__table {
      width: 100%;
      border-collapse: collapse;
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius);
      overflow: hidden;
      font-size: var(--cnm-fs-sm);
    }
    .retraits__table th,
    .retraits__table td {
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--cnm-border);
    }
    .retraits__table th {
      background: var(--cnm-surface-2);
      color: var(--cnm-text-3);
      font-size: var(--cnm-fs-micro);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: var(--cnm-fw-medium);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-1);
    }
    .field__label {
      font-size: var(--cnm-fs-sm);
      font-weight: var(--cnm-fw-medium);
      color: var(--cnm-text-2);
    }
    .field input,
    .field textarea {
      font: inherit;
      color: var(--cnm-text);
      background: var(--cnm-bg);
      border: 1px solid var(--cnm-border-strong);
      border-radius: var(--cnm-radius-sm);
      padding: 0.5rem 0.65rem;
    }
  `,
})
export class PrmpRetraits {
  private readonly service = inject(DemandeRetraitService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly demandes = signal<DemandeRetrait[]>([]);
  readonly loading = signal(false);
  readonly formOpen = signal(false);
  readonly canCreate = computed(() => this.permissions.can('DEMANDE_RETRAIT_CREATE'));
  readonly formError = signal<ApiError | null>(null);

  fieldErr(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }

  readonly form = this.fb.nonNullable.group({
    idDemandeRetrait: [null as number | null, Validators.required],
    idDossier: [null as number | null, Validators.required],
    motifRetrait: ['', Validators.required],
  });

  constructor() {
    this.charger();
  }

  toggleForm(): void {
    this.formOpen.update((v) => !v);
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

  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.formError.set(null);
    const v = this.form.getRawValue();
    const body: DemandeRetrait = {
      idDemandeRetrait: v.idDemandeRetrait as number,
      idDossier: v.idDossier as number,
      idPrmp: this.auth.ref() ?? '',
      motifRetrait: v.motifRetrait,
      dateDemande: new Date().toISOString().slice(0, 19),
      statut: 'EN_ATTENTE',
    };
    this.service.create(body).subscribe({
      next: () => {
        this.toast.success('Demande de retrait soumise.');
        this.form.reset();
        this.formOpen.set(false);
        this.charger();
      },
      error: (err: ApiError) => {
        // 400 → fieldErrors sous les champs ; 409/autre → toast global (étape A).
        this.formError.set(err);
      },
    });
  }
}
