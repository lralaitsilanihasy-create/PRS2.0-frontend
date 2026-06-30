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
            <tr><th>Référence dossier</th><th>Date lettre</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            @for (l of lettres(); track l.idLettre) {
              <tr>
                <td>{{ refDossier(l) }}</td>
                <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                <td><app-statut-badge [statut]="l.statut" /></td>
                <td class="lr__actions">
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="basculer(l)">
                    {{ ouvert() === l.idLettre ? 'Masquer' : 'Détails' }}
                  </button>
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
              @if (ouvert() === l.idLettre) {
                <tr class="lr__detail">
                  <td colspan="4">
                    <dl class="lr__detail-dl">
                      <div><dt>Corps de la lettre</dt><dd class="lr__corps">{{ l.corpsLettre || '—' }}</dd></div>
                      @if (l.refLettre) { <div><dt>Référence lettre</dt><dd class="cnm-mono">{{ l.refLettre }}</dd></div> }
                    </dl>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="4" class="cnm-muted">Aucun projet de lettre de renvoi.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .lr__header { margin-bottom: var(--cnm-space-3); }
    .lr__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .lr__actions { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); }
    .lr__detail-dl { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: 0; }
    .lr__detail-dl > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .lr__detail-dl dt { flex: 0 0 10rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .lr__detail-dl dd { margin: 0; }
    .lr__corps { white-space: pre-wrap; }
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
  /** idLettre dont le détail (objet + corps) est déplié. */
  readonly ouvert = signal<number | null>(null);
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

  basculer(l: LettreRenvoi): void {
    this.ouvert.update((cur) => (cur === l.idLettre ? null : (l.idLettre ?? null)));
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
