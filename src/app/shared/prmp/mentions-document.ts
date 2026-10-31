import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { MentionsDocument } from '../../models';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { messageIndisponible } from './avis-specifique-modele';

/**
 * ⚠️ Manuel révisé, R3c (13/10 ; arbitrage Q3 du pilote : « mentions complètes ») — la **relecture des mentions** de l'avis spécifique
 * ou de la lettre d'invitation, telles que le serveur les vérifie sur le gabarit (le modèle porte la mention) et sur le document rendu
 * pour la version courante (la valeur n'est pas en pointillés), ou sans objet pour cette fiche. Lecture seule, chargée à l'ouverture.
 * Un écart de gabarit est un défaut du modèle (à signaler au backend) ; un écart de document est une saisie à compléter.
 */
@Component({
  selector: 'app-mentions-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="md" (toggle)="basculer($any($event.target).open)">
      <summary class="md__resume">
        Relecture des mentions du modèle type
        @if (mentions(); as m) {
          <span class="badge" [class.badge-success]="m.documentComplet" [class.badge-warning]="!m.documentComplet">{{ renseignees() }} / {{ applicables() }} renseignée(s)</span>
          @if (!m.gabaritComplet) { <span class="badge badge-danger">gabarit incomplet</span> }
        }
      </summary>
      @if (chargement()) {
        <p class="text-sm text-muted" role="status">Relecture…</p>
      } @else if (erreur(); as e) {
        <p class="text-sm" role="alert">{{ e }}</p>
      } @else if (mentions(); as m) {
        <p class="text-sm text-muted md__aide">
          Gabarit <span class="cnm-mono">{{ m.gabarit }}</span> — chaque mention du manuel est vérifiée sur le modèle, puis sur le document tel qu'il sera rendu pour la version courante de la fiche.
          Une mention « sans objet » ne s'applique pas à cette fiche (lot unique, garantie non requise, pas de visite).
        </p>
        <div class="table-responsive">
          <table class="cnm-table md__table">
            <thead>
              <tr><th scope="col">Mention</th><th scope="col">Modèle</th><th scope="col">Document</th><th scope="col">Détail</th></tr>
            </thead>
            <tbody>
              @for (x of m.mentions; track x.code) {
                <tr [class.md__ko]="!x.sansObjet && (!x.presenteAuGabarit || !x.renseignee)">
                  <td>{{ x.libelle }}<span class="cnm-mono md__code">{{ x.code }}</span></td>
                  <td>{{ x.presenteAuGabarit ? '✓' : '✕ absente' }}</td>
                  <td>{{ x.sansObjet ? 'sans objet' : x.renseignee ? '✓' : '✕ pointillés' }}</td>
                  <td class="text-sm">{{ x.detail || '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </details>
  `,
  styles: `
    .md { font-size: var(--text-sm); }
    .md__resume { cursor: pointer; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .md__aide { margin: 0.4rem 0; }
    /* La table commune met ses cellules sur une ligne : ici les libellés et les détails se replient, et chaque colonne garde sa place. */
    .md__table { width: 100%; table-layout: fixed; }
    .md__table th:nth-child(1) { width: 40%; }
    .md__table th:nth-child(2) { width: 12%; }
    .md__table th:nth-child(3) { width: 14%; }
    .md__table td { vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
    .md__code { font-size: var(--text-xs); color: var(--n-400); margin-left: 0.35rem; }
    .md__ko td:nth-child(2), .md__ko td:nth-child(3) { color: var(--danger-700, var(--retard-texte)); font-weight: 500; }
  `,
})
export class MentionsDocumentVue {
  readonly idDmc = input.required<number>();
  /** L'avis spécifique (fournitures, travaux) ou la lettre d'invitation (prestations intellectuelles, appel d'offres restreint). */
  readonly document = input.required<'avis' | 'lettres'>();

  private readonly fiches = inject(FicheMarcheService);
  private demande = false;

  readonly mentions = signal<MentionsDocument | null>(null);
  readonly chargement = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly applicables = computed(() => (this.mentions()?.mentions ?? []).filter((x) => !x.sansObjet).length);
  readonly renseignees = computed(() => (this.mentions()?.mentions ?? []).filter((x) => !x.sansObjet && x.presenteAuGabarit && x.renseignee).length);

  /** La relecture se charge à la première ouverture ; « Relire » après une modification de la fiche : refermer et rouvrir. */
  basculer(ouvert: boolean): void {
    if (!ouvert || this.demande) return;
    this.demande = true;
    this.chargement.set(true);
    const lecture = this.document() === 'avis' ? this.fiches.mentionsAvis(this.idDmc()) : this.fiches.mentionsLettres(this.idDmc());
    lecture.subscribe({
      next: (m) => {
        this.mentions.set(m);
        this.chargement.set(false);
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        this.demande = false;
        const raison = corpsErreur<{ details?: { raison?: string } }>(e)?.details?.raison ?? null;
        const code = codeErreur(e);
        this.erreur.set(
          code === 'AVIS_INDISPONIBLE' || code === 'LETTRE_INDISPONIBLE'
            ? (messageIndisponible(raison) ?? 'Ce document n’existe pas pour cette fiche.')
            : 'La relecture des mentions n’a pas pu être lue.',
        );
      },
    });
  }
}
