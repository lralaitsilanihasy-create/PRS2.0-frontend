import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification, Verification } from '../../models';
import {
  AvisService,
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  LocaliteService,
  NotificationService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
  VerificationService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

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
  imports: [StatutBadge, DossierConsultation],
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
        réserve). Cocher « Observations levées » clôture le dossier.
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

          <div class="card vf__panel">
            <div class="card-header"><span class="card-title">Nouvelle vérification</span></div>
            <div class="card-body">
              @if (verrouille()) {
                <p class="form-hint">{{ messageVerrou() }}</p>
              } @else {
                @if (idPv() == null || idReception() == null) {
                  <p class="form-hint">
                    PV signé / réception introuvable pour ce dossier : vérification impossible.
                  </p>
                }
                <div class="form-group">
                  <label class="form-label">Observation</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    maxlength="500"
                    [value]="observation()"
                    (input)="observation.set($any($event.target).value)"
                  ></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Observations levées</label>
                  <select
                    class="form-control"
                    [value]="obsLevees() ? 'oui' : 'non'"
                    (change)="obsLevees.set($any($event.target).value === 'oui')"
                  >
                    <option value="non">Non — le dossier reste à vérifier</option>
                    <option value="oui">Oui — clôture le dossier</option>
                  </select>
                </div>
                @if (!obsLevees()) {
                  <p class="vf__alert">⚠ Ce dossier sera transmis à la PRMP pour rectification. L'observation est obligatoire.</p>
                }
                @if (formError()) { <span class="form-error">{{ formError() }}</span> }
                <div class="vf__foot">
                  <button type="button" class="btn btn-outline" (click)="annuler()">Retour</button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="saving() || idPv() == null || idReception() == null"
                    (click)="enregistrer()"
                  >
                    {{ saving() ? 'Enregistrement…' : 'Enregistrer la vérification' }}
                  </button>
                </div>
              }
            </div>
          </div>
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
  `,
  styles: `
    .vf__grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 0.75rem; align-items: start; }
    .vf__right { display: flex; flex-direction: column; gap: 0.75rem; }
    .vf__details { overflow: hidden; }
    .vf__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .vf__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .vf__info dt { flex: 0 0 9rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); }
    .vf__info dd { margin: 0; color: var(--n-700); }
    .vf__synthese { margin: 0; font-size: var(--text-sm); }
    .vf__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .vf__ech { list-style: none; margin: 0.35rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .vf__ech-item { display: flex; flex-direction: column; gap: 2px; padding: 0.25rem 0.5rem; border-left: 2px solid var(--c-100); }
    .vf__ech-item--latest { border-left-color: var(--c-600); font-weight: 600; color: var(--c-700); }
    .vf__ech-item--rectif { border-left-color: var(--warning-text); }
    .vf__ech-meta { color: var(--n-400); font-size: var(--text-xs); }
    .vf__ech-text { font-size: var(--text-sm); }
    .vf__foot { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 0.75rem; }
    .vf__alert { margin: 0; font-size: var(--text-sm); background: var(--warning-bg); color: var(--warning-text); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); }
    .confirm-modal { max-width: 30rem; }
    @media (max-width: 60rem) { .vf__grid { grid-template-columns: 1fr; } }
  `,
})
export class VerifierDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly examenService = inject(ExamenService);
  private readonly pvService = inject(PvExamenService);
  private readonly verificationService = inject(VerificationService);
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
  private readonly avisPv = signal<string | null>(null);
  /** Fil chronologique : observations envoyées + rectifications PRMP reçues (DESC). */
  readonly echanges = signal<Echange[]>([]);

  readonly observation = signal('');
  readonly obsLevees = signal(false);

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
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);

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

  enregistrer(): void {
    const idReception = this.idReception();
    const idPv = this.idPv();
    if (idReception == null || idPv == null) {
      this.formError.set('PV signé / réception introuvable — vérification impossible.');
      return;
    }
    // obsLevees = false : observation obligatoire + confirmation (le dossier part en décision PRMP).
    if (!this.obsLevees()) {
      if (!this.observation().trim()) {
        this.formError.set("L'observation est obligatoire pour transmettre le dossier à la PRMP.");
        return;
      }
      this.formError.set(null);
      this.confirmOpen.set(true);
      return;
    }
    this.formError.set(null);
    this.executerVerification();
  }

  confirmerTransmission(): void {
    this.confirmOpen.set(false);
    this.executerVerification();
  }
  annulerTransmission(): void {
    this.confirmOpen.set(false);
  }

  /** Enregistre un NOUVEAU passage de vérification (POST) ; message/redirection selon obsLevees. */
  private executerVerification(): void {
    const idReception = this.idReception();
    const idPv = this.idPv();
    if (idReception == null || idPv == null) {
      return;
    }
    this.saving.set(true);
    const body = {
      idReception,
      idPv,
      observation: this.observation() || undefined,
      obsLevees: this.obsLevees(),
    } as Verification;
    this.verificationService.create(body).subscribe({
      next: () => {
        if (this.obsLevees()) {
          this.toast.success('Observations levées — dossier clôturé.');
          void this.router.navigate(['/verificateur/verifies']);
        } else {
          this.toast.success('Observation transmise à la PRMP pour rectification.');
          void this.router.navigate(['/verificateur/en-attente-prmp']);
        }
      },
      error: (_e: ApiError) => this.saving.set(false), // 403/409/400 → toast centralisé
    });
  }
}
