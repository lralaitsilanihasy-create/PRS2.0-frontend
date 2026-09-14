import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Icone } from '../../../shared/ui/icone';
import { CleEtapeParcours, EtapeParcours } from './examen-modele';

const ETATS_LUS: Readonly<Record<EtapeParcours['etat'], string>> = {
  'a-faire': 'à faire',
  'en-cours': 'en cours',
  terminee: 'terminée',
  'sans-objet': 'sans objet',
};

/**
 * Parcours de l'examen en six étapes cochées (maquette `ExamenLigne`, 2026-09-14) : Fiche de
 * présentation · Lignes du plan · Projet d'AGPM · Pièces jointes · Contrôles du dossier · Synthèse
 * et avis. Chaque étape dit son état, sa progression et ses observations ; un clic y conduit (l'écran
 * applique la règle séquentielle et explique un refus). Une étape « sans objet » n'est pas un bouton.
 */
@Component({
  selector: 'app-examen-parcours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, NgTemplateOutlet],
  template: `
    <nav class="parcours" aria-label="Parcours de l'examen">
      <ol class="parcours__liste" [style.--nb-etapes]="etapes().length">
        @for (e of etapes(); track e.cle) {
          <li class="parcours__item">
            @if (e.etat === 'sans-objet') {
              <div class="pc pc--sans-objet">
                <ng-container [ngTemplateOutlet]="contenu" [ngTemplateOutletContext]="{ $implicit: e }" />
              </div>
            } @else {
              <button
                type="button"
                class="pc"
                [class.pc--terminee]="e.etat === 'terminee'"
                [class.pc--courante]="e.courante"
                [attr.aria-current]="e.courante ? 'step' : null"
                [attr.aria-disabled]="e.accessible ? null : 'true'"
                (click)="choisir.emit(e.cle)"
              >
                <ng-container [ngTemplateOutlet]="contenu" [ngTemplateOutletContext]="{ $implicit: e }" />
              </button>
            }
          </li>
        }
      </ol>
    </nav>

    <ng-template #contenu let-e>
      <span class="pc__t">
        <span class="pc__n" aria-hidden="true">
          @if (e.etat === 'terminee' && !e.courante) { <app-icone nom="check" [taille]="12" /> } @else { {{ e.numero }} }
        </span>
        <span class="pc__l">{{ e.libelle }}</span>
      </span>
      <span class="pc__s"><span class="cnm-sr-only">Étape {{ e.numero }}, {{ etatLu(e) }} : </span>{{ e.resume }}</span>
      <span class="pc__b" aria-hidden="true">
        @if (e.etat !== 'sans-objet') { <i [style.width.%]="e.progression"></i> }
      </span>
    </ng-template>
  `,
  styleUrl: './examen-parcours.scss',
})
export class ExamenParcours {
  readonly etapes = input.required<EtapeParcours[]>();
  readonly choisir = output<CleEtapeParcours>();

  etatLu(e: EtapeParcours): string {
    return ETATS_LUS[e.etat] + (e.courante ? ', étape courante' : '');
  }
}
