import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, forkJoin, merge, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Compte, Marche, Nature, Ppm, Situation } from '../../models';
import {
  CompteService,
  MarcheService,
  ModePassationService,
  NatureService,
  PpmService,
  ReglePassationService,
  SituationService,
} from '../../services';

/**
 * « Rectifier le dossier » (PRMP) — formulaire **restreint** d'édition en place d'un dossier PPM au
 * statut `EN_ATTENTE_DECISION_PRMP`, sans repasser par le brouillon. En-tête PPM via
 * `PATCH /api/ppms/{id}/rectifier` ; lignes de marché via `PATCH /api/marches/{id}/rectifier`
 * (mode de passation revalidé serveur). Le statut du dossier **reste inchangé** jusqu'à la
 * resoumission (`POST /api/dossiers/{id}/resoumettre`, depuis « Dossiers à rectifier »).
 *
 * Identité **figée** (lecture seule, exclue du corps) : PPM → `idDossier`/`idPrmp`/`idLocalite` ;
 * marché → `idDetail` (clé)/`idMode` (recalculé). Pas d'ajout/suppression de lignes (réservé au brouillon).
 */
@Component({
  selector: 'app-rectifier-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="rd">
      <header class="rd__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="rd__title">Rectifier le dossier</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (ppm(); as p) {
        <div class="cnm-card rd__note">
          Corrigez le PPM concerné par les observations du vérificateur, puis enregistrez. Le dossier
          reste « à rectifier » jusqu'à la resoumission.
        </div>

        <!-- Identité figée (lecture seule, non envoyée) -->
        <div class="cnm-card rd__frozen">
          <span class="rd__frozen-item"><span class="rd__k">Dossier</span> <span class="cnm-mono">#{{ p.idDossier }}</span></span>
          <span class="rd__frozen-item"><span class="rd__k">PRMP</span> <span class="cnm-mono">{{ p.idPrmp || '—' }}</span></span>
          <span class="rd__frozen-item"><span class="rd__k">Localité</span> <span class="cnm-mono">{{ p.idLocalite || '—' }}</span></span>
          <span class="rd__frozen-hint cnm-muted">Champs figés côté backend — non modifiables.</span>
        </div>

        <!-- En-tête PPM -->
        <form class="cnm-card rd__form cnm-form" [formGroup]="headerForm">
          <h2 class="rd__section">En-tête du PPM</h2>
          <div class="rd__grid">
            <label class="cnm-field">
              <span class="cnm-field__label">Exercice *</span>
              <input class="cnm-input" type="number" formControlName="exercice" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Référence *</span>
              <input class="cnm-input" formControlName="reference" maxlength="100" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Signataire *</span>
              <input class="cnm-input" formControlName="signataire" maxlength="50" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Date de signature *</span>
              <input class="cnm-input" type="date" formControlName="dateSignature" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Libellé</span>
              <input class="cnm-input" formControlName="libelle" maxlength="200" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">N° de mise à jour</span>
              <input class="cnm-input" type="number" formControlName="numMaj" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Vu</span>
              <input class="cnm-input" formControlName="vu" maxlength="100" />
            </label>
            <label class="cnm-field rd__col-full">
              <span class="cnm-field__label">Motif de mise à jour</span>
              <textarea class="cnm-textarea" rows="2" formControlName="motifMaj" maxlength="500"></textarea>
            </label>
          </div>
        </form>

        <!-- Lignes de marché -->
        <div class="cnm-card rd__form">
          <h2 class="rd__section">Lignes de marché</h2>
          @if (marcheControls().length) {
            @for (g of marcheControls(); track g.get('idDetail')!.value) {
              <div class="rd__marche cnm-form" [formGroup]="g">
                <div class="rd__marche-head">
                  <span class="cnm-mono">Marché #{{ g.get('idDetail')!.value }}</span>
                  <span class="cnm-muted rd__mode">Mode : {{ modeAffiche(g) }}</span>
                </div>
                <div class="rd__grid">
                  <label class="cnm-field rd__col-full">
                    <span class="cnm-field__label">Désignation</span>
                    <input class="cnm-input" formControlName="designationMarche" maxlength="500" />
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Montant estimé</span>
                    <input class="cnm-input" type="number" formControlName="montEstim" />
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Compte</span>
                    <select class="cnm-select" formControlName="numCompte">
                      <option value="">—</option>
                      @for (c of comptes(); track c.numCompte) {
                        <option [value]="c.numCompte">{{ c.numCompte }} · {{ c.libelle || '' }}</option>
                      }
                    </select>
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Financement</span>
                    <input class="cnm-input" formControlName="financement" maxlength="20" />
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Statut</span>
                    <input class="cnm-input" formControlName="statut" maxlength="20" />
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Situation</span>
                    <select class="cnm-select" formControlName="idSituation">
                      <option [ngValue]="null">—</option>
                      @for (s of situations(); track s.idSituation) {
                        <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option>
                      }
                    </select>
                  </label>
                  <label class="cnm-field">
                    <span class="cnm-field__label">Nature</span>
                    <select class="cnm-select" formControlName="idNature">
                      <option [ngValue]="null">—</option>
                      @for (n of natures(); track n.idNature) {
                        <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option>
                      }
                    </select>
                  </label>
                </div>
              </div>
            }
          } @else {
            <p class="cnm-muted">Aucune ligne de marché.</p>
          }
        </div>

        @if (fieldErrorList().length) {
          <div class="cnm-card rd__errors" role="alert">
            <p class="rd__errors-title">{{ error() || 'Validation échouée' }}</p>
            <ul class="rd__errors-list">
              @for (er of fieldErrorList(); track er.champ) {
                <li><span class="cnm-mono">{{ er.champ }}</span> — {{ er.message }}</li>
              }
            </ul>
          </div>
        } @else if (error(); as e) {
          <p class="cnm-field__hint rd__error" role="alert">{{ e }}</p>
        }

        <div class="rd__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler()">Retour</button>
          <button type="button" class="cnm-btn cnm-btn--primary" [disabled]="saving()" (click)="enregistrer()">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer les rectifications' }}
          </button>
        </div>
      } @else {
        <div class="cnm-card rd__note">Ce dossier n'a pas de PPM à rectifier.</div>
        <div class="rd__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler()">Retour</button>
        </div>
      }
    </section>
  `,
  styles: `
    .rd__header { margin-bottom: var(--cnm-space-3); }
    .rd__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .rd__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .rd__frozen { display: flex; flex-wrap: wrap; align-items: center; gap: var(--cnm-space-3); padding: var(--cnm-space-2) var(--cnm-space-4); margin-bottom: var(--cnm-space-3); }
    .rd__frozen-item { display: inline-flex; gap: var(--cnm-space-1); align-items: baseline; }
    .rd__k { font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .rd__frozen-hint { margin-left: auto; font-size: var(--cnm-fs-micro); }
    .rd__form { padding: var(--cnm-space-3) var(--cnm-space-4); margin-bottom: var(--cnm-space-3); }
    .rd__section { margin: 0 0 var(--cnm-space-2); font-size: var(--cnm-fs-md); }
    .rd__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); }
    .rd__col-full { grid-column: 1 / -1; }
    .rd__marche { padding: var(--cnm-space-2) 0; border-top: 1px solid var(--cnm-border); }
    .rd__marche:first-of-type { border-top: 0; }
    .rd__marche-head { display: flex; align-items: baseline; gap: var(--cnm-space-3); margin-bottom: var(--cnm-space-1); }
    .rd__mode { font-size: var(--cnm-fs-micro); }
    .rd__error { color: var(--cnm-danger-fg); }
    .rd__errors { padding: var(--cnm-space-3) var(--cnm-space-4); margin-bottom: var(--cnm-space-3); border-left: 4px solid var(--cnm-danger-fg); background: var(--cnm-danger-bg); }
    .rd__errors-title { margin: 0 0 var(--cnm-space-1); font-weight: var(--cnm-fw-semibold); color: var(--cnm-danger-fg); }
    .rd__errors-list { margin: 0; padding-left: var(--cnm-space-4); display: flex; flex-direction: column; gap: 2px; font-size: var(--cnm-fs-sm); }
    .rd__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); }
  `,
})
export class RectifierDossier {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly natureService = inject(NatureService);
  private readonly situationService = inject(SituationService);
  private readonly compteService = inject(CompteService);
  private readonly modePassationService = inject(ModePassationService);
  private readonly reglePassation = inject(ReglePassationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  readonly natures = signal<Nature[]>([]);
  readonly situations = signal<Situation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  /** Libellés des modes de passation (idMode → libellé) pour l'affichage. */
  readonly modeMap = signal<Map<number, string>>(new Map());
  /** État d'affichage du mode par ligne (idDetail) : recalcul en cours / déterminé / aucune règle. */
  private readonly modeState = signal<Map<number, 'idle' | 'loading' | 'ready' | 'none'>>(new Map());
  readonly error = signal<string | null>(null);
  /** Erreurs de validation par champ renvoyées par le backend (`erreurs:[{champ,message}]`, 400). */
  readonly fieldErrors = signal<Record<string, string> | null>(null);
  private readonly returnUrl = signal('/prmp/a-rectifier');

  headerForm: FormGroup = this.fb.group({});
  private readonly marchesArray = signal<FormArray<FormGroup>>(this.fb.array([] as FormGroup[]));

  constructor() {
    const idDossier = Number(this.route.snapshot.paramMap.get('idDossier'));
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    if (ret) {
      this.returnUrl.set(ret);
    }

    forkJoin({
      ppms: this.ppmService.list(),
      marches: this.marcheService.list(),
      natures: this.natureService.list(),
      situations: this.situationService.list(),
      comptes: this.compteService.list(),
      modes: this.modePassationService.list(),
    }).subscribe({
      next: ({ ppms, marches, natures, situations, comptes, modes }) => {
        this.natures.set(natures);
        this.situations.set(situations);
        this.comptes.set(comptes);
        this.modeMap.set(new Map(modes.map((m) => [m.idMode, m.libelle ?? '#' + m.idMode])));

        const ppm = ppms.find((p) => p.idDossier === idDossier) ?? null;
        this.ppm.set(ppm);
        if (ppm) {
          this.buildHeaderForm(ppm);
          const lignes = marches.filter((m) => m.idPpm === ppm.idPpm);
          const arr = this.fb.array(lignes.map((m) => this.marcheGroup(m)));
          this.marchesArray.set(arr);
          // Recalcul du mode en temps réel sur changement de montant / nature / situation (critères du calcul).
          arr.controls.forEach((g) => this.brancherRecalcul(g));
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  marcheControls(): FormGroup[] {
    return this.marchesArray().controls;
  }
  modeAffiche(g: FormGroup): string {
    const idDetail = g.get('idDetail')!.value as number;
    const st = this.modeState().get(idDetail) ?? 'idle';
    if (st === 'loading') {
      return 'calcul…';
    }
    if (st === 'none') {
      return 'à déterminer (aucune règle)';
    }
    const idMode = g.get('idMode')!.value as number | null;
    return idMode != null ? this.modeMap().get(idMode) ?? '#' + idMode : 'à recalculer';
  }

  private setModeLigne(idDetail: number, state: 'idle' | 'loading' | 'ready' | 'none'): void {
    this.modeState.update((m) => new Map(m).set(idDetail, state));
  }

  /** Abonne une ligne au recalcul live : montant / nature / situation → `suggestion-mode`. */
  private brancherRecalcul(g: FormGroup): void {
    merge(g.get('montEstim')!.valueChanges, g.get('idNature')!.valueChanges, g.get('idSituation')!.valueChanges)
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculerMode(g));
  }

  /**
   * Recalcule le mode d'une ligne à la volée via `POST /api/regle-passations/suggestion-mode`
   * (mêmes critères que le backend : situation + nature + montant + localité du dossier) et met à
   * jour l'`idMode` de la ligne + son affichage. Critères incomplets → « à recalculer ».
   */
  private recalculerMode(g: FormGroup): void {
    const idDetail = g.get('idDetail')!.value as number;
    const idLocalite = this.ppm()?.idLocalite;
    const idSituation = g.get('idSituation')!.value as number | null;
    const idNature = g.get('idNature')!.value as number | null;
    const montant = g.get('montEstim')!.value as number | null;
    if (idSituation == null || idNature == null || montant == null || !idLocalite) {
      this.setModeLigne(idDetail, 'idle');
      return;
    }
    this.setModeLigne(idDetail, 'loading');
    this.reglePassation
      .suggestionMode({ idSituation, montant, idNature, idLocalite })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const idMode = g.get('idMode')!;
          if (res.modesAutorises.length) {
            // Conserve le mode courant s'il reste autorisé, sinon applique le recommandé.
            const cur = idMode.value as number | null;
            const next = cur != null && res.modesAutorises.some((m) => m.idMode === cur) ? cur : res.modeRecommande;
            idMode.setValue(next, { emitEvent: false });
            res.modesAutorises.forEach((m) => this.modeMap.update((mm) => new Map(mm).set(m.idMode, m.libelle)));
            this.setModeLigne(idDetail, 'ready');
          } else {
            idMode.setValue(null, { emitEvent: false });
            this.setModeLigne(idDetail, 'none');
          }
        },
        error: () => this.setModeLigne(idDetail, 'none'),
      });
  }
  /** Erreurs de validation backend mises à plat pour l'affichage (`champ — message`). */
  fieldErrorList(): { champ: string; message: string }[] {
    const fe = this.fieldErrors();
    return fe ? Object.entries(fe).map(([champ, message]) => ({ champ, message })) : [];
  }

  private buildHeaderForm(p: Ppm): void {
    // Champs modifiables uniquement ; idDossier/idPrmp/idLocalite restent figés (hors formulaire).
    this.headerForm = this.fb.group({
      exercice: [p.exercice, Validators.required],
      signataire: [p.signataire, Validators.required],
      dateSignature: [p.dateSignature, Validators.required],
      reference: [p.reference, Validators.required],
      libelle: [p.libelle ?? ''],
      numMaj: [p.numMaj ?? null],
      motifMaj: [p.motifMaj ?? ''],
      vu: [p.vu ?? ''],
    });
  }

  private marcheGroup(m: Marche): FormGroup {
    // idDetail = clé du PATCH (lecture seule, hors corps). idMode CONSERVÉ et transmis (revalidé serveur).
    // idDossier/idPpm exclus (figés) ; le marché n'a pas d'idLocalite.
    return this.fb.group({
      idDetail: [m.idDetail],
      idMode: [m.idMode ?? null],
      designationMarche: [m.designationMarche ?? ''],
      numCompte: [m.numCompte ?? ''],
      montEstim: [m.montEstim ?? null],
      financement: [m.financement ?? ''],
      statut: [m.statut ?? ''],
      idSituation: [m.idSituation ?? null],
      idNature: [m.idNature ?? null],
    });
  }

  enregistrer(): void {
    const ppm = this.ppm();
    if (!ppm) {
      return;
    }
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      return;
    }

    const headerDirty = this.headerForm.dirty;
    const dirtyMarches = this.marcheControls().filter((g) => g.dirty);
    if (!headerDirty && !dirtyMarches.length) {
      // Rien de modifié : on revient simplement à « Dossiers à rectifier ».
      this.router.navigateByUrl(this.returnUrl());
      return;
    }

    const header$ = headerDirty
      ? this.ppmService.rectifier(ppm.idPpm, this.headerForm.getRawValue() as Partial<Ppm>)
      : of(null);
    const marche$ = dirtyMarches.map((g) => {
      const { idDetail, ...rest } = g.getRawValue();
      return this.marcheService.rectifier(idDetail as number, rest as Partial<Marche>);
    });

    this.error.set(null);
    this.fieldErrors.set(null);
    this.saving.set(true);
    forkJoin([header$, ...marche$]).subscribe({
      next: (results) => {
        this.saving.set(false);
        // Mode recalculé par le backend (`validerOuAppliquerMode`) : reflété depuis la réponse de chaque marché.
        const marcheResults = results.slice(1) as Marche[];
        dirtyMarches.forEach((g, i) => {
          const updated = marcheResults[i];
          if (updated) {
            g.get('idMode')!.setValue(updated.idMode ?? null, { emitEvent: false });
            this.setModeLigne(g.get('idDetail')!.value as number, updated.idMode != null ? 'ready' : 'none');
          }
          g.markAsPristine();
        });
        if (headerDirty) {
          this.headerForm.markAsPristine();
        }
        this.toast.success('Rectifications enregistrées. Mode de passation à jour.');
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        // Détail des champs en cause (400) si fourni par le backend ; sinon message global.
        this.fieldErrors.set(e.fieldErrors && Object.keys(e.fieldErrors).length ? e.fieldErrors : null);
        this.error.set(
          e.status === 409
            ? "Ce dossier n'est plus en attente de décision PRMP."
            : e.status === 403
              ? "Vous n'êtes pas autorisé à rectifier ce dossier."
              : e.message || 'Erreur lors de la rectification.',
        );
      },
    });
  }

  annuler(): void {
    this.router.navigateByUrl(this.returnUrl());
  }
}
