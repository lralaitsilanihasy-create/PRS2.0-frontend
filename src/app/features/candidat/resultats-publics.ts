import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';

import { dateFr } from '../../core/interim/interim-libelles';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { ResultatPublic } from '../../models';
import { ResultatsPublicsService } from '../../services';

/**
 * ⚠️ Attribution, tranches 2b et 2c — sur la page publique de la procédure : le résultat de chaque lot (attributaire, montant, dates de
 * l'information et de l'affichage), puis l'avis d'attribution une fois publié (art. 53). Public, sans session ; rien avant
 * l'information des candidats.
 */
@Component({
  selector: 'app-resultats-publics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resultats().length) {
      <section class="card rp" aria-labelledby="rp-titre">
        <h2 id="rp-titre" class="rp__h2">Résultat de l'appel d'offres</h2>
        @for (r of resultats(); track r.lot) {
          <div class="rp__lot">
            <p class="text-sm"><strong>{{ r.lot ? 'Lot ' + r.lot + ' — ' : '' }}{{ r.attributaire }}</strong>{{ r.montant != null ? ' · ' + montant(r.montant) + ' hors taxes' : '' }}</p>
            <p class="text-sm text-muted">Résultat communiqué le {{ date(r.dateInformation) }} · affiché le {{ date(r.dateAffichage) }}{{ r.datePublicationAvis ? ' · avis d’attribution publié le ' + date(r.datePublicationAvis) : '' }}</p>
            @if (r.avisDisponible) { <button type="button" class="btn btn-secondary btn-sm rp__btn" (click)="avis(r.lot)">Lire l’avis d’attribution (PDF)</button> }
          </div>
        }
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
      </section>
    }
  `,
  styles: `
    .rp { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .rp__h2 { margin: 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .rp__lot { display: flex; flex-direction: column; gap: 0.2rem; }
    .rp__lot p { margin: 0; }
    .rp__btn { align-self: flex-start; }
  `,
})
export class ResultatsPublics implements OnInit {
  readonly idDmc = input.required<number>();
  private readonly service = inject(ResultatsPublicsService);
  readonly date = dateFr;
  readonly resultats = signal<ResultatPublic[]>([]);
  readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.service.resultats(this.idDmc()).subscribe({ next: (l) => this.resultats.set(l), error: () => this.resultats.set([]) });
  }

  montant(v: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
  }

  avis(lot: number | null): void {
    this.service.avis(this.idDmc(), lot).subscribe({ next: (b) => ouvrirBlobSur(b), error: () => this.erreur.set('L’avis d’attribution n’est pas disponible.') });
  }
}
