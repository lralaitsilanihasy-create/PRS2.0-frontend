import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier } from '../../models';
import {
  DossierService,
  LocaliteService,
  PpmService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { DetailPpmModal } from '../../shared/prmp';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * « Mes brouillons » (PRMP) : sélection d'un dossier déjà créé (PPM/DAO/MAOO) en BROUILLON,
 * pour l'ouvrir (édition via l'écran de saisie) ou le soumettre.
 *
 * Liste = GET /api/dossiers filtré sur statut === 'BROUILLON' (le backend ne renvoie que les
 * dossiers de la PRMP propriétaire). Type & localité résolus en libellés. La « référence »
 * d'un brouillon n'existe pas encore (générée à la soumission) : on affiche la référence du
 * PPM si disponible, sinon « — ». Soumission via POST /api/dossiers/{id}/soumettre.
 */
@Component({
  selector: 'app-mes-brouillons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailPpmModal],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Mes brouillons</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Type</th><th>Référence</th><th>Localité</th><th class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of brouillons(); track d.idDossier) {
                <tr>
                  <td class="td-ref">{{ d.idDossier }}</td>
                  <td>{{ typeLabel(d) }}</td>
                  <td>{{ reference(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir(d)">Ouvrir</button>
                      <button
                        type="button"
                        class="btn btn-success btn-sm"
                        [disabled]="submittingId() === d.idDossier || ppmManquant(d)"
                        [title]="ppmManquant(d) ? 'Impossible de soumettre : aucun PPM rattaché à ce dossier. Ouvrez le dossier pour ajouter un PPM.' : ''"
                        (click)="soumettre(d)"
                      >
                        Soumettre
                      </button>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        [disabled]="suppression() === d.idDossier"
                        (click)="demanderSuppression(d)"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-cell">Aucun brouillon. Saisissez un dossier depuis « Saisir &amp; soumettre ».</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (confirmDossier(); as d) {
      <div class="modal-backdrop" (click)="annulerSuppression()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true">
          <div class="modal-header-plain">
            <span class="modal-title">Supprimer ce dossier ?</span>
            <button type="button" class="btn-close-plain" [disabled]="suppression() !== null" (click)="annulerSuppression()">✕</button>
          </div>
          <div class="modal-body">
            <p>Êtes-vous sûr de vouloir supprimer ce dossier ? Cette action est irréversible.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="suppression() !== null" (click)="annulerSuppression()">
              Annuler
            </button>
            <button type="button" class="btn btn-danger" [disabled]="suppression() !== null" (click)="confirmerSuppression()">
              {{ suppression() !== null ? 'Suppression…' : 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (detail(); as d) {
      <app-detail-ppm-modal
        [idDossier]="d.idDossier"
        [idPpm]="d.idPpm"
        [modeEdition]="true"
        (fermer)="fermerDetail()"
        (modifie)="onModifie()"
      />
    }
  `,
  styles: `
    .actions-end { justify-content: flex-end; }
    .empty-cell { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .confirm-modal { max-width: 28rem; }
  `,
})
export class MesBrouillons {
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly brouillons = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly submittingId = signal<number | null>(null);
  /** Dossier en attente de confirmation de suppression (null = pas de modale). */
  readonly confirmDossier = signal<Dossier | null>(null);
  /** idDossier en cours de suppression (désactive les boutons). */
  readonly suppression = signal<number | null>(null);
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly ppmRef = signal<Map<number, string>>(new Map());
  /** idDossier → idPpm (dérivé de `GET /api/ppms`) ; permet d'ouvrir le détail PPM d'un brouillon. */
  private readonly ppmParDossier = signal<Map<number, number>>(new Map());

  /** Détail PPM ouvert (null = fermé) ; toujours en mode édition (brouillon = périmètre PRMP). */
  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    // Charge à l'init ET à chaque changement signalé (ex. suppression depuis « Mes PPM & marchés »).
    effect(() => {
      this.dossiersRefresh.revision();
      this.charger();
    });
  }

  private charger(): void {
    this.loading.set(true);
    this.dossierService.list('BROUILLON').subscribe({
      next: (rows) => {
        this.brouillons.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.ppmService.list().subscribe((ppms) => {
      const refs = new Map<number, string>();
      const ids = new Map<number, number>();
      for (const p of ppms) {
        refs.set(p.idDossier, p.reference);
        ids.set(p.idDossier, p.idPpm);
      }
      this.ppmRef.set(refs);
      this.ppmParDossier.set(ids);
    });
  }

  typeLabel(d: Dossier): string {
    return d.idTypeDossier ? this.typeMap().get(d.idTypeDossier) ?? d.idTypeDossier : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  reference(d: Dossier): string {
    return d.refeDossier || this.ppmRef().get(d.idDossier) || '—';
  }

  /**
   * Dossier de type PPM sans PPM rattaché → soumission impossible (409, §3.1).
   * Dérivé de `GET /api/ppms` déjà chargé (`ppmRef`), sans champ backend dédié.
   */
  ppmManquant(d: Dossier): boolean {
    return d.idTypeDossier === 'PPM' && !this.ppmRef().has(d.idDossier);
  }

  /**
   * « Ouvrir » : affiche le détail PPM dans le modal partagé (mode édition). Repli sur le formulaire
   * d'édition pour un dossier **sans PPM** (DAO/MAOO), où il n'y a pas de détail PPM à présenter.
   */
  ouvrir(d: Dossier): void {
    const idPpm = this.ppmParDossier().get(d.idDossier);
    if (idPpm != null) {
      this.detail.set({ idDossier: d.idDossier, idPpm });
    } else {
      this.router.navigate(['/prmp/soumettre-dossier'], { queryParams: { reprendre: d.idDossier } });
    }
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
  /** Après une mutation dans le modal (ex. suppression PPM → cascade dossier) : recharge la liste. */
  onModifie(): void {
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }

  soumettre(d: Dossier): void {
    this.submittingId.set(d.idDossier);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.router.navigate(['/prmp/tableau-de-bord']);
      },
      error: (_e: ApiError) => this.submittingId.set(null), // 403/409/400 → toast centralisé
    });
  }

  demanderSuppression(d: Dossier): void {
    this.confirmDossier.set(d);
  }
  annulerSuppression(): void {
    if (this.suppression() === null) {
      this.confirmDossier.set(null);
    }
  }
  /** Confirme la suppression : DELETE /api/dossiers/{id} ; 204 → retire la ligne ; messages dédiés 409/403/404. */
  confirmerSuppression(): void {
    const d = this.confirmDossier();
    if (!d) {
      return;
    }
    this.suppression.set(d.idDossier);
    this.dossierService.supprimer(d.idDossier).subscribe({
      next: () => {
        this.toast.success('Dossier supprimé avec succès.');
        this.brouillons.update((arr) => arr.filter((x) => x.idDossier !== d.idDossier));
        // Propage le retrait aux autres écrans (tableau de bord, Mes PPM & marchés…).
        this.dossiersRefresh.notifierSuppression(d.idDossier);
        this.suppression.set(null);
        this.confirmDossier.set(null);
      },
      error: (e: ApiError) => {
        this.suppression.set(null);
        this.confirmDossier.set(null);
        this.toast.error(
          e.status === 403
            ? "Vous n'êtes pas autorisé à supprimer ce dossier."
            : e.status === 404
              ? 'Dossier introuvable.'
              : e.message || 'Erreur lors de la suppression.',
        );
      },
    });
  }
}
