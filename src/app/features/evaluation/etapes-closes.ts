import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DossierSoumis } from '../../models';

/**
 * Le bandeau des étapes closes, en tête de la séance, de l'évaluation, de la présélection de l'AMI et de la page procédure de la
 * CAO : les lectures restent ouvertes, les gestes d'écriture sont retirés par l'écran hôte.
 */
@Component({
  selector: 'app-etape-close',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (dossier(); as d) {
      <div class="alert alert-info ec" role="status">
        <span>
          <strong>Étape close.</strong> Le dossier de marché n° {{ d.idDossier }} (lot {{ d.lot }}) est soumis à la Commission : la séance,
          l’évaluation et l’AMI de la procédure ne se modifient plus. Seule une reprise de l’évaluation après avis défavorable, ou une
          réattribution, les rouvre.
          @if (lienDossier()) { <a class="ec__lien" [routerLink]="['/prmp/dossier', d.idDossier]">Ouvrir le dossier de marché</a> }
        </span>
      </div>
    }
  `,
  styles: [`.ec { margin-bottom: 1rem; } .ec__lien { margin-left: 0.35rem; font-weight: 500; }`],
})
export class EtapeClose {
  readonly dossier = input<DossierSoumis | null>(null);
  /** PRMP ou UGPM : le dossier de marché s'ouvre depuis leur espace. */
  readonly lienDossier = input(false);
}
