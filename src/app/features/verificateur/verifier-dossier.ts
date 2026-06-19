import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Verification } from '../../models';
import {
  AvisService,
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
  VerificationService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

/**
 * Écran de vérification d'un dossier (profil Contrôleur vérificateur).
 * Reflet du circuit : contexte lecture seule (dossier + PV signé / avis / réserves),
 * historique des passages, et formulaire d'enregistrement (observation + levée).
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
      <header class="vf__header">
        <span class="cnm-section-label">Domaine Vérificateur</span>
        <h1 class="vf__title">Vérifier — {{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</h1>
      </header>

      <div class="cnm-card vf__note">
        Vérification possible uniquement sur un dossier en vérification (PV signé, avis favorable avec
        réserve). Cocher « Observations levées » clôture le dossier.
      </div>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (!dossier()) {
        <p class="cnm-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="vf__grid">
          <div class="cnm-card vf__details">
            <app-dossier-consultation [dossier]="dossier()!" [embedded]="true" />
          </div>

          <div class="vf__right">
          <div class="cnm-card vf__panel">
            <div class="vf__panel-head">Contexte du dossier</div>
            <div class="vf__panel-body">
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

              <h3 class="vf__sub">Passages précédents</h3>
              @if (passages().length) {
                <table class="cnm-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vérificateur</th>
                      <th>Observation</th>
                      <th>Levées</th>
                      @if (!verrouille()) { <th></th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of passages(); track v.idVerification) {
                      <tr>
                        <td class="cnm-mono">{{ v.dateVerif || '—' }}</td>
                        <td>{{ ctrlLabel(v.imCtrlVerif) }}</td>
                        <td>{{ v.observation || '—' }}</td>
                        <td>{{ v.obsLevees ? 'Oui' : 'Non' }}</td>
                        @if (!verrouille()) {
                          <td>
                            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="editer(v)">
                              Modifier
                            </button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="cnm-muted">Aucun passage enregistré.</p>
              }
            </div>
          </div>

          <div class="cnm-card vf__panel">
            <div class="vf__panel-head">{{ editId() != null ? 'Corriger un passage' : 'Nouvelle vérification' }}</div>
            <div class="vf__panel-body cnm-form">
              @if (verrouille()) {
                <p class="cnm-field__hint">{{ messageVerrou() }}</p>
              } @else {
                @if (idPv() == null || idReception() == null) {
                  <p class="cnm-field__hint">
                    PV signé / réception introuvable pour ce dossier : vérification impossible.
                  </p>
                }
                <label class="cnm-field">
                  <span class="cnm-field__label">Observation</span>
                  <textarea
                    class="cnm-textarea"
                    rows="3"
                    maxlength="500"
                    [value]="observation()"
                    (input)="observation.set($any($event.target).value)"
                  ></textarea>
                </label>
                <label class="cnm-field">
                  <span class="cnm-field__label">Observations levées</span>
                  <select
                    class="cnm-select"
                    [value]="obsLevees() ? 'oui' : 'non'"
                    (change)="obsLevees.set($any($event.target).value === 'oui')"
                  >
                    <option value="non">Non — le dossier reste à vérifier</option>
                    <option value="oui">Oui — clôture le dossier</option>
                  </select>
                </label>
                @if (!obsLevees()) {
                  <p class="vf__alert">⚠ Ce dossier sera transmis à la PRMP pour décision. L'observation est obligatoire.</p>
                }
                @if (formError()) { <span class="cnm-field__hint">{{ formError() }}</span> }
                <div class="vf__foot">
                  <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler()">
                    {{ editId() != null ? 'Annuler la correction' : 'Retour' }}
                  </button>
                  <button
                    type="button"
                    class="cnm-btn cnm-btn--primary"
                    [disabled]="saving() || idPv() == null || idReception() == null"
                    (click)="enregistrer()"
                  >
                    {{ saving() ? 'Enregistrement…' : editId() != null ? 'Modifier la vérification' : 'Enregistrer la vérification' }}
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
      <div class="vf-modal__overlay" (click)="annulerTransmission()">
        <div class="vf-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h2 class="vf-modal__title">Transmettre à la PRMP ?</h2>
          <p>
            Ce dossier sera transmis à la PRMP pour décision. Vous ne pourrez plus le vérifier tant
            qu'elle n'a pas statué.
          </p>
          <div class="vf-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerTransmission()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--primary" [disabled]="saving()" (click)="confirmerTransmission()">
              Confirmer et transmettre à la PRMP
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .vf__header { margin-bottom: var(--cnm-space-3); }
    .vf__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .vf__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .vf__grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: var(--cnm-space-3); align-items: start; }
    .vf__right { display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .vf__details { overflow: hidden; }
    .vf__panel-head { padding: var(--cnm-space-3) var(--cnm-space-4); border-bottom: 1px solid var(--cnm-border); font-weight: var(--cnm-fw-semibold); }
    .vf__panel-body { padding: var(--cnm-space-4); display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .vf__info { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: 0; }
    .vf__info > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .vf__info dt { flex: 0 0 9rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: .08em; color: var(--cnm-text-3); }
    .vf__info dd { margin: 0; color: var(--cnm-text); }
    .vf__synthese { margin: 0; font-size: var(--cnm-fs-sm); }
    .vf__sub { margin: var(--cnm-space-2) 0 0; font-size: var(--cnm-fs-md); }
    .vf__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); border-top: 1px solid var(--cnm-border); padding-top: var(--cnm-space-3); }
    .vf__alert { margin: 0; font-size: var(--cnm-fs-sm); background: var(--cnm-warning-bg); color: var(--cnm-warning-fg); padding: var(--cnm-space-2) var(--cnm-space-3); border-radius: var(--cnm-radius-sm); }
    .vf-modal__overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: var(--cnm-space-4); }
    .vf-modal { width: 100%; max-width: 30rem; padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-3); box-shadow: var(--cnm-shadow); }
    .vf-modal__title { margin: 0; font-size: var(--cnm-fs-md); }
    .vf-modal__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); }
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
  readonly passages = signal<Verification[]>([]);

  readonly observation = signal('');
  readonly obsLevees = signal(false);
  readonly editId = signal<number | null>(null);

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
      ? 'En attente de décision PRMP — vérification en lecture seule.'
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
      pvs: this.pvService.list(),
      verifications: this.verificationService.list(),
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

        // Historique : pas d'endpoint par dossier → filtrage client par réception / PV de la chaîne.
        const pvIds = new Set(r.pvs.filter((p) => exIds.has(p.idExamen)).map((p) => p.idPv));
        this.passages.set(
          r.verifications
            .filter((v) => recIds.has(v.idReception) || (v.idPv != null && pvIds.has(v.idPv)))
            .sort((a, b) => (b.dateVerif ?? '').localeCompare(a.dateVerif ?? '')),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  editer(v: Verification): void {
    this.editId.set(v.idVerification ?? null);
    this.observation.set(v.observation ?? '');
    this.obsLevees.set(!!v.obsLevees);
    this.formError.set(null);
  }

  annuler(): void {
    if (this.editId() != null) {
      this.editId.set(null);
      this.observation.set('');
      this.obsLevees.set(false);
      this.formError.set(null);
      return;
    }
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

  /** Enregistre la vérification (POST/PUT) ; aiguillage du message/redirection selon obsLevees. */
  private executerVerification(): void {
    const idReception = this.idReception();
    const idPv = this.idPv();
    if (idReception == null || idPv == null) {
      return;
    }
    this.saving.set(true);
    const editId = this.editId();
    const body = {
      idReception,
      idPv,
      observation: this.observation() || undefined,
      obsLevees: this.obsLevees(),
      ...(editId != null ? { idVerification: editId } : {}),
    } as Verification;
    const op = editId != null ? this.verificationService.update(editId, body) : this.verificationService.create(body);
    op.subscribe({
      next: () => {
        if (this.obsLevees()) {
          this.toast.success('Observations levées — dossier clôturé.');
          void this.router.navigate(['/verificateur/verifies']);
        } else {
          this.toast.success('Observation transmise à la PRMP pour décision.');
          void this.router.navigate(['/verificateur/en-attente-prmp']);
        }
      },
      error: (_e: ApiError) => this.saving.set(false), // 403/409/400 → toast centralisé
    });
  }
}
