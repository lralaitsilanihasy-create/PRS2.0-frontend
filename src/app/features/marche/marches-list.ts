import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Marche } from '../../models';
import { MarcheService, PpmService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

const PAGE_SIZE = 15;

/**
 * Liste des Marchés. Peut être filtrée par PPM via le query param `?ppm=<idPpm>`
 * (lien « Voir ses marchés » depuis l'écran PPM). La relation PPM → Marché se
 * reconstruit côté client (jointure sur `idPpm`), faute d'endpoint imbriqué.
 */
@Component({
  selector: 'app-marches-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, RouterLink],
  template: `
    <section class="marches">
      <header class="marches__header">
        <div>
          <span class="cnm-section-label">Domaine PRMP</span>
          <h1 class="marches__title">Marchés</h1>
        </div>
        <span class="cnm-badge cnm-badge--neutral">{{ visibleMarches().length }} marché(s)</span>
      </header>

      @if (ppmFilter()) {
        <div class="marches__filter">
          <span>
            Filtré sur le PPM
            <strong>{{ ppmRef() || ('#' + ppmFilter()) }}</strong>
          </span>
          <a class="cnm-btn cnm-btn--ghost cnm-btn--sm" routerLink="/prmp/marches">
            Voir tous les marchés
          </a>
        </div>
      }

      <div class="cnm-table-wrap">
        <table class="cnm-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>PPM</th>
              <th>Dossier</th>
              <th>Compte</th>
              <th class="cnm-num">Montant estimé</th>
              <th>Financement</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="7" class="cnm-table__empty">Chargement…</td></tr>
            } @else {
              @for (m of pageItems(); track m.idDetail) {
                <tr>
                  <td>{{ m.designationMarche || '—' }}</td>
                  <td class="cnm-mono">{{ m.idPpm }}</td>
                  <td class="cnm-mono">{{ m.idDossier }}</td>
                  <td class="cnm-mono">{{ m.numCompte || '—' }}</td>
                  <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                  <td>{{ m.financement || '—' }}</td>
                  <td><app-statut-badge [statut]="m.statut" /></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="cnm-table__empty">Aucun marché.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="marches__pager" aria-label="Pagination">
          <button class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="page() === 0" (click)="prev()">
            ‹ Précédent
          </button>
          <span class="marches__pager-info">Page {{ page() + 1 }} / {{ totalPages() }}</span>
          <button
            class="cnm-btn cnm-btn--ghost cnm-btn--sm"
            [disabled]="page() >= totalPages() - 1"
            (click)="next()"
          >
            Suivant ›
          </button>
        </nav>
      }
    </section>
  `,
  styles: `
    .marches__header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: var(--cnm-space-4);
    }
    .marches__title {
      margin: 2px 0 0;
      font-size: var(--cnm-fs-lg);
    }
    .marches__filter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cnm-space-3);
      padding: var(--cnm-space-2) var(--cnm-space-4);
      margin-bottom: var(--cnm-space-3);
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-left: 3px solid var(--cnm-brand);
      border-radius: var(--cnm-radius);
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
    }
    .marches__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--cnm-space-3);
      margin-top: var(--cnm-space-3);
    }
    .marches__pager-info {
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
      font-family: var(--cnm-mono);
    }
  `,
})
export class MarchesList {
  private readonly service = inject(MarcheService);
  private readonly ppmService = inject(PpmService);
  private readonly route = inject(ActivatedRoute);

  readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly ppmFilter = signal<string | null>(null);
  readonly ppmRef = signal<string | null>(null);

  readonly visibleMarches = computed(() => {
    const all = this.marches();
    const f = this.ppmFilter();
    return f ? all.filter((m) => String(m.idPpm) === f) : all;
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.visibleMarches().length / PAGE_SIZE)),
  );
  readonly pageItems = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.visibleMarches().slice(start, start + PAGE_SIZE);
  });

  constructor() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.marches.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Réagit au filtre PPM passé en query param (lien depuis l'écran PPM).
    this.route.queryParamMap.subscribe((params) => {
      const ppm = params.get('ppm');
      this.ppmFilter.set(ppm);
      this.page.set(0);
      this.ppmRef.set(null);
      if (ppm) {
        this.ppmService.getById(Number(ppm)).subscribe({
          next: (p) => this.ppmRef.set(p.reference ?? `#${ppm}`),
          error: () => this.ppmRef.set(null),
        });
      }
    });
  }

  montant(value?: number): string {
    if (value === null || value === undefined) {
      return '—';
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  prev(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  next(): void {
    this.page.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }
}
