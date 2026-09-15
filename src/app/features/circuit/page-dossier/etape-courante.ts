import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';

import { Dossier, GesteAFaire } from '../../../models';
import { Icone } from '../../../shared/ui/icone';
import { CibleGeste } from '../../home/a-faire/a-faire-navigation';
import { DecisionRetrait, IssueRetrait } from '../decision-retrait';
import { GesteBouton, VueEtape } from './etape-courante-modele';
import { EtapePv, FocusNavette } from './etape-pv';
import { SuiviRetrait } from './suivi-retrait';

/**
 * Panneau de l'étape en cours (page dossier, lot L4-F3 — maquette `GuideDossier`, étape ouverte sous la
 * frise) : où en est le dossier, qui porte l'étape, son délai, puis les gestes que le serveur ouvre au
 * connecté. Composant de présentation : la page exécute les gestes (`agir`).
 *
 * Lot F4 : quand le serveur sert un geste de la navette du projet de PV, le panneau monte `EtapePv`
 * (`PvWorkflow` tel quel, et le volet « Ce que dit le projet de PV » à la place des faits) ; les autres
 * gestes servis restent en boutons à côté.
 *
 * Lot F5 : quand le serveur sert DECIDER_RETRAIT, le panneau monte `DecisionRetrait` (accepter, ou refuser
 * avec motif, et le volet « La demande de la PRMP »). Plusieurs formulaires (retrait et navette, ou retrait
 * après un autre geste) : ils suivent le rang du serveur, comme le titre du panneau. Le formulaire du geste
 * principal vient sous le titre, son volet sur deux lignes à droite ; l'autre prend la rangée suivante,
 * son volet en face (`suite`).
 * Pour la PRMP, `SuiviRetrait` dit où en est sa demande — sans nommer le décideur (règle C2).
 */
@Component({
  selector: 'app-etape-courante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, EtapePv, DecisionRetrait, SuiviRetrait],
  template: `
    <section class="ec" [class.ec--seul]="!vue().faits.length && !vue().navette && !vue().retrait" [style.--ec-fleche]="vue().fleche" aria-labelledby="ec-titre">
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
        @if (suiviRetrait(); as d) {
          <app-suivi-retrait [dossier]="d" />
        }
        @if (vue().navette || vue().retrait) {
          @if (vue().horsPanneau.length) {
            <div class="ec__actions" [attr.aria-busy]="occupe()">
              @for (s of vue().horsPanneau; track s.cle) {
                <!-- Le geste principal du serveur garde son bouton principal quand un formulaire du panneau le suit. -->
                <button type="button" class="btn" [class.btn-primary]="s === vue().principal" [class.ec__principal]="s === vue().principal"
                  [class.btn-outline]="s !== vue().principal" [class.ec__second]="s !== vue().principal"
                  [attr.data-geste]="s.geste" [disabled]="occupe()" (click)="agir.emit(s)">
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
      @if (retraitDevant()) {
        @if (vue().retrait; as r) {
          <!-- Lot F5 : la décision est le geste principal — sous le titre, le volet de la demande à droite. -->
          <app-decision-retrait [demande]="r" [occupe]="occupe()" (changed)="retraitDecide.emit($event)" />
        }
      }
      @if (vue().navette; as n) {
        <!-- Lot F4 : la navette sous le titre, le volet du projet de PV dans la colonne de droite ; après la
             décision de retrait si celle-ci passe avant (lot F5). -->
        <app-etape-pv [class.ep-hote--suite]="retraitDevant()" [navette]="n" [idLocalite]="idLocalite()" [lienPv]="lienPv()" [gesteFocus]="gesteFocus()" (changed)="navetteChangee.emit()" />
      } @else if (vue().faits.length) {
        <dl class="ec__faits">
          @for (f of vue().faits; track f.libelle) {
            <div class="ec__fait"><dt>{{ f.libelle }}</dt><dd>{{ f.valeur }}</dd></div>
          }
        </dl>
      }
      @if (!retraitDevant()) {
        @if (vue().retrait; as r) {
          <!-- Lot F5 : un autre geste passe avant — la décision prend sa rangée, sous un intertitre. -->
          <app-decision-retrait [demande]="r" [suite]="true" [occupe]="occupe()" (changed)="retraitDecide.emit($event)" />
        }
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
  /** Lot F5 — PRMP : le dossier dont la page suit la demande de retrait ; `null` pour tout autre profil. */
  readonly suiviRetrait = input<Dossier | null>(null);
  /** Lot F5 — la demande de retrait a été décidée (ou a changé ailleurs). */
  readonly retraitDecide = output<IssueRetrait>();

  /** Lot F5 — la décision de retrait est le geste principal servi : son formulaire vient en premier. */
  readonly retraitDevant = computed(() => this.vue().retrait !== null && this.vue().principal?.geste === 'DECIDER_RETRAIT');

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly etapePv = viewChild(EtapePv);
  private readonly decisionRetrait = viewChild(DecisionRetrait);

  /**
   * Bouton d'un geste servi, le principal par défaut (focus à l'arrivée par `?geste=`, retour depuis la
   * barre collante). Navette du PV : le bouton que `PvWorkflow` offre pour ce geste, sinon le titre.
   */
  bouton(geste?: GesteAFaire): HTMLElement | null {
    const pv = this.etapePv();
    // Sans geste : le principal — son bouton du panneau, ou celui du formulaire qui le porte (retrait).
    const cible = geste ?? this.vue().principal?.geste;
    if (pv) {
      const dansPv = cible ? pv.bouton(cible) : null;
      if (dansPv) return dansPv;
    }
    const selecteur = cible ? `button[data-geste="${cible}"]` : 'button.ec__principal';
    return this.hote.nativeElement.querySelector<HTMLButtonElement>(selecteur) ?? (pv ? this.hote.nativeElement.querySelector<HTMLElement>('.ec__titre') : null);
  }

  /** Lot F5 — le formulaire de décision (focus à l'arrivée par `?geste=`, sans armer « Accepter »). */
  zoneRetrait(): HTMLElement | null {
    return this.decisionRetrait()?.zone() ?? null;
  }
}
