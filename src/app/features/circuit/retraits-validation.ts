import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DemandeRetrait, Dossier } from '../../models';
import { DemandeRetraitService, DossierService, ReferenceLookupService } from '../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../shared/circuit';
import { DossierConsultation } from './dossier-consultation';

/**
 * Validation des demandes de retrait (CC / Président) — worklist « À valider »
 * (/a-valider) + « Historique » (/historique), avec détail dossier en lecture seule.
 * Reflet du back : accepter → dossier renvoyé en brouillon (décidé serveur) ; on
 * affiche le résultat et on rafraîchit. 403/409 via l'intercepteur.
 */
@Component({
  selector: 'app-retraits-validation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation],
  template: `
    <section class="rv">
      <h1 class="rv__title">Demandes de retrait</h1>

      <div class="rv__tabs">
        <button type="button" class="cnm-tab" [class.cnm-tab--active]="onglet() === 'a-valider'" (click)="setOnglet('a-valider')">
          À valider
        </button>
        <button type="button" class="cnm-tab" [class.cnm-tab--active]="onglet() === 'historique'" (click)="setOnglet('historique')">
          Historique
        </button>
      </div>

      <div class="rv__grid">
        <div class="rv__main">
          @if (loading()) {
            <p class="cnm-muted">Chargement…</p>
          } @else if (onglet() === 'a-valider') {
            <table class="cnm-table">
              <thead><tr><th>Dossier</th><th>PRMP</th><th>Motif</th><th>Date</th><th></th></tr></thead>
              <tbody>
                @for (r of liste(); track r.idDemandeRetrait) {
                  <tr>
                    <td><button type="button" class="rv__link" (click)="voirDetail(r.idDossier)">{{ dossierRef(r.idDossier) }}</button></td>
                    <td>{{ r.idPrmp || '—' }}</td>
                    <td>{{ r.motifRetrait }}</td>
                    <td class="cnm-mono">{{ r.dateDemande || '—' }}</td>
                    <td>
                      @if (canDecide()) {
                        @if (refusOpen() === r.idDemandeRetrait) {
                          <div class="rv__refus">
                            <textarea
                              class="cnm-textarea"
                              rows="2"
                              placeholder="Motif du refus (obligatoire)"
                              [value]="refusMotif()"
                              (input)="refusMotif.set($any($event.target).value)"
                            ></textarea>
                            <div class="rv__refus-actions">
                              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="annulerRefus()">Annuler</button>
                              <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" [disabled]="deciding() || !refusMotif().trim()" (click)="confirmerRefus(r)">
                                Confirmer le refus
                              </button>
                            </div>
                          </div>
                        } @else {
                          <div class="rv__actions">
                            <button type="button" class="cnm-btn cnm-btn--success cnm-btn--sm" [disabled]="deciding()" (click)="accepter(r)">Accepter</button>
                            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirRefus(r.idDemandeRetrait!)">Refuser</button>
                          </div>
                        }
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="cnm-muted">Aucune demande à valider.</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <table class="cnm-table">
              <thead><tr><th>Dossier</th><th>PRMP</th><th>Motif</th><th>Statut</th><th>Date décision</th><th>Motif du refus</th></tr></thead>
              <tbody>
                @for (r of liste(); track r.idDemandeRetrait) {
                  <tr>
                    <td><button type="button" class="rv__link" (click)="voirDetail(r.idDossier)">{{ dossierRef(r.idDossier) }}</button></td>
                    <td>{{ r.idPrmp || '—' }}</td>
                    <td>{{ r.motifRetrait }}</td>
                    <td><app-statut-badge [statut]="r.statut" [label]="statutLabel(r.statut)" /></td>
                    <td class="cnm-mono">{{ r.dateDecision || '—' }}</td>
                    <td>{{ r.statut === 'REFUSEE' ? (r.obsDecision || '—') : '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="cnm-muted">Aucune demande décidée.</td></tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="cnm-card rv__detail">
          <div class="rv__panel-head">Détail du dossier</div>
          <div class="rv__panel-body">
            @if (loadingDetail()) {
              <p class="cnm-muted">Chargement…</p>
            } @else if (selectedDossier(); as d) {
              <app-dossier-consultation [dossier]="d" [embedded]="true" />
            } @else {
              <p class="cnm-muted">Cliquez sur un dossier pour voir son détail.</p>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .rv__title { margin: 0 0 var(--cnm-space-3); font-size: var(--cnm-fs-lg); }
    .rv__tabs { display: flex; gap: var(--cnm-space-2); margin-bottom: var(--cnm-space-3); }
    .rv__grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--cnm-space-3); align-items: start; }
    .rv__panel-head { padding: var(--cnm-space-3) var(--cnm-space-4); border-bottom: 1px solid var(--cnm-border); font-weight: var(--cnm-fw-semibold); }
    .rv__panel-body { padding: var(--cnm-space-4); }
    .rv__actions, .rv__refus-actions { display: flex; gap: var(--cnm-space-2); justify-content: flex-end; }
    .rv__refus { display: flex; flex-direction: column; gap: var(--cnm-space-2); min-width: 14rem; }
    .rv__link { background: transparent; border: 0; padding: 0; cursor: pointer; color: var(--cnm-brand); font: inherit; text-decoration: underline; }
    @media (max-width: 60rem) { .rv__grid { grid-template-columns: 1fr; } }
  `,
})
export class RetraitsValidation {
  private readonly service = inject(DemandeRetraitService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionsService);

  readonly onglet = signal<'a-valider' | 'historique'>('a-valider');
  readonly liste = signal<DemandeRetrait[]>([]);
  readonly loading = signal(true);
  readonly deciding = signal(false);
  readonly refusOpen = signal<number | null>(null);
  readonly refusMotif = signal('');
  readonly selectedDossier = signal<Dossier | null>(null);
  readonly loadingDetail = signal(false);
  private readonly dossierMap = signal<Map<string, string>>(new Map());

  readonly canDecide = computed(() => this.permissions.can('DEMANDE_RETRAIT_DECISION'));

  constructor() {
    this.lookups.lookup(DossierService, 'idDossier', ['refeDossier']).subscribe((m) => this.dossierMap.set(m));
    this.charger();
  }

  statutLabel(s?: string): string {
    return statutDemandeRetraitLabel(s);
  }
  dossierRef(id: number): string {
    return this.dossierMap().get(String(id)) ?? '#' + id;
  }

  setOnglet(o: 'a-valider' | 'historique'): void {
    if (this.onglet() === o) {
      return;
    }
    this.onglet.set(o);
    this.annulerRefus();
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    const call = this.onglet() === 'historique' ? this.service.historique() : this.service.aValider();
    call.subscribe({
      next: (rows) => {
        this.liste.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  voirDetail(idDossier: number): void {
    this.loadingDetail.set(true);
    this.selectedDossier.set(null);
    this.dossierService.getById(idDossier).subscribe({
      next: (d) => {
        this.selectedDossier.set(d);
        this.loadingDetail.set(false);
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  accepter(r: DemandeRetrait): void {
    if (r.idDemandeRetrait == null) {
      return;
    }
    this.deciding.set(true);
    this.service.accepter(r.idDemandeRetrait).subscribe({
      next: () => {
        this.toast.success('Demande acceptée — dossier renvoyé en brouillon.');
        this.deciding.set(false);
        this.charger();
      },
      error: (_e: ApiError) => this.deciding.set(false), // 403/409 → toast centralisé
    });
  }

  ouvrirRefus(id: number): void {
    this.refusOpen.set(id);
    this.refusMotif.set('');
  }
  annulerRefus(): void {
    this.refusOpen.set(null);
    this.refusMotif.set('');
  }
  confirmerRefus(r: DemandeRetrait): void {
    const motif = this.refusMotif().trim();
    if (r.idDemandeRetrait == null || !motif) {
      return;
    }
    this.deciding.set(true);
    this.service.refuser(r.idDemandeRetrait, motif).subscribe({
      next: () => {
        this.toast.success('Demande refusée.');
        this.deciding.set(false);
        this.annulerRefus();
        this.charger();
      },
      error: (_e: ApiError) => this.deciding.set(false),
    });
  }
}
