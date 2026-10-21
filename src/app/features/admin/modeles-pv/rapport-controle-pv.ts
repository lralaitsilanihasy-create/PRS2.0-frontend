import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

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
            @if (page()) { La version reste en brouillon : complétez la page, ou les conditions et les champs, puis enregistrez. }
            @else { La version reste en brouillon : corrigez le Word et déposez-le de nouveau, ou complétez les conditions et les champs. }
          } @else {
            <span class="badge badge-success">Aucun blocage</span>
            La version peut être essayée puis mise en vigueur.
          }
          @if (r.nbAvertissements) { <span class="badge badge-warning">{{ r.nbAvertissements }} avertissement(s)</span> }
        </p>
        <ul class="rcp__points">
          @for (p of affiches(); track $index) {
            <li>
              <span [class]="'badge ' + badge[p.niveau]">{{ libelle[p.niveau] }}</span>
              <span>
                {{ p.message }}
                @if (p.ou) { <span class="rcp__ou">— {{ p.ou }}</span> }
                @if (p.chemin && p.niveau !== 'OK') { <button type="button" class="rcp__aller" (click)="aller.emit(p.chemin)">Aller à l’endroit</button> }
                @if (page() && p.code === 'SECTION_ABSENTE' && manquante(p.message); as code) {
                  <button type="button" class="rcp__aller" (click)="inserer.emit(code)">Insérer dans la page</button>
                }
                @if (declarable() && (p.code === 'CONDITION_NON_DECLAREE' || p.code === 'CHAMP_NON_DECLARE')) {
                  <button type="button" class="rcp__aller" (click)="declarer.emit()">Déclarer</button>
                }
                @if (p.suggestion && !p.message.includes(p.suggestion)) { <span class="rcp__sugg">Vouliez-vous <code>{{ p.suggestion }}</code> ?</span> }
              </span>
            </li>
          }
        </ul>
        @if (reussis().length) {
          <p class="rcp__reussis">
            <span class="badge badge-success">OK</span>
            {{ reussis().length }} contrôle(s) réussi(s)
            <button type="button" class="rcp__aller" (click)="voirReussis.set(!voirReussis())">{{ voirReussis() ? 'masquer' : 'voir' }}</button>
          </p>
        }
        @if (r.controleLe) { <p class="rcp__pied">Contrôlé le {{ r.controleLe | date: 'dd/MM/yyyy à HH:mm' }}.</p> }
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
    .rcp__aller { border: 0; background: none; padding: 0 0 0 6px; color: var(--p-700); text-decoration: underline; cursor: pointer; font: inherit; font-size: 0.85em; }
    .rcp__sugg { display: block; color: var(--n-700); font-size: 0.85rem; }
    .rcp__reussis { margin: 0; display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; color: var(--n-700); }
    .rcp__pied { margin: 0; font-size: 0.85rem; color: var(--n-500); }
    code { font-family: Consolas, monospace; font-size: 0.85em; }
  `,
})
export class RapportControlePv {
  readonly rapport = input<RapportModelePv | null>(null);
  /** Le chemin du nœud fautif (page), pour que l'éditeur y amène le curseur. */
  readonly aller = output<string>();
  /** Une version page : les messages parlent de la page, et une section absente s'insère d'un clic. */
  readonly page = input(false);
  /** Le code de la variable à insérer pour combler une section absente (`PV.REFERENCE`, `PV.MEMBRE`, `PV.AVIS`). */
  readonly inserer = output<string>();
  /** Une version modifiable : une condition ou un champ non déclaré se déclare d'un clic (règle usuelle, champ en texte long). */
  readonly declarable = input(false);
  readonly declarer = output<void>();

  /** La variable que nomme un point « section absente » (« … : {{PV.REFERENCE}} n'apparaît pas ») ; nul s'il n'en nomme pas. */
  manquante(message: string): string | null {
    return /\{\{([A-Z_]+\.[A-Z_]+)\}\}/.exec(message)?.[1] ?? null;
  }

  readonly badge = BADGE;
  readonly libelle = LIBELLE;
  readonly voirReussis = signal(false);
  readonly reussis = computed(() => (this.rapport()?.points ?? []).filter((p) => p.niveau === 'OK'));
  /** Les points à traiter d'abord ; les contrôles réussis seulement sur demande. */
  readonly affiches = computed(() => this.points().filter((p) => p.niveau !== 'OK' || this.voirReussis()));
  readonly points = computed(() => [...(this.rapport()?.points ?? [])].sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau]));
}
