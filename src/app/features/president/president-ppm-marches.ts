import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, Ppm } from '../../models';
import { MarcheService, PpmService, PrmpService, ReferenceLookupService } from '../../services';
import { DetailPpmModal } from '../../shared/prmp';

/**
 * Vue Président (lecture, toutes localités) : la liste des PPM avec leur PRMP (résolu).
 * Le détail (marchés, dates prévisionnelles, pièces jointes) est délégué au composant partagé
 * `DetailPpmModal`, ouvert en lecture seule (`modeEdition=false`). Le backend renvoie déjà le périmètre.
 */
@Component({
  selector: 'app-president-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailPpmModal],
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
            <div class="ppd__bar">
              <div class="ppd__head">
                <span class="ppd__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
                <span class="ppd__sub">
                  Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }} · PRMP : {{ prmpLabel(ppm) }}
                </span>
                <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
              </div>
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm ppd__details-btn" (click)="ouvrirDetail(ppm)">
                Détails
              </button>
            </div>
          </div>
        } @empty {
          <p class="ppd__info">Aucun PPM.</p>
        }
      }
    </section>

    @if (detail(); as d) {
      <app-detail-ppm-modal
        [idDossier]="d.idDossier"
        [idPpm]="d.idPpm"
        [modeEdition]="false"
        (fermer)="fermerDetail()"
      />
    }
  `,
  styles: `
    .ppd__header { margin-bottom: var(--cnm-space-4); }
    .ppd__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .ppd__info { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); }
    .ppd__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .ppd__bar { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .ppd__head {
      display: flex; align-items: center; gap: var(--cnm-space-3); flex: 1;
      padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text);
    }
    .ppd__details-btn { align-self: center; white-space: nowrap; margin-right: var(--cnm-space-3); }
    .ppd__ref { font-weight: var(--cnm-fw-semibold); }
    .ppd__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
  `,
})
export class PresidentPpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly prmpMap = signal<Map<string, string>>(new Map());
  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);

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
      next: (r) => {
        this.marches.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(PrmpService, 'idPrmp', ['nomPrmp', 'prenomsPrmp']).subscribe((m) => this.prmpMap.set(m));
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }
  prmpLabel(ppm: Ppm): string {
    if (!ppm.idPrmp) return '—';
    return this.prmpMap().get(ppm.idPrmp) ?? ppm.idPrmp;
  }
  ouvrirDetail(ppm: Ppm): void {
    this.detail.set({ idDossier: ppm.idDossier, idPpm: ppm.idPpm });
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
}
