import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { messageSoumissionRefusee } from '../../shared/circuit/controles-libelles';
import { ToastService } from '../../core/notifications/toast.service';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { Dossier, Reception } from '../../models';
import { DossierService, EntiteContractService, LocaliteService, ReceptionService, ReferenceLookupService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ReputeApprouve, StatutBadge } from '../../shared/circuit';
import { LienDossier } from '../circuit/page-dossier/lien-dossier';
import { CompleterPiecesDepotModal } from './completer-pieces-depot-modal';
import { ApercuDossier } from '../circuit/dossier/apercu-dossier';
import { DeuxVolets } from '../../shared/ui/deux-volets';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * ⚠️ Demande pilote (2026-09-06) — le « Tableau de bord » PRMP devient « SUIVI DES DOSSIERS CNM » :
 * un tableau par dossier déposé — référence, date d'ENREGISTREMENT CNM (la réception par le
 * Secrétaire, premier passage) et FIN DE TRAITEMENT prévue (chronométrage serveur,
 * `datePrevisionnelleFin` ; ⏸ quand la balle est chez la PRMP et que la date glisse).
 * ⚠️ 2026-09-13 : colonne Statut RÉINTRODUITE (le pilote revient sur le choix du 2026-09-06 de n'y
 * mettre que des dates) ; colonne Actions RÉTABLIE avec des actions contextuelles (Rectifier / Soumettre) ;
 * le tableau porte désormais TOUS les dossiers de la PRMP, brouillons et à-rectifier compris.
 *
 * Lot L4-F6 : la ligne mène à la PAGE du dossier (`/prmp/dossier/:id`) ; la modale de consultation
 * quitte l'écran. Aucun filtre ni pagination ici : le retour rend la liste inchangée.
 */
@Component({
  selector: 'app-suivi-delais',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, RouterLink, EtatErreur, StatutBadge, ReputeApprouve, CompleterPiecesDepotModal, DeuxVolets, ApercuDossier],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ domaine() }}</div>
          <!-- ⚠️ Demande pilote (2026-09-13) — titre « Tous les dossiers » pour l'UGPM (aligné sur les autres
               profils) ; la PRMP garde « Suivi des dossiers CNM » (nom choisi le 2026-09-06, cadrage délais). -->
          <h1 class="page-title">Tous mes dossiers</h1>
        </div>
        <div class="sdl-vue" role="group" aria-label="Choix de l'affichage">
          <button type="button" class="btn btn-sm" [class.btn-primary]="vue() === 'volets'" [class.btn-outline]="vue() !== 'volets'" [attr.aria-pressed]="vue() === 'volets'" (click)="setVue('volets')">Deux volets</button>
          <button type="button" class="btn btn-sm" [class.btn-primary]="vue() === 'tableau'" [class.btn-outline]="vue() !== 'tableau'" [attr.aria-pressed]="vue() === 'tableau'" (click)="setVue('tableau')">Tableau</button>
        </div>
      </header>
      <!-- Phrase de rôle (proposition 2026-09-22, lot B) : à quoi sert l'écran, pour qui. -->
      <!-- ⚠️ 14/10 — la phrase disait « les brouillons ne sont pas ici » alors que la liste les porte depuis le 13/09 (demande pilote). -->
      <p class="page-role">Tous vos dossiers, du brouillon à la clôture : leur statut, leur date d'enregistrement à la Commission et la fin de traitement prévue. La PRMP y soumet ses brouillons.</p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le suivi des délais." (reessayer)="charger()" />
      } @else if (vue() === 'volets') {
        <!-- ⚠️ 31/10 (pilote, Espace de travail, lot 3c) — deux volets : les dossiers à gauche, l'aperçu du dossier choisi à
             droite (ses gestes, son dépôt et sa fin de traitement, son identité) ; le premier est choisi d'office. -->
        @if (!dossiers().length) {
          <p class="text-muted">Aucun dossier à la CNM.</p>
        } @else {
        <app-deux-volets [ouvert]="!!selection()" [cle]="selection()?.idDossier ?? null" libelleListe="Mes dossiers" libelleDetail="Aperçu du dossier"
                         invite="Choisissez un dossier : son aperçu s’affiche ici.">
          <ul liste class="sdl-volet">
            @for (d of dossiers(); track d.idDossier) {
              <li class="sdl-item" [class.sdl-item--on]="selection()?.idDossier === d.idDossier">
                <button type="button" class="sdl-ligne" [attr.aria-pressed]="selection()?.idDossier === d.idDossier" (click)="choisi.set(d.idDossier)">
                  <span class="sdl-ligne__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }} <span class="sdl-ligne__type">{{ typeDossierLabel(d) }}</span></span>
                  <span class="sdl-ligne__ent">{{ entiteLabel(d) }}</span>
                  <span class="sdl-ligne__bas">
                    <app-statut-badge [statut]="d.statut" />
                    @if (d.attentePrmp) { <span class="sdl-attente">⏸ à vous</span> }
                  </span>
                </button>
              </li>
            }
          </ul>
          <div detail>
            @for (d of selectionListe(); track d.idDossier) {
              <app-apercu-dossier [dossier]="d" [lien]="lien.commandes(d.idDossier)" [params]="lien.params()">
                <span gestes class="sdl-gestes"><ng-container [ngTemplateOutlet]="gestesTpl" [ngTemplateOutletContext]="{ $implicit: d }" /></span>
                <dl frise class="sdl-dates">
                  <div><dt>Dépôt du dossier</dt><dd>{{ d.dateSoumission ? (d.dateSoumission | date: 'dd/MM/yyyy') : '—' }}</dd></div>
                  <div><dt>Fin traitement CNM</dt><dd>
                    @if (enregistrement(d)) {
                      @if (d.datesEtapes?.['CLOTURE']; as clot) { {{ clot | date: 'dd/MM/yyyy HH:mm' }} }
                      @else if (d.datePrevisionnelleFin) { {{ d.datePrevisionnelleFin | date: 'dd/MM/yyyy' }} }
                      @else { — }
                    } @else { — }
                  </dd></div>
                  <div><dt>Localité</dt><dd>{{ localiteLabel(d) }}</dd></div>
                </dl>
              </app-apercu-dossier>
            }
          </div>
        </app-deux-volets>
        }
      } @else {
        <div class="table-card sdl-table">
          <table>
            <thead>
              <!-- ⚠️ 2026-09-13 (demande pilote) — colonne Statut AJOUTÉE : elle avait été écartée le
                   2026-09-06 (« l'écran suit les dates »), le pilote la réintroduit. Même badge partagé
                   que le reste de l'app (libellés Initial/Numéroté/… via statutDossierLabel). -->
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Type</th>
                <th scope="col">Entité contractante</th>
                <th scope="col">Localité</th>
                <th scope="col">Dépôt du dossier</th>
                <th scope="col">Fin traitement CNM</th>
                <th scope="col">Statut</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr class="ligne-clic" [class.cnm-row-cloture]="d.datesEtapes?.['CLOTURE']">
                  <!-- Ligne cliquable : la référence est un vrai lien (nom accessible + clavier, Ctrl+clic
                       = nouvel onglet) dont la zone cliquable est étendue à la ligne (overlay ::after) —
                       pas de (click) sur <tr>. Lot L4-F6 : il mène à la PAGE du dossier. -->
                  <td><a class="lien-ligne" [routerLink]="lien.commandes(d.idDossier)" [queryParams]="lien.params()">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</a></td>
                  <!-- Type de dossier en CODE concis (sous-type de la référence, ex. PPM-AGPM ; repli famille). -->
                  <td>{{ typeDossierLabel(d) }}</td>
                  <td class="sdl-entite">{{ entiteLabel(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <!-- ⚠️ Terme métier (pilote 2026-09-06) : la date de SOUMISSION est la date de
                       DÉPÔT du dossier — même donnée (champ demandé au backend, « — » sinon). -->
                  <td class="cnm-mono">{{ d.dateSoumission ? (d.dateSoumission | date: 'dd/MM/yyyy') : '—' }}</td>
                  <!-- ⚠️ Demande pilote (2026-09-13) — colonne « Enregistrement CNM » retirée ; la méthode
                       enregistrement() reste utilisée pour DÉCIDER l'affichage de la fin (compteur = enregistrement).
                       ⚠️ Demande pilote (2026-09-07) : la « Fin traitement CNM » est une PROJECTION serveur
                       (aujourd'hui + durée standard restante) présente dès la soumission. On la MASQUE tant que
                       le dossier n'est pas ENREGISTRÉ : le traitement CNM n'a pas encore commencé (le compteur
                       démarre à l'enregistrement = debutCompteur), afficher une fin avant serait trompeur. -->
                  <td class="cnm-mono sdl-fin">
                    @if (enregistrement(d)) {
                      @if (d.datesEtapes?.['CLOTURE']; as clot) {
                        <span class="cnm-fin-cloture">{{ clot | date: 'dd/MM/yyyy HH:mm' }}</span>
                      } @else if (d.datePrevisionnelleFin) {
                        {{ d.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}
                      } @else { — }
                      @if (d.attentePrmp) {
                        <span class="sdl-attente" title="En attente de votre action (compléments, pièces ou rectification) — la date prévisionnelle glisse tant que le dossier ne revient pas à la CNM.">⏸ à vous</span>
                      }
                    } @else {
                      —
                    }
                  </td>
                  <td><app-statut-badge [statut]="d.statut" /><app-repute-approuve [le]="d.reputeApprouveLe" [court]="true" /></td>
                  <!-- Actions contextuelles (le clic-ligne reste pour le détail) : Rectifier, Soumettre un
                       brouillon, Compléter les pièces d'un dépôt — chacune affichée seulement si elle s'applique. -->
                  <td>
                    <div class="td-actions actions-end"><ng-container [ngTemplateOutlet]="gestesTpl" [ngTemplateOutletContext]="{ $implicit: d }" /></div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="empty-cell">Aucun dossier à la CNM.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Gestes d'un dossier — partagés par le tableau (colonne Actions) et le volet de droite. -->
    <ng-template #gestesTpl let-d>
                @if (estPrmp() && d.statut === 'EN_ATTENTE_DECISION_PRMP') {
                  <!-- Lot C1 (26/09) — un dossier DAO (idDmc) se rectifie par la révision de sa fiche : écran propre. -->
                  <a class="btn btn-primary btn-sm" [routerLink]="[d.idDmc != null ? '/prmp/rectifier-dao' : '/prmp/rectifier', d.idDossier]" [queryParams]="{ returnUrl: '/prmp/tableau-de-bord' }">Rectifier</a>
                }
                @if (estPrmp() && d.statut === 'BROUILLON') {
                  <button
                    type="button"
                    class="btn btn-success btn-sm"
                    [disabled]="submittingId() === d.idDossier || vacance()"
                    [title]="vacance() ? 'Poste PRMP vacant — soumission suspendue en attente de nomination.' : ''"
                    (click)="soumettre(d)"
                  >Soumettre</button>
                }
                @if (estPrmp() && d.statut === 'EN_ATTENTE_COMPLEMENTS_DEPOT') {
                  <button type="button" class="btn btn-warning btn-sm" (click)="completer.set(d)">Compléter les pièces</button>
                }
                <!-- ⚠️ 18/10 (pilote) — l'avis spécifique (ou les lettres d'invitation) est imprimable : la page du dossier,
                     fenêtre d'impression ouverte d'emblée. Servi par le backend (« impressionAvis », demande du 18/10) aux
                     seules PRMP et UGPM : l'UGPM, qui partage cet écran, imprime aussi. -->
                @if (d.impressionAvis?.disponible) {
                  <a class="btn btn-primary btn-sm"
                    [routerLink]="lien.commandes(d.idDossier)"
                    [queryParams]="paramsImpression()"
                  >{{ libelleImpression(d) }}</a>
                }
    </ng-template>

    @if (completer(); as d) {
      <app-completer-pieces-depot-modal [dossier]="d" (transmis)="onComplementsTransmis()" (fermer)="completer.set(null)" />
    }
  `,
  styles: `
    /* ⚠️ 31/10 (Espace de travail, lot 3c) — bascule de vue et volet de gauche. */
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .sdl-vue { display: flex; gap: 6px; }
    .sdl-volet { list-style: none; margin: 0; padding: 0; }
    .sdl-item { border-bottom: 1px solid var(--bordure); }
    .sdl-item--on { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .sdl-ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 0.2rem; padding: 0.55rem 0.8rem; }
    .sdl-ligne:hover { background: var(--ligne-survol); }
    .sdl-item--on .sdl-ligne:hover { background: transparent; }
    .sdl-ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .sdl-ligne__ref { font-weight: 500; }
    .sdl-ligne__type { margin-left: 4px; font-weight: 400; font-size: var(--text-sm); color: var(--texte-secondaire); }
    .sdl-ligne__ent { font-size: var(--text-sm); color: var(--texte-secondaire); overflow-wrap: anywhere; }
    .sdl-ligne__bas { display: flex; flex-wrap: wrap; gap: 0.3rem 0.5rem; align-items: center; }
    .sdl-gestes { display: contents; }
    .sdl-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0; margin: 0; border: 1px solid var(--bordure); border-radius: 4px; }
    .sdl-dates > div { padding: 6px 10px; }
    .sdl-dates > div + div { border-left: 1px solid var(--bordure); }
    .sdl-dates dt { font-size: 11px; color: var(--texte-secondaire); }
    .sdl-dates dd { margin: 0; font-weight: 500; }
    .sdl-attente { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-full); background: var(--warning-bg); border: 1px solid var(--warning-bdr); color: var(--warning-text); font-size: var(--text-xs); white-space: nowrap; }
    /* Ligne cliquable : la référence est un vrai bouton (nom accessible + clavier) dont la zone
       cliquable est ÉTENDUE à toute la ligne via un overlay ::after ; pas de (click) sur <tr>. */
    .table-card table tr.ligne-clic { position: relative; cursor: pointer; }
    .table-card table tr.ligne-clic:hover td { background: var(--n-50); }
    .lien-ligne { background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; text-decoration: none; }
    .lien-ligne::after { content: ''; position: absolute; inset: 0; }
    /* Les boutons d'action passent AU-DESSUS de l'overlay → cliquables indépendamment du clic-ligne. */
    .table-card table tr.ligne-clic .btn { position: relative; z-index: 1; }
    /* ⚠️ 18/10 (pilote) — la colonne Actions sortait de l'écran à 1366 px (tableau de 1270 px pour 1085). Resserré ici
       seulement : marges des cellules réduites, intitulés sur deux lignes, entité contractante à la ligne, date et heure
       de clôture superposables. La référence et les dates restent d'un seul tenant. */
    .sdl-table th, .sdl-table td { padding-left: 0.6rem; padding-right: 0.6rem; }
    .sdl-table th { white-space: normal; vertical-align: bottom; }
    .sdl-table td.sdl-entite { white-space: normal; min-width: 9rem; max-width: 15rem; line-height: 1.35; }
    .sdl-table td.sdl-fin { white-space: normal; min-width: 6.5rem; }
    .sdl-table td.sdl-fin .cnm-fin-cloture { display: inline-block; }
    .sdl-table .td-actions { flex-wrap: wrap; gap: 0.35rem; }
  `,
})
export class SuiviDelais {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly toast = inject(ToastService);
  private readonly vacanceStore = inject(VacanceStore);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReferenceLookupService);
  /** Lot L4-F6 : lien vers la page du dossier, retour vers ce suivi. */
  protected readonly lien = inject(LienDossier);

  /** ⚠️ 18/10 (pilote) — le bouton d'impression : la page du dossier, fenêtre d'impression ouverte d'emblée. */
  paramsImpression(): Record<string, string> {
    return { ...this.lien.params(), imprimer: 'avis' };
  }

  libelleImpression(d: Dossier): string {
    const lettres = d.impressionAvis?.document === 'LETTRES_INVITATION';
    if (d.impressionAvis?.dejaImprime) return lettres ? 'Réimprimer les lettres' : 'Réimprimer l’avis';
    return lettres ? 'Imprimer les lettres' : 'Imprimer l’avis';
  }
  /** Libellés d'entité contractante / localité (cache partagé) — colonnes du tableau, sans appel par ligne. */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** Libellé de section : « Domaine UGPM » pour un compte UGPM, « Domaine PRMP » sinon (écran partagé). */
  protected readonly domaine = this.auth.domainePrmpLabel;
  /**
   * Actions de la colonne Actions RÉSERVÉES à la PRMP : l'UGPM partage cet écran (vue seule) mais ne
   * soumet/rectifie/complète pas (backend 403). `estPrmp` masque ces boutons pour un compte UGPM.
   */
  protected readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  /** Vacance du poste PRMP (spec « Mandats PRMP ») — soumission suspendue. */
  readonly vacance = this.vacanceStore.vacance;
  /** idDossier en cours de soumission (bouton désactivé + anti double-clic). */
  readonly submittingId = signal<number | null>(null);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  private readonly tous = signal<Dossier[]>([]);
  /** Réception INITIALE par dossier (premier passage du Secrétaire). */
  private readonly receptions = signal<Map<number, Reception>>(new Map());
  /** Dossier ouvert dans le modal « Compléter les pièces » (EN_ATTENTE_COMPLEMENTS_DEPOT ; null = fermé). */
  readonly completer = signal<Dossier | null>(null);
  /** ⚠️ 31/10 (Espace de travail, lot 3c) — affichage : deux volets (par défaut) ou tableau ; choix mémorisé par navigateur. */
  readonly vue = signal<'volets' | 'tableau'>(this.lireVue());
  /** Deux volets : le dossier choisi (le premier tant que rien n'est choisi, ou si le choisi a quitté la liste). */
  readonly choisi = signal<number | null>(null);
  readonly selection = computed(() => {
    const liste = this.dossiers();
    return liste.find((d) => d.idDossier === this.choisi()) ?? liste[0] ?? null;
  });
  /** Le dossier choisi en liste d'un élément : l'aperçu est recréé (et son contenu relu) quand il change. */
  readonly selectionListe = computed(() => {
    const d = this.selection();
    return d ? [d] : [];
  });

  private lireVue(): 'volets' | 'tableau' {
    try {
      return localStorage.getItem('cnm-suivi-vue') === 'tableau' ? 'tableau' : 'volets';
    } catch {
      return 'volets';
    }
  }
  setVue(v: 'volets' | 'tableau'): void {
    this.vue.set(v);
    try {
      localStorage.setItem('cnm-suivi-vue', v);
    } catch {
      /* localStorage indisponible : le choix ne persiste pas, sans conséquence. */
    }
  }

  /**
   * Tous les dossiers de la PRMP, plus récents d'abord. ⚠️ 2026-09-13 (demande pilote) : les BROUILLONS
   * sont désormais AFFICHÉS (avec un bouton « Soumettre ») — ils n'ont ni enregistrement ni délai CNM,
   * leurs colonnes de dates restent à « — ». Copie avant tri (ne jamais muter la valeur du signal).
   */
  readonly dossiers = computed(() =>
    [...this.tous()].sort((a, b) => b.idDossier - a.idDossier),
  );

  constructor() {
    this.charger();
    // Libellés d'entité / localité (cache partagé) — colonnes « Entité contractante » / « Localité ».
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      dossiers: this.dossierService.list(),
      // ⚠️ 2026-09-13 (demande pilote) — la liste scopée exclut brouillons et à-rectifier ; on les fusionne
      // explicitement (dédoublonnage par idDossier ci-dessous) pour que le tableau porte TOUS les dossiers.
      aRectifier: this.dossierService.list('EN_ATTENTE_DECISION_PRMP').pipe(catchError(() => of([] as Dossier[]))),
      brouillons: this.dossierService.list('BROUILLON').pipe(catchError(() => of([] as Dossier[]))),
      aCompleter: this.dossierService.list('EN_ATTENTE_COMPLEMENTS_DEPOT').pipe(catchError(() => of([] as Dossier[]))),
      receptions: this.receptionService.list().pipe(catchError(() => of([] as Reception[]))),
    }).subscribe({
      next: ({ dossiers, aRectifier, brouillons, aCompleter, receptions }) => {
        const parId = new Map<number, Dossier>();
        for (const d of [...dossiers, ...aRectifier, ...brouillons, ...aCompleter]) parId.set(d.idDossier, d);
        this.tous.set([...parId.values()]);
        const parDossier = new Map<number, Reception>();
        for (const r of receptions) {
          const connue = parDossier.get(r.idDossier);
          if (!connue || (r.numPassage ?? 99) < (connue.numPassage ?? 99)) {
            parDossier.set(r.idDossier, r);
          }
        }
        this.receptions.set(parDossier);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Date d'enregistrement CNM : le champ du DTO dossier dès que le backend le sert
   * (demande 2026-09-06), en repli la réception du premier passage quand elle est lisible.
   */
  enregistrement(d: Dossier): string | null {
    return d.dateEnregistrement ?? this.receptions().get(d.idDossier)?.dateReception ?? null;
  }

  /** Type de dossier en CODE concis (`idSousType`, ex. « PPM-AGPM » ; repli famille `idTypeDossier`). */
  typeDossierLabel(d: Dossier): string {
    return d.idSousType ?? d.idTypeDossier ?? '—';
  }

  /** Libellé de l'entité contractante du dossier (cache, sans appel par ligne ; repli sur l'id). */
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }

  /** Libellé de la localité du dossier (cache ; repli sur le code). */
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }

  /** Compléments transmis (dossier revenu SOUMIS) : ferme le modal, recharge, propage aux autres écrans. */
  onComplementsTransmis(): void {
    this.completer.set(null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }

  /**
   * « Soumettre » un brouillon (PRMP) — même geste que « Mes dossiers » : `POST /dossiers/{id}/soumettre`,
   * puis rechargement local + propagation aux autres écrans. Le backend tranche la validité (400 explicite,
   * ex. PPM manquant) ; on affiche le détail des `fieldErrors` que l'intercepteur laisse passer.
   */
  soumettre(d: Dossier): void {
    this.submittingId.set(d.idDossier);
    this.dossierService.soumettre(d.idDossier).subscribe({
      next: (res) => {
        this.toast.success(`Dossier soumis${res.refeDossier ? ' · réf. ' + res.refeDossier : ''}.`);
        this.submittingId.set(null);
        this.dossiersRefresh.notifierChangement();
        this.charger();
      },
      error: (e: ApiError) => {
        this.submittingId.set(null);
        this.toast.error(messageSoumissionRefusee(e), 'Soumission impossible');
      },
    });
  }
}
