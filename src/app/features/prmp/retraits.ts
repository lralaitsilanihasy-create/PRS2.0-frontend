import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DemandeRetrait, Dossier } from '../../models';
import { DemandeRetraitService, DossierService, ReferenceLookupService } from '../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * Demande de retrait (PRMP) — deux colonnes : formulaire motivé (gauche) + détail
 * lecture seule du dossier sélectionné (droite) ; suivi des demandes en dessous.
 * Reflet du back : identité/date/statut posés serveur (non envoyés) ; on n'envoie
 * que `{ idDossier, motifRetrait }`. 403/409 via l'intercepteur.
 */
@Component({
  selector: 'app-prmp-retraits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Demande de retrait</h1>
        </div>
      </header>

      <div class="rt-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Nouvelle demande</span></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label required">Dossier à retirer</label>
              <select class="form-control" [value]="selectedId() ?? ''" (change)="onSelect($any($event.target).value)">
                <option value="" disabled>— Choisir un dossier —</option>
                @for (d of retirables(); track d.idDossier) {
                  <option [value]="d.idDossier">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</option>
                }
              </select>
              @if (!retirables().length && !loading()) {
                <span class="form-hint">
                  Aucun dossier éligible au retrait. Un dossier ne peut être retiré qu'avant d'avoir été dispatché.
                </span>
              }
              @if (fieldErr('idDossier')) { <span class="form-error">{{ fieldErr('idDossier') }}</span> }
            </div>

            <div class="form-group">
              <label class="form-label required">Motif du retrait</label>
              <textarea
                class="form-control"
                rows="4"
                [value]="motif()"
                (input)="motif.set($any($event.target).value)"
              ></textarea>
              @if (fieldErr('motifRetrait')) { <span class="form-error">{{ fieldErr('motifRetrait') }}</span> }
            </div>

            <div class="rt-foot">
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="saving() || !retirables().length || selectedId() == null || !motif().trim()"
                (click)="soumettre()"
              >
                {{ saving() ? 'Envoi…' : 'Soumettre la demande' }}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Détail du dossier</span></div>
          <div class="card-body">
            @if (selectedDossier(); as d) {
              <app-dossier-consultation [dossier]="d" [embedded]="true" />
            } @else {
              <p class="text-muted">Sélectionnez un dossier pour voir son détail.</p>
            }
          </div>
        </div>
      </div>

      <h2 class="rt-sub">Mes demandes</h2>
      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr><th>Dossier</th><th>Motif</th><th>Statut</th><th>Date</th><th>Motif du refus</th></tr>
            </thead>
            <tbody>
              @for (r of demandes(); track r.idDemandeRetrait) {
                <tr>
                  <td>{{ dossierRef(r.idDossier) }}</td>
                  <td>{{ r.motifRetrait }}</td>
                  <td><app-statut-badge [statut]="r.statut" [label]="statutLabel(r.statut)" /></td>
                  <td>{{ r.dateDemande || '—' }}</td>
                  <td>{{ r.statut === 'REFUSEE' ? (r.obsDecision || '—') : '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-cell">Aucune demande.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .rt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
    .rt-foot { display: flex; justify-content: flex-end; }
    .rt-sub { margin: 1.75rem 0 0.75rem; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .table-card td { white-space: normal; }
    @media (max-width: 60rem) { .rt-grid { grid-template-columns: 1fr; } }
  `,
})
export class PrmpRetraits {
  private readonly service = inject(DemandeRetraitService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly retirables = signal<Dossier[]>([]);
  readonly demandes = signal<DemandeRetrait[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly motif = signal('');
  readonly formError = signal<ApiError | null>(null);
  private readonly dossierMap = signal<Map<string, string>>(new Map());

  readonly selectedDossier = computed(() => {
    const id = this.selectedId();
    return id == null ? null : this.retirables().find((d) => d.idDossier === id) ?? null;
  });

  constructor() {
    this.lookups.lookup(DossierService, 'idDossier', ['refeDossier']).subscribe((m) => this.dossierMap.set(m));
    this.charger();
  }

  fieldErr(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }
  statutLabel(s?: string): string {
    return statutDemandeRetraitLabel(s);
  }
  dossierRef(id: number): string {
    return this.dossierMap().get(String(id)) ?? '#' + id;
  }

  onSelect(value: string): void {
    this.selectedId.set(value ? Number(value) : null);
  }

  private charger(): void {
    this.loading.set(true);
    // `mes-demandes` marque l'écran consulté côté serveur (remet à zéro le compteur du menu).
    forkJoin({ retirables: this.dossierService.retirables(), demandes: this.service.getMesDemandes() }).subscribe({
      next: (r) => {
        this.retirables.set(r.retirables);
        this.demandes.set(r.demandes);
        this.loading.set(false);
        // Le compteur « demandes de retrait nouvelles » a été remis à zéro serveur → rafraîchir le menu.
        this.dossiersRefresh.notifierChangement();
      },
      error: () => this.loading.set(false),
    });
  }

  soumettre(): void {
    const idDossier = this.selectedId();
    const motif = this.motif().trim();
    if (idDossier == null || !motif) {
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    // On n'envoie que idDossier + motif ; idPrmp/date/statut sont posés serveur.
    this.service.creer({ idDossier, motifRetrait: motif } as DemandeRetrait).subscribe({
      next: () => {
        this.toast.success('Demande de retrait soumise.');
        this.selectedId.set(null);
        this.motif.set('');
        this.saving.set(false);
        this.charger();
      },
      error: (err: ApiError) => {
        this.formError.set(err); // 400 → messages sous les champs (fieldErr)
        this.saving.set(false);
        if (err.status === 409) {
          this.toast.error(
            "Ce dossier ne peut plus faire l'objet d'une demande de retrait : il a déjà été dispatché.",
          );
        } else if (err.status === 403) {
          this.toast.error("Vous n'êtes pas autorisé à demander le retrait de ce dossier.");
        } else if (err.status !== 400) {
          this.toast.error(err.message || 'Erreur lors de la demande de retrait.');
        }
      },
    });
  }
}
