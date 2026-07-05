import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, MarchePrevision, Ppm, Prmp } from '../../models';
import {
  CapmService,
  MarcheService,
  MarchePrevisionService,
  ModePassationService,
  PpmService,
  PrmpService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

interface PrevState {
  open: boolean;
  loading: boolean;
  loaded: boolean;
  data: MarchePrevision[];
}

/**
 * Maître-détail à deux niveaux : PRMP → ses marchés → dates prévisionnelles (à la demande).
 * - Marchés d'un PRMP : jointure client PRMP → PPM (idPrmp) → Marché (idPpm) — pas de FK directe.
 * - Dates prévisionnelles : ressource `marche-previsions`, chargées au 1er clic via byMarche().
 * Listes filtrées par le backend selon le profil/localité ; aucun filtrage maison.
 */
@Component({
  selector: 'app-prmp-marches-previsions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="mdp">
      <header class="mdp__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mdp__title">PRMP → marchés → dates prévisionnelles</h1>
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
                  <table class="cnm-table">
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th class="cnm-num">Montant estimé</th>
                        <th>Mode</th>
                        <th>Statut</th>
                        <th>Dates prév.</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of marchesOf(prmp.idPrmp); track m.idDetail) {
                        <tr>
                          <td>{{ m.designationMarche || '—' }}</td>
                          <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                          <td>{{ resolve(modeMap(), m.idMode) }}</td>
                          <td><app-statut-badge [statut]="m.statut" /></td>
                          <td>
                            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="togglePrev(m.idDetail)">
                              {{ prevOf(m.idDetail)?.open ? 'Masquer' : 'Voir les dates prévisionnelles' }}
                            </button>
                          </td>
                        </tr>
                        @if (prevOf(m.idDetail)?.open) {
                          <tr class="mdp__prev-row">
                            <td colspan="5">
                              @if (prevOf(m.idDetail)?.loading) {
                                <span class="mdp__loading">Chargement des dates…</span>
                              } @else if (prevOf(m.idDetail)?.data?.length) {
                                <table class="cnm-table mdp__prev">
                                  <thead>
                                    <tr><th>Processus</th><th>Date prévisionnelle</th></tr>
                                  </thead>
                                  <tbody>
                                    @for (p of prevOf(m.idDetail)!.data; track p.idPrevision) {
                                      <tr>
                                        <td>{{ capmLabel(p.idCapm) }}</td>
                                        <td class="cnm-mono">{{ p.dateDebut || '—' }}</td>
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              } @else {
                                <span class="mdp__empty">Aucune date prévisionnelle pour ce marché.</span>
                              }
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
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
    .mdp__empty,
    .mdp__loading { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); display: inline-block; }
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
    .mdp__detail { border-top: 1px solid var(--cnm-border); }
    .mdp__prev-row td { background: var(--cnm-surface-2); }
    .mdp__prev { margin: var(--cnm-space-2) 0; }
  `,
})
export class PrmpMarchesPrevisions {
  private readonly prmpService = inject(PrmpService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly prmps = signal<Prmp[]>([]);
  private readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly modeMap = signal<Map<string, string>>(new Map());
  readonly capmMap = signal<Map<string, string>>(new Map());
  private readonly expandedPrmp = signal<Set<string>>(new Set());
  private readonly prev = signal<Map<number, PrevState>>(new Map());

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
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).subscribe((m) => this.capmMap.set(m));
  }

  capmLabel(id: number): string {
    return this.capmMap().get(String(id)) ?? '#' + id;
  }
  marchesOf(idPrmp: string): Marche[] {
    return this.byPrmp().get(idPrmp) ?? [];
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

  prevOf(idDetail: number): PrevState | undefined {
    return this.prev().get(idDetail);
  }
  togglePrev(idDetail: number): void {
    const cur = this.prev().get(idDetail);
    if (cur?.open) {
      this.setPrev(idDetail, { ...cur, open: false });
      return;
    }
    if (cur?.loaded) {
      this.setPrev(idDetail, { ...cur, open: true });
      return;
    }
    this.setPrev(idDetail, { open: true, loading: true, loaded: false, data: [] });
    this.previsionService.byMarche(idDetail).subscribe({
      next: (data) => this.setPrev(idDetail, { open: true, loading: false, loaded: true, data }),
      error: () => this.setPrev(idDetail, { open: true, loading: false, loaded: true, data: [] }),
    });
  }
  private setPrev(idDetail: number, state: PrevState): void {
    this.prev.update((m) => {
      const n = new Map(m);
      n.set(idDetail, state);
      return n;
    });
  }

  resolve(map: Map<string, string>, id?: number): string {
    if (id === null || id === undefined) {
      return '—';
    }
    return map.get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
}
