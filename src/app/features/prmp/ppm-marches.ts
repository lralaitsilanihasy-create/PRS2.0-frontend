import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, Ppm } from '../../models';
import { MarcheService, PpmService } from '../../services';
import { DetailPpmModal } from '../../shared/prmp';

/**
 * Liste des PPM (lecture seule, périmètre filtré par le backend selon le profil/localité).
 * Le détail (marchés, dates, pièces jointes) est délégué au composant partagé `DetailPpmModal`,
 * ouvert en lecture seule (`modeEdition=false`).
 */
@Component({
  selector: 'app-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailPpmModal],
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
            <div class="md__bar">
              <div class="md__head">
                <span class="md__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
                <span class="md__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
                <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
              </div>
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm md__details-btn" (click)="ouvrirDetail(ppm)">
                Détails
              </button>
            </div>
          </div>
        } @empty {
          <p class="md__info">Aucun PPM dans votre périmètre.</p>
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
    .md__header { margin-bottom: var(--cnm-space-4); }
    .md__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .md__info { color: var(--cnm-text-2); padding: var(--cnm-space-3); }
    .md__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .md__bar { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .md__head {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      flex: 1;
      padding: var(--cnm-space-3) var(--cnm-space-4);
      color: var(--cnm-text);
    }
    .md__details-btn { align-self: center; white-space: nowrap; margin-right: var(--cnm-space-3); }
    .md__ref { font-weight: var(--cnm-fw-semibold); }
    .md__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
  `,
})
export class PpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);

  readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);

  /** Marchés groupés par idPpm (jointure client sur la FK) — pour le compteur. */
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
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }
  ouvrirDetail(ppm: Ppm): void {
    this.detail.set({ idDossier: ppm.idDossier, idPpm: ppm.idPpm });
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
}
