import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Dossier } from '../../../models';
import { ReputeApprouve, StatutBadge } from '../../../shared/circuit';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierIdentite } from './dossier-identite';
import { HistoriqueDossier } from './historique-dossier';
import { ChaineProcedure } from '../page-dossier/chaine-procedure';
import { familleDossier } from './famille-dossier';

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
  imports: [RouterLink, StatutBadge, ReputeApprouve, DossierIdentite, HistoriqueDossier, ChaineProcedure],
  providers: [DossierContenuStore],
  template: `
    <!-- ⚠️ 01/11 (pilote, maquette « Tous mes dossiers », variante B) — en-tête bleu nuit au filet de la famille du dossier, « Ouvrir la
         page du dossier » en évidence ; puis les gestes, les faits (fournis par l'hôte), la chaîne, l'identité, les derniers événements. -->
    <article class="ad fam-{{ famille() }}" [attr.aria-label]="'Dossier ' + reference()">
      <header class="ad__tete">
        <div class="ad__titres">
          <span class="ad__type">{{ contenu.loading() ? 'Dossier' : contenu.typeLabel() }}@if (!contenu.loading()) { · {{ contenu.localiteLabel() }} }</span>
          <h2 class="ad__ref">{{ reference() }} <app-statut-badge [statut]="dossier().statut" /><app-repute-approuve [le]="dossier().reputeApprouveLe" [court]="true" /></h2>
          @if (!contenu.loading()) { <span class="ad__ent">{{ contenu.entiteLabel() }}</span> }
        </div>
        <a class="btn btn-sm ad__ouvrir" [routerLink]="lien()" [queryParams]="params()">Ouvrir la page du dossier →</a>
      </header>
      <div class="ad__gestes">
        <ng-content select="[gestes]" />
      </div>
      <ng-content select="[frise]" />
      @if (contenu.loading()) {
        <p class="ad__attente text-sm text-muted" role="status">Chargement du dossier…</p>
      } @else {
        <app-chaine-procedure [idDossier]="dossier().idDossier" />
        <app-dossier-identite />
        <!-- ⚠️ 01/11 (pilote, variante B) — les trois derniers événements ; « Tout l'historique » déplie le reste. -->
        <h3 class="ad__h">Derniers événements</h3>
        <app-historique-dossier [idDossier]="dossier().idDossier" [resume]="3" />
      }
    </article>
  `,
  styles: `
    :host { display: block; }
    .ad__h { margin: 4px 0 0; font-size: 14px; font-weight: 500; }
    .ad { display: flex; flex-direction: column; gap: 10px; }
    .ad__tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 12px 16px;
      border-radius: 6px; border-top: 4px solid var(--fam); background: var(--section-fond); color: var(--texte-menu); }
    .ad__titres { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .ad__type { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--texte-menu-secondaire); }
    .ad__ref { margin: 0; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; font-size: 18px; font-weight: 500; overflow-wrap: anywhere; color: var(--texte-menu); }
    .ad__ent { font-size: 13px; color: var(--texte-menu-secondaire); overflow-wrap: anywhere; }
    .ad__ouvrir { border: 1px solid var(--or); background: var(--or); color: var(--texte); font-weight: 500; white-space: nowrap; }
    .ad__ouvrir:hover { border-color: var(--examen-texte); }
    .ad__ouvrir:focus-visible { outline: 2px solid var(--texte-menu); outline-offset: 2px; }
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

  famille(): string {
    return familleDossier(this.dossier());
  }

  reference(): string {
    const d = this.dossier();
    return d.refeDossier || 'Dossier #' + d.idDossier;
  }

  ngOnInit(): void {
    this.contenu.charger(this.dossier);
  }
}
