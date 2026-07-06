import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, MarchePrevision, Ppm, Prmp, ServiceBeneficiaire } from '../../models';
import {
  MarcheService,
  MarchePrevisionService,
  PpmService,
  PrmpService,
  ServiceBeneficiaireService,
} from '../../services';
import { PpmMarchesTable } from '../../shared/prmp/ppm-marches-table';

/**
 * PRMP → ses marchés, présentés comme le PPM officiel (tableau partagé lecture seule :
 * bénéficiaires + dates prévisionnelles inclus). Marchés d'un PRMP : jointure client
 * PRMP → PPM (idPrmp) → Marché (idPpm). Bénéficiaires/prévisions chargés en bulk et
 * filtrés par les marchés de chaque PRMP. Listes filtrées par le backend selon le profil.
 */
@Component({
  selector: 'app-prmp-marches-previsions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable],
  template: `
    <section class="mdp">
      <header class="mdp__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mdp__title">Marchés & dates prévisionnelles</h1>
      </header>

      @if (loading()) {
        <p class="mdp__info">Chargement…</p>
      } @else {
        @for (prmp of prmps(); track prmp.idPrmp) {
          <div class="cnm-card mdp__prmp">
            <button
              type="button"
              class="mdp__head"
              (click)="togglePrmp(prmp.idPrmp)"
              [attr.aria-expanded]="isPrmpOpen(prmp.idPrmp)"
            >
              <span class="mdp__chevron">{{ isPrmpOpen(prmp.idPrmp) ? '▾' : '▸' }}</span>
              <span class="mdp__ref">{{ prmpLabel(prmp) }}</span>
              <span class="mdp__sub">{{ prmp.idLocalite || '—' }}</span>
              <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(prmp.idPrmp).length }} marché(s)</span>
            </button>

            @if (isPrmpOpen(prmp.idPrmp)) {
              <div class="mdp__detail">
                @if (marchesOf(prmp.idPrmp).length === 0) {
                  <p class="mdp__empty">Aucun marché pour cette PRMP.</p>
                } @else {
                  <app-ppm-marches-table
                    [marches]="marchesOf(prmp.idPrmp)"
                    [beneficiaires]="benefsOf(prmp.idPrmp)"
                    [previsions]="previsionsOf(prmp.idPrmp)"
                  />
                }
              </div>
            }
          </div>
        } @empty {
          <p class="mdp__info">Aucune PRMP dans votre périmètre.</p>
        }
      }
    </section>
  `,
  styles: `
    .mdp__header { margin-bottom: var(--cnm-space-4); }
    .mdp__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .mdp__info,
    .mdp__empty { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); display: inline-block; }
    .mdp__prmp { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .mdp__head {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      width: 100%;
      padding: var(--cnm-space-3) var(--cnm-space-4);
      background: transparent;
      border: 0;
      color: var(--cnm-text);
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .mdp__head:hover { background: var(--cnm-surface-2); }
    .mdp__chevron { color: var(--cnm-text-3); width: 1rem; }
    .mdp__ref { font-weight: var(--cnm-fw-semibold); }
    .mdp__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
    .mdp__detail { border-top: 1px solid var(--cnm-border); padding: var(--cnm-space-3); }
  `,
})
export class PrmpMarchesPrevisions {
  private readonly prmpService = inject(PrmpService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);

  readonly prmps = signal<Prmp[]>([]);
  private readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  private readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  private readonly previsions = signal<MarchePrevision[]>([]);
  readonly loading = signal(false);
  private readonly expandedPrmp = signal<Set<string>>(new Set());

  /** marchés par PRMP : PRMP → PPM (idPrmp) → Marché (idPpm). */
  private readonly byPrmp = computed(() => {
    const ppmIds = new Map<string, Set<number>>();
    for (const ppm of this.ppms()) {
      if (ppm.idPrmp) {
        const set = ppmIds.get(ppm.idPrmp) ?? new Set<number>();
        set.add(ppm.idPpm);
        ppmIds.set(ppm.idPrmp, set);
      }
    }
    const result = new Map<string, Marche[]>();
    const allMarches = this.marches();
    for (const prmp of this.prmps()) {
      const ids = ppmIds.get(prmp.idPrmp) ?? new Set<number>();
      result.set(
        prmp.idPrmp,
        allMarches.filter((m) => ids.has(m.idPpm)),
      );
    }
    return result;
  });

  constructor() {
    this.loading.set(true);
    this.prmpService.list().subscribe({
      next: (r) => this.prmps.set(r),
      error: () => this.loading.set(false),
    });
    this.ppmService.list().subscribe({ next: (r) => this.ppms.set(r) });
    this.marcheService.list().subscribe({
      next: (r) => {
        this.marches.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    // Bénéficiaires + prévisions en bulk (filtrés ensuite par les marchés de chaque PRMP).
    this.serviceBenefService.list().subscribe({ next: (r) => this.serviceBenefs.set(r) });
    this.previsionService.list().subscribe({ next: (r) => this.previsions.set(r) });
  }

  marchesOf(idPrmp: string): Marche[] {
    return this.byPrmp().get(idPrmp) ?? [];
  }
  benefsOf(idPrmp: string): ServiceBeneficiaire[] {
    const ids = new Set(this.marchesOf(idPrmp).map((m) => m.idDetail));
    return this.serviceBenefs().filter((b) => ids.has(b.idDetail));
  }
  previsionsOf(idPrmp: string): MarchePrevision[] {
    const ids = new Set(this.marchesOf(idPrmp).map((m) => m.idDetail));
    return this.previsions().filter((p) => ids.has(p.idDetail));
  }
  prmpLabel(p: Prmp): string {
    return `${p.nomPrmp} ${p.prenomsPrmp}`.trim() || p.idPrmp;
  }
  isPrmpOpen(idPrmp: string): boolean {
    return this.expandedPrmp().has(idPrmp);
  }
  togglePrmp(idPrmp: string): void {
    this.expandedPrmp.update((s) => {
      const n = new Set(s);
      if (n.has(idPrmp)) {
        n.delete(idPrmp);
      } else {
        n.add(idPrmp);
      }
      return n;
    });
  }
}
