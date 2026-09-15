import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AFaireTache, GesteAFaire } from '../../../models';
import { statutDossierLabel, statutSeverity } from '../../../shared/circuit/circuit-workflow';
import { Icone } from '../../../shared/ui/icone';
import { LIBELLES_GESTES } from './a-faire-libelles';
import { delaiLigne, echeanceTexte, faitsApercu, friseDossier, referenceLigne } from './a-faire-modele';

/**
 * Aperçu du dossier sélectionné (colonne droite de la maquette `Main`) : identité, frise des sept
 * étapes, prochaine action et délai, faits, action principale et « Consulter le dossier ». Tout vient
 * de la tâche servie : aucun appel. Composant de présentation — l'écran exécute les gestes.
 */
@Component({
  selector: 'app-a-faire-apercu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="ap" aria-labelledby="ap-ref">
      <p class="ap__lbl">Dossier sélectionné</p>
      <h2 class="ap__ref" id="ap-ref" [class.ap__ref--sans]="reference().sansReference">{{ reference().texte }}</h2>
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
        <p class="suite__d suite__d--{{ delai().genre }}">{{ delai().texte }}@if (echeance()) { · avant {{ echeance() }} }</p>
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
        <button type="button" class="btn btn-primary ap__principal" [disabled]="occupe()" (click)="agir.emit(tache().geste)">
          <app-icone [nom]="geste().icone" [taille]="16" />{{ geste().long }}
        </button>
        @for (g of secondaires(); track g) {
          <button type="button" class="btn btn-outline" [disabled]="occupe()" (click)="agir.emit(g)">
            <app-icone [nom]="libelle(g).icone" [taille]="16" />{{ libelle(g).long }}
          </button>
        }
        @if (tache().geste !== 'VOIR' && tache().geste !== 'SUIVRE') {
          <button type="button" class="btn btn-outline" [disabled]="occupe()" (click)="consulter.emit()">Consulter le dossier</button>
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
  readonly agir = output<GesteAFaire>();
  readonly consulter = output<void>();

  readonly reference = computed(() => referenceLigne(this.tache()));
  readonly type = computed(() => this.tache().dossier.idSousType ?? this.tache().dossier.idTypeDossier);
  readonly statut = computed(() => statutDossierLabel(this.tache().dossier.statut));
  readonly ton = computed(() => statutSeverity(this.tache().dossier.statut));
  readonly frise = computed(() => friseDossier(this.tache()));
  readonly geste = computed(() => LIBELLES_GESTES[this.tache().geste]);
  readonly secondaires = computed(() => this.tache().gestesSecondaires.filter((g) => g !== this.tache().geste));
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
