import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * ⚠️ R6b (V107, 13/10 ; art. 26-IV, délai légal n° 5) — le **plan réputé approuvé** : soumis, sans PV signé à l'expiration de dix jours
 * ouvrables, le serveur pose `reputeApprouveLe`. C'est un **marqueur daté**, pas un statut : le circuit continue, et un PV signé ensuite
 * vaut **observation** (QB4). Le badge se pose à côté du badge de statut ; rien sans marqueur.
 */
@Component({
  selector: 'app-repute-approuve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (le(); as l) {
      <span class="badge badge-success ra" [title]="aide()">Réputé approuvé{{ court() ? '' : ' le ' + date() }}</span>
    }
  `,
  styles: [`.ra { margin-left: 0.3rem; white-space: nowrap; }`],
})
export class ReputeApprouve {
  /** `DossierDto.reputeApprouveLe` (date-heure) ; nul tant que le plan n'est pas réputé approuvé. */
  readonly le = input<string | null | undefined>(null);
  /** Dans une liste serrée : sans la date (elle reste dans l'infobulle). */
  readonly court = input(false);

  readonly date = computed(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(this.le() ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  });
  readonly aide = computed(
    () => `Plan réputé approuvé le ${this.date()} (art. 26-IV) : aucun PV signé dans les dix jours ouvrables de la soumission. L’examen continue ; un avis rendu après coup vaut observation.`,
  );
}
