import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { EtapeEvaluation, OffreEvaluee } from '../../models';
import { LIBELLES_ANORMALE, ariary } from './libelles-evaluation';

/** L'état d'une offre à l'étape affichée, et le ton de sa carte. */
export interface EtatOffreEtape {
  libelle: string;
  ton: 'afaire' | 'ok' | 'ko' | 'attente';
}

/**
 * ⚠️ 19/10 (pilote) — l'état d'une offre à une étape de l'évaluation, pour sa carte : ce qui reste à décider se voit d'un coup
 * d'œil, sans dérouler la grille de chaque offre.
 */
export function etatOffreEtape(o: OffreEvaluee, etape: EtapeEvaluation): EtatOffreEtape {
  switch (etape) {
    case 'CONFORMITE': {
      const d = o.conformite?.decision;
      if (d === 'CONFORME') return { libelle: 'Conforme', ton: 'ok' };
      if (d === 'ECARTEE') return { libelle: 'Écartée', ton: 'ko' };
      return { libelle: 'À décider', ton: 'afaire' };
    }
    case 'EVALUATION':
      if (o.ecartee?.etape === 'EVALUATION') return { libelle: 'Écartée', ton: 'ko' };
      if (o.evaluation?.montantEvalue == null) return { libelle: 'Montant à évaluer', ton: 'afaire' };
      return { libelle: o.rang ? `Rang ${o.rang}${o.exAequo ? ' ex aequo' : ''}` : 'Évaluée', ton: 'ok' };
    case 'ANORMALES': {
      const d = o.anormale?.decision;
      if (!d) return { libelle: 'À décider', ton: 'afaire' };
      if (d === 'REJETEE') return { libelle: LIBELLES_ANORMALE[d], ton: 'ko' };
      if (d === 'SUSPECTEE') return { libelle: LIBELLES_ANORMALE[d], ton: 'attente' };
      return { libelle: LIBELLES_ANORMALE[d], ton: 'ok' };
    }
    default:
      return { libelle: '', ton: 'attente' };
  }
}

/** La première offre qui attend une décision à cette étape ; à défaut, la première. */
export function offreParDefaut(offres: readonly OffreEvaluee[], etape: EtapeEvaluation): string | null {
  return (offres.find((o) => etatOffreEtape(o, etape).ton === 'afaire') ?? offres[0])?.idOffre ?? null;
}

/**
 * ⚠️ 19/10 (pilote) — **les offres en cartes**, au-dessus de l'étape : un clic affiche l'offre choisie, seule. Chaque carte dit
 * son numéro, le soumissionnaire, le montant évalué quand il existe, et son état à l'étape. Le compte « reste à décider » guide
 * la CAO jusqu'à l'arrêt de l'étape.
 */
@Component({
  selector: 'app-selecteur-offres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="so__tete">
      <span class="so__titre">Offres de l'étape</span>
      <span class="text-sm" [class.so__reste]="reste() > 0" [class.so__fini]="reste() === 0">
        {{ reste() ? reste() + ' sur ' + offres().length + ' à décider' : 'Toutes décidées' }}
      </span>
    </div>
    <ul class="so" role="list" aria-label="Choisir l'offre à afficher">
      @for (o of offres(); track o.idOffre) {
        @let e = etat(o);
        <li>
          <button type="button" class="so__carte" [class]="'so__carte so__carte--' + e.ton" [class.so__carte--choisie]="o.idOffre === choisie()" [attr.aria-pressed]="o.idOffre === choisie()" (click)="choisir.emit(o.idOffre)">
            <span class="so__num" aria-hidden="true">{{ o.numero ?? '?' }}</span>
            <span class="so__corps">
              <strong class="so__nom">{{ o.entreprise.raisonSociale }}</strong>
              <span class="so__ligne">Offre n° {{ o.numero ?? '—' }}@if (o.evaluation?.montantEvalue != null) { · {{ ariary(o.evaluation!.montantEvalue) }} HT }</span>
              <span class="so__etat">{{ e.libelle }}</span>
            </span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.5rem; }
    .so__tete { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
    .so__titre { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); font-weight: 700; }
    .so__reste { color: var(--warning-text); font-weight: 700; }
    .so__fini { color: var(--success-text); font-weight: 700; }
    .so { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 0.6rem; }
    .so__carte { width: 100%; height: 100%; display: flex; gap: 0.65rem; align-items: flex-start; text-align: left; padding: 0.7rem 0.8rem; border-radius: 10px;
      border: 1px solid var(--n-200); border-left: 4px solid var(--n-300); background: #fff; font: inherit; color: inherit; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s; }
    .so__carte:hover { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08); }
    .so__carte:focus-visible { outline: 3px solid var(--p-200); outline-offset: 1px; }
    .so__carte--afaire { border-left-color: var(--warning-text); }
    .so__carte--ok { border-left-color: var(--success-text); }
    .so__carte--ko { border-left-color: var(--danger-text); }
    .so__carte--attente { border-left-color: var(--info-text); }
    .so__carte--choisie { border-color: var(--p-500); box-shadow: 0 0 0 3px var(--p-100); background: var(--p-100); }
    .so__num { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: var(--bouton-principal); color: #fff; font-weight: 700; font-size: 0.85rem; }
    .so__corps { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .so__nom { font-size: var(--text-sm); line-height: 1.3; }
    .so__ligne { font-size: 0.78rem; color: var(--n-500); }
    .so__etat { margin-top: 0.2rem; font-size: 0.78rem; font-weight: 700; }
    .so__carte--afaire .so__etat { color: var(--warning-text); }
    .so__carte--ok .so__etat { color: var(--success-text); }
    .so__carte--ko .so__etat { color: var(--danger-text); }
    .so__carte--attente .so__etat { color: var(--info-text); }
  `,
})
export class SelecteurOffres {
  readonly offres = input.required<readonly OffreEvaluee[]>();
  readonly etape = input.required<EtapeEvaluation>();
  readonly choisie = input<string | null>(null);
  readonly choisir = output<string>();
  readonly ariary = ariary;

  etat(o: OffreEvaluee): EtatOffreEtape {
    return etatOffreEtape(o, this.etape());
  }

  reste(): number {
    return this.offres().filter((o) => this.etat(o).ton === 'afaire').length;
  }
}
