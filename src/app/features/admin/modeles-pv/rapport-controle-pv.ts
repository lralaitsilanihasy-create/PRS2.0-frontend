import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NiveauPointRapport, RapportModelePv } from '../../../models';

const ORDRE: Readonly<Record<NiveauPointRapport, number>> = { BLOQUANT: 0, AVERTISSEMENT: 1, OK: 2 };
const BADGE: Readonly<Record<NiveauPointRapport, string>> = { BLOQUANT: 'badge-danger', AVERTISSEMENT: 'badge-warning', OK: 'badge-success' };
const LIBELLE: Readonly<Record<NiveauPointRapport, string>> = { BLOQUANT: 'Bloquant', AVERTISSEMENT: 'Avertissement', OK: 'OK' };

/**
 * ⚠️ Générateur de modèles de PV, G1 (20/10, §B5) — le rapport de contrôle d'une version, les points bloquants d'abord. `ou`
 * situe le marqueur (« paragraphe n », « tableau t, ligne l… », « en-tête n ») : Word seul pagine, la page n'est pas donnée.
 */
@Component({
  selector: 'app-rapport-controle-pv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (rapport(); as r) {
      <div class="rcp">
        <p class="rcp__bilan" role="status">
          @if (r.bloquant) {
            <span class="badge badge-danger">{{ r.nbBloquants }} point(s) bloquant(s)</span>
            La version reste en brouillon : corrigez le Word et déposez-le de nouveau, ou complétez les conditions et les champs.
          } @else {
            <span class="badge badge-success">Aucun blocage</span>
            La version peut être essayée puis mise en vigueur.
          }
          @if (r.nbAvertissements) { <span class="badge badge-warning">{{ r.nbAvertissements }} avertissement(s)</span> }
        </p>
        <ul class="rcp__points">
          @for (p of points(); track $index) {
            <li>
              <span [class]="'badge ' + badge[p.niveau]">{{ libelle[p.niveau] }}</span>
              <span>
                {{ p.message }}
                @if (p.ou) { <span class="rcp__ou">— {{ p.ou }}</span> }
                @if (p.suggestion && !p.message.includes(p.suggestion)) { <span class="rcp__sugg">Vouliez-vous <code>{{ p.suggestion }}</code> ?</span> }
              </span>
            </li>
          }
        </ul>
        <p class="rcp__pied">
          {{ r.variables.length }} variable(s), {{ r.conditionsUtilisees.length }} bloc(s) conditionnel(s), {{ r.champsUtilises.length }} champ(s) saisi(s)
          relevés dans le Word@if (r.controleLe) { · contrôlé le {{ r.controleLe | date: 'dd/MM/yyyy à HH:mm' }} }.
        </p>
      </div>
    } @else {
      <p class="text-muted">Pas de rapport pour cette version.</p>
    }
  `,
  styles: `
    .rcp { display: flex; flex-direction: column; gap: 0.6rem; }
    .rcp__bilan { margin: 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; color: var(--n-700); }
    .rcp__points { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
    .rcp__points li { display: grid; grid-template-columns: 7.5rem 1fr; gap: 0.6rem; align-items: start; }
    .rcp__points .badge { justify-self: start; }
    .rcp__ou { color: var(--n-500); }
    .rcp__sugg { display: block; color: var(--n-700); font-size: 0.85rem; }
    .rcp__pied { margin: 0; font-size: 0.85rem; color: var(--n-500); }
    code { font-family: Consolas, monospace; font-size: 0.85em; }
  `,
})
export class RapportControlePv {
  readonly rapport = input<RapportModelePv | null>(null);

  readonly badge = BADGE;
  readonly libelle = LIBELLE;
  readonly points = computed(() => [...(this.rapport()?.points ?? [])].sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau]));
}
