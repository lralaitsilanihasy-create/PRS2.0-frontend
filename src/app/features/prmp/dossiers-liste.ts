import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier } from '../../models';
import {
  DossierService,
  LocaliteService,
  MarcheService,
  PpmService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { DetailPpmModal } from '../../shared/prmp';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/** Groupe de statut du menu « Mes dossiers » : brouillons vs tout ce qui est soumis (non brouillon). */
type Groupe = 'brouillon' | 'soumis';

/**
 * Liste des dossiers d'un **type** donné (référentiel `type-dossier`) filtrés par **groupe de statut**
 * (`brouillon` = BROUILLON ; `soumis` = tout sauf BROUILLON). Route : `/prmp/dossiers/:type/:groupe`.
 * Écran générique du menu « Mes dossiers » (arborescence type → statut construite dynamiquement).
 *
 * Liste = `GET /api/dossiers` (déjà scopé à la PRMP propriétaire par le backend), filtrée côté client
 * par type + statut. Pour un brouillon : ouvrir/soumettre/supprimer ; pour un dossier soumis : consulter.
 */
@Component({
  selector: 'app-dossiers-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailPpmModal],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
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
                <th>#</th><th>Référence</th><th>Statut</th><th>Localité</th><th class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr>
                  <td class="td-ref">{{ d.idDossier }}</td>
                  <td>{{ reference(d) }}</td>
                  <td>{{ d.statut || '—' }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrir(d)">Ouvrir</button>
                      @if (groupe() === 'brouillon') {
                        <!-- Soumission réservée à la PRMP ; l'UGPM ouvre/édite mais ne soumet pas (backend 403). -->
                        @if (estPrmp()) {
                          <button
                            type="button"
                            class="btn btn-success btn-sm"
                            [disabled]="submittingId() === d.idDossier || ppmManquant(d)"
                            [title]="ppmManquant(d) ? 'Impossible de soumettre : aucun PPM rattaché. Ouvrez le dossier pour ajouter un PPM.' : ''"
                            (click)="soumettre(d)"
                          >
                            Soumettre
                          </button>
                        }
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          [disabled]="suppression() === d.idDossier"
                          (click)="demanderSuppression(d)"
                        >
                          Supprimer
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-cell">{{ messageVide() }}</td></tr>
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
        [modeEdition]="groupe() === 'brouillon'"
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
export class DossiersListe {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly auth = inject(AuthService);
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');

  /** Type de dossier (idTypeDossier) et groupe de statut, lus dans l'URL (réactifs aux changements de menu). */
  readonly type = signal<string>('');
  readonly groupe = signal<Groupe>('brouillon');

  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly submittingId = signal<number | null>(null);
  readonly confirmDossier = signal<Dossier | null>(null);
  readonly suppression = signal<number | null>(null);
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly ppmRef = signal<Map<number, string>>(new Map());
  /** idDossier → idPpm (via `GET /api/marches`, MarcheDto portant idPpm) pour ouvrir le détail PPM. */
  private readonly ppmParDossier = signal<Map<number, number>>(new Map());

  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);

  /** Libellé du type courant (référentiel), repli sur l'id. */
  readonly typeLabel = computed(() => this.typeMap().get(this.type()) ?? this.type());
  readonly titre = computed(() => `${this.typeLabel()} — ${this.groupe() === 'brouillon' ? 'Brouillons' : 'Soumis'}`);
  readonly messageVide = computed(() =>
    this.groupe() === 'brouillon'
      ? 'Aucun brouillon de ce type. Saisissez un dossier depuis « Saisir & soumettre ».'
      : 'Aucun dossier soumis de ce type.',
  );

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    // Réagit aux changements d'URL (navigation entre entrées du menu, même composant réutilisé).
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.type.set(p.get('type') ?? '');
      this.groupe.set(p.get('groupe') === 'soumis' ? 'soumis' : 'brouillon');
      this.charger();
    });
    // Recharge quand un autre écran signale un changement (suppression, soumission…).
    effect(() => {
      this.dossiersRefresh.revision();
      this.charger();
    });
  }

  private charger(): void {
    const type = this.type();
    if (!type) return;
    const brouillon = this.groupe() === 'brouillon';
    this.loading.set(true);
    // `list('BROUILLON')` côté serveur pour les brouillons ; sinon liste complète filtrée « non brouillon ».
    this.dossierService.list(brouillon ? 'BROUILLON' : undefined).subscribe({
      next: (rows) => {
        this.dossiers.set(
          rows.filter((d) => d.idTypeDossier === type && (brouillon ? d.statut === 'BROUILLON' : d.statut !== 'BROUILLON')),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.ppmService.list().subscribe((ppms) => this.ppmRef.set(new Map(ppms.map((p) => [p.idDossier, p.reference]))));
    this.marcheService.list().subscribe((marches) => {
      const ids = new Map<number, number>();
      for (const m of marches) ids.set(m.idDossier, m.idPpm);
      this.ppmParDossier.set(ids);
    });
  }

  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  reference(d: Dossier): string {
    return d.refeDossier || this.ppmRef().get(d.idDossier) || '—';
  }
  /** Dossier PPM sans contenu rattaché → soumission impossible (409, §3.1). */
  ppmManquant(d: Dossier): boolean {
    return d.idTypeDossier === 'PPM' && !this.ppmParDossier().has(d.idDossier);
  }

  /**
   * « Ouvrir » : détail PPM dans le modal partagé (édition si brouillon, lecture sinon). Pour un dossier
   * **sans PPM** (DAO/MAOO), repli sur le formulaire d'édition — uniquement pertinent pour un brouillon.
   */
  ouvrir(d: Dossier): void {
    const idPpm = this.ppmParDossier().get(d.idDossier);
    if (idPpm != null) {
      this.detail.set({ idDossier: d.idDossier, idPpm });
    } else if (this.groupe() === 'brouillon') {
      this.router.navigate(['/prmp/soumettre-dossier'], { queryParams: { reprendre: d.idDossier } });
    } else {
      this.toast.info('Aucun détail à afficher pour ce dossier (pas de PPM rattaché).');
    }
  }
  fermerDetail(): void {
    this.detail.set(null);
  }
  onModifie(): void {
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }

  soumettre(d: Dossier): void {
    this.submittingId.set(d.idDossier);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.submittingId.set(null);
        this.dossiersRefresh.notifierChangement();
        this.charger();
      },
      error: (e: ApiError) => {
        this.submittingId.set(null);
        // Pas de formulaire ici pour porter les fieldErrors (ex. AGPM sur « piecesJointes ») : le toast
        // centralisé est supprimé en 400 fieldErrors → on affiche nous-mêmes le détail du backend.
        const detail = e.fieldErrors ? Object.values(e.fieldErrors).join(' ') : '';
        this.toast.error(detail || e.message || 'Échec de la soumission.', 'Soumission impossible');
      },
    });
  }

  demanderSuppression(d: Dossier): void {
    this.confirmDossier.set(d);
  }
  annulerSuppression(): void {
    if (this.suppression() === null) this.confirmDossier.set(null);
  }
  confirmerSuppression(): void {
    const d = this.confirmDossier();
    if (!d) return;
    this.suppression.set(d.idDossier);
    this.dossierService.supprimer(d.idDossier).subscribe({
      next: () => {
        this.toast.success('Dossier supprimé avec succès.');
        this.dossiers.update((arr) => arr.filter((x) => x.idDossier !== d.idDossier));
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
