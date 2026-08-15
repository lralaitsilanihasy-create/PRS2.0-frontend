import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification, ObservationPv, PvExamen, TransmissionSigmp } from '../../models';
import {
  AvisService,
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  LocaliteService,
  NotificationService,
  ObservationPvService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  TransmissionSigmpService,
  TypeDossierService,
  VerificationService,
} from '../../services';
import { ObservationPvCard, StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';
import { DetailPvModal } from '../circuit/detail-pv-modal';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';

/** Une ligne du fil chronologique : observation envoyée (vérificateur) ou rectification PRMP reçue. */
interface Echange {
  type: 'obs' | 'rectif';
  texte: string;
  date: string;
}

/**
 * Écran de vérification d'un dossier (profil Contrôleur vérificateur).
 * Reflet du circuit : contexte lecture seule (dossier + PV signé / avis / réserves),
 * fil chronologique des échanges (observations envoyées + rectifications PRMP reçues),
 * et formulaire d'enregistrement d'un nouveau passage (observation + levée).
 *
 * `idReception` / `idPv` du POST sont dérivés côté client (chaîne dossier → examen →
 * PV signé), aucune donnée inventée. Le backend reste l'autorité (403/409 via l'intercepteur).
 */
@Component({
  selector: 'app-verifier-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, StatutBadge, DossierConsultation, DetailPvModal, ObservationPvCard],
  template: `
    <section class="vf">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Vérificateur</div>
          <h1 class="page-title">Vérifier — {{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</h1>
        </div>
      </header>

      <div class="alert alert-info">
        Vérification possible uniquement sur un dossier en vérification (PV signé, avis favorable avec
        réserve). Statuez chaque observation du PV — levée (définitive) ou maintenue ; quand toutes sont
        levées, le dossier passe à la transmission SIGMP.
      </div>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (!dossier()) {
        <p class="text-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="vf__grid">
          <div class="card vf__details">
            <app-dossier-consultation [dossier]="dossier()!" [embedded]="true" />
          </div>

          <div class="vf__right">
          <div class="card vf__panel">
            <div class="card-header"><span class="card-title">Contexte du dossier</span></div>
            <div class="card-body">
              <dl class="vf__info">
                <div><dt>Référence</dt><dd>{{ dossier()!.refeDossier || '—' }}</dd></div>
                <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
                <div><dt>Entité</dt><dd>{{ entiteLabel() }}</dd></div>
                <div><dt>Localité</dt><dd>{{ localiteLabel() }}</dd></div>
                <div><dt>Statut</dt><dd><app-statut-badge [statut]="dossier()!.statut" /></dd></div>
                <div><dt>Avis du PV</dt><dd>{{ avisLabel() }}</dd></div>
              </dl>
              @if (synthese()) {
                <p class="vf__synthese"><strong>Observations / réserves :</strong> {{ synthese() }}</p>
              }
              @if (pv(); as p) {
                <button type="button" class="btn btn-outline btn-sm vf__voir-pv" (click)="pvDetail.set(p)">
                  Voir les observations du PV
                </button>
              }

              <h3 class="vf__sub">Historique des échanges</h3>
              @if (echanges().length) {
                <ul class="vf__ech">
                  @for (e of echanges(); track $index; let last = $last) {
                    <li
                      class="vf__ech-item"
                      [class.vf__ech-item--latest]="last && e.type === 'obs'"
                      [class.vf__ech-item--rectif]="e.type === 'rectif'"
                    >
                      <span class="vf__ech-meta cnm-mono">
                        {{ e.date || '—' }} · {{ e.type === 'obs' ? 'Observation envoyée' : 'Rectification PRMP reçue' }}
                      </span>
                      <span class="vf__ech-text">{{ e.texte }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-muted">Aucun échange enregistré.</p>
              }
            </div>
          </div>

          <!-- ⚠️ Spec navette (cas 1 & 2) : décision SIGMP — avis ≠ FAVR, ou FAVR après levée des observations. -->
          @if (modeSigmp(); as mode) {
            <div class="card vf__panel">
              <div class="card-header"><span class="card-title">Décision de la Commission → SIGMP</span></div>
              <div class="card-body">
                @if (mode === 'transmise') {
                  <p class="vf__sigmp-ok">✓ Décision transmise à SIGMP — le PV est chez l'Assistant contrôleur pour archivage (l'archivage clôturera le dossier).</p>
                  @for (t of transmissions(); track t.idTransmission) {
                    <dl class="vf__info">
                      <div><dt>Sens transmis</dt><dd><span [class]="t.sens === 'APPROUVE' ? 'badge badge-success' : 'badge badge-danger'">{{ t.sens === 'APPROUVE' ? 'Approuvé' : 'Non approuvé' }}</span></dd></div>
                      @if (t.leveeObservations) { <div><dt>Levée</dt><dd>Observations levées transmises</dd></div> }
                      <div><dt>Transmise le</dt><dd class="cnm-mono">{{ t.dateTransmission | slice: 0 : 10 }}</dd></div>
                    </dl>
                  }
                } @else {
                  <p class="form-hint">
                    @if (mode === 'levee') {
                      Observations levées : transmettez à SIGMP l'<strong>approbation du dossier</strong> et la <strong>levée des observations</strong>.
                    } @else {
                      Le PV est signé (avis {{ avisLabel() }}) : transmettez le <strong>sens de la décision</strong> à SIGMP.
                    }
                  </p>
                  <dl class="vf__info">
                    <div><dt>Sens à transmettre</dt><dd><span [class]="sensApprouve() ? 'badge badge-success' : 'badge badge-danger'">{{ sensApprouve() ? 'Approuvé' : 'Non approuvé' }}</span></dd></div>
                  </dl>
                  <p class="form-hint">La transmission est enregistrée côté PRS 2.0 (interop SIGMP) puis le PV part automatiquement chez l'Assistant contrôleur pour archivage.</p>
                  <div class="vf__foot">
                    <button type="button" class="btn btn-outline" (click)="annuler()">Retour</button>
                    <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="transmettreSigmp()">
                      {{ saving() ? 'Transmission…' : 'Transmettre la décision à SIGMP' }}
                    </button>
                  </div>
                }
              </div>
            </div>
          } @else {
          <!-- ⚠️ Spec « circuit des observations FAVR » (2026-08-02) — plus AUCUNE saisie libre : le
               vérificateur statue une à une les observations du PV (périmètre figé), LEVÉE (définitive)
               ou MAINTENUE (+ précision facultative). Le rappel PRMP est auto-généré des maintenues. -->
          <div class="card vf__panel">
            <div class="card-header"><span class="card-title">Observations du PV — passage de vérification</span></div>
            <div class="card-body">
              @if (verrouille()) {
                <p class="form-hint">{{ messageVerrou() }}</p>
              } @else if (observations().length) {
                <p class="form-hint">
                  Périmètre <strong>figé</strong> sur les observations arrêtées au PV — aucune observation ne peut être
                  ajoutée. Statuez chaque observation restante : une observation <strong>levée est définitivement
                  acquise</strong> ; les maintenues constituent le rappel adressé à la PRMP.
                </p>
              } @else {
                <p class="form-hint">Aucune observation au PV pour ce dossier.</p>
              }
              @if (observations().length) {
                <ul class="vf__obs">
                  @for (o of observations(); track o.idObservationPv; let i = $index) {
                    <li>
                      <app-observation-pv-card [obs]="o" [numero]="i + 1">
                        @if (o.statut !== 'LEVEE' && !verrouille()) {
                          <div class="vf__obs-actions">
                            <!-- ⚠️ Règle 2026-08-15 : levée impossible avant la première rectification
                                 de la PRMP (leveePossible=false au premier passage — le rappel) ;
                                 grisée en miroir de la garde 409 serveur. -->
                            <label class="vf__obs-opt vf__obs-opt--ok" [class.vf__obs-opt--off]="o.leveePossible === false"
                              [title]="o.leveePossible === false ? 'Levée possible après la première rectification de la PRMP — ce premier passage constitue le rappel (les observations restent maintenues).' : ''">
                              <input type="radio" [name]="'obs-' + o.idObservationPv"
                                [disabled]="o.leveePossible === false"
                                [checked]="decisionDe(o.idObservationPv) === 'LEVEE'"
                                (change)="setDecision(o.idObservationPv, 'LEVEE')" />
                              Levée
                            </label>
                            <label class="vf__obs-opt vf__obs-opt--ko">
                              <input type="radio" [name]="'obs-' + o.idObservationPv"
                                [checked]="decisionDe(o.idObservationPv) === 'MAINTENUE'"
                                (change)="setDecision(o.idObservationPv, 'MAINTENUE')" />
                              Maintenue
                            </label>
                            @if (decisionDe(o.idObservationPv) === 'MAINTENUE') {
                              <input type="text" class="form-control vf__obs-precision" maxlength="500"
                                placeholder="Précision — ce qui manque (facultatif)"
                                [value]="precisionDe(o.idObservationPv)"
                                (input)="setPrecision(o.idObservationPv, $any($event.target).value)" />
                            }
                          </div>
                        }
                      </app-observation-pv-card>
                    </li>
                  }
                </ul>
              }
              @if (!verrouille() && restantes().length) {
                @if (nbMaintenues() > 0) {
                  <p class="vf__alert">⚠ {{ nbMaintenues() }} observation(s) maintenue(s) : le dossier sera transmis à la
                    PRMP pour rectification (rappel généré automatiquement — uniquement les observations du PV).</p>
                }
                @if (formError()) { <span class="form-error">{{ formError() }}</span> }
                <div class="vf__foot">
                  <button type="button" class="btn btn-outline" (click)="annuler()">Retour</button>
                  <button type="button" class="btn btn-primary" [disabled]="saving() || !toutesStatuees()" (click)="enregistrer()">
                    {{ saving() ? 'Enregistrement…' : 'Enregistrer le passage' }}
                  </button>
                </div>
              }
            </div>
          </div>
          }
          </div>
        </div>
      }
    </section>

    @if (confirmOpen()) {
      <div class="modal-backdrop" (click)="annulerTransmission()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain">
            <span class="modal-title">Transmettre à la PRMP pour rectification ?</span>
            <button type="button" class="btn-close-plain" (click)="annulerTransmission()">✕</button>
          </div>
          <div class="modal-body">
            <p>
              Ce dossier sera transmis à la PRMP pour rectification. Vous ne pourrez plus le vérifier tant
              qu'elle n'a pas rectifié et resoumis.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerTransmission()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="confirmerTransmission()">
              Confirmer et transmettre à la PRMP
            </button>
          </div>
        </div>
      </div>
    }

    @if (pvDetail(); as p) {
      <app-detail-pv-modal [pv]="p" (fermer)="pvDetail.set(null)" />
    }
  `,
  styles: `
    /* ⚠️ 2026-08-06 — à gauche la consultation du dossier (tableau des marchés, 14 colonnes), à droite
       le panneau de décision : la part du dossier passe de 1,3 à 1,9 pour que ses en-têtes respirent. */
    .vf__grid { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); gap: 0.75rem; align-items: start; }
    .vf__right { display: flex; flex-direction: column; gap: 0.75rem; }
    .vf__details { overflow: hidden; }
    .vf__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .vf__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .vf__info dt { flex: 0 0 9rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); }
    .vf__info dd { margin: 0; color: var(--n-700); }
    .vf__synthese { margin: 0; font-size: var(--text-sm); }
    .vf__voir-pv { margin-top: 0.5rem; }
    .vf__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .vf__ech { list-style: none; margin: 0.35rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .vf__ech-item { display: flex; flex-direction: column; gap: 2px; padding: 0.25rem 0.5rem; border-left: 2px solid var(--c-100); }
    .vf__ech-item--latest { border-left-color: var(--c-600); font-weight: 600; color: var(--c-700); }
    .vf__ech-item--rectif { border-left-color: var(--warning-text); }
    .vf__ech-meta { color: var(--n-400); font-size: var(--text-xs); }
    .vf__ech-text { font-size: var(--text-sm); }
    .vf__foot { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 0.75rem; }
    .vf__alert { margin: 0; font-size: var(--text-sm); background: var(--warning-bg); color: var(--warning-text); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); }
    /* ⚠️ Spec observations FAVR — liste des observations du PV (cartes partagées + décisions projetées). */
    .vf__obs { list-style: none; margin: 0.5rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .vf__obs-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; border-top: 1px dashed var(--c-100); padding-top: 0.4rem; }
    .vf__obs-opt { display: inline-flex; gap: 0.3rem; align-items: center; font-size: var(--text-sm); cursor: pointer; }
    .vf__obs-opt--ok { color: #15803D; }
    /* Levée indisponible (premier passage = rappel) : grisée, l'infobulle explique la règle. */
    .vf__obs-opt--off { opacity: 0.45; cursor: not-allowed; }
    .vf__obs-opt--ko { color: var(--warning-text); }
    .vf__obs-precision { flex: 1 1 16rem; }
    /* Décision transmise à SIGMP : constat vert (spec navette). */
    .vf__sigmp-ok { margin: 0 0 0.5rem; padding: 0.5rem 0.75rem; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); color: #15803D; font-size: var(--text-sm); font-weight: 600; }
    .confirm-modal { max-width: 30rem; }
    @media (max-width: 60rem) { .vf__grid { grid-template-columns: 1fr; } }
  `,
})
export class VerifierDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly sigmpService = inject(TransmissionSigmpService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly pvService = inject(PvExamenService);
  private readonly verificationService = inject(VerificationService);
  private readonly observationPvService = inject(ObservationPvService);
  private readonly notificationService = inject(NotificationService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  /** Modale de confirmation avant transmission à la PRMP (obsLevees = false). */
  readonly confirmOpen = signal(false);

  readonly dossier = signal<Dossier | null>(null);
  readonly idReception = signal<number | null>(null);
  readonly idPv = signal<number | null>(null);
  readonly synthese = signal('');
  readonly avisPv = signal<string | null>(null);
  /** ⚠️ Spec navette — transmissions SIGMP déjà enregistrées pour ce dossier. */
  readonly transmissions = signal<TransmissionSigmp[]>([]);
  /**
   * Mode « décision SIGMP » : `decision` (cas 1 — EN_VERIFICATION, avis ≠ FAVR), `levee` (cas 2 —
   * OBSERVATIONS_LEVEES), `transmise` (DECISION_TRANSMISE_SIGMP, en attente d'archivage) ; `null`
   * = vérification classique (FAVR) ou verrou.
   */
  readonly modeSigmp = computed<null | 'decision' | 'levee' | 'transmise'>(() => {
    const s = this.dossier()?.statut;
    if (s === 'DECISION_TRANSMISE_SIGMP') return 'transmise';
    if (s === 'OBSERVATIONS_LEVEES') return 'levee';
    if (s === 'EN_VERIFICATION' && this.avisPv() && this.avisPv() !== 'FAVR') return 'decision';
    return null;
  });
  /** Sens à transmettre : FAV / levée d'observations → Approuvé ; DEF / NSP → Non approuvé. */
  readonly sensApprouve = computed(() => this.modeSigmp() === 'levee' || this.avisPv() === 'FAV');
  /** PV signé du dossier (conservé pour ouvrir le détail : grille de contrôle + observations). */
  readonly pv = signal<PvExamen | null>(null);
  /** PV ouvert dans le modal de détail (null = fermé). */
  readonly pvDetail = signal<PvExamen | null>(null);
  /** Fil chronologique : observations envoyées + rectifications PRMP reçues (DESC). */
  readonly echanges = signal<Echange[]>([]);

  /** ⚠️ Spec observations FAVR (2026-08-02) — périmètre figé du PV (statuts + historique serveur). */
  readonly observations = signal<ObservationPv[]>([]);
  /** Décisions en cours de saisie (idObservationPv → décision + précision). */
  private readonly decisions = signal<Map<number, { decision: 'LEVEE' | 'MAINTENUE'; precision: string }>>(new Map());
  /** Observations restantes (non levées) — à statuer à cette itération. */
  readonly restantes = computed(() => this.observations().filter((o) => o.statut !== 'LEVEE'));
  /** Vrai quand chaque observation restante a reçu une décision. */
  readonly toutesStatuees = computed(() => this.restantes().every((o) => this.decisions().has(o.idObservationPv)));
  readonly nbMaintenues = computed(
    () => [...this.decisions().values()].filter((d) => d.decision === 'MAINTENUE').length,
  );

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  /** Lecture seule hors EN_VERIFICATION (clôturé / en attente PRMP / autre) — aucune écriture proposée. */
  readonly verrouille = computed(() => this.dossier()?.statut !== 'EN_VERIFICATION');
  /** Libellé du verrou, conscient du statut (en attente PRMP vs clôturé). */
  readonly messageVerrou = computed(() =>
    this.dossier()?.statut === 'EN_ATTENTE_DECISION_PRMP'
      ? 'Ce dossier est en attente de rectification par la PRMP. Aucune vérification possible.'
      : 'Dossier clôturé — vérification en lecture seule.',
  );
  readonly typeLabel = computed(() => {
    const id = this.dossier()?.idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier()?.idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });
  readonly entiteLabel = computed(() => {
    const id = this.dossier()?.idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });
  readonly avisLabel = computed(() => {
    const a = this.avisPv();
    return a ? this.avisMap().get(a) ?? a : '—';
  });

  ctrlLabel(im?: string): string {
    return im ? this.controleurMap().get(im) ?? im : '—';
  }

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups
      .lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont'])
      .subscribe((m) => this.controleurMap.set(m));

    forkJoin({
      dossier: this.dossierService.getById(this.idDossier),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      examens: this.examenService.list(),
      pvs: this.pvService.definitifs(), // PV signés (GET /api/pv-examens/definitifs) — list() ne les expose plus
      verifications: this.verificationService.list(),
      notifs: this.notificationService.mes(),
      sigmp: this.sigmpService.parDossier(this.idDossier).pipe(catchError(() => of([] as TransmissionSigmp[]))),
      // ⚠️ Spec observations FAVR — périmètre figé + statuts (vide pour un dossier non FAVR).
      observations: this.observationPvService
        .parDossier(this.idDossier)
        .pipe(catchError(() => of([] as ObservationPv[]))),
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);
        this.transmissions.set(r.sigmp);
        this.observations.set(r.observations);

        // Chaîne du dossier : réceptions → dispatchs → examens → PV signé.
        const recOfD = r.receptions.filter((x) => x.idDossier === this.idDossier);
        const recIds = new Set(recOfD.map((x) => x.idReception));
        const dispOfD = r.dispatchs.filter((x) => recIds.has(x.idReception));
        const dispIds = new Set(dispOfD.map((x) => x.idDispatch));
        const exOfD = r.examens.filter((e) => e.idDispatch != null && dispIds.has(e.idDispatch));
        const exIds = new Set(exOfD.map((e) => e.idExamen));
        const signedPv =
          r.pvs.find((p) => exIds.has(p.idExamen) && p.statutPv === 'SIGNE') ??
          r.pvs.find((p) => exIds.has(p.idExamen));
        this.idPv.set(signedPv?.idPv ?? null);
        this.avisPv.set(signedPv?.idAvis ?? null);
        this.synthese.set(signedPv?.syntheseObservations ?? '');
        this.pv.set(signedPv ?? null);

        // idReception = réception de la chaîne du PV signé ; sinon la plus récente du dossier.
        const exOfPv = signedPv ? exOfD.find((e) => e.idExamen === signedPv.idExamen) : undefined;
        const dispOfPv = exOfPv ? dispOfD.find((d) => d.idDispatch === exOfPv.idDispatch) : undefined;
        const recChain = dispOfPv ? recOfD.find((x) => x.idReception === dispOfPv.idReception) : undefined;
        const recFallback = [...recOfD].sort((a, b) => (b.numPassage ?? 0) - (a.numPassage ?? 0))[0];
        this.idReception.set((recChain ?? recFallback)?.idReception ?? null);

        // Fil chronologique (lecture seule) : observations envoyées (vérifications de la chaîne du dossier)
        // + rectifications PRMP reçues (notifications RECTIFICATION_PRMP du dossier). Pas d'endpoint par
        // dossier pour les vérifications → filtrage client par réception / PV de la chaîne.
        const pvIds = new Set(r.pvs.filter((p) => exIds.has(p.idExamen)).map((p) => p.idPv));
        const obs: Echange[] = r.verifications
          .filter((v) => v.observation && (recIds.has(v.idReception) || (v.idPv != null && pvIds.has(v.idPv))))
          .map((v) => ({ type: 'obs' as const, texte: v.observation as string, date: v.dateVerif ?? '' }));
        const rectif: Echange[] = r.notifs
          .filter((n) => n.typeNotif === 'RECTIFICATION_PRMP' && n.idDossier === this.idDossier && n.corps)
          .map((n) => ({ type: 'rectif' as const, texte: n.corps as string, date: n.dateEnvoi ?? '' }));
        this.echanges.set([...obs, ...rectif].sort((a, b) => a.date.localeCompare(b.date)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  annuler(): void {
    void this.router.navigate(['/verificateur/a-verifier']);
  }

  // — ⚠️ Spec observations FAVR (2026-08-02) : décisions individuelles sur le périmètre figé du PV —

  decisionDe(id: number): 'LEVEE' | 'MAINTENUE' | null {
    return this.decisions().get(id)?.decision ?? null;
  }
  precisionDe(id: number): string {
    return this.decisions().get(id)?.precision ?? '';
  }
  setDecision(id: number, decision: 'LEVEE' | 'MAINTENUE'): void {
    this.formError.set(null);
    this.decisions.update((m) => {
      const next = new Map(m);
      const cur = next.get(id);
      next.set(id, { decision, precision: decision === 'MAINTENUE' ? cur?.precision ?? '' : '' });
      return next;
    });
  }
  setPrecision(id: number, v: string): void {
    this.decisions.update((m) => {
      const next = new Map(m);
      const cur = next.get(id);
      if (cur) {
        next.set(id, { ...cur, precision: v });
      }
      return next;
    });
  }

  enregistrer(): void {
    if (!this.toutesStatuees()) {
      this.formError.set('Chaque observation restante doit être statuée (levée ou maintenue).');
      return;
    }
    this.formError.set(null);
    // ≥1 maintenue : confirmation (le dossier part en décision PRMP avec le rappel auto-généré).
    if (this.nbMaintenues() > 0) {
      this.confirmOpen.set(true);
      return;
    }
    this.executerPassage();
  }

  confirmerTransmission(): void {
    this.confirmOpen.set(false);
    this.executerPassage();
  }
  annulerTransmission(): void {
    this.confirmOpen.set(false);
  }

  /** Enregistre le PASSAGE (décisions individuelles) ; le serveur crée le passage + la transition. */
  private executerPassage(): void {
    const corps = this.restantes().map((o) => {
      const d = this.decisions().get(o.idObservationPv)!;
      return {
        idObservationPv: o.idObservationPv,
        decision: d.decision,
        precision: d.decision === 'MAINTENUE' && d.precision.trim() ? d.precision.trim() : undefined,
      };
    });
    this.saving.set(true);
    this.observationPvService.passage(this.idDossier, corps).subscribe({
      next: (rows) => {
        this.observations.set(rows);
        this.decisions.set(new Map());
        if (rows.every((o) => o.statut === 'LEVEE')) {
          // ⚠️ Spec navette : la levée ne clôture plus — reste à transmettre l'approbation à SIGMP.
          this.toast.success("Toutes les observations sont levées — transmettez maintenant l'approbation à SIGMP.");
          this.saving.set(false);
          this.dossier.update((d) => (d ? { ...d, statut: 'OBSERVATIONS_LEVEES' } : d));
        } else {
          this.toast.success('Rappel des observations maintenues transmis à la PRMP pour rectification.');
          void this.router.navigate(['/verificateur/en-attente-prmp']);
        }
      },
      error: (_e: ApiError) => this.saving.set(false), // 403/409/400 → toast centralisé
    });
  }

  /** ⚠️ Spec navette — transmet le sens de la décision à SIGMP (enregistrement PRS) ; le PV part à l'archivage. */
  transmettreSigmp(): void {
    this.saving.set(true);
    this.sigmpService.transmettre(this.idDossier).subscribe({
      next: (t) => {
        this.saving.set(false);
        this.toast.success("Décision transmise à SIGMP — le dossier passe dans « Vérifiés / clôturés ».");
        this.transmissions.update((arr) => [...arr, t]);
        this.dossier.update((d) => (d ? { ...d, statut: 'DECISION_TRANSMISE_SIGMP' } : d));
        // ⚠️ 2026-08-04 — le dossier quitte « À vérifier » à cet instant : on signale le changement pour
        // que le badge du menu décroisse sans attendre une navigation.
        this.dossiersRefresh.notifierChangement();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.toast.error(e.message || 'Transmission SIGMP impossible.');
      },
    });
  }
}
