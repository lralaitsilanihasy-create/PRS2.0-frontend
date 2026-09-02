import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FichePresentation } from './fiche-presentation';

/**
 * « Fiche de présentation » — rendu UNIQUE du document dérivé (3 listes + justification globale),
 * partagé entre l'onglet du détail PPM et l'écran d'examen (⚠️ demande pilote 2026-09-02 : la fiche
 * entre dans l'examen avec sa propre grille — même document sous les yeux du Membre).
 * Les données arrivent CALCULÉES (`calculerFichePresentation`) : le composant n'appelle rien.
 */
@Component({
  selector: 'app-fiche-presentation-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="fpd-nature"><u>Nature du dossier</u> :
      <strong>Projet de Plan de passation des marchés de l'année {{ exercice() ?? '____' }}, {{ libelleVersion() }}</strong>
    </p>
    <p class="fpd-note cnm-muted">
      Listes établies depuis les marchés du plan — même forme que la fiche de présentation jointe au dépôt.
    </p>

    <h3 class="fpd-titre">1. Liste des marchés à passer par mode dérogatoire avec justifications</h3>
    @if (fiche().derogatoires.length) {
      <div class="table-responsive">
        <table class="cnm-table">
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Justification</th></tr></thead>
          <tbody>
            @for (l of fiche().derogatoires; track l.idDetail) {
              <tr>
                <td>{{ l.objet }}</td>
                <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>@if (l.justifModeDerogatoire) { {{ l.justifModeDerogatoire }} } @else { <span class="cnm-muted">À compléter</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="cnm-muted">Aucun marché à passer par mode dérogatoire.</p>
    }

    <h3 class="fpd-titre">2. Liste des marchés à délais aménagés avec justifications</h3>
    @if (fiche().delaisAmenages.length) {
      <div class="table-responsive">
        <table class="cnm-table">
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th><th scope="col">Justifications</th></tr></thead>
          <tbody>
            @for (l of fiche().delaisAmenages; track l.idDetail) {
              <tr>
                <td>{{ l.objet }}</td>
                <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>{{ l.delaiJours }} jours <span class="cnm-muted">(minimum du mode : {{ l.delaiMinJours }})</span></td>
                <td>@if (l.justifDelaiAmenage) { {{ l.justifDelaiAmenage }} } @else { <span class="cnm-muted">À compléter</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="cnm-muted">Aucun marché à délais aménagés.</p>
    }

    <h3 class="fpd-titre">3. Liste des contrats-cadres</h3>
    @if (fiche().contratsCadres.length) {
      <div class="table-responsive">
        <table class="cnm-table">
          <thead><tr><th scope="col">Objet du marché</th><th scope="col">Montant estimatif</th><th scope="col">Mode de passation</th><th scope="col">Délai de remise des offres</th></tr></thead>
          <tbody>
            @for (l of fiche().contratsCadres; track l.idDetail) {
              <tr>
                <td>{{ l.objet }}</td>
                <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td>@if (l.delaiJours != null) { {{ l.delaiJours }} jours } @else { — }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="cnm-muted">Aucun contrat-cadre.</p>
    }

    @if (fiche().nbMarchesConcernes > 0 || justificationFiche() || motifMaj()) {
      <p class="fpd-justif"><u>Justification :</u>
        @if (justificationFiche()) { {{ justificationFiche() }} } @else { <span class="cnm-muted">À compléter</span> }
        @if (motifMaj()) { — <strong>Motif de la mise à jour :</strong> {{ motifMaj() }} }
      </p>
    }
  `,
  styles: `
    .fpd-nature { margin: 0 0 10px; }
    .fpd-note { margin: 0 0 12px; font-size: var(--text-sm); }
    .fpd-titre { margin: 18px 0 8px; font-size: var(--text-md); font-weight: 700; color: var(--n-800); }
    .fpd-titre:first-of-type { margin-top: 0; }
    .fpd-justif { margin-top: 14px; }
    /* Textes longs à la ligne, jamais de défilement horizontal (demande pilote 02/09) : le td
       global du design system est en nowrap, la bande bleue vient de thead tr — neutralisés ici. */
    .table-responsive { overflow-x: visible; }
    .table-responsive table { min-width: 0; }
    th { white-space: normal; }
    td { white-space: normal; overflow-wrap: break-word; vertical-align: top; }
    td.cnm-mono { white-space: nowrap; }
    /* ⚠️ Demande pilote (02/09) — en-tête des tableaux À LA COULEUR DE L'ONGLET (orange des
       onglets de dossier, #C2410C), texte blanc. */
    .cnm-table thead th { background: #C2410C; color: #fff; }
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

  /** Montant au format français (« — » si absent) — même rendu que la table des marchés. */
  montantFr(v?: number): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(v);
  }
}
