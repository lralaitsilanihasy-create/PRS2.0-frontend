import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Publication } from '../../models';
import { PublicationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Portail de transparence (§3.7) : gestion des publications par le CHARGE_PUBLICATION.
 * Cycle EN_ATTENTE → PUBLIE → RETIRE (le backend valide les transitions, 409 sinon).
 */
@Component({
  selector: 'app-publications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatutBadge],
  template: `
    <section class="pub">
      <header class="pub__header">
        <h1 class="pub__title">Publications</h1>
        @if (canManage()) {
          <button type="button" class="cnm-btn cnm-btn--primary" (click)="toggleForm()">
            {{ formOpen() ? 'Fermer' : '+ Nouvelle publication' }}
          </button>
        }
      </header>

      @if (formOpen()) {
        <form class="pub__form" [formGroup]="form" (ngSubmit)="creer()" novalidate>
          <label class="field">
            <span class="field__label">Identifiant *</span>
            <input type="number" formControlName="idPublication" />
            @if (fieldErr('idPublication')) { <span class="cnm-field__hint">{{ fieldErr('idPublication') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Type d'objet *</span>
            <input type="text" formControlName="typeObjet" placeholder="PPM, MARCHE…" />
            @if (fieldErr('typeObjet')) { <span class="cnm-field__hint">{{ fieldErr('typeObjet') }}</span> }
          </label>
          <label class="field">
            <span class="field__label">Identifiant de l'objet *</span>
            <input type="number" formControlName="idObjet" />
            @if (fieldErr('idObjet')) { <span class="cnm-field__hint">{{ fieldErr('idObjet') }}</span> }
          </label>
          <div class="pub__form-actions">
            <button type="submit" class="cnm-btn cnm-btn--primary">Créer</button>
          </div>
        </form>
      }

      @if (loading()) {
        <p class="pub__info">Chargement…</p>
      } @else {
        <table class="pub__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Objet</th>
              <th>Statut</th>
              <th>Consultations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of publications(); track p.idPublication) {
              <tr>
                <td>{{ p.idPublication }}</td>
                <td>{{ p.typeObjet }} #{{ p.idObjet }}</td>
                <td><app-statut-badge [statut]="p.statutPubli" /></td>
                <td>{{ p.nbConsultations ?? 0 }}</td>
                <td class="pub__actions">
                  <button type="button" class="cnm-btn cnm-btn--ghost" (click)="consulter(p)">Consulter</button>
                  @if (canManage()) {
                    @if (p.statutPubli === 'EN_ATTENTE') {
                      <button type="button" class="cnm-btn cnm-btn--success" (click)="publier(p)">Publier</button>
                    }
                    @if (p.statutPubli === 'PUBLIE') {
                      <button type="button" class="cnm-btn cnm-btn--danger" (click)="retirer(p)">Retirer</button>
                    }
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="pub__info">Aucune publication.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .pub__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .pub__title {
      margin: 0;
      font-size: 1.35rem;
      color: var(--cnm-text);
    }
    .pub__info {
      color: var(--cnm-text-2);
      text-align: center;
      padding: 0.5rem;
    }
    .pub__form {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 28rem;
    }
    .pub__form-actions {
      display: flex;
      justify-content: flex-end;
    }
    .pub__table {
      width: 100%;
      border-collapse: collapse;
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    .pub__table th,
    .pub__table td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--cnm-border);
    }
    .pub__table th {
      background: var(--cnm-surface-2);
      font-weight: 600;
    }
    .pub__actions {
      display: flex;
      gap: 0.375rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .field__label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--cnm-text-2);
    }
    .field input {
      color: var(--cnm-text);
      background: var(--cnm-bg);
      border: 1px solid var(--cnm-border-strong);
      border-radius: 0.375rem;
      padding: 0.45rem 0.6rem;
    }
  `,
})
export class PublicationsPage {
  private readonly service = inject(PublicationService);
  private readonly permissions = inject(PermissionsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly publications = signal<Publication[]>([]);
  readonly loading = signal(false);
  readonly formOpen = signal(false);
  readonly canManage = computed(() => this.permissions.can('PUBLICATION_MANAGE'));
  readonly formError = signal<ApiError | null>(null);

  fieldErr(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }

  readonly form = this.fb.nonNullable.group({
    idPublication: [null as number | null, Validators.required],
    typeObjet: ['', Validators.required],
    idObjet: [null as number | null, Validators.required],
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
        this.publications.set(rows);
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
    const body: Publication = {
      idPublication: v.idPublication as number,
      typeObjet: v.typeObjet,
      idObjet: v.idObjet as number,
    };
    this.service.create(body).subscribe({
      next: () => {
        this.toast.success('Publication créée.');
        this.form.reset();
        this.formOpen.set(false);
        this.charger();
      },
      error: (err: ApiError) => this.formError.set(err),
    });
  }

  publier(p: Publication): void {
    this.service.publier(p.idPublication).subscribe({
      next: () => {
        this.toast.success('Publication publiée.');
        this.charger();
      },
    });
  }

  retirer(p: Publication): void {
    const motif = prompt('Motif du retrait :')?.trim();
    if (!motif) {
      return;
    }
    this.service.retirer(p.idPublication, { motifRetrait: motif }).subscribe({
      next: () => {
        this.toast.success('Publication retirée.');
        this.charger();
      },
    });
  }

  consulter(p: Publication): void {
    this.service.consulter(p.idPublication).subscribe({
      next: () => this.charger(),
    });
  }
}
