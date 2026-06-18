import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  template: `
    <section class="mb">
      <header class="mb__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mb__title">Mes brouillons</h1>
      </header>

      @if (loading()) {
        <p class="mb__info">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr>
              <th>#</th><th>Type</th><th>Référence</th><th>Localité</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (d of brouillons(); track d.idDossier) {
              <tr>
                <td class="cnm-mono">{{ d.idDossier }}</td>
                <td>{{ typeLabel(d) }}</td>
                <td>{{ reference(d) }}</td>
                <td>{{ localiteLabel(d) }}</td>
                <td class="mb__actions">
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrir(d)">Ouvrir</button>
                  <button
                    type="button"
                    class="cnm-btn cnm-btn--success cnm-btn--sm"
                    [disabled]="submittingId() === d.idDossier"
                    (click)="soumettre(d)"
                  >
                    Soumettre
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="mb__info">Aucun brouillon. Saisissez un dossier depuis « Saisir & soumettre ».</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .mb__header { margin-bottom: var(--cnm-space-4); }
    .mb__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .mb__info { color: var(--cnm-text-2); padding: var(--cnm-space-3); text-align: center; }
    .mb__actions { display: flex; gap: var(--cnm-space-1); justify-content: flex-end; }
  `,
})
export class MesBrouillons {
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly brouillons = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly submittingId = signal<number | null>(null);
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly ppmRef = signal<Map<number, string>>(new Map());

  constructor() {
    this.charger();
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
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
      const m = new Map<number, string>();
      for (const p of ppms) {
        m.set(p.idDossier, p.reference);
      }
      this.ppmRef.set(m);
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

  ouvrir(d: Dossier): void {
    this.router.navigate(['/prmp/soumettre-dossier'], { queryParams: { reprendre: d.idDossier } });
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
}
