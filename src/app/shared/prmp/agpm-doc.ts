import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { DocumentVisionneuse } from '../ui/document-visionneuse';
import {
  AUCUN_NUMERO,
  COLONNES_AGPM_CIBLE,
  CelluleCliquee,
  ObservationLigne,
  grouperNumeros,
  libelleObservations,
  montantOfficiel,
} from './document-officiel';
import { LigneAgpm } from './agpm';

/**
 * « Projet d'AGPM » — rendu UNIQUE du document dérivé (en-tête officiel + tableau des marchés en
 * mode déclencheur d'AGPM), partagé entre l'onglet du détail PPM, la consultation et l'écran
 * d'examen (⚠️ demande pilote 2026-09-02 : l'AGPM entre dans l'examen avec sa propre grille). Les
 * lignes arrivent CALCULÉES (`calculerAgpm`) : le composant n'appelle rien.
 *
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — présenté comme la feuille
 * officielle (bordures noires, en-têtes gris clair, intitulés du modèle officiel) : à envelopper
 * dans `<app-document-visionneuse>`. La note sur la date du DAO et les observations par ligne sont
 * des annotations, masquables.
 */
@Component({
  selector: 'app-agpm-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="doc-document" [class.doc-gouttiere-g]="avecMarqueurs()" [class.doc-annotations-masquees]="!annot()">
      <h3 class="doc-titre">AVIS GENERAL DE PASSATION DES MARCHES POUR L'ANNEE {{ exercice() ?? '____' }}</h3>
      <div class="doc-entete">
        <div>
          <p><u>Autorité Contractante</u> : <strong>{{ entite() || '—' }}</strong></p>
          <p><u>Nom de la PRMP</u> : <strong>{{ signataire() || '—' }}</strong></p>
        </div>
        <div>
          <p><u>Date d'établissement du Document initial</u> : {{ dateCourt(dateInitiale()) }}</p>
          <p><u>Numéro et date de la dernière mise à jour</u> : {{ numMajPrec() ?? 0 }}@if (dateMajPrec()) { - {{ dateCourt(dateMajPrec()) }} }</p>
          <p><u>Numéro de la présente mise à jour</u> : {{ numMaj() ?? 0 }}</p>
        </div>
      </div>
      @if (lignes().length) {
        <!-- Intitulés du modèle officiel (mêmes que l'aperçu de la saisie). -->
        <table class="doc-table doc-table--agpm">
          <colgroup>
            <col style="width: 9%" /><col style="width: 12%" /><col style="width: 31%" /><col style="width: 14%" />
            <col style="width: 10%" /><col style="width: 14%" /><col style="width: 10%" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">COMPTE</th><th scope="col">NATURE</th><th scope="col">OBJET</th><th scope="col">MONTANT ESTIMATIF du MARCHE</th>
              <th scope="col">FINANCEMENT</th><th scope="col">MODE DE PASSATION</th><th scope="col">DATE du DAO</th>
            </tr>
          </thead>
          <tbody [class.doc-corps--observable]="observable()">
            @for (l of lignes(); track l.idDetail) {
              @let obs = observationsDe(l.idDetail);
              <tr>
                <td class="doc-ancre-g" (click)="cliquer($event, l, 'compte')">
                  @if (obs.length) {
                    <span class="doc-annot doc-marqueur doc-marqueur--obs" role="img" [attr.aria-label]="libelleObs(obs)" [attr.title]="libelleObs(obs)">
                      <span class="doc-pastilles" aria-hidden="true">
                        @for (n of obs; track n) { <span class="doc-pastille">{{ n }}</span> }
                      </span>
                    </span>
                  }
                  {{ l.compte || '—' }}
                </td>
                <td (click)="cliquer($event, l, 'nature')">{{ l.nature || '—' }}</td>
                <td class="doc-objet" (click)="cliquer($event, l, 'objet')">{{ l.objet }}</td>
                <td class="doc-num" (click)="cliquer($event, l, 'montEstim')">{{ montantFr(l.montant) }}</td>
                <td (click)="cliquer($event, l, 'financement')">{{ l.financement || '—' }}</td>
                <td (click)="cliquer($event, l, 'mode')">{{ l.modeLibelle }}</td>
                <td class="doc-date" (click)="cliquer($event, l, 'dateDao')">{{ dateCourt(l.dateDao) }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (annot()) {
          <p class="doc-annot doc-note doc-note--apres">Date du DAO = date prévisionnelle de lancement du marché.</p>
        }
      } @else {
        <p class="doc-paragraphe">Aucun marché en mode déclencheur d'AGPM — l'avis est sans objet pour ce plan.</p>
      }
    </div>
  `,
  // ⚠️ 2026-09-14 (décision des chefs) — plus d'en-tête ORANGE « à la couleur de l'onglet » (demande
  // pilote du 02/09) ni de tableau « cnm-table » : l'avis reprend la feuille officielle commune
  // (styles/_document-officiel.scss), en-têtes gris clair et bordures noires.
  styles: `
    .doc-note--apres { margin: 0.5rem 0 0; }
  `,
})
export class AgpmDoc {
  /** Lignes du projet d'AGPM, DÉJÀ calculées (fonction pure partagée). */
  readonly lignes = input.required<LigneAgpm[]>();
  readonly exercice = input<number | null | undefined>(null);
  readonly entite = input<string | null | undefined>(null);
  readonly signataire = input<string | null | undefined>(null);
  /** Date d'établissement du document initial (datePpmInit, sinon dateSignature). */
  readonly dateInitiale = input<string | null | undefined>(null);
  readonly numMajPrec = input<number | null | undefined>(null);
  readonly dateMajPrec = input<string | null | undefined>(null);
  readonly numMaj = input<number | null | undefined>(null);
  /** Annotations visibles (défaut). `false` = le document seul. */
  readonly annotations = input(true);
  /** Observations par ligne (marqueur de marge + pastille) — fournies par l'examen (codes `agpm.`, refonte lot 2). */
  readonly observations = input<readonly ObservationLigne[]>([]);
  /** Cellules proposant « Observer cette cellule » (survol + clic émis) — l'examen, étape de l'AGPM. */
  readonly observable = input(false);
  /** Clic sur une cellule, émis seulement si `observable` : code `agpm.…`, valeur affichée. */
  readonly celluleClick = output<CelluleCliquee>();

  private readonly visionneuse = inject(DocumentVisionneuse, { optional: true });
  /** Annotations effectivement visibles : l'entrée ET l'interrupteur de la visionneuse englobante. */
  readonly annot = computed(() => this.annotations() && (this.visionneuse?.annotations() ?? true));
  readonly avecMarqueurs = computed(() => this.annot() && this.observations().length > 0);
  private readonly parLigne = computed(() => grouperNumeros(this.observations(), (o) => o.idDetail, (o) => o.numero));

  /** Numéros des observations d'une ligne (tableau partagé vide si aucune ou annotations masquées). */
  observationsDe(idDetail: number): readonly number[] {
    if (!this.annot()) return AUCUN_NUMERO;
    return this.parLigne().get(idDetail) ?? AUCUN_NUMERO;
  }

  libelleObs(numeros: readonly number[]): string {
    return libelleObservations(numeros);
  }

  cliquer(ev: MouseEvent, l: LigneAgpm, colonne: (typeof COLONNES_AGPM_CIBLE)[number]): void {
    if (!this.observable()) return;
    const valeurs: Record<(typeof COLONNES_AGPM_CIBLE)[number], string> = {
      compte: l.compte ?? '',
      nature: l.nature ?? '',
      objet: l.objet,
      montEstim: l.montant == null ? '' : montantOfficiel(l.montant),
      financement: l.financement ?? '',
      mode: l.modeLibelle,
      dateDao: l.dateDao ? this.dateCourt(l.dateDao) : '',
    };
    this.celluleClick.emit({ idDetail: l.idDetail, champ: `agpm.${colonne}`, idBenef: null, valeur: valeurs[colonne], element: ev.currentTarget as HTMLElement });
  }

  /** Montant au format du document officiel (« — » si absent) — même rendu que le plan de passation. */
  montantFr(v?: number): string {
    return v == null ? '—' : montantOfficiel(v);
  }
  /** Date `yyyy-MM-dd` → `dd/MM/yyyy` (« — » si absente) — format des documents officiels. */
  dateCourt(iso?: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
