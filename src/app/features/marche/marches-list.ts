import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Marche } from '../../models';
import { MarcheService, PpmService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { EtatErreur } from '../../shared/ui/etat-erreur';

const PAGE_SIZE = 15;

/**
 * Liste des Marchés. Peut être filtrée par PPM via le query param `?ppm=<idPpm>`
 * (lien « Voir ses marchés » depuis l'écran PPM).
 *
 * **Pagination serveur** (AUDIT.md P1) : l'écran ne charge que la page affichée, via
 * `GET /api/marches?page=&size=&ppm=`. Il téléchargeait auparavant la table entière — scopée au
 * périmètre de l'appelant, mais entière — pour la filtrer et la découper en mémoire ; le coût
 * croissait donc linéairement avec la base pour n'afficher que 15 lignes.
 *
 * Le filtre PPM est passé au serveur, et non plus appliqué après coup : paginer d'abord puis
 * filtrer la page servie donnerait des pages incomplètes et un total faux.
 */
@Component({
  selector: 'app-marches-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, RouterLink, EtatErreur],
  template: `
    <section class="marches">
      <header class="marches__header">
        <div>
          <span class="cnm-section-label">Domaine PRMP</span>
          <h1 class="marches__title">Marchés</h1>
        </div>
        <span class="cnm-badge cnm-badge--neutral">{{ total() }} marché(s)</span>
      </header>

      @if (ppmFilter()) {
        <div class="marches__filter">
          <span>
            Filtré sur le PPM
            <strong>{{ ppmRef() || ('#' + ppmFilter()) }}</strong>
          </span>
          <a class="cnm-btn cnm-btn--ghost cnm-btn--sm" routerLink="/prmp/marches">
            Voir tous les marchés
          </a>
        </div>
      }

      @if (erreur()) {
        <app-etat-erreur message="Impossible de charger les marchés." (reessayer)="charger()" />
      }

      <div class="cnm-table-wrap">
        <table class="cnm-table">
          <thead>
            <tr>
              <th scope="col">Désignation</th>
              <th scope="col">PPM</th>
              <th scope="col">Dossier</th>
              <th scope="col">Compte</th>
              <th scope="col" class="cnm-num">Montant estimé</th>
              <th scope="col">Financement</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="7" class="cnm-table__empty" role="status">Chargement…</td></tr>
            } @else if (erreur()) {
              <tr><td colspan="7" class="cnm-table__empty">—</td></tr>
            } @else {
              @for (m of marches(); track m.idDetail) {
                <tr>
                  <td>{{ m.designationMarche || '—' }}</td>
                  <td class="cnm-mono">{{ m.idPpm }}</td>
                  <td class="cnm-mono">{{ m.idDossier }}</td>
                  <td class="cnm-mono">{{ m.numCompte || '—' }}</td>
                  <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                  <td>{{ m.financement || '—' }}</td>
                  <td><app-statut-badge [statut]="m.statut" /></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="cnm-table__empty">Aucun marché.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="marches__pager" aria-label="Pagination">
          <button class="cnm-btn cnm-btn--ghost cnm-btn--sm" [disabled]="page() === 0" (click)="prev()">
            ‹ Précédent
          </button>
          <span class="marches__pager-info">Page {{ page() + 1 }} / {{ totalPages() }}</span>
          <button
            class="cnm-btn cnm-btn--ghost cnm-btn--sm"
            [disabled]="page() >= totalPages() - 1"
            (click)="next()"
          >
            Suivant ›
          </button>
        </nav>
      }
    </section>
  `,
  styles: `
    .marches__header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: var(--cnm-space-4);
    }
    .marches__title {
      margin: 2px 0 0;
      font-size: var(--cnm-fs-lg);
    }
    .marches__filter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cnm-space-3);
      padding: var(--cnm-space-2) var(--cnm-space-4);
      margin-bottom: var(--cnm-space-3);
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-left: 3px solid var(--cnm-brand);
      border-radius: var(--cnm-radius);
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
    }
    .marches__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--cnm-space-3);
      margin-top: var(--cnm-space-3);
    }
    .marches__pager-info {
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
      font-family: var(--cnm-mono);
    }
  `,
})
export class MarchesList {
  private readonly service = inject(MarcheService);
  private readonly ppmService = inject(PpmService);
  private readonly route = inject(ActivatedRoute);

  /** Page courante uniquement (au plus PAGE_SIZE lignes), telle que servie. */
  readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement (affiche l'état d'erreur + « Réessayer »). */
  readonly erreur = signal(false);
  readonly page = signal(0);
  /** Nombre total de marchés du périmètre filtré — donné par le serveur, plus déduit d'un tableau. */
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly ppmFilter = signal<string | null>(null);
  readonly ppmRef = signal<string | null>(null);

  constructor() {
    // Une seule source de chargement : le query param. S'abonner émet immédiatement, donc le
    // premier chargement part d'ici — pas d'appel supplémentaire au constructeur (AUDIT.md P7).
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const ppm = params.get('ppm');
      this.ppmFilter.set(ppm);
      this.page.set(0);
      this.ppmRef.set(null);
      if (ppm) {
        this.ppmService.getById(Number(ppm)).subscribe({
          next: (p) => this.ppmRef.set(p.reference ?? `#${ppm}`),
          error: () => this.ppmRef.set(null),
        });
      }
      this.charger();
    });
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    const ppm = this.ppmFilter();
    this.loading.set(true);
    this.erreur.set(false);
    this.service.listePage(this.page(), PAGE_SIZE, ppm ? { ppm } : undefined).subscribe({
      next: (p) => {
        this.marches.set(p.content);
        this.total.set(p.totalElements);
        this.totalPages.set(Math.max(1, p.totalPages));
        this.loading.set(false);
      },
      error: () => {
        this.marches.set([]);
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  montant(value?: number): string {
    if (value === null || value === undefined) {
      return '—';
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  prev(): void {
    if (this.page() === 0) {
      return;
    }
    this.page.update((p) => p - 1);
    this.charger();
  }

  next(): void {
    if (this.page() >= this.totalPages() - 1) {
      return;
    }
    this.page.update((p) => p + 1);
    this.charger();
  }
}
