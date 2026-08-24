import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { PrmpEntite } from '../../models';
import { EntiteContractService, PrmpEntiteService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/** Ligne d'affichage : le lien PRMP↔entité en attente + le libellé de l'entité (jointure). */
interface RattachementEnAttente {
  lien: PrmpEntite;
  libelle: string;
}

/**
 * Approbation des **rattachements PRMP↔entité en attente** (profil ADMINISTRATEUR).
 * Quand une PRMP enregistre une nouvelle entité à l'import d'un PPM, le serveur auto-crée le lien
 * `prmp-entites` en attente (`actif=false`). L'ADMIN l'**approuve** (`PUT {actif:true}`) — l'entité
 * devient alors sélectionnable par la PRMP — ou le **rejette** (`DELETE`).
 */
@Component({
  selector: 'app-rattachements-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="ra">
      <header class="page-header">
        <h1 class="page-title">Rattachements en attente ({{ rattachements().length }})</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="text-muted ra__hint">
        Rattachements PRMP↔entité créés à l'import d'un PPM et en attente d'activation. Approuver rend
        l'entité sélectionnable par la PRMP ; rejeter supprime le rattachement (l'entité reste au référentiel).
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les rattachements en attente." (reessayer)="charger()" />
      } @else if (rattachements().length) {
        <div class="table-card">
          <table class="cnm-table">
            <thead>
              <tr><th scope="col">PRMP</th><th scope="col">Entité contractante</th><th scope="col">Date d'affectation</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody>
              @for (r of rattachements(); track r.lien.idPrmpEntite) {
                <tr>
                  <td>{{ r.lien.idPrmp }}</td>
                  <td>{{ r.libelle }}</td>
                  <td>{{ r.lien.dateAffectation || '—' }}</td>
                  <td>
                    <div class="ra__actions">
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="busy() === r.lien.idPrmpEntite" (click)="approuver(r)">Approuver</button>
                      <button type="button" class="btn btn-danger btn-sm" [disabled]="busy() === r.lien.idPrmpEntite" (click)="rejeter(r)">Rejeter</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="cnm-muted">Aucun rattachement en attente.</p>
      }
    </section>
  `,
  styles: `
    .ra { display: flex; flex-direction: column; gap: 1rem; }
    .ra__hint { max-width: 60rem; }
    .ra__actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  `,
})
export class RattachementsAdmin implements OnInit {
  private readonly prmpEntiteService = inject(PrmpEntiteService);
  private readonly entiteContractService = inject(EntiteContractService);
  private readonly toast = inject(ToastService);

  readonly rattachements = signal<RattachementEnAttente[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement de la liste (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  /** idPrmpEntite en cours de traitement (désactive ses boutons). */
  readonly busy = signal<number | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({ liens: this.prmpEntiteService.list(), entites: this.entiteContractService.list() }).subscribe({
      next: ({ liens, entites }) => {
        const parId = new Map(entites.map((e) => [e.idEntiteContract, e]));
        this.rattachements.set(
          liens
            .filter((l) => !l.actif)
            .map((lien) => ({ lien, libelle: parId.get(lien.idEntiteContract)?.libelleEntite ?? `#${lien.idEntiteContract}` })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  approuver(r: RattachementEnAttente): void {
    if (!confirm(`Approuver le rattachement de « ${r.libelle} » à ${r.lien.idPrmp} ?`)) {
      return;
    }
    this.busy.set(r.lien.idPrmpEntite);
    this.prmpEntiteService.update(r.lien.idPrmpEntite, { ...r.lien, actif: true }).subscribe({
      next: () => {
        this.toast.success(`Rattachement de « ${r.libelle} » approuvé.`);
        this.busy.set(null);
        this.charger();
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }

  rejeter(r: RattachementEnAttente): void {
    if (!confirm(`Rejeter (supprimer) le rattachement de « ${r.libelle} » à ${r.lien.idPrmp} ?`)) {
      return;
    }
    this.busy.set(r.lien.idPrmpEntite);
    this.prmpEntiteService.delete(r.lien.idPrmpEntite).subscribe({
      next: () => {
        this.toast.success(`Rattachement de « ${r.libelle} » rejeté.`);
        this.busy.set(null);
        this.charger();
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }
}
