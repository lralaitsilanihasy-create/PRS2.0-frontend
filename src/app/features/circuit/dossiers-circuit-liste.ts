import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';

import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { Dispatch, Dossier, Reception, StatutPv } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  LocaliteService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ToastService } from '../../core/notifications/toast.service';
import { StatutBadge, examenRectifiable } from '../../shared/circuit';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { DispatchForm, DispatchItem } from './dispatch-form';
import { DossierConsultation } from './dossier-consultation';
import { ReceptionForm } from './reception-form';
import { ClassementConfig, ColonneCircuit, dossierAttribueAMoi, dossierExcluDuGroupe, dossierHorsFileAttribuee, dossiersDuClassement } from './classement-config';

/**
 * Liste des dossiers d'un **type** et d'un **groupe** de classement (statuts issus de `data.classement`),
 * en **lecture seule** (consultation via `DossierConsultation`). Drill-down de `DossiersClassement`
 * (Président / CC). Colonnes enrichies selon le groupe (`colonnes` : réception / date dispatch / attributaire),
 * jointes depuis réceptions + dispatchs (idDossier → réception → dispatch). Route : `{base}/:type/:groupe`.
 */
@Component({
  selector: 'app-dossiers-circuit-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation, DatePipe, DispatchForm, ModaleDirective, ReceptionForm, RouterLink],
  template: `
    <section>
      @if (!embed()) {
        <header class="page-header">
          <div>
            <div class="page-subtitle">{{ cfg.subtitle }}</div>
            <h1 class="page-title">{{ titre() }}</h1>
          </div>
        </header>
      }

      @if (referenceAttribuee(); as ref) {
        <div class="alert alert-success dcl__ref">
          <span>Réception enregistrée — <strong>Référence attribuée : {{ ref }}</strong></span>
          <span class="dcl__ref-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="copier(ref)">Copier</button>
            <button type="button" class="dcl__ref-close" aria-label="Fermer" (click)="referenceAttribuee.set(null)">&times;</button>
          </span>
        </div>
      }

      @if (coches().size >= 2) {
        <div class="alert alert-info dcl__lot">
          <span><strong>{{ coches().size }}</strong> dossiers sélectionnés</span>
          <span class="dcl__lot-actions">
            <button type="button" class="btn btn-outline btn-sm" (click)="deselectionner()">Tout décocher</button>
            <button type="button" class="btn btn-sm dcl__btn-lot" (click)="dispatcherSelection()">
              Dispatcher la sélection ({{ coches().size }})
            </button>
          </span>
        </div>
      }

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-card">
          @if (embed()) {
            <div class="dcl__embed-titre">{{ titre() }}</div>
          }
          <table>
            <thead>
              <tr>
                @if (avecSelection()) {
                  <th scope="col" class="dcl__check-col">
                    <input
                      type="checkbox"
                      [checked]="toutEstCoche()"
                      (change)="toutCocher()"
                      aria-label="Tout sélectionner (une seule localité)"
                    />
                  </th>
                }
                <th scope="col">Référence</th>
                <th scope="col">Entité contractante</th>
                @if (aColonne('reception')) { <th scope="col">Réception sec.</th> }
                @if (aColonne('dateDispatch')) { <th scope="col">Date dispatch</th> }
                @if (aColonne('attributaire')) { <th scope="col">Attributaire</th> }
                <th scope="col">Statut</th>
                <th scope="col">Localité</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr>
                  @if (avecSelection()) {
                    <td class="dcl__check-col">
                      @if (peutDispatcher(d)) {
                        <input
                          type="checkbox"
                          [checked]="coches().has(d.idDossier)"
                          [disabled]="!cochable(d)"
                          [title]="cochable(d) ? '' : 'Sélection limitée à une seule localité'"
                          [attr.aria-label]="'Sélectionner ' + (d.refeDossier || '#' + d.idDossier)"
                          (change)="basculerCoche(d.idDossier)"
                        />
                      }
                    </td>
                  }
                  <td>{{ d.refeDossier || '—' }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  @if (aColonne('reception')) {
                    <td style="white-space:nowrap;">{{ (dateReception(d) | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                  }
                  @if (aColonne('dateDispatch')) {
                    <td style="white-space:nowrap;">{{ (dateDispatch(d) | date: 'dd/MM/yyyy HH:mm') || '—' }}</td>
                  }
                  @if (aColonne('attributaire')) {
                    <td>{{ attributaire(d) }}</td>
                  }
                  <td>
                    @if (d.statut) { <app-statut-badge [statut]="d.statut" /> } @else { — }
                    @if (aExamenEnCours(d)) {
                      <span class="badge dcl__brouillon" title="Un examen est commencé (brouillon enregistré) — reprise possible via « Examiner ».">Examen en cours</span>
                    }
                  </td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Voir détails</button>
                      @if (peutDispatcher(d); as rec) {
                        <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirDispatch(d, rec)">Dispatcher</button>
                      }
                      @if (peutReattribuer(d)) {
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          title="Ce dossier vous a été dispatché : réattribuez-le à un Membre de votre commission — ou examinez-le vous-même."
                          (click)="ouvrirReattribution(d)"
                        >Dispatcher</button>
                      }
                      @if (peutReceptionner(d)) {
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          [title]="permissions.parDelegation('RECEPTION_WRITE') ? 'Tâche du profil Secrétaire — exercée par délégation active.' : ''"
                          (click)="receptionItem.set(d)"
                        >Attribuer un numéro</button>
                      }
                      @if (peutAnnulerDispatch(d)) {
                        <button type="button" class="btn btn-danger btn-sm" (click)="annulation.set(d)">Retirer</button>
                      }
                      @if (peutRendre(d)) {
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          title="Rendre le dossier : il retourne en pré-dispatch — vous n'en serez plus l'attributaire."
                          (click)="annulation.set(d)"
                        >Retirer</button>
                      }
                      @if (aActionExamen()) {
                        <a
                          class="btn btn-primary btn-sm"
                          [routerLink]="[espace(), 'examiner', d.idDossier]"
                          [title]="permissions.parDelegation('EXAMEN_WRITE') ? 'Tâche du profil Membre — exercée par délégation active.' : ''"
                        >{{ d.statut === 'A_REEXAMINER' ? 'Réexaminer' : 'Examiner' }}</a>
                      }
                      @if (examenModifiable(d)) {
                        <a
                          class="btn btn-primary btn-sm"
                          [routerLink]="[espace(), 'examiner', d.idDossier]"
                          [title]="permissions.parDelegation('EXAMEN_WRITE') ? 'Tâche du profil Membre — exercée par délégation active.' : ''"
                        >Modifier l'examen</a>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="colspan()" class="empty-cell">Aucun dossier dans ce groupe.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
    @if (dispatchItems(); as its) {
      <app-dispatch-form [items]="its" [reattribution]="reattribution()" (closed)="fermerDispatch()" (saved)="onDispatched()" />
    }
    @if (receptionItem(); as d) {
      <app-reception-form [dossier]="d" (closed)="receptionItem.set(null)" (saved)="onReception($event)" />
    }
    @if (annulation(); as d) {
      <div class="modal-backdrop" [class.closing]="closingAnnulation()">
        <div class="modal dcl__confirm" role="alertdialog" aria-modal="true" aria-label="Confirmation d'annulation" appModale appModaleClicExterieur (appModaleFermer)="fermerAnnulation()">
          <div class="modal-body">
            @if (estRendu(d)) {
              <p>Rendre le dossier <strong>{{ d.refeDossier || '#' + d.idDossier }}</strong> ?</p>
            } @else {
              <p>
                Retirer le dossier <strong>{{ d.refeDossier || '#' + d.idDossier }}</strong> à
                <strong>{{ attributaire(d) }}</strong> ?
              </p>
            }
            @if (estReprise(d)) {
              <p class="dcl__confirm-hint">
                Le dossier <strong>vous reviendra</strong> : il rejoindra vos dossiers
                « <strong>À examiner</strong> » (vous pourrez l'examiner ou le réattribuer) — il ne
                repart pas en pré-dispatch.
              </p>
            } @else if (estRendu(d)) {
              <p class="dcl__confirm-hint">
                Vous <strong>rendez</strong> le dossier : il retournera en <strong>Pré-dispatch</strong>
                et vous n'en serez plus l'attributaire. Tout examen déjà commencé sera supprimé.
              </p>
            } @else {
              <p class="dcl__confirm-hint">
                Le dispatch sera annulé : le dossier reviendra en <strong>Pré-dispatch</strong> (re-dispatchable),
                tout examen déjà commencé sera supprimé et le Membre sera notifié.
              </p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerAnnulation()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="annulationEnCours()" (click)="confirmerAnnulation()">
              {{ annulationEnCours() ? 'Retrait…' : estRendu(d) ? 'Rendre le dossier' : 'Retirer le dossier' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .actions-end { justify-content: flex-end; }
    .empty-cell { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .dcl__embed-titre { padding: 0.85rem 1rem 0; font-weight: 700; color: var(--n-800); }
    .dcl__ref { justify-content: space-between; align-items: center; }
    .dcl__ref-actions { display: flex; align-items: center; gap: 0.5rem; }
    .dcl__ref-close { background: transparent; border: 0; color: inherit; font-size: 1.25rem; line-height: 1; cursor: pointer; }
    .dcl__lot { justify-content: space-between; align-items: center; }
    .dcl__lot-actions { display: flex; align-items: center; gap: 0.5rem; }
    /* Fuchsia vif demandé par le user (dérogation assumée aux tokens, comme l'accent corail des cartes contrôleurs). */
    .dcl__btn-lot { background: linear-gradient(135deg, #e935c1, #b31fa0); color: #fff; border-color: transparent; box-shadow: 0 3px 10px rgba(217, 70, 239, 0.45); }
    .dcl__btn-lot:hover:not(:disabled) { background: linear-gradient(135deg, #f04fd0, #c62bb2); transform: translateY(-1px); box-shadow: 0 5px 14px rgba(217, 70, 239, 0.55); }
    .dcl__check-col { width: 2.2rem; text-align: center; }
    .dcl__check-col input { cursor: pointer; }
    .dcl__check-col input:disabled { cursor: not-allowed; }
    .dcl__confirm { max-width: 28rem; }
    .dcl__confirm-hint { margin: 0.5rem 0 0; color: var(--n-500); font-size: var(--text-sm); }
    /* Brouillon d'examen (couleur « en cours » de l'examen : indigo). */
    .dcl__brouillon { margin-left: 0.4rem; background: #E0E7FF; color: #4338CA; border: 1px solid #C7D2FE; }
  `,
})
export class DossiersCircuitListe {
  private readonly route = inject(ActivatedRoute);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly pvExamenService = inject(PvExamenService);
  private readonly lookups = inject(ReferenceLookupService);
  protected readonly permissions = inject(PermissionsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly cfg = this.route.snapshot.data['classement'] as ClassementConfig;

  /** Mode embarqué (liste inline sous le classement) : type + groupe fournis par le parent, en-tête masqué. */
  readonly embed = input<{ type: string; groupe: string } | null>(null);

  readonly type = signal<string>('');
  readonly groupe = signal<string>('');
  readonly dossiers = signal<Dossier[]>([]);
  readonly loading = signal(false);
  readonly consulte = signal<Dossier | null>(null);
  /** Dossiers + réceptions dont le formulaire de dispatch est ouvert (1 = unitaire, plusieurs = lot ; null = fermé). */
  readonly dispatchItems = signal<DispatchItem[] | null>(null);
  /** Dispatch existant à RÉATTRIBUER (mode PUT du formulaire) ; null = dispatch classique (POST). */
  readonly reattribution = signal<Dispatch | null>(null);
  /** idDossier cochés pour le dispatch en lot (contrainte : une seule localité). */
  readonly coches = signal<Set<number>>(new Set());
  /** Dossier dont le formulaire de réception est ouvert (null = fermé). */
  readonly receptionItem = signal<Dossier | null>(null);
  /** Dossier dont la confirmation de retrait (annulation du dispatch) est ouverte (null = fermée). */
  readonly annulation = signal<Dossier | null>(null);
  /** Animation de sortie du modal de confirmation (voir `fermerAvecAnimation`). */
  readonly closingAnnulation = signal(false);
  /** Ferme la confirmation en jouant l'animation de sortie (voile, Échap, bouton Annuler). */
  fermerAnnulation(): void {
    fermerAvecAnimation(this.closingAnnulation, () => this.annulation.set(null));
  }
  readonly annulationEnCours = signal(false);
  /** Référence officielle attribuée à la dernière réception (affichée + copiable ; null = masquée). */
  readonly referenceAttribuee = signal<string | null>(null);

  /** idDossier → dernière réception (pour « Réception sec. »). */
  private readonly recByDossier = signal<Map<number, Reception>>(new Map());
  /** idDossier → réception à dispatcher (complète, non encore dispatchée) — pour l'action « Dispatcher ». */
  private readonly recDispatchable = signal<Map<number, Reception>>(new Map());
  /** idDossier → dernier dispatch (pour « Date dispatch » / « Attributaire »). */
  private readonly dispatchByDossier = signal<Map<number, Dispatch>>(new Map());
  /** idDossier → statut de son projet de PV (absent = aucun PV). Décide de l'ouverture de l'examen. */
  private readonly statutPvParDossier = signal<Map<number, StatutPv>>(new Map());
  /** idDossier ayant un examen (brouillon si le dossier est encore DISPATCHE) → badge « Examen en cours ». */
  private readonly dossiersAvecExamen = signal<Set<number>>(new Set());

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  readonly typeLabel = computed(() => this.typeMap().get(this.type()) ?? this.type());
  private readonly groupeConfig = computed(() => this.cfg.groupes.find((g) => g.key === this.groupe()));
  readonly groupeLabel = computed(() => this.groupeConfig()?.label ?? this.groupe());
  readonly titre = computed(() => `${this.typeLabel()} — ${this.groupeLabel()}`);
  /** Colonnes supplémentaires actives pour le groupe courant. */
  private readonly colonnes = computed(() => new Set(this.groupeConfig()?.colonnes ?? []));
  /** Colspan de la ligne vide = 5 colonnes de base + colonnes optionnelles + sélection éventuelle. */
  readonly colspan = computed(() => 5 + this.colonnes().size + (this.avecSelection() ? 1 : 0));
  /** L'utilisateur peut-il dispatcher ? (capacité DISPATCH_WRITE — Président et CC, comme au backend ; interim=false car l'écran CC est scopé à sa localité). */
  private readonly canDispatch = computed(() => this.permissions.can('DISPATCH_WRITE'));
  /** Ce groupe propose-t-il l'action « Dispatcher » ? (config `actionDispatch`). */
  private readonly aActionDispatch = computed(() => !!this.groupeConfig()?.actionDispatch);
  /** Ce groupe propose-t-il la réattribution ? (config `actionReattribuer`). */
  private readonly aActionReattribuer = computed(() => !!this.groupeConfig()?.actionReattribuer);
  /** Ce groupe propose-t-il « Retirer » (rendre au pré-dispatch) sur MES attributions ? (config `actionRendre`). */
  private readonly aActionRendre = computed(() => !!this.groupeConfig()?.actionRendre);
  /** Colonne de sélection (dispatch en lot) affichée ? — mêmes conditions que l'action « Dispatcher ». */
  readonly avecSelection = computed(() => this.aActionDispatch() && this.canDispatch());
  /** Localité de la sélection courante (celle du premier dossier coché ; null = sélection vide). */
  private readonly localiteSelection = computed(() => {
    const set = this.coches();
    if (!set.size) return null;
    return this.dossiers().find((d) => set.has(d.idDossier))?.idLocalite ?? null;
  });
  /** « Tout sélectionner » coché = toutes les lignes dispatchables de la localité de sélection le sont. */
  readonly toutEstCoche = computed(() => {
    const set = this.coches();
    if (!set.size) return false;
    const loc = this.localiteSelection();
    const rows = this.dossiers().filter((d) => this.peutDispatcher(d) && d.idLocalite === loc);
    return rows.length > 0 && rows.every((d) => set.has(d.idDossier));
  });
  /** Ce groupe propose-t-il « Attribuer un numéro » (enregistrer la réception) ? (config `actionReception` — espace Secrétaire). */
  private readonly aActionReception = computed(() => !!this.groupeConfig()?.actionReception);
  /** Ce groupe propose-t-il « Retirer » (annuler le dispatch) ? (config `actionAnnulerDispatch`). */
  private readonly aActionAnnulerDispatch = computed(() => !!this.groupeConfig()?.actionAnnulerDispatch);
  /**
   * Ce groupe propose-t-il l'action « Examiner » ? Config `actionExamen` ET capacité EXAMEN_WRITE —
   * titulaire (Membre) OU délégation ascendante active (Président/CC) : désactiver la paire en base
   * retire le bouton, zéro code (spec 2026-08-14).
   */
  readonly aActionExamen = computed(() => !!this.groupeConfig()?.actionExamen && this.permissions.can('EXAMEN_WRITE'));
  /** Ce groupe propose-t-il « Modifier l'examen » ? (config `actionModifierExamen`, même garde de capacité). */
  private readonly aActionModifierExamen = computed(
    () => !!this.groupeConfig()?.actionModifierExamen && this.permissions.can('EXAMEN_WRITE'),
  );
  /** Espace courant (`/membre`, `/president`, `/cc`…) — cible des liens Examiner (chaque espace monte sa route). */
  readonly espace = computed(() => '/' + (this.cfg.base.split('/')[1] ?? 'membre'));

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      if (this.embed()) return; // mode embarqué : type/groupe pilotés par l'input, pas par l'URL
      this.type.set(p.get('type') ?? '');
      this.groupe.set(p.get('groupe') ?? '');
      this.charger();
    });
    effect(() => {
      const e = this.embed();
      if (e) {
        this.type.set(e.type);
        this.groupe.set(e.groupe);
        this.charger();
      }
    });
  }

  aColonne(c: ColonneCircuit): boolean {
    return this.colonnes().has(c);
  }

  private charger(): void {
    this.coches.set(new Set()); // la sélection ne survit pas à un changement de type/groupe ni à une recharge
    const statuts = new Set(this.groupeConfig()?.statuts ?? []);
    if (!this.type() || !statuts.size) {
      this.dossiers.set([]);
      return;
    }
    this.loading.set(true);
    // Dossiers (scopé profil, selon la source du classement) + réceptions/dispatchs pour les colonnes du circuit.
    // Examens chargés si « Modifier l'examen » OU si le groupe contient des DISPATCHE (badge « Examen en
    // cours » : brouillon d'examen sur un dossier pas encore soumis) ; PV pour la condition PV non soumis.
    const chargerExamens = this.aActionModifierExamen() || statuts.has('DISPATCHE');
    forkJoin({
      dossiers: dossiersDuClassement(this.cfg, this.dossierService),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      examens: chargerExamens ? this.examenService.list() : of([]),
      pvs: this.aActionModifierExamen() ? this.pvExamenService.list() : of([]),
    }).subscribe({
      next: ({ dossiers, receptions, dispatchs, examens, pvs }) => {
        // idDossier → dernière réception (par date) ; idReception → réception (pour relier les dispatchs).
        const recById = new Map<number, Reception>();
        const recByDossier = new Map<number, Reception>();
        for (const r of receptions) {
          recById.set(r.idReception, r);
          const prec = recByDossier.get(r.idDossier);
          if (!prec || (r.dateReception ?? '') >= (prec.dateReception ?? '')) recByDossier.set(r.idDossier, r);
        }
        // idDossier → dernier dispatch (via sa réception).
        const dispatchByDossier = new Map<number, Dispatch>();
        for (const disp of dispatchs) {
          const idDossier = recById.get(disp.idReception)?.idDossier;
          if (idDossier == null) continue;
          const prec = dispatchByDossier.get(idDossier);
          if (!prec || (disp.dateDispatch ?? '') >= (prec.dateDispatch ?? '')) dispatchByDossier.set(idDossier, disp);
        }
        // Mêmes exclusions que les compteurs du classement (demandes pilote 2026-09-03) : pré-dispatch
        // d'un dossier CENTRAL réservé au Président (`dossierExcluDuGroupe`), « Dispatch » sans les
        // dossiers dont JE suis l'attributaire (`dossierAttribueAMoi`), et files « À examiner /
        // Examinés » dérivées qui ne retiennent QUE mes attributions (`dossierHorsFileAttribuee`).
        const g = this.groupeConfig();
        const role = this.auth.role();
        const ref = this.auth.ref();
        this.dossiers.set(
          dossiers.filter((d) => {
            if (d.idTypeDossier !== this.type() || !d.statut || !statuts.has(d.statut)) return false;
            if (!g) return true;
            const attributaire = dispatchByDossier.get(d.idDossier)?.imCtrlMembre;
            return !dossierExcluDuGroupe(g, d, role) && !dossierAttribueAMoi(g, attributaire, ref) && !dossierHorsFileAttribuee(g, attributaire, ref);
          }),
        );
        // Réception « à dispatcher » : la réception complète du dossier, non encore dispatchée (idem worklist pré-dispatch).
        const dispatched = new Set(dispatchs.map((d) => d.idReception));
        const recComplete = new Map<number, Reception>();
        for (const r of receptions) {
          const prec = recComplete.get(r.idDossier);
          if (!prec || (r.complet && !prec.complet)) recComplete.set(r.idDossier, r);
        }
        const recDispatchable = new Map<number, Reception>();
        for (const [idDossier, r] of recComplete) if (!dispatched.has(r.idReception)) recDispatchable.set(idDossier, r);
        // PV en cours de navette chez le P/CC (PROJET_SOUMIS, PROJET_ACCEPTE, SIGNE) → « Modifier
        // l'examen » masqué : la main est à la commission. Chaîne PV → examen → dispatch → réception.
        const dispById = new Map(dispatchs.map((disp) => [disp.idDispatch, disp]));
        const exDossier = new Map(
          examens.map((e) => [
            e.idExamen,
            e.idDispatch != null ? recById.get(dispById.get(e.idDispatch)?.idReception ?? -1)?.idDossier : undefined,
          ]),
        );
        // Le statut du PV est conservé tel quel : c'est `examenRectifiable` (règle partagée) qui
        // décide, et non un tri fait ici — c'est en dupliquant ce tri que la règle avait divergé.
        const statutPv = new Map<number, StatutPv>();
        for (const pv of pvs) {
          const idD = exDossier.get(pv.idExamen);
          if (idD != null) statutPv.set(idD, pv.statutPv);
        }
        this.statutPvParDossier.set(statutPv);
        // Brouillons d'examen : un examen existe pour le dossier (via son dispatch) — le badge n'est
        // affiché que sur les dossiers encore DISPATCHE (pas encore soumis → « Examen en cours »).
        const brouillons = new Set<number>();
        for (const idD of exDossier.values()) if (idD != null) brouillons.add(idD);
        this.dossiersAvecExamen.set(brouillons);
        this.recByDossier.set(recByDossier);
        this.recDispatchable.set(recDispatchable);
        this.dispatchByDossier.set(dispatchByDossier);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  dateReception(d: Dossier): string | undefined {
    return this.recByDossier().get(d.idDossier)?.dateReception;
  }
  dateDispatch(d: Dossier): string | undefined {
    return this.dispatchByDossier().get(d.idDossier)?.dateDispatch;
  }
  attributaire(d: Dossier): string {
    const im = this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre;
    return im ? this.controleurMap().get(im) ?? im : '—';
  }
  /** Réception à dispatcher pour ce dossier si l'action est offerte (groupe) et autorisée (DISPATCH_WRITE) ; sinon null. */
  peutDispatcher(d: Dossier): Reception | null {
    if (!this.aActionDispatch() || !this.canDispatch()) return null;
    return this.recDispatchable().get(d.idDossier) ?? null;
  }
  /**
   * ⚠️ Demande pilote (2026-09-03) — « Dispatcher » (réattribuer) : dossier DISPATCHE dont JE suis
   * l'attributaire (ex. Président → CC en localité centrale : le CC examine OU confie à un Membre),
   * tant que l'examen n'est pas commencé (au-delà, passer par « Retirer »). PUT sur le dispatch.
   */
  peutReattribuer(d: Dossier): Dispatch | null {
    if (!this.aActionReattribuer() || !this.canDispatch() || d.statut !== 'DISPATCHE') return null;
    if (this.dossiersAvecExamen().has(d.idDossier)) return null;
    const disp = this.dispatchByDossier().get(d.idDossier);
    return disp && disp.imCtrlMembre === this.auth.ref() ? disp : null;
  }
  /** Ouvre le formulaire en mode réattribution (dispatch existant + dossier). */
  ouvrirReattribution(d: Dossier): void {
    const disp = this.peutReattribuer(d);
    const rec = this.recByDossier().get(d.idDossier);
    if (!disp || !rec) return;
    this.reattribution.set(disp);
    this.dispatchItems.set([{ dossier: d, reception: rec }]);
  }
  /** Ouvre le formulaire en mode dispatch classique (POST) — le mode réattribution est réarmé à null. */
  ouvrirDispatch(d: Dossier, rec: Reception): void {
    this.reattribution.set(null);
    this.dispatchItems.set([{ dossier: d, reception: rec }]);
  }
  /**
   * « Retirer » : offert par le groupe, autorisé (DISPATCH_WRITE), dossier DISPATCHE avec un
   * dispatch connu. ⚠️ Demande pilote (2026-09-03) : le CC ne retire QUE les dossiers qu'il a
   * lui-même dispatchés (dispatcheur = lui) — un dispatch du Président ne se retire pas sous lui ;
   * il peut en revanche l'examiner, le réattribuer, ou le RENDRE (cf. `peutRendre`).
   */
  peutAnnulerDispatch(d: Dossier): boolean {
    if (!this.aActionAnnulerDispatch() || !this.canDispatch() || d.statut !== 'DISPATCHE') return false;
    const disp = this.dispatchByDossier().get(d.idDossier);
    if (!disp) return false;
    return this.auth.role() !== 'CHEF_COMMISSION' || disp.imCtrlDispatch === this.auth.ref();
  }
  /**
   * ⚠️ Demande pilote (2026-09-03) — « Retirer » (RENDRE) dans MA file « À examiner » : le CC (ou le
   * Président auto-attribué) renvoie au pré-dispatch un dossier DISPATCHE dont il est l'attributaire
   * — annulation du dispatch, le dossier retourne dans le circuit de dispatch.
   */
  peutRendre(d: Dossier): boolean {
    if (!this.aActionRendre() || !this.canDispatch() || d.statut !== 'DISPATCHE') return false;
    return this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre === this.auth.ref();
  }
  /** Le retrait est-il une REPRISE ? (CC retirant un dossier qu'il a confié à un Membre — il lui revient.) */
  estReprise(d: Dossier): boolean {
    return this.auth.role() === 'CHEF_COMMISSION' && this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre !== this.auth.ref();
  }
  /** Le retrait est-il un RENVOI de MA propre attribution ? (rendre au pré-dispatch.) */
  estRendu(d: Dossier): boolean {
    return this.dispatchByDossier().get(d.idDossier)?.imCtrlMembre === this.auth.ref();
  }
  /**
   * Confirme le retrait — trois gestes (demandes pilote 2026-09-03) :
   * - REPRISE (CC × dossier confié à un Membre) : réattribution à soi-même (PUT, dossier toujours
   *   DISPATCHE, retour dans SA file « À examiner ») — il ne repart PAS chez le Président ;
   * - RENDU (attributaire = moi) : annulation — le dossier retourne en pré-dispatch (le CC rend au
   *   Président ce qu'il lui avait confié ; le Président remet au pool ce qu'il s'était attribué) ;
   * - ANNULATION classique (Président × dossier attribué à autrui) : retour PRET_DISPATCH.
   */
  confirmerAnnulation(): void {
    const d = this.annulation();
    const disp = d ? this.dispatchByDossier().get(d.idDossier) : undefined;
    if (!d || !disp) return;
    this.annulationEnCours.set(true);
    const fin = (message: string | null) => {
      // En erreur (404/409 : état changé ailleurs), le toast centralisé a déjà parlé — on resynchronise.
      if (message) this.toast.success(message);
      this.annulationEnCours.set(false);
      this.annulation.set(null);
      this.charger();
      this.dossiersRefresh.notifierChangement();
    };
    if (this.estReprise(d)) {
      const moi = this.auth.ref();
      const body: Dispatch = {
        ...disp,
        imCtrlDispatch: moi ?? disp.imCtrlDispatch,
        imCtrlCc: undefined,
        imCtrlMembre: moi ?? undefined,
        dateDispatch: new Date().toISOString().slice(0, 10),
      };
      this.dispatchService.update(disp.idDispatch, body).subscribe({
        next: () => fin('Dossier repris : de retour dans vos dossiers à examiner.'),
        error: () => fin(null),
      });
      return;
    }
    this.dispatchService.annuler(disp.idDispatch).subscribe({
      next: () => fin(this.estRendu(d) ? 'Dossier rendu : de retour en pré-dispatch.' : 'Dossier retiré : de retour en pré-dispatch.'),
      error: () => fin(null),
    });
  }
  /** Cochable = sélection vide, déjà cochée, ou même localité que la sélection (lot mono-localité). */
  cochable(d: Dossier): boolean {
    const set = this.coches();
    return !set.size || set.has(d.idDossier) || d.idLocalite === this.localiteSelection();
  }
  basculerCoche(idDossier: number): void {
    const next = new Set(this.coches());
    if (next.has(idDossier)) next.delete(idDossier);
    else next.add(idDossier);
    this.coches.set(next);
  }
  /** En-tête : coche toutes les lignes dispatchables de la localité de sélection (à défaut, celle de la première ligne dispatchable) ; re-clic = tout décoche. */
  toutCocher(): void {
    if (this.coches().size) {
      this.deselectionner();
      return;
    }
    const rows = this.dossiers().filter((d) => this.peutDispatcher(d));
    if (!rows.length) return;
    const loc = rows[0].idLocalite;
    this.coches.set(new Set(rows.filter((d) => d.idLocalite === loc).map((d) => d.idDossier)));
  }
  deselectionner(): void {
    this.coches.set(new Set());
  }
  /** Ouvre le formulaire de dispatch pour la sélection (chaque dossier avec sa réception dispatchable). */
  dispatcherSelection(): void {
    const set = this.coches();
    const items: DispatchItem[] = [];
    for (const d of this.dossiers()) {
      const rec = set.has(d.idDossier) ? this.recDispatchable().get(d.idDossier) : undefined;
      if (rec) items.push({ dossier: d, reception: rec });
    }
    if (items.length) {
      this.reattribution.set(null);
      this.dispatchItems.set(items);
    }
  }
  /** « Modifier l'examen » : offert par le groupe, tant que l'examen est ouvert (règle partagée). */
  examenModifiable(d: Dossier): boolean {
    return this.aActionModifierExamen() && examenRectifiable(this.statutPvParDossier().get(d.idDossier), d.statut);
  }
  /** Badge « Examen en cours » : brouillon d'examen existant sur un dossier pas encore soumis (DISPATCHE). */
  aExamenEnCours(d: Dossier): boolean {
    return d.statut === 'DISPATCHE' && this.dossiersAvecExamen().has(d.idDossier);
  }
  /** « Attribuer un numéro » (enregistrer la réception) : offert par le groupe (actionReception), autorisé (RECEPTION_WRITE) et dossier sans réception (règle « à réceptionner »). */
  peutReceptionner(d: Dossier): boolean {
    return this.aActionReception() && this.permissions.can('RECEPTION_WRITE') && !this.recByDossier().has(d.idDossier);
  }
  /** Après dispatch réussi (unitaire ou lot) : les dossiers passent DISPATCHE et quittent la liste → recharge
   * + notification (classement parent, stat « Dispatchs par contrôleur », badges de nav). */
  /** Fermeture du formulaire de dispatch (Échap, Annuler) — le mode réattribution retombe avec lui. */
  fermerDispatch(): void {
    this.dispatchItems.set(null);
    this.reattribution.set(null);
  }
  onDispatched(): void {
    this.dispatchItems.set(null);
    this.reattribution.set(null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }
  /** Après réception : affiche la référence attribuée (rec créée) et recharge (le dossier complet passe PRET_DISPATCH). */
  onReception(rec: Reception | null): void {
    this.receptionItem.set(null);
    this.referenceAttribuee.set(rec?.reference ?? null);
    this.charger();
    this.dossiersRefresh.notifierChangement();
  }
  /** Copie la référence dans le presse-papiers (contexte sécurisé / localhost). */
  copier(ref: string): void {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(ref).then(() => this.toast.success('Référence copiée.'));
    }
  }
}
