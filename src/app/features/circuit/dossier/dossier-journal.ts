import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';

import { DossierContenuStore } from './dossier-contenu.store';
import { actionLabel } from './journal-libelles';

/**
 * Journal des actions (spec « Mandats PRMP ») : qui a agi, quand et sous quel mandat.
 * L'OPÉRATEUR d'une action peut différer de la PRMP d'attribution (figée) — il est alors marqué.
 *
 * Table seule : l'hôte la monte dans son sous-dialogue, et ne la monte jamais pour la PRMP ni
 * l'UGPM (le store ne leur demande pas le journal).
 */
@Component({
  selector: 'app-dossier-journal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <table class="dc-journal">
      <thead>
        <tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">Opérateur</th><th scope="col">Détail</th></tr>
      </thead>
      <tbody>
        @for (a of contenu.journalVisible(); track a.idAction) {
          <tr>
            <td class="dc-journal__date">{{ a.dateAction | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ actionLabel(a.typeAction) }}</td>
            <td>
              {{ a.nomOperateur || a.auteur || a.idPrmpOperateur || '—' }}
              @if (a.idPrmpOperateur && contenu.dossier().idPrmp && a.idPrmpOperateur !== contenu.dossier().idPrmp) {
                <span class="badge dc-journal__succ" title="PRMP en fonction à la date de l'action — différente de la PRMP d'attribution (figée)">≠ attribution</span>
              }
            </td>
            <td class="dc-journal__detail">{{ a.detail || '—' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host { display: contents; }
    /* Journal des actions (spec « Mandats PRMP »). */
    .dc-journal { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border: 0.5px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .dc-journal th { text-align: left; padding: 7px 12px; background: var(--n-50); border-bottom: 0.5px solid var(--n-200); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--n-400); white-space: nowrap; }
    .dc-journal td { padding: 7px 12px; border-bottom: 0.5px solid var(--n-100); vertical-align: top; white-space: normal; }
    .dc-journal tr:last-child td { border-bottom: none; }
    /* Jour et heure sur LA MÊME LIGNE (demande pilote 2026-09-06) : le sélecteur bat le
       « white-space: normal » générique des cellules du journal. */
    .dc-journal td.dc-journal__date { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--n-500); }
    .dc-journal__detail { color: var(--n-500); }
    .dc-journal__succ { background: var(--warning-bg, #fef3c7); color: var(--warning-text, #b45309); margin-left: 6px; font-size: 10px; }
  `,
})
export class DossierJournal {
  protected readonly contenu = inject(DossierContenuStore);
  protected readonly actionLabel = actionLabel;
}
