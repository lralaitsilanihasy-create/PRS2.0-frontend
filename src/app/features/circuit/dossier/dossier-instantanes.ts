import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';

import { Instantane } from '../../../models';
import { InstantaneService } from '../../../services';
import { horodatage } from '../../../shared/prmp/avis-specifique-modele';
import { DonneesFigees, RESOLVEUR_FIGES } from '../../../shared/ui/donnees-figees';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { bilanEcarts, controleTermine } from './bilan-ecarts';
import { DossierContenuStore } from './dossier-contenu.store';
import { InstantaneAttributionVue, InstantaneEvaluationVue, InstantaneSeanceVue } from './instantanes-vues';
import { InstantaneAvisVue, InstantaneCaoVue, InstantanePlanVue } from './instantanes-procedure';
import { ReferentielsFiges } from './referentiels-figes';
import { resumeInstantane } from './resume-instantane';

/** L'ordre de lecture des écrans d'une soumission : la procédure, puis ses séances, puis ses suites. */
const ORDRE_ECRANS: readonly string[] = ['PLAN', 'AVIS', 'AMI', 'CAO', 'SEANCE', 'EVALUATION', 'ATTRIBUTION', 'ACTE', 'DSS'];

const LIBELLES_ECRAN: Readonly<Record<string, string>> = {
  PLAN: 'Ligne du plan',
  AVIS: 'Avis et lettres',
  AMI: 'AMI et présélection',
  CAO: 'Commission (CAO)',
  SEANCE: "Séance d'ouverture",
  EVALUATION: 'Évaluation',
  ATTRIBUTION: 'Attribution',
  ACTE: 'Acte de gestion',
  DSS: 'Sans suite',
};

export function libelleEcranInstantane(ecran: string): string {
  return LIBELLES_ECRAN[ecran] ?? ecran;
}

/** Un écran lu, ou son échec de lecture. */
const ECHEC = Symbol('echec');
type Lecture = unknown | typeof ECHEC;

/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — la fenêtre « Écrans figés » d'un dossier de procédure : les écrans tels qu'ils étaient à la
 * soumission, rendus en **lecture seule** depuis leur JSON figé. Les profils CNM lisent ici ce que les pièces retirées (R2) portaient ;
 * la liste est chargée par le store de l'hôte dans sa vague. Un écran figé ne propose aucun geste : rien n'y modifie la procédure vivante.
 *
 * ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — un bandeau de la soumission (numéro, date, auteur : ce qui fait foi), un
 * SOMMAIRE à gauche (les écrans dans l'ordre de la procédure, numérotés, chacun avec sa ligne de résumé) et l'écran choisi à droite,
 * sous son titre. Les écrans de la soumission sont lus ensemble, une fois : le sommaire a besoin de chacun pour se résumer.
 *
 * ⚠️ 01/11 (pilote, « ecarts-ecrans-figes ») — PENDANT LE CONTRÔLE seulement (jusqu'au PV signé) : l'écran qui a changé depuis la
 * soumission porte « ≠ » dans le sommaire, et l'écran affiché dit « ≠ n écarts avec la soumission n° k », qui déplie la liste.
 */
@Component({
  selector: 'app-dossier-instantanes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, DonneesFigees, InstantaneSeanceVue, InstantaneEvaluationVue, InstantaneAttributionVue, InstantanePlanVue, InstantaneAvisVue, InstantaneCaoVue],
  // ⚠️ 14/10 — les identifiants et codes de référentiel des écrans figés se lisent en clair (nature, mode, statut de marché).
  providers: [ReferentielsFiges, { provide: RESOLVEUR_FIGES, useExisting: ReferentielsFiges }],
  template: `
    <!-- Le bandeau de la soumission : ce qui fait foi. -->
    <div class="di__sceau">
      <span class="di__cadenas" aria-hidden="true">🔒</span>
      @if (soumissions().length > 1) {
        <label class="di__choix" for="di-soumission"><span class="cnm-sr-only">Soumission à afficher</span>
          <select id="di-soumission" (change)="choisirSoumission($any($event.target).value)">
            @for (n of soumissions(); track n) {
              <option [value]="n" [selected]="soumissionEffective() === n">Soumission n° {{ n }}</option>
            }
          </select>
        </label>
      } @else {
        <b>Soumission n° {{ soumissionEffective() }}</b>
      }
      <!-- Les espaces vivent DANS les textes : entre deux balises, Angular les retire. -->
      <span><span class="di__sec">figée le </span><b>{{ horodatage(dateDe(soumissionEffective())) }}</b>@if (auteurDe(soumissionEffective()); as a) {<span class="di__sec"> par </span><b>{{ a }}</b>}</span>
      <span class="di__sec">Immuable, en lecture seule · {{ ecransDeLaSoumission().length }} écran{{ ecransDeLaSoumission().length > 1 ? 's' : '' }}@if (soumissions().length > 1) { · {{ soumissions().length }} soumissions }</span>
    </div>

    <div class="di__grille">
      <!-- Le sommaire : les écrans dans l'ordre de la procédure, chacun résumé d'une ligne. -->
      <div class="di__sommaire" role="tablist" aria-orientation="vertical" aria-label="Écrans figés de la soumission">
        <p class="di__sommaire-t" aria-hidden="true">Écrans · ordre de la procédure</p>
        @for (i of ecransDeLaSoumission(); track i.idInstantane; let n = $index) {
          <button type="button" role="tab" class="di__onglet" [class.di__onglet--on]="courant()?.idInstantane === i.idInstantane"
            [attr.aria-selected]="courant()?.idInstantane === i.idInstantane" (click)="choisirEcran(i.ecran)">
            <span class="di__num" aria-hidden="true">{{ n + 1 }}</span>
            <span class="di__nom">{{ libelle(i.ecran) }}@if (differe(i.ecran)) {<span class="di__ecart-marque"> ≠<span class="cnm-sr-only"> (a changé depuis la soumission)</span></span>}</span>
            @if (resume(i.ecran); as r) { <span class="di__resume">{{ r }}</span> }
          </button>
        }
      </div>

      <div class="di__lecture" role="tabpanel" [attr.aria-label]="courant() ? libelle(courant()!.ecran) : 'Écran figé'">
        @if (courant(); as i) {
          <h3 class="di__titre">{{ libelle(i.ecran) }}</h3>
          @if (chargement()) {
            <p class="text-muted" role="status">Chargement des écrans figés…</p>
          } @else if (erreur()) {
            <app-etat-erreur message="L'écran figé n'a pas pu être lu." (reessayer)="relance.set(relance() + 1)" />
          } @else if (donnees() !== undefined) {
            @if (bilanCourant(); as b) {
              <button type="button" class="di__ecart" [attr.aria-expanded]="deplie()" aria-controls="di-ecarts" (click)="deplie.set(!deplie())">
                <span aria-hidden="true">≠</span> {{ b.lignes.length }}{{ b.tronque ? '+' : '' }} écart{{ b.lignes.length > 1 ? 's' : '' }} avec la soumission n° {{ i.numeroSoumission }}
                <span aria-hidden="true">{{ deplie() ? '▴' : '▾' }}</span></button>
              @if (deplie()) {
                <div class="di__ecarts" id="di-ecarts">
                  <table>
                    <caption class="di__legende">Ce qui a changé depuis la soumission n° {{ i.numeroSoumission }}</caption>
                    <colgroup><col style="width: 32%" /><col style="width: 28%" /><col style="width: 40%" /></colgroup>
                    <thead><tr><th scope="col">Élément</th><th scope="col">À la soumission</th><th scope="col">Aujourd'hui</th></tr></thead>
                    <tbody>
                      @for (l of b.lignes; track l.chemin) {
                        <tr><th scope="row">{{ l.libelle }}</th><td>{{ l.soumis ?? '—' }}</td><td class="di__actuel">{{ l.actuel ?? '—' }}</td></tr>
                      }
                    </tbody>
                  </table>
                  @if (b.tronque) { <p class="di__ecarts-pied">Liste limitée à 50 écarts ; l'écran figé fait foi.</p> }
                </div>
              }
            }
            <div class="di__vue">
              @switch (i.ecran) {
                @case ('PLAN') { <app-instantane-plan [donnees]="$any(donnees())" /> }
                @case ('AVIS') { <app-instantane-avis [donnees]="$any(donnees())" /> }
                @case ('CAO') { <app-instantane-cao [donnees]="$any(donnees())" /> }
                @case ('SEANCE') { <app-instantane-seance [seance]="$any(donnees())" /> }
                @case ('EVALUATION') { <app-instantane-evaluation [evaluation]="$any(donnees())" /> }
                @case ('ATTRIBUTION') { <app-instantane-attribution [attribution]="$any(donnees())" /> }
                @default { <app-donnees-figees [valeur]="donnees()" /> }
              }
            </div>
          }
        } @else {
          <p class="text-muted">Aucun écran figé pour cette soumission.</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .di__sceau { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; padding: 10px 16px; margin-bottom: 12px; border-radius: 6px;
      background: var(--section-fond); color: var(--texte-menu); font-size: 0.85rem; }
    .di__sceau b { font-weight: 500; }
    .di__sec { color: var(--texte-menu-secondaire); }
    .di__cadenas { display: inline-grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%; background: var(--or); color: var(--texte); font-size: 0.85rem; }
    .di__choix select { font: inherit; font-weight: 500; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--texte-menu-secondaire); background: var(--section-fond); color: var(--texte-menu); }
    .di__choix select:focus-visible { outline: 2px solid var(--or); outline-offset: 2px; }
    /* Le sommaire à gauche, la lecture à droite. */
    .di__grille { display: grid; grid-template-columns: 16rem minmax(0, 1fr); gap: 0; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; min-height: 24rem; }
    .di__sommaire { display: flex; flex-direction: column; padding: 8px 0; background: var(--ligne-survol); border-right: 1px solid var(--bordure); }
    .di__sommaire-t { margin: 0 14px 6px; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texte-secondaire); }
    .di__onglet { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: 1px 8px; padding: 8px 14px; border: 0; border-left: 3px solid transparent;
      background: none; color: var(--texte); font: inherit; text-align: left; cursor: pointer; }
    .di__onglet:hover { background: var(--carte-fond); }
    .di__onglet:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .di__onglet--on, .di__onglet--on:hover { background: var(--carte-fond); border-left-color: var(--section-fond); }
    .di__num { grid-row: 1 / span 2; display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; border: 1px solid var(--bordure);
      background: var(--carte-fond); font-size: 0.72rem; font-weight: 500; }
    .di__onglet--on .di__num { background: var(--section-fond); border-color: var(--section-fond); color: var(--texte-menu); }
    .di__nom { font-weight: 500; }
    .di__resume { font-size: 0.78rem; color: var(--texte-secondaire); overflow-wrap: anywhere; }
    .di__lecture { padding: 14px 18px; min-width: 0; }
    .di__titre { margin: 0 0 12px; font-size: 1.05rem; font-weight: 500; }
    .di__vue { padding: 0.25rem 0; }
    .di__ecart-marque { color: var(--examen-texte); font-weight: 500; }
    .di__ecart { display: inline-flex; gap: 6px; align-items: center; margin-bottom: 10px; padding: 3px 10px; border: 0; border-radius: 10px; font: inherit;
      font-size: 0.8rem; font-weight: 500; background: var(--examen-fond); color: var(--examen-texte); cursor: pointer; }
    .di__ecart:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .di__ecarts { margin: 0 0 12px; border: 1px solid var(--bordure); border-radius: 6px; overflow: hidden; }
    .di__ecarts table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.82rem; font-variant-numeric: tabular-nums; }
    .di__legende { caption-side: top; text-align: left; padding: 6px 10px; font-size: 0.8rem; font-weight: 500; color: var(--texte); }
    .di__ecarts th, .di__ecarts td { padding: 5px 10px; text-align: left; vertical-align: top; border-top: 1px solid var(--bordure); white-space: normal; overflow-wrap: anywhere; }
    .di__ecarts thead th { background: var(--tableau-entete); font-weight: 500; }
    .di__ecarts tbody th { font-weight: 400; }
    .di__actuel { font-weight: 500; }
    .di__ecarts-pied { margin: 0; padding: 6px 10px; border-top: 1px solid var(--bordure); font-size: 0.8rem; color: var(--texte-secondaire); }
    @media (max-width: 56rem) {
      .di__grille { grid-template-columns: minmax(0, 1fr); }
      .di__sommaire { flex-direction: row; overflow-x: auto; padding: 0; border-right: 0; border-bottom: 1px solid var(--bordure); }
      .di__sommaire-t { display: none; }
      .di__onglet { min-width: 11rem; border-left: 0; border-bottom: 3px solid transparent; }
      .di__onglet--on, .di__onglet--on:hover { border-bottom-color: var(--section-fond); }
    }
  `,
})
export class DossierInstantanes {
  protected readonly contenu = inject(DossierContenuStore);
  private readonly service = inject(InstantaneService);

  readonly horodatage = horodatage;
  readonly libelle = libelleEcranInstantane;

  /** Les numéros de soumission, la plus récente en tête. */
  readonly soumissions = computed(() => [...new Set(this.contenu.instantanes().map((i) => i.numeroSoumission))].sort((a, b) => b - a));
  private readonly soumission = signal<number | null>(null);
  readonly soumissionEffective = computed(() => {
    const choix = this.soumission();
    return choix != null && this.soumissions().includes(choix) ? choix : (this.soumissions()[0] ?? null);
  });
  readonly ecransDeLaSoumission = computed(() =>
    this.contenu
      .instantanes()
      .filter((i) => i.numeroSoumission === this.soumissionEffective())
      .sort((a, b) => ORDRE_ECRANS.indexOf(a.ecran) - ORDRE_ECRANS.indexOf(b.ecran)),
  );
  private readonly ecran = signal<string | null>(null);
  /** L'instantané affiché : l'écran choisi s'il existe pour cette soumission, sinon le premier. */
  readonly courant = computed<Instantane | null>(() => this.ecransDeLaSoumission().find((i) => i.ecran === this.ecran()) ?? this.ecransDeLaSoumission()[0] ?? null);

  /** Les écrans de la soumission affichée, lus ensemble (le sommaire résume chacun). */
  private readonly lus = signal<ReadonlyMap<string, Lecture>>(new Map());
  readonly chargement = signal(false);
  readonly relance = signal(0);
  readonly donnees = computed<unknown>(() => {
    const c = this.courant();
    const v = c ? this.lus().get(c.ecran) : undefined;
    return v === ECHEC ? undefined : v;
  });
  readonly erreur = computed(() => {
    const c = this.courant();
    return !!c && this.lus().get(c.ecran) === ECHEC;
  });

  /** Pendant le contrôle seulement : la comparaison servie pour la soumission affichée (la dernière est lue dans la vague). */
  private readonly enControle = computed(() => !controleTermine(this.contenu.dossier().statut));
  private readonly ecarts = computed(() => (this.enControle() ? (this.contenu.ecarts().get(this.soumissionEffective() ?? 0) ?? null) : null));
  /** Les écarts de l'écran affiché, s'il a changé ; `null` sinon. */
  readonly bilanCourant = computed(() => {
    const c = this.courant();
    const b = c ? bilanEcarts(this.ecarts(), [c.ecran]) : null;
    return b?.etat === 'ecarts' ? b : null;
  });
  readonly deplie = signal(false);

  constructor() {
    // Une soumission plus ancienne, choisie dans la liste : sa comparaison est lue une fois.
    effect(() => {
      const n = this.soumissionEffective();
      if (n && this.enControle()) untracked(() => this.contenu.chargerEcarts(n));
    });
    // Les écrans de la soumission, lus ensemble à l'ouverture et à chaque changement de soumission (ou reprise après échec).
    effect((nettoyer) => {
      const ecrans = this.ecransDeLaSoumission();
      const id = this.contenu.dossier().idDossier;
      this.relance();
      const abonnement = untracked(() => this.lireTout(id, ecrans));
      nettoyer(() => abonnement?.unsubscribe());
    });
  }

  /** L'écran a changé depuis la soumission (≠ dans le sommaire). */
  differe(ecran: string): boolean {
    return bilanEcarts(this.ecarts(), [ecran]).etat === 'ecarts';
  }

  /** La ligne de résumé de l'écran, une fois lu. */
  resume(ecran: string): string {
    const v = this.lus().get(ecran);
    return v === undefined || v === ECHEC ? '' : resumeInstantane(ecran, v);
  }

  choisirSoumission(valeur: string): void {
    this.soumission.set(Number(valeur));
  }

  choisirEcran(ecran: string): void {
    this.ecran.set(ecran);
    this.deplie.set(false);
  }

  dateDe(soumission: number | null): string | null {
    return this.contenu.instantanes().find((i) => i.numeroSoumission === soumission)?.figeLe ?? null;
  }

  auteurDe(soumission: number | null): string | null {
    return this.contenu.instantanes().find((i) => i.numeroSoumission === soumission)?.figePar ?? null;
  }

  private lireTout(idDossier: number, ecrans: readonly Instantane[]): Subscription | null {
    this.lus.set(new Map());
    if (!ecrans.length) {
      this.chargement.set(false);
      return null;
    }
    this.chargement.set(true);
    return forkJoin(ecrans.map((c) => this.service.lire(idDossier, c.ecran, c.numeroSoumission).pipe(
      map((d): [string, Lecture] => [c.ecran, d]),
      catchError(() => of<[string, Lecture]>([c.ecran, ECHEC])),
    ))).subscribe((lus) => {
      this.lus.set(new Map(lus));
      this.chargement.set(false);
    });
  }
}
