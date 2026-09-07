import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ToastService } from '../../core/notifications/toast.service';
import { ParametreAgpmSeuilService } from '../../services';
import { MontantFrDirective } from '../../shared/montant-fr.directive';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * Écran Administrateur — « Seuil AGPM (AMI) ». Fixe le montant au-delà duquel un marché en appel à
 * manifestation d'intérêt déclenche l'AGPM (et fait basculer le dossier en sous-type PPM-AGPM). Les
 * autres appels d'offres (ouvert, restreint…) déclenchent sans condition ; gré à gré / consultation
 * ne déclenchent pas. Contrat backend `GET`/`PUT /api/parametres/agpm-seuil-montant` (PUT réservé
 * Administrateur) — défaut 0 (tout marché AMI déclenche tant que le seuil n'est pas relevé).
 */
@Component({
  selector: 'app-agpm-seuil-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MontantFrDirective, EtatErreur],
  template: `
    <section class="asa">
      <header class="page-header">
        <h1 class="page-title">Seuil AGPM — appel à manifestation d'intérêt</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      <p class="alert alert-info">
        <span>
          Un marché en <strong>appel à manifestation d'intérêt (AMI)</strong> déclenche l'AGPM — et
          fait passer le dossier en sous-type <strong>PPM-AGPM</strong> — dès que son
          <strong>montant estimé atteint ce seuil</strong> (borne incluse, comparaison
          <strong>par marché</strong> ; le montant retenu est le nouveau montant estimatif s'il est
          posé, sinon l'initial). Les autres appels d'offres (ouvert, restreint…) déclenchent sans
          condition ; le gré à gré et la consultation ne déclenchent jamais. Un seuil à
          <strong>0</strong> signifie que tout marché AMI déclenche l'AGPM.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le seuil AGPM." (reessayer)="charger()" />
      } @else {
        <div class="card asa__card">
          <label class="form-group asa__champ">
            <span class="form-label">Seuil de montant (Ariary)</span>
            <input type="text" class="form-control asa__input" appMontantFr [formControl]="seuilCtrl" aria-label="Seuil AGPM (montant en Ariary)" />
            <span class="form-hint">Montant à partir duquel un marché AMI déclenche l'AGPM. Laisser à 0 pour que tout marché AMI déclenche.</span>
          </label>
          <div class="asa__actions">
            <span class="asa__actuel">
              En vigueur : <strong>{{ format(seuilActuel()) }}</strong> Ar
              @if (seuilActuel() === 0) { <span class="asa__zero">— tout marché AMI déclenche</span> }
            </span>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="enregistrer()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer le seuil' }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .asa { display: flex; flex-direction: column; gap: 1rem; }
    .asa__card { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; }
    .asa__champ { max-width: 22rem; }
    .asa__input { text-align: right; font-variant-numeric: tabular-nums; }
    .asa__actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .asa__actuel { color: var(--n-600); font-size: var(--text-sm); }
    .asa__zero { color: var(--warning-text); font-weight: 600; }
  `,
})
export class AgpmSeuilAdmin implements OnInit {
  private readonly service = inject(ParametreAgpmSeuilService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  /** Dernier seuil lu du serveur (affiché comme « en vigueur »). */
  readonly seuilActuel = signal<number>(0);
  readonly seuilCtrl = new FormControl<number | null>(0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.lire().subscribe({
      next: (p) => {
        const v = p.seuil ?? 0;
        this.seuilActuel.set(v);
        this.seuilCtrl.setValue(v);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Format FR indépendant de la locale Angular. On normalise les espaces fines/insécables
   * (U+202F / U+00A0 posées par Intl) en espaces ordinaires, pour un séparateur de milliers VISIBLE
   * et cohérent avec l'input `appMontantFr`.
   */
  format(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, ' ');
  }

  enregistrer(): void {
    const v = this.seuilCtrl.value;
    if (v == null || !Number.isFinite(v) || v < 0) {
      this.toast.error("Le seuil est un montant positif ou nul (0 = tout marché AMI déclenche l'AGPM).");
      return;
    }
    this.saving.set(true);
    this.service.definir(v).subscribe({
      next: (p) => {
        const maj = p.seuil ?? v;
        this.saving.set(false);
        this.seuilActuel.set(maj);
        this.seuilCtrl.setValue(maj);
        this.toast.success('Seuil AGPM enregistré : ' + this.format(maj) + ' Ar.');
      },
      error: () => this.saving.set(false), // 400/403 → dialogue centralisé (message backend)
    });
  }
}
