import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { Dispatch, Dossier, Reception } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  LocaliteService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from './dossier-consultation';

interface DispatchRow {
  dispatch: Dispatch;
  reception?: Reception;
  dossier?: Dossier;
}

/**
 * Liste des dispatchs (historique des dossiers dispatchés) — scopée serveur par profil
 * (Président = toutes localités ; CC = sa localité). Jointure client dispatch→réception→dossier ;
 * libellés (type, localité, attributaire) en cache, sans N+1. « Modifier » ouvre le DispatchForm affiné.
 */
@Component({
  selector: 'app-dispatchs-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe],
  template: `
    <section class="dl">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Circuit de contrôle</div>
          <h1 class="page-title">Dispatch des dossiers</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="dl__info">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <colgroup>
              <col style="width:220px;" />
              <col style="width:130px;" />
              <col style="width:155px;" />
              <col style="width:155px;" />
              <col />
              <col style="width:120px;" />
              <col style="width:100px;" />
            </colgroup>
            <thead>
              <tr><th>Référence</th><th>Localité</th><th title="Date et heure de réception du dossier par le secrétaire">Réception sec.</th><th>Date dispatch</th><th>Attributaire</th><th>Statut actuel</th><th>Action</th></tr>
            </thead>
            <tbody>
              @for (l of lignes(); track l.dispatch.idDispatch) {
                <tr>
                  <td>{{ l.dossier?.refeDossier || (l.dossier ? 'Dossier #' + l.dossier.idDossier : '—') }}</td>
                  <td>{{ localiteLabel(l.dossier) }}</td>
                  <td style="white-space:nowrap;">
                    @if (l.dispatch.dateCtrlAssigne) {
                      {{ l.dispatch.dateCtrlAssigne | date: 'dd/MM/yyyy HH:mm' }}
                    } @else {
                      <span style="color:var(--n-300)">—</span>
                    }
                  </td>
                  <td style="white-space:nowrap;">
                    @if (l.dispatch.dateDispatch) {
                      {{ l.dispatch.dateDispatch | date: 'dd/MM/yyyy HH:mm' }}
                    } @else {
                      <span style="color:var(--n-300)">—</span>
                    }
                  </td>
                  <td>{{ attributaire(l.dispatch) }}</td>
                  <td>@if (l.dossier) { <app-statut-badge [statut]="l.dossier.statut" /> } @else { — }</td>
                  <td>
                    @if (l.dossier; as d) {
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Consulter</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="dl__info">Aucun dossier dispatché.</td></tr>
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
    .dl__info { color: var(--n-400); padding: 1.5rem; text-align: center; }
  `,
})
export class DispatchsList {
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(false);
  readonly consulte = signal<Dossier | null>(null);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly recById = signal<Map<number, Reception>>(new Map());
  private readonly dossierById = signal<Map<number, Dossier>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  readonly lignes = computed<DispatchRow[]>(() => {
    const recs = this.recById();
    const dos = this.dossierById();
    return this.dispatchs()
      .map((dispatch) => {
        const reception = recs.get(dispatch.idReception);
        const dossier = reception ? dos.get(reception.idDossier) : undefined;
        return { dispatch, reception, dossier };
      })
      .sort((a, b) => (b.dispatch.dateDispatch ?? '').localeCompare(a.dispatch.dateDispatch ?? ''));
  });

  constructor() {
    this.charger();
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
  }

  charger(): void {
    this.loading.set(true);
    forkJoin({
      dispatchs: this.dispatchService.list(),
      receptions: this.receptionService.list(),
      dossiers: this.dossierService.list(),
    }).subscribe({
      next: ({ dispatchs, receptions, dossiers }) => {
        this.dispatchs.set(dispatchs);
        this.recById.set(new Map(receptions.map((r) => [r.idReception, r])));
        this.dossierById.set(new Map(dossiers.map((d) => [d.idDossier, d])));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  typeLabel(d?: Dossier): string {
    return d?.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  localiteLabel(d?: Dossier): string {
    return d?.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  attributaire(d: Dispatch): string {
    return d.imCtrlMembre ? this.controleurMap().get(d.imCtrlMembre) ?? d.imCtrlMembre : '—';
  }
}
