import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Avis, Dossier, Examen, ExamenDetail, Marche, PointsCtrl, Ppm, PvExamen } from '../../models';
import {
  AvisService,
  DispatchService,
  DossierService,
  ExamenDetailService,
  ExamenService,
  LocaliteService,
  MarcheService,
  ModePassationService,
  PointsCtrlService,
  PpmService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

interface RowState {
  conforme: boolean;
  observation: string;
  obsSiNonConforme: string;
}

/**
 * Écran d'examen d'un dossier dispatché (profil Membre) : consultation en lecture seule
 * (en-tête + lignes de marché en libellés, listes scopées filtrées par idDossier, libellés
 * en cache) + formulaire d'examen (grille des points de contrôle, avis global, synthèse).
 *
 * Enregistrement : POST /examens → POST /examen-details ×N + POST /pv-examens (BROUILLON),
 * ce qui matérialise le « projet de PV ». Le backend reste l'autorité (409 si non DISPATCHE,
 * 403 hors localité) ; erreurs via l'intercepteur centralisé.
 */
@Component({
  selector: 'app-examen-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="exam">
      <header class="exam__header">
        <span class="cnm-section-label">Domaine Membre</span>
        <h1 class="exam__title">{{ mode() === 'edit' ? 'Modifier l\\'examen' : 'Examiner' }} — {{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (!dossier()) {
        <p class="cnm-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="exam__grid">
          <div class="cnm-card exam__panel">
            <div class="exam__panel-head">Contenu du dossier</div>
            <div class="exam__panel-body">
              <dl class="exam__info">
                <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
                <div><dt>Localité</dt><dd>{{ localiteLabel() }}</dd></div>
                <div><dt>Statut</dt><dd><app-statut-badge [statut]="dossier()!.statut" /></dd></div>
                <div><dt>Date réf.</dt><dd class="cnm-mono">{{ dossier()!.dateRef || '—' }}</dd></div>
              </dl>
              @if (estPpm()) {
                @if (ppm(); as p) {
                  <h3 class="exam__sub">PPM — {{ p.reference || ('#' + p.idPpm) }}</h3>
                  <dl class="exam__info">
                    <div><dt>Exercice</dt><dd>{{ p.exercice }}</dd></div>
                    <div><dt>Signataire</dt><dd>{{ p.signataire || '—' }}</dd></div>
                    <div><dt>Libellé</dt><dd>{{ p.libelle || '—' }}</dd></div>
                  </dl>
                }
                <div class="cnm-marches exam__marches">
                  <h3 class="exam__sub">Lignes de marché</h3>
                  @if (marches().length) {
                    <table class="cnm-table">
                      <thead><tr><th>#</th><th>Désignation</th><th class="cnm-num">Montant</th><th>Mode</th></tr></thead>
                      <tbody>
                        @for (m of marches(); track m.idDetail) {
                          <tr>
                            <td class="cnm-mono">{{ m.idDetail }}</td>
                            <td>{{ m.designationMarche || '—' }}</td>
                            <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                            <td>{{ modeLabel(m.idMode) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="cnm-muted">Aucune ligne de marché.</p>
                  }
                </div>
              }
            </div>
          </div>

          <div class="cnm-card exam__panel">
            <div class="exam__panel-head">Consigner l'examen</div>
            <div class="exam__panel-body cnm-form">
              @if (mode() === 'locked') {
                <p class="cnm-field__hint">Examen verrouillé (PV signé / dossier clôturé) — lecture seule.</p>
              }
              @if (idDispatch() == null) {
                <p class="cnm-field__hint">Aucun dispatch trouvé pour ce dossier : examen impossible.</p>
              }

              <label class="cnm-field">
                <span class="cnm-field__label">Date d'examen</span>
                <input class="cnm-input" type="date" [value]="dateExamen()" (input)="dateExamen.set($any($event.target).value)" />
              </label>

              <h3 class="exam__sub">Grille de contrôle</h3>
              @if (!points().length) {
                <p class="cnm-muted">Aucun point de contrôle défini pour ce type de dossier.</p>
              }
              @for (p of points(); track p.idPointCtrl) {
                <div class="exam__point">
                  <div class="exam__point-head">
                    <span class="exam__point-lbl">{{ p.libelPointCtrl || ('Point #' + p.idPointCtrl) }}{{ p.obligatoire ? ' *' : '' }}</span>
                    <label class="exam__conforme">
                      <input type="checkbox" [checked]="!row(p.idPointCtrl).conforme" (change)="setConforme(p.idPointCtrl, !$any($event.target).checked)" />
                      Non conforme
                    </label>
                  </div>
                  @if (p.decriptPointCtrl) { <p class="exam__point-desc cnm-muted">{{ p.decriptPointCtrl }}</p> }
                  @if (!row(p.idPointCtrl).conforme) {
                    <input class="cnm-input" placeholder="Observation (non-conformité)" [value]="row(p.idPointCtrl).obsSiNonConforme"
                      (input)="setObsNc(p.idPointCtrl, $any($event.target).value)" />
                  }
                </div>
              }

              @if (mode() === 'create') {
                <h3 class="exam__sub">Avis & synthèse (projet de PV)</h3>
                <label class="cnm-field">
                  <span class="cnm-field__label">Avis global *</span>
                  <select class="cnm-select" [value]="avis() ?? ''" (change)="avis.set($any($event.target).value || null)">
                    <option value="">— Sélectionner —</option>
                    @for (a of aviss(); track a.idAvis) { <option [value]="a.idAvis">{{ a.libelleAvis || a.idAvis }}</option> }
                  </select>
                </label>
                <label class="cnm-field">
                  <span class="cnm-field__label">Synthèse des observations</span>
                  <textarea class="cnm-textarea" rows="3" [value]="synthese()" (input)="synthese.set($any($event.target).value)"></textarea>
                </label>
              } @else if (mode() === 'edit') {
                <p class="cnm-field__hint cnm-muted">L'avis et la synthèse se modifient dans « Projets de PV ».</p>
              }

              @if (formError()) { <span class="cnm-field__hint">{{ formError() }}</span> }
              @if (mode() !== 'locked') {
                <div class="exam__foot">
                  <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler()">Annuler</button>
                  <button
                    type="button"
                    class="cnm-btn cnm-btn--primary"
                    [disabled]="saving() || idDispatch() == null"
                    (click)="enregistrer()"
                  >
                    {{ saving() ? 'Enregistrement…' : mode() === 'edit' ? "Modifier l'examen" : "Enregistrer l'examen" }}
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .exam__header { margin-bottom: var(--cnm-space-4); }
    .exam__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .exam__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); align-items: start; }
    .exam__panel-head { padding: var(--cnm-space-3) var(--cnm-space-4); border-bottom: 1px solid var(--cnm-border); font-weight: var(--cnm-fw-semibold); }
    .exam__panel-body { padding: var(--cnm-space-4); display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .exam__sub { margin: var(--cnm-space-2) 0 0; font-size: var(--cnm-fs-md); }
    .exam__info { display: flex; flex-wrap: wrap; gap: var(--cnm-space-4); margin: 0; }
    .exam__info dt { font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: .08em; color: var(--cnm-text-3); }
    .exam__info dd { margin: 2px 0 0; }
    .exam__marches { padding: var(--cnm-space-2) var(--cnm-space-3); border-radius: 0 var(--cnm-radius-sm) var(--cnm-radius-sm) 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .exam__point { display: flex; flex-direction: column; gap: var(--cnm-space-2); padding: var(--cnm-space-3); background: var(--cnm-surface-2); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius-sm); }
    .exam__point-head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-2); }
    .exam__point-lbl { font-weight: var(--cnm-fw-medium); }
    .exam__point-desc { font-size: var(--cnm-fs-sm); margin: 0; }
    .exam__conforme { display: flex; align-items: center; gap: var(--cnm-space-1); font-size: var(--cnm-fs-sm); white-space: nowrap; }
    .exam__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); border-top: 1px solid var(--cnm-border); padding-top: var(--cnm-space-3); margin-top: var(--cnm-space-2); }
    @media (max-width: 60rem) { .exam__grid { grid-template-columns: 1fr; } }
  `,
})
export class ExamenDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dispatchService = inject(DispatchService);
  private readonly pointsCtrlService = inject(PointsCtrlService);
  private readonly avisService = inject(AvisService);
  private readonly examenService = inject(ExamenService);
  private readonly examenDetailService = inject(ExamenDetailService);
  private readonly pvExamenService = inject(PvExamenService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly dossier = signal<Dossier | null>(null);
  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly idDispatch = signal<number | null>(null);
  readonly points = signal<PointsCtrl[]>([]);
  readonly aviss = signal<Avis[]>([]);
  private readonly examens = signal<Examen[]>([]);
  private readonly details = signal<ExamenDetail[]>([]);
  private readonly pvs = signal<PvExamen[]>([]);

  readonly dateExamen = signal(new Date().toISOString().slice(0, 10));
  readonly avis = signal<string | null>(null);
  readonly synthese = signal('');
  private readonly rows = signal<Map<number, RowState>>(new Map());

  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly modeMap = signal<Map<string, string>>(new Map());

  /** Mode déduit du statut : DISPATCHE → création ; EXAMINE → édition ; sinon verrouillé. */
  readonly mode = computed<'create' | 'edit' | 'locked'>(() => {
    const s = this.dossier()?.statut;
    if (s === 'DISPATCHE') return 'create';
    if (s === 'EXAMINE') return 'edit';
    return 'locked';
  });
  private readonly existingExamenId = signal<number | null>(null);

  readonly estPpm = computed(() => this.dossier()?.idTypeDossier === 'PPM');
  readonly typeLabel = computed(() => {
    const id = this.dossier()?.idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier()?.idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });

  constructor() {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    this.avisService.list().subscribe((a) => this.aviss.set(a));

    forkJoin({
      dossier: this.dossierService.getById(this.idDossier),
      ppms: this.ppmService.list(),
      marches: this.marcheService.list(),
      receptions: this.receptionService.list(),
      dispatchs: this.dispatchService.list(),
      points: this.pointsCtrlService.list(),
      examens: this.examenService.list(),
      details: this.examenDetailService.list(),
      pvs: this.pvExamenService.list(),
    }).subscribe({
      next: (r) => {
        this.dossier.set(r.dossier);
        this.examens.set(r.examens);
        this.details.set(r.details);
        this.pvs.set(r.pvs);
        this.ppm.set(r.ppms.find((p) => p.idDossier === this.idDossier) ?? null);
        this.marches.set(r.marches.filter((m) => m.idDossier === this.idDossier));
        const recIds = new Set(
          r.receptions.filter((x) => x.idDossier === this.idDossier).map((x) => x.idReception),
        );
        this.idDispatch.set(r.dispatchs.find((d) => recIds.has(d.idReception))?.idDispatch ?? null);
        const pts = r.points
          .filter((p) => p.idTypeDossier === r.dossier.idTypeDossier)
          .sort((a, b) => (a.ordrePointCtrl ?? 0) - (b.ordrePointCtrl ?? 0));
        this.points.set(pts);
        const map = new Map<number, RowState>();
        for (const p of pts) {
          map.set(p.idPointCtrl, { conforme: true, observation: '', obsSiNonConforme: '' });
        }
        // Mode édition (dossier EXAMINE) : pré-remplir depuis l'examen existant + ses détails.
        if (r.dossier.statut === 'EXAMINE') {
          const idDispatch = this.idDispatch();
          const ex = r.examens.find((e) => e.idDispatch != null && e.idDispatch === idDispatch);
          if (ex) {
            this.existingExamenId.set(ex.idExamen);
            if (ex.dateExamen) this.dateExamen.set(ex.dateExamen);
            for (const det of r.details.filter((d) => d.idExamen === ex.idExamen)) {
              map.set(det.idPtControle, {
                conforme: det.conforme,
                observation: det.observation ?? '',
                obsSiNonConforme: det.obsSiNonConforme ?? '',
              });
            }
          }
        }
        this.rows.set(map);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  row(id: number): RowState {
    return this.rows().get(id) ?? { conforme: true, observation: '', obsSiNonConforme: '' };
  }
  private patchRow(id: number, patch: Partial<RowState>): void {
    this.rows.update((m) => {
      const next = new Map(m);
      next.set(id, { ...this.row(id), ...patch });
      return next;
    });
  }
  setConforme(id: number, v: boolean): void {
    this.patchRow(id, { conforme: v });
  }
  setObs(id: number, v: string): void {
    this.patchRow(id, { observation: v });
  }
  setObsNc(id: number, v: string): void {
    this.patchRow(id, { obsSiNonConforme: v });
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  private nextId(ids: number[]): number {
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  annuler(): void {
    void this.router.navigate(['/membre/tableau-de-bord']);
  }

  enregistrer(): void {
    const dossier = this.dossier();
    const idDispatch = this.idDispatch();
    if (!dossier || idDispatch == null) return;

    if (this.mode() === 'edit') {
      this.formError.set(null);
      this.saving.set(true);
      this.modifier(idDispatch);
      return;
    }

    if (!this.avis()) {
      this.formError.set('Sélectionnez un avis global (requis pour le projet de PV).');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);

    const im = this.auth.ref() ?? '';
    const idExamen = this.nextId(this.examens().map((e) => e.idExamen));
    const examen: Examen = { idExamen, idDispatch, imCtrlMembre: im || undefined, dateExamen: this.dateExamen() };

    this.examenService
      .create(examen)
      .pipe(
        switchMap(() => {
          const baseDetail = this.nextId(this.details().map((d) => d.idDetailExamen));
          const detailCalls = this.points().map((p, i) => {
            const st = this.row(p.idPointCtrl);
            const body: ExamenDetail = {
              idDetailExamen: baseDetail + i,
              idExamen,
              idPtControle: p.idPointCtrl,
              conforme: st.conforme,
              observation: st.observation || undefined,
              obsSiNonConforme: st.conforme ? undefined : st.obsSiNonConforme || undefined,
            };
            return this.examenDetailService.create(body);
          });
          const pv: PvExamen = {
            idPv: this.nextId(this.pvs().map((v) => v.idPv)),
            idExamen,
            idAvis: this.avis() as string,
            imCtrlMembre: im,
            statutPv: 'BROUILLON',
            nbNavettes: 0,
            syntheseObservations: this.synthese() || undefined,
          };
          return forkJoin([...detailCalls, this.pvExamenService.create(pv)]);
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success('Examen enregistré · projet de PV créé.');
          void this.router.navigate(['/membre/pv']);
        },
        error: (_e: ApiError) => this.saving.set(false), // 400/403/409 → toast centralisé
      });
  }

  /** Mode édition (dossier EXAMINE) : met à jour l'examen + réconcilie les détails (sans recréer le PV). */
  private modifier(idDispatch: number): void {
    const idExamen = this.existingExamenId();
    if (idExamen == null) {
      this.saving.set(false);
      return;
    }
    const im = this.auth.ref() ?? '';
    const examen: Examen = { idExamen, idDispatch, imCtrlMembre: im || undefined, dateExamen: this.dateExamen() };
    const detailByPoint = new Map(
      this.details()
        .filter((d) => d.idExamen === idExamen)
        .map((d) => [d.idPtControle, d]),
    );
    let baseNew = this.nextId(this.details().map((d) => d.idDetailExamen));

    this.examenService
      .update(idExamen, examen)
      .pipe(
        switchMap(() => {
          const calls = this.points().map((p) => {
            const st = this.row(p.idPointCtrl);
            const existing = detailByPoint.get(p.idPointCtrl);
            const body: ExamenDetail = {
              idDetailExamen: existing?.idDetailExamen ?? baseNew++,
              idExamen,
              idPtControle: p.idPointCtrl,
              conforme: st.conforme,
              observation: st.observation || undefined,
              obsSiNonConforme: st.conforme ? undefined : st.obsSiNonConforme || undefined,
            };
            return existing
              ? this.examenDetailService.update(existing.idDetailExamen, body)
              : this.examenDetailService.create(body);
          });
          return calls.length ? forkJoin(calls) : of([]);
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success('Examen modifié.');
          void this.router.navigate(['/membre/examines']);
        },
        error: (_e: ApiError) => this.saving.set(false), // 409 (verrouillé) / 403 → toast centralisé
      });
  }
}
