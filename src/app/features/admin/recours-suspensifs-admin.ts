import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { TypeRecours } from '../../models';
import { ParametreRecoursSuspensifsService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_RECOURS } from '../evaluation/libelles-evaluation';

/**
 * Écran Administrateur — « Recours suspensifs » (manuel révisé lot 2, R9a, V111, 14/10 ; titre VIII, bloquant de la loi n° 13) :
 * les recours qui **suspendent la signature** du marché. Le serveur lit le réglage à chaque question — un recours déjà déclaré suit le
 * réglage du moment. Aucun coché : aucun recours ne suspend. Contrat `GET`/`PUT /api/parametres/recours-suspensifs`.
 */
@Component({
  selector: 'app-recours-suspensifs-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="rsa">
      <header class="page-header">
        <h1 class="page-title">Recours suspensifs</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="alert alert-info">
        <span>
          Un recours <strong>suspensif</strong> arrête la signature du marché jusqu’à sa décision, vingt jours au plus. Le réglage vaut
          <strong>immédiatement</strong>, y compris pour les recours déjà déclarés ; la déclaration d’un recours cite la suspension
          selon le réglage du jour.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les recours suspensifs." (reessayer)="charger()" />
      } @else {
        <div class="card rsa__card">
          <fieldset class="rsa__types">
            <legend class="form-label">Recours qui suspendent la signature</legend>
            @for (t of connus(); track t) {
              <label class="rsa__type">
                <input type="checkbox" [checked]="saisie().includes(t)" (change)="basculer(t, $any($event.target).checked)" />
                <span>{{ libelles[t] ?? t }}</span>
              </label>
            }
          </fieldset>
          @if (!saisie().length) { <p class="text-sm" role="status">Aucun recours coché : <strong>aucun</strong> ne suspendra la signature.</p> }
          @if (message(); as m) { <p class="form-error" role="alert">{{ m }}</p> }
          <div class="rsa__actions">
            <button type="button" class="btn btn-primary" [disabled]="saving() || !modifie()" (click)="enregistrer()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .rsa { display: flex; flex-direction: column; gap: 1rem; }
    .rsa__card { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.25rem; max-width: 44rem; }
    .rsa__types { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .rsa__type { display: flex; gap: 0.5rem; align-items: flex-start; color: var(--n-700); }
    .rsa__type input { margin-top: 0.2rem; }
    .rsa__actions { display: flex; justify-content: flex-end; }
  `,
})
export class RecoursSuspensifsAdmin implements OnInit {
  private readonly service = inject(ParametreRecoursSuspensifsService);
  private readonly toast = inject(ToastService);

  readonly libelles: Readonly<Record<string, string>> = LIBELLES_RECOURS;
  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly connus = signal<TypeRecours[]>([]);
  readonly actuels = signal<TypeRecours[]>([]);
  readonly saisie = signal<TypeRecours[]>([]);

  readonly modifie = computed(() => {
    const a = [...this.actuels()].sort().join();
    return a !== [...this.saisie()].sort().join();
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        this.connus.set(p.connus);
        this.actuels.set(p.types);
        this.saisie.set(p.types);
        this.message.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  basculer(t: TypeRecours, coche: boolean): void {
    this.saisie.update((s) => (coche ? [...new Set([...s, t])] : s.filter((x) => x !== t)));
    this.message.set(null);
  }

  enregistrer(): void {
    if (this.saving() || !this.modifie()) return;
    this.saving.set(true);
    this.service.definir(this.saisie()).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.actuels.set(p.types);
        this.saisie.set(p.types);
        this.toast.success(p.types.length ? 'Recours suspensifs enregistrés.' : 'Enregistré : aucun recours ne suspend plus la signature.');
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.message.set(
          codeErreur(e) === 'RECOURS_INVALIDE' ? 'Un des recours n’est pas reconnu par le serveur.'
          : e.status === 403 ? 'Seul l’Administrateur règle les recours suspensifs.'
          : e.message || 'Le réglage n’a pas été enregistré. Réessayez.',
        );
      },
    });
  }
}
