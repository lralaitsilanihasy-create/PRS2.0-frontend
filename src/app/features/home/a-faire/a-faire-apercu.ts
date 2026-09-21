import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AFaireTache, GesteAFaire } from '../../../models';
import { statutDossierLabel, statutSeverity } from '../../../shared/circuit/circuit-workflow';
import { Icone } from '../../../shared/ui/icone';
import { LIBELLES_GESTES } from './a-faire-libelles';
import { delaiLigne, echeanceTexte, faitsApercu, friseDossier, referenceLigne } from './a-faire-modele';
import { cibleDossier } from './a-faire-navigation';

/**
 * Aperçu du dossier sélectionné (colonne droite de la maquette `Main`) : identité, frise des sept
 * étapes, prochaine action et délai, faits, action principale et « Consulter le dossier ». Tout vient
 * de la tâche servie : aucun appel. Composant de présentation — l'écran exécute les gestes.
 *
 * Lot L4-F6 : la RÉFÉRENCE et « Consulter le dossier » sont des liens vers la page du dossier
 * (`/<espace>/dossier/:id?returnUrl=…`) — un Ctrl+clic ouvre un onglet, le retour rend la liste telle
 * qu'on l'a quittée. Quand le geste servi est VOIR ou SUIVRE, l'action principale EST ce lien.
 */
@Component({
  selector: 'app-a-faire-apercu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, RouterLink],
  template: `
    <section class="ap" aria-labelledby="ap-ref">
      <p class="ap__lbl">Dossier sélectionné</p>
      <h2 class="ap__ref" id="ap-ref" [class.ap__ref--sans]="reference().sansReference">
        <a class="ap__lien" [routerLink]="lien().commandes" [queryParams]="lien().queryParams">{{ reference().texte }}</a>
      </h2>
      @if (tache().dossier.libelleEntite) {
        <p class="ap__ent">{{ tache().dossier.libelleEntite }}</p>
      }
      <p class="ap__puces">
        <span class="ap__statut ap__statut--{{ ton() }}">{{ statut() }}</span>
        @if (type()) { <span class="ap__puce">{{ type() }}</span> }
        @if (tache().dossier.libelleLocalite) { <span class="ap__puce">{{ tache().dossier.libelleLocalite }}</span> }
      </p>

      <ol class="frise" aria-label="Étapes du circuit">
        @for (e of frise(); track e.cle) {
          <li class="frise__e frise__e--{{ e.etat }}" [attr.title]="e.acteur">
            <span class="frise__pt" aria-hidden="true"></span>
            <span class="frise__l">{{ e.libelle }}</span>
            <span class="frise__d">{{ e.date }}</span>
            <span class="cnm-sr-only">{{ etatLu(e.etat) }}@if (e.acteur) { , {{ e.acteur }} }</span>
          </li>
        }
      </ol>

      <div class="suite">
        <p class="suite__l">Prochaine action · vous</p>
        <p class="suite__t">{{ geste().long }}</p>
        <p class="suite__d suite__d--{{ delai().genre }}">{{ delai().texteApercu }}@if (echeance()) { · avant {{ echeance() }} }</p>
        <span class="barre" aria-hidden="true"><i class="barre__r barre__r--{{ delai().genre }}" [style.width.%]="delai().pourcentage"></i></span>
      </div>

      @if (faits().length) {
        <dl class="faits">
          @for (f of faits(); track f.libelle) {
            <div class="faits__f"><dt>{{ f.libelle }}</dt><dd>{{ f.valeur }}</dd></div>
          }
        </dl>
      }

      <div class="ap__actions">
        @if (consultationSeule()) {
          <a class="btn btn-primary ap__principal" [routerLink]="lien().commandes" [queryParams]="lien().queryParams">
            <app-icone [nom]="geste().icone" [taille]="16" />{{ geste().long }}
          </a>
        } @else {
          <button type="button" class="btn btn-primary ap__principal" [disabled]="occupe()" (click)="agir.emit(tache().geste)">
            <app-icone [nom]="geste().icone" [taille]="16" />{{ geste().long }}
          </button>
        }
        @for (g of secondaires(); track g) {
          <button type="button" class="btn btn-outline" [disabled]="occupe()" (click)="agir.emit(g)">
            <app-icone [nom]="libelle(g).icone" [taille]="16" />{{ libelle(g).long }}
          </button>
        }
        @if (!consultationSeule()) {
          <a class="btn btn-outline" [routerLink]="lien().commandes" [queryParams]="lien().queryParams">Consulter le dossier</a>
        }
      </div>
    </section>
  `,
  styleUrl: './a-faire-apercu.scss',
})
export class AFaireApercu {
  readonly tache = input.required<AFaireTache>();
  /** Ouverture d'une modale en cours : les actions attendent. */
  readonly occupe = input(false);
  /** Espace du profil (« president », « prmp »…) : la page du dossier y vit. */
  readonly espace = input.required<string>();
  /** URL de l'accueil, regroupement compris : `returnUrl` des liens vers la page. */
  readonly retour = input.required<string>();
  readonly agir = output<GesteAFaire>();

  readonly reference = computed(() => referenceLigne(this.tache()));
  /** Lien vers la page du dossier : commandes et `returnUrl`. */
  readonly lien = computed(() => {
    const cible = cibleDossier(this.tache().dossier.idDossier, this.espace(), this.retour());
    return { commandes: cible.type === 'route' ? cible.commandes : [], queryParams: cible.type === 'route' ? cible.queryParams : {} };
  });
  /** Rien à faire sur ce dossier (VOIR, SUIVRE) : l'action principale EST le lien de consultation. */
  readonly consultationSeule = computed(() => this.tache().geste === 'VOIR' || this.tache().geste === 'SUIVRE');
  readonly type = computed(() => this.tache().dossier.idSousType ?? this.tache().dossier.idTypeDossier);
  readonly statut = computed(() => statutDossierLabel(this.tache().dossier.statut));
  readonly ton = computed(() => statutSeverity(this.tache().dossier.statut));
  readonly frise = computed(() => friseDossier(this.tache()));
  readonly geste = computed(() => LIBELLES_GESTES[this.tache().geste]);
  /**
   * Gestes secondaires servis — plus, ⚠️ demande pilote (2026-09-21), la **lettre de renvoi** quand la
   * tâche est la décision du P/CC sur un projet de PV soumis (VISER ou RETOURNER servi) : troisième issue
   * de cette décision, jamais servie par le serveur, offerte ici comme sur la page.
   */
  readonly secondaires = computed(() => {
    const t = this.tache();
    const gestes = [t.geste, ...t.gestesSecondaires];
    const sec = t.gestesSecondaires.filter((g) => g !== t.geste);
    if ((gestes.includes('VISER') || gestes.includes('RETOURNER')) && !gestes.includes('LETTRE_RENVOI')) sec.push('LETTRE_RENVOI');
    return sec;
  });
  readonly delai = computed(() => delaiLigne(this.tache()));
  readonly echeance = computed(() => (['EN_RETARD', 'BIENTOT', 'DANS_LES_DELAIS'].includes(this.tache().urgence) ? echeanceTexte(this.tache().delai.echeance) : ''));
  readonly faits = computed(() => faitsApercu(this.tache()));

  libelle(g: GesteAFaire): (typeof LIBELLES_GESTES)[GesteAFaire] {
    return LIBELLES_GESTES[g];
  }

  etatLu(etat: string): string {
    return etat === 'faite' ? 'franchie' : etat === 'courante' ? 'en cours' : etat === 'pause' ? 'en pause' : 'à venir';
  }
}
