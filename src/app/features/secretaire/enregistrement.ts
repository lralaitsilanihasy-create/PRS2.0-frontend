import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Dossier, Reception } from '../../models';
import {
  DossierService,
  LocaliteService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

/**
 * « Enregistrement » (Secrétaire, §3.4 — Suivi des réceptions) : historique en LECTURE des
 * dossiers déjà réceptionnés dans sa localité. GET /api/receptions (scopé localité) joint à
 * GET /api/dossiers (scopé) par idDossier ; type/localité résolus via référentiels en cache
 * (pas d'appel par ligne). Aucune action ici (la worklist d'action est l'écran « Réceptions »).
 */
@Component({
  selector: 'app-secretaire-enregistrement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation],
  template: `
    <section class="enr">
      <header class="enr__header">
        <span class="cnm-section-label">Domaine Secrétaire</span>
        <h1 class="enr__title">Enregistrement</h1>
      </header>

      <div class="cnm-card enr__note">
        Historique des dossiers réceptionnés dans votre localité (lecture seule).
      </div>

      @if (loading()) {
        <p class="enr__info">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr>
              <th>Référence</th><th>Type</th><th>Localité</th>
              <th>Date réception</th><th class="cnm-num">Passage</th><th>Complet</th><th>Statut actuel</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            @for (l of lignes(); track l.r.idReception) {
              <tr>
                <td>{{ l.d?.refeDossier || ('Dossier #' + l.r.idDossier) }}</td>
                <td>{{ typeLabel(l.d) }}</td>
                <td>{{ localiteLabel(l.d) }}</td>
                <td class="cnm-mono">{{ l.r.dateReception || '—' }}</td>
                <td class="cnm-num">{{ l.r.numPassage }}{{ l.r.typePassage === 'INITIAL' ? ' (INITIAL)' : '' }}</td>
                <td>{{ l.r.complet ? 'Oui' : 'Non' }}</td>
                <td>@if (l.d) { <app-statut-badge [statut]="l.d.statut" /> } @else { — }</td>
                <td class="enr__row-action">
                  @if (l.d; as d) {
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="consulte.set(d)">Consulter</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="enr__info">Aucun dossier réceptionné.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .enr__header { margin-bottom: var(--cnm-space-4); }
    .enr__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .enr__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .enr__info { color: var(--cnm-text-2); padding: var(--cnm-space-3); text-align: center; }
    .enr__row-action { text-align: right; }
  `,
})
export class SecretaireEnregistrement {
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(false);
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossierMap = signal<Map<number, Dossier>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());

  /** Lignes triées par date de réception décroissante (historique). */
  readonly lignes = computed(() => {
    const dmap = this.dossierMap();
    return this.receptions()
      .map((r) => ({ r, d: dmap.get(r.idDossier) }))
      .sort((a, b) => (b.r.dateReception ?? '').localeCompare(a.r.dateReception ?? ''));
  });

  constructor() {
    this.loading.set(true);
    forkJoin({ receptions: this.receptionService.list(), dossiers: this.dossierService.list() }).subscribe({
      next: ({ receptions, dossiers }) => {
        this.receptions.set(receptions);
        this.dossierMap.set(new Map(dossiers.map((d) => [d.idDossier, d])));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  typeLabel(d?: Dossier): string {
    return d?.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  localiteLabel(d?: Dossier): string {
    return d?.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
}
