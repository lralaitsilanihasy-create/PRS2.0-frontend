import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, Ppm } from '../../models';
import { MarcheService, PpmService } from '../../services';
import { DetailPpmModal } from '../../shared/prmp';
import { EtatErreur } from '../../shared/ui/etat-erreur';

const PAGE_SIZE = 15;

/**
 * Liste des PPM (lecture seule, périmètre filtré par le backend selon le profil/localité).
 * Le détail (marchés, dates, pièces jointes) est délégué au composant partagé `DetailPpmModal`,
 * ouvert en lecture seule (`modeEdition=false`).
 *
 * **Pagination serveur** (AUDIT.md P1) : n'affiche que la page courante de PPM, via
 * `GET /api/ppms?page=&size=`. Aucun filtre mémoire ne porte sur cette liste — le rendu est direct,
 * donc rien n'interdit de la paginer côté serveur (contrairement à « Mes PPM & marchés », qui garde
 * un garde-fou d'affichage sur le statut du dossier). Le compteur de marchés par PPM reste
 * alimenté par la liste complète des marchés (jointure client sur `idPpm`, hors périmètre de ce
 * chantier) : gain réseau sur les PPM uniquement, pas sur les marchés.
 */
@Component({
  selector: 'app-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailPpmModal, EtatErreur],
  template: `
    <section>
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">PPM &amp; marchés rattachés</h1>
        </div>
        <span class="badge badge-neutral">{{ total() }} PPM</span>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les PPM." (reessayer)="charger()" />
      } @else {
        @for (ppm of ppms(); track ppm.idPpm) {
          <div class="card ppm-row">
            <div class="ppm-row__head">
              <span class="ppm-row__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
              <span class="ppm-row__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
              <span class="badge badge-neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDetail(ppm)">Détails</button>
          </div>
        } @empty {
          <p class="text-muted">Aucun PPM dans votre périmètre.</p>
        }

        @if (totalPages() > 1) {
          <nav class="ppm-pager" aria-label="Pagination">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="page() === 0" (click)="prev()">
              ‹ Précédent
            </button>
            <span class="ppm-pager__info">Page {{ page() + 1 }} / {{ totalPages() }}</span>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="page() >= totalPages() - 1"
              (click)="next()"
            >
              Suivant ›
            </button>
          </nav>
        }
      }
    </section>

    @if (detail(); as d) {
      <app-detail-ppm-modal
        [idDossier]="d.idDossier"
        [idPpm]="d.idPpm"
        [modeEdition]="false"
        (fermer)="fermerDetail()"
      />
    }
  `,
  styles: `
    .ppm-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      margin-bottom: 0.75rem;
    }
    .ppm-row__head { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
    .ppm-row__ref { font-weight: 700; color: var(--c-800); }
    .ppm-row__sub { color: var(--n-400); font-size: var(--text-sm); flex: 1; min-width: 0; }
    .ppm-pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .ppm-pager__info { font-size: var(--text-sm); color: var(--n-500); }
  `,
})
export class PpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);

  /** Page courante uniquement (au plus PAGE_SIZE PPM), telle que servie. */
  readonly ppms = signal<Ppm[]>([]);
  /** Référentiel complet, pour le compteur de marchés par PPM (hors périmètre de la pagination). */
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  readonly page = signal(0);
  /** Nombre total de PPM du périmètre — donné par le serveur, jamais déduit d'un tableau local. */
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly detail = signal<{ idDossier: number; idPpm: number } | null>(null);

  /** Marchés groupés par idPpm (jointure client sur la FK) — pour le compteur. */
  private readonly byPpm = computed(() => {
    const map = new Map<number, Marche[]>();
    for (const m of this.marches()) {
      const list = map.get(m.idPpm) ?? [];
      list.push(m);
      map.set(m.idPpm, list);
    }
    return map;
  });

  constructor() {
    this.charger();
    // Référentiel des marchés : indépendant de la pagination des PPM, chargé une seule fois.
    this.marcheService.list().subscribe({ next: (r) => this.marches.set(r) });
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.ppmService.listePage(this.page(), PAGE_SIZE).subscribe({
      next: (p) => {
        this.ppms.set(p.content);
        this.total.set(p.totalElements);
        this.totalPages.set(Math.max(1, p.totalPages));
        this.loading.set(false);
      },
      error: () => {
        this.ppms.set([]);
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }
  ouvrirDetail(ppm: Ppm): void {
    this.detail.set({ idDossier: ppm.idDossier, idPpm: ppm.idPpm });
  }
  fermerDetail(): void {
    this.detail.set(null);
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
