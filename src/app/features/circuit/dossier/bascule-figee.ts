import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { horodatage } from '../../../shared/prmp/avis-specifique-modele';
import { bilanEcarts } from './bilan-ecarts';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierInstantanes, libelleEcranInstantane } from './dossier-instantanes';

/**
 * ⚠️ 01/11 (pilote, maquette « fusion des écrans figés », cas 2) — une carte du dossier qui a des écrans figés porte en tête un
 * sélecteur : « État actuel » (le contenu projeté, lu en direct) ou « À la soumission n° k » (l'instantané immuable du serveur, avec
 * son bandeau). Sans écran figé pour cette carte, le contenu s'affiche seul, sans sélecteur.
 *
 * Le contenu vivant reste monté pendant la lecture de l'instantané (masqué) : il ne se recharge pas au retour. Au retour, un
 * redimensionnement est signalé pour que les vues « sans défilement » recalculent leur réduction.
 *
 * ⚠️ 01/11 (« ecarts-ecrans-figes », §B1) — à côté du sélecteur, la comparaison servie par le serveur entre la soumission (choisie, à
 * défaut la plus récente) et l'état actuel : « ✓ identique », « n écart(s) » qui déplie la liste (valeur soumise → valeur actuelle),
 * ou « non comparable » quand l'écran ne se recalcule pas pour ce profil. Sans réponse, rien n'est affiché.
 */
@Component({
  selector: 'app-bascule-figee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DossierInstantanes],
  template: `
    @if (soumissions().length) {
      <div class="bf__barre">
        <div class="bf__seg" role="group" aria-label="Moment affiché">
          <button type="button" [attr.aria-pressed]="choix() === null" (click)="choisir(null)">État actuel</button>
          @for (n of soumissions(); track n) {
            <button type="button" [attr.aria-pressed]="choix() === n" (click)="choisir(n)">
              <span aria-hidden="true">🔒</span> À la soumission n° {{ n }}<span class="bf__date"> · {{ horodatage(figeLe(n)) }}</span>
            </button>
          }
        </div>
        @switch (bilan().etat) {
          @case ('identique') {
            <span class="bf__etat bf__etat--ok"><span aria-hidden="true">✓</span> identique à la soumission n° {{ comparee() }}@if (bilan().nonComparables.length) {<span class="bf__etat-note"> · {{ libellesNonComparables() }} : non comparable</span>}</span>
          }
          @case ('non-comparable') {
            <span class="bf__etat" title="Cet écran ne se recalcule pas pour votre profil : seul ce qui a été soumis peut être lu.">Non comparable avec la soumission n° {{ comparee() }}</span>
          }
          @case ('ecarts') {
            <button type="button" class="bf__etat bf__etat--ecart" [attr.aria-expanded]="deplie()" aria-controls="bf-ecarts" (click)="deplie.set(!deplie())">
              <span aria-hidden="true">≠</span> {{ bilan().lignes.length }}{{ bilan().tronque ? '+' : '' }} écart{{ bilan().lignes.length > 1 ? 's' : '' }} avec la soumission n° {{ comparee() }}
              <span aria-hidden="true">{{ deplie() ? '▴' : '▾' }}</span></button>
          }
        }
      </div>
      @if (bilan().etat === 'ecarts' && deplie()) {
        <div class="bf__ecarts" id="bf-ecarts">
          <table>
            <caption class="bf__legende">Écarts entre la soumission n° {{ comparee() }} et l'état actuel</caption>
            <colgroup><col style="width: 32%" /><col style="width: 28%" /><col style="width: 40%" /></colgroup>
            <thead><tr><th scope="col">Élément</th><th scope="col">À la soumission</th><th scope="col">Aujourd'hui</th></tr></thead>
            <tbody>
              @for (l of bilan().lignes; track l.ecran + l.chemin) {
                <tr>
                  <th scope="row">@if (ecrans().length > 1) {<span class="bf__ecran">{{ libelleEcran(l.ecran) }} · </span>}{{ l.libelle }}</th>
                  <td>{{ l.soumis ?? '—' }}</td>
                  <td class="bf__actuel">{{ l.actuel ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (bilan().tronque || choix() === null) {
            <p class="bf__ecarts-pied">
              @if (bilan().tronque) { <span>Liste limitée à 50 écarts par écran ; l'écran figé fait foi.</span> }
              @if (choix() === null) { <button type="button" class="btn btn-sm btn-outline" (click)="choisir(comparee())">Voir ce qui a été soumis</button> }
            </p>
          }
        </div>
      }
      @if (choix(); as n) {
        <p class="bf__bandeau" role="status"><span aria-hidden="true">🔒</span>
          <span>Figé à la soumission n° {{ n }} le {{ horodatage(figeLe(n)) }}{{ figePar(n) ? ' par ' + figePar(n) : '' }} — immuable, en lecture seule.</span></p>
        <app-dossier-instantanes [ecransRetenus]="ecrans()" [soumissionImposee]="n" [integre]="true" />
      }
    }
    <div [hidden]="choix() !== null"><ng-content /></div>
  `,
  styles: `
    :host { display: block; }
    .bf__barre { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 10px; }
    .bf__seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    .bf__seg button { font: inherit; font-size: 0.84rem; padding: 5px 12px; border: 0; border-left: 1px solid var(--bordure); background: var(--carte-fond);
      color: var(--texte-secondaire); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .bf__seg button:first-child { border-left: 0; }
    .bf__seg button[aria-pressed="true"] { background: var(--section-fond); color: var(--texte-menu); font-weight: 500; }
    .bf__seg button:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .bf__date { font-weight: 400; }
    .bf__etat { display: inline-flex; gap: 6px; align-items: center; padding: 3px 10px; border-radius: 10px; font: inherit; font-size: 0.8rem; font-weight: 500;
      background: var(--neutre-fond); color: var(--neutre-texte); border: 0; }
    .bf__etat--ok { background: var(--favorable-fond); color: var(--favorable-texte); }
    .bf__etat--ecart { background: var(--examen-fond); color: var(--examen-texte); cursor: pointer; }
    .bf__etat--ecart:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .bf__etat-note { font-weight: 400; }
    .bf__ecarts { margin: 0 0 12px; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    /* Disposition fixe : un résumé long (200 caractères) passe à la ligne au lieu d'élargir le tableau. */
    .bf__ecarts table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.82rem; font-variant-numeric: tabular-nums; }
    .bf__legende { caption-side: top; text-align: left; padding: 6px 10px; font-size: 0.8rem; font-weight: 500; color: var(--texte); }
    .bf__ecarts th, .bf__ecarts td { padding: 5px 10px; text-align: left; vertical-align: top; border-top: 1px solid var(--bordure); white-space: normal; overflow-wrap: anywhere; }
    .bf__ecarts thead th { background: var(--tableau-entete); font-weight: 500; }
    .bf__ecarts tbody th { font-weight: 400; }
    .bf__ecran { color: var(--texte-secondaire); }
    .bf__actuel { font-weight: 500; }
    .bf__ecarts-pied { margin: 0; padding: 6px 10px; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between;
      border-top: 1px solid var(--bordure); font-size: 0.8rem; color: var(--texte-secondaire); }
    .bf__bandeau { margin: 0 0 12px; display: flex; gap: 8px; align-items: center; padding: 7px 12px; border-radius: 4px; background: var(--neutre-fond);
      color: var(--neutre-texte); font-size: 0.82rem; }
  `,
})
export class BasculeFigee {
  private readonly contenu = inject(DossierContenuStore);

  /** Les écrans figés que montre la carte (`ecransFiges` de la liste des éléments). */
  readonly ecrans = input<readonly string[]>([]);

  readonly horodatage = horodatage;
  /** `null` : l'état actuel ; sinon le numéro de soumission affiché. */
  readonly choix = signal<number | null>(null);

  private readonly instantanes = computed(() => {
    const e = this.ecrans();
    return e.length ? this.contenu.instantanes().filter((i) => e.includes(i.ecran)) : [];
  });
  /** Les soumissions qui ont figé au moins un écran de la carte, la plus récente d'abord. */
  readonly soumissions = computed(() => [...new Set(this.instantanes().map((i) => i.numeroSoumission))].sort((a, b) => b - a));

  readonly deplie = signal(false);
  /** La soumission comparée à l'état actuel : celle qui est affichée, à défaut la plus récente de la carte. */
  readonly comparee = computed(() => this.choix() ?? this.soumissions()[0] ?? 0);
  readonly bilan = computed(() => bilanEcarts(this.contenu.ecarts().get(this.comparee()) ?? null, this.ecrans()));
  readonly libellesNonComparables = computed(() => this.bilan().nonComparables.map(libelleEcranInstantane).join(', '));
  readonly libelleEcran = libelleEcranInstantane;

  constructor() {
    // La dernière soumission est lue dans la vague ; une plus ancienne, à son premier affichage.
    effect(() => {
      const n = this.comparee();
      if (n) untracked(() => this.contenu.chargerEcarts(n));
    });
  }

  figeLe(n: number): string | null {
    return this.instantanes().find((i) => i.numeroSoumission === n)?.figeLe ?? null;
  }

  figePar(n: number): string | null {
    return this.instantanes().find((i) => i.numeroSoumission === n)?.figePar ?? null;
  }

  choisir(n: number | null): void {
    const retour = this.choix() !== null && n === null;
    this.choix.set(n);
    // Les vues « sans défilement » (séance, rapport, fiche de présentation) mesurent la fenêtre à leur affichage.
    if (retour) setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }
}
