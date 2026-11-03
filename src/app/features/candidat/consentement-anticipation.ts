import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { OuvertureAnticipee } from '../../models';
import { InvitationsCandidatService } from '../../services/candidat.services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { dateHeureFr } from './libelles-candidat';

/**
 * ⚠️ 03/11 (V160, « appel-offres-restreint », §B7 ; loi n° 2016-055, art. 38-VI) — l'invité d'un appel d'offres restreint donne, ou
 * refuse, son **consentement écrit** à l'ouverture anticipée des plis demandée par la PRMP. Sa réponse est horodatée, nominative, et
 * portée au PV d'ouverture ; elle ne se reprend pas. Muet sans demande et hors invités.
 */
@Component({
  selector: 'app-consentement-anticipation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    @if (demande(); as d) {
      <section class="card ca" aria-labelledby="ca-titre">
        <h2 id="ca-titre" class="ca__h2">Ouverture anticipée des plis</h2>
        @switch (d.etat) {
          @case ('DEMANDEE') {
            @if (moi()?.accord === null) {
              <p class="ca__txt">
                Tous les invités ont remis leur offre. La PRMP propose d’ouvrir les plis <strong>avant la date limite</strong>, prévue le
                {{ dh(d.ouvertureInitiale) }}. Elle ne le peut qu’avec le consentement écrit de chaque invité. Jusqu’à la réponse de
                tous, les offres sont figées : ni remplacement ni retrait.
              </p>
              <div class="ca__gestes">
                <button type="button" class="btn btn-primary btn-sm" (click)="choix.set(true)">Je consens</button>
                <button type="button" class="btn btn-outline btn-sm" (click)="choix.set(false)">Je refuse</button>
              </div>
            } @else {
              <p class="ca__txt">Vous avez {{ moi()?.accord ? 'consenti' : 'refusé' }} le {{ dh(moi()?.reponduLe) }}. Les autres invités n’ont pas tous répondu ; les offres restent figées.</p>
            }
          }
          @case ('ACCORDEE') { <p class="ca__txt">Tous les invités ont consenti. La PRMP va fixer la nouvelle heure d’ouverture : vous en serez prévenu.</p> }
          @case ('FIXEE') { <p class="ca__txt">Les plis s’ouvriront le <strong>{{ dh(d.nouvelleOuverture) }}</strong>, au lieu du {{ dh(d.ouvertureInitiale) }}.</p> }
          @case ('REFUSEE') { <p class="ca__txt">L’ouverture anticipée n’aura pas lieu : un invité l’a refusée. Les plis s’ouvrent le {{ dh(d.ouvertureInitiale) }}, et votre offre redevient modifiable jusqu’à la date limite.</p> }
        }
        @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
      </section>
    }

    <!-- Fermeture par le bouton ou Échap seulement (règle du 13/09). -->
    @if (choix() !== null) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="choix() ? 'Consentir à l’ouverture anticipée' : 'Refuser l’ouverture anticipée'" appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <span class="modal-title">{{ choix() ? 'Consentir à l’ouverture anticipée' : 'Refuser l’ouverture anticipée' }}</span>
            <button type="button" class="btn-close" aria-label="Fermer sans répondre" [disabled]="envoi()" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body">
            @if (choix()) {
              <p>Vous acceptez par écrit que les plis soient ouverts avant la date limite, à une heure que la PRMP fixera si tous les invités consentent. Votre réponse est portée au procès-verbal d’ouverture et ne se reprend pas.</p>
            } @else {
              <p>Votre refus clôt la demande pour tous les invités : les plis s’ouvriront à l’heure prévue. Il est porté au procès-verbal d’ouverture et ne se reprend pas.</p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="envoi()" (click)="repondre()">{{ envoi() ? 'Envoi…' : (choix() ? 'Je consens' : 'Je refuse') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ca { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; }
    .ca__h2 { margin: 0; font-size: 1rem; }
    .ca__txt { margin: 0; font-size: var(--text-sm); }
    .ca__gestes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  `,
})
export class ConsentementAnticipation implements OnInit {
  private readonly service = inject(InvitationsCandidatService);

  readonly idDmc = input.required<number>();

  readonly demande = signal<OuvertureAnticipee | null>(null);
  /** Le serveur ne sert à l'invité que son propre consentement. */
  readonly moi = computed(() => this.demande()?.consentements[0] ?? null);
  readonly choix = signal<boolean | null>(null);
  readonly envoi = signal(false);
  readonly refus = signal<string | null>(null);
  readonly dh = dateHeureFr;

  ngOnInit(): void {
    this.service.ouvertureAnticipee(this.idDmc()).subscribe({ next: (d) => this.demande.set(d ?? null), error: () => {} });
  }

  fermer(): void {
    if (!this.envoi()) this.choix.set(null);
  }

  repondre(): void {
    const accord = this.choix();
    if (accord === null || this.envoi()) return;
    this.envoi.set(true);
    this.refus.set(null);
    this.service.consentirAnticipation(this.idDmc(), accord).subscribe({
      next: (d) => {
        this.envoi.set(false);
        this.choix.set(null);
        this.demande.set(d);
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        this.choix.set(null);
        this.refus.set(codeErreur(e) === 'ANTICIPATION_CLOSE'
          ? 'La demande est déjà close : rechargez la page pour voir son issue.'
          : 'Votre réponse n’a pas été enregistrée. Réessayez.');
      },
    });
  }
}
