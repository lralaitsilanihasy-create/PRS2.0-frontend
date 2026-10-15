import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PropositionAttribution } from '../../models';
import { ariary } from './libelles-evaluation';

/**
 * ⚠️ MT-a (15/10, décret n° 2019-1064 art. 13 et 17) — les titulaires que la CAO propose pour un contrat-cadre
 * multi-attributaire, dans l'ordre du classement, et le constat « un seul titulaire qualifié » (la PRMP peut alors déclarer
 * le lot infructueux). Rien n'est affiché hors multi-attributaire (`titulaires` vide).
 */
@Component({
  selector: 'app-titulaires-proposes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = proposition();
    @if (p.titulaires?.length) {
      <p class="text-sm tp__intro">
        <strong>Contrat-cadre : {{ p.titulaires!.length }} titulaire{{ p.titulaires!.length > 1 ? 's' : '' }} proposé{{ p.titulaires!.length > 1 ? 's' : '' }}</strong>
        par la CAO, dans l’ordre du classement — la PRMP les sélectionne parmi les candidats qualifiés (décret n° 2019-1064, art. 13).
      </p>
      <div class="cnm-table-wrap">
        <table class="cnm-table tp__table" [attr.aria-label]="'Titulaires proposés' + (lot() ? ' — lot ' + lot() : '')">
          <thead><tr><th scope="col" class="tp__rang">Rang</th><th scope="col">Offre</th><th scope="col">Candidat</th><th scope="col" class="tp__num">Montant HT</th><th scope="col" class="tp__num">Montant TTC lu</th><th scope="col">Délai</th></tr></thead>
          <tbody>
            @for (t of p.titulaires!; track t.idOffre) {
              <tr><td class="tp__rang">{{ t.rang ?? '—' }}</td><td>n° {{ t.numero ?? '—' }}</td><td>{{ t.candidat || '—' }}</td><td class="tp__num">{{ ariary(t.montant) }}</td><td class="tp__num">{{ ariary(t.montantTtc) }}</td><td>{{ t.delai ?? '—' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
    @if (p.seulTitulaireQualifie) {
      <div class="alert alert-warning" role="note">
        <span>Un seul titulaire est qualifié : la PRMP peut déclarer la procédure <strong>infructueuse</strong> (décret n° 2019-1064, art. 17 ; loi n° 2016-055, art. 56).</span>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.4rem; }
    .tp__intro { margin: 0; }
    .tp__table { font-size: 0.84rem; }
    .tp__table thead th { background: var(--p-100); color: var(--p-800); }
    .tp__rang { width: 4rem; text-align: center; }
    .tp__num { text-align: right; white-space: nowrap; }
  `,
})
export class TitulairesProposes {
  readonly proposition = input.required<PropositionAttribution>();
  readonly lot = input<number | null>(null);
  readonly ariary = ariary;
}
