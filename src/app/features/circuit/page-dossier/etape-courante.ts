import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

import { Icone } from '../../../shared/ui/icone';
import { GesteBouton, VueEtape } from './etape-courante-modele';

/**
 * Panneau de l'étape en cours (page dossier, lot L4-F3 — maquette `GuideDossier`, étape ouverte sous la
 * frise) : où en est le dossier, qui porte l'étape, son délai, puis les gestes que le serveur ouvre au
 * connecté. Composant de présentation : la page exécute les gestes (`agir`).
 *
 * Lots F4 et F5 : la navette du projet de PV et la décision de retrait viendront dans ce panneau ; en
 * attendant, leurs boutons mènent à la cible d'« À faire » (`ciblePage`).
 */
@Component({
  selector: 'app-etape-courante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <section class="ec" [class.ec--seul]="!vue().faits.length" [style.--ec-fleche]="vue().fleche" aria-labelledby="ec-titre">
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
        @if (vue().principal; as p) {
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
      @if (vue().faits.length) {
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
  readonly agir = output<GesteBouton>();

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bouton d'un geste servi, le principal par défaut (focus à l'arrivée par `?geste=`, retour depuis la barre collante). */
  bouton(geste?: string): HTMLButtonElement | null {
    const selecteur = geste ? `button[data-geste="${geste}"]` : 'button.ec__principal';
    return this.hote.nativeElement.querySelector<HTMLButtonElement>(selecteur);
  }
}
