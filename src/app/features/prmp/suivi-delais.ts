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
import { DossierService, EntiteContractService, LocaliteService, ReceptionService, ReferenceLookupService, SousTypeDossierService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ReputeApprouve, StatutBadge, traitementCnmTermine } from '../../shared/circuit';
import { FamilleDossier, LIBELLES_FAMILLE, familleDossier } from '../circuit/dossier/famille-dossier';
import { LienDossier } from '../circuit/page-dossier/lien-dossier';
import { CompleterPiecesDepotModal } from './completer-pieces-depot-modal';
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
/** ⚠️ 01/11 (pilote, variante B) — l'état d'un dossier pour les compteurs : à traiter par la PRMP, à la Commission, traitement terminé. */
export type EtatSuivi = 'a-traiter' | 'commission' | 'clos';

const A_TRAITER: ReadonlySet<string> = new Set(['BROUILLON', 'EN_ATTENTE_DECISION_PRMP', 'EN_ATTENTE_COMPLEMENTS_DEPOT']);

/** Un dossier retiré n'entre dans aucun compteur (il reste dans « tous »). */
export function etatSuivi(d: Pick<Dossier, 'statut' | 'attentePrmp'>): EtatSuivi | null {
  if (d.statut === 'RETIRE') return null;
  if (A_TRAITER.has(d.statut ?? '') || d.attentePrmp) return 'a-traiter';
  return traitementCnmTermine(d.statut) ? 'clos' : 'commission';
}

@Component({
  selector: 'app-suivi-delais',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, RouterLink, EtatErreur, StatutBadge, ReputeApprouve, CompleterPiecesDepotModal],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ domaine() }}</div>
          <!-- ⚠️ Demande pilote (2026-09-13) — titre « Tous les dossiers » pour l'UGPM (aligné sur les autres
               profils) ; la PRMP garde « Suivi des dossiers CNM » (nom choisi le 2026-09-06, cadrage délais). -->
          <h1 class="page-title">Tous mes dossiers</h1>
        </div>
        <!-- ⚠️ 01/11 (pilote) — l'affichage « Deux volets » est retiré de cet écran : le tableau seul, avec ses compteurs et ses filtres. -->
      </header>
      <!-- Phrase de rôle (proposition 2026-09-22, lot B) : à quoi sert l'écran, pour qui. -->
      <!-- ⚠️ 14/10 — la phrase disait « les brouillons ne sont pas ici » alors que la liste les porte depuis le 13/09 (demande pilote). -->
      <p class="page-role">Tous vos dossiers, du brouillon à la clôture : leur statut, leur date d'enregistrement à la Commission et la fin de traitement prévue. La PRMP y soumet ses brouillons.</p>

      <!-- ⚠️ 01/11 (pilote, maquette « Tous mes dossiers », variante B) — les compteurs (qui filtrent aussi) et la barre de filtres :
           recherche, famille. Ils valent pour les deux affichages. -->
      @if (!loading() && !erreur() && dossiers().length) {
        <div class="sdl-cpts" role="group" aria-label="Filtrer par état">
          <button type="button" class="sdl-cpt" [attr.aria-pressed]="etatFiltre() === null" (click)="etatFiltre.set(null)"><b>{{ dossiers().length }}</b><span>tous</span></button>
          <button type="button" class="sdl-cpt sdl-cpt--vous" [attr.aria-pressed]="etatFiltre() === 'a-traiter'" (click)="basculerEtat('a-traiter')"><b>{{ comptes()['a-traiter'] }}</b><span>à traiter par vous</span></button>
          <button type="button" class="sdl-cpt" [attr.aria-pressed]="etatFiltre() === 'commission'" (click)="basculerEtat('commission')"><b>{{ comptes().commission }}</b><span>à la Commission</span></button>
          <button type="button" class="sdl-cpt" [attr.aria-pressed]="etatFiltre() === 'clos'" (click)="basculerEtat('clos')"><b>{{ comptes().clos }}</b><span>traitement terminé</span></button>
        </div>
        <div class="sdl-filtres">
          <label class="sdl-recherche" for="sdl-recherche"><span aria-hidden="true">⌕</span>
            <input id="sdl-recherche" type="search" placeholder="Référence ou type (DAOO, MAOO…)" aria-label="Rechercher un dossier"
              [value]="recherche()" (input)="recherche.set($any($event.target).value)" /></label>
          <div class="sdl-puces" role="group" aria-label="Filtrer par famille">
            <span class="sdl-puces__lib">Famille</span>
            <button type="button" class="sdl-puce" [attr.aria-pressed]="familleFiltre() === null" (click)="familleFiltre.set(null)">Toutes</button>
            @for (fm of familles(); track fm.famille) {
              <button type="button" class="sdl-puce fam-{{ fm.famille }}" [attr.aria-pressed]="familleFiltre() === fm.famille" (click)="basculerFamille(fm.famille)">
                <i aria-hidden="true"></i>{{ fm.libelle }} <span class="sdl-puce__n">{{ fm.n }}</span></button>
            }
          </div>
        </div>
      }

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le suivi des délais." (reessayer)="charger()" />
      } @else {
        <div class="table-card sdl-table">
          <table>
            <thead>
              <!-- ⚠️ 2026-09-13 (demande pilote) — colonne Statut AJOUTÉE : elle avait été écartée le
                   2026-09-06 (« l'écran suit les dates »), le pilote la réintroduit. Même badge partagé
                   que le reste de l'app (libellés Initial/Numéroté/… via statutDossierLabel). -->
              <tr>
                <th scope="col">Référence</th>
                <!-- ⚠️ 03/11 (pilote, lot 6) — chaque dossier se nomme par l'objet de son marché. -->
                <th scope="col">Objet du marché</th>
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
              @for (d of visibles(); track d.idDossier) {
                <tr class="ligne-clic" [class.cnm-row-cloture]="d.datesEtapes?.['CLOTURE']">
                  <!-- Ligne cliquable : la référence est un vrai lien (nom accessible + clavier, Ctrl+clic
                       = nouvel onglet) dont la zone cliquable est étendue à la ligne (overlay ::after) —
                       pas de (click) sur <tr>. Lot L4-F6 : il mène à la PAGE du dossier. -->
                  <td><a class="lien-ligne" [routerLink]="lien.commandes(d.idDossier)" [queryParams]="lien.params()">{{ referenceAffichee(d) }}</a></td>
                  <td class="sdl-objet">@if (d.objetMarche) { {{ d.objetMarche }}@if (d.lot != null) { <span class="sdl-lot">· lot {{ d.lot }}</span> } } @else { — }</td>
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
                <tr><td colspan="8" class="empty-cell">
                  @if (dossiers().length) { Aucun dossier ne répond à ces filtres. <button type="button" class="btn btn-link btn-sm" (click)="effacerFiltres()">Effacer les filtres</button> }
                  @else { Aucun dossier à la CNM. }
                </td></tr>
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
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    /* ⚠️ 01/11 (pilote, variante B) — compteurs qui filtrent, barre de filtres, lignes à filet de famille. */
    .sdl-cpts { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
    .sdl-cpt { display: flex; flex-direction: column; align-items: flex-start; min-width: 8.5rem; padding: 6px 14px; border: 1px solid var(--bordure); border-radius: 6px;
      background: var(--carte-fond); color: var(--texte); font: inherit; text-align: left; cursor: pointer; }
    .sdl-cpt b { font-size: 20px; font-weight: 500; line-height: 1.1; }
    .sdl-cpt span { font-size: 12px; color: var(--texte-secondaire); }
    .sdl-cpt--vous { background: var(--examen-fond); border-color: var(--examen-fond); }
    .sdl-cpt--vous span { color: var(--examen-texte); }
    .sdl-cpt[aria-pressed="true"] { border-color: var(--section-fond); box-shadow: inset 0 0 0 1px var(--section-fond); }
    .sdl-cpt:focus-visible, .sdl-puce:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: 2px; }
    .sdl-filtres { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin: 0 0 12px; padding: 8px 12px; border: 1px solid var(--bordure);
      border-radius: 6px; background: var(--carte-fond); }
    .sdl-recherche { flex: 1 1 16rem; display: flex; align-items: center; gap: 6px; min-width: 0; padding: 4px 10px; border: 1px solid var(--bordure-champ); border-radius: 4px; }
    .sdl-recherche input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: inherit; color: var(--texte); }
    .sdl-recherche:focus-within { outline: 2px solid var(--bouton-principal); outline-offset: 1px; }
    .sdl-puces { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .sdl-puces__lib { font-size: 12px; color: var(--texte-secondaire); }
    .sdl-puce { display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px; border: 1px solid var(--bordure); border-radius: 14px; background: var(--carte-fond);
      color: var(--texte); font: inherit; font-size: 12.5px; cursor: pointer; }
    .sdl-puce i { width: 9px; height: 9px; border-radius: 2px; background: var(--fam); }
    .sdl-puce__n { font-size: 11.5px; opacity: 0.8; }
    .sdl-puce[aria-pressed="true"] { background: var(--section-fond); border-color: var(--section-fond); color: var(--texte-menu); }
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
    .sdl-table td.sdl-objet { white-space: normal; min-width: 14rem; max-width: 26rem; line-height: 1.35; }
    .sdl-lot { color: var(--texte-secondaire); white-space: nowrap; }
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
  /** Sous-type → libellé (« RJ » → « Rapport justificatif (gré à gré) ») : le nom d'un brouillon sans référence. */
  private readonly sousTypes = signal<Map<string, string>>(new Map());
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
  /**
   * Tous les dossiers de la PRMP, plus récents d'abord. ⚠️ 2026-09-13 (demande pilote) : les BROUILLONS
   * sont désormais AFFICHÉS (avec un bouton « Soumettre ») — ils n'ont ni enregistrement ni délai CNM,
   * leurs colonnes de dates restent à « — ». Copie avant tri (ne jamais muter la valeur du signal).
   */
  readonly dossiers = computed(() =>
    [...this.tous()].sort((a, b) => b.idDossier - a.idDossier),
  );

  // ── ⚠️ 01/11 (pilote, variante B) — filtres et compteurs ──────────────────────────────────────
  readonly recherche = signal('');
  readonly familleFiltre = signal<FamilleDossier | null>(null);
  readonly etatFiltre = signal<EtatSuivi | null>(null);
  /** Le nombre de dossiers par état (les compteurs). */
  readonly comptes = computed(() => {
    const c: Record<EtatSuivi, number> = { 'a-traiter': 0, commission: 0, clos: 0 };
    for (const d of this.dossiers()) { const e = etatSuivi(d); if (e) c[e]++; }
    return c;
  });
  /** Les familles présentes, avec leur nombre, dans l'ordre plan → mise en concurrence → marché → autres. */
  readonly familles = computed(() => (['plan', 'mec', 'marche', 'autre'] as const)
    .map((famille) => ({ famille, libelle: LIBELLES_FAMILLE[famille], n: this.dossiers().filter((d) => familleDossier(d) === famille).length }))
    .filter((x) => x.n > 0));
  /** La liste après filtres (les deux affichages). */
  readonly visibles = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const fm = this.familleFiltre();
    const et = this.etatFiltre();
    return this.dossiers().filter((d) =>
      (!fm || familleDossier(d) === fm) && (!et || etatSuivi(d) === et)
      && (!q || `${d.refeDossier ?? ''} ${d.idSousType ?? ''} ${d.idTypeDossier ?? ''} ${d.idDossier} ${d.objetMarche ?? ''}`.toLowerCase().includes(q)));
  });
  basculerEtat(e: EtatSuivi): void { this.etatFiltre.set(this.etatFiltre() === e ? null : e); }
  basculerFamille(f: FamilleDossier): void { this.familleFiltre.set(this.familleFiltre() === f ? null : f); }
  effacerFiltres(): void { this.recherche.set(''); this.familleFiltre.set(null); this.etatFiltre.set(null); }
  constructor() {
    this.charger();
    // Libellés d'entité / localité (cache partagé) — colonnes « Entité contractante » / « Localité ».
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(SousTypeDossierService, 'idSousType', ['libelleSousType']).subscribe((m) => this.sousTypes.set(m));
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

  /**
   * ⚠️ 03/11 (lot 6) — la référence, ou pour un brouillon (sans référence) son sous-type en clair : « Rapport justificatif · brouillon »
   * plutôt que « Dossier #100400 ». L'objet du marché a sa propre colonne.
   */
  referenceAffichee(d: Dossier): string {
    if (d.refeDossier) return d.refeDossier;
    const st = d.idSousType ? this.sousTypes().get(d.idSousType) : null;
    return st ? `${st} · brouillon` : `Dossier #${d.idDossier}`;
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
