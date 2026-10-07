import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DemandeEvaluation } from '../../models';
import { EvaluationService } from '../../services';
import { dateHeureFr, tailleLisible } from '../candidat/libelles-candidat';
import { LIBELLES_ETAT_DEMANDE, refusEvaluation } from './libelles-evaluation';

/**
 * Une demande faite au candidat — précision (art. 35-VI) ou justification d'un prix (art. 48) — et sa réponse. Le fichier joint
 * s'ouvre par `ouvrirBlobSur` (jamais `URL.createObjectURL` brut). Rappel du guide (§2.4) : une précision ne change ni le prix
 * ni une pièce essentielle manquante ; la demande et la réponse vont au rapport.
 */
@Component({
  selector: 'app-demande-vue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dv" [class.dv--attente]="demande().etat === 'EN_ATTENTE'">
      <p class="dv__tete">
        <span class="badge" [class.badge-warning]="demande().etat === 'EN_ATTENTE'" [class.badge-success]="demande().etat === 'REPONDUE'" [class.badge-neutral]="demande().etat === 'EXPIREE'">{{ etats[demande().etat] }}</span>
        <span class="text-sm text-muted">Demandée le {{ dateHeure(demande().demandeeLe) }}@if (demande().echeance) { · réponse attendue avant le {{ dateHeure(demande().echeance) }} }</span>
      </p>
      <p class="dv__q"><strong>{{ demande().type === 'JUSTIFICATION' ? 'Justification demandée' : 'Question' }} :</strong> {{ demande().question }}</p>
      @if (demande().reponse) {
        <p class="dv__r"><strong>Réponse du candidat</strong>@if (demande().reponduLe) { <span class="text-muted"> ({{ dateHeure(demande().reponduLe) }})</span> } : {{ demande().reponse }}</p>
      }
      @if (demande().fichier) {
        <button type="button" class="btn btn-outline btn-sm" [disabled]="travail()" (click)="ouvrir()">Ouvrir la pièce jointe — {{ demande().fichier }}{{ demande().tailleFichier ? ' (' + taille(demande().tailleFichier) + ')' : '' }}</button>
      }
      @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
    </div>
  `,
  styles: `
    .dv { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.5rem 0.7rem; border-left: 3px solid var(--n-300); background: var(--n-100); }
    .dv--attente { border-left-color: var(--warning-text); }
    .dv p { margin: 0; font-size: var(--text-sm); }
    .dv__tete { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .dv .btn { align-self: flex-start; }
  `,
})
export class DemandeVue {
  readonly idDmc = input.required<number>();
  readonly demande = input.required<DemandeEvaluation>();

  private readonly service = inject(EvaluationService);
  readonly etats = LIBELLES_ETAT_DEMANDE;
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly travail = signal(false);
  readonly erreur = signal<string | null>(null);

  ouvrir(): void {
    this.travail.set(true);
    this.erreur.set(null);
    this.service.fichierDemande(this.idDmc(), this.demande().idDemande).subscribe({
      next: (b) => {
        this.travail.set(false);
        ouvrirBlobSur(b);
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreur.set(refusEvaluation(e));
      },
    });
  }
}
