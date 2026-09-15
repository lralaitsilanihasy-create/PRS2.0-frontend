import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

import { Icone } from '../../../shared/ui/icone';
import { GesteBouton, VueEtape } from './etape-courante-modele';

/**
 * Barre collante de la page dossier (lot L4-F3, décision 3 du 15/09) : quand le panneau de l'étape sort
 * de l'écran, un rappel compact reste sous la barre du haut — référence, étape, délai et bouton du geste
 * principal. On garde ainsi le geste à portée sans retirer de largeur au plan.
 *
 * Accessibilité : repliée, elle est `visibility: hidden` — ni lue ni atteignable, aucune tabulation
 * fantôme ; dépliée, ses éléments suivent l'ordre du document, sans piège de focus. La page rend le
 * focus au panneau si la barre se replie pendant qu'il y est.
 */
@Component({
  selector: 'app-barre-collante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  host: { '[class.bc--visible]': 'visible()' },
  template: `
    <div class="bc">
      <span class="bc__ref">{{ reference() }}</span>
      <span class="bc__etape">
        {{ vue().etape }}@if (vue().etape && vue().porteur) { · }{{ vue().porteur }}
        <span class="bc__titre">{{ vue().titre }}</span>
      </span>
      @if (vue().delai; as d) {
        <span class="bc__delai bc__delai--{{ d.genre }}"><app-icone nom="clock" [taille]="14" />{{ d.texte }}</span>
      }
      @if (vue().principal; as p) {
        <button type="button" class="btn btn-primary btn-sm bc__geste" [attr.data-geste]="p.geste" [disabled]="occupe()" (click)="agir.emit(p)">
          <app-icone [nom]="p.icone" [taille]="15" />{{ p.libelle }}
        </button>
      }
    </div>
  `,
  styleUrl: './barre-collante.scss',
})
export class BarreCollante {
  readonly reference = input.required<string>();
  readonly vue = input.required<VueEtape>();
  /** Le panneau de l'étape est sorti de l'écran (par le haut). */
  readonly visible = input(false);
  readonly occupe = input(false);
  readonly agir = output<GesteBouton>();

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Le focus est-il dans la barre ? (la page le rend au panneau quand elle se replie) */
  contientFocus(): boolean {
    return this.hote.nativeElement.contains(document.activeElement);
  }
}
