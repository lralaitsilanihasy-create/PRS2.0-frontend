import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Compte, Marche, ModePassation, Nature, Ppm } from '../../models';
import {
  CompteService,
  MarcheService,
  ModePassationService,
  NatureService,
  PpmService,
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
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Rectifier le dossier</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (ppm(); as p) {
        <div class="alert alert-info">
          Corrigez le PPM concerné par les observations du vérificateur, puis enregistrez. Le dossier
          reste « à rectifier » jusqu'à la resoumission.
        </div>

        <!-- Identité figée (lecture seule, non envoyée) -->
        <div class="card rd-frozen">
          <span class="rd-frozen__item"><span class="rd-frozen__k">Dossier</span> <span class="fw-semibold">#{{ p.idDossier }}</span></span>
          <span class="rd-frozen__item"><span class="rd-frozen__k">PRMP</span> <span class="fw-semibold">{{ p.idPrmp || '—' }}</span></span>
          <span class="rd-frozen__item"><span class="rd-frozen__k">Localité</span> <span class="fw-semibold">{{ p.idLocalite || '—' }}</span></span>
          <span class="rd-frozen__hint text-muted">Champs figés côté backend — non modifiables.</span>
        </div>

        <!-- En-tête PPM -->
        <form class="card rd-form" [formGroup]="headerForm">
          <h2 class="rd-section">En-tête du PPM</h2>
          <div class="rd-grid">
            <div class="form-group"><label class="form-label required">Exercice</label><input class="form-control" type="number" formControlName="exercice" /></div>
            <div class="form-group"><label class="form-label required">Référence</label><input class="form-control" formControlName="reference" maxlength="100" /></div>
            <div class="form-group"><label class="form-label required">Signataire</label><input class="form-control" formControlName="signataire" maxlength="50" /></div>
            <div class="form-group"><label class="form-label required">Date de signature</label><input class="form-control" type="date" formControlName="dateSignature" /></div>
            <div class="form-group"><label class="form-label">Libellé</label><input class="form-control" formControlName="libelle" maxlength="200" /></div>
            <div class="form-group"><label class="form-label">N° de mise à jour</label><input class="form-control" type="number" formControlName="numMaj" /></div>
            <div class="form-group"><label class="form-label">Vu</label><input class="form-control" formControlName="vu" maxlength="100" /></div>
            <div class="form-group rd-col-full"><label class="form-label">Motif de mise à jour</label><textarea class="form-control" rows="2" formControlName="motifMaj" maxlength="500"></textarea></div>
          </div>
        </form>

        <!-- Lignes de marché -->
        <div class="card rd-form">
          <h2 class="rd-section">Lignes de marché</h2>
          @if (marcheControls().length) {
            @for (g of marcheControls(); track g.get('idDetail')!.value) {
              <div class="rd-marche" [formGroup]="g">
                <div class="rd-marche__head">
                  <span class="fw-semibold">Marché #{{ g.get('idDetail')!.value }}</span>
                </div>
                <div class="rd-grid">
                  <div class="form-group rd-col-full"><label class="form-label">Désignation</label><input class="form-control" formControlName="designationMarche" maxlength="500" /></div>
                  <div class="form-group"><label class="form-label">Montant estimé</label><input class="form-control" type="number" formControlName="montEstim" /></div>
                  <div class="form-group">
                    <label class="form-label">Compte</label>
                    <select class="form-control" formControlName="numCompte">
                      <option value="">—</option>
                      @for (c of comptes(); track c.numCompte) {
                        <option [value]="c.numCompte">{{ c.numCompte }} · {{ c.libelle || '' }}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group"><label class="form-label">Financement</label><input class="form-control" formControlName="financement" maxlength="20" /></div>
                  <div class="form-group"><label class="form-label">Statut</label><input class="form-control" formControlName="statut" maxlength="20" /></div>
                  <div class="form-group">
                    <label class="form-label">Mode de passation</label>
                    <select class="form-control" formControlName="idMode">
                      <option [ngValue]="null">—</option>
                      @for (m of modesList(); track m.idMode) {
                        <option [ngValue]="m.idMode">{{ m.libelle || '#' + m.idMode }}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nature</label>
                    <select class="form-control" formControlName="idNature">
                      <option [ngValue]="null">—</option>
                      @for (n of natures(); track n.idNature) {
                        <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option>
                      }
                    </select>
                  </div>
                </div>
              </div>
            }
          } @else {
            <p class="text-muted">Aucune ligne de marché.</p>
          }
        </div>

        @if (fieldErrorList().length) {
          <div class="alert alert-danger" role="alert">
            <div>
              <p class="fw-semibold">{{ error() || 'Validation échouée' }}</p>
              <ul class="rd-errors__list">
                @for (er of fieldErrorList(); track er.champ) {
                  <li><strong>{{ er.champ }}</strong> — {{ er.message }}</li>
                }
              </ul>
            </div>
          </div>
        } @else if (error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }

        <div class="rd-foot">
          <button type="button" class="btn btn-outline" (click)="annuler()">Retour</button>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="enregistrer()">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer les rectifications' }}
          </button>
        </div>
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
    .rd-form { padding: 1.25rem 1.5rem; margin-bottom: 0.75rem; }
    .rd-section { margin: 0 0 0.75rem; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .rd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .rd-grid .form-group { margin-bottom: 0; }
    .rd-col-full { grid-column: 1 / -1; }
    .rd-marche { padding: 0.75rem 0; border-top: 1px solid var(--c-100); }
    .rd-marche:first-of-type { border-top: 0; }
    .rd-marche__head { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; }
    .rd-mode { font-size: var(--text-xs); }
    .rd-errors__list { margin: 0.25rem 0 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 2px; font-size: var(--text-sm); }
    .rd-foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
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
  private readonly compteService = inject(CompteService);
  private readonly modePassationService = inject(ModePassationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly ppm = signal<Ppm | null>(null);
  readonly natures = signal<Nature[]>([]);
  readonly comptes = signal<Compte[]>([]);
  /** Modes de passation (référentiel) pour le sélecteur ; le mode est purement saisi (plus de détermination auto). */
  readonly modesList = signal<ModePassation[]>([]);
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
      comptes: this.compteService.list(),
      modes: this.modePassationService.list(),
    }).subscribe({
      next: ({ ppms, marches, natures, comptes, modes }) => {
        this.natures.set(natures);
        this.comptes.set(comptes);
        this.modesList.set(modes);

        const ppm = ppms.find((p) => p.idDossier === idDossier) ?? null;
        this.ppm.set(ppm);
        if (ppm) {
          this.buildHeaderForm(ppm);
          const lignes = marches.filter((m) => m.idPpm === ppm.idPpm);
          this.marchesArray.set(this.fb.array(lignes.map((m) => this.marcheGroup(m))));
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  marcheControls(): FormGroup[] {
    return this.marchesArray().controls;
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
    // idDetail = clé du PATCH (lecture seule, hors corps). idMode saisi et transmis tel quel.
    // idDossier/idPpm exclus (figés) ; le marché n'a pas d'idLocalite.
    return this.fb.group({
      idDetail: [m.idDetail],
      idMode: [m.idMode ?? null],
      designationMarche: [m.designationMarche ?? ''],
      numCompte: [m.numCompte ?? ''],
      montEstim: [m.montEstim ?? null],
      financement: [m.financement ?? ''],
      statut: [m.statut ?? ''],
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
        // Le mode saisi est conservé par le backend : reflété depuis la réponse de chaque marché.
        const marcheResults = results.slice(1) as Marche[];
        dirtyMarches.forEach((g, i) => {
          const updated = marcheResults[i];
          if (updated) {
            g.get('idMode')!.setValue(updated.idMode ?? null, { emitEvent: false });
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
