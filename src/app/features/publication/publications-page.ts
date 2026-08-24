import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Publication } from '../../models';
import { PublicationService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * Portail de transparence (§3.7) : gestion des publications par le CHARGE_PUBLICATION.
 * Cycle EN_ATTENTE → PUBLIE → RETIRE (le backend valide les transitions, 409 sinon).
 */
@Component({
  selector: 'app-publications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatutBadge, EtatErreur],
  template: `
    <section class="pub">
      <header class="page-header">
        <h1 class="page-title">Publications</h1>
        @if (canManage()) {
          <button type="button" class="btn btn-primary" (click)="toggleForm()">
            {{ formOpen() ? 'Fermer' : '+ Nouvelle publication' }}
          </button>
        }
      </header>

      @if (formOpen()) {
        <form class="card pub__form" [formGroup]="form" (ngSubmit)="creer()" novalidate>
          <div class="form-group">
            <label class="form-label required">Identifiant</label>
            <input class="form-control" type="number" formControlName="idPublication" />
            @if (fieldErr('idPublication')) { <span class="form-error">{{ fieldErr('idPublication') }}</span> }
          </div>
          <div class="form-group">
            <label class="form-label required">Type d'objet</label>
            <input class="form-control" type="text" formControlName="typeObjet" placeholder="PPM, MARCHE…" />
            @if (fieldErr('typeObjet')) { <span class="form-error">{{ fieldErr('typeObjet') }}</span> }
          </div>
          <div class="form-group">
            <label class="form-label required">Identifiant de l'objet</label>
            <input class="form-control" type="number" formControlName="idObjet" />
            @if (fieldErr('idObjet')) { <span class="form-error">{{ fieldErr('idObjet') }}</span> }
          </div>
          <div class="pub__form-actions">
            <button type="submit" class="btn btn-primary">Créer</button>
          </div>
        </form>
      }

      @if (loading()) {
        <p class="pub__info" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les publications." (reessayer)="charger()" />
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Objet</th>
                <th scope="col">Statut</th>
                <th scope="col">Consultations</th>
                <th scope="col">Actions</th>
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
                    <button type="button" class="btn btn-secondary btn-sm" (click)="consulter(p)">Consulter</button>
                    @if (canManage()) {
                      @if (p.statutPubli === 'EN_ATTENTE') {
                        <button type="button" class="btn btn-success btn-sm" (click)="publier(p)">Publier</button>
                      }
                      @if (p.statutPubli === 'PUBLIE') {
                        <button type="button" class="btn btn-danger btn-sm" (click)="retirer(p)">Retirer</button>
                      }
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="pub__info">Aucune publication.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .pub__info {
      color: var(--n-400);
      text-align: center;
      padding: 0.5rem;
    }
    .pub__form {
      padding: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 28rem;
    }
    .pub__form .form-group { margin-bottom: 0; }
    .pub__form-actions {
      display: flex;
      justify-content: flex-end;
    }
    .pub__actions {
      display: flex;
      gap: 0.375rem;
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
  /** Échec du chargement de la liste (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
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
    this.erreur.set(false);
    this.service.list().subscribe({
      next: (rows) => {
        this.publications.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
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
