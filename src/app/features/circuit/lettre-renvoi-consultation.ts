import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, LettreRenvoi } from '../../models';
import { DossierService, LettreRenvoiService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Consultation des lettres de renvoi, partagée par profil via `route.data` :
 * - PRMP (`source = 'mes'`) → `GET /api/lettre-renvois/mes-lettres` (ses lettres SIGNE), lecture seule ;
 * - Assistant contrôleur (`source = 'localite'`) → `GET /api/lettre-renvois` (SIGNE localité), lecture seule ;
 * - CC / Président (`source = 'localite'`, `signable = true`) → `GET /api/lettre-renvois` (SOUMIS à signer) :
 *   bouton « Signer » (`POST …/{id}/signer`) tant que `statut = SOUMIS`.
 *
 * Lien de notification : `…/lettre-renvois/{idLettre}` déplie automatiquement le détail.
 */
@Component({
  selector: 'app-lettre-renvoi-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="lrc">
      <header class="lrc__header">
        <h1 class="lrc__title">{{ titre }}</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Référence lettre</th><th>Dossier</th><th>Objet</th><th>Date lettre</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            @for (l of lettres(); track l.idLettre) {
              <tr>
                <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                <td>{{ refDossier(l) }}</td>
                <td>{{ l.objetLettre || '—' }}</td>
                <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                <td><app-statut-badge [statut]="l.statut" /></td>
                <td class="lrc__actions">
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="basculer(l)">
                    {{ ouvert() === l.idLettre ? 'Masquer' : 'Détails' }}
                  </button>
                  @if (signable && l.statut === 'SOUMIS') {
                    <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" [disabled]="signature() === l.idLettre" (click)="signer(l)">
                      {{ signature() === l.idLettre ? 'Signature…' : 'Signer' }}
                    </button>
                  }
                </td>
              </tr>
              @if (ouvert() === l.idLettre) {
                <tr class="lrc__detail">
                  <td colspan="6">
                    <dl class="lrc__dl">
                      <div><dt>Référence</dt><dd class="cnm-mono">{{ l.refLettre || '—' }}</dd></div>
                      <div><dt>Dossier</dt><dd>{{ refDossier(l) }}</dd></div>
                      <div><dt>Objet</dt><dd>{{ l.objetLettre || '—' }}</dd></div>
                      <div><dt>Corps</dt><dd class="lrc__corps">{{ l.corpsLettre || '—' }}</dd></div>
                      <div><dt>Date d'examen</dt><dd class="cnm-mono">{{ l.dateExamen || '—' }}</dd></div>
                      <div><dt>Date lettre</dt><dd class="cnm-mono">{{ l.dateLettre || '—' }}</dd></div>
                      <div><dt>Statut</dt><dd><app-statut-badge [statut]="l.statut" /></dd></div>
                    </dl>
                    @if (signable && l.statut === 'SOUMIS') {
                      <div class="lrc__detail-foot">
                        <button type="button" class="cnm-btn cnm-btn--primary" [disabled]="signature() === l.idLettre" (click)="signer(l)">
                          {{ signature() === l.idLettre ? 'Signature…' : 'Signer la lettre' }}
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="6" class="cnm-muted">Aucune lettre de renvoi.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .lrc__header { margin-bottom: var(--cnm-space-3); }
    .lrc__title { margin: 0; font-size: var(--cnm-fs-lg); }
    .lrc__actions { display: flex; gap: var(--cnm-space-2); justify-content: flex-end; }
    .lrc__detail-foot { display: flex; justify-content: flex-end; margin-top: var(--cnm-space-2); }
    .lrc__dl { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: 0; }
    .lrc__dl > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .lrc__dl dt { flex: 0 0 10rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .lrc__dl dd { margin: 0; }
    .lrc__corps { white-space: pre-wrap; }
  `,
})
export class LettreRenvoiConsultation {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LettreRenvoiService);
  private readonly dossierService = inject(DossierService);
  private readonly toast = inject(ToastService);

  private readonly source = (this.route.snapshot.data['source'] as 'mes' | 'localite') ?? 'localite';
  /** CC / Président : autorise la signature des lettres SOUMIS. */
  readonly signable = (this.route.snapshot.data['signable'] as boolean) ?? false;
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Lettres de renvoi';
  readonly loading = signal(true);
  readonly lettres = signal<LettreRenvoi[]>([]);
  readonly ouvert = signal<number | null>(null);
  /** idLettre en cours de signature (désactive le bouton). */
  readonly signature = signal<number | null>(null);
  private readonly dossierRefs = signal<Map<number, string>>(new Map());

  constructor() {
    const param = this.route.snapshot.paramMap.get('idLettre');
    if (param) {
      this.ouvert.set(Number(param));
    }
    this.dossierService
      .list()
      .subscribe((rows: Dossier[]) =>
        this.dossierRefs.set(new Map(rows.map((d) => [d.idDossier, d.refeDossier ?? '']))),
      );
    const call = this.source === 'mes' ? this.service.getMesLettres() : this.service.getAll();
    call.subscribe({
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
  /** Signe une lettre SOUMIS (CC/Président) → SIGNE ; met à jour la ligne en place. */
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
  refDossier(l: LettreRenvoi): string {
    const ref = l.idDossier != null ? this.dossierRefs().get(l.idDossier) : '';
    return ref || (l.idDossier != null ? 'Dossier #' + l.idDossier : '—');
  }
}
