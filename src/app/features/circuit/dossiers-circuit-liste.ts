import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Dossier } from '../../models';
import {
  DossierService,
  EntiteContractService,
  LocaliteService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from './dossier-consultation';
import { ClassementConfig } from './dossiers-classement';

/**
 * Liste des dossiers d'un **type** et d'un **groupe** de classement (statuts issus de `data.classement`),
 * en **lecture seule** (consultation via `DossierConsultation`). Drill-down de `DossiersClassement`
 * (Président / CC). Route : `{base}/:type/:groupe`. `GET /api/dossiers` scopé profil, filtré client.
 */
@Component({
  selector: 'app-dossiers-circuit-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ cfg.subtitle }}</div>
          <h1 class="page-title">{{ titre() }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr><th>#</th><th>Référence</th><th>Entité contractante</th><th>Statut</th><th>Localité</th><th class="r">Actions</th></tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr>
                  <td class="td-ref">{{ d.idDossier }}</td>
                  <td>{{ d.refeDossier || '—' }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  <td>@if (d.statut) { <app-statut-badge [statut]="d.statut" /> } @else { — }</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Voir détails</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-cell">Aucun dossier dans ce groupe.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .actions-end { justify-content: flex-end; }
    .empty-cell { text-align: center; color: var(--n-400); padding: 1.5rem; }
  `,
})
export class DossiersCircuitListe {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly cfg = this.route.snapshot.data['classement'] as ClassementConfig;

  readonly type = signal<string>('');
  readonly groupe = signal<string>('');
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly consulte = signal<Dossier | null>(null);

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  readonly typeLabel = computed(() => this.typeMap().get(this.type()) ?? this.type());
  readonly groupeLabel = computed(() => this.cfg.groupes.find((g) => g.key === this.groupe())?.label ?? this.groupe());
  readonly titre = computed(() => `${this.typeLabel()} — ${this.groupeLabel()}`);

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.type.set(p.get('type') ?? '');
      this.groupe.set(p.get('groupe') ?? '');
      this.charger();
    });
  }

  private charger(): void {
    const statuts = new Set(this.cfg.groupes.find((g) => g.key === this.groupe())?.statuts ?? []);
    if (!this.type() || !statuts.size) {
      this.dossiers.set([]);
      return;
    }
    this.loading.set(true);
    this.dossierService.list().subscribe({
      next: (rows) => {
        this.dossiers.set(rows.filter((d) => d.idTypeDossier === this.type() && !!d.statut && statuts.has(d.statut)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
}
