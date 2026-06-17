import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, MarchePrevision, Ppm } from '../../models';
import {
  MarcheService,
  MarchePrevisionService,
  ModePassationService,
  PpmService,
  PrmpService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Vue Président combinée (lecture, toutes localités) : PPM → marchés → dates prévisionnelles.
 * Chaque PPM (dépliable) montre son PRMP (résolu) et ses marchés ; un bouton par marché ouvre
 * une modale avec ses dates prévisionnelles, chargées à la demande via byMarche().
 * Aucune jointure de filtrage maison : le backend renvoie déjà tout le périmètre Président.
 */
@Component({
  selector: 'app-president-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="ppd">
      <header class="ppd__header">
        <span class="cnm-section-label">Supervision</span>
        <h1 class="ppd__title">PPM, marchés &amp; dates prévisionnelles</h1>
      </header>

      @if (loading()) {
        <p class="ppd__info">Chargement…</p>
      } @else {
        @for (ppm of ppms(); track ppm.idPpm) {
          <div class="cnm-card ppd__ppm">
            <button type="button" class="ppd__head" (click)="togglePpm(ppm.idPpm)" [attr.aria-expanded]="isOpen(ppm.idPpm)">
              <span class="ppd__chevron">{{ isOpen(ppm.idPpm) ? '▾' : '▸' }}</span>
              <span class="ppd__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
              <span class="ppd__sub">
                Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }} · PRMP : {{ prmpLabel(ppm) }}
              </span>
              <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
            </button>

            @if (isOpen(ppm.idPpm)) {
              <div class="ppd__detail cnm-marches">
                @if (marchesOf(ppm.idPpm).length === 0) {
                  <p class="ppd__empty">Aucun marché rattaché à ce PPM.</p>
                } @else {
                  <table class="cnm-table">
                    <thead>
                      <tr>
                        <th>Réf.</th><th>Désignation</th><th class="cnm-num">Montant estimé</th>
                        <th>Mode</th><th>Statut</th><th>Dates prév.</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of marchesOf(ppm.idPpm); track m.idDetail) {
                        <tr>
                          <td class="cnm-mono">{{ m.idDetail }}</td>
                          <td>{{ m.designationMarche || '—' }}</td>
                          <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                          <td>{{ resolve(modeMap(), m.idMode) }}</td>
                          <td><app-statut-badge [statut]="m.statut" /></td>
                          <td>
                            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirDates(m)">
                              Voir les dates prévisionnelles
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="ppd__info">Aucun PPM.</p>
        }
      }
    </section>

    @if (modalMarche(); as m) {
      <div class="ppd-modal__overlay" (click)="fermerDates()">
        <div class="ppd-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="ppd-modal__head">
            <h2 class="ppd-modal__title">Dates prévisionnelles — {{ m.designationMarche || 'Marché #' + m.idDetail }}</h2>
            <button type="button" class="ppd-modal__close" aria-label="Fermer" (click)="fermerDates()">&times;</button>
          </header>
          <div class="ppd-modal__body">
            @if (modalLoading()) {
              <p class="ppd__info">Chargement des dates…</p>
            } @else if (modalData().length) {
              <table class="cnm-table">
                <thead><tr><th>Type</th><th>Date prévue</th></tr></thead>
                <tbody>
                  @for (p of modalData(); track p.idPrevision) {
                    <tr><td>{{ p.typeDate }}</td><td class="cnm-mono">{{ p.datePrev || '—' }}</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="ppd__info">Aucune date prévisionnelle pour ce marché.</p>
            }
          </div>
          <footer class="ppd-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="fermerDates()">Fermer</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .ppd__header { margin-bottom: var(--cnm-space-4); }
    .ppd__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .ppd__info, .ppd__empty { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); }
    .ppd__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .ppd__head {
      display: flex; align-items: center; gap: var(--cnm-space-3); width: 100%;
      padding: var(--cnm-space-3) var(--cnm-space-4); background: transparent; border: 0;
      color: var(--cnm-text); cursor: pointer; text-align: left; font: inherit;
    }
    .ppd__head:hover { background: var(--cnm-surface-2); }
    .ppd__chevron { color: var(--cnm-text-3); width: 1rem; }
    .ppd__ref { font-weight: var(--cnm-fw-semibold); }
    .ppd__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
    .ppd__detail { border-top: 1px solid var(--cnm-border); }
    .ppd-modal__overlay {
      position: fixed; inset: 0; z-index: 1050; background: rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; justify-content: center; padding: var(--cnm-space-4);
    }
    .ppd-modal { width: 100%; max-width: 32rem; max-height: 85vh; overflow: auto; box-shadow: var(--cnm-shadow); }
    .ppd-modal__head {
      display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-3);
      padding: var(--cnm-space-4) var(--cnm-space-5); border-bottom: 1px solid var(--cnm-border);
    }
    .ppd-modal__title { margin: 0; font-size: var(--cnm-fs-md); }
    .ppd-modal__close { background: transparent; border: 0; color: var(--cnm-text-2); font-size: 1.5rem; line-height: 1; cursor: pointer; }
    .ppd-modal__close:hover { color: var(--cnm-text); }
    .ppd-modal__body { padding: var(--cnm-space-4) var(--cnm-space-5); }
    .ppd-modal__foot { display: flex; justify-content: flex-end; padding: var(--cnm-space-3) var(--cnm-space-5); border-top: 1px solid var(--cnm-border); }
  `,
})
export class PresidentPpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly modeMap = signal<Map<string, string>>(new Map());
  readonly prmpMap = signal<Map<string, string>>(new Map());
  private readonly expanded = signal<Set<number>>(new Set());

  readonly modalMarche = signal<Marche | null>(null);
  readonly modalLoading = signal(false);
  readonly modalData = signal<MarchePrevision[]>([]);

  private readonly byPpm = computed(() => {
    const map = new Map<number, Marche[]>();
    for (const m of this.marches()) {
      const list = map.get(m.idPpm) ?? [];
      list.push(m);
      map.set(m.idPpm, list);
    }
    return map;
  });

  constructor() {
    this.loading.set(true);
    this.ppmService.list().subscribe({ next: (r) => this.ppms.set(r), error: () => this.loading.set(false) });
    this.marcheService.list().subscribe({
      next: (r) => { this.marches.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(PrmpService, 'idPrmp', ['nomPrmp', 'prenomsPrmp']).subscribe((m) => this.prmpMap.set(m));
  }

  marchesOf(idPpm: number): Marche[] { return this.byPpm().get(idPpm) ?? []; }
  isOpen(idPpm: number): boolean { return this.expanded().has(idPpm); }
  togglePpm(idPpm: number): void {
    this.expanded.update((s) => {
      const n = new Set(s);
      if (n.has(idPpm)) { n.delete(idPpm); } else { n.add(idPpm); }
      return n;
    });
  }
  prmpLabel(ppm: Ppm): string {
    if (!ppm.idPrmp) return '—';
    return this.prmpMap().get(ppm.idPrmp) ?? ppm.idPrmp;
  }

  ouvrirDates(m: Marche): void {
    this.modalMarche.set(m); this.modalLoading.set(true); this.modalData.set([]);
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (data) => { this.modalData.set(data); this.modalLoading.set(false); },
      error: () => this.modalLoading.set(false),
    });
  }
  fermerDates(): void { this.modalMarche.set(null); }

  resolve(map: Map<string, string>, id?: number): string {
    if (id === null || id === undefined) return '—';
    return map.get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string { return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v); }
}
