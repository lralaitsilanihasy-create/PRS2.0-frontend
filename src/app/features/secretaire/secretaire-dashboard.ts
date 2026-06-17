import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Dossier } from '../../models';
import { DossierService, LocaliteService, ReferenceLookupService } from '../../services';
import { etapeIndexForDossier } from '../../shared/circuit';
import { DashboardShell, KpiTile, PipelineEntry, WorklistItem } from '../../shared/dashboard/dashboard-shell';

/**
 * Tableau de bord du Secrétaire : worklist « à réceptionner » + pipeline de sa localité + KPIs.
 * Données scopées serveur : GET /api/dossiers/a-receptionner (worklist) et GET /api/dossiers (pipeline).
 */
@Component({
  selector: 'app-secretaire-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardShell],
  template: `
    <app-dashboard-shell
      [title]="'Tableau de bord — Secrétaire'"
      [perimetre]="perimetre()"
      [loading]="loading()"
      [worklist]="worklist()"
      [kpis]="kpis()"
      [pipeline]="pipeline()"
    />
  `,
})
export class SecretaireDashboard {
  private readonly auth = inject(AuthService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(false);
  private readonly aRecep = signal<Dossier[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);
  private readonly localiteMap = signal<Map<string, string>>(new Map());

  readonly perimetre = computed(() => {
    const id = this.auth.localite();
    return id ? `Localité : ${this.localiteMap().get(id) ?? id}` : 'Ma localité';
  });

  readonly worklist = computed<WorklistItem[]>(() => [
    {
      label: 'Dossiers à réceptionner',
      count: this.aRecep().length,
      actionLabel: 'Réceptionner',
      actionPath: '/secretaire/receptions',
      severity: 'info',
      hint: 'Dossiers soumis en attente de réception initiale.',
    },
  ]);

  readonly kpis = computed<KpiTile[]>(() => {
    const ds = this.dossiers();
    return [
      { label: 'À réceptionner', value: this.aRecep().length, accent: true },
      { label: 'Dossiers (localité)', value: ds.length },
      { label: 'Prêts à dispatcher', value: ds.filter((d) => d.statut === 'PRET_DISPATCH').length },
      { label: 'Clôturés', value: ds.filter((d) => d.statut === 'CLOTURE').length },
    ];
  });

  readonly pipeline = computed<PipelineEntry[]>(() => {
    const m = new Map<string, number>();
    for (const d of this.dossiers()) {
      const s = d.statut ?? '—';
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([statut, count]) => ({ statut, count }))
      .sort((a, b) => etapeIndexForDossier(a.statut) - etapeIndexForDossier(b.statut));
  });

  constructor() {
    this.loading.set(true);
    forkJoin({ aRecep: this.dossierService.aReceptionner(), dossiers: this.dossierService.list() }).subscribe({
      next: ({ aRecep, dossiers }) => {
        this.aRecep.set(aRecep);
        this.dossiers.set(dossiers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }
}
