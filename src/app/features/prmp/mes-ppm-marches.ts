import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Dossier, Marche, Ppm } from '../../models';
import { DossierService, MarcheService, PpmService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DetailPpmModal } from '../../shared/prmp';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * Vue PRMP : la liste de SES PPM. Le détail (marchés, dates, pièces jointes) et la gestion CRUD
 * sont délégués au composant partagé `DetailPpmModal`, ouvert en `modeEdition` lorsque le dossier du
 * PPM est en BROUILLON (périmètre éditable de la PRMP). Le backend reste l'autorité (403/409).
 */
@Component({
  selector: 'app-mes-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DetailPpmModal],
  template: `
    <section class="mpm">
      <header class="mpm__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mpm__title">Mes PPM & marchés</h1>
      </header>

      @if (loading()) {
        <p class="mpm__info">Chargement…</p>
      } @else {
        @for (ppm of mesPpms(); track ppm.idPpm) {
          <div class="cnm-card mpm__ppm" [class.mpm__ppm--soumis]="estSoumis(ppm)">
            <div class="mpm__bar">
              <div class="mpm__head">
                <span class="mpm__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
                <span class="mpm__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
                <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
                @if (statutPpm(ppm) === 'EN_ATTENTE_DECISION_PRMP') {
                  <app-statut-badge [statut]="statutPpm(ppm)" />
                }
              </div>
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm mpm__details-btn" (click)="ouvrirDetail(ppm)">
                Détails
              </button>
            </div>
          </div>
        } @empty {
          <p class="mpm__info">Aucun PPM dans votre périmètre.</p>
        }
      }
    </section>

    @if (detail(); as d) {
      <app-detail-ppm-modal
        [idDossier]="d.idDossier"
        [idPpm]="d.idPpm"
        [modeEdition]="d.modeEdition"
        (fermer)="fermerDetail()"
        (modifie)="onModifie()"
      />
    }
  `,
  styles: `
    .mpm__header { margin-bottom: var(--cnm-space-4); }
    .mpm__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .mpm__info { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); }
    .mpm__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .mpm__ppm--soumis,
    .mpm__ppm--soumis .mpm__head { background: var(--cnm-action-bg); }
    .mpm__bar { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .mpm__head {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      flex: 1;
      padding: var(--cnm-space-3) var(--cnm-space-4);
      color: var(--cnm-text);
    }
    .mpm__details-btn { align-self: center; white-space: nowrap; margin-right: var(--cnm-space-3); }
    .mpm__ref { font-weight: var(--cnm-fw-semibold); }
    .mpm__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
  `,
})
export class MesPpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly dossierService = inject(DossierService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  private readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  /** Statut du dossier par idDossier — pour gater l'édition (BROUILLON seulement) et signaler l'état soumis. */
  private readonly dossierStatut = signal<Map<number, string>>(new Map());

  /** Détail ouvert (null = fermé) ; `modeEdition` = dossier du PPM en BROUILLON. */
  readonly detail = signal<{ idDossier: number; idPpm: number; modeEdition: boolean } | null>(null);

  readonly mesPpms = computed(() => this.ppms());
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
    this.charger();
    // Suppression d'un dossier (depuis « Mes brouillons ») → retrait local de son PPM et de ses marchés.
    this.dossiersRefresh.supprime$.pipe(takeUntilDestroyed()).subscribe((idDossier) => {
      this.ppms.update((arr) => arr.filter((p) => p.idDossier !== idDossier));
      this.marches.update((arr) => arr.filter((m) => m.idDossier !== idDossier));
      if (this.detail()?.idDossier === idDossier) {
        this.fermerDetail();
      }
    });
  }

  private charger(): void {
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
    this.dossierService.list().subscribe((r) => {
      this.dossierStatut.set(new Map(r.map((d: Dossier) => [d.idDossier, d.statut ?? ''])));
    });
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }

  /** Vrai si le dossier rattaché au PPM est déjà soumis (sorti de l'état BROUILLON). */
  estSoumis(ppm: Ppm): boolean {
    const s = this.dossierStatut().get(ppm.idDossier);
    return !!s && s !== 'BROUILLON';
  }
  statutPpm(ppm: Ppm): string | undefined {
    return this.dossierStatut().get(ppm.idDossier);
  }
  /** Édition autorisée (modeEdition) uniquement si le dossier du PPM est en BROUILLON. */
  ppmEditable(ppm: Ppm): boolean {
    return this.dossierStatut().get(ppm.idDossier) === 'BROUILLON';
  }

  ouvrirDetail(ppm: Ppm): void {
    this.detail.set({ idDossier: ppm.idDossier, idPpm: ppm.idPpm, modeEdition: this.ppmEditable(ppm) });
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
  /** Après une mutation dans le modal : recharge la liste (compteurs) et propage aux autres écrans. */
  onModifie(): void {
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }
}
