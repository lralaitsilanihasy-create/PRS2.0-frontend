import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, debounceTime, forkJoin, merge } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Compte, Dossier, Marche, MarchePrevision, Nature, Ppm, Situation } from '../../models';
import {
  CompteService,
  DossierService,
  MarcheService,
  MarchePrevisionService,
  ModePassationService,
  NatureService,
  PpmService,
  ReferenceLookupService,
  ReglePassationService,
  SituationService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossiersRefreshStore } from './dossiers-refresh.store';

/**
 * Vue PRMP combinée : SES PPM (dépliables) → leurs marchés → dates prévisionnelles.
 * Fusionne « PPM & marchés » et « Marchés & dates prév. ». PRMP→PPM (idPrmp) → Marché (idPpm) ;
 * dates via byMarche(). Le backend filtre déjà le périmètre.
 *
 * Dates prévisionnelles (`/api/marche-previsions`) : ajoutables à la création du marché, et
 * éditables (ajout/modif/suppression) tant que le dossier du marché est en BROUILLON — miroir
 * de la règle d'édition des marchés (le backend reste l'autorité). idPrevision = PK assignée client.
 */

/** État d'aperçu du mode de passation (ensemble autorisé + recommandé). */
type ModeSuggestion = {
  state: 'idle' | 'loading' | 'ready' | 'none';
  modes: { idMode: number; libelle: string }[];
  recommande: number | null;
};

@Component({
  selector: 'app-mes-ppm-marches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, ReactiveFormsModule],
  template: `
    <section class="mpm">
      <header class="mpm__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mpm__title">Mes PPM & marchés</h1>
      </header>

      @if (loading()) {
        <p class="mpm__info">Chargement…</p>
      } @else {
        @for (ppm of mesPpms(); track ppm.idPpm) {
          <div class="cnm-card mpm__ppm" [class.mpm__ppm--soumis]="estSoumis(ppm)">
            <button
              type="button"
              class="mpm__head"
              (click)="togglePpm(ppm.idPpm)"
              [attr.aria-expanded]="isOpen(ppm.idPpm)"
            >
              <span class="mpm__chevron">{{ isOpen(ppm.idPpm) ? '▾' : '▸' }}</span>
              <span class="mpm__ref">{{ ppm.reference || 'PPM #' + ppm.idPpm }}</span>
              <span class="mpm__sub">Exercice {{ ppm.exercice }} · {{ ppm.libelle || '—' }}</span>
              <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(ppm.idPpm).length }} marché(s)</span>
              @if (statutPpm(ppm) === 'EN_ATTENTE_DECISION_PRMP') {
                <app-statut-badge [statut]="statutPpm(ppm)" />
              }
            </button>

            @if (isOpen(ppm.idPpm)) {
              <div class="mpm__detail cnm-marches">
                <div class="mpm__toolbar">
                  @if (ppmEditable(ppm)) {
                    <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="ouvrirCreation(ppm)">
                      + Nouveau marché
                    </button>
                    <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" (click)="demanderSuppressionPpm(ppm)">
                      Supprimer le PPM
                    </button>
                  } @else {
                    <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" disabled [title]="RAISON_BLOCAGE">
                      Supprimer le PPM
                    </button>
                  }
                </div>
                @if (marchesOf(ppm.idPpm).length === 0) {
                  <p class="mpm__empty">Aucun marché rattaché à ce PPM.</p>
                } @else {
                  <table class="cnm-table">
                    <thead>
                      <tr>
                        <th>Réf.</th>
                        <th>Désignation</th>
                        <th class="cnm-num">Montant estimé</th>
                        <th>Mode</th>
                        <th>Statut</th>
                        <th>Dates</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of marchesOf(ppm.idPpm); track m.idDetail) {
                        <tr>
                          <td class="cnm-mono">{{ m.idDetail }}</td>
                          <td>{{ m.designationMarche || '—' }}</td>
                          <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                          <td>{{ resolve(modeMap(), m.idMode) }}</td>
                          <td><app-statut-badge [statut]="m.statut" /></td>
                          <td>
                            <div class="mpm__row-actions">
                              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirDates(m)">Voir</button>
                              @if (estEditable(m)) {
                                <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="ouvrirEdition(m)">Modifier</button>
                              }
                            </div>
                          </td>
                          <td>
                            <div class="mpm__row-actions">
                              @if (estEditable(m)) {
                                <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ouvrirEditionLigne(m)">Modifier</button>
                                <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" (click)="demanderSuppressionMarche(m)">Supprimer</button>
                              } @else {
                                <button type="button" class="cnm-btn cnm-btn--danger cnm-btn--sm" disabled [title]="RAISON_BLOCAGE">Supprimer</button>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="mpm__info">Aucun PPM dans votre périmètre.</p>
        }
      }
    </section>

    @if (modalMarche(); as m) {
      <div class="mpm-modal__overlay" (click)="fermerDates()">
        <div class="mpm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="mpm-modal__head">
            <h2 class="mpm-modal__title">
              Dates prévisionnelles — {{ m.designationMarche || 'Marché #' + m.idDetail }}
            </h2>
            <button type="button" class="mpm-modal__close" aria-label="Fermer" (click)="fermerDates()">&times;</button>
          </header>
          <div class="mpm-modal__body">
            @if (modalLoading()) {
              <p class="mpm__info">Chargement des dates…</p>
            } @else if (modalData().length) {
              <table class="cnm-table">
                <thead><tr><th>Type</th><th>Date prévue</th></tr></thead>
                <tbody>
                  @for (p of modalData(); track p.idPrevision) {
                    <tr><td>{{ p.typeDate }}</td><td class="cnm-mono">{{ p.datePrev || '—' }}</td></tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="mpm__info">Aucune date prévisionnelle pour ce marché.</p>
            }
          </div>
          <footer class="mpm-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="fermerDates()">Fermer</button>
          </footer>
        </div>
      </div>
    }

    @if (editMarche(); as m) {
      @if (editForm(); as ef) {
        <div class="mpm-modal__overlay" (click)="annulerEdition()">
          <form
            class="mpm-modal cnm-card"
            [formGroup]="ef"
            (ngSubmit)="enregistrerEdition()"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
            novalidate
          >
            <header class="mpm-modal__head">
              <h2 class="mpm-modal__title">Modifier les dates — {{ m.designationMarche || 'Marché #' + m.idDetail }}</h2>
              <button type="button" class="mpm-modal__close" aria-label="Fermer" (click)="annulerEdition()">&times;</button>
            </header>
            <div class="mpm-modal__body">
              @if (editLoading()) {
                <p class="mpm__info">Chargement des dates…</p>
              } @else {
                @for (ctrl of datesControls(ef); track $index) {
                  <div class="mpm-date-row" [formGroup]="ctrl">
                    <select class="cnm-select" formControlName="typeDate">
                      @for (t of TYPES_DATE; track t) { <option [ngValue]="t">{{ t }}</option> }
                    </select>
                    <input class="cnm-input" type="date" formControlName="datePrev" />
                    <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirerDate(ef, $index)">✕</button>
                  </div>
                } @empty {
                  <p class="mpm__info">Aucune date. Ajoutez-en une.</p>
                }
                <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ajouterDate(ef)">+ Ajouter une date</button>
              }
            </div>
            <footer class="mpm-modal__foot">
              <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerEdition()">Annuler</button>
              <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submittingEdit() || editLoading()">Enregistrer</button>
            </footer>
          </form>
        </div>
      }
    }

    @if (createPpm(); as ppm) {
      <div class="mpm-modal__overlay" (click)="annulerCreation()">
        <form
          class="mpm-modal cnm-card"
          [formGroup]="createForm"
          (ngSubmit)="enregistrerMarche()"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          novalidate
        >
          <header class="mpm-modal__head">
            <h2 class="mpm-modal__title">
              {{ editingMarche() ? 'Modifier le marché #' + editingMarche()!.idDetail : 'Nouveau marché — PPM ' + (ppm.reference || '#' + ppm.idPpm) }}
            </h2>
            <button type="button" class="mpm-modal__close" aria-label="Fermer" (click)="annulerCreation()">&times;</button>
          </header>

          <div class="mpm-modal__body mpm-form">
            <label class="cnm-field">
              <span class="cnm-field__label">Identifiant marché (PK) *</span>
              <input class="cnm-input" type="number" formControlName="idDetail" [readonly]="!!editingMarche()" />
              @if (createForm.get('idDetail')?.touched && createForm.get('idDetail')?.hasError('required')) {
                <span class="cnm-field__hint">Obligatoire.</span>
              }
              @if (createErr('idDetail')) {
                <span class="cnm-field__hint">{{ createErr('idDetail') }}</span>
              }
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">PPM (rattachement)</span>
              <input class="cnm-input" type="number" formControlName="idPpm" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Dossier</span>
              <select class="cnm-select" formControlName="idDossier">
                @for (d of dossiers(); track d.idDossier) {
                  <option [ngValue]="d.idDossier">{{ d.refeDossier || 'Dossier #' + d.idDossier }}</option>
                }
              </select>
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Désignation</span>
              <input class="cnm-input" type="text" formControlName="designationMarche" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Compte</span>
              <select class="cnm-select" formControlName="numCompte">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (c of comptes(); track c.numCompte) {
                  <option [ngValue]="c.numCompte">{{ c.libelle || c.numCompte }}</option>
                }
              </select>
              @if (refsLoading()) { <span class="cnm-field__hint cnm-muted">Chargement…</span> }
              @else if (!comptes().length) { <span class="cnm-field__hint cnm-muted">Aucun compte disponible.</span> }
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Montant estimé</span>
              <input class="cnm-input" type="number" formControlName="montEstim" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Financement</span>
              <input class="cnm-input" type="text" formControlName="financement" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Statut</span>
              <input class="cnm-input" type="text" formControlName="statut" />
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Situation</span>
              <select class="cnm-select" formControlName="idSituation">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (s of situations(); track s.idSituation) {
                  <option [ngValue]="s.idSituation">{{ s.libelle || '#' + s.idSituation }}</option>
                }
              </select>
              @if (refsLoading()) { <span class="cnm-field__hint cnm-muted">Chargement…</span> }
              @else if (!situations().length) { <span class="cnm-field__hint cnm-muted">Aucune situation disponible.</span> }
            </label>
            <label class="cnm-field">
              <span class="cnm-field__label">Nature</span>
              <select class="cnm-select" formControlName="idNature">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of natures(); track n.idNature) {
                  <option [ngValue]="n.idNature">{{ n.libelle || '#' + n.idNature }}</option>
                }
              </select>
              @if (refsLoading()) { <span class="cnm-field__hint cnm-muted">Chargement…</span> }
              @else if (!natures().length) { <span class="cnm-field__hint cnm-muted">Aucune nature disponible.</span> }
            </label>
            <div class="cnm-field mpm-form__mode">
              <span class="cnm-field__label">Mode de passation</span>
              @switch (modeSuggestion().state) {
                @case ('loading') { <span class="cnm-muted">Détermination du mode…</span> }
                @case ('ready') {
                  <select class="cnm-select" formControlName="idMode">
                    @for (m of modeSuggestion().modes; track m.idMode) { <option [ngValue]="m.idMode">{{ m.libelle }}</option> }
                  </select>
                }
                @case ('none') { <span class="cnm-badge cnm-badge--warning">Mode à déterminer (aucune règle)</span> }
                @default { <span class="cnm-muted">Renseignez situation, nature et montant.</span> }
              }
              <span class="cnm-field__hint cnm-muted">Localité (dérivée de l'entité) : {{ localiteLabel() }}</span>
            </div>

            <div class="cnm-field mpm-form__dates">
              <span class="cnm-field__label">Dates prévisionnelles</span>
              @for (ctrl of datesControls(createForm); track $index) {
                <div class="mpm-date-row" [formGroup]="ctrl">
                  <select class="cnm-select" formControlName="typeDate">
                    @for (t of TYPES_DATE; track t) { <option [ngValue]="t">{{ t }}</option> }
                  </select>
                  <input class="cnm-input" type="date" formControlName="datePrev" />
                  <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="retirerDate(createForm, $index)">✕</button>
                </div>
              }
              <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="ajouterDate(createForm)">+ Ajouter une date</button>
            </div>
          </div>

          <footer class="mpm-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerCreation()">Annuler</button>
            <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submittingCreate()">
              Enregistrer
            </button>
          </footer>
        </form>
      </div>
    }

    @if (confirmState(); as c) {
      <div class="mpm-modal__overlay" (click)="annulerSuppression()">
        <div class="mpm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="mpm-modal__head">
            <h2 class="mpm-modal__title">{{ c.kind === 'ppm' ? 'Supprimer le PPM' : 'Supprimer le marché' }}</h2>
            <button type="button" class="mpm-modal__close" aria-label="Fermer" (click)="annulerSuppression()">&times;</button>
          </header>
          <div class="mpm-modal__body">
            <p>{{ messageSuppression(c) }}</p>
            <p class="cnm-muted">Action irréversible.</p>
          </div>
          <footer class="mpm-modal__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="annulerSuppression()">Annuler</button>
            <button type="button" class="cnm-btn cnm-btn--danger" [disabled]="confirmBusy()" (click)="confirmerSuppression()">
              {{ confirmBusy() ? 'Suppression…' : 'Supprimer définitivement' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .mpm__header { margin-bottom: var(--cnm-space-4); }
    .mpm__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .mpm__info,
    .mpm__empty { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); }
    .mpm__ppm { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .mpm__ppm--soumis,
    .mpm__ppm--soumis .mpm__head,
    .mpm__ppm--soumis .mpm__head:hover { background: var(--cnm-action-bg); }
    .mpm__head {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      width: 100%;
      padding: var(--cnm-space-3) var(--cnm-space-4);
      background: transparent;
      border: 0;
      color: var(--cnm-text);
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .mpm__head:hover { background: var(--cnm-surface-2); }
    .mpm__chevron { color: var(--cnm-text-3); width: 1rem; }
    .mpm__ref { font-weight: var(--cnm-fw-semibold); }
    .mpm__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
    .mpm__detail { border-top: 1px solid var(--cnm-border); }
    .mpm__toolbar { display: flex; justify-content: flex-end; padding: var(--cnm-space-2) var(--cnm-space-3); }
    .mpm__row-actions { display: flex; gap: var(--cnm-space-1); align-items: center; flex-wrap: wrap; }
    .mpm-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-3); }
    .mpm-form .cnm-input:disabled { opacity: 0.7; cursor: not-allowed; }
    .mpm-form__mode {
      grid-column: 1 / -1;
      gap: var(--cnm-space-2);
      padding: var(--cnm-space-3);
      background: var(--cnm-surface-2);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius-sm);
    }
    .mpm-form__dates {
      grid-column: 1 / -1;
      gap: var(--cnm-space-2);
      padding: var(--cnm-space-3);
      background: var(--cnm-surface-2);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius-sm);
    }
    .mpm-date-row {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-2);
    }
    .mpm-date-row .cnm-select { flex: 1; }

    .mpm-modal__overlay {
      position: fixed;
      inset: 0;
      z-index: 1050;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cnm-space-4);
    }
    .mpm-modal {
      width: 100%;
      max-width: 32rem;
      max-height: 85vh;
      overflow: auto;
      box-shadow: var(--cnm-shadow);
    }
    .mpm-modal__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cnm-space-3);
      padding: var(--cnm-space-4) var(--cnm-space-5);
      border-bottom: 1px solid var(--cnm-border);
    }
    .mpm-modal__title { margin: 0; font-size: var(--cnm-fs-md); }
    .mpm-modal__close {
      background: transparent;
      border: 0;
      color: var(--cnm-text-2);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
    }
    .mpm-modal__close:hover { color: var(--cnm-text); }
    .mpm-modal__body { padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .mpm-modal__body.mpm-form { display: grid; }
    .mpm-modal__foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--cnm-space-2);
      padding: var(--cnm-space-3) var(--cnm-space-5);
      border-top: 1px solid var(--cnm-border);
    }
  `,
})
export class MesPpmMarches {
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly reglePassation = inject(ReglePassationService);
  private readonly natureService = inject(NatureService);
  private readonly situationService = inject(SituationService);
  private readonly compteService = inject(CompteService);
  private readonly dossierService = inject(DossierService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly TYPES_DATE = ['LANCEMENT', 'DAO', 'OUVERTURE', 'ATTRIBUTION'] as const;

  private readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  readonly loading = signal(false);
  readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly expanded = signal<Set<number>>(new Set());
  /** Statut du dossier par idDossier — pour gater l'édition des dates (BROUILLON seulement). */
  private readonly dossierStatut = signal<Map<number, string>>(new Map());

  readonly modalMarche = signal<Marche | null>(null);
  readonly modalLoading = signal(false);
  readonly modalData = signal<MarchePrevision[]>([]);

  // Édition des dates d'un marché existant
  readonly editMarche = signal<Marche | null>(null);
  readonly editForm = signal<FormGroup | null>(null);
  private readonly editOriginal = signal<MarchePrevision[]>([]);
  readonly editLoading = signal(false);
  readonly submittingEdit = signal(false);

  readonly createPpm = signal<Ppm | null>(null);
  readonly submittingCreate = signal(false);
  readonly createErrors = signal<Record<string, string>>({});
  createForm: FormGroup = this.fb.group({});
  /** Marché en cours d'édition de ligne (null = création). */
  readonly editingMarche = signal<Marche | null>(null);
  private readonly createOriginalDates = signal<MarchePrevision[]>([]);
  /** Confirmation de suppression en cours (marché ou PPM) ; null = fermée. */
  readonly confirmState = signal<{ kind: 'marche' | 'ppm'; id: number; label: string; count: number | null } | null>(
    null,
  );
  readonly confirmBusy = signal(false);
  /** Raison affichée en tooltip quand la suppression est désactivée. */
  readonly RAISON_BLOCAGE =
    'Suppression possible uniquement tant que le dossier est en brouillon (et que vous en êtes propriétaire).';

  /** Aperçu du mode de passation (ensemble autorisé + recommandé via suggestion-mode). */
  readonly modeSuggestion = signal<ModeSuggestion>({ state: 'idle', modes: [], recommande: null });
  private modeSub?: Subscription;

  // Référentiels des listes déroulantes (chargés une seule fois).
  readonly natures = signal<Nature[]>([]);
  readonly situations = signal<Situation[]>([]);
  readonly comptes = signal<Compte[]>([]);
  readonly dossiers = signal<Dossier[]>([]);
  readonly refsLoading = signal(false);
  private refsLoaded = false;

  /** PPM de l'utilisateur (déjà scopés par le backend ; plus de filtre client). */
  readonly mesPpms = computed(() => this.ppms());
  private readonly byPpm = computed(() => {
    const map = new Map<number, Marche[]>();
    for (const m of this.marches()) {
      const list = map.get(m.idPpm) ?? [];
      list.push(m);
      map.set(m.idPpm, list);
    }
    return map;
  });

  constructor() {
    this.loading.set(true);
    this.ppmService.list().subscribe({
      next: (r) => this.ppms.set(r),
      error: () => this.loading.set(false),
    });
    this.marcheService.list().subscribe({
      next: (r) => {
        this.marches.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    // Dossiers : pour le sélecteur de création ET la garde d'édition (statut BROUILLON).
    this.dossierService.list().subscribe((r) => {
      this.dossiers.set(r);
      this.dossierStatut.set(new Map(r.map((d) => [d.idDossier, d.statut ?? ''])));
    });
    this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
    // Suppression d'un dossier (depuis « Mes brouillons ») → retrait local de son PPM et de ses marchés.
    this.dossiersRefresh.supprime$.pipe(takeUntilDestroyed()).subscribe((idDossier) => {
      const idsPpm = this.ppms()
        .filter((p) => p.idDossier === idDossier)
        .map((p) => p.idPpm);
      this.ppms.update((arr) => arr.filter((p) => p.idDossier !== idDossier));
      this.marches.update((arr) => arr.filter((m) => m.idDossier !== idDossier));
      if (idsPpm.length) {
        this.expanded.update((s) => {
          const n = new Set(s);
          idsPpm.forEach((id) => n.delete(id));
          return n;
        });
      }
    });
  }

  marchesOf(idPpm: number): Marche[] {
    return this.byPpm().get(idPpm) ?? [];
  }
  isOpen(idPpm: number): boolean {
    return this.expanded().has(idPpm);
  }
  togglePpm(idPpm: number): void {
    this.expanded.update((s) => {
      const n = new Set(s);
      if (n.has(idPpm)) {
        n.delete(idPpm);
      } else {
        n.add(idPpm);
      }
      return n;
    });
  }

  /** Édition des dates autorisée uniquement si le dossier du marché est en BROUILLON (miroir marchés). */
  estEditable(m: Marche): boolean {
    return this.dossierStatut().get(m.idDossier) === 'BROUILLON';
  }

  /** Vrai si le dossier rattaché au PPM est déjà soumis (sorti de l'état BROUILLON). */
  estSoumis(ppm: Ppm): boolean {
    const s = this.dossierStatut().get(ppm.idDossier);
    return !!s && s !== 'BROUILLON';
  }

  /** Statut du dossier rattaché au PPM (pour signaler « en attente PRMP » en orange). */
  statutPpm(ppm: Ppm): string | undefined {
    return this.dossierStatut().get(ppm.idDossier);
  }

  /** Ajout de marché autorisé uniquement si le dossier du PPM est en BROUILLON (donc dans le périmètre PRMP). */
  ppmEditable(ppm: Ppm): boolean {
    return this.dossierStatut().get(ppm.idDossier) === 'BROUILLON';
  }

  ouvrirDates(m: Marche): void {
    this.modalMarche.set(m);
    this.modalLoading.set(true);
    this.modalData.set([]);
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (data) => {
        this.modalData.set(data);
        this.modalLoading.set(false);
      },
      error: () => this.modalLoading.set(false),
    });
  }
  fermerDates(): void {
    this.modalMarche.set(null);
  }

  // --- Lignes de dates prévisionnelles (création + édition) ---
  private ligneDate(p?: Partial<MarchePrevision>): FormGroup {
    return this.fb.group({
      idPrevision: [p?.idPrevision ?? null],
      typeDate: [p?.typeDate ?? 'LANCEMENT', Validators.required],
      datePrev: [p?.datePrev ?? ''],
    });
  }
  datesControls(form: FormGroup): FormGroup[] {
    return (form.get('datesPrev') as FormArray).controls as FormGroup[];
  }
  ajouterDate(form: FormGroup): void {
    (form.get('datesPrev') as FormArray).push(this.ligneDate());
  }
  retirerDate(form: FormGroup, i: number): void {
    (form.get('datesPrev') as FormArray).removeAt(i);
  }

  // --- Édition des dates d'un marché existant ---
  ouvrirEdition(m: Marche): void {
    this.editMarche.set(m);
    this.editLoading.set(true);
    const form = this.fb.group({ datesPrev: this.fb.array([] as FormGroup[]) });
    this.editForm.set(form);
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (rows) => {
        this.editOriginal.set(rows);
        const arr = form.get('datesPrev') as FormArray;
        rows.forEach((p) => arr.push(this.ligneDate(p)));
        this.editLoading.set(false);
      },
      error: () => this.editLoading.set(false),
    });
  }
  annulerEdition(): void {
    this.editMarche.set(null);
    this.editForm.set(null);
    this.editOriginal.set([]);
  }
  enregistrerEdition(): void {
    const m = this.editMarche();
    const form = this.editForm();
    if (!m || !form) return;
    const rows = (form.get('datesPrev') as FormArray).getRawValue() as {
      idPrevision: number | null;
      typeDate: string;
      datePrev: string;
    }[];
    this.submittingEdit.set(true);
    this.reconcilierDates(
      m.idDetail,
      this.editOriginal(),
      rows,
      () => {
        this.toast.success('Dates prévisionnelles enregistrées.');
        this.submittingEdit.set(false);
        this.annulerEdition();
      },
      () => this.submittingEdit.set(false), // 400/403/409 → toast centralisé
    );
  }

  /**
   * Réconcilie les dates d'un marché : DELETE des retirées, PUT des modifiées, POST des nouvelles
   * (idPrevision auto = max global + 1). Mutualisé entre l'édition des dates et l'édition de ligne.
   */
  private reconcilierDates(
    idDetail: number,
    original: MarchePrevision[],
    rows: { idPrevision: number | null; typeDate: string; datePrev: string }[],
    done: () => void,
    fail: () => void,
  ): void {
    const currentIds = new Set(rows.filter((r) => r.idPrevision != null).map((r) => r.idPrevision));
    const toDelete = original.filter((o) => !currentIds.has(o.idPrevision));
    const toUpdate = rows.filter((r) => r.idPrevision != null);
    const toCreate = rows.filter((r) => r.idPrevision == null && r.typeDate);
    const run = (base: number) => {
      const ops = [
        ...toDelete.map((o) => this.previsionService.delete(o.idPrevision)),
        ...toUpdate.map((r) =>
          this.previsionService.update(r.idPrevision as number, {
            idPrevision: r.idPrevision as number,
            idDetail,
            typeDate: r.typeDate as MarchePrevision['typeDate'],
            datePrev: r.datePrev || undefined,
          }),
        ),
        ...toCreate.map((r, i) =>
          this.previsionService.create({
            idPrevision: base + i + 1,
            idDetail,
            typeDate: r.typeDate as MarchePrevision['typeDate'],
            datePrev: r.datePrev || undefined,
          }),
        ),
      ];
      if (!ops.length) {
        done();
        return;
      }
      forkJoin(ops).subscribe({ next: () => done(), error: () => fail() });
    };
    if (toCreate.length) {
      this.previsionService.list().subscribe((all) => run(all.length ? Math.max(...all.map((p) => p.idPrevision)) : 0));
    } else {
      run(0);
    }
  }

  /** Construit le formulaire marché (création ou édition pré-remplie ; PK verrouillée en édition). */
  private construireForm(ppm: Ppm, m?: Marche): void {
    this.createForm = this.fb.group({
      idDetail: [{ value: m?.idDetail ?? null, disabled: !!m }, Validators.required],
      idDossier: [{ value: m?.idDossier ?? ppm.idDossier ?? null, disabled: true }, Validators.required],
      idPpm: [{ value: m?.idPpm ?? ppm.idPpm, disabled: true }, Validators.required],
      designationMarche: [m?.designationMarche ?? ''],
      numCompte: [m?.numCompte ?? (null as string | null)],
      montEstim: [m?.montEstim ?? (null as number | null)],
      financement: [m?.financement ?? ''],
      statut: [m?.statut ?? ''],
      idSituation: [m?.idSituation ?? (null as number | null)],
      idNature: [m?.idNature ?? (null as number | null)],
      idMode: [m?.idMode ?? (null as number | null)],
      datesPrev: this.fb.array([] as FormGroup[]),
    });
    this.modeSuggestion.set({ state: 'idle', modes: [], recommande: null });
    this.modeSub?.unsubscribe();
    // Recalcul sur les seuls champs déterminants (pas idMode → choix manuel préservé).
    this.modeSub = merge(
      this.createForm.get('idSituation')!.valueChanges,
      this.createForm.get('idNature')!.valueChanges,
      this.createForm.get('montEstim')!.valueChanges,
    )
      .pipe(debounceTime(350))
      .subscribe(() => this.determinerMode());
  }

  /** Ouvre la création d'un marché rattaché à ce PPM (idPpm + idDossier pré-remplis, verrouillés). */
  ouvrirCreation(ppm: Ppm): void {
    this.createErrors.set({});
    this.chargerReferentiels();
    this.editingMarche.set(null);
    this.createOriginalDates.set([]);
    this.construireForm(ppm);
    this.createPpm.set(ppm);
  }

  /** Ouvre l'édition d'une ligne de marché (champs + dates) — réservé BROUILLON. */
  ouvrirEditionLigne(m: Marche): void {
    const ppm = this.ppms().find((p) => p.idPpm === m.idPpm);
    if (!ppm) return;
    this.createErrors.set({});
    this.chargerReferentiels();
    this.editingMarche.set(m);
    this.construireForm(ppm, m);
    this.previsionService.byMarche(m.idDetail).subscribe((rows) => {
      this.createOriginalDates.set(rows);
      const arr = this.createForm.get('datesPrev') as FormArray;
      rows.forEach((p) => arr.push(this.ligneDate(p)));
    });
    this.createPpm.set(ppm);
  }

  // --- Suppression marché / PPM (cascade backend ; confirmation explicite) ---

  /** Ouvre la confirmation de suppression d'un marché et charge le nombre de dates prévisionnelles. */
  demanderSuppressionMarche(m: Marche): void {
    this.confirmState.set({
      kind: 'marche',
      id: m.idDetail,
      label: m.designationMarche || `marché #${m.idDetail}`,
      count: null,
    });
    this.previsionService.byMarche(m.idDetail).subscribe({
      next: (rows) =>
        this.confirmState.update((c) =>
          c && c.kind === 'marche' && c.id === m.idDetail ? { ...c, count: rows.length } : c,
        ),
      error: () => {}, // le nombre reste « … » ; la suppression demeure possible
    });
  }

  /** Ouvre la confirmation de suppression d'un PPM (impact = ses marchés + leurs dates). */
  demanderSuppressionPpm(ppm: Ppm): void {
    this.confirmState.set({
      kind: 'ppm',
      id: ppm.idPpm,
      label: ppm.reference || `PPM #${ppm.idPpm}`,
      count: this.marchesOf(ppm.idPpm).length,
    });
  }

  /** Message d'impact affiché dans la confirmation. */
  messageSuppression(c: { kind: 'marche' | 'ppm'; label: string; count: number | null }): string {
    if (c.kind === 'ppm') {
      return `Supprimer le PPM « ${c.label} » ? Cela supprimera aussi ses ${c.count ?? 0} marché(s) et toutes leurs dates prévisionnelles.`;
    }
    const n = c.count == null ? '…' : c.count;
    return `Supprimer le marché « ${c.label} » et ses ${n} date(s) prévisionnelle(s) ?`;
  }

  annulerSuppression(): void {
    if (!this.confirmBusy()) {
      this.confirmState.set(null);
    }
  }

  /** Exécute la suppression confirmée ; la cascade (prévisions, marchés) est gérée côté backend. */
  confirmerSuppression(): void {
    const c = this.confirmState();
    if (!c) {
      return;
    }
    this.confirmBusy.set(true);
    const op = c.kind === 'ppm' ? this.ppmService.delete(c.id) : this.marcheService.delete(c.id);
    op.subscribe({
      next: () => {
        if (c.kind === 'ppm') {
          this.toast.success('PPM supprimé.');
          this.ppms.update((arr) => arr.filter((p) => p.idPpm !== c.id));
          this.marches.update((arr) => arr.filter((m) => m.idPpm !== c.id));
          this.expanded.update((s) => {
            const n = new Set(s);
            n.delete(c.id);
            return n;
          });
          // Notifie les autres écrans (ex. « Mes brouillons ») que la liste des dossiers a changé.
          this.dossiersRefresh.notifierChangement();
        } else {
          this.toast.success('Marché supprimé.');
          this.marches.update((arr) => arr.filter((m) => m.idDetail !== c.id));
        }
        this.confirmBusy.set(false);
        this.confirmState.set(null);
      },
      error: () => {
        // 403/409 → toast centralisé avec le message réel du backend.
        this.confirmBusy.set(false);
        this.confirmState.set(null);
      },
    });
  }

  annulerCreation(): void {
    this.modeSub?.unsubscribe();
    this.createPpm.set(null);
    this.editingMarche.set(null);
    this.createOriginalDates.set([]);
  }

  /** Aperçu du mode (situation + nature + montant + localité du dossier) ; la PRMP choisit, le backend valide. */
  private determinerMode(): void {
    const v = this.createForm.getRawValue();
    const idLocalite = this.localiteCourante();
    const idMode = this.createForm.get('idMode')!;
    if (v.idSituation == null || v.idNature == null || v.montEstim == null || !idLocalite) {
      this.modeSuggestion.set({ state: 'idle', modes: [], recommande: null });
      return;
    }
    this.modeSuggestion.set({ state: 'loading', modes: [], recommande: null });
    this.reglePassation
      .suggestionMode({ idSituation: v.idSituation, idNature: v.idNature, montant: v.montEstim, idLocalite })
      .subscribe({
        next: (res) => {
          if (res.modesAutorises.length) {
            const cur = idMode.value as number | null;
            if (cur == null || !res.modesAutorises.some((m) => m.idMode === cur)) {
              idMode.setValue(res.modeRecommande, { emitEvent: false });
            }
            this.modeSuggestion.set({ state: 'ready', modes: res.modesAutorises, recommande: res.modeRecommande });
          } else {
            idMode.setValue(null, { emitEvent: false });
            this.modeSuggestion.set({ state: 'none', modes: [], recommande: null });
          }
        },
        error: () => {
          idMode.setValue(null, { emitEvent: false });
          this.modeSuggestion.set({ state: 'none', modes: [], recommande: null });
        },
      });
  }

  /** Localité (code) du dossier en cours de saisie, dérivée de son entité côté serveur. */
  private localiteCourante(): string | null {
    const idDossier =
      this.createPpm()?.idDossier ??
      (this.createForm.getRawValue() as { idDossier?: number }).idDossier ??
      null;
    if (idDossier == null) return null;
    return this.dossiers().find((d) => d.idDossier === idDossier)?.idLocalite ?? null;
  }

  localiteLabel(): string {
    return this.localiteCourante() ?? '— (dérivée de l’entité)';
  }

  /** Charge une seule fois les référentiels des listes déroulantes (natures, situations, comptes). */
  private chargerReferentiels(): void {
    if (this.refsLoaded) {
      return;
    }
    this.refsLoading.set(true);
    forkJoin({
      natures: this.natureService.list(),
      situations: this.situationService.list(),
      comptes: this.compteService.list(),
    }).subscribe({
      next: (r) => {
        this.natures.set(r.natures);
        this.situations.set(r.situations);
        this.comptes.set(r.comptes);
        this.refsLoaded = true;
        this.refsLoading.set(false);
      },
      error: () => this.refsLoading.set(false),
    });
  }
  createErr(key: string): string | undefined {
    return this.createErrors()[key];
  }

  enregistrerMarche(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.submittingCreate.set(true);
    this.createErrors.set({});
    const v = this.createForm.getRawValue();
    const body: Marche = {
      idDetail: v.idDetail,
      idDossier: v.idDossier,
      idPpm: v.idPpm,
      designationMarche: v.designationMarche || undefined,
      numCompte: v.numCompte ?? undefined,
      montEstim: v.montEstim ?? undefined,
      financement: v.financement || undefined,
      statut: v.statut || undefined,
      idSituation: v.idSituation ?? undefined,
      idNature: v.idNature ?? undefined,
      idMode: v.idMode ?? undefined,
    };
    const editing = this.editingMarche();
    if (editing) {
      this.marcheService.update(body.idDetail, body).subscribe({
        next: (updated) =>
          this.reconcilierDates(
            body.idDetail,
            this.createOriginalDates(),
            v.datesPrev ?? [],
            () => {
              this.toast.success('Marché modifié.');
              this.submittingCreate.set(false);
              this.modeSub?.unsubscribe();
              this.createPpm.set(null);
              this.editingMarche.set(null);
              this.marches.update((arr) => arr.map((x) => (x.idDetail === updated.idDetail ? updated : x)));
            },
            () => this.submittingCreate.set(false),
          ),
        error: (e: ApiError) => {
          this.submittingCreate.set(false);
          this.createErrors.set(e.fieldErrors ?? {});
        },
      });
      return;
    }
    this.marcheService.create(body).subscribe({
      next: (created) =>
        this.creerDates(created.idDetail, v.datesPrev ?? [], () => {
          this.toast.success((v.datesPrev?.length ?? 0) ? 'Marché et dates créés.' : 'Marché créé.');
          this.submittingCreate.set(false);
          this.modeSub?.unsubscribe();
          this.createPpm.set(null);
          // Maj fine : on ajoute l'objet renvoyé (idMode déjà calculé), sans recharger toute la liste.
          this.marches.update((arr) => [...arr, created]);
        }),
      error: (e: ApiError) => {
        this.submittingCreate.set(false);
        this.createErrors.set(e.fieldErrors ?? {});
      },
    });
  }

  /** POST des dates saisies avec idPrevision auto (max global + 1). */
  private creerDates(
    idDetail: number,
    lignes: { typeDate: string; datePrev: string }[],
    done: () => void,
  ): void {
    const valides = lignes.filter((l) => l.typeDate);
    if (!valides.length) {
      done();
      return;
    }
    this.previsionService.list().subscribe((all) => {
      const base = all.length ? Math.max(...all.map((p) => p.idPrevision)) : 0;
      forkJoin(
        valides.map((l, i) =>
          this.previsionService.create({
            idPrevision: base + i + 1,
            idDetail,
            typeDate: l.typeDate as MarchePrevision['typeDate'],
            datePrev: l.datePrev || undefined,
          }),
        ),
      ).subscribe({
        next: () => done(),
        error: (e: ApiError) => {
          this.submittingCreate.set(false);
          this.createErrors.set(e.fieldErrors ?? {});
        },
      });
    });
  }

  resolve(map: Map<string, string>, id?: number): string {
    if (id === null || id === undefined) {
      return '—';
    }
    return map.get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
}
