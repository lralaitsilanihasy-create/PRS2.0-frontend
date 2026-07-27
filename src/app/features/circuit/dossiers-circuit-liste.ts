import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { Dispatch, Dossier, Reception } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { PermissionsService } from '../../core/auth/permissions.service';
import { StatutBadge } from '../../shared/circuit';
import { DispatchForm } from './dispatch-form';
import { DossierConsultation } from './dossier-consultation';
import { ClassementConfig, ColonneCircuit, dossiersDuClassement } from './dossiers-classement';

/**
 * Liste des dossiers d'un **type** et d'un **groupe** de classement (statuts issus de `data.classement`),
 * en **lecture seule** (consultation via `DossierConsultation`). Drill-down de `DossiersClassement`
 * (Président / CC). Colonnes enrichies selon le groupe (`colonnes` : réception / date dispatch / attributaire),
 * jointes depuis réceptions + dispatchs (idDossier → réception → dispatch). Route : `{base}/:type/:groupe`.
 */
@Component({
  selector: 'app-dossiers-circuit-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe, DispatchForm],
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
              <tr>
                <th>#</th>
                <th>Référence</th>
                <th>Entité contractante</th>
                @if (aColonne('reception')) { <th>Réception sec.</th> }
                @if (aColonne('dateDispatch')) { <th>Date dispatch</th> }
                @if (aColonne('attributaire')) { <th>Attributaire</th> }
                <th>Statut</th>
                <th>Localité</th>
                <th class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr>
                  <td class="td-ref">{{ d.idDossier }}</td>
                  <td>{{ d.refeDossier || '—' }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  @if (aColonne('reception')) {
                    <td style="white-space:nowrap;">{{ (dateReception(d) | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                  }
                  @if (aColonne('dateDispatch')) {
                    <td style="white-space:nowrap;">{{ (dateDispatch(d) | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                  }
                  @if (aColonne('attributaire')) {
                    <td>{{ attributaire(d) }}</td>
                  }
                  <td>@if (d.statut) { <app-statut-badge [statut]="d.statut" /> } @else { — }</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Voir détails</button>
                      @if (peutDispatcher(d); as rec) {
                        <button type="button" class="btn btn-primary btn-sm" (click)="dispatchItem.set({ dossier: d, reception: rec })">Dispatcher</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="colspan()" class="empty-cell">Aucun dossier dans ce groupe.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (dispatchItem(); as it) {
      <app-dispatch-form [dossier]="it.dossier" [reception]="it.reception" (closed)="dispatchItem.set(null)" (saved)="onDispatched()" />
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
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly permissions = inject(PermissionsService);

  readonly cfg = this.route.snapshot.data['classement'] as ClassementConfig;

  readonly type = signal<string>('');
  readonly groupe = signal<string>('');
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly consulte = signal<Dossier | null>(null);
  /** Dossier + réception dont le formulaire de dispatch est ouvert (null = fermé). */
  readonly dispatchItem = signal<{ dossier: Dossier; reception: Reception } | null>(null);

  /** idDossier → dernière réception (pour « Réception sec. »). */
  private readonly recByDossier = signal<Map<number, Reception>>(new Map());
  /** idDossier → réception à dispatcher (complète, non encore dispatchée) — pour l'action « Dispatcher ». */
  private readonly recDispatchable = signal<Map<number, Reception>>(new Map());
  /** idDossier → dernier dispatch (pour « Date dispatch » / « Attributaire »). */
  private readonly dispatchByDossier = signal<Map<number, Dispatch>>(new Map());

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  readonly typeLabel = computed(() => this.typeMap().get(this.type()) ?? this.type());
  private readonly groupeConfig = computed(() => this.cfg.groupes.find((g) => g.key === this.groupe()));
  readonly groupeLabel = computed(() => this.groupeConfig()?.label ?? this.groupe());
  readonly titre = computed(() => `${this.typeLabel()} — ${this.groupeLabel()}`);
  /** Colonnes supplémentaires actives pour le groupe courant. */
  private readonly colonnes = computed(() => new Set(this.groupeConfig()?.colonnes ?? []));
  /** Colspan de la ligne vide = 6 colonnes de base + colonnes optionnelles. */
  readonly colspan = computed(() => 6 + this.colonnes().size);
  /** L'utilisateur peut-il dispatcher ? (capacité DISPATCH_WRITE — Président et CC, comme au backend ; interim=false car l'écran CC est scopé à sa localité). */
  private readonly canDispatch = computed(() => this.permissions.can('DISPATCH_WRITE'));
  /** Ce groupe propose-t-il l'action « Dispatcher » ? (config `actionDispatch`). */
  private readonly aActionDispatch = computed(() => !!this.groupeConfig()?.actionDispatch);

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.type.set(p.get('type') ?? '');
      this.groupe.set(p.get('groupe') ?? '');
      this.charger();
    });
  }

  aColonne(c: ColonneCircuit): boolean {
    return this.colonnes().has(c);
  }

  private charger(): void {
    const statuts = new Set(this.groupeConfig()?.statuts ?? []);
    if (!this.type() || !statuts.size) {
      this.dossiers.set([]);
      return;
    }
    this.loading.set(true);
    // Dossiers (scopé profil, selon la source du classement) + réceptions/dispatchs pour les colonnes du circuit.
    forkJoin({
      dossiers: dossiersDuClassement(this.cfg, this.dossierService),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
    }).subscribe({
      next: ({ dossiers, receptions, dispatchs }) => {
        this.dossiers.set(dossiers.filter((d) => d.idTypeDossier === this.type() && !!d.statut && statuts.has(d.statut)));
        // idDossier → dernière réception (par date) ; idReception → réception (pour relier les dispatchs).
        const recById = new Map<number, Reception>();
        const recByDossier = new Map<number, Reception>();
        for (const r of receptions) {
          recById.set(r.idReception, r);
          const prec = recByDossier.get(r.idDossier);
          if (!prec || (r.dateReception ?? '') >= (prec.dateReception ?? '')) recByDossier.set(r.idDossier, r);
        }
        // idDossier → dernier dispatch (via sa réception).
        const dispatchByDossier = new Map<number, Dispatch>();
        for (const disp of dispatchs) {
          const idDossier = recById.get(disp.idReception)?.idDossier;
          if (idDossier == null) continue;
          const prec = dispatchByDossier.get(idDossier);
          if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dispatchByDossier.set(idDossier, disp);
        }
        // Réception « à dispatcher » : la réception complète du dossier, non encore dispatchée (idem worklist pré-dispatch).
        const dispatched = new Set(dispatchs.map((d) => d.idReception));
        const recComplete = new Map<number, Reception>();
        for (const r of receptions) {
          const prec = recComplete.get(r.idDossier);
          if (!prec || (r.complet && !prec.complet)) recComplete.set(r.idDossier, r);
        }
        const recDispatchable = new Map<number, Reception>();
        for (const [idDossier, r] of recComplete) if (!dispatched.has(r.idReception)) recDispatchable.set(idDossier, r);
        this.recByDossier.set(recByDossier);
        this.recDispatchable.set(recDispatchable);
        this.dispatchByDossier.set(dispatchByDossier);
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
  dateReception(d: Dossier): string | undefined {
    return this.recByDossier().get(d.idDossier)?.dateReception;
  }
  dateDispatch(d: Dossier): string | undefined {
    return this.dispatchByDossier().get(d.idDossier)?.dateDispatch;
  }
  attributaire(d: Dossier): string {
    const im = this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre;
    return im ? this.controleurMap().get(im) ?? im : '—';
  }
  /** Réception à dispatcher pour ce dossier si l'action est offerte (groupe) et autorisée (DISPATCH_WRITE) ; sinon null. */
  peutDispatcher(d: Dossier): Reception | null {
    if (!this.aActionDispatch() || !this.canDispatch()) return null;
    return this.recDispatchable().get(d.idDossier) ?? null;
  }
  /** Après dispatch réussi : le dossier passe DISPATCHE et quitte la liste pré-dispatch → recharge. */
  onDispatched(): void {
    this.dispatchItem.set(null);
    this.charger();
  }
}
