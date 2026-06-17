import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
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
        <p class="pipeline__info">{{ showExaminedOnly ? 'Aucun dossier examiné.' : showExamenAction ? 'Aucun dossier à examiner.' : 'Aucun dossier visible dans votre périmètre.' }}</p>
      } @else {
        <ul class="pipeline__list">
          @for (d of visibleDossiers(); track d.idDossier) {
            <li class="dossier-card">
              @let info = etapeInfo(d);
              <div class="dossier-card__head">
                <span class="dossier-card__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}@if (showExamenAction || showExaminedOnly) { · {{ entiteLabel(d) }}}</span>
                <div class="dossier-card__head-right">
                  <app-statut-badge [statut]="d.statut" />
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="consulte.set(d)">Voir détails</button>
                  @if (showExamenAction && info.cle === 'EXAMEN' && peutAgir(info)) {
                    <a class="cnm-btn cnm-btn--primary cnm-btn--sm" [routerLink]="['/membre/examiner', d.idDossier]">Examiner</a>
                  }
                </div>
              </div>
              @if (showTimeline) {
                <app-circuit-timeline [active]="etape(d)" [sublabels]="sublabels(d)" />
              }
            </li>
          }
        </ul>
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
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  protected readonly title = (this.route.snapshot.data['title'] as string) ?? 'Dossiers';
  /** Frise du circuit par dossier ; désactivable via `route.data.timeline === false`. */
  protected readonly showTimeline = (this.route.snapshot.data['timeline'] as boolean | undefined) ?? true;
  /** Bouton « Examiner » par dossier ; activé via `route.data.examenAction === true` (écran Examens). */
  protected readonly showExamenAction = (this.route.snapshot.data['examenAction'] as boolean | undefined) ?? false;
  /** Liste restreinte aux dossiers déjà examinés ; activé via `route.data.examinedOnly === true`. */
  protected readonly showExaminedOnly = (this.route.snapshot.data['examinedOnly'] as boolean | undefined) ?? false;
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);

  /**
   * Dossiers affichés : tous par défaut ; sur l'écran « Examens » (`examenAction`),
   * uniquement ceux réellement examinables (étape Examen + capacité) — ceux qui portent
   * le bouton « Examiner ».
   */
  readonly visibleDossiers = computed(() => {
    const all = this.dossiers();
    if (this.showExaminedOnly) {
      const ids = this.examinedDossierIds();
      return all.filter((d) => ids.has(d.idDossier));
    }
    if (this.showExamenAction) {
      return all.filter((d) => {
        const info = this.etapeInfo(d);
        return info.cle === 'EXAMEN' && this.peutAgir(info);
      });
    }
    return all;
  });

  /** Ids des dossiers déjà examinés par le Membre courant (examen → dispatch → réception → dossier). */
  private readonly examinedDossierIds = computed(() => {
    const me = this.auth.ref();
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((x) => [x.idDispatch, x]));
    const ids = new Set<number>();
    for (const e of this.examens()) {
      if (e.imCtrlMembre && e.imCtrlMembre !== me) {
        continue; // examinés par moi (ou membre non renseigné)
      }
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      if (rec) {
        ids.add(rec.idDossier);
      }
    }
    return ids;
  });

  // Collections du circuit (scopées par profil) pour dater les étapes franchies.
  private readonly receptions = signal<Reception[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);
  private readonly verifications = signal<Verification[]>([]);

  constructor() {
    this.loading.set(true);
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
    // Libellés d'entité (cache partagé) — uniquement pour les écrans qui les affichent.
    if (this.showExamenAction || this.showExaminedOnly) {
      this.lookups
        .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
        .subscribe((m) => this.entiteMap.set(m));
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
