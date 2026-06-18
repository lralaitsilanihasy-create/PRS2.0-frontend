import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { PermissionsService } from '../../core/auth/permissions.service';
import { Dispatch, Dossier, Examen, PvExamen, Reception, Verification } from '../../models';
import {
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  VerificationService,
} from '../../services';
import {
  CIRCUIT_ETAPES,
  CircuitTimeline,
  EtapeInfo,
  StatutBadge,
  etapeIndexForDossier,
  etapeSuivante,
  statutDossierLabel,
} from '../../shared/circuit';
import { DossierConsultation } from './dossier-consultation';

/**
 * Pipeline des dossiers (lecture seule) : liste filtrée par le backend selon le
 * profil/localité, avec statut et timeline du circuit. Réutilisé comme tableau de
 * bord par plusieurs profils ; le titre vient de `route.data.title`.
 */
@Component({
  selector: 'app-dossiers-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, CircuitTimeline, DossierConsultation],
  template: `
    <section class="pipeline">
      <h1 class="pipeline__title">{{ title }}</h1>

      @if (loading()) {
        <p class="pipeline__info">Chargement…</p>
      } @else if (visibleDossiers().length === 0) {
        <p class="pipeline__info">{{ messageVide }}</p>
      } @else {
        <ul class="pipeline__list">
          @for (d of visibleDossiers(); track d.idDossier) {
            <li class="dossier-card">
              @let info = etapeInfo(d);
              <div class="dossier-card__head">
                <span class="dossier-card__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}@if (source) { · {{ entiteLabel(d) }}}</span>
                <div class="dossier-card__head-right">
                  <app-statut-badge [statut]="d.statut" />
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="consulte.set(d)">Voir détails</button>
                  @if (showExamenAction && info.cle === 'EXAMEN' && peutAgir(info)) {
                    <a class="cnm-btn cnm-btn--primary cnm-btn--sm" [routerLink]="['/membre/examiner', d.idDossier]">Examiner</a>
                  }
                  @if (source === 'examines' && d.statut === 'EXAMINE') {
                    <a class="cnm-btn cnm-btn--primary cnm-btn--sm" [routerLink]="['/membre/examiner', d.idDossier]">Modifier l'examen</a>
                  }
                  @if (showVerifAction && d.statut === 'EN_VERIFICATION') {
                    <a class="cnm-btn cnm-btn--primary cnm-btn--sm" [routerLink]="['/verificateur/verifier', d.idDossier]">Vérifier</a>
                  }
                </div>
              </div>
              @if (showTimeline) {
                <app-circuit-timeline [active]="etape(d)" [sublabels]="sublabels(d)" />
              }
            </li>
          }
        </ul>

        @if (paginee && totalPages() > 1) {
          <div class="pipeline__pager">
            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="pipeline__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .pipeline__title {
      margin: 0 0 var(--cnm-space-4);
      font-size: var(--cnm-fs-lg);
    }
    .pipeline__info {
      color: var(--cnm-text-2);
    }
    .pipeline__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-3);
    }
    .dossier-card {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius);
      padding: 0.875rem var(--cnm-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-2);
    }
    .dossier-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cnm-space-3);
    }
    .dossier-card__head-right {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-2);
    }
    .dossier-card__ref {
      font-weight: var(--cnm-fw-semibold);
      color: var(--cnm-text);
    }
    .dossier-card__meta {
      display: flex;
      gap: 1.5rem;
      font-size: var(--cnm-fs-xs);
      color: var(--cnm-text-2);
    }
    .dossier-card__wf {
      font-size: var(--cnm-fs-sm);
      margin-top: var(--cnm-space-1);
    }
    .pipeline__pager {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      justify-content: flex-end;
      margin-top: var(--cnm-space-3);
    }
    .pipeline__pager-info { font-size: var(--cnm-fs-sm); color: var(--cnm-text-2); }
  `,

})
export class DossiersPipeline {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly pvService = inject(PvExamenService);
  private readonly verificationService = inject(VerificationService);
  private readonly permissions = inject(PermissionsService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  protected readonly title = (this.route.snapshot.data['title'] as string) ?? 'Dossiers';
  /** Frise du circuit par dossier ; désactivable via `route.data.timeline === false`. */
  protected readonly showTimeline = (this.route.snapshot.data['timeline'] as boolean | undefined) ?? true;
  /** Bouton « Examiner » par dossier ; activé via `route.data.examenAction === true` (écran Examens). */
  protected readonly showExamenAction = (this.route.snapshot.data['examenAction'] as boolean | undefined) ?? false;
  /** Bouton « Vérifier » par dossier ; activé via `route.data.verifAction === true` (file Vérificateur). */
  protected readonly showVerifAction = (this.route.snapshot.data['verifAction'] as boolean | undefined) ?? false;
  /** Source de données : files Membre ('a-examiner'/'examines'), files Vérificateur ('a-verifier'/'verifies'), ou undefined (dashboard). */
  protected readonly source = this.route.snapshot.data['source'] as
    | 'a-examiner'
    | 'examines'
    | 'a-verifier'
    | 'verifies'
    | undefined;
  /** Sources paginées (historiques server-side). */
  protected readonly paginee = this.source === 'examines' || this.source === 'verifies';
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  /** Pagination (source 'examines'). */
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);

  /** Dossiers affichés (déjà scopés/exclusifs côté serveur — aucun filtre client). */
  readonly visibleDossiers = computed(() => this.dossiers());

  // Collections du circuit (scopées par profil) pour dater les étapes franchies.
  private readonly receptions = signal<Reception[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);
  private readonly verifications = signal<Verification[]>([]);

  constructor() {
    this.loading.set(true);
    if (this.source === 'a-examiner' || this.source === 'a-verifier') {
      // Files de travail scopées serveur (DISPATCHE / EN_VERIFICATION), sans filtre client.
      const call = this.source === 'a-verifier' ? this.dossierService.aVerifier() : this.dossierService.aExaminer();
      call.subscribe({
        next: (rows) => {
          this.dossiers.set(rows);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else if (this.paginee) {
      this.chargerPage(0);
    } else {
      // Pipeline générique (dashboard) : toutes les ressources pour dater la frise.
      forkJoin({
        dossiers: this.dossierService.list(),
        receptions: this.receptionService.list(),
        dispatchs: this.dispatchService.list(),
        examens: this.examenService.list(),
        pvs: this.pvService.list(),
        verifications: this.verificationService.list(),
      }).subscribe({
        next: (r) => {
          this.dossiers.set(r.dossiers);
          this.receptions.set(r.receptions);
          this.dispatchs.set(r.dispatchs);
          this.examens.set(r.examens);
          this.pvs.set(r.pvs);
          this.verifications.set(r.verifications);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
    // Libellés d'entité (cache partagé) — pour les files Membre qui les affichent.
    if (this.source) {
      this.lookups
        .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
        .subscribe((m) => this.entiteMap.set(m));
    }
  }

  /** Charge une page d'un historique paginé ('examines' ou 'verifies' selon la source). */
  private chargerPage(page: number): void {
    this.loading.set(true);
    const call =
      this.source === 'verifies'
        ? this.dossierService.verifies(page, this.pageSize)
        : this.dossierService.examines(page, this.pageSize);
    call.subscribe({
      next: (p) => {
        this.dossiers.set(p.content);
        this.pageIndex.set(p.number);
        this.totalPages.set(p.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
  prevPage(): void {
    if (this.pageIndex() > 0) {
      this.chargerPage(this.pageIndex() - 1);
    }
  }
  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.chargerPage(this.pageIndex() + 1);
    }
  }

  /** Message d'absence de données selon la source. */
  protected get messageVide(): string {
    switch (this.source) {
      case 'examines':
        return 'Aucun dossier examiné.';
      case 'a-examiner':
        return 'Aucun dossier à examiner.';
      case 'a-verifier':
        return 'Aucun dossier à vérifier.';
      case 'verifies':
        return 'Aucun dossier vérifié ou clôturé.';
      default:
        return 'Aucun dossier visible dans votre périmètre.';
    }
  }

  /** Libellé de l'entité du dossier (cache, sans appel par ligne). */
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }

  /** Dates des 7 étapes par dossier (jointure réception → dispatch → examen → PV → vérification). */
  private readonly datesByDossier = computed(() => {
    const map = new Map<number, (string | undefined)[]>();
    const recs = this.receptions();
    const disps = this.dispatchs();
    const exs = this.examens();
    const pvs = this.pvs();
    const verifs = this.verifications();
    for (const d of this.dossiers()) {
      const rOfD = recs.filter((r) => r.idDossier === d.idDossier);
      const recIds = new Set(rOfD.map((r) => r.idReception));
      const dOfD = disps.filter((x) => recIds.has(x.idReception));
      const dispIds = new Set(dOfD.map((x) => x.idDispatch));
      const eOfD = exs.filter((e) => e.idDispatch != null && dispIds.has(e.idDispatch));
      const exIds = new Set(eOfD.map((e) => e.idExamen));
      const pOfD = pvs.filter((p) => exIds.has(p.idExamen));
      const pvIds = new Set(pOfD.map((p) => p.idPv));
      const vOfD = verifs.filter((v) => recIds.has(v.idReception) || (v.idPv != null && pvIds.has(v.idPv)));
      const recInit = rOfD.find((r) => r.numPassage === 1) ?? rOfD[0];
      const pv = pOfD[0];
      map.set(d.idDossier, [
        recInit?.dateReception,
        dOfD[0]?.dateDispatch,
        eOfD[0]?.dateExamen,
        pv?.dateSoumissionInitiale,
        pv?.datePv ?? pv?.dateSignatureMembre ?? pv?.dateSignaturePresident ?? pv?.dateSignatureCc,
        vOfD[0]?.dateVerif,
        d.statut === 'CLOTURE' ? (vOfD.find((v) => v.obsLevees)?.dateVerif ?? vOfD[0]?.dateVerif) : undefined,
      ]);
    }
    return map;
  });

  etape(d: Dossier): number {
    return etapeIndexForDossier(d.statut);
  }

  /** Libellés sous chaque point : date d'étape franchie ; sinon, statut sur l'étape en cours. */
  sublabels(d: Dossier): string[] {
    const dates = this.datesByDossier().get(d.idDossier) ?? [];
    const active = this.etape(d);
    return CIRCUIT_ETAPES.map((_, i) => dates[i] || (i === active ? statutDossierLabel(d.statut) : ''));
  }

  etapeInfo(d: Dossier): EtapeInfo {
    return etapeSuivante(d.statut);
  }

  /** Vrai si le profil connecté peut agir à l'étape attendue du dossier. */
  peutAgir(info: EtapeInfo): boolean {
    return info.capability !== null && this.permissions.can(info.capability);
  }
}
