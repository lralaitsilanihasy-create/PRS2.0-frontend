import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { Dossier } from '../../models';
import { DossierService, LocaliteService, ReferenceLookupService } from '../../services';
import { etapeIndexForDossier } from '../../shared/circuit';
import { DashboardShell, KpiTile, PipelineEntry, WorklistItem } from '../../shared/dashboard/dashboard-shell';

/**
 * Tableau de bord du Secrétaire : worklist « à réceptionner » + pipeline de sa localité + KPIs.
 * Données scopées serveur : GET /api/dossiers/a-receptionner (worklist) et GET /api/dossiers (pipeline).
 *
 * **Deux sources indépendantes, chargées séparément (AUDIT.md P9)** : `aReceptionner()` alimente
 * la worklist et la tuile « À réceptionner » ; `list()` alimente les trois autres tuiles et le
 * pipeline. Elles étaient auparavant combinées par un `forkJoin` — un seul appel en échec faisait
 * tomber l'écran entier alors que l'autre moitié des données était disponible. Chaque source a
 * maintenant son propre signal d'erreur : une tuile dont la source a échoué l'affiche
 * explicitement (jamais un compteur à 0, qui se lirait comme une vraie donnée) ; les tuiles dont
 * la source a réussi restent intactes. Le « Réessayer » de la coquille ne rejoue que la ou les
 * sources effectivement en échec.
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
      [pipelineError]="dossiersError()"
      (reessayer)="reessayer()"
    />
  `,
})
export class SecretaireDashboard {
  private readonly auth = inject(AuthService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  private readonly aRecep = signal<Dossier[]>([]);
  private readonly aRecepLoading = signal(false);
  private readonly aRecepError = signal(false);

  private readonly dossiers = signal<Dossier[]>([]);
  private readonly dossiersLoading = signal(false);
  /** Public : lu directement par le template (`[pipelineError]`). */
  readonly dossiersError = signal(false);

  private readonly localiteMap = signal<Map<string, string>>(new Map());

  /** Gate unique de la coquille : tant qu'une des deux sources répond encore. */
  readonly loading = computed(() => this.aRecepLoading() || this.dossiersLoading());

  readonly perimetre = computed(() => {
    const id = this.auth.localite();
    return id ? `Localité : ${this.localiteMap().get(id) ?? id}` : 'Ma localité';
  });

  readonly worklist = computed<WorklistItem[]>(() => [
    {
      label: 'Dossiers à réceptionner',
      count: this.aRecep().length,
      actionLabel: 'Réceptionner',
      actionPath: '/secretaire/mes-dossiers',
      severity: 'info',
      hint: 'Dossiers soumis en attente de réception initiale.',
      error: this.aRecepError(),
    },
  ]);

  readonly kpis = computed<KpiTile[]>(() => {
    const aRecepEnErreur = this.aRecepError();
    const dossiersEnErreur = this.dossiersError();
    const ds = this.dossiers();
    return [
      { label: 'À réceptionner', value: this.aRecep().length, icon: '📥', color: 'blue', error: aRecepEnErreur },
      { label: 'Dossiers (localité)', value: ds.length, icon: '📁', color: 'indigo', error: dossiersEnErreur },
      {
        label: 'Prêts à dispatcher',
        value: ds.filter((d) => d.statut === 'PRET_DISPATCH').length,
        icon: '🚚',
        color: 'amber',
        error: dossiersEnErreur,
      },
      {
        label: 'Clôturés',
        value: ds.filter((d) => d.statut === 'CLOTURE').length,
        icon: '✓',
        color: 'green',
        error: dossiersEnErreur,
      },
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
    this.chargerARecep();
    this.chargerDossiers();
    // Cosmétique uniquement (libellé du périmètre) : un échec laisse `perimetre()` replier sur
    // l'identifiant brut de la localité, jamais sur une valeur fabriquée.
    this.lookups
      .lookup(LocaliteService, 'idLocalite', ['libelleLocalite'])
      .subscribe({ next: (m) => this.localiteMap.set(m), error: () => {} });
  }

  /** Rejoue uniquement la ou les sources actuellement en échec (pas de rechargement global). */
  reessayer(): void {
    if (this.aRecepError()) {
      this.chargerARecep();
    }
    if (this.dossiersError()) {
      this.chargerDossiers();
    }
  }

  private chargerARecep(): void {
    this.aRecepLoading.set(true);
    this.aRecepError.set(false);
    this.dossierService.aReceptionner().subscribe({
      next: (aRecep) => {
        this.aRecep.set(aRecep);
        this.aRecepLoading.set(false);
      },
      error: () => {
        this.aRecepLoading.set(false);
        this.aRecepError.set(true);
      },
    });
  }

  private chargerDossiers(): void {
    this.dossiersLoading.set(true);
    this.dossiersError.set(false);
    this.dossierService.list().subscribe({
      next: (dossiers) => {
        this.dossiers.set(dossiers);
        this.dossiersLoading.set(false);
      },
      error: () => {
        this.dossiersLoading.set(false);
        this.dossiersError.set(true);
      },
    });
  }
}
