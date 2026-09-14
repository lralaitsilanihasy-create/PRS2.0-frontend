import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icone } from '../../../shared/ui/icone';
import { ActionGrille, VueGrille, pluriel } from './examen-modele';

/**
 * Panneau « grille de contrôle » de l'examen (maquette `ExamenLigne`, 2026-09-14) — à droite du
 * document, repliable en languette. Contexte de l'étape (ligne, objet, mode, montant, consigne,
 * justification tirée de la fiche), résumé des statuts, points RAS / Observation, corrections
 * « Au lieu de / Lire » avec leur cellule visée, navigation, et la RAISON d'une validation
 * impossible, dite avant le clic.
 *
 * Composant de présentation : il reçoit une vue calculée par l'écran et lui renvoie chaque geste
 * (`action`). Une seule couleur (ambre) pour les observations, comme dans le document.
 */
@Component({
  selector: 'app-examen-grille',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @if (!ouverte()) {
      <button
        type="button"
        class="languette"
        aria-expanded="false"
        aria-controls="grille-controle"
        (click)="action.emit({ type: 'basculer' })"
      >
        <app-icone nom="chevl" [taille]="16" />
        <span class="languette__t">Grille de contrôle</span>
        @if (vue().resume.obs) {
          <span class="languette__obs">{{ vue().resume.obs }}<span class="cnm-sr-only"> {{ vue().resume.obs > 1 ? 'observations' : 'observation' }}</span></span>
        }
        @if (vue().raison) {
          <span class="languette__alerte" [attr.title]="vue().raison"><app-icone nom="alert" [taille]="14" /></span>
        }
      </button>
    } @else {
      <section id="grille-controle" class="grille" aria-labelledby="grille-titre">
        <header class="grille__tete">
          <div class="grille__ligne1">
            <span class="grille__eyebrow">{{ vue().eyebrow }}</span>
            <button
              type="button"
              class="grille__replier"
              aria-expanded="true"
              aria-controls="grille-controle"
              aria-label="Replier la grille de contrôle"
              title="Replier la grille de contrôle"
              (click)="action.emit({ type: 'basculer' })"
            >
              <app-icone nom="chev" [taille]="16" />
            </button>
          </div>
          <h2 id="grille-titre" class="grille__titre">{{ vue().titre }}</h2>
          @if (vue().puces.length) {
            <div class="grille__puces">
              @for (p of vue().puces; track $index) {
                <span class="puce" [class.puce--mono]="p.mono" [class.puce--consigne]="p.consigne">{{ p.texte }}</span>
              }
            </div>
          }
          @for (j of vue().justifications; track j.titre) {
            <div class="grille__justif"><b>{{ j.titre }}</b>« {{ j.texte }} »</div>
          }
          @if (vue().points.length) {
            <p class="grille__resume">
              <span><i class="rond rond--ras" aria-hidden="true"></i>{{ vue().resume.ras }} RAS</span>
              <span><i class="rond rond--obs" aria-hidden="true"></i>{{ pluriel(vue().resume.obs, 'observation') }}</span>
              <span><i class="rond rond--vide" aria-hidden="true"></i>{{ vue().resume.aRenseigner }} à renseigner</span>
            </p>
          }
        </header>

        <div class="grille__points">
          @if (vue().piece; as pc) {
            <div class="pt" [class.pt--todo]="pc.statut === null">
              <div class="pt__h">
                <span class="pt__l" id="pt-l-piece">{{ pc.libelle }} <em aria-hidden="true">*</em></span>
                <div class="seg" role="radiogroup" aria-labelledby="pt-l-piece">
                  <label class="seg__opt seg__opt--ras" [class.is-on]="pc.statut === 'RAS'">
                    <input type="radio" class="seg__radio" [name]="'piece-' + pc.idPiece" [checked]="pc.statut === 'RAS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statutPiece', statut: 'RAS' })" />RAS
                  </label>
                  <label class="seg__opt seg__opt--obs" [class.is-on]="pc.statut === 'OBS'">
                    <input type="radio" class="seg__radio" [name]="'piece-' + pc.idPiece" [checked]="pc.statut === 'OBS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statutPiece', statut: 'OBS' })" />Observation
                  </label>
                </div>
              </div>
              @if (pc.statut === null) {
                <p class="pt__todo"><app-icone nom="alert" [taille]="13" />À renseigner</p>
              }
              @if (pc.statut === 'OBS') {
                <div class="obs">
                  <div class="obs__h">
                    @if (pc.numero) { <i class="obs__n">{{ pc.numero }}</i> }
                    <span>Observation sur la pièce</span>
                  </div>
                  <label class="obs__champ">
                    <span>Observation</span>
                    <textarea id="obs-piece" rows="3" [value]="pc.observation" [disabled]="vue().verrouille" (input)="action.emit({ type: 'observationPiece', valeur: valeurDe($event) })"></textarea>
                  </label>
                  @if (pc.erreur) { <span class="form-error">{{ pc.erreur }}</span> }
                </div>
              }
            </div>
          }

          @for (p of vue().points; track p.idPt) {
            <div class="pt" [class.pt--todo]="p.statut === null">
              <div class="pt__h">
                <span class="pt__l" [id]="'pt-l-' + p.idPt"><span class="pt__rang">{{ p.rang }}.</span> {{ p.libelle }}@if (p.obligatoire) { <em aria-hidden="true"> *</em> }</span>
                <div class="seg" role="radiogroup" [attr.aria-labelledby]="'pt-l-' + p.idPt">
                  <label class="seg__opt seg__opt--ras" [class.is-on]="p.statut === 'RAS'">
                    <input type="radio" class="seg__radio" [name]="'st-' + p.idPt" [checked]="p.statut === 'RAS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statut', idPt: p.idPt, statut: 'RAS' })" />RAS
                  </label>
                  <label class="seg__opt seg__opt--obs" [class.is-on]="p.statut === 'OBS'">
                    <input type="radio" class="seg__radio" [name]="'st-' + p.idPt" [checked]="p.statut === 'OBS'" [disabled]="vue().verrouille" (change)="action.emit({ type: 'statut', idPt: p.idPt, statut: 'OBS' })" />Observation
                  </label>
                </div>
              </div>
              @if (p.description) { <p class="pt__d">{{ p.description }}</p> }
              @if (p.statut === null) {
                <p class="pt__todo"><app-icone nom="alert" [taille]="13" />À renseigner</p>
              }
              @if (p.statut === 'OBS') {
                @for (o of p.observations; track o.index) {
                  <div class="obs">
                    <div class="obs__h">
                      @if (o.numero) { <i class="obs__n">{{ o.numero }}</i> }
                      <span class="obs__titre">{{ o.cellule ? 'Cellule « ' + o.cellule + ' »' : 'Correction ' + (o.index + 1) }}</span>
                      <button type="button" class="obs__retirer" [attr.aria-label]="'Retirer la correction ' + (o.index + 1) + ' du point ' + p.rang" (click)="action.emit({ type: 'retirer', idPt: p.idPt, index: o.index })">
                        <app-icone nom="x" [taille]="14" />
                      </button>
                    </div>
                    <div class="obs__diff">
                      <label class="obs__champ">
                        <span>Au lieu de</span>
                        <textarea rows="2" [id]="'obs-aulieude-' + p.idPt + '-' + o.index" [value]="o.auLieuDe" [disabled]="vue().verrouille" (input)="action.emit({ type: 'auLieuDe', idPt: p.idPt, index: o.index, valeur: valeurDe($event) })"></textarea>
                      </label>
                      <label class="obs__champ">
                        <span>Lire</span>
                        <textarea rows="2" [id]="'obs-lire-' + p.idPt + '-' + o.index" [value]="o.lire" [disabled]="vue().verrouille" (input)="action.emit({ type: 'lire', idPt: p.idPt, index: o.index, valeur: valeurDe($event) })"></textarea>
                      </label>
                    </div>
                    @if (vue().options.length) {
                      <label class="obs__cible">
                        <span>Cellule visée</span>
                        <select [disabled]="vue().verrouille" (change)="action.emit({ type: 'cible', idPt: p.idPt, index: o.index, cle: valeurDe($event) })">
                          <option value="" [selected]="!o.cleCible">Aucune</option>
                          @for (opt of vue().options; track opt.cle) {
                            <option [value]="opt.cle" [selected]="opt.cle === o.cleCible">{{ opt.libelle }}</option>
                          }
                        </select>
                      </label>
                    }
                  </div>
                } @empty {
                  <p class="pt__d">Aucune correction.</p>
                }
                <button type="button" class="obs__ajouter" [disabled]="vue().verrouille" (click)="action.emit({ type: 'ajouter', idPt: p.idPt })">
                  <app-icone nom="plus" [taille]="14" />Ajouter une correction
                </button>
                @if (p.erreur) { <span class="form-error">{{ p.erreur }}</span> }
              }
            </div>
          }
        </div>

        <footer class="grille__pied">
          <p class="grille__raison" aria-live="polite">
            @if (vue().raison) { <app-icone nom="alert" [taille]="14" />{{ vue().raison }} }
          </p>
          @if (enregistre()) {
            <!-- Seulement après un brouillon réellement enregistré (validation d'étape, mode création). -->
            <p class="grille__enregistre"><app-icone nom="check" [taille]="14" />Enregistré à {{ enregistre() }}</p>
          }
          <div class="grille__actions">
            @if (vue().libellePrecedent) {
              <button type="button" class="btn btn-outline grille__prec" (click)="action.emit({ type: 'precedent' })">
                <app-icone nom="chevl" [taille]="16" />{{ vue().libellePrecedent }}
              </button>
            }
            <button type="button" class="btn btn-primary grille__valider" [disabled]="!!vue().raison" (click)="action.emit({ type: 'valider' })">
              {{ vue().libelleValider }}<app-icone nom="chev" [taille]="16" />
            </button>
          </div>
        </footer>
      </section>
    }
  `,
  styleUrl: './examen-grille.scss',
  host: { '[class.grille--repliee]': '!ouverte()' },
})
export class ExamenGrille {
  readonly vue = input.required<VueGrille>();
  readonly ouverte = input(true);
  /** Heure du dernier brouillon de progression enregistré, s'il y en a un. */
  readonly enregistre = input<string | null>(null);
  readonly action = output<ActionGrille>();

  readonly pluriel = pluriel;

  valeurDe(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }
}
