import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { DemandeRetrait, Dossier } from '../../models';
import { DemandeRetraitService, DossierService, ReferenceLookupService } from '../../services';
import { StatutBadge, statutDemandeRetraitLabel } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

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
    <section class="rt">
      <h1 class="rt__title">Demande de retrait</h1>

      <div class="rt__grid">
        <div class="cnm-card rt__panel">
          <div class="rt__panel-head">Nouvelle demande</div>
          <div class="rt__panel-body cnm-form">
            <label class="cnm-field">
              <span class="cnm-field__label">Dossier à retirer *</span>
              <select class="cnm-select" [value]="selectedId() ?? ''" (change)="onSelect($any($event.target).value)">
                <option value="" disabled>— Choisir un dossier —</option>
                @for (d of retirables(); track d.idDossier) {
                  <option [value]="d.idDossier">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</option>
                }
              </select>
              @if (!retirables().length && !loading()) {
                <span class="cnm-field__hint">
                  Aucun dossier éligible au retrait. Un dossier ne peut être retiré qu'avant d'avoir été dispatché.
                </span>
              }
              @if (fieldErr('idDossier')) { <span class="cnm-field__hint">{{ fieldErr('idDossier') }}</span> }
            </label>

            <label class="cnm-field">
              <span class="cnm-field__label">Motif du retrait *</span>
              <textarea
                class="cnm-textarea"
                rows="4"
                [value]="motif()"
                (input)="motif.set($any($event.target).value)"
              ></textarea>
              @if (fieldErr('motifRetrait')) { <span class="cnm-field__hint">{{ fieldErr('motifRetrait') }}</span> }
            </label>

            <div class="rt__foot">
              <button
                type="button"
                class="cnm-btn cnm-btn--primary"
                [disabled]="saving() || !retirables().length || selectedId() == null || !motif().trim()"
                (click)="soumettre()"
              >
                {{ saving() ? 'Envoi…' : 'Soumettre la demande' }}
              </button>
            </div>
          </div>
        </div>

        <div class="cnm-card rt__panel">
          <div class="rt__panel-head">Détail du dossier</div>
          <div class="rt__panel-body">
            @if (selectedDossier(); as d) {
              <app-dossier-consultation [dossier]="d" [embedded]="true" />
            } @else {
              <p class="cnm-muted">Sélectionnez un dossier pour voir son détail.</p>
            }
          </div>
        </div>
      </div>

      <h2 class="rt__sub">Mes demandes</h2>
      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Dossier</th><th>Motif</th><th>Statut</th><th>Date</th><th>Motif du refus</th></tr>
          </thead>
          <tbody>
            @for (r of demandes(); track r.idDemandeRetrait) {
              <tr>
                <td>{{ dossierRef(r.idDossier) }}</td>
                <td>{{ r.motifRetrait }}</td>
                <td><app-statut-badge [statut]="r.statut" [label]="statutLabel(r.statut)" /></td>
                <td class="cnm-mono">{{ r.dateDemande || '—' }}</td>
                <td>{{ r.statut === 'REFUSEE' ? (r.obsDecision || '—') : '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="cnm-muted">Aucune demande.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .rt__title { margin: 0 0 var(--cnm-space-4); font-size: var(--cnm-fs-lg); }
    .rt__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); align-items: start; }
    .rt__panel-head { padding: var(--cnm-space-3) var(--cnm-space-4); border-bottom: 1px solid var(--cnm-border); font-weight: var(--cnm-fw-semibold); }
    .rt__panel-body { padding: var(--cnm-space-4); display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .rt__foot { display: flex; justify-content: flex-end; }
    .rt__sub { margin: var(--cnm-space-5) 0 var(--cnm-space-3); font-size: var(--cnm-fs-md); }
    @media (max-width: 60rem) { .rt__grid { grid-template-columns: 1fr; } }
  `,
})
export class PrmpRetraits {
  private readonly service = inject(DemandeRetraitService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);

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
    forkJoin({ retirables: this.dossierService.retirables(), demandes: this.service.list() }).subscribe({
      next: (r) => {
        this.retirables.set(r.retirables);
        this.demandes.set(r.demandes);
        this.loading.set(false);
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
