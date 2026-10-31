import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Dossier } from '../../../models';
import { ReputeApprouve, StatutBadge } from '../../../shared/circuit';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierIdentite } from './dossier-identite';
import { HistoriqueDossier } from './historique-dossier';

/**
 * Aperçu d'un dossier dans le volet de droite d'une liste (pilote, 31/10/2026, Espace de travail, lot 3c — « liste + détail
 * partout où c'est possible »). Il porte son propre `DossierContenuStore`, comme la consultation : l'hôte le RECRÉE quand
 * le dossier choisi change (`@for … track idDossier`), ce qui recharge le contenu proprement.
 *
 * En tête : type, référence, localité, statut. Puis les gestes, fournis par l'hôte (`[gestes]` : les mêmes boutons que ses
 * lignes) avec « Ouvrir la page du dossier », la frise (`[frise]`, fournie par l'hôte) et le bloc d'identité partagé.
 */
@Component({
  selector: 'app-apercu-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, ReputeApprouve, DossierIdentite, HistoriqueDossier],
  providers: [DossierContenuStore],
  template: `
    <article class="ad" [attr.aria-label]="'Dossier ' + reference()">
      <header class="ad__tete">
        <div class="ad__titres">
          <span class="ad__type">{{ contenu.loading() ? 'Dossier' : contenu.typeLabel() }}@if (!contenu.loading()) { · {{ contenu.localiteLabel() }} }</span>
          <h2 class="ad__ref">{{ reference() }}</h2>
        </div>
        <span class="ad__statut"><app-statut-badge [statut]="dossier().statut" /><app-repute-approuve [le]="dossier().reputeApprouveLe" [court]="true" /></span>
      </header>
      <div class="ad__gestes">
        <ng-content select="[gestes]" />
        <a class="btn btn-outline btn-sm" [routerLink]="lien()" [queryParams]="params()">Ouvrir la page du dossier</a>
      </div>
      <ng-content select="[frise]" />
      @if (contenu.loading()) {
        <p class="ad__attente text-sm text-muted" role="status">Chargement du dossier…</p>
      } @else {
        <app-dossier-identite />
        <!-- ⚠️ 31/10 (pilote) — l'historique complet du dossier, aussi dans le volet de droite des listes. -->
        <app-historique-dossier [idDossier]="dossier().idDossier" />
      }
    </article>
  `,
  styles: `
    :host { display: block; }
    .ad { display: flex; flex-direction: column; gap: 10px; }
    .ad__tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--bordure); }
    .ad__titres { min-width: 0; }
    .ad__type { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--texte-secondaire); }
    .ad__ref { margin: 2px 0 0; font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
    .ad__statut { display: inline-flex; gap: 6px; align-items: center; }
    .ad__gestes { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .ad__gestes:empty { display: none; }
  `,
})
export class ApercuDossier implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** Lien de la page du dossier, et ses paramètres (retour à la liste d'origine). */
  readonly lien = input.required<string | readonly unknown[]>();
  readonly params = input<Record<string, unknown> | null>(null);

  protected readonly contenu = inject(DossierContenuStore);

  reference(): string {
    const d = this.dossier();
    return d.refeDossier || 'Dossier #' + d.idDossier;
  }

  ngOnInit(): void {
    this.contenu.charger(this.dossier);
  }
}
