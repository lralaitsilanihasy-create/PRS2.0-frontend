import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';

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

/**
 * ⚠️ Manuel révisé, R4 (V104, 13/10) — l'onglet « Écrans figés » d'un dossier de procédure : la liste des instantanés (par soumission,
 * puis par écran), l'écran choisi rendu en **lecture seule** depuis son JSON figé, le bandeau « Figé à la soumission n° … du … » et
 * l'export PDF. Les profils CNM lisent ici ce que les pièces retirées (R2) portaient ; la liste est chargée par le store de l'hôte
 * dans sa vague, l'écran choisi à la demande. Un écran figé ne propose aucun geste : rien n'y modifie la procédure vivante.
 *
 * ⚠️ 01/11 (pilote, « ecarts-ecrans-figes ») — PENDANT LE CONTRÔLE seulement (jusqu'au PV signé) : l'onglet d'un écran qui a changé
 * depuis la soumission porte « ≠ », et l'écran affiché dit « ≠ n écarts avec la soumission n° k », qui déplie la liste (valeur soumise →
 * valeur actuelle, servie par le serveur). Rien n'est dit d'un écran identique ou non comparable, ni après le PV signé.
 */
@Component({
  selector: 'app-dossier-instantanes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, DonneesFigees, InstantaneSeanceVue, InstantaneEvaluationVue, InstantaneAttributionVue, InstantanePlanVue, InstantaneAvisVue, InstantaneCaoVue],
  // ⚠️ 14/10 — les identifiants et codes de référentiel des écrans figés se lisent en clair (nature, mode, statut de marché).
  providers: [ReferentielsFiges, { provide: RESOLVEUR_FIGES, useExisting: ReferentielsFiges }],
  template: `
    <!-- ⚠️ 18/10 (pilote, « améliorer les boutons et les caractères ») — un en-tête court, dans la police de l'application. -->
    <div class="di__tete">
      <span class="di__cadenas" aria-hidden="true">🔒</span>
      <p class="di__intro">
        Les écrans de la procédure, <strong>tels qu’ils étaient à la soumission</strong> : immuables, en lecture seule.
        <span class="di__compte">{{ contenu.instantanes().length }} écran{{ contenu.instantanes().length > 1 ? 's' : '' }} · {{ soumissions().length }} soumission{{ soumissions().length > 1 ? 's' : '' }}</span>
      </p>
    </div>

    @if (soumissions().length > 1) {
      <div class="di__select">
        <label for="di-soumission">Soumission à afficher</label>
        <select id="di-soumission" class="form-control" (change)="choisirSoumission($any($event.target).value)">
          @for (n of soumissions(); track n) {
            <option [value]="n" [selected]="soumissionEffective() === n">Soumission n° {{ n }} — {{ horodatage(dateDe(n)) }}</option>
          }
        </select>
      </div>
    }

    <div class="di__ecrans" role="tablist" aria-label="Écrans figés de la soumission">
      @for (i of ecransDeLaSoumission(); track i.idInstantane) {
        <button type="button" role="tab" class="di__onglet" [class.di__onglet--on]="courant()?.idInstantane === i.idInstantane"
          [attr.aria-selected]="courant()?.idInstantane === i.idInstantane" (click)="choisirEcran(i.ecran)">{{ libelle(i.ecran) }}@if (differe(i.ecran)) {<span class="di__ecart-marque"> ≠<span class="cnm-sr-only"> (a changé depuis la soumission)</span></span>}</button>
      }
      <!-- ⚠️ 18/10 (pilote) — ni bande « Figé à la soumission », ni date, ni export à l'écran : la trace est l'instantané serveur. -->
    </div>

    @if (courant(); as i) {
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de l'écran figé…</p>
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
        <!-- ⚠️ 18/10 (pilote) — plus de volet « Données complètes » sous les vues dédiées : la trace complète est l'instantané serveur
             (empreinte en infobulle) et son export PDF. Les écrans sans vue dédiée gardent le rendu générique, leur seule présentation. -->
      }
    } @else {
      <p class="text-muted">Aucun écran figé pour cette soumission.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .di__intro { margin: 0 0 0.8rem; font-size: var(--text-sm); color: var(--n-500); }
    .di__select { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; font-size: var(--text-sm); }
    .di__select .form-control { width: auto; }
    .di__tete { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.9rem; }
    .di__cadenas { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 8px; background: var(--onglet-actif-fond); font-size: 0.95rem; }
    .di__tete .di__intro { margin: 0; font-size: 0.9rem; color: var(--texte); }
    .di__compte { margin-left: 0.4rem; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--onglet-actif-fond); color: var(--texte); font-size: 0.75rem; font-weight: 500; white-space: nowrap; }
    /* Les écrans : un sélecteur segmenté, dans la police de l'application (un bouton n'en hérite pas sans « font: inherit »). */
    .di__ecrans { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 1rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--n-200); }
    .di__onglet {
      font: inherit; font-size: 0.9rem; font-weight: 500;
      padding: 0.45rem 1rem; border: 1.5px solid var(--bordure-champ); border-radius: 999px;
      background: var(--carte-fond); color: var(--texte); cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .di__onglet:hover { background: var(--onglet-actif-fond); }
    .di__onglet:focus-visible { outline: 3px solid var(--bouton-principal); outline-offset: 2px; }
    .di__onglet--on, .di__onglet--on:hover { background: var(--section-fond); color: var(--texte-menu); }
    .di__vue { padding: 0.25rem 0; }
    .di__ecart-marque { color: var(--examen-texte); font-weight: 500; }
    .di__onglet--on .di__ecart-marque { color: var(--or); }
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

  /** Pendant le contrôle seulement : la comparaison servie pour la soumission affichée (la dernière est lue dans la vague). */
  private readonly enControle = computed(() => !controleTermine(this.contenu.dossier().statut));
  private readonly ecarts = computed(() => (this.enControle() ? (this.contenu.ecarts().get(this.soumissionEffective() ?? 0) ?? null) : null));
  /** L'écran a changé depuis la soumission (≠ sur son onglet). */
  differe(ecran: string): boolean {
    return bilanEcarts(this.ecarts(), [ecran]).etat === 'ecarts';
  }
  /** Les écarts de l'écran affiché, s'il a changé ; `null` sinon. */
  readonly bilanCourant = computed(() => {
    const c = this.courant();
    const b = c ? bilanEcarts(this.ecarts(), [c.ecran]) : null;
    return b?.etat === 'ecarts' ? b : null;
  });
  readonly deplie = signal(false);

  readonly donnees = signal<unknown>(undefined);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly relance = signal(0);

  constructor() {
    // Une soumission plus ancienne, choisie dans la liste : sa comparaison est lue une fois.
    effect(() => {
      const n = this.soumissionEffective();
      if (n && this.enControle()) untracked(() => this.contenu.chargerEcarts(n));
    });
    effect((nettoyer) => {
      const c = this.courant();
      const id = this.contenu.dossier().idDossier;
      this.relance();
      const abonnement = untracked(() => this.lire(id, c));
      nettoyer(() => abonnement?.unsubscribe());
    });
  }

  choisirSoumission(valeur: string): void {
    this.soumission.set(Number(valeur));
  }

  choisirEcran(ecran: string): void {
    this.ecran.set(ecran);
  }

  dateDe(soumission: number): string | null {
    return this.contenu.instantanes().find((i) => i.numeroSoumission === soumission)?.figeLe ?? null;
  }

  private lire(idDossier: number, c: Instantane | null): Subscription | null {
    this.donnees.set(undefined);
    this.erreur.set(false);
    if (!c) {
      this.chargement.set(false);
      return null;
    }
    this.chargement.set(true);
    return this.service.lire(idDossier, c.ecran, c.numeroSoumission).subscribe({
      next: (d) => {
        this.donnees.set(d);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

}
