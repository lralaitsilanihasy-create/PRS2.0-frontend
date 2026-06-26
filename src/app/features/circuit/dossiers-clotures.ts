import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Dossier, EchangeDto } from '../../models';
import { DossierService, EntiteContractService, ReferenceLookupService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * « Dossiers vérifiés / clôturés » (Vérificateur) et « Dossiers vérifiés » (PRMP) — LECTURE SEULE.
 * Liste condensée des dossiers CLOTURE (une ligne par dossier, source serveur selon le profil via
 * `route.data.source`). Le fil chronologique des échanges (`GET /api/dossiers/{id}/historique-echanges`,
 * trié ASC) est masqué par défaut et chargé/affiché uniquement au clic sur le dossier (toggle).
 */
@Component({
  selector: 'app-dossiers-clotures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="dc">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ source === 'prmp-clotures' ? 'Domaine PRMP' : 'Domaine Vérificateur' }}</div>
          <h1 class="page-title">{{ titre }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (dossiers().length) {
        <ul class="dc__list">
          @for (d of dossiers(); track d.idDossier) {
            <li class="card dc__item">
              <button
                type="button"
                class="dc__head"
                [attr.aria-expanded]="estOuvert(d.idDossier)"
                (click)="basculer(d)"
              >
                <span class="dc__chevron" aria-hidden="true">{{ estOuvert(d.idDossier) ? '▾' : '▸' }}</span>
                <span class="dc__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }} · {{ entiteLabel(d) }}</span>
                <app-statut-badge [statut]="d.statut" [label]="'Clôturé'" />
              </button>

              @if (estOuvert(d.idDossier)) {
                <div class="dc__hist">
                  @if (chargeEnCours(d.idDossier)) {
                    <p class="text-muted">Chargement de l'historique…</p>
                  } @else {
                    <h3 class="dc__hist-title">Historique des échanges</h3>
                    @if (echangesDe(d.idDossier).length) {
                      <ul class="dc__ech">
                        @for (e of echangesDe(d.idDossier); track $index; let last = $last) {
                          <li
                            class="dc__ech-item"
                            [class.dc__ech-item--rectif]="e.type === 'RECTIFICATION'"
                            [class.dc__ech-item--final]="last && e.obsLevees"
                          >
                            <span class="dc__ech-meta cnm-mono">{{ e.date }} · {{ e.acteur }}</span>
                            <span class="dc__ech-label">{{ e.type === 'OBSERVATION' ? 'Observation' : 'Rectification PRMP reçue' }}</span>
                            <span class="dc__ech-text">{{ e.texte }}</span>
                            @if (e.type === 'OBSERVATION' && e.obsLevees) {
                              <span class="badge badge-success">{{ last ? 'Dossier clôturé — observations levées' : 'Observations levées' }}</span>
                            }
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="text-muted">Aucun échange enregistré.</p>
                    }
                  }
                </div>
              }
            </li>
          }
        </ul>

        @if (source === 'verifies' && totalPages() > 1) {
          <div class="dc__pager">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="dc__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      } @else {
        <p class="text-muted">Aucun dossier clôturé.</p>
      }
    </section>
  `,
  styles: `
    .dc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .dc__item { padding: 0; overflow: hidden; }
    .dc__head { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.1rem; background: none; border: 0; cursor: pointer; text-align: left; font: inherit; color: inherit; }
    .dc__head:hover { background: var(--c-50); }
    .dc__chevron { color: var(--n-400); width: 1em; flex: none; }
    .dc__ref { font-weight: 700; color: var(--c-800); }
    .dc__hist { padding: 0 1.1rem 0.75rem; }
    .dc__hist-title { margin: 0 0 0.4rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .dc__ech { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .dc__ech-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; padding: 0.25rem 0.5rem; border-left: 2px solid var(--c-100); }
    .dc__ech-item--rectif { border-left-color: var(--warning-text); }
    .dc__ech-item--final { border-left-color: var(--success-text); background: var(--c-50); }
    .dc__ech-meta { color: var(--n-400); font-size: var(--text-xs); }
    .dc__ech-label { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); }
    .dc__ech-text { font-size: var(--text-sm); }
    .dc__pager { display: flex; align-items: center; gap: 0.75rem; justify-content: flex-end; margin-top: 0.75rem; }
    .dc__pager-info { font-size: var(--text-sm); color: var(--n-400); }
  `,
})
export class DossiersClotures {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly source = this.route.snapshot.data['source'] as 'verifies' | 'prmp-clotures';
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Dossiers vérifiés';
  readonly loading = signal(true);
  readonly dossiers = signal<Dossier[]>([]);
  /** Cache des fils par dossier (chargés à la demande) ; absence de clé = pas encore chargé. */
  private readonly historiques = signal<Record<number, EchangeDto[]>>({});
  /** Dossiers dont le fil est en cours de chargement. */
  private readonly chargement = signal<Set<number>>(new Set());
  /** Dossiers dépliés (plusieurs autorisés simultanément). */
  private readonly ouverts = signal<Set<number>>(new Set());
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.charger(0);
  }

  private charger(page: number): void {
    this.loading.set(true);
    // Changement de page : on repart d'une liste condensée, sans fil déplié.
    this.ouverts.set(new Set());
    if (this.source === 'prmp-clotures') {
      this.dossierService.list('CLOTURE').subscribe({
        next: (rows) => {
          this.dossiers.set(rows);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.dossierService.verifies(page, this.pageSize).subscribe({
        next: (p) => {
          this.pageIndex.set(p.number);
          this.totalPages.set(p.totalPages);
          this.dossiers.set(p.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  estOuvert(id: number): boolean {
    return this.ouverts().has(id);
  }
  chargeEnCours(id: number): boolean {
    return this.chargement().has(id);
  }
  echangesDe(id: number): EchangeDto[] {
    return this.historiques()[id] ?? [];
  }

  /**
   * Clic sur un dossier : déplie/replie le fil (toggle). Au premier dépliage seulement, charge
   * `GET /api/dossiers/{id}/historique-echanges` (jamais au chargement de la liste) ; le résultat
   * est mis en cache (échec → fil vide).
   */
  basculer(d: Dossier): void {
    const id = d.idDossier;
    const ouverts = new Set(this.ouverts());
    if (ouverts.has(id)) {
      ouverts.delete(id);
      this.ouverts.set(ouverts);
      return;
    }
    ouverts.add(id);
    this.ouverts.set(ouverts);

    if (this.historiques()[id] !== undefined || this.chargement().has(id)) {
      return;
    }
    this.chargement.update((s) => new Set(s).add(id));
    this.dossierService.historiqueEchanges(id).subscribe({
      next: (echanges) => {
        this.historiques.update((h) => ({ ...h, [id]: echanges }));
        this.chargement.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      },
      error: () => {
        this.historiques.update((h) => ({ ...h, [id]: [] }));
        this.chargement.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      },
    });
  }

  prevPage(): void {
    if (this.pageIndex() > 0) {
      this.charger(this.pageIndex() - 1);
    }
  }
  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.charger(this.pageIndex() + 1);
    }
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
}
