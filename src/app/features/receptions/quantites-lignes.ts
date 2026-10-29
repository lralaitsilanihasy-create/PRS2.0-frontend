import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Une ligne à saisir : le plafond (`max`) est le reliquat à la livraison, la quantité livrée au procès-verbal. */
export interface LigneQuantite {
  rang: number;
  designation: string | null;
  unite: string | null;
  /** Rappels affichés avant la saisie (« commandé 100 · reçu 60 »). */
  rappel: string;
  max: number;
}

/** Les quantités saisies, par rang ; une ligne absente n'a pas été touchée (elle garde la valeur préremplie : `max`). */
export type SaisieQuantites = Readonly<Record<number, string>>;

/** La valeur d'une ligne : celle saisie, sinon le plafond (prérempli). */
export function quantiteSaisie(l: LigneQuantite, s: SaisieQuantites): number {
  const v = s[l.rang];
  if (v == null) return l.max;
  return v.trim() === '' ? NaN : Number(v);
}

/** Chaque quantité entre 0 et son plafond, et au moins une positive. */
export function quantitesValides(lignes: readonly LigneQuantite[], s: SaisieQuantites): boolean {
  const q = lignes.map((l) => quantiteSaisie(l, s));
  return q.every((v, i) => Number.isFinite(v) && v >= 0 && v <= lignes[i].max) && q.some((v) => v > 0);
}

/**
 * ⚠️ 29/10 (« bons-reception », §B3 ; PRS20 7b67b12, V148) — **les quantités par ligne d'un bon**, saisies à la livraison (plafond :
 * le reliquat) et au procès-verbal de réception (plafond : la quantité livrée). Chaque champ est prérempli au plafond : livrer ou
 * recevoir tout ne demande aucune saisie. Le parent garde la saisie (`SaisieQuantites`) et l'envoie au serveur, qui reste la garde.
 */
@Component({
  selector: 'app-quantites-lignes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cnm-table-wrap">
      <table class="cnm-table ql__table" [attr.aria-label]="titre()">
        <thead><tr><th scope="col">Article</th><th scope="col">Unité</th><th scope="col">Situation</th><th scope="col" class="ql__num">{{ colonne() }}</th></tr></thead>
        <tbody>
          @for (l of lignes(); track l.rang) {
            @let v = quantiteSaisie(l, saisie());
            <tr>
              <td>{{ l.designation || 'Ligne ' + l.rang }}</td>
              <td>{{ l.unite || '—' }}</td>
              <td class="text-sm text-muted">{{ l.rappel }}</td>
              <td class="ql__num">
                <input class="form-control form-control-sm ql__saisie" type="number" min="0" [max]="l.max" step="any"
                  [attr.aria-label]="colonne() + ' — ' + (l.designation || 'ligne ' + l.rang)"
                  [attr.aria-invalid]="!(v >= 0 && v <= l.max)"
                  [value]="saisie()[l.rang] ?? l.max" (input)="changer(l.rang, $any($event.target).value)" />
                <span class="text-sm text-muted"> / {{ l.max.toLocaleString('fr-FR') }}</span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .ql__table { font-size: 0.82rem; }
    .ql__num { text-align: right; white-space: nowrap; }
    .ql__saisie { display: inline-block; max-width: 7rem; }
  `,
})
export class QuantitesLignes {
  readonly lignes = input.required<readonly LigneQuantite[]>();
  readonly saisie = input.required<SaisieQuantites>();
  /** L'intitulé de la colonne saisie (« Quantité livrée », « Quantité reçue »). */
  readonly colonne = input.required<string>();
  readonly titre = input('Quantités par article');
  readonly saisieChange = output<SaisieQuantites>();

  readonly quantiteSaisie = quantiteSaisie;

  changer(rang: number, v: string): void {
    this.saisieChange.emit({ ...this.saisie(), [rang]: v });
  }
}
