import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { maintenantServeur } from '../../../core/horloge/heure-serveur';
import { Echeance, JalonReel, MarchePrevision } from '../../../models';
import { JalonLigne, datesIncoherentes, jalonsDeLigne } from './detail-ligne';

const isoJour = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Les jalons d'une ligne, datés au jour du serveur : la source commune du bouton du bandeau et de la fenêtre. */
export function jalonsDuJour(previsions: readonly MarchePrevision[], capms: ReadonlyMap<string, string>, echeances: readonly Echeance[], reels: readonly JalonReel[] | null): JalonLigne[] {
  return jalonsDeLigne(previsions, capms, echeances, isoJour(maintenantServeur()), reels);
}

/**
 * ⚠️ 04/11 (pilote) — les jalons d'une ligne du plan, affichés EN FENÊTRE depuis le bouton « Jalons » du bandeau de la ligne (ils ne
 * s'étalent plus dans le volet) : l'avancement (réalisés, non renseignés), puis TOUS les jalons, avec l'écart du réel au prévu et le
 * prochain jalon signalé. La fenêtre est rendue par l'écran du plan, hors du volet collant.
 */
@Component({
  selector: 'app-jalons-ligne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jl">
      @if (incoherence(); as i) { <p class="jl__alerte" role="note">{{ i }}</p> }
      @if (jalons().length) {
        <p class="jl__resume"><b>{{ realises() }}</b> réalisé{{ realises() > 1 ? 's' : '' }} sur <b>{{ jalons().length }}</b>
          @if (prochain(); as p) { · prochain : <b>{{ intituleCourt(p.processus) }}</b>, prévu le {{ p.prevu }} }</p>
        <div class="jl__barre" role="img" [attr.aria-label]="realises() + ' jalons réalisés, ' + nonRenseignes() + ' non renseignés, sur ' + jalons().length">
          <span class="jl__barre-fait" [style.width.%]="100 * realises() / jalons().length"></span>
          <span class="jl__barre-nr" [style.width.%]="100 * nonRenseignes() / jalons().length"></span>
        </div>
        <p class="jl__legende"><span class="jl__pt jl__pt--fait"></span>réalisés · <span class="jl__pt jl__pt--nr"></span>non renseignés (aucun fait ne les date) · le reste à venir</p>
        <table class="jl__table">
          <colgroup><col /><col class="jl__c-date" /><col class="jl__c-reel" /></colgroup>
          <thead><tr><th scope="col">Jalon</th><th scope="col">Prévu</th><th scope="col">Réel</th></tr></thead>
          <tbody>
            @for (j of jalons(); track $index) {
              <tr [class.jl__prochain]="j === prochain()">
                <td [attr.title]="j.processus">{{ intituleCourt(j.processus) }}</td><td class="jl__d">{{ j.prevu }}</td>
                <td class="jl__d">
                  @if (j.reel) {
                    <span class="jl__reel" [attr.title]="j.source">{{ j.reel }}</span>
                    @if (j.ecart) { <span class="jl__ecart" [class.jl__ecart--retard]="j.ecart > 0" [attr.title]="'Prévu le ' + j.prevu">{{ j.ecart > 0 ? '+' : '−' }}{{ abs(j.ecart) }} j</span> }
                  } @else if (j.sansFait) { <span class="jl__nr">non renseigné</span>
                  } @else if (j.retard) { <span class="jl__retard" title="Date réelle non renseignée">prévu dépassé de {{ j.retard }} j</span>
                  } @else if (j === prochain()) { <span class="jl__pastille">prochain</span>
                  } @else { <span class="jl__nr">à venir</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="jl__vide">Aucune date prévue au plan pour cette ligne.</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .jl { display: grid; gap: 0.6rem; font-size: 0.8125rem; }
    .jl__resume { margin: 0; }
    .jl__resume b { font-weight: 500; }
    .jl__alerte { margin: 0; padding: 0.35rem 0.5rem; border-radius: 5px; background: var(--retard-fond); color: var(--retard-texte); }
    .jl__barre { display: flex; height: 0.5rem; border-radius: 4px; overflow: hidden; background: var(--neutre-fond); }
    .jl__barre-fait { background: var(--favorable-texte); }
    .jl__barre-nr { background: var(--neutre-texte); }
    .jl__legende { margin: 0; font-size: 0.75rem; color: var(--texte-secondaire); }
    .jl__pt { display: inline-block; width: 0.55rem; height: 0.55rem; margin-right: 0.3rem; border-radius: 50%; }
    .jl__pt--fait { background: var(--favorable-texte); } .jl__pt--nr { background: var(--neutre-texte); }
    .jl__table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .jl__c-date { width: 7.5rem; }
    .jl__c-reel { width: 12rem; }
    .jl__table th, .jl__table td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--bordure); }
    .jl__table th { background: var(--tableau-entete); font-weight: 500; font-size: 0.72rem; }
    .jl__d { white-space: nowrap; }
    .jl__reel { font-weight: 500; }
    .jl__ecart { margin-left: 0.4rem; font-size: 0.72rem; font-weight: 500; color: var(--favorable-texte); }
    .jl__ecart--retard { color: var(--retard-texte); }
    .jl__prochain td { background: var(--examen-fond); font-weight: 500; }
    .jl__pastille { padding: 0 0.5rem; border-radius: 999px; background: var(--or); color: var(--texte); font-size: 0.72rem; font-weight: 500; }
    .jl__nr { color: var(--texte-secondaire); font-weight: 400; }
    .jl__retard { color: var(--retard-texte); font-weight: 500; }
    .jl__vide { margin: 0; color: var(--texte-secondaire); }
  `,
})
export class JalonsLigne {
  readonly previsions = input<readonly MarchePrevision[]>([]);
  readonly echeances = input<readonly Echeance[]>([]);
  readonly capms = input<ReadonlyMap<string, string>>(new Map());
  /** Dates réelles calculées par le serveur pour cette ligne ; `null` tant que la lecture n'a pas répondu (ou a échoué). */
  readonly reels = input<readonly JalonReel[] | null>(null);

  readonly jalons = computed(() => jalonsDuJour(this.previsions(), this.capms(), this.echeances(), this.reels()));
  readonly incoherence = computed(() => datesIncoherentes(this.previsions(), this.capms()));
  /** Le prochain jalon : le premier sans date réelle, hors ceux qu'aucun fait ne date. */
  readonly prochain = computed(() => this.jalons().find((j) => !j.reel && !j.sansFait) ?? null);
  readonly realises = computed(() => this.jalons().filter((j) => !!j.reel).length);
  readonly nonRenseignes = computed(() => this.jalons().filter((j) => j.sansFait).length);
  readonly abs = Math.abs;

  /** L'intitulé d'un processus jusqu'à son deux-points (« Détermination des besoins »), l'intitulé entier restant en infobulle. */
  intituleCourt(processus: string): string {
    const t = processus.split(':')[0].trim();
    return t.length > 70 ? t.slice(0, 68).trimEnd() + '…' : t;
  }
}
