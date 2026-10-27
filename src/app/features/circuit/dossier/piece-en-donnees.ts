import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Dossier } from '../../../models';
import { FicheDaoDoc } from '../../../shared/prmp/fiche-dao-doc';
import { DocumentVisionneuse } from '../../../shared/ui/document-visionneuse';
import { AvisSpecifiqueDoc } from './avis-specifique-doc';
import { BordereauEstimatifDoc } from './bordereau-estimatif-doc';
import { CanevasRapportDoc } from './canevas-rapport-doc';
import { OngletPieceFournie, ficheDuDossier } from './dossier-pieces';
import { FichePresentationDaoDoc } from './fiche-presentation-dao';
import { EvaluationMarcheDoc, PvCnmDoc, SeanceMarcheDoc } from './procedure-marche-docs';

/**
 * ⚠️ 27/10 (pilote, « les éléments du dossier en données, pas en PDF, sauf les pièces sans données dans l'application ») — une
 * pièce produite par l'application, lue par la vue en données de la page du dossier, sans magasin : l'écran d'examen la montre à la
 * place du PDF. Mêmes composants que `DossierDocuments` ; la vue d'une pièce se trouve par `elementDeLaPiece` / `ongletDuFichier`.
 */
@Component({
  selector: 'app-piece-en-donnees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentVisionneuse, FichePresentationDaoDoc, FicheDaoDoc, AvisSpecifiqueDoc, BordereauEstimatifDoc, CanevasRapportDoc, SeanceMarcheDoc, EvaluationMarcheDoc, PvCnmDoc],
  template: `
    @let d = dossier();
    @let pr = d.procedure;
    @switch (element()) {
      @case ('presentation') { <app-document-visionneuse><app-fiche-presentation-dao [idDossier]="d.idDossier" /></app-document-visionneuse> }
      @case ('fiche-dao') { @if (idFiche(); as f) { <app-document-visionneuse><app-fiche-dao-doc [idDmc]="f" /></app-document-visionneuse> } }
      @case ('avis') { <app-document-visionneuse><app-avis-specifique-doc [idDossier]="d.idDossier" /></app-document-visionneuse> }
      @case ('bordereau') {
        @if (idFiche(); as f) { <app-document-visionneuse><app-bordereau-estimatif-doc [idDmc]="f" [versionSoumise]="d.ficheMarche?.versionSoumise" /></app-document-visionneuse> }
      }
      @case ('canevas') { <app-document-visionneuse><app-canevas-rapport-doc [idDossier]="d.idDossier" /></app-document-visionneuse> }
      @case ('pv-cnm') { @if (pr) { <app-pv-cnm-doc [idDossier]="d.idDossier" [idDossierMec]="pr.idDossierMiseEnConcurrence" [refeMec]="pr.refeDossierMiseEnConcurrence" /> } }
      @case ('seance') { @if (pr) { <app-seance-marche-doc [idDmc]="pr.idDmc" /> } }
      @case ('evaluation') { @if (pr) { <app-evaluation-marche-doc [idDmc]="pr.idDmc" [lot]="pr.lot" /> } }
      @case ('attribution') { @if (pr) { <app-evaluation-marche-doc [idDmc]="pr.idDmc" [lot]="pr.lot" [vue]="'attribution'" /> } }
    }
  `,
  styles: `
    :host { display: block; }
  `,
})
export class PieceEnDonnees {
  readonly dossier = input.required<Dossier>();
  readonly element = input.required<OngletPieceFournie>();
  readonly idFiche = computed(() => ficheDuDossier(this.dossier()));
}
