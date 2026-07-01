import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  imports: [StatutBadge, DossierConsultation, DatePipe],
  template: `
    <section class="enr">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Secrétaire</div>
          <h1 class="page-title">Enregistrement</h1>
        </div>
      </header>

      <div class="alert alert-info">
        Historique des dossiers réceptionnés dans votre localité (lecture seule).
      </div>

      @if (loading()) {
        <p class="enr__info">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Référence</th><th>Date de soumission</th><th>Localité</th>
                <th>Date réception</th><th>Passage</th><th>Complet</th><th>Statut actuel</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.r.idReception) {
                <tr>
                  <!-- Réf. figée à CETTE réception (reception.reference, snapshot immuable). On n'affiche
                       PAS de repli sur dossier.refeDossier : ce champ est mutable (restauré à la réf. PPM
                       initiale après un retrait accepté) et fausserait l'historique. NULL (réf. héritée
                       irrécupérable) → « — ». -->
                  <td>
                    @if (l.r.reference) {
                      {{ l.r.reference }}
                    } @else {
                      <span class="enr__empty">—</span>
                    }
                  </td>
                  <!-- Date/heure réelle de soumission (reception.dateSoumission) ; repli sur dossier.dateRef. -->
                  <td class="enr__date">
                    @if (l.r.dateSoumission || l.d?.dateRef; as dsoum) {
                      {{ dsoum | date: 'dd/MM/yyyy HH:mm' }}
                    } @else {
                      <span class="enr__empty">—</span>
                    }
                  </td>
                  <td>{{ localiteLabel(l.d) }}</td>
                  <td class="enr__date">
                    @if (l.r.dateReception) {
                      {{ l.r.dateReception | date: 'dd/MM/yyyy HH:mm' }}
                    } @else {
                      <span class="enr__empty">—</span>
                    }
                  </td>
                  <td>{{ l.r.numPassage }}{{ l.r.typePassage === 'INITIAL' ? ' (INITIAL)' : '' }}</td>
                  <td>{{ l.r.complet ? 'Oui' : 'Non' }}</td>
                  <td>@if (l.d) { <app-statut-badge [statut]="l.d.statut" /> } @else { — }</td>
                  <td class="enr__row-action">
                    @if (l.d; as d) {
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Consulter</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="enr__info">Aucun dossier réceptionné.</td></tr>
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
    .enr__info { color: var(--n-400); padding: 1.5rem; text-align: center; }
    .enr__row-action { text-align: right; }
    .enr__date { min-width: 140px; white-space: nowrap; }
    .enr__empty { color: var(--n-300); }
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
