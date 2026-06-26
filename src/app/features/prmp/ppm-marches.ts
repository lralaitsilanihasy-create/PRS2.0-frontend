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
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">PPM &amp; marchés rattachés</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        @for (ppm of ppms(); track ppm.idPpm) {
          <div class="card ppm-row">
            <div class="ppm-row__head">
              <span class="ppm-row__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
              <span class="ppm-row__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
              <span class="badge badge-neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDetail(ppm)">Détails</button>
          </div>
        } @empty {
          <p class="text-muted">Aucun PPM dans votre périmètre.</p>
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
    .ppm-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      margin-bottom: 0.75rem;
    }
    .ppm-row__head { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
    .ppm-row__ref { font-weight: 700; color: var(--c-800); }
    .ppm-row__sub { color: var(--n-400); font-size: var(--text-sm); flex: 1; min-width: 0; }
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
