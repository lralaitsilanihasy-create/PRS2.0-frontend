import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { DocumentVisionneuse } from '../ui/document-visionneuse';
import {
  AUCUN_NUMERO,
  ListeFichePresentation,
  ObservationLigneFiche,
  grouperNumeros,
  libelleObservations,
  montantOfficiel,
} from './document-officiel';
import { FichePresentation } from './fiche-presentation';

/**
 * « Fiche de présentation » — rendu UNIQUE du document dérivé (3 listes + justification globale),
 * partagé entre l'onglet du détail PPM, la consultation et l'écran d'examen (⚠️ demande pilote
 * 2026-09-02 : la fiche entre dans l'examen avec sa propre grille — même document sous les yeux du
 * Membre). Les données arrivent CALCULÉES (`calculerFichePresentation`) : le composant n'appelle rien.
 *
 * ⚠️ 2026-09-14 (décision des chefs, refonte ergonomique lot 1) — présentée comme la feuille
 * officielle (bordures noires, en-têtes gris clair, Arial) : à envelopper dans
 * `<app-document-visionneuse>`. La mention d'origine des listes et les observations par ligne sont
 * des annotations, masquables.
 */
@Component({
  selector: 'app-fiche-presentation-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <div class="doc-document" [class.doc-gouttiere-g]="avecMarqueurs()" [class.doc-annotations-masquees]="!annot()">
      <h3 class="doc-titre">FICHE DE PRESENTATION</h3>
      <p class="doc-paragraphe"><u>Nature du dossier</u> :
        <strong>Projet de Plan de passation des marchés de l'année {{ exercice() ?? '____' }}, {{ libelleVersion() }}</strong>
      </p>
      @if (annot()) {
        <p class="doc-annot doc-note">
          Listes établies depuis les marchés du plan — même forme que la fiche de présentation jointe au dépôt.
        </p>
      }

      <h4 class="doc-sous-titre">1. Liste des marchés à passer par mode dérogatoire avec justifications</h4>
      @if (fiche().derogatoires.length) {
        <table class="doc-table doc-table--fiche">
          <colgroup><col style="width: 34%" /><col style="width: 14%" /><col style="width: 18%" /><col style="width: 34%" /></colgroup>
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Justification</th></tr></thead>
          <tbody>
            @for (l of fiche().derogatoires; track l.idDetail) {
              <tr>
                <td class="doc-ancre-g">
                  <ng-container [ngTemplateOutlet]="marqueur" [ngTemplateOutletContext]="{ $implicit: observationsDe(l.idDetail, 'derogatoires') }" />
                  <span class="doc-objet">{{ l.objet }}</span>
                </td>
                <td class="doc-num">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>@if (l.justifModeDerogatoire) { {{ l.justifModeDerogatoire }} } @else { <span class="doc-a-completer">À compléter</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="doc-paragraphe">Aucun marché à passer par mode dérogatoire.</p>
      }

      <h4 class="doc-sous-titre">2. Liste des marchés à délais aménagés avec justifications</h4>
      @if (fiche().delaisAmenages.length) {
        <table class="doc-table doc-table--fiche">
          <colgroup><col style="width: 28%" /><col style="width: 13%" /><col style="width: 16%" /><col style="width: 15%" /><col style="width: 28%" /></colgroup>
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th><th scope="col">Justifications</th></tr></thead>
          <tbody>
            @for (l of fiche().delaisAmenages; track l.idDetail) {
              <tr>
                <td class="doc-ancre-g">
                  <ng-container [ngTemplateOutlet]="marqueur" [ngTemplateOutletContext]="{ $implicit: observationsDe(l.idDetail, 'delaisAmenages') }" />
                  <span class="doc-objet">{{ l.objet }}</span>
                </td>
                <td class="doc-num">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>{{ l.delaiJours }} jours @if (annot()) { <span class="doc-annot doc-note-en-ligne">(minimum du mode : {{ l.delaiMinJours }})</span> }</td>
                <td>@if (l.justifDelaiAmenage) { {{ l.justifDelaiAmenage }} } @else { <span class="doc-a-completer">À compléter</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="doc-paragraphe">Aucun marché à délais aménagés.</p>
      }

      <h4 class="doc-sous-titre">3. Liste des contrats-cadres</h4>
      @if (fiche().contratsCadres.length) {
        <table class="doc-table doc-table--fiche">
          <colgroup><col style="width: 40%" /><col style="width: 18%" /><col style="width: 22%" /><col style="width: 20%" /></colgroup>
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th></tr></thead>
          <tbody>
            @for (l of fiche().contratsCadres; track l.idDetail) {
              <tr>
                <td class="doc-ancre-g">
                  <ng-container [ngTemplateOutlet]="marqueur" [ngTemplateOutletContext]="{ $implicit: observationsDe(l.idDetail, 'contratsCadres') }" />
                  <span class="doc-objet">{{ l.objet }}</span>
                </td>
                <td class="doc-num">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>@if (l.delaiJours != null) { {{ l.delaiJours }} jours } @else { — }</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="doc-paragraphe">Aucun contrat-cadre.</p>
      }

      @if (fiche().nbMarchesConcernes > 0 || justificationFiche() || motifMaj()) {
        <p class="doc-paragraphe doc-justif"><u>Justification :</u>&ngsp;
          @if (justificationFiche()) { {{ justificationFiche() }} } @else { <span class="doc-a-completer">À compléter</span> }
          @if (motifMaj()) { — <strong>Motif de la mise à jour :</strong> {{ motifMaj() }} }
        </p>
      }
    </div>

    <!-- Marqueur d'observation de ligne (annotation) : forme « ! » dans la marge + pastille(s). -->
    <ng-template #marqueur let-numeros>
      @if (numeros.length) {
        <span class="doc-annot doc-marqueur doc-marqueur--obs" role="img" [attr.aria-label]="libelleObs(numeros)" [attr.title]="libelleObs(numeros)">
          <span class="doc-pastilles" aria-hidden="true">
            @for (n of numeros; track n) { <span class="doc-pastille">{{ n }}</span> }
          </span>
        </span>
      }
    </ng-template>
  `,
  // ⚠️ 2026-09-14 (décision des chefs) — plus d'en-têtes VERTS (demande pilote du 06/09, qui
  // remplaçait l'orange du 02/09) ni de tableau « cnm-table » : la fiche reprend la feuille
  // officielle commune (styles/_document-officiel.scss), en-têtes gris clair et bordures noires.
  styles: `
    .doc-justif { margin-top: 0.9rem; }
  `,
})
export class FichePresentationDoc {
  /** Les trois listes, DÉJÀ calculées (fonction pure partagée). */
  readonly fiche = input.required<FichePresentation>();
  readonly exercice = input<number | null | undefined>(null);
  /** « Initial » ou « Mise à jour n° N ». */
  readonly libelleVersion = input('Initial');
  /** Justification globale saisie à la création (bas des listes). */
  readonly justificationFiche = input<string | null | undefined>(null);
  /** Motif de la mise à jour (versions numMaj > 0), ajouté à la justification. */
  readonly motifMaj = input<string | null | undefined>(null);
  /** Annotations visibles (défaut). `false` = le document seul. */
  readonly annotations = input(true);
  /**
   * Observations par ligne (marqueur de marge + pastille). `liste` absente = la ligne dans toutes
   * les listes où figure le marché. Aucun écran ne les fournit encore (examen, lot suivant).
   */
  readonly observations = input<readonly ObservationLigneFiche[]>([]);

  private readonly visionneuse = inject(DocumentVisionneuse, { optional: true });
  /** Annotations effectivement visibles : l'entrée ET l'interrupteur de la visionneuse englobante. */
  readonly annot = computed(() => this.annotations() && (this.visionneuse?.annotations() ?? true));
  readonly avecMarqueurs = computed(() => this.annot() && this.observations().length > 0);

  private readonly parLigne = computed(() =>
    grouperNumeros(this.observations(), (o) => `${o.liste ?? '*'}|${o.idDetail}`, (o) => o.numero),
  );

  /** Numéros des observations d'une ligne d'une liste (celles de la liste + celles sans liste). */
  observationsDe(idDetail: number, liste: ListeFichePresentation): readonly number[] {
    if (!this.annot()) return AUCUN_NUMERO;
    const index = this.parLigne();
    const propres = index.get(`${liste}|${idDetail}`) ?? AUCUN_NUMERO;
    const communes = index.get(`*|${idDetail}`) ?? AUCUN_NUMERO;
    if (!communes.length) return propres;
    if (!propres.length) return communes;
    return [...new Set([...propres, ...communes])].sort((a, b) => a - b);
  }

  libelleObs(numeros: readonly number[]): string {
    return libelleObservations(numeros);
  }

  /** Montant au format du document officiel (« — » si absent) — même rendu que le plan de passation. */
  montantFr(v?: number): string {
    return v == null ? '—' : montantOfficiel(v);
  }
}
