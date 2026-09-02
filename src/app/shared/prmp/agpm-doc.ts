import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LigneAgpm } from './agpm';

/**
 * « Projet d'AGPM » — rendu UNIQUE du document dérivé (en-tête officiel + tableau des marchés en
 * mode déclencheur d'AGPM), partagé entre l'onglet du détail PPM et l'écran d'examen (⚠️ demande
 * pilote 2026-09-02 : l'AGPM entre dans l'examen avec sa propre grille). Les lignes arrivent
 * CALCULÉES (`calculerAgpm`) : le composant n'appelle rien.
 */
@Component({
  selector: 'app-agpm-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="agd-titre">AVIS GENERAL DE PASSATION DES MARCHES POUR L'ANNEE {{ exercice() ?? '____' }}</h3>
    <div class="agd-entete">
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
      <div class="table-responsive">
        <table class="cnm-table">
          <thead><tr><th scope="col">Compte</th><th scope="col">Nature</th><th scope="col">Objet</th><th scope="col">Montant estimatif du marché</th><th scope="col">Financement</th><th scope="col">Mode de passation</th><th scope="col">Date du DAO</th></tr></thead>
          <tbody>
            @for (l of lignes(); track l.idDetail) {
              <tr>
                <td class="cnm-mono">{{ l.compte || '—' }}</td>
                <td>{{ l.nature || '—' }}</td>
                <td>{{ l.objet }}</td>
                <td class="cnm-mono">{{ montantFr(l.montant) }}</td>
                <td>{{ l.financement || '—' }}</td>
                <td>{{ l.modeLibelle }}</td>
                <td class="cnm-mono">{{ dateCourt(l.dateDao) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="agd-note cnm-muted">Date du DAO = date prévisionnelle de lancement du marché.</p>
    } @else {
      <p class="cnm-muted">Aucun marché en mode déclencheur d'AGPM — l'avis est sans objet pour ce plan.</p>
    }
  `,
  styles: `
    .agd-titre { margin: 0 0 10px; font-size: var(--text-md); font-weight: 700; color: var(--n-800); text-align: center; }
    .agd-entete { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 12px; }
    .agd-entete p { margin: 0 0 4px; }
    .agd-note { margin: 8px 0 0; font-size: var(--text-sm); }
    /* Textes longs à la ligne, jamais de défilement horizontal (demande pilote 02/09) : le td
       global du design system est en nowrap, la bande bleue vient de thead tr — neutralisés ici. */
    .table-responsive { overflow-x: visible; }
    .table-responsive table { min-width: 0; }
    th { white-space: normal; }
    td { white-space: normal; overflow-wrap: break-word; vertical-align: top; }
    td.cnm-mono { white-space: nowrap; }
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

  montantFr(v?: number): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(v);
  }
  /** Date `yyyy-MM-dd` → `dd/MM/yyyy` (« — » si absente) — format des documents officiels. */
  dateCourt(iso?: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
