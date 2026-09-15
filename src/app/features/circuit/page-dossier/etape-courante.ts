import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';

import { GesteAFaire } from '../../../models';
import { Icone } from '../../../shared/ui/icone';
import { CibleGeste } from '../../home/a-faire/a-faire-navigation';
import { GesteBouton, VueEtape } from './etape-courante-modele';
import { EtapePv, FocusNavette } from './etape-pv';

/**
 * Panneau de l'étape en cours (page dossier, lot L4-F3 — maquette `GuideDossier`, étape ouverte sous la
 * frise) : où en est le dossier, qui porte l'étape, son délai, puis les gestes que le serveur ouvre au
 * connecté. Composant de présentation : la page exécute les gestes (`agir`).
 *
 * Lot F4 : quand le serveur sert un geste de la navette du projet de PV, le panneau monte `EtapePv`
 * (`PvWorkflow` tel quel, et le volet « Ce que dit le projet de PV » à la place des faits) ; les autres
 * gestes servis restent en boutons à côté. Lot F5 : la décision de retrait viendra aussi dans ce panneau.
 */
@Component({
  selector: 'app-etape-courante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, EtapePv],
  template: `
    <section class="ec" [class.ec--seul]="!vue().faits.length && !vue().navette" [style.--ec-fleche]="vue().fleche" aria-labelledby="ec-titre">
      <div class="ec__corps">
        <p class="ec__sur">
          {{ vue().etape }}@if (vue().etape && vue().porteur) { · }{{ vue().porteur }}
        </p>
        <h2 class="ec__titre" id="ec-titre" tabindex="-1">{{ vue().titre }}</h2>
        @if (vue().delai || vue().mode) {
          <p class="ec__marques">
            @if (vue().delai; as d) {
              <span class="ec-delai ec-delai--{{ d.genre }}"><app-icone nom="clock" [taille]="16" />{{ d.texte }}</span>
            }
            @if (vue().mode) {
              <span class="ec-mode"><app-icone nom="deleg" [taille]="15" />{{ vue().mode }}</span>
            }
          </p>
        }
        @if (vue().note) {
          <p class="ec__note">{{ vue().note }}</p>
        }
        @if (vue().navette) {
          @if (vue().horsNavette.length) {
            <div class="ec__actions" [attr.aria-busy]="occupe()">
              @for (s of vue().horsNavette; track s.cle) {
                <button type="button" class="btn btn-outline ec__second" [attr.data-geste]="s.geste" [disabled]="occupe()" (click)="agir.emit(s)">
                  <app-icone [nom]="s.icone" [taille]="16" />{{ s.libelle }}
                  @if (s.mode && s.mode !== vue().mode) {
                    <span class="ec-mode ec-mode--bouton">{{ s.mode }}</span>
                  }
                </button>
              }
            </div>
          }
        } @else if (vue().principal; as p) {
          <div class="ec__actions" [attr.aria-busy]="occupe()">
            <button type="button" class="btn btn-primary ec__principal" [attr.data-geste]="p.geste" [disabled]="occupe()" (click)="agir.emit(p)">
              <app-icone [nom]="p.icone" [taille]="16" />{{ p.libelle }}
            </button>
            @for (s of vue().secondaires; track s.cle) {
              <button type="button" class="btn btn-outline ec__second" [attr.data-geste]="s.geste" [disabled]="occupe()" (click)="agir.emit(s)">
                <app-icone [nom]="s.icone" [taille]="16" />{{ s.libelle }}
                @if (s.mode && s.mode !== vue().mode) {
                  <span class="ec-mode ec-mode--bouton">{{ s.mode }}</span>
                }
              </button>
            }
          </div>
        }
      </div>
      @if (vue().navette; as n) {
        <!-- Lot F4 : la navette sous le titre, le volet du projet de PV dans la colonne de droite. -->
        <app-etape-pv [navette]="n" [idLocalite]="idLocalite()" [lienPv]="lienPv()" [gesteFocus]="gesteFocus()" (changed)="navetteChangee.emit()" />
      } @else if (vue().faits.length) {
        <dl class="ec__faits">
          @for (f of vue().faits; track f.libelle) {
            <div class="ec__fait"><dt>{{ f.libelle }}</dt><dd>{{ f.valeur }}</dd></div>
          }
        </dl>
      }
    </section>
  `,
  styleUrl: './etape-courante.scss',
})
export class EtapeCourante {
  readonly vue = input.required<VueEtape>();
  /** Une modale se prépare (lectures en cours) : les gestes attendent. */
  readonly occupe = input(false);
  /** Lot F4 — localité du dossier, pour `PvWorkflow` (intérim, Membres co-signataires). */
  readonly idLocalite = input<string | null>(null);
  /** Lot F4 — gestion du projet de PV, repli d'un geste de navette indisponible. */
  readonly lienPv = input<CibleGeste | null>(null);
  /** Lot F4 — `?geste=` de navette servi : son bouton dans `PvWorkflow` reçoit le focus. */
  readonly gesteFocus = input<FocusNavette | null>(null);
  readonly agir = output<GesteBouton>();
  /** Lot F4 — une transition de la navette a réussi. */
  readonly navetteChangee = output<void>();

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly etapePv = viewChild(EtapePv);

  /**
   * Bouton d'un geste servi, le principal par défaut (focus à l'arrivée par `?geste=`, retour depuis la
   * barre collante). Navette du PV : le bouton que `PvWorkflow` offre pour ce geste, sinon le titre.
   */
  bouton(geste?: GesteAFaire): HTMLElement | null {
    const pv = this.etapePv();
    if (pv) {
      const cible = geste ?? this.vue().principal?.geste;
      const dansPv = cible ? pv.bouton(cible) : null;
      if (dansPv) return dansPv;
    }
    const selecteur = geste ? `button[data-geste="${geste}"]` : 'button.ec__principal';
    return this.hote.nativeElement.querySelector<HTMLButtonElement>(selecteur) ?? (pv ? this.hote.nativeElement.querySelector<HTMLElement>('.ec__titre') : null);
  }
}
