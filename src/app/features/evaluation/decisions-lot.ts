import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { Attribution, LotAttribution, RepriseEvaluation, SuiteInfructuosite } from '../../models';
import { AttributionService } from '../../services';
import { dateHeureFr } from '../candidat/libelles-candidat';

export const LIBELLES_SUITE: Readonly<Record<SuiteInfructuosite, string>> = {
  RELANCE: 'Relance de la procédure',
  RESTREINTE: 'Appel d’offres restreint',
  NEGOCIEE: 'Procédure négociée',
};

/** L'infructuosité se déclare quand le rapport la propose ou que le dossier de marché est refusé — jamais après l'attribution (art. 56-VI). */
export function infructuositeDeclarable(l: LotAttribution): boolean {
  return !l.infructuosite && !l.attributaire && (!!l.proposition?.infructueux || l.dossierMarche?.avis === 'DEF');
}

/** La reprise de l'évaluation suit un avis défavorable sur le dossier de marché (Q3). */
export function repriseOuverte(l: LotAttribution): boolean {
  return !l.infructuosite && !l.attributaire && l.dossierMarche?.avis === 'DEF';
}

/** Le refus d'un geste de la tranche 2d, dit à la PRMP. */
export function refus2d(e: ApiError): string {
  const details = corpsErreur<{ details?: Record<string, unknown> }>(e)?.details ?? {};
  const lots = Array.isArray(details['lots']) ? (details['lots'] as unknown[]).join(', ') : '';
  switch (codeErreur(e)) {
    case 'MOTIF_OBLIGATOIRE': return 'Le motif est obligatoire.';
    case 'DECISION_OBLIGATOIRE': return 'La référence et la date de votre décision sont obligatoires.';
    case 'DECISION_DATE_INVALIDE': return 'La date de la décision ne peut pas être à venir.';
    case 'SUITE_INVALIDE': return 'La suite choisie n’est pas reconnue.';
    case 'EVALUATION_NON_CLOSE': return 'Le rapport d’évaluation n’est pas encore signé de tous.';
    case 'DEJA_ATTRIBUE': return 'Le lot a été attribué : il ne peut plus être déclaré infructueux (art. 56-VI).';
    case 'DEJA_INFRUCTUEUX': return 'Le lot est déjà déclaré infructueux.';
    case 'INFRUCTUOSITE_NON_PROPOSEE': return 'L’infructuosité se déclare quand le rapport la propose, ou après l’avis défavorable de la Commission sur le dossier de marché.';
    case 'AVIS_NON_DEFAVORABLE': return 'La reprise de l’évaluation suit un avis défavorable de la Commission.';
    case 'AUTRES_LOTS_ATTRIBUES': return `Un autre lot de la procédure est déjà attribué${lots ? ' (lot(s) ' + lots + ')' : ''} : l’évaluation, commune aux lots, ne se rouvre plus.`;
    case 'NON_RETIRE': return 'Le marché n’est pas retiré : rien à réattribuer.';
    case 'AUCUN_SUIVANT_ELIGIBLE': return 'Aucun candidat suivant n’est éligible : seule une déclaration sans suite reste possible.';
    case 'OFFRE_EXPIREE': return `L’offre du candidat suivant n’est plus valide${typeof details['echeance'] === 'string' ? ' (échue le ' + dateHeureFr(details['echeance'] as string) + ')' : ''}.`;
    case 'SANS_SUITE_DECLAREE': return 'La procédure est déclarée sans suite : plus aucun geste d’attribution.';
  }
  if (e.status === 403) return 'Ce geste revient à la PRMP.';
  return e.message || 'Le geste n’a pas abouti.';
}

/**
 * ⚠️ **Les décisions de la PRMP sur un lot** (attribution, tranche 2d-1 — V91). Quand le rapport propose l'infructuosité, ou que la Commission
 * refuse le dossier de marché, la PRMP **déclare l'infructuosité** (motif, sa décision, la suite envisagée) — ou, après un avis défavorable,
 * **reprend l'évaluation** (motif) : le rapport signé est archivé, l'évaluation rouverte en entier, un nouveau dossier suivra. Les reprises (et
 * les réattributions, tranche 2d-2) restent lisibles, avec leur rapport archivé.
 */
@Component({
  selector: 'app-decisions-lot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = lot();
    @if (l.infructuosite; as i) {
      <section class="dl__bloc dl__fait" aria-label="Infructuosité déclarée">
        <h4 class="dl__h4">Lot déclaré infructueux</h4>
        <p class="text-sm">Le {{ jj(i.le) }} : {{ i.motif }}{{ i.decisionReference ? ' — décision ' + i.decisionReference + (i.decisionDate ? ' du ' + jour(i.decisionDate) : '') : '' }}{{ i.suite ? ' · suite : ' + suites[i.suite] : '' }}.</p>
      </section>
    }

    @if (prmp() && declarable()) {
      <section class="dl__bloc" aria-label="Déclarer l'infructuosité">
        <h4 class="dl__h4">Déclarer le lot infructueux</h4>
        <label class="form-group"><span class="form-label">Motif (porté aux lettres des candidats et à la page publique)</span><input class="form-control" type="text" [value]="motifInfructuosite()" (input)="motifInfructuosite.set($any($event.target).value)" /></label>
        <div class="dl__grille">
          <label class="form-group"><span class="form-label">Référence de votre décision</span><input class="form-control" type="text" [value]="reference()" (input)="reference.set($any($event.target).value)" /></label>
          <label class="form-group"><span class="form-label">Date de la décision</span><input class="form-control" type="date" [value]="date()" (input)="date.set($any($event.target).value)" /></label>
          <label class="form-group"><span class="form-label">Suite envisagée (facultative)</span>
            <select class="form-control" (change)="suite.set($any($event.target).value || null)">
              <option value="" [selected]="!suite()">—</option>
              @for (s of codesSuite; track s) { <option [value]="s" [selected]="suite() === s">{{ suites[s] }}</option> }
            </select>
          </label>
        </div>
        <div><button type="button" class="btn btn-danger btn-sm" [disabled]="occupe() || !motifInfructuosite().trim() || !reference().trim() || !date()" (click)="declarer()">Déclarer le lot infructueux</button></div>
      </section>
    }

    @if (prmp() && reprise()) {
      <section class="dl__bloc" aria-label="Reprendre l'évaluation">
        <h4 class="dl__h4">Ou reprendre l’évaluation</h4>
        <p class="text-sm text-muted">L’évaluation se rouvre en entier ; le rapport signé est archivé ; un nouveau rapport, puis un nouveau dossier de marché suivront. Impossible si un autre lot est déjà attribué.</p>
        <label class="form-group"><span class="form-label">Motif de la reprise</span><input class="form-control" type="text" [value]="motifReprise()" (input)="motifReprise.set($any($event.target).value)" /></label>
        <div><button type="button" class="btn btn-outline btn-sm" [disabled]="occupe() || !motifReprise().trim()" (click)="reprendre()">Reprendre l’évaluation</button></div>
      </section>
    }

    @if (l.reprises?.length) {
      <section class="dl__bloc" aria-label="Reprises de l'évaluation">
        <h4 class="dl__h4">Reprises de l’évaluation</h4>
        <ul class="dl__liste">
          @for (r of l.reprises; track r.id) {
            <li>
              <span>{{ r.type === 'REATTRIBUTION' ? 'Réattribution après retrait' : 'Reprise après avis défavorable' }} — le {{ jj(r.le) }} : {{ r.motif }}{{ r.note ? ' (' + r.note + ')' : '' }}</span>
              @if (r.rapportDisponible) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="rapport(r, 'pdf')">Rapport archivé (PDF)</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="rapport(r, 'docx')">Word</button>
              }
            </li>
          }
        </ul>
      </section>
    }
    @if (erreur(); as e) { <div class="alert alert-danger" role="alert"><span>{{ e }}</span></div> }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.5rem; }
    .dl__bloc { border: 1px solid var(--n-200); border-radius: 6px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .dl__fait { background: var(--n-50, #f8fafc); }
    .dl__h4 { margin: 0; font-size: 0.92rem; }
    .dl__bloc p { margin: 0; }
    .dl__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.5rem; }
    .dl__liste { margin: 0; padding-left: 1.2rem; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 0.25rem; }
  `,
})
export class DecisionsLot {
  readonly idDmc = input.required<number>();
  readonly lot = input.required<LotAttribution>();
  readonly prmp = input(false);
  readonly maj = output<Attribution>();

  private readonly service = inject(AttributionService);
  private readonly toast = inject(ToastService);

  readonly suites = LIBELLES_SUITE;
  readonly codesSuite = Object.keys(LIBELLES_SUITE) as SuiteInfructuosite[];
  readonly jj = dateHeureFr;
  readonly declarable = computed(() => infructuositeDeclarable(this.lot()));
  readonly reprise = computed(() => repriseOuverte(this.lot()));

  readonly motifInfructuosite = signal('');
  readonly reference = signal('');
  readonly date = signal('');
  readonly suite = signal<SuiteInfructuosite | null>(null);
  readonly motifReprise = signal('');
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);

  jour(iso: string): string {
    const [a, m, j] = iso.slice(0, 10).split('-');
    return `${j}/${m}/${a}`;
  }

  declarer(): void {
    this.geste(
      this.service.declarerInfructueux(this.idDmc(), this.lot().lot, {
        motif: this.motifInfructuosite().trim(),
        decision: { reference: this.reference().trim(), date: this.date() },
        suite: this.suite(),
      }),
      'Le lot est déclaré infructueux : les candidats sont informés.',
    );
  }

  reprendre(): void {
    this.geste(this.service.reprendre(this.idDmc(), this.lot().lot, this.motifReprise().trim()), 'L’évaluation est rouverte : les membres de la commission sont prévenus.');
  }

  rapport(r: RepriseEvaluation, format: 'pdf' | 'docx'): void {
    this.service.rapportArchive(this.idDmc(), r.id, format).subscribe({
      next: (b) => (format === 'pdf' ? ouvrirBlobSur(b) : telechargerBlob(b, `rapport-archive-${this.idDmc()}-${r.id}.docx`)),
      error: (e: ApiError) => this.erreur.set(e.status === 404 ? 'Le rapport archivé n’est pas disponible.' : refus2d(e)),
    });
  }

  private geste(appel: Observable<Attribution>, succes: string): void {
    this.occupe.set(true);
    this.erreur.set(null);
    appel.subscribe({
      next: (a) => {
        this.occupe.set(false);
        this.motifInfructuosite.set('');
        this.reference.set('');
        this.date.set('');
        this.suite.set(null);
        this.motifReprise.set('');
        this.toast.success(succes);
        this.maj.emit(a);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.erreur.set(refus2d(e));
      },
    });
  }
}
