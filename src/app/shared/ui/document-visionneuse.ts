import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Visionneuse d'un document officiel : la FEUILLE (page blanche, texte noir, Arial) posée sur un
 * fond gris, avec l'interrupteur « Annotations » quand le document en porte.
 *
 * ⚠️ Décision des chefs (2026-09-14, refonte ergonomique, lot 1) — le plan de passation, la fiche
 * de présentation et le projet d'AGPM s'affichent comme le PDF officiel ; ce que l'application y
 * ajoute (état d'examen, versionnement, statut, observations) est une annotation masquable.
 *
 * Le document projeté (`PpmMarchesTable`, `FichePresentationDoc`, `AgpmDoc`) lit l'état de
 * l'interrupteur en injectant cette visionneuse : l'appelant n'a qu'à envelopper. Pour garder
 * l'état d'un onglet à l'autre, lier `[(annotations)]` à un signal de l'écran.
 * Styles : `styles/_document-officiel.scss` (globaux, communs aux trois documents).
 */
@Component({
  selector: 'app-document-visionneuse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupteur()) {
      <div class="doc-barre">
        <button
          type="button"
          class="doc-interrupteur"
          [attr.aria-pressed]="annotations()"
          title="Afficher ou masquer ce que l'application ajoute au document : état d'examen, versionnement, statut du marché, observations"
          (click)="annotations.set(!annotations())"
        >
          <span class="doc-interrupteur__piste" aria-hidden="true"></span>
          Annotations
        </button>
      </div>
    }
    <div class="doc-visionneuse">
      <!-- lang="fr" : la feuille est un document français (césures, lecteurs d'écran), quelle que
           soit la langue de la page qui l'accueille. -->
      <div class="doc-feuille" lang="fr" [class.doc-annotations-masquees]="!annotations()">
        <ng-content />
      </div>
    </div>
  `,
})
export class DocumentVisionneuse {
  /** Affiche l'interrupteur « Annotations » (seulement là où le document en porte). */
  readonly interrupteur = input(false);
  /** Annotations visibles (défaut) ; `false` = le document seul, tel que le PDF. */
  readonly annotations = model(true);
}
