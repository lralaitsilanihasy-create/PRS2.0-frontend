import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  Avis,
  Dossier,
  Examen,
  ExamenDetail,
  LettreRenvoi,
  Marche,
  ObservationControle,
  PointsCtrl,
  Ppm,
  PvExamen,
} from '../../models';
import {
  AvisService,
  DispatchService,
  DossierService,
  ExamenDetailService,
  ExamenService,
  LettreRenvoiService,
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

/** Une ligne « AU LIEU DE / LIRE » saisie pour un point non conforme. */
interface ObsLigne {
  auLieuDe: string;
  lire: string;
}
interface RowState {
  conforme: boolean;
  /** Lignes d'observation (non-conformité) ; vide si conforme. */
  observations: ObsLigne[];
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
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Membre</div>
          <h1 class="page-title">{{ mode() === 'edit' ? 'Modifier l\\'examen' : 'Examiner' }} — {{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (!dossier()) {
        <p class="text-muted">Dossier introuvable ou hors de votre périmètre.</p>
      } @else {
        <div class="exam__grid">
          <div class="card exam__panel">
            <div class="card-header"><span class="card-title">Contenu du dossier</span></div>
            <div class="card-body">
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
                <div class="exam__marches">
                  <h3 class="exam__sub">Lignes de marché</h3>
                  @if (marches().length) {
                    <table>
                      <thead><tr><th>Désignation</th><th class="r">Montant</th><th>Mode</th></tr></thead>
                      <tbody>
                        @for (m of marches(); track m.idDetail) {
                          <tr>
                            <td>{{ m.designationMarche || '—' }}</td>
                            <td class="td-montant">{{ montant(m.montEstim) }}</td>
                            <td>{{ modeLabel(m.idMode) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="text-muted">Aucune ligne de marché.</p>
                  }
                </div>
              }
            </div>
          </div>

          <div class="card exam__panel">
            <div class="card-header"><span class="card-title">Consigner l'examen</span></div>
            <div class="card-body cnm-form">
              @if (mode() === 'locked') {
                <p class="form-hint">Examen verrouillé (PV signé / dossier clôturé) — lecture seule.</p>
              }
              @if (idDispatch() == null) {
                <p class="form-hint">Aucun dispatch trouvé pour ce dossier : examen impossible.</p>
              }

              <label class="form-group">
                <span class="form-label">Date d'examen</span>
                <input class="form-control" type="date" [value]="dateExamen()" (input)="dateExamen.set($any($event.target).value)" />
              </label>

              <h3 class="exam__sub">Grille de contrôle</h3>
              @if (!points().length) {
                <p class="text-muted">Aucun point de contrôle défini pour ce type de dossier.</p>
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
                    <div class="exam__obs">
                      <div class="exam__obs-header">
                        <span>AU LIEU DE</span>
                        <span>LIRE</span>
                        <span class="exam__obs-actions"></span>
                      </div>
                      @for (o of row(p.idPointCtrl).observations; track $index) {
                        <div class="exam__obs-row">
                          <textarea
                            class="form-control"
                            rows="2"
                            placeholder="Au lieu de…"
                            [value]="o.auLieuDe"
                            (input)="setAuLieuDe(p.idPointCtrl, $index, $any($event.target).value)"
                          ></textarea>
                          <textarea
                            class="form-control"
                            rows="2"
                            placeholder="Lire…"
                            [value]="o.lire"
                            (input)="setLire(p.idPointCtrl, $index, $any($event.target).value)"
                          ></textarea>
                          <button type="button" class="btn btn-secondary btn-sm exam__obs-del" (click)="retirerLigne(p.idPointCtrl, $index)" aria-label="Retirer">✕</button>
                        </div>
                      } @empty {
                        <p class="text-muted">Aucune ligne.</p>
                      }
                      <button type="button" class="btn btn-secondary btn-sm exam__obs-add" (click)="ajouterLigne(p.idPointCtrl)">+ Ajouter une ligne</button>
                      @if (pointErreur(p.idPointCtrl)) { <span class="form-error exam__obs-err">{{ pointErreur(p.idPointCtrl) }}</span> }
                    </div>
                  }
                </div>
              }

              @if (avisEditable()) {
                <h3 class="exam__sub">Avis & synthèse (projet de PV)</h3>
                <label class="form-group">
                  <span class="form-label">Avis global *</span>
                  <select class="form-control" [value]="avis() ?? ''" (change)="avis.set($any($event.target).value || null)">
                    <option value="">— Sélectionner —</option>
                    @for (a of aviss(); track a.idAvis) { <option [value]="a.idAvis">{{ a.libelleAvis || a.idAvis }}</option> }
                  </select>
                </label>
                <label class="form-group">
                  <span class="form-label">Synthèse des observations</span>
                  <textarea class="form-control" rows="3" [value]="synthese()" (input)="synthese.set($any($event.target).value)"></textarea>
                </label>
              } @else if (mode() === 'edit') {
                <h3 class="exam__sub">Avis & synthèse (projet de PV)</h3>
                <p class="form-hint"><strong>Avis global :</strong> {{ avisLabel(avis()) }}</p>
                @if (synthese()) { <p class="form-hint"><strong>Synthèse :</strong> {{ synthese() }}</p> }
                <p class="form-hint">Le projet de PV a déjà été soumis : l'avis et la synthèse se modifient désormais dans « Projets de PV ».</p>
              }

              @if (formError()) { <span class="form-error">{{ formError() }}</span> }
              @if (mode() === 'create') {
                <div class="exam__foot">
                  <button type="button" class="btn btn-outline" (click)="annuler()">Annuler</button>
                  <button type="button" class="btn btn-outline" [disabled]="saving() || idDispatch() == null" (click)="ouvrirModalLettre()">
                    Envoyer une lettre de renvoi
                  </button>
                  <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="soumettre()">
                    {{ saving() ? 'Enregistrement…' : "Soumettre l'examen" }}
                  </button>
                </div>
              } @else if (mode() === 'edit') {
                <div class="exam__foot">
                  <button type="button" class="btn btn-outline" (click)="annuler()">Annuler</button>
                  <button type="button" class="btn btn-outline" [disabled]="saving() || idDispatch() == null" (click)="ouvrirModalLettre()">
                    Envoyer une lettre de renvoi
                  </button>
                  <button type="button" class="btn btn-primary" [disabled]="saving() || idDispatch() == null" (click)="enregistrer()">
                    {{ saving() ? 'Enregistrement…' : "Modifier l'examen" }}
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (lettreModal()) {
        <div class="modal-backdrop" (click)="fermerLettre()">
          <div class="exam-modal cnm-form" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <h2 class="exam-modal__title">Lettre de renvoi</h2>
            <dl class="exam-modal__info">
              <div><dt>Référence dossier</dt><dd>{{ dossier()?.refeDossier || ('Dossier #' + idDossier) }}</dd></div>
              <div><dt>Date d'examen</dt><dd class="cnm-mono">{{ dateExamen() || '—' }}</dd></div>
              <div><dt>Date de la lettre</dt><dd class="cnm-mono">{{ dateLettre }}</dd></div>
            </dl>
            <label class="form-group">
              <span class="form-label">Corps de la lettre</span>
              <textarea class="form-control exam-modal__corps" rows="6" placeholder="Corps de la lettre…" [value]="corpsLettre()" (input)="corpsLettre.set($any($event.target).value)"></textarea>
            </label>
            <div class="exam-modal__foot">
              <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="fermerLettre()">Fermer</button>
              <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="enregistrerBrouillonLettre()">
                {{ saving() ? 'Enregistrement…' : 'Enregistrer brouillon' }}
              </button>
            </div>

            @if (lettresExamen().length) {
              <div class="exam-modal__list">
                <h3 class="exam__sub">Lettres de cet examen</h3>
                <table>
                  <thead><tr><th>Référence</th><th>Statut</th><th>Date</th><th></th></tr></thead>
                  <tbody>
                    @for (l of lettresExamen(); track l.idLettre) {
                      <tr>
                        <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                        <td><app-statut-badge [statut]="l.statut" /></td>
                        <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                        <td>
                          @if (l.statut === 'BROUILLON') {
                            <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="soumettreLettre(l)">Soumettre</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .exam__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; align-items: start; }
    .exam__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .exam__info { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; }
    .exam__info dt { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--n-400); }
    .exam__info dd { margin: 2px 0 0; }
    .exam__marches { display: flex; flex-direction: column; gap: 0.5rem; }
    .exam__point { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; background: var(--c-50); border: 1px solid var(--c-100); border-radius: var(--radius-md); }
    .exam__point-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .exam__point-lbl { font-weight: 500; }
    .exam__point-desc { font-size: var(--text-sm); margin: 0; }
    .exam__conforme { display: flex; align-items: center; gap: 0.25rem; font-size: var(--text-sm); white-space: nowrap; }
    .exam__obs { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
    .exam__obs-header, .exam__obs-row { display: flex; gap: 0.75rem; align-items: flex-start; align-self: stretch; }
    .exam__obs-header span:first-child, .exam__obs-header span:nth-child(2) { flex: 1 1 0; text-align: center; font-weight: 700; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-400); }
    .exam__obs-actions { width: 2rem; }
    .exam__obs-row textarea { flex: 1 1 0; min-height: 2.5rem; resize: none; word-wrap: break-word; white-space: pre-wrap; }
    .exam__obs-del { width: 2rem; align-self: flex-start; margin-top: 0.3rem; }
    .exam__obs-err { color: var(--danger-text); }
    .exam__foot { display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid var(--c-100); padding-top: 0.75rem; margin-top: 0.5rem; }
    .exam-modal { width: 100%; max-width: 44rem; max-height: 88vh; overflow: auto; background: #fff; border-radius: var(--radius-2xl); box-shadow: var(--shadow-xl); padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .exam-modal__list { overflow-x: auto; }
    .exam-modal__list table { width: 100%; }
    .exam-modal__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .exam-modal__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .exam-modal__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .exam-modal__info dt { flex: 0 0 10rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-400); }
    .exam-modal__info dd { margin: 0; }
    .exam-modal__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .exam-modal__corps { resize: vertical; }
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
  private readonly lettreRenvoiService = inject(LettreRenvoiService);
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
  /** Modal « Lettre de renvoi » (création) : visibilité + corps (objet fixe « lettre de renvoi »). */
  readonly lettreModal = signal(false);
  readonly corpsLettre = signal('');
  /** Lettres de renvoi déjà créées pour l'examen courant (affichées dans le modal). */
  readonly lettresExamen = signal<LettreRenvoi[]>([]);
  /** Date de la lettre = aujourd'hui (lecture seule). */
  readonly dateLettre = new Date().toISOString().slice(0, 10);
  private readonly rows = signal<Map<number, RowState>>(new Map());
  /** Erreur « ≥1 ligne obligatoire » par point de contrôle non conforme (clé = idPtControle). */
  readonly pointErreurs = signal<Map<number, string>>(new Map());

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
  /** Projet de PV rattaché à l'examen (mode edit) — porte l'avis + la synthèse à éditer. */
  private readonly existingPv = signal<PvExamen | null>(null);
  /**
   * Avis/synthèse éditables ici si : aucun projet de PV n'existe encore (examen créé sans soumission,
   * ex. via lettre de renvoi → « Modifier l'examen » le créera), OU le PV existant est encore BROUILLON.
   * Un PV déjà soumis (≠ BROUILLON) reste en lecture seule (→ « Projets de PV »).
   */
  readonly pvEditable = computed(() => {
    if (this.mode() !== 'edit') return false;
    const pv = this.existingPv();
    return pv === null || pv.statutPv === 'BROUILLON';
  });
  /** Le bloc avis/synthèse est éditable à la création, ou en édition tant que le PV est BROUILLON. */
  readonly avisEditable = computed(() => this.mode() === 'create' || this.pvEditable());

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
          map.set(p.idPointCtrl, { conforme: true, observations: [] });
        }
        // Mode édition (dossier EXAMINE) : pré-remplir depuis l'examen existant + ses détails.
        if (r.dossier.statut === 'EXAMINE') {
          const idDispatch = this.idDispatch();
          const ex = r.examens.find((e) => e.idDispatch != null && e.idDispatch === idDispatch);
          if (ex) {
            this.existingExamenId.set(ex.idExamen);
            if (ex.dateExamen) this.dateExamen.set(ex.dateExamen);
            // Projet de PV existant : préremplir avis + synthèse (éditables seulement si PV BROUILLON).
            const pv = r.pvs.find((p) => p.idExamen === ex.idExamen) ?? null;
            this.existingPv.set(pv);
            if (pv) {
              this.avis.set(pv.idAvis ?? null);
              this.synthese.set(pv.syntheseObservations ?? '');
            }
            for (const det of r.details.filter((d) => d.idExamen === ex.idExamen)) {
              map.set(det.idPtControle, {
                conforme: det.conforme,
                observations: (det.observations ?? []).map((o) => ({ auLieuDe: o.auLieuDe ?? '', lire: o.lire ?? '' })),
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
    return this.rows().get(id) ?? { conforme: true, observations: [] };
  }
  private patchRow(id: number, patch: Partial<RowState>): void {
    this.rows.update((m) => {
      const next = new Map(m);
      next.set(id, { ...this.row(id), ...patch });
      return next;
    });
  }
  /** Coche/décoche « non conforme » : conforme → vide le tableau ; non conforme → amorce une ligne vide. */
  setConforme(id: number, conforme: boolean): void {
    if (conforme) {
      this.patchRow(id, { conforme: true, observations: [] });
    } else {
      const obs = this.row(id).observations;
      this.patchRow(id, { conforme: false, observations: obs.length ? obs : [{ auLieuDe: '', lire: '' }] });
    }
  }
  ajouterLigne(id: number): void {
    this.patchRow(id, { observations: [...this.row(id).observations, { auLieuDe: '', lire: '' }] });
  }
  retirerLigne(id: number, i: number): void {
    this.patchRow(id, { observations: this.row(id).observations.filter((_, idx) => idx !== i) });
  }
  setAuLieuDe(id: number, i: number, v: string): void {
    this.patchRow(id, { observations: this.row(id).observations.map((o, idx) => (idx === i ? { ...o, auLieuDe: v } : o)) });
  }
  setLire(id: number, i: number, v: string): void {
    this.patchRow(id, { observations: this.row(id).observations.map((o, idx) => (idx === i ? { ...o, lire: v } : o)) });
  }
  pointErreur(id: number): string | undefined {
    return this.pointErreurs().get(id);
  }
  /** Chaque point non conforme doit avoir ≥1 ligne renseignée ; sinon erreur sous le tableau, envoi bloqué. */
  private validerObservations(): boolean {
    const err = new Map<number, string>();
    for (const p of this.points()) {
      const st = this.row(p.idPointCtrl);
      if (!st.conforme && !st.observations.some((o) => o.auLieuDe.trim() || o.lire.trim())) {
        err.set(p.idPointCtrl, "Au moins une ligne d'observation est obligatoire pour un point non conforme.");
      }
    }
    this.pointErreurs.set(err);
    return err.size === 0;
  }
  /** Lignes d'observation à envoyer pour un point (vide si conforme ; ordre 1-based). */
  private observationsBody(st: RowState): ObservationControle[] {
    if (st.conforme) {
      return [];
    }
    return st.observations
      .filter((o) => o.auLieuDe.trim() || o.lire.trim())
      .map((o, i) => ({ auLieuDe: o.auLieuDe.trim() || undefined, lire: o.lire.trim() || undefined, ordre: i + 1 }));
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  /** Libellé d'un avis global (lecture seule, mode edit avec PV déjà soumis). */
  avisLabel(id: string | null): string {
    return id ? this.aviss().find((a) => a.idAvis === id)?.libelleAvis ?? id : '—';
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

  /** Mode édition (dossier EXAMINE) : met à jour l'examen + ses détails (pas de nouveau PV/lettre). */
  enregistrer(): void {
    const idDispatch = this.idDispatch();
    if (!this.dossier() || idDispatch == null) return;
    if (!this.validerObservations()) return;
    // PV encore BROUILLON : l'avis est édité ici (requis) et mis à jour avec l'examen.
    if (this.pvEditable() && !this.avis()) {
      this.formError.set('Sélectionnez un avis global (requis pour le projet de PV).');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.modifier(idDispatch);
  }

  /** Création — « Soumettre l'examen » : avis global obligatoire, crée l'examen puis le projet de PV. */
  soumettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.validerObservations()) return;
    if (!this.avis()) {
      this.formError.set('Sélectionnez un avis global (requis pour le projet de PV).');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    this.ensureExamen()
      .pipe(
        switchMap((idExamen) => this.examenService.soumettre(idExamen, { idAvis: this.avis() as string })),
        // ExamenSoumissionRequest ne porte que idAvis : on persiste la synthèse via une MAJ du PV créé
        // (encore BROUILLON) — PUT /api/pv-examens/{id}.
        switchMap((pv) => {
          const synthese = this.synthese().trim();
          return synthese ? this.pvExamenService.update(pv.idPv, { ...pv, syntheseObservations: synthese }) : of(pv);
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success('Examen enregistré · projet de PV créé.');
          void this.router.navigate(['/membre/pv']);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.toast.error(e.message || "Erreur lors de la soumission de l'examen.");
        },
      });
  }

  // — Lettre(s) de renvoi pendant l'examen (action séparée ; plusieurs lettres possibles) —
  ouvrirModalLettre(): void {
    if (!this.dossier() || this.idDispatch() == null) return;
    if (!this.validerObservations()) return;
    this.corpsLettre.set('');
    this.chargerLettresExamen();
    this.lettreModal.set(true);
  }
  fermerLettre(): void {
    if (!this.saving()) {
      this.lettreModal.set(false);
    }
  }
  /** Enregistre un brouillon de lettre (crée l'examen au besoin), puis recharge la liste de l'examen. */
  enregistrerBrouillonLettre(): void {
    this.saving.set(true);
    const corps = this.corpsLettre().trim();
    this.ensureExamen()
      .pipe(switchMap((idExamen) => this.lettreRenvoiService.creer({ idExamen, corpsLettre: corps || undefined })))
      .subscribe({
        next: () => {
          this.toast.success('Brouillon de lettre de renvoi enregistré.');
          this.corpsLettre.set('');
          this.saving.set(false);
          this.chargerLettresExamen();
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.toast.error(e.message || "Erreur lors de l'enregistrement de la lettre.");
        },
      });
  }
  /** Soumet une lettre de renvoi (BROUILLON → SOUMIS). */
  soumettreLettre(l: LettreRenvoi): void {
    if (l.idLettre == null) return;
    this.saving.set(true);
    this.lettreRenvoiService.soumettre(l.idLettre).subscribe({
      next: () => {
        this.toast.success('Lettre de renvoi soumise.');
        this.saving.set(false);
        this.chargerLettresExamen();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.toast.error(e.message || 'Erreur lors de la soumission de la lettre.');
      },
    });
  }

  /** Recharge les lettres de l'examen courant (vide tant que l'examen n'existe pas). */
  private chargerLettresExamen(): void {
    const idExamen = this.existingExamenId();
    if (idExamen == null) {
      this.lettresExamen.set([]);
      return;
    }
    this.lettreRenvoiService
      .getAll()
      .subscribe((rows) => this.lettresExamen.set(rows.filter((l) => l.idExamen === idExamen)));
  }

  /** Garantit l'existence de l'examen (le crée + ses détails si besoin) et renvoie son id. */
  private ensureExamen(): Observable<number> {
    const existing = this.existingExamenId();
    if (existing != null) {
      return of(existing);
    }
    const im = this.auth.ref() ?? '';
    const idExamen = this.nextId(this.examens().map((e) => e.idExamen));
    const examen: Examen = {
      idExamen,
      idDispatch: this.idDispatch() as number,
      imCtrlMembre: im || undefined,
      dateExamen: this.dateExamen(),
    };
    return this.examenService.create(examen).pipe(
      switchMap(() => {
        const baseDetail = this.nextId(this.details().map((d) => d.idDetailExamen));
        const detailCalls = this.points().map((p, i) =>
          this.examenDetailService.create({
            idDetailExamen: baseDetail + i,
            idExamen,
            idPtControle: p.idPointCtrl,
            conforme: this.row(p.idPointCtrl).conforme,
            observations: this.observationsBody(this.row(p.idPointCtrl)),
          }),
        );
        return detailCalls.length ? forkJoin(detailCalls) : of([]);
      }),
      map(() => {
        this.existingExamenId.set(idExamen);
        this.examens.update((arr) => [...arr, examen]);
        return idExamen;
      }),
    );
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
              observations: this.observationsBody(st),
            };
            return existing
              ? this.examenDetailService.update(existing.idDetailExamen, body)
              : this.examenDetailService.create(body);
          });
          return calls.length ? forkJoin(calls) : of([]);
        }),
        // Projet de PV éditable : on met à jour (PV BROUILLON existant) ou on le CRÉE (aucun PV encore),
        // puis on persiste la synthèse — dans la foulée de la mise à jour de l'examen.
        switchMap(() => {
          if (!this.pvEditable()) return of(null);
          const pv = this.existingPv();
          const synthese = this.synthese().trim() || undefined;
          if (pv) {
            return this.pvExamenService.update(pv.idPv, {
              ...pv,
              idAvis: this.avis() as string,
              syntheseObservations: synthese,
            });
          }
          // Aucun projet de PV (examen créé sans soumission, ex. via lettre de renvoi) → le créer
          // DIRECTEMENT (POST /api/pv-examens). On n'utilise pas la façade examens/{id}/soumettre :
          // elle attend un dossier DISPATCHE et renvoie 400 sur un dossier déjà EXAMINE.
          const nouveauPv: PvExamen = {
            idPv: this.nextId(this.pvs().map((p) => p.idPv)),
            idExamen,
            idAvis: this.avis() as string,
            imCtrlMembre: this.auth.ref() ?? '', // @NotBlank requis ; valeur ignorée (dérivée du dispatch)
            statutPv: 'BROUILLON',
            nbNavettes: 0,
            syntheseObservations: synthese,
          };
          return this.pvExamenService.create(nouveauPv);
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
