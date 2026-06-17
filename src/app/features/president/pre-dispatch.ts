import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { PermissionsService } from '../../core/auth/permissions.service';
import { Dossier, Reception } from '../../models';
import {
  DispatchService,
  DossierService,
  LocaliteService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { DispatchForm } from '../circuit/dispatch-form';
import { DossierConsultation } from '../circuit/dossier-consultation';

interface PreDispatchItem {
  dossier: Dossier;
  reception: Reception;
}

/**
 * Pré-dispatch (Président) : worklist des dossiers PRET_DISPATCH de TOUTES les localités,
 * non encore dispatchés. Le dispatch se crée à partir de la RÉCEPTION du dossier
 * (POST /api/dispatchs, interimDispatch=false). Aucun endpoint « file d'attente » dédié :
 * reconstitution = dossiers ?statut=PRET_DISPATCH ∖ réceptions déjà dispatchées (sans N+1).
 */
@Component({
  selector: 'app-president-pre-dispatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DossierConsultation, DispatchForm],
  template: `
    <section class="pd">
      <header class="pd__header">
        <span class="cnm-section-label">Domaine Président</span>
        <h1 class="pd__title">Pré-dispatch</h1>
      </header>
      <div class="cnm-card pd__note">
        Dossiers réceptionnés et marqués <strong>complets</strong> (PRET_DISPATCH), en attente de dispatch — toutes localités.
      </div>

      @if (loading()) {
        <p class="pd__info">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Référence</th><th>Type</th><th>Localité</th><th>Date réception</th><th>Action</th></tr>
          </thead>
          <tbody>
            @for (it of worklist(); track it.dossier.idDossier) {
              <tr>
                <td>{{ it.dossier.refeDossier || ('Dossier #' + it.dossier.idDossier) }}</td>
                <td>{{ typeLabel(it.dossier) }}</td>
                <td>{{ localiteLabel(it.dossier) }}</td>
                <td class="cnm-mono">{{ it.reception.dateReception || '—' }}</td>
                <td>
                  <div class="pd__row-actions">
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="consulte.set(it.dossier)">Consulter</button>
                    @if (canDispatch()) {
                      <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="dispatchItem.set(it)">
                        Dispatcher
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="pd__info">Aucun dossier à dispatcher.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (dispatchItem(); as it) {
      <app-dispatch-form
        [dossier]="it.dossier"
        [reception]="it.reception"
        (closed)="dispatchItem.set(null)"
        (saved)="onDispatched()"
      />
    }
  `,
  styles: `
    .pd__header { margin-bottom: var(--cnm-space-4); }
    .pd__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .pd__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .pd__info { color: var(--cnm-text-2); padding: var(--cnm-space-3); text-align: center; }
    .pd__row-actions { display: flex; gap: var(--cnm-space-1); align-items: center; }
  `,
})
export class PresidentPreDispatch {
  private readonly permissions = inject(PermissionsService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(false);
  readonly worklist = signal<PreDispatchItem[]>([]);
  /** Dossier dont le formulaire de dispatch est ouvert (null = fermé). */
  readonly dispatchItem = signal<PreDispatchItem | null>(null);
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  readonly consulte = signal<Dossier | null>(null);

  readonly canDispatch = computed(() => this.permissions.can('DISPATCH_WRITE'));

  constructor() {
    this.charger();
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  /** (Re)charge la worklist : dossiers PRET_DISPATCH non encore dispatchés (toutes localités). */
  charger(): void {
    this.loading.set(true);
    forkJoin({
      dossiers: this.dossierService.list('PRET_DISPATCH'),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
    }).subscribe({
      next: ({ dossiers, receptions, dispatchs }) => {
        const dispatched = new Set(dispatchs.map((d) => d.idReception));
        const recByDossier = new Map<number, Reception>();
        for (const r of receptions) {
          const cur = recByDossier.get(r.idDossier);
          if (!cur || (r.complet && !cur.complet)) {
            recByDossier.set(r.idDossier, r);
          }
        }
        this.worklist.set(
          dossiers
            .map((d) => {
              const rec = recByDossier.get(d.idDossier);
              return rec && !dispatched.has(rec.idReception) ? { dossier: d, reception: rec } : null;
            })
            .filter((x): x is PreDispatchItem => x !== null),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  typeLabel(d: Dossier): string {
    return d.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }

  /** Après dispatch réussi (via DispatchForm) : re-fetch (le dossier passé DISPATCHE quitte la worklist). */
  onDispatched(): void {
    this.dispatchItem.set(null);
    this.charger();
  }
}
