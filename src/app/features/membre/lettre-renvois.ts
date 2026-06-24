import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, LettreRenvoi } from '../../models';
import { DossierService, LettreRenvoiService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * « Projets de lettre de renvoi » (MEMBRE) — liste des lettres (`GET /api/lettre-renvois`).
 * La signature (`SOUMIS → SIGNE`) n'est offerte qu'aux profils `CHEF_COMMISSION`/`PRESIDENT`.
 */
@Component({
  selector: 'app-lettre-renvois',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="lr">
      <header class="lr__header">
        <span class="cnm-section-label">Domaine Membre</span>
        <h1 class="lr__title">Projets de lettre de renvoi</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Référence dossier</th><th>Objet</th><th>Date lettre</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            @for (l of lettres(); track l.idLettre) {
              <tr>
                <td>{{ refDossier(l) }}</td>
                <td>{{ l.objetLettre || '—' }}</td>
                <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                <td><app-statut-badge [statut]="l.statut" /></td>
                <td class="lr__actions">
                  @if (peutSigner() && l.statut === 'SOUMIS') {
                    <button
                      type="button"
                      class="cnm-btn cnm-btn--primary cnm-btn--sm"
                      [disabled]="signature() === l.idLettre"
                      (click)="signer(l)"
                    >
                      {{ signature() === l.idLettre ? 'Signature…' : 'Signer' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="cnm-muted">Aucun projet de lettre de renvoi.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .lr__header { margin-bottom: var(--cnm-space-3); }
    .lr__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .lr__actions { display: flex; justify-content: flex-end; }
  `,
})
export class LettreRenvoiList {
  private readonly service = inject(LettreRenvoiService);
  private readonly dossierService = inject(DossierService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly lettres = signal<LettreRenvoi[]>([]);
  readonly loading = signal(true);
  readonly signature = signal<number | null>(null);
  private readonly dossierRefs = signal<Map<number, string>>(new Map());

  /** Seuls CC / Président peuvent signer une lettre (jamais le Membre). */
  readonly peutSigner = signal(this.auth.hasRole('CHEF_COMMISSION', 'PRESIDENT'));

  constructor() {
    this.dossierService
      .list()
      .subscribe((rows: Dossier[]) =>
        this.dossierRefs.set(new Map(rows.map((d) => [d.idDossier, d.refeDossier ?? '']))),
      );
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next: (rows) => {
        this.lettres.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refDossier(l: LettreRenvoi): string {
    const ref = l.idDossier != null ? this.dossierRefs().get(l.idDossier) : '';
    return ref || l.refLettre || (l.idDossier != null ? 'Dossier #' + l.idDossier : '—');
  }

  signer(l: LettreRenvoi): void {
    if (l.idLettre == null) {
      return;
    }
    this.signature.set(l.idLettre);
    this.service.signer(l.idLettre).subscribe({
      next: (maj) => {
        this.toast.success('Lettre de renvoi signée.');
        this.lettres.update((arr) => arr.map((x) => (x.idLettre === maj.idLettre ? maj : x)));
        this.signature.set(null);
      },
      error: (e: ApiError) => {
        this.signature.set(null);
        this.toast.error(
          e.status === 403
            ? 'Seuls le Chef de commission ou le Président peuvent signer.'
            : e.status === 409
              ? "Cette lettre n'est pas au statut « Soumis »."
              : e.message || 'Erreur lors de la signature.',
        );
      },
    });
  }
}
