import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Compte, Marche, Nature, Ppm, Situation } from '../../models';
import { CompteService, MarcheService, NatureService, PpmService, SituationService } from '../../services';

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
                  <span class="cnm-muted rd__mode">Mode : {{ modeLabel(g.get('idDetail')!.value) }}</span>
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

        @if (error(); as e) { <p class="cnm-field__hint rd__error">{{ e }}</p> }

        <div class="rd__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annuler()">Annuler</button>
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

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  readonly natures = signal<Nature[]>([]);
  readonly situations = signal<Situation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly error = signal<string | null>(null);
  /** Modes par marché (idDetail → idMode) pour affichage lecture seule. */
  private readonly modes = signal<Map<number, number | undefined>>(new Map());
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
    }).subscribe({
      next: ({ ppms, marches, natures, situations, comptes }) => {
        this.natures.set(natures);
        this.situations.set(situations);
        this.comptes.set(comptes);

        const ppm = ppms.find((p) => p.idDossier === idDossier) ?? null;
        this.ppm.set(ppm);
        if (ppm) {
          this.buildHeaderForm(ppm);
          const lignes = marches.filter((m) => m.idPpm === ppm.idPpm);
          this.modes.set(new Map(lignes.map((m) => [m.idDetail, m.idMode])));
          const arr = this.fb.array(lignes.map((m) => this.marcheGroup(m)));
          this.marchesArray.set(arr);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  marcheControls(): FormGroup[] {
    return this.marchesArray().controls;
  }
  modeLabel(idDetail: number): string {
    const m = this.modes().get(idDetail);
    return m != null ? '#' + m : 'à recalculer';
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
    // idDetail conservé (clé du PATCH) mais lecture seule ; idMode/idDossier/idPpm exclus (figés serveur).
    return this.fb.group({
      idDetail: [m.idDetail],
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

    const ops = [];
    if (this.headerForm.dirty) {
      ops.push(this.ppmService.rectifier(ppm.idPpm, this.headerForm.getRawValue() as Partial<Ppm>));
    }
    for (const g of this.marcheControls()) {
      if (g.dirty) {
        const { idDetail, ...rest } = g.getRawValue();
        ops.push(this.marcheService.rectifier(idDetail as number, rest as Partial<Marche>));
      }
    }
    if (!ops.length) {
      // Rien de modifié : on revient simplement à « Dossiers à rectifier ».
      this.router.navigateByUrl(this.returnUrl());
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    forkJoin(ops).subscribe({
      next: () => {
        this.toast.success('Rectifications enregistrées.');
        this.saving.set(false);
        this.router.navigateByUrl(this.returnUrl());
      },
      error: (e: ApiError) => {
        this.saving.set(false);
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
