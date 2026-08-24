import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, validerFichier } from '../../core/securite/fichiers-surs';
import {
  AnomalieTranscription,
  Capm,
  Compte,
  Dossier,
  EditionPpmRequest,
  ExamenPiece,
  Marche,
  MarchePrevision,
  ModePassation,
  Nature,
  ObservationPv,
  PieceJointeDossier,
  Ppm,
  SaisieMarcheLigne,
  SaisiePpmImportResult,
  ServiceBeneficiaire,
  SoaBeneficiaire,
} from '../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  ExamenPieceService,
  MarchePrevisionService,
  MarcheService,
  ModePassationService,
  NatureService,
  ObservationPvService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  SaisieService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
} from '../../services';
import { ObservationPvCard } from '../../shared/circuit';
import { PpmFormFactory } from '../../shared/prmp/ppm-form-factory';
import { ModificationChamp, PpmSaisieGrid } from '../../shared/prmp/ppm-saisie-grid';

/**
 * « Rectifier le dossier » (PRMP, statut `EN_ATTENTE_DECISION_PRMP`).
 *
 * ⚠️ Règle MODIFIÉE (2026-08-02, demande user) — la rectification se fait par l'IMPORTATION du PPM
 * RECTIFIÉ (PDF) : plus de formulaire manuel. Même mécanique que la soumission / le réimport de
 * brouillon (parse read-only `POST /api/saisies/ppm/import` → prévisualisation dans la grille
 * partagée → `PUT /api/saisies/ppm/{idDossier}`), avec les contraintes de la rectification :
 *  - la STRUCTURE est FIGÉE : le PDF doit comporter le MÊME NOMBRE de lignes que le dossier examiné
 *    (chaque ligne importée est appariée par POSITION à une ligne existante — `idDetail` conservé,
 *    l'examen référence les lignes) ; ni ajout ni retrait (garde backend 409) ;
 *  - l'entité du PDF doit être celle du dossier (garde à l'import) ;
 *  - signataire / référence du PPM actuels conservés (non extraits du PDF).
 * Le statut du dossier reste inchangé jusqu'à la resoumission (« Dossiers à rectifier »).
 */
@Component({
  selector: 'app-rectifier-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ObservationPvCard, PpmSaisieGrid],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Rectifier le dossier</h1>
          @if (dossier(); as d) {
            <p class="rd-ref">
              <span class="cnm-mono fw-semibold">{{ d.refeDossier || '#' + d.idDossier }}</span>
              <span class="rd-ref__sep">{{ entiteLabel() }}</span>
            </p>
          }
        </div>
        <div class="page-header--actions">
          <button type="button" class="btn btn-outline" (click)="annuler()">← Dossiers à rectifier</button>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (ppm(); as p) {
        <div class="alert alert-info">
          Corrigez votre PPM selon les observations du PV ci-dessous, puis <strong>importez le PPM
          rectifié (PDF)</strong> : c'est l'import qui enregistre la rectification. Le dossier reste
          « à rectifier » jusqu'à la resoumission.
        </div>

        <!-- ⚠️ Spec « circuit des observations FAVR » (2026-08-02) — rectifications demandées = les
             observations du PV, PÉRIMÈTRE FIGÉ (aucune exigence nouvelle possible). Lecture seule. -->
        @if (observations().length) {
          <div class="card rd-form">
            <h2 class="rd-section">
              <span class="rd-step">1</span> Observations du PV — rectifications demandées
              @if (nbObsASatisfaire(); as n) {
                <span class="rd-chip rd-chip--warn">{{ n }} à satisfaire</span>
              } @else {
                <span class="rd-chip rd-chip--ok">toutes levées</span>
              }
            </h2>
            <ul class="rd-obs">
              @for (o of observations(); track o.idObservationPv; let i = $index) {
                <li><app-observation-pv-card [obs]="o" [numero]="i + 1" /></li>
              }
            </ul>
            <p class="form-hint">
              Le périmètre des observations est figé sur celui du PV : seules celles-ci sont à satisfaire.
              Une observation levée est définitivement acquise.
            </p>
          </div>
        }

        <!-- Identité figée (lecture seule, non envoyée) — dossier et entité déjà dans l'en-tête. -->
        <div class="card rd-frozen">
          <span class="rd-frozen__item"><span class="rd-frozen__k">Référence PRMP</span> <span class="fw-semibold">{{ p.reference || '—' }}</span></span>
          <span class="rd-frozen__item"><span class="rd-frozen__k">Lignes de marché</span> <span class="fw-semibold">{{ nbLignesActuelles() }}</span></span>
          <span class="rd-frozen__hint text-muted">Identité et structure figées — la rectification met à jour le contenu des lignes.</span>
        </div>

        <!-- ⚠️ 2026-08-02 (demande user ×2) — la rectification couvre AUSSI les pièces jointes, mais
             SEULES les pièces CITÉES dans les observations du PV sont présentées (avec leurs versions
             du même type) : la PRMP joint la VERSION CORRIGÉE (nouvel upload du même type — l'original
             est conservé, traçabilité). Aucune observation de pièce → section absente. -->
        @if (piecesConcernees().length) {
        <div class="card rd-form">
          <h2 class="rd-section">
            <span class="rd-step">2</span> Pièces jointes — versions corrigées
            @if (nbPiecesACorriger(); as n) {
              <span class="rd-chip rd-chip--warn">{{ n }} pièce(s) à corriger</span>
            } @else {
              <span class="rd-chip rd-chip--ok">aucune action attendue</span>
            }
          </h2>
            <ul class="rd-pieces">
              @for (pc of piecesConcernees(); track pc.idPiece) {
                <li class="rd-piece" [class.rd-piece--obs]="obsPourPiece(pc)">
                  <div class="rd-piece__info">
                    <span class="rd-piece__type">{{ pc.libellePiece || 'Type #' + pc.idTypePiece }}</span>
                    <span class="rd-piece__fichier cnm-mono">{{ pc.nomFichier || '—' }}</span>
                    @if (pc.dateUpload) { <span class="rd-piece__date">{{ pc.dateUpload.slice(0, 10) }}</span> }
                  </div>
                  @if (obsPourPiece(pc); as obs) {
                    <span class="rd-piece__badge" [title]="obs.libelle">⚠ Observation du PV — version corrigée attendue</span>
                    <!-- Le bouton n'existe QUE sur la pièce visée par l'observation : les autres
                         versions du même type (dont les corrigées déjà jointes) sont informatives. -->
                    <label class="btn btn-secondary btn-sm rd-piece__upload" [class.rd-piece__upload--busy]="uploadPiece() === pc.idPiece">
                      📎 {{ uploadPiece() === pc.idPiece ? 'Envoi…' : 'Joindre la version corrigée' }}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden
                        (change)="joindreVersionCorrigee(pc, $event)" [disabled]="uploadPiece() != null" />
                    </label>
                  } @else if (pc.versionCorrigee) {
                    <span class="vc-tag rd-piece__vc">Corrigée</span>
                  } @else {
                    <span class="rd-piece__note">Version du même type — aucune action attendue</span>
                  }
                </li>
              }
            </ul>
            <p class="form-hint">
              Seules les pièces citées dans les observations du PV sont présentées. La version corrigée
              s'ajoute au dossier (l'original est conservé pour la traçabilité) — le vérificateur la
              retrouvera lors de la levée des observations.
            </p>
        </div>
        }

        @if (!importApercu()) {
          <!-- Import du PPM rectifié : SEULE voie de rectification (zone d'import mise en valeur). -->
          <div class="card rd-form rd-import">
            <h2 class="rd-section"><span class="rd-step">3</span> Importer le PPM rectifié (PDF)</h2>
            <label class="rd-drop" [class.rd-drop--busy]="importEnCours()">
              <span class="rd-drop__icone" aria-hidden="true">{{ importEnCours() ? '⏳' : '📄' }}</span>
              <span class="rd-drop__titre">{{ importEnCours() ? 'Analyse du PDF…' : 'Importer le PPM rectifié (PDF)' }}</span>
              <span class="rd-drop__hint">
                Le PDF est analysé puis présenté en prévisualisation — rien n'est enregistré avant votre
                validation. Même entité contractante, mêmes {{ nbLignesActuelles() }} ligne(s) de marché
                que le dossier examiné.
              </span>
              <span class="btn btn-primary rd-drop__btn">Choisir le fichier…</span>
              <input type="file" accept=".pdf,application/pdf" hidden (change)="importerPdf($event)" [disabled]="importEnCours()" />
            </label>
            @if (importErreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          </div>
        } @else {
          <!-- PRÉVISUALISATION : grille partagée (identique soumission / réimport) — rien n'est écrit
               tant qu'« Enregistrer la rectification » n'est pas cliqué. -->
          <div class="alert alert-warning">
            ⚠ <strong>Prévisualisation du PPM rectifié</strong> — {{ nbLignesImportees() }} ligne(s) lue(s)
            pour {{ nbLignesActuelles() }} ligne(s) du dossier. Chaque ligne est appariée à la ligne
            correspondante du dossier examiné (structure figée). Signataire et référence actuels conservés.
            <strong>Rien n'est enregistré avant validation.</strong>
          </div>
          @if (!structureOk()) {
            <div class="alert alert-danger" role="alert">
              Le PPM rectifié comporte {{ nbLignesImportees() }} ligne(s) alors que le dossier examiné en
              comporte {{ nbLignesActuelles() }} : la structure du dossier est figée (ni ajout ni retrait).
              Corrigez le document puis réimportez-le.
            </div>
          }
          @if (importMarches(); as arr) {
            <app-ppm-saisie-grid
              [marches]="arr"
              [natures]="natures()"
              [modesList]="modes()"
              [comptes]="comptes()"
              [soaList]="soaList()"
              [capms]="capms()"
              [anomaliesParLigne]="anomaliesImport()"
              [modificationsParLigne]="modifsImport()"
              [statutParUid]="statutsImport()"
              mode="import"
            />
          }
          @if (error(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
          <div class="rd-foot">
            <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="annulerImport()">Annuler l'import</button>
            <button type="button" class="btn btn-primary"
              [disabled]="saving() || !importPret() || !structureOk()"
              [title]="structureOk() ? (importPret() ? '' : 'Validez chaque ligne signalée et corrigez les montants incohérents.') : 'Le nombre de lignes doit être identique à celui du dossier examiné.'"
              (click)="enregistrerRectification()">
              {{ saving() ? 'Enregistrement…' : '💾 Enregistrer la rectification' }}
            </button>
          </div>
        }
      } @else {
        <div class="alert alert-info">Ce dossier n'a pas de PPM à rectifier.</div>
        <div class="rd-foot">
          <button type="button" class="btn btn-outline" (click)="annuler()">Retour</button>
        </div>
      }
    </section>
  `,
  styles: `
    .rd-frozen { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.6rem 1.25rem; margin-bottom: 0.75rem; }
    .rd-frozen__item { display: inline-flex; gap: 0.3rem; align-items: baseline; }
    .rd-frozen__k { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .rd-frozen__hint { margin-left: auto; font-size: var(--text-xs); }
    .rd-ref { margin: 0.2rem 0 0; color: var(--n-500); font-size: var(--text-sm); }
    /* Séparateur PUREMENT visuel entre la référence du dossier et son entité — n-300 est
       calibré bordures/fonds (pas texte, AUDIT.md A2) : plus de « · » coloré, une bordure. */
    .rd-ref__sep { margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--n-300); }
    .rd-form { padding: 1.25rem 1.5rem; margin-bottom: 0.75rem; }
    .rd-section { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.75rem; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    /* Numéro d'étape du parcours de rectification (1 observations → 2 pièces → 3 PPM). */
    .rd-step { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; border-radius: 999px; background: var(--c-600); color: #fff; font-size: var(--text-sm); font-weight: 800; }
    .rd-chip { margin-left: auto; font-size: var(--text-xs); font-weight: 700; padding: 0.15rem 0.6rem; border-radius: 999px; }
    .rd-chip--warn { background: var(--warning-bg); color: var(--warning-text); }
    .rd-chip--ok { background: #DCFCE7; color: #15803D; }
    .rd-foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    /* Zone d'import du PPM rectifié (étape 3) — appel à l'action central. */
    .rd-drop { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.75rem 1.5rem; border: 2px dashed var(--c-300); border-radius: var(--radius-lg); background: var(--c-50); cursor: pointer; text-align: center; transition: border-color 0.15s, background 0.15s; }
    .rd-drop:hover { border-color: var(--c-600); background: var(--c-100); }
    .rd-drop--busy { opacity: 0.7; pointer-events: none; }
    .rd-drop__icone { font-size: 2rem; line-height: 1; }
    .rd-drop__titre { font-weight: 700; color: var(--c-800); }
    .rd-drop__hint { max-width: 46rem; font-size: var(--text-xs); color: var(--n-500); }
    .rd-drop__btn { margin-top: 0.25rem; }
    /* ⚠️ Spec observations FAVR — rectifications demandées (cartes partagées, lecture seule). */
    .rd-obs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    /* Pièces jointes — versions corrigées. */
    .rd-pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .rd-piece { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.5rem 0.65rem; border: 1px solid var(--c-100); border-radius: var(--radius-md); }
    .rd-piece--obs { border-color: var(--warning-bdr, #FDE68A); background: var(--warning-bg); }
    .rd-piece__info { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; }
    .rd-piece__type { font-weight: 600; color: var(--n-700); font-size: var(--text-sm); }
    .rd-piece__fichier { color: var(--n-500); font-size: var(--text-xs); }
    .rd-piece__date { color: var(--n-400); font-size: var(--text-xs); }
    .rd-piece__badge { font-size: var(--text-xs); font-weight: 700; color: var(--warning-text); }
    .rd-piece__upload { margin-left: auto; cursor: pointer; }
    .rd-piece__upload--busy { opacity: 0.7; pointer-events: none; }
    .rd-piece__note { margin-left: auto; font-size: var(--text-xs); color: var(--n-400); font-style: italic; }
    .rd-piece__vc { margin-left: auto; }
  `,
})
export class RectifierDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly dossierService = inject(DossierService);
  private readonly natureService = inject(NatureService);
  private readonly compteService = inject(CompteService);
  private readonly modePassationService = inject(ModePassationService);
  private readonly soaBenefService = inject(SoaBeneficiaireService);
  private readonly capmService = inject(CapmService);
  private readonly saisieService = inject(SaisieService);
  private readonly serviceBeneficiaireService = inject(ServiceBeneficiaireService);
  private readonly marchePrevisionService = inject(MarchePrevisionService);
  private readonly observationPvService = inject(ObservationPvService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly examenPieceService = inject(ExamenPieceService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly factory = inject(PpmFormFactory);

  private readonly idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  readonly dossier = signal<Dossier | null>(null);
  /** Lignes de marché ACTUELLES du dossier, triées par idDetail (appariement par position). */
  private readonly marchesActuels = signal<Marche[]>([]);
  /** Bénéficiaires ACTUELS par idDetail (ordre stable idBenef) — pour la comparaison import ↔ dossier. */
  private readonly benefsActuels = signal<Map<number, ServiceBeneficiaire[]>>(new Map());
  /** Prévisions CAPM ACTUELLES par idDetail — pour la comparaison des calendriers. */
  private readonly previsionsActuelles = signal<Map<number, MarchePrevision[]>>(new Map());
  /** ⚠️ 2026-08-15 — comparaison import ↔ dossier : champs modifiés par ligne (uid) + statut de ligne. */
  readonly modifsImport = signal<Map<number, ModificationChamp[]>>(new Map());
  readonly statutsImport = signal<Map<number, string>>(new Map());
  readonly nbLignesActuelles = computed(() => this.marchesActuels().length);
  readonly error = signal<string | null>(null);
  /** ⚠️ Spec observations FAVR (2026-08-02) — observations du PV (périmètre figé), lecture seule. */
  readonly observations = signal<ObservationPv[]>([]);
  /** Pièces jointes du dossier (la rectification couvre aussi les pièces — versions corrigées). */
  readonly pieces = signal<PieceJointeDossier[]>([]);
  /** idExamenPiece → idPiece (résultats d'examen) — pont observation « pièce » → pièce concernée. */
  private readonly examenPieceVersPiece = signal<Map<number, number>>(new Map());
  /** idPiece dont la version corrigée est en cours d'envoi (null sinon). */
  readonly uploadPiece = signal<number | null>(null);
  private readonly returnUrl = signal('/prmp/a-rectifier');

  // — Référentiels de la grille partagée —
  readonly natures = signal<Nature[]>([]);
  readonly modes = signal<ModePassation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly soaList = signal<SoaBeneficiaire[]>([]);
  readonly capms = signal<Capm[]>([]);
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  readonly entiteLabel = computed(() => {
    const id = this.dossier()?.idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });

  // — Import (prévisualisation ; rien n'est écrit avant « Enregistrer la rectification ») —
  readonly importEnCours = signal(false);
  readonly importErreur = signal<string | null>(null);
  readonly importApercu = signal<SaisiePpmImportResult | null>(null);
  readonly importMarches = signal<FormArray | null>(null);
  readonly anomaliesImport = signal<Map<number, AnomalieTranscription[]>>(new Map());
  readonly grid = viewChild(PpmSaisieGrid);
  readonly nbLignesImportees = computed(() => this.importMarches()?.length ?? 0);
  /** Structure figée : autant de lignes importées que de lignes du dossier examiné. */
  readonly structureOk = computed(
    () => this.nbLignesImportees() > 0 && this.nbLignesImportees() === this.nbLignesActuelles(),
  );

  constructor() {
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    if (ret) {
      this.returnUrl.set(ret);
    }
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));

    // UNE vague : PPM + lignes + dossier (entité) + observations + référentiels de la grille.
    forkJoin({
      ppms: this.ppmService.list(),
      marches: this.marcheService.list(),
      dossier: this.dossierService.getById(this.idDossier),
      natures: this.natureService.list(),
      comptes: this.compteService.list(),
      modes: this.modePassationService.list(),
      soas: this.soaBenefService.list(),
      capms: this.capmService.getAll(),
      observations: this.observationPvService.parDossier(this.idDossier).pipe(catchError(() => of([] as ObservationPv[]))),
      pieces: this.pieceService.getByDossier(this.idDossier).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      examenPieces: this.examenPieceService.list().pipe(catchError(() => of([] as ExamenPiece[]))),
      benefs: this.serviceBeneficiaireService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      previsions: this.marchePrevisionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
    }).subscribe({
      next: ({ ppms, marches, dossier, natures, comptes, modes, soas, capms, observations, pieces, examenPieces, benefs, previsions }) => {
        this.observations.set(observations);
        this.pieces.set(pieces);
        this.examenPieceVersPiece.set(
          new Map(examenPieces.filter((ep) => ep.idExamenPiece != null).map((ep) => [ep.idExamenPiece!, ep.idPiece])),
        );
        this.dossier.set(dossier);
        this.natures.set(natures);
        this.comptes.set(comptes);
        this.modes.set(modes);
        this.soaList.set(soas);
        this.capms.set(capms);
        const ppm = ppms.find((p) => p.idDossier === this.idDossier) ?? null;
        this.ppm.set(ppm);
        if (ppm) {
          this.marchesActuels.set(
            marches.filter((m) => m.idPpm === ppm.idPpm).sort((a, b) => (a.idDetail ?? 0) - (b.idDetail ?? 0)),
          );
          // Bénéficiaires + prévisions CAPM des lignes du dossier (pour le diff import ↔ dossier).
          const idsDetail = new Set(this.marchesActuels().map((m) => m.idDetail));
          const benefMap = new Map<number, ServiceBeneficiaire[]>();
          for (const b of benefs.filter((x) => idsDetail.has(x.idDetail)).sort((a, x) => a.idBenef - x.idBenef)) {
            benefMap.set(b.idDetail, [...(benefMap.get(b.idDetail) ?? []), b]);
          }
          this.benefsActuels.set(benefMap);
          const prevMap = new Map<number, MarchePrevision[]>();
          for (const p of previsions.filter((x) => idsDetail.has(x.idDetail))) {
            prevMap.set(p.idDetail, [...(prevMap.get(p.idDetail) ?? []), p]);
          }
          this.previsionsActuelles.set(prevMap);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Parse read-only du PDF rectifié → prévisualisation (gardes : entité du dossier, PDF lisible). */
  importerPdf(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) {
      return;
    }
    const erreurFichier = validerFichier(file, TYPES_PDF);
    if (erreurFichier) {
      this.toast.error(erreurFichier);
      return;
    }
    this.importErreur.set(null);
    this.importEnCours.set(true);
    this.saisieService.importPpm(file).subscribe({
      next: (r) => {
        this.importEnCours.set(false);
        // Entité du PDF ≠ entité du dossier → refus (l'entité d'un dossier est fixe).
        const entiteDossier = this.dossier()?.idEntiteContract ?? null;
        if (r.idEntiteContract != null && entiteDossier != null && r.idEntiteContract !== entiteDossier) {
          this.importErreur.set(
            `Ce PDF concerne l'entité « ${(r.autoriteContractante ?? '').trim() || r.idEntiteContract} » — le dossier concerne « ${this.entiteLabel()} ». Importez le PPM rectifié de la même entité.`,
          );
          return;
        }
        const arr = this.factoryArray(r);
        this.importApercu.set(r);
        this.importMarches.set(arr);
        this.calculerComparaison(arr);
      },
      error: (e: ApiError) => {
        this.importEnCours.set(false);
        this.importErreur.set(e.message || 'PDF illisible ou non conforme.');
      },
    });
  }

  /** Monte les lignes importées en formulaire (fabrique partagée) + anomalies de transcription. */
  private factoryArray(r: SaisiePpmImportResult): FormArray {
    const arr = new FormArray<FormGroup>([]);
    const anomMap = new Map<number, AnomalieTranscription[]>();
    for (const m of r.marches ?? []) {
      const g = this.factory.construireMarcheDepuisImport(m, this.capms(), this.modes());
      arr.push(g);
      const anom = (m.anomalies ?? []).filter((a) => a.type !== 'REFERENTIEL_INCONNU');
      if (anom.length) {
        anomMap.set(g.get('uid')!.value as number, anom);
      }
    }
    this.anomaliesImport.set(anomMap);
    return arr;
  }

  annulerImport(): void {
    if (this.saving()) {
      return;
    }
    this.importApercu.set(null);
    this.importMarches.set(null);
    this.anomaliesImport.set(new Map());
    this.modifsImport.set(new Map());
    this.statutsImport.set(new Map());
    this.error.set(null);
  }

  // ── Comparaison import ↔ dossier examiné (2026-08-15) ────────────────────────────────────────────
  /** Valeur textuelle normalisée (null/'' équivalents, espaces réduits) pour comparer sans bruit. */
  private static texte(v: unknown): string {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }
  private static nombre(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  private static fmtMontant(v: number | null): string {
    return v == null ? '—' : v.toLocaleString('fr-FR');
  }

  /**
   * Compare chaque ligne importée à la ligne ACTUELLE correspondante du dossier (appariement
   * positionnel — structure figée) : champs de la ligne, bénéficiaires (par position) et calendrier
   * CAPM (par processus). Alimente `modifsImport` (cellules + récap « avant → après » de la grille)
   * et `statutsImport` (badge Modifiée / Inchangée par ligne). Structure non conforme → maps vides
   * (le bandeau rouge bloque déjà).
   */
  private calculerComparaison(arr: FormArray): void {
    const actuels = this.marchesActuels();
    if (!arr.length || arr.length !== actuels.length) {
      this.modifsImport.set(new Map());
      this.statutsImport.set(new Map());
      return;
    }
    const txt = RectifierDossier.texte;
    const num = RectifierDossier.nombre;
    const fmt = RectifierDossier.fmtMontant;
    const natureLib = new Map(this.natures().map((n) => [n.idNature, n.libelle ?? '']));
    const modeLib = new Map(this.modes().map((m) => [m.idMode, m.libelle ?? '']));
    const capmLib = new Map(this.capms().map((c) => [c.idCapm, c.libelleProcessus ?? '#' + c.idCapm]));
    const modifs = new Map<number, ModificationChamp[]>();
    const statuts = new Map<number, string>();

    for (let i = 0; i < arr.length; i++) {
      const g = arr.at(i) as FormGroup;
      const v = g.getRawValue() as Record<string, unknown>;
      const m = actuels[i];
      const liste: ModificationChamp[] = [];
      const champTexte = (champ: string, libelle: string, imp: string, act: string) => {
        if (imp.localeCompare(act, 'fr', { sensitivity: 'base' }) !== 0) {
          liste.push({ champ, libelle: `${libelle} : « ${act || '—'} » → « ${imp || '—'} »` });
        }
      };
      const champMontant = (champ: string, libelle: string, imp: number | null, act: number | null) => {
        if (imp !== act) liste.push({ champ, libelle: `${libelle} : ${fmt(act)} → ${fmt(imp)}` });
      };

      champTexte('designationMarche', 'Objet', txt(v['designationMarche']), txt(m.designationMarche));
      champMontant('montEstim', 'Montant estimé', num(v['montEstim']), num(m.montEstim));
      champMontant('nouvMontEstim', 'Nouveau montant', num(v['nouvMontEstim']), num(m.nouvMontEstim));
      champTexte('natureLibelle', 'Nature', txt(v['natureLibelle']), txt(m.idNature != null ? natureLib.get(m.idNature) : ''));
      champTexte('modeLibelle', 'Mode de passation', txt(v['modeLibelle']), txt(m.idMode != null ? modeLib.get(m.idMode) : ''));
      champTexte('formeMarche', 'Forme', txt(v['formeMarche']), txt(m.formeMarche ?? 'QUANTITE_FIXE'));
      champTexte('financement', 'Financement', txt(v['financement']), txt(m.financement));

      // Bénéficiaires, appariés par position (les lignes actuelles sont triées par idBenef).
      const benefsImport = (v['beneficiaires'] as Record<string, unknown>[]) ?? [];
      const benefsActuels = this.benefsActuels().get(m.idDetail) ?? [];
      if (benefsImport.length !== benefsActuels.length) {
        liste.push({ champ: 'benef:nombre', libelle: `Bénéficiaires : ${benefsActuels.length} → ${benefsImport.length}` });
      }
      for (let bi = 0; bi < Math.min(benefsImport.length, benefsActuels.length); bi++) {
        const imp = benefsImport[bi];
        const act = benefsActuels[bi];
        const pfx = benefsImport.length > 1 ? `Bénéficiaire ${bi + 1} · ` : 'Bénéficiaire · ';
        champTexte(`benef:${bi}:soaCode`, pfx + 'service', txt(imp['soaCode'] || imp['soaLibelle']), txt(act.soaCode));
        champTexte(`benef:${bi}:numCompte`, pfx + 'compte', txt(imp['numCompte']), txt(act.numCompte));
        champMontant(`benef:${bi}:ancMontBenef`, pfx + 'montant', num(imp['ancMontBenef']), num(act.ancMontBenef));
        champMontant(`benef:${bi}:nouvMontBenef`, pfx + 'nouveau montant', num(imp['nouvMontBenef']), num(act.nouvMontBenef));
      }

      // Calendrier CAPM : date de début par processus (la date de fin actuelle est conservée à l'import).
      const prevImport = new Map(
        ((v['processus'] as Record<string, unknown>[]) ?? [])
          .filter((p) => p['idCapm'] != null)
          .map((p) => [Number(p['idCapm']), txt(p['dateDebut'])]),
      );
      const prevActuel = new Map((this.previsionsActuelles().get(m.idDetail) ?? []).map((p) => [p.idCapm, txt(p.dateDebut)]));
      for (const [idCapm, dImp] of prevImport) {
        const dAct = prevActuel.get(idCapm);
        if (dAct === undefined) liste.push({ champ: `capm:${idCapm}`, libelle: `Calendrier · ${capmLib.get(idCapm)} : ajouté (${dImp || '—'})` });
        else if (dAct !== dImp) liste.push({ champ: `capm:${idCapm}`, libelle: `Calendrier · ${capmLib.get(idCapm)} : ${dAct || '—'} → ${dImp || '—'}` });
      }
      for (const [idCapm, dAct] of prevActuel) {
        if (!prevImport.has(idCapm)) liste.push({ champ: `capm:${idCapm}`, libelle: `Calendrier · ${capmLib.get(idCapm)} : retiré (était ${dAct || '—'})` });
      }

      const uid = g.get('uid')!.value as number;
      if (liste.length) modifs.set(uid, liste);
      statuts.set(uid, liste.length ? 'MODIFIEE' : 'INCHANGEE');
    }
    this.modifsImport.set(modifs);
    this.statutsImport.set(statuts);
  }

  /** Grille prête : lignes signalées validées + montants bénéficiaires cohérents. */
  importPret(): boolean {
    const g = this.grid();
    return !!this.importMarches() && !!g && g.nbAValiderRestantes() === 0 && g.benefsCoherents;
  }

  /**
   * Enregistre la rectification : `PUT /api/saisies/ppm/{idDossier}` — chaque ligne importée est
   * appariée PAR POSITION à la ligne existante (idDetail conservé : l'examen et le périmètre des
   * observations référencent ces lignes). Signataire / référence actuels conservés.
   */
  enregistrerRectification(): void {
    const r = this.importApercu();
    const p = this.ppm();
    const arr = this.importMarches();
    if (!r || !p || !arr || !this.structureOk()) {
      return;
    }
    const actuels = this.marchesActuels();
    const lignes: SaisieMarcheLigne[] = (arr.controls as FormGroup[])
      .map((g) => g.getRawValue() as Record<string, unknown>)
      .filter((l) => this.factory.ligneNonVide(l))
      .map((l) => this.factory.payloadDepuisMarche(l));
    if (lignes.length !== actuels.length) {
      this.error.set(
        `Le PPM rectifié comporte ${lignes.length} ligne(s) non vide(s) pour ${actuels.length} ligne(s) du dossier : structure figée.`,
      );
      return;
    }
    // Appariement par position → idDetail conservés (mise à jour en place, ni ajout ni retrait).
    lignes.forEach((l, i) => (l.idDetail = actuels[i].idDetail));
    const req: EditionPpmRequest = {
      exercice: r.exercice ?? p.exercice,
      dateSignature: r.dateSignature ?? p.dateSignature,
      signataire: p.signataire,
      reference: p.reference,
      marches: lignes,
    };
    this.error.set(null);
    this.saving.set(true);
    this.saisieService.editionPpm(this.idDossier, req).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          'Rectification enregistrée depuis le PPM importé — resoumettez le dossier en vérification depuis « Dossiers à rectifier ».',
        );
        this.router.navigateByUrl(this.returnUrl());
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.error.set(e.message || 'Erreur lors de l\'enregistrement de la rectification.');
      },
    });
  }

  annuler(): void {
    this.router.navigateByUrl(this.returnUrl());
  }

  // — ⚠️ 2026-08-02 : la rectification couvre AUSSI les pièces jointes (versions corrigées) —

  /**
   * ⚠️ Demande user (02/08) — SEULES les pièces citées dans les observations du PV apparaissent dans
   * la section « versions corrigées » : les pièces visées + toutes les pièces du MÊME TYPE (les
   * versions corrigées déjà jointes restent donc visibles après upload). Types non cités → masqués.
   */
  readonly piecesConcernees = computed(() => {
    const pont = this.examenPieceVersPiece();
    const cites = new Set(
      this.observations()
        .filter((o) => o.source === 'PIECE' && o.idExamenPiece != null)
        .map((o) => pont.get(o.idExamenPiece!))
        .filter((id): id is number => id != null),
    );
    const types = new Set(this.pieces().filter((p) => p.idPiece != null && cites.has(p.idPiece)).map((p) => p.idTypePiece));
    return this.pieces().filter((p) => types.has(p.idTypePiece));
  });

  /** Observations restant à satisfaire (non levées) — compteur de l'étape 1. */
  readonly nbObsASatisfaire = computed(() => this.observations().filter((o) => o.statut !== 'LEVEE').length);
  /** Pièces encore visées par une observation non levée — compteur de l'étape 2. */
  readonly nbPiecesACorriger = computed(() => this.piecesConcernees().filter((pc) => this.obsPourPiece(pc)).length);

  /** Observation NON LEVÉE du PV visant cette pièce (badge « version corrigée attendue »), sinon null. */
  obsPourPiece(pc: PieceJointeDossier): ObservationPv | null {
    const pont = this.examenPieceVersPiece();
    return (
      this.observations().find(
        (o) =>
          o.source === 'PIECE' &&
          o.statut !== 'LEVEE' &&
          o.idExamenPiece != null &&
          pont.get(o.idExamenPiece) === pc.idPiece,
      ) ?? null
    );
  }

  /** Upload de la VERSION CORRIGÉE d'une pièce (même type) — l'original est conservé (traçabilité). */
  joindreVersionCorrigee(pc: PieceJointeDossier, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || pc.idPiece == null) {
      return;
    }
    const erreurFichier = validerFichier(file);
    if (erreurFichier) {
      this.toast.error(erreurFichier);
      return;
    }
    this.uploadPiece.set(pc.idPiece);
    const fd = new FormData();
    fd.append(
      'data',
      new Blob([JSON.stringify({ idDossier: this.idDossier, idTypePiece: pc.idTypePiece })], { type: 'application/json' }),
    );
    fd.append('fichier', file, file.name);
    this.pieceService.upload(fd).subscribe({
      next: () => {
        this.uploadPiece.set(null);
        this.toast.success('Version corrigée jointe au dossier.');
        this.pieceService.getByDossier(this.idDossier).subscribe((rows) => this.pieces.set(rows));
      },
      error: (e: ApiError) => {
        this.uploadPiece.set(null);
        this.toast.error(e.message || "Erreur lors de l'envoi de la pièce corrigée.");
      },
    });
  }
}
