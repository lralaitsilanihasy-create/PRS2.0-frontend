import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, Ppm } from '../../models';
import {
  MarcheService,
  ModePassationService,
  NatureService,
  PpmService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Affichage maître-détail : chaque PPM, avec en panneau dépliable le tableau de
 * TOUS ses marchés (lignes de t_marche), reliés par la FK `idPpm` (jointure client).
 * Listes filtrées par le backend selon le profil/localité — aucun filtrage maison.
 */
@Component({
  selector: 'app-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="md">
      <header class="md__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="md__title">PPM & marchés rattachés</h1>
      </header>

      @if (loading()) {
        <p class="md__info">Chargement…</p>
      } @else {
        @for (ppm of ppms(); track ppm.idPpm) {
          <div class="cnm-card md__ppm">
            <button
              type="button"
              class="md__head"
              (click)="toggle(ppm.idPpm)"
              [attr.aria-expanded]="isOpen(ppm.idPpm)"
            >
              <span class="md__chevron">{{ isOpen(ppm.idPpm) ? '▾' : '▸' }}</span>
              <span class="md__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
              <span class="md__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
              <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
            </button>

            @if (isOpen(ppm.idPpm)) {
              <div class="md__detail cnm-marches">
                @if (marchesOf(ppm.idPpm).length === 0) {
                  <p class="md__empty">Aucun marché rattaché à ce PPM.</p>
                } @else {
                  <table class="cnm-table">
                    <thead>
                      <tr>
                        <th>Réf.</th>
                        <th>Désignation</th>
                        <th>Compte</th>
                        <th class="cnm-num">Montant estimé</th>
                        <th>Mode</th>
                        <th>Nature</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of marchesOf(ppm.idPpm); track m.idDetail) {
                        <tr>
                          <td class="cnm-mono">{{ m.idDetail }}</td>
                          <td>{{ m.designationMarche || '—' }}</td>
                          <td class="cnm-mono">{{ m.numCompte || '—' }}</td>
                          <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                          <td>{{ resolve(modeMap(), m.idMode) }}</td>
                          <td>{{ resolve(natureMap(), m.idNature) }}</td>
                          <td><app-statut-badge [statut]="m.statut" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="md__info">Aucun PPM dans votre périmètre.</p>
        }
      }
    </section>
  `,
  styles: `
    .md__header { margin-bottom: var(--cnm-space-4); }
    .md__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .md__info,
    .md__empty { color: var(--cnm-text-2); padding: var(--cnm-space-3); }
    .md__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .md__head {
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
    .md__head:hover { background: var(--cnm-surface-2); }
    .md__chevron { color: var(--cnm-text-3); width: 1rem; }
    .md__ref { font-weight: var(--cnm-fw-semibold); }
    .md__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
    .md__detail { border-top: 1px solid var(--cnm-border); }
  `,
})
export class PpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  private readonly expanded = signal<Set<number>>(new Set());
  readonly modeMap = signal<Map<string, string>>(new Map());
  readonly natureMap = signal<Map<string, string>>(new Map());

  /** Marchés groupés par idPpm (jointure client sur la FK). */
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
    this.ppmService.list().subscribe({
      next: (r) => this.ppms.set(r),
      error: () => this.loading.set(false),
    });
    this.marcheService.list().subscribe({
      next: (r) => {
        this.marches.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.lookups.lookup(NatureService, 'idNature', ['libelle']).subscribe((m) => this.natureMap.set(m));
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }
  isOpen(idPpm: number): boolean {
    return this.expanded().has(idPpm);
  }
  toggle(idPpm: number): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(idPpm)) {
        next.delete(idPpm);
      } else {
        next.add(idPpm);
      }
      return next;
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
