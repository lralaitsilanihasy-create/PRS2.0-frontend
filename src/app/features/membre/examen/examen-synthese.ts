import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Avis } from '../../../models';
import { Icone } from '../../../shared/ui/icone';
import { GroupeRecap, ObservationNumerotee, pluriel } from './examen-modele';

/**
 * Étape 6 de l'examen, « Synthèse et avis » (maquette `ExamenSynthese`, appréciée par les chefs le
 * 2026-09-14) : à gauche le RÉCAPITULATIF de toutes les observations, regroupées par étape et
 * numérotées comme les pastilles du document, chacune avec « Modifier » qui ramène à l'endroit ; à
 * droite la synthèse et l'avis (tous deux obligatoires), ce qui se passe réellement après la
 * soumission, et les boutons existants.
 *
 * Composant de présentation : l'écran fournit les données et exécute les gestes.
 */
@Component({
  selector: 'app-examen-synthese',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <div class="synth">
      <section class="panneau synth__recap" aria-labelledby="recap-titre">
        <header class="panneau__tete">
          <h2 id="recap-titre">Récapitulatif avant soumission</h2>
          <small>{{ pluriel(nbObservations(), 'observation') }}</small>
        </header>
        <div class="recap">
          @if (consigne()) {
            <p class="recap__consigne"><app-icone nom="message" [taille]="16" /><span>{{ consigne() }}</span></p>
          }
          @for (g of groupes(); track g.cle) {
            <div class="g" [class.g--na]="g.sansObjet">
              <h3 class="g__h">
                <span class="g__n" aria-hidden="true">
                  @if (g.sansObjet) { {{ g.numero }} } @else { <app-icone nom="check" [taille]="12" /> }
                </span>
                <span class="g__l">{{ g.libelle }}</span>
                @if (g.sousTitre) { <small>{{ g.sousTitre }}</small> }
                <span class="st st--{{ g.statut.genre }}">{{ g.statut.texte }}</span>
              </h3>
              @if (g.observations.length) {
                <ul class="g__obs">
                  @for (o of g.observations; track o.numero) {
                    <li class="o">
                      <span class="o__n" aria-hidden="true">{{ o.numero }}</span>
                      <div class="o__t">
                        <span class="cnm-sr-only">Observation {{ o.numero }} : </span>{{ o.titre }}
                        <span>{{ o.sousTitre }}@if (o.cellule) { · {{ o.cellule }} }</span>
                      </div>
                      <div class="o__d">
                        @if (o.texte !== null) {
                          <span>{{ o.texte || '—' }}</span>
                        } @else {
                          <span class="was"><span class="cnm-sr-only">Au lieu de : </span>{{ o.auLieuDe || '—' }}</span>
                          <app-icone nom="chev" [taille]="13" />
                          <span class="now"><span class="cnm-sr-only">, lire : </span>{{ o.lire || '—' }}</span>
                        }
                      </div>
                      <button type="button" class="lien" [attr.aria-label]="libelleModifier(o)" (click)="modifier.emit(o)">
                        <app-icone nom="edit" [taille]="14" />Modifier
                      </button>
                    </li>
                  }
                </ul>
              }
              @if (g.sansObservation) {
                <p class="g__more"><app-icone nom="check" [taille]="14" />{{ g.sansObservation }}</p>
              }
            </div>
          }
        </div>
      </section>

      <section class="panneau synth__avis" aria-labelledby="avis-titre">
        <header class="panneau__tete">
          <h2 id="avis-titre">Votre avis</h2>
          <small>Étape 6 sur 6</small>
        </header>
        <div class="avis">
          @if (editable()) {
            <label class="fld">
              <span class="fld__l">Synthèse des observations <em aria-hidden="true">*</em><span class="cnm-sr-only"> (obligatoire)</span></span>
              <textarea class="ta" rows="4" aria-required="true" [value]="synthese()" (input)="syntheseChange.emit(valeurDe($event))"></textarea>
            </label>
            <fieldset class="fld">
              <legend class="fld__l">Avis global <em aria-hidden="true">*</em><span class="cnm-sr-only"> (obligatoire)</span></legend>
              <div class="opts">
                @for (a of aviss(); track a.idAvis) {
                  <label class="opt" [class.is-on]="a.idAvis === avis()">
                    <input type="radio" class="opt__radio" name="avis-global" [value]="a.idAvis" [checked]="a.idAvis === avis()" (change)="avisChange.emit(a.idAvis)" />
                    <i class="opt__rond" aria-hidden="true"></i>{{ a.libelleAvis || a.idAvis }}
                  </label>
                }
              </div>
              <p class="fld__hint">{{ avisHint() }}</p>
            </fieldset>
          } @else if (mode() === 'edit') {
            <div class="lecture">
              @if (avisLibelle()) { <p><strong>Avis global :</strong> {{ avisLibelle() }}</p> }
              @if (synthese()) { <p><strong>Synthèse :</strong> {{ synthese() }}</p> }
              <p>Le projet de PV a déjà été soumis : la suite se joue dans « Projets de PV ».</p>
            </div>
          }

          @if (apres().length) {
            <div class="next">
              <h3>Après la soumission</h3>
              <ol>
                @for (etape of apres(); track $index) { <li>{{ etape }}</li> }
              </ol>
            </div>
          }

          @if (formError()) { <p class="form-error" role="alert">{{ formError() }}</p> }

          @if (mode() === 'create') {
            <button type="button" class="btn btn-primary avis__principal" [disabled]="saving() || !dispatchConnu()" (click)="soumettre.emit()">
              <app-icone nom="send" [taille]="16" />{{ saving() ? 'Enregistrement…' : "Soumettre l'examen" }}
            </button>
          } @else if (mode() === 'edit') {
            <button type="button" class="btn btn-primary avis__principal" [disabled]="saving() || !dispatchConnu()" (click)="enregistrer.emit()">
              <app-icone nom="save" [taille]="16" />{{ saving() ? 'Enregistrement…' : estReexamen() ? 'Enregistrer le réexamen' : "Modifier l'examen" }}
            </button>
          }
          <div class="avis__nav">
            <button type="button" class="btn btn-outline" (click)="precedent.emit()"><app-icone nom="chevl" [taille]="16" />{{ libellePrecedent() }}</button>
            <button type="button" class="btn btn-outline" (click)="annuler.emit()">Annuler</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrl: './examen-synthese.scss',
})
export class ExamenSynthese {
  readonly groupes = input.required<GroupeRecap[]>();
  readonly nbObservations = input(0);
  /** Rappel de la consigne du dispatch (et des lignes visées, quand elles sont déterminables). */
  readonly consigne = input<string | null>(null);
  readonly mode = input<'create' | 'edit' | 'locked'>('create');
  readonly estReexamen = input(false);
  /** Synthèse et avis saisissables (création, ou projet de PV encore entre les mains du Membre). */
  readonly editable = input(false);
  readonly synthese = input('');
  readonly avis = input<string | null>(null);
  readonly avisLibelle = input<string | null>(null);
  readonly aviss = input<Avis[]>([]);
  readonly avisHint = input('');
  /** Ce qui se passe réellement ensuite (circuit existant). */
  readonly apres = input<string[]>([]);
  readonly formError = input<string | null>(null);
  readonly saving = input(false);
  readonly dispatchConnu = input(true);
  readonly libellePrecedent = input('Précédent');

  readonly modifier = output<ObservationNumerotee>();
  readonly syntheseChange = output<string>();
  readonly avisChange = output<string>();
  readonly soumettre = output<void>();
  readonly enregistrer = output<void>();
  readonly precedent = output<void>();
  readonly annuler = output<void>();

  readonly pluriel = pluriel;

  valeurDe(ev: Event): string {
    return (ev.target as HTMLTextAreaElement).value;
  }

  libelleModifier(o: ObservationNumerotee): string {
    return `Modifier l'observation ${o.numero} (${o.titre})`;
  }
}
