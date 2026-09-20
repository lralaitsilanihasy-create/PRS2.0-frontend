import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PreControlePanneau } from '../../shared/pre-controle';

/**
 * « Vérifier mon PPM » (PRMP / UGPM) — écran du **pré-contrôle** d'un plan avant sa soumission
 * (assistant IA, lot 3 ; `backend/docs/plan-assistant-ia.md` §4, lot 3).
 *
 * <p>Atteint depuis « Mes brouillons », dossier par dossier : c'est là que la PRMP travaille son plan,
 * et le pré-contrôle n'a de sens qu'avant le dépôt — il lui dit ce que le contrôleur regardera. L'écran
 * n'est <strong>pas</strong> une entrée de menu : ce n'est pas une page où l'on va, c'est un geste sur un
 * plan.</p>
 *
 * <p>Tout le contenu vient du panneau partagé, le même que celui du contrôleur : une seule
 * présentation des signalements, pour que les deux côtés du circuit lisent la même chose.</p>
 */
@Component({
  selector: 'app-verifier-ppm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PreControlePanneau],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Vérifier mon plan avant de le soumettre</h1>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" (click)="retour()">← Mes brouillons</button>
      </header>

      <p class="text-muted">
        Les points ci-dessous sont ceux que le contrôleur de la CNM regardera. Corrigez-les, ou écartez
        ceux qui ne s'appliquent pas à votre plan en expliquant pourquoi — votre motif lui sera visible.
        Rien ici n'empêche de soumettre.
      </p>

      @if (idPpm() !== null) {
        <div class="card">
          <div class="card-body">
            <app-pre-controle-panneau [idPpm]="idPpm()!" titre="Points signalés sur ce plan" />
          </div>
        </div>
      } @else {
        <p class="text-muted" role="alert">Plan introuvable : l'adresse ne porte pas de numéro de plan.</p>
      }
    </section>
  `,
})
export class VerifierPpm {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.paramMap);

  /** Le plan à vérifier, lu dans l'URL (`/prmp/verifier-ppm/:idPpm`). */
  readonly idPpm = computed(() => {
    const brut = this.params()?.get('idPpm');
    const valeur = brut == null ? Number.NaN : Number(brut);
    return Number.isFinite(valeur) ? valeur : null;
  });

  retour(): void {
    void this.router.navigateByUrl('/prmp/mes-brouillons');
  }
}
