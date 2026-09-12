import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { Dispatch, Dossier, Examen, Page, PvExamen, Reception, Verification } from '../../models';
import {
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  LocaliteService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  VerificationService,
} from '../../services';
import {
  CIRCUIT_ETAPES,
  CircuitTimeline,
  EtapeInfo,
  StatutBadge,
  etapeIndexForDossier,
  etapeSuivante,
  statutDossierLabel,
} from '../../shared/circuit';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DossierConsultation } from './dossier-consultation';
import { DetailPvModal } from './detail-pv-modal';
import { DispatchForm, DispatchItem } from './dispatch-form';
import { ReceptionForm } from './reception-form';

/**
 * Pipeline des dossiers (lecture seule) : liste filtrée par le backend selon le
 * profil/localité, avec statut et timeline du circuit. Réutilisé comme tableau de
 * bord par plusieurs profils ; le titre vient de `route.data.title`.
 */
@Component({
  selector: 'app-dossiers-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, StatutBadge, CircuitTimeline, DossierConsultation, DetailPvModal, EtatErreur, DispatchForm, ReceptionForm],
  template: `
    <section class="pipeline">
      <header class="page-header pipeline__header">
        <h1 class="page-title">{{ title }}</h1>
        <div class="pipeline__vue" role="group" aria-label="Choix de l'affichage">
          <button type="button" class="btn btn-sm" [class.btn-primary]="vue() === 'frise'" [class.btn-outline]="vue() !== 'frise'" [attr.aria-pressed]="vue() === 'frise'" (click)="setVue('frise')">Frise</button>
          <button type="button" class="btn btn-sm" [class.btn-primary]="vue() === 'tableau'" [class.btn-outline]="vue() !== 'tableau'" [attr.aria-pressed]="vue() === 'tableau'" (click)="setVue('tableau')">Tableau</button>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les dossiers." (reessayer)="charger()" />
      } @else if (visibleDossiers().length === 0) {
        <p class="text-muted">{{ messageVide }}</p>
      } @else {
        @if (vue() === 'tableau') {
        <div class="pipeline__search">
          <input
            type="search"
            class="form-control"
            [value]="recherche()"
            (input)="recherche.set($any($event.target).value)"
            placeholder="Rechercher par mot-clé (référence, entité, localité, statut, type…)"
            aria-label="Rechercher un dossier"
          />
        </div>
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Date de réception</th>
                <th scope="col">Type de dossier</th>
                <th scope="col">Entité contractante</th>
                <th scope="col">Localité</th>
                <th scope="col">Statut</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiersFiltres(); track d.idDossier) {
                @let info = etapeInfo(d);
                <tr>
                  <td>{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</td>
                  <td style="white-space:nowrap;">{{ dateReceptionFmt(d) || '—' }}</td>
                  <td>{{ typeDossierLabel(d) }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td><app-statut-badge [statut]="d.statut" [label]="badgeLabel(d.statut)" /></td>
                  <td>
                    <div class="td-actions actions-end">
                      <ng-container [ngTemplateOutlet]="actionsTpl" [ngTemplateOutletContext]="{ $implicit: d, info }" />
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty-cell">Aucun dossier ne correspond à la recherche.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <ul class="pipeline__list">
          @for (d of visibleDossiers(); track d.idDossier) {
            <li class="dossier-card">
              @let info = etapeInfo(d);
              <div class="dossier-card__head">
                <span class="dossier-card__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }}@if (source) { · {{ entiteLabel(d) }}}</span>
                <!-- ⚠️ Rattachements (2026-09-01) — badge de CIBLAGE seulement : null = chaîne
                     incomplète, rien à afficher ; et aucune action n'est retirée sur les dossiers
                     ciblés sur un collègue (pas de garde serveur). -->
                @if (cibleVerif(d); as c) {
                  <span class="pipeline__cible" [class.pipeline__cible--moi]="c.moi">
                    {{ c.moi ? 'À vérifier par vous' : 'À vérifier par ' + c.nom }}
                  </span>
                }
                <div class="dossier-card__head-right">
                  <app-statut-badge [statut]="d.statut" [label]="badgeLabel(d.statut)" />
                  <ng-container [ngTemplateOutlet]="actionsTpl" [ngTemplateOutletContext]="{ $implicit: d, info }" />
                </div>
              </div>
              @if (showTimeline) {
                <app-circuit-timeline [active]="etape(d)" [sublabels]="sublabels(d)" />
              }
            </li>
          }
        </ul>
        }

        <!-- File de travail sans endpoint paginé : le reste est déjà chargé, on le RÉVÈLE. -->
        @if (resteARendre() > 0) {
          <div class="pipeline__pager">
            <button type="button" class="btn btn-secondary btn-sm" (click)="voirPlus()">
              Voir plus ({{ resteARendre() }} restants)
            </button>
          </div>
        }

        @if (paginee && totalPages() > 1) {
          <div class="pipeline__pager">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="pipeline__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      }
    </section>

    <!-- Actions d'un dossier — partagées par la frise (cartes) et le tableau (colonne Actions). -->
    <ng-template #actionsTpl let-d let-info="info">
      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Voir détails</button>
      <!-- Actions contextuelles du TABLEAU DE BORD (2026-09-12) : l'action à faire par dossier, selon
           son statut ET la capacité du profil (inline, comme « Mes dossiers »). -->
      @if (peutReceptionnerDash(d)) {
        <button type="button" class="btn btn-primary btn-sm" (click)="receptionItem.set(d)">Attribuer un numéro</button>
      }
      @if (dispatchableDe(d); as rec) {
        <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirDispatch(d, rec)">Dispatcher</button>
      }
      @if (peutExaminerDash(d)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'examiner', d.idDossier]">{{ d.statut === 'A_REEXAMINER' ? 'Réexaminer' : 'Examiner' }}</a>
      }
      @if (peutModifierExamenDash(d)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'examiner', d.idDossier]">Modifier l'examen</a>
      }
      @if (peutVerifierDash(d)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'verifier', d.idDossier]">Vérifier</a>
      }
      @if (peutTransmettreDash(d)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'verifier', d.idDossier]">Transmettre à SIGMP</a>
      }
      @if (showExamenAction && info.cle === 'EXAMEN' && peutAgir(info)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'examiner', d.idDossier]">Examiner</a>
      }
      @if (examenModifiable(d)) {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'examiner', d.idDossier]">Modifier l'examen</a>
      }
      <!-- ⚠️ File Vérificateur : le dossier à vérifier est ACCOMPAGNÉ de son PV définitif. -->
      @if (showVerifAction && pvSigne(d); as p) {
        <button type="button" class="btn btn-secondary btn-sm" (click)="pvDetail.set(p)">PV définitif</button>
      }
      @if (showVerifAction && d.statut === 'EN_VERIFICATION') {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'verifier', d.idDossier]">
          {{ pvSigne(d)?.idAvis === 'FAVR' ? 'Vérifier' : 'Transmettre la décision' }}
        </a>
      }
      @if (showVerifAction && d.statut === 'OBSERVATIONS_LEVEES') {
        <a class="btn btn-primary btn-sm" [routerLink]="[espace, 'verifier', d.idDossier]">Transmettre à SIGMP</a>
      }
      @if (showVerifAction && (d.statut === 'EN_ATTENTE_DECISION_PRMP' || d.statut === 'DECISION_TRANSMISE_SIGMP')) {
        <a class="btn btn-secondary btn-sm" [routerLink]="[espace, 'verifier', d.idDossier]">Voir</a>
      }
    </ng-template>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (pvDetail(); as p) {
      <app-detail-pv-modal [pv]="p" (fermer)="pvDetail.set(null)" />
    }
    @if (dispatchItems(); as its) {
      <app-dispatch-form [items]="its" (closed)="fermerDispatch()" (saved)="onDispatched()" />
    }
    @if (receptionItem(); as d) {
      <app-reception-form [dossier]="d" (closed)="receptionItem.set(null)" (saved)="onReception()" />
    }
  `,
  styles: `
    .pipeline__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .pipeline__vue { display: inline-flex; gap: 0.35rem; }
    .pipeline__search { margin-bottom: 0.75rem; }
    .pipeline__search .form-control { max-width: 32rem; }
    .empty-cell { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .table-card table td .td-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .table-card table td .actions-end { justify-content: flex-end; }
    .pipeline__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    /* Carte de dossier : relief doux + élévation au survol, cohérent avec le design system. */
    .dossier-card {
      background: #fff;
      border: 1px solid var(--n-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 0.9rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      transition: var(--transition);
    }
    .dossier-card:hover { border-color: var(--p-200); box-shadow: var(--shadow-lg); transform: translateY(-1px); }
    .dossier-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .dossier-card__head-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .dossier-card__ref {
      font-weight: 700;
      color: var(--n-800);
      font-size: var(--text-md);
    }
    /* Badge de ciblage (rattachements) : discret pour un collègue, accentué pour « les miens ». */
    .pipeline__cible {
      font-size: var(--text-sm);
      color: var(--n-500);
      background: var(--c-50);
      border: 1px solid var(--c-100);
      border-radius: var(--radius-lg);
      padding: 0.1rem 0.55rem;
      white-space: nowrap;
    }
    .pipeline__cible--moi {
      color: var(--p-700, #1d4ed8);
      background: var(--p-50, #eff6ff);
      border-color: var(--p-200, #bfdbfe);
      font-weight: 600;
    }
    .pipeline__pager {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1rem;
    }
    .pipeline__pager-info { font-size: var(--text-sm); color: var(--n-500); font-weight: 600; }
  `,

})
export class DossiersPipeline {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /**
   * Espace courant (`/membre`, `/verificateur`, `/president`, `/cc`…) — cible des liens Examiner /
   * Vérifier : chaque espace monte ses routes (délégation ascendante, spec 2026-08-14) ; un lien
   * absolu vers l'espace d'un autre profil serait bloqué par son roleGuard.
   */
  protected readonly espace = '/' + (this.router.url.split('/')[1] || 'membre');
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly pvService = inject(PvExamenService);
  private readonly verificationService = inject(VerificationService);
  private readonly permissions = inject(PermissionsService);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** Affichage : frise (cartes) ou tableau ; choix mémorisé par navigateur (localStorage). */
  readonly vue = signal<'frise' | 'tableau'>(this.lireVue());
  /** Recherche par mot-clé du tableau (filtre client sur les colonnes affichées). */
  readonly recherche = signal('');

  protected readonly title = (this.route.snapshot.data['title'] as string) ?? 'Dossiers';
  /** Frise du circuit par dossier ; désactivable via `route.data.timeline === false`. */
  protected readonly showTimeline = (this.route.snapshot.data['timeline'] as boolean | undefined) ?? true;
  /** Bouton « Examiner » par dossier ; activé via `route.data.examenAction === true` (écran Examens). */
  protected readonly showExamenAction = (this.route.snapshot.data['examenAction'] as boolean | undefined) ?? false;
  /** Bouton « Vérifier » par dossier ; activé via `route.data.verifAction === true` (file Vérificateur). */
  protected readonly showVerifAction = (this.route.snapshot.data['verifAction'] as boolean | undefined) ?? false;
  /** Source de données : files Membre ('a-examiner'/'examines'), files Vérificateur ('a-verifier'/'verifies'), ou undefined (dashboard). */
  protected readonly source = this.route.snapshot.data['source'] as
    | 'a-examiner'
    | 'examines'
    | 'a-verifier'
    | 'verifies'
    | 'en-attente-prmp'
    | undefined;
  /**
   * Sources paginées **par le serveur** : les deux historiques (`/examines`, `/verifies`) et, depuis
   * l'audit 2026-08-27 (C-1), le pipeline générique du tableau de bord — `GET /api/dossiers` sait
   * désormais rendre une page (livraison backend 1a83b05).
   *
   * Les trois autres sources sont des FILES DE TRAVAIL servies par des endpoints dédiés
   * (`/a-examiner`, `/a-verifier`, `/en-attente-prmp`) qui n'ont pas de variante paginée : elles
   * relèvent du rendu incrémental côté client (voir `limiteRendu`).
   */
  protected readonly paginee =
    this.source === 'examines' || this.source === 'verifies' || this.source === undefined;
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement : la liste affiche l'erreur et le bouton « Réessayer » (AUDIT.md P9). */
  readonly erreur = signal(false);
  /** Pagination (source 'examines'). */
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);
  /** PV définitif ouvert dans le modal de détail (file Vérificateur ; null = fermé). */
  readonly pvDetail = signal<PvExamen | null>(null);

  /** idDossier → PV SIGNÉ (chaîne réception → dispatch → examen → PV) — file Vérificateur. */
  private readonly pvSigneParDossier = computed(() => {
    const recDossier = new Map(this.receptions().map((r) => [r.idReception, r.idDossier]));
    const dispDossier = new Map(this.dispatchs().map((d) => [d.idDispatch, recDossier.get(d.idReception)]));
    const exDossier = new Map(
      this.examens().map((e) => [e.idExamen, e.idDispatch != null ? dispDossier.get(e.idDispatch) : undefined]),
    );
    const map = new Map<number, PvExamen>();
    for (const pv of this.pvs()) {
      if (pv.statutPv === 'SIGNE') {
        const idDossier = exDossier.get(pv.idExamen);
        if (idDossier != null) {
          map.set(idDossier, pv);
        }
      }
    }
    return map;
  });
  /** PV définitif accompagnant un dossier de la file Vérificateur (null si introuvable). */
  pvSigne(d: Dossier): PvExamen | null {
    return this.pvSigneParDossier().get(d.idDossier) ?? null;
  }

  /**
   * Rendu incrémental des files de travail (⚠️ audit 2026-08-27, C-1).
   *
   * Ces trois files n'ont pas d'endpoint paginé : leur liste arrive entière. Rien n'obligeait pour
   * autant à en poser TOUT le DOM d'un coup — chaque carte porte une frise de 7 étapes. On en rend
   * un paquet, puis d'autres à la demande : la pagination porte ici sur l'AFFICHAGE, pas sur le
   * réseau, et c'est dit tel quel à l'utilisateur (« Voir plus »).
   */
  private static readonly PAS_RENDU = 20;
  private readonly limiteRendu = signal(DossiersPipeline.PAS_RENDU);

  /**
   * Dossiers affichés (déjà scopés/exclusifs côté serveur — aucun filtre client).
   * Source paginée : la page telle quelle. File de travail : la tranche déjà dévoilée.
   */
  readonly visibleDossiers = computed(() =>
    this.paginee ? this.dossiers() : this.dossiers().slice(0, this.limiteRendu()),
  );
  /** Nombre de dossiers chargés mais pas encore rendus (0 sur une source paginée). */
  readonly resteARendre = computed(() =>
    this.paginee ? 0 : Math.max(0, this.dossiers().length - this.limiteRendu()),
  );
  /** Dévoile le paquet suivant (aucune requête : les dossiers sont déjà en mémoire). */
  voirPlus(): void {
    this.limiteRendu.update((n) => n + DossiersPipeline.PAS_RENDU);
  }

  // Collections du circuit (scopées par profil) pour dater les étapes franchies.
  private readonly receptions = signal<Reception[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);
  private readonly verifications = signal<Verification[]>([]);

  // ── Actions contextuelles du TABLEAU DE BORD (demande pilote 2026-09-12) : l'action à faire par
  //    dossier, selon son STATUT et la capacité du profil (mêmes gestes que « Mes dossiers », inline). ──
  /** Vue tableau de bord (source non définie) : seule à porter les actions contextuelles. */
  private get dashboard(): boolean {
    return this.source === undefined;
  }
  /** idDossier → dernière réception (par date). */
  private readonly recByDossier = computed(() => {
    const m = new Map<number, Reception>();
    for (const r of this.receptions()) {
      const prec = m.get(r.idDossier);
      if (!prec || (r.dateReception ?? '') >= (prec.dateReception ?? '')) m.set(r.idDossier, r);
    }
    return m;
  });
  /** idDossier → dernier dispatch (via sa réception) — donne l'attributaire courant. */
  private readonly dispatchByDossier = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const m = new Map<number, Dispatch>();
    for (const disp of this.dispatchs()) {
      const idD = recById.get(disp.idReception)?.idDossier;
      if (idD == null) continue;
      const prec = m.get(idD);
      if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) m.set(idD, disp);
    }
    return m;
  });
  /** idDossier → réception COMPLÈTE non encore dispatchée (= la réception à passer au formulaire). */
  private readonly recDispatchable = computed(() => {
    const dispatched = new Set(this.dispatchs().map((d) => d.idReception));
    const recComplete = new Map<number, Reception>();
    for (const r of this.receptions()) {
      const prec = recComplete.get(r.idDossier);
      if (!prec || (r.complet && !prec.complet)) recComplete.set(r.idDossier, r);
    }
    const m = new Map<number, Reception>();
    for (const [idD, r] of recComplete) if (!dispatched.has(r.idReception)) m.set(idD, r);
    return m;
  });

  /** « Attribuer un numéro » : dossier déposé, non encore réceptionné, et je porte la réception. */
  peutReceptionnerDash(d: Dossier): boolean {
    return this.dashboard && d.statut === 'SOUMIS' && this.permissions.can('RECEPTION_WRITE') && !this.recByDossier().has(d.idDossier);
  }
  /** « Dispatcher » : dossier numéroté (PRET_DISPATCH), je peux dispatcher — renvoie la réception à dispatcher. */
  dispatchableDe(d: Dossier): Reception | null {
    if (!this.dashboard || d.statut !== 'PRET_DISPATCH' || !this.permissions.can('DISPATCH_WRITE')) return null;
    return this.recDispatchable().get(d.idDossier) ?? null;
  }
  /** « Examiner / Réexaminer » : dossier dispatché à MOI (attributaire courant), et je porte l'examen. */
  peutExaminerDash(d: Dossier): boolean {
    return (
      this.dashboard &&
      (d.statut === 'DISPATCHE' || d.statut === 'A_REEXAMINER') &&
      this.permissions.can('EXAMEN_WRITE') &&
      this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre === this.auth.ref()
    );
  }
  /**
   * « Modifier l'examen » : dossier déjà EXAMINÉ attribué à MOI, tant que son projet de PV n'est pas
   * soumis. Reprend, INLINE sur le tableau de bord, la seule action que portait la file « Examinés »
   * (délégation Membre) — pour que « Tous les dossiers » reste complet sans onglet séparé.
   */
  peutModifierExamenDash(d: Dossier): boolean {
    return (
      this.dashboard &&
      d.statut === 'EXAMINE' &&
      this.permissions.can('EXAMEN_WRITE') &&
      this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre === this.auth.ref() &&
      !this.pvSoumisDossiers().has(d.idDossier)
    );
  }
  /** « Vérifier » : dossier en vérification, et je porte la vérification. */
  peutVerifierDash(d: Dossier): boolean {
    return this.dashboard && d.statut === 'EN_VERIFICATION' && this.permissions.can('VERIFICATION_WRITE');
  }
  /** « Transmettre à SIGMP » : observations levées, et je porte la vérification. */
  peutTransmettreDash(d: Dossier): boolean {
    return this.dashboard && d.statut === 'OBSERVATIONS_LEVEES' && this.permissions.can('VERIFICATION_WRITE');
  }

  /** Dossier + réception dont le formulaire de dispatch est ouvert (null = fermé). */
  readonly dispatchItems = signal<DispatchItem[] | null>(null);
  /** Dossier dont le formulaire de réception est ouvert (null = fermé). */
  readonly receptionItem = signal<Dossier | null>(null);
  ouvrirDispatch(d: Dossier, rec: Reception): void {
    this.dispatchItems.set([{ dossier: d, reception: rec }]);
  }
  fermerDispatch(): void {
    this.dispatchItems.set(null);
  }
  onDispatched(): void {
    this.dispatchItems.set(null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }
  onReception(): void {
    this.receptionItem.set(null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }

  /**
   * idDossier dont le projet de PV est déjà SOUMIS (statut ≠ BROUILLON) — l'examen n'est alors plus
   * « modifiable » depuis « Dossiers examinés ». Résolu par la chaîne PV → examen → dispatch → réception.
   * (Un PV signé quitte `GET /api/pv-examens` mais son dossier passe PV_SIGNE ≠ EXAMINE : géré par le statut.)
   */
  private readonly pvSoumisDossiers = computed(() => {
    const recDossier = new Map(this.receptions().map((r) => [r.idReception, r.idDossier]));
    const dispDossier = new Map(this.dispatchs().map((d) => [d.idDispatch, recDossier.get(d.idReception)]));
    const exDossier = new Map(
      this.examens().map((e) => [e.idExamen, e.idDispatch != null ? dispDossier.get(e.idDispatch) : undefined]),
    );
    const set = new Set<number>();
    for (const pv of this.pvs()) {
      if (pv.statutPv !== 'BROUILLON') {
        const idDossier = exDossier.get(pv.idExamen);
        if (idDossier != null) set.add(idDossier);
      }
    }
    return set;
  });

  constructor() {
    this.charger();
    // Libellés d'entité + localité (cache partagé) — colonnes « Entité contractante » / « Localité » de
    // la vue tableau (chargés inconditionnellement : sur le dashboard `source` est nul mais le tableau
    // les affiche) et files Membre qui montrent déjà l'entité.
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.lookups
      .lookup(LocaliteService, 'idLocalite', ['libelleLocalite'])
      .subscribe((m) => this.localiteMap.set(m));
    // Suppression d'un dossier propagée depuis un autre écran → retrait local immédiat de sa carte.
    this.dossiersRefresh.supprime$
      .pipe(takeUntilDestroyed())
      .subscribe((idDossier) => this.dossiers.update((arr) => arr.filter((d) => d.idDossier !== idDossier)));
  }

  /**
   * ⚠️ Rattachements (2026-09-01) — dans les files Vérificateur, les dossiers dont je suis le
   * Vérificateur CIBLE remontent en tête (« les miens », tri stable : l'ordre serveur est conservé
   * dans chaque groupe). CIBLAGE seulement — aucune action n'est retirée sur les autres dossiers.
   */
  private prioriserMesCibles(rows: Dossier[]): Dossier[] {
    const ref = this.auth.ref();
    if (!ref) return rows;
    return [...rows].sort(
      (a, b) => (b.imVerificateurCible === ref ? 1 : 0) - (a.imVerificateurCible === ref ? 1 : 0),
    );
  }

  /** Badge de ciblage (files Vérificateur) — `null` (chaîne incomplète, repli localité) = aucun badge. */
  cibleVerif(d: Dossier): { moi: boolean; nom: string } | null {
    if (this.source !== 'a-verifier' && this.source !== 'en-attente-prmp') return null;
    const im = d.imVerificateurCible;
    if (!im) return null;
    return { moi: im === this.auth.ref(), nom: d.nomVerificateurCible || im };
  }

  /** Échec de chargement : le corps de la liste affiche l'erreur et propose de relancer (AUDIT.md P9). */
  private echec(): void {
    this.loading.set(false);
    this.erreur.set(true);
  }

  /** Charge la source de l'écran. Rejouable tel quel depuis le bouton « Réessayer ». */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.limiteRendu.set(DossiersPipeline.PAS_RENDU);
    if (this.source === 'a-verifier') {
      // a-verifier renvoie EN_VERIFICATION + EN_ATTENTE_DECISION_PRMP ; tri par date de réception DESC.
      // ⚠️ La chaîne dispatchs/examens + les PV DÉFINITIFS accompagnent chaque dossier (bouton « PV définitif »).
      forkJoin({
        dossiers: this.dossierService.aVerifier(),
        receptions: this.receptionService.list(),
        dispatchs: this.dispatchService.list(),
        examens: this.examenService.list(),
        pvs: this.pvService.definitifs(),
      }).subscribe({
        next: ({ dossiers, receptions, dispatchs, examens, pvs }) => {
          this.receptions.set(receptions);
          this.dispatchs.set(dispatchs);
          this.examens.set(examens);
          this.pvs.set(pvs);
          const dateRecept = new Map<number, string>();
          for (const r of receptions) {
            const cur = dateRecept.get(r.idDossier) ?? '';
            if ((r.dateReception ?? '') > cur) {
              dateRecept.set(r.idDossier, r.dateReception ?? '');
            }
          }
          this.dossiers.set(
            this.prioriserMesCibles(
              [...dossiers].sort((a, b) =>
                (dateRecept.get(b.idDossier) ?? '').localeCompare(dateRecept.get(a.idDossier) ?? ''),
              ),
            ),
          );
          this.loading.set(false);
        },
        error: () => this.echec(),
      });
    } else if (this.source === 'a-examiner' || this.source === 'en-attente-prmp') {
      // Files de travail scopées serveur (DISPATCHE / EN_ATTENTE_DECISION_PRMP), sans filtre client.
      const call =
        this.source === 'en-attente-prmp' ? this.dossierService.enAttentePrmp() : this.dossierService.aExaminer();
      call.subscribe({
        next: (rows) => {
          this.dossiers.set(this.source === 'en-attente-prmp' ? this.prioriserMesCibles(rows) : rows);
          this.loading.set(false);
        },
        error: () => this.echec(),
      });
    } else if (this.paginee) {
      // Dashboard (source undefined) ET « Dossiers examinés » (source 'examines') sont paginés.
      this.chargerPage(0);
      // ⚠️ Les collections du circuit datent la frise (dashboard) et masquent « Modifier l'examen »
      // (examinés). Chargées EN ENTIER une seule fois (aucune ne se filtre par dossier côté serveur ;
      // audit C-1). ⚠️ 2026-09-07 : sur le DASHBOARD, la frise préfère `Dossier.datesEtapes` du DTO
      // (servi avec la page, indépendant de la portée) — ces collections ne sont qu'un REPLI pour
      // les profils qui les voient (dispatchs/examens sont vides pour le Président).
      if (this.source === 'examines' || this.source === undefined) {
        forkJoin({
          pvs: this.pvService.list(),
          examens: this.examenService.list(),
          dispatchs: this.dispatchService.list(),
          receptions: this.receptionService.list(),
          verifications: this.verificationService.list(),
        }).subscribe((r) => {
          this.pvs.set(r.pvs);
          this.examens.set(r.examens);
          this.dispatchs.set(r.dispatchs);
          this.receptions.set(r.receptions);
          this.verifications.set(r.verifications);
        });
      }
    }
  }

  /** Charge une page de la source paginée courante (historiques Membre/Vérificateur, ou pipeline générique). */
  private chargerPage(page: number): void {
    this.loading.set(true);
    const call =
      this.source === 'verifies'
        ? this.dossierService.verifies(page, this.pageSize)
        : this.source === 'examines'
          ? this.dossierService.examines(page, this.pageSize)
          : this.dossierService.listePage(page, this.pageSize);
    call.subscribe({
      next: (p) => this.appliquerPage(p),
      error: () => this.echec(),
    });
  }

  /** Installe une page reçue (contenu, position, total). */
  private appliquerPage(p: Page<Dossier>): void {
    this.dossiers.set(p.content);
    this.pageIndex.set(p.number);
    this.totalPages.set(p.totalPages);
    this.loading.set(false);
  }
  prevPage(): void {
    if (this.pageIndex() > 0) {
      this.chargerPage(this.pageIndex() - 1);
    }
  }
  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.chargerPage(this.pageIndex() + 1);
    }
  }

  /** Message d'absence de données selon la source. */
  protected get messageVide(): string {
    switch (this.source) {
      case 'examines':
        return 'Aucun dossier examiné.';
      case 'a-examiner':
        return 'Aucun dossier à examiner.';
      case 'a-verifier':
        return 'Aucun dossier à vérifier.';
      case 'verifies':
        return 'Aucun dossier vérifié ou clôturé.';
      case 'en-attente-prmp':
        return 'Aucun dossier en attente de décision PRMP.';
      default:
        return 'Aucun dossier visible dans votre périmètre.';
    }
  }

  /**
   * « Modifier l'examen » (source 'examines') : visible tant que le dossier est EXAMINE **et** que
   * son projet de PV n'a pas encore été soumis (une fois soumis, l'examen se gère via le PV/la navette).
   */
  examenModifiable(d: Dossier): boolean {
    return this.source === 'examines' && d.statut === 'EXAMINE' && !this.pvSoumisDossiers().has(d.idDossier);
  }

  /** Libellé de l'entité du dossier (cache, sans appel par ligne). */
  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }

  /** Libellé de la localité du dossier (cache) — colonne « Localité » du tableau. */
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }

  /** Date de réception (1ʳᵉ étape du circuit) formatée `jj/mm/aaaa`, vide si non franchie. */
  dateReceptionFmt(d: Dossier): string {
    const iso = this.datesByDossier().get(d.idDossier)?.[0];
    return iso ? DossiersPipeline.dateCourte(iso) : '';
  }

  /**
   * Type de dossier affiché en CODE concis (`idSousType`, ex. « PPM-AGPM », celui de la référence) plutôt
   * qu'en libellé (le libellé du sous-type est une phrase entière, illisible en colonne). Repli famille.
   */
  typeDossierLabel(d: Dossier): string {
    return d.idSousType ?? d.idTypeDossier ?? '—';
  }

  /**
   * Dossiers du tableau après filtre par mot-clé : chaque mot saisi doit apparaître dans l'une des
   * colonnes affichées (référence, date, type, entité, localité, statut). Filtre CLIENT — porte sur la
   * page chargée (le dashboard est paginé serveur).
   */
  readonly dossiersFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const base = this.visibleDossiers();
    if (!q) return base;
    const mots = q.split(/\s+/);
    return base.filter((d) => {
      const hay = [
        d.refeDossier ?? 'Dossier #' + d.idDossier,
        this.dateReceptionFmt(d),
        this.typeDossierLabel(d),
        this.entiteLabel(d),
        this.localiteLabel(d),
        d.statut ? statutDossierLabel(d.statut) : '',
      ]
        .join(' ')
        .toLowerCase();
      return mots.every((m) => hay.includes(m));
    });
  });

  /** Lecture du choix d'affichage mémorisé (tolère un localStorage indisponible/bloqué). */
  private lireVue(): 'frise' | 'tableau' {
    try {
      return localStorage.getItem('cnm-pipeline-vue') === 'tableau' ? 'tableau' : 'frise';
    } catch {
      return 'frise';
    }
  }
  /** Bascule l'affichage et mémorise le choix (best-effort). */
  setVue(v: 'frise' | 'tableau'): void {
    this.vue.set(v);
    try {
      localStorage.setItem('cnm-pipeline-vue', v);
    } catch {
      /* localStorage indisponible : le choix ne persiste pas, sans conséquence. */
    }
  }

  /** Libellé contextuel du badge dans la file Vérificateur : « En attente PRMP » pour EN_ATTENTE_DECISION_PRMP. */
  badgeLabel(statut?: string): string | null {
    return statut === 'EN_ATTENTE_DECISION_PRMP' ? 'En attente PRMP' : null;
  }

  /** Dates des 7 étapes par dossier (jointure réception → dispatch → examen → PV → vérification). */
  private readonly datesByDossier = computed(() => {
    const map = new Map<number, (string | undefined)[]>();
    const recs = this.receptions();
    const disps = this.dispatchs();
    const exs = this.examens();
    const pvs = this.pvs();
    const verifs = this.verifications();
    // Bornée aux dossiers RENDUS : ce croisement est en O(dossiers × collections du circuit).
    for (const d of this.visibleDossiers()) {
      const rOfD = recs.filter((r) => r.idDossier === d.idDossier);
      const recIds = new Set(rOfD.map((r) => r.idReception));
      const dOfD = disps.filter((x) => recIds.has(x.idReception));
      const dispIds = new Set(dOfD.map((x) => x.idDispatch));
      const eOfD = exs.filter((e) => e.idDispatch != null && dispIds.has(e.idDispatch));
      const exIds = new Set(eOfD.map((e) => e.idExamen));
      const pOfD = pvs.filter((p) => exIds.has(p.idExamen));
      const pvIds = new Set(pOfD.map((p) => p.idPv));
      const vOfD = verifs.filter((v) => recIds.has(v.idReception) || (v.idPv != null && pvIds.has(v.idPv)));
      const recInit = rOfD.find((r) => r.numPassage === 1) ?? rOfD[0];
      const pv = pOfD[0];
      // Dates par jointure (valables pour les profils qui voient dispatchs/examens).
      const parJointure = [
        recInit?.dateReception,
        dOfD[0]?.dateDispatch,
        eOfD[0]?.dateExamen,
        pv?.dateSoumissionInitiale,
        pv?.datePv ?? pv?.dateSignatureMembre ?? pv?.dateSignaturePresident ?? pv?.dateSignatureCc,
        vOfD[0]?.dateVerif,
        d.statut === 'CLOTURE' ? (vOfD.find((v) => v.obsLevees)?.dateVerif ?? vOfD[0]?.dateVerif) : undefined,
      ];
      // ⚠️ Dates d'étapes du DTO (chronométrage, en lot — demande 2026-09-07) : PRIORITAIRES car
      // indépendantes de la portée (le Président « toutes localités » a dispatchs/examens vides).
      // Repli sur la jointure étape par étape tant que le champ n'est pas servi.
      const parChrono = d.datesEtapes;
      map.set(
        d.idDossier,
        CIRCUIT_ETAPES.map((e, i) => (parChrono?.[e.key] ?? undefined) || parJointure[i]),
      );
    }
    return map;
  });

  etape(d: Dossier): number {
    return etapeIndexForDossier(d.statut);
  }

  /**
   * Libellés sous chaque point : date d'étape franchie ; sinon, statut sur l'étape en cours.
   *
   * ⚠️ Calculés UNE fois par jeu de données, pas à chaque appel : ce tableau est passé en entrée
   * à `app-circuit-timeline` (OnPush). Reconstruit à chaque cycle, il changeait d'identité et
   * forçait le re-rendu de la frise de CHAQUE ligne du pipeline (AUDIT.md P6).
   */
  private readonly sublabelsByDossier = computed(() => {
    const dates = this.datesByDossier();
    const map = new Map<number, string[]>();
    for (const d of this.visibleDossiers()) {
      const datesDossier = dates.get(d.idDossier) ?? [];
      const active = etapeIndexForDossier(d.statut);
      map.set(
        d.idDossier,
        CIRCUIT_ETAPES.map((_, i) =>
          datesDossier[i]
            ? DossiersPipeline.dateCourte(datesDossier[i] as string)
            : i === active
              ? statutDossierLabel(d.statut)
              : '',
        ),
      );
    }
    return map;
  });
  /**
   * `dd/MM/yyyy` depuis une date/heure serveur (`yyyy-MM-dd[THH:mm]` ou `yyyy-MM-dd HH:mm`) : on
   * lit les 10 premiers caractères (la partie date, quel que soit le séparateur d'heure).
   */
  private static dateCourte(s: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }
  /** Référence STABLE (voir `sublabelsByDossier`) — ne jamais reconstruire le tableau ici. */
  private static readonly SANS_LIBELLE: string[] = [];
  sublabels(d: Dossier): string[] {
    return this.sublabelsByDossier().get(d.idDossier) ?? DossiersPipeline.SANS_LIBELLE;
  }

  etapeInfo(d: Dossier): EtapeInfo {
    return etapeSuivante(d.statut);
  }

  /** Vrai si le profil connecté peut agir à l'étape attendue du dossier. */
  peutAgir(info: EtapeInfo): boolean {
    return info.capability !== null && this.permissions.can(info.capability);
  }
}
