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
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Mes PPM &amp; marchés</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        @for (ppm of mesPpms(); track ppm.idPpm) {
          @if (statutPpm(ppm) !== 'BROUILLON') {
            <div class="card ppm-row" [class.ppm-row--soumis]="estSoumis(ppm)">
              <div class="ppm-row__head">
                <span class="ppm-row__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
                <span class="ppm-row__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
                <span class="badge badge-neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
                @if (statutPpm(ppm) === 'EN_ATTENTE_DECISION_PRMP') {
                  <app-statut-badge [statut]="statutPpm(ppm)" />
                }
              </div>
              <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDetail(ppm)">Détails</button>
            </div>
          }
        } @empty {
          <p class="text-muted">Aucun PPM dans votre périmètre.</p>
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
    .ppm-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      margin-bottom: 0.75rem;
    }
    .ppm-row--soumis { background: var(--c-50); }
    .ppm-row__head { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
    .ppm-row__ref { font-weight: 700; color: var(--c-800); }
    .ppm-row__sub { color: var(--n-400); font-size: var(--text-sm); flex: 1; min-width: 0; }
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

  // Garde-fou d'affichage : on n'affiche pas les PPM dont le dossier est en BROUILLON
  // (le backend filtre déjà ; ceci couvre le cas où un BROUILLON remonterait).
  readonly mesPpms = computed(() => {
    const statuts = this.dossierStatut();
    return this.ppms().filter((p) => statuts.get(p.idDossier) !== 'BROUILLON');
  });
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
