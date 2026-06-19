import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { Dossier, EchangeDto } from '../../models';
import { DossierService, EntiteContractService, ReferenceLookupService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/** Carte = un dossier clôturé + son fil chronologique d'échanges. */
interface CarteCloture {
  dossier: Dossier;
  echanges: EchangeDto[];
}

/**
 * « Dossiers vérifiés / clôturés » (Vérificateur) et « Dossiers vérifiés » (PRMP) — LECTURE SEULE.
 * Liste des dossiers CLOTURE (source serveur selon le profil via `route.data.source`) et, par dossier,
 * le fil chronologique des échanges (`GET /api/dossiers/{id}/historique-echanges`, trié ASC).
 */
@Component({
  selector: 'app-dossiers-clotures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="dc">
      <header class="dc__header">
        <span class="cnm-section-label">{{ source === 'prmp-clotures' ? 'Domaine PRMP' : 'Domaine Vérificateur' }}</span>
        <h1 class="dc__title">{{ titre }}</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (cartes().length) {
        <ul class="dc__list">
          @for (c of cartes(); track c.dossier.idDossier) {
            <li class="cnm-card dc__item">
              <div class="dc__item-head">
                <span class="dc__ref">{{ c.dossier.refeDossier || ('Dossier #' + c.dossier.idDossier) }} · {{ entiteLabel(c.dossier) }}</span>
                <app-statut-badge [statut]="c.dossier.statut" />
              </div>
              <div class="dc__hist">
                <h3 class="dc__hist-title">Historique des échanges</h3>
                @if (c.echanges.length) {
                  <ul class="dc__ech">
                    @for (e of c.echanges; track $index; let last = $last) {
                      <li
                        class="dc__ech-item"
                        [class.dc__ech-item--rectif]="e.type === 'RECTIFICATION'"
                        [class.dc__ech-item--final]="last && e.obsLevees"
                      >
                        <span class="dc__ech-meta cnm-mono">{{ e.date }} · {{ e.acteur }}</span>
                        <span class="dc__ech-label">{{ e.type === 'OBSERVATION' ? 'Observation' : 'Rectification PRMP reçue' }}</span>
                        <span class="dc__ech-text">{{ e.texte }}</span>
                        @if (e.type === 'OBSERVATION' && e.obsLevees) {
                          <span class="cnm-badge cnm-badge--success">{{ last ? 'Dossier clôturé — observations levées' : 'Observations levées' }}</span>
                        }
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="cnm-muted">Aucun échange enregistré.</p>
                }
              </div>
            </li>
          }
        </ul>

        @if (source === 'verifies' && totalPages() > 1) {
          <div class="dc__pager">
            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="dc__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      } @else {
        <p class="cnm-muted">Aucun dossier clôturé.</p>
      }
    </section>
  `,
  styles: `
    .dc__header { margin-bottom: var(--cnm-space-3); }
    .dc__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .dc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .dc__item { padding: var(--cnm-space-3) var(--cnm-space-4); }
    .dc__item-head { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .dc__ref { font-weight: var(--cnm-fw-semibold); }
    .dc__hist { margin-top: var(--cnm-space-2); }
    .dc__hist-title { margin: 0 0 var(--cnm-space-1); font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .dc__ech { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .dc__ech-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--cnm-space-2); padding: var(--cnm-space-1) var(--cnm-space-2); border-left: 2px solid var(--cnm-border); }
    .dc__ech-item--rectif { border-left-color: var(--cnm-warning-fg); }
    .dc__ech-item--final { border-left-color: var(--cnm-success-fg); background: var(--cnm-surface-2); }
    .dc__ech-meta { color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .dc__ech-label { font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-2); }
    .dc__ech-text { font-size: var(--cnm-fs-sm); }
    .dc__pager { display: flex; align-items: center; gap: var(--cnm-space-3); justify-content: flex-end; margin-top: var(--cnm-space-3); }
    .dc__pager-info { font-size: var(--cnm-fs-sm); color: var(--cnm-text-2); }
  `,
})
export class DossiersClotures {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly source = this.route.snapshot.data['source'] as 'verifies' | 'prmp-clotures';
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Dossiers vérifiés';
  readonly loading = signal(true);
  readonly cartes = signal<CarteCloture[]>([]);
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.charger(0);
  }

  private charger(page: number): void {
    this.loading.set(true);
    if (this.source === 'prmp-clotures') {
      this.dossierService.list('CLOTURE').subscribe({
        next: (rows) => this.chargerHistoriques(rows),
        error: () => this.loading.set(false),
      });
    } else {
      this.dossierService.verifies(page, this.pageSize).subscribe({
        next: (p) => {
          this.pageIndex.set(p.number);
          this.totalPages.set(p.totalPages);
          this.chargerHistoriques(p.content);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  /** Charge le fil de chaque dossier (un appel /historique-echanges par dossier ; échec → fil vide). */
  private chargerHistoriques(dossiers: Dossier[]): void {
    if (!dossiers.length) {
      this.cartes.set([]);
      this.loading.set(false);
      return;
    }
    forkJoin(
      dossiers.map((d) =>
        this.dossierService.historiqueEchanges(d.idDossier).pipe(
          map((echanges) => ({ dossier: d, echanges })),
          catchError(() => of({ dossier: d, echanges: [] as EchangeDto[] })),
        ),
      ),
    ).subscribe({
      next: (cartes) => {
        this.cartes.set(cartes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevPage(): void {
    if (this.pageIndex() > 0) {
      this.charger(this.pageIndex() - 1);
    }
  }
  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.charger(this.pageIndex() + 1);
    }
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
}
