import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { ApiError, getFieldError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Reception } from '../../models';
import {
  DossierService,
  LocaliteService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

/**
 * Réceptions du Secrétaire (§3.4). Worklist « à réceptionner » = dossiers SOUMIS de SA
 * localité (GET /api/dossiers, déjà filtré par localité) sans réception existante
 * (GET /api/receptions). Bouton « Enregistrer » par ligne → ouvre le formulaire pré-rempli
 * pour CE dossier ; création de la réception INITIALE (numPassage=1, typePassage=INITIAL).
 * idReception = identifiant technique assigné par le client (convention PK contrat) : suggéré
 * automatiquement. Si « complet », le dossier passe PRET_DISPATCH. Erreurs 403/409/400 via
 * l'intercepteur centralisé.
 */
@Component({
  selector: 'app-secretaire-receptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StatutBadge, DossierConsultation],
  template: `
    <section class="rec">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Secrétaire</div>
          <h1 class="page-title">Réceptions</h1>
        </div>
      </header>

      <div class="alert alert-info">
        À réceptionner : les dossiers <strong>soumis</strong> de votre localité, en attente de
        réception initiale. Cliquez « Enregistrer » sur une ligne pour saisir sa réception.
      </div>

      @if (referenceAttribuee(); as ref) {
        <div class="alert alert-success rec__ref">
          <span>Réception enregistrée — <strong>Référence attribuée : {{ ref }}</strong></span>
          <span class="rec__ref-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="copier(ref)">Copier</button>
            <button type="button" class="rec__ref-close" aria-label="Fermer" (click)="referenceAttribuee.set(null)">&times;</button>
          </span>
        </div>
      }

      @if (loading()) {
        <p class="rec__info">Chargement…</p>
      } @else {
        <div class="table-responsive"><table>
          <thead>
            <tr><th>#</th><th>Référence</th><th>Type</th><th>Localité</th><th>Statut</th><th>Action</th></tr>
          </thead>
          <tbody>
            @for (d of aReceptionner(); track d.idDossier) {
              <tr>
                <td class="cnm-mono">{{ d.idDossier }}</td>
                <td>{{ d.refeDossier || '—' }}</td>
                <td>{{ d.idTypeDossier || '—' }}</td>
                <td>{{ loc(d.idLocalite) }}</td>
                <td><app-statut-badge [statut]="d.statut" /></td>
                <td class="rec__row-action">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">
                    Consulter
                  </button>
                  @if (canWrite()) {
                    <button type="button" class="btn btn-primary btn-sm" (click)="ouvrir(d)">
                      Enregistrer
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="rec__info">Aucun dossier en attente de réception.</td></tr>
            }
          </tbody>
        </table></div>
      }
    </section>

    @if (selected(); as d) {
      <div class="modal-backdrop" (click)="annuler()">
        <form
          class="modal cnm-form"
          [formGroup]="form"
          (ngSubmit)="enregistrer()"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          novalidate
        >
          <header class="modal-header-plain">
            <span class="modal-title">Réception — {{ d.refeDossier || 'Dossier #' + d.idDossier }}</span>
            <button type="button" class="btn-close-plain" aria-label="Fermer" (click)="annuler()">✕</button>
          </header>

          <div class="modal-body">
            <dl class="rec-info">
              <div><dt>Dossier</dt><dd class="cnm-mono">#{{ d.idDossier }}</dd></div>
              <div><dt>Type</dt><dd>{{ d.idTypeDossier || '—' }}</dd></div>
              <div><dt>Localité</dt><dd>{{ loc(d.idLocalite) }}</dd></div>
              <div><dt>Statut</dt><dd><app-statut-badge [statut]="d.statut" /></dd></div>
            </dl>

            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Passage</span>
                <input class="form-control" type="text" value="1 — INITIAL" readonly disabled />
                <span class="form-hint">Réception initiale (le Secrétaire agit au passage 1).</span>
              </label>
              <label class="form-group">
                <span class="form-label">Date de réception</span>
                <input class="form-control" type="date" formControlName="dateReception" />
              </label>
              <label class="form-group rec__check">
                <input type="checkbox" formControlName="complet" />
                <span>Dossier complet (→ passe en PRET_DISPATCH)</span>
              </label>
            </div>
            <label class="form-group">
              <span class="form-label">Observation</span>
              <textarea class="form-control" rows="2" formControlName="observation"></textarea>
            </label>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annuler()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              {{ submitting() ? 'Enregistrement…' : 'Enregistrer la réception' }}
            </button>
          </footer>
        </form>
      </div>
    }

    @if (completWarning()) {
      <div class="modal-backdrop" (click)="completWarning.set(false)">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true">
          <div class="modal-body">
            <p>
              Le dossier doit être complet pour être réceptionné. Veuillez cocher « Dossier complet » avant d'enregistrer.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" (click)="completWarning.set(false)">OK</button>
          </div>
        </div>
      </div>
    }

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .rec__ref { justify-content: space-between; align-items: center; }
    .rec__ref-actions { display: flex; align-items: center; gap: 0.5rem; }
    .rec__ref-close { background: transparent; border: 0; color: inherit; font-size: 1.25rem; line-height: 1; cursor: pointer; }
    .rec__info { color: var(--n-400); padding: 1.5rem; text-align: center; }
    .rec__row-action { display: flex; gap: 0.5rem; align-items: center; }
    .rec__check { flex-direction: row; align-items: center; gap: 0.5rem; }
    .rec-info { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0 0 0.75rem; }
    .rec-info dt { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--n-400); }
    .rec-info dd { margin: 2px 0 0; color: var(--n-700); }
    .confirm-modal { max-width: 26rem; }
  `,
})
export class SecretaireReceptions {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<ApiError | null>(null);
  /** Dossier dont le formulaire de réception est ouvert (null = fermé). */
  readonly selected = signal<Dossier | null>(null);
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);
  /** Worklist « à réceptionner » : SOUMIS + sans réception, filtré côté serveur. */
  readonly aReceptionner = signal<Dossier[]>([]);
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  /** Référence officielle attribuée à la dernière réception (affichée + copiable ; null = masquée). */
  readonly referenceAttribuee = signal<string | null>(null);
  /** Avertissement « cocher Dossier complet » avant enregistrement (true = affiché). */
  readonly completWarning = signal(false);

  readonly canWrite = computed(() => this.permissions.can('RECEPTION_WRITE'));

  readonly form = this.fb.nonNullable.group({
    dateReception: [''],
    observation: [''],
    complet: [false],
  });

  constructor() {
    this.charger();
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
  }

  private charger(): void {
    this.loading.set(true);
    // Worklist filtrée côté serveur (SOUMIS + sans réception) : pas de chargement de tout /api/receptions.
    this.dossierService.aReceptionner().subscribe({
      next: (rows) => {
        this.aReceptionner.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loc(id?: string): string {
    return id ? this.localiteMap().get(id) ?? id : '—';
  }
  /** Copie la référence dans le presse-papiers (contexte sécurisé / localhost). */
  copier(ref: string): void {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(ref).then(() => this.toast.success('Référence copiée.'));
    }
  }
  err(champ: string): string | undefined {
    return getFieldError(this.formError(), champ);
  }
  req(champ: string): boolean {
    const c = this.form.get(champ);
    return !!c && c.touched && c.hasError('required');
  }

  /** Ouvre le formulaire pour le dossier de la ligne, pré-rempli. */
  ouvrir(d: Dossier): void {
    this.formError.set(null);
    this.selected.set(d);
    this.form.reset({
      dateReception: new Date().toISOString().slice(0, 10),
      observation: '',
      complet: false,
    });
  }
  annuler(): void {
    this.selected.set(null);
  }

  enregistrer(): void {
    const d = this.selected();
    if (!d) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Garde-fou UX : la réception n'est acceptée que si le dossier est marqué complet.
    if (!this.form.getRawValue().complet) {
      this.completWarning.set(true);
      return;
    }
    this.formError.set(null);
    this.submitting.set(true);
    // Vérif. unitaire « déjà réceptionné ? » avant d'enregistrer (test léger, pas par ligne).
    this.receptionService.existePourDossier(d.idDossier).subscribe({
      next: (res) => {
        if (res.recu) {
          this.submitting.set(false);
          this.toast.error('Ce dossier a déjà été réceptionné.');
          this.retirerDeWorklist(d.idDossier);
          this.selected.set(null);
          return;
        }
        this.creerReception(d);
      },
      error: () => this.submitting.set(false), // 403/… → toast centralisé
    });
  }

  private creerReception(d: Dossier): void {
    const v = this.form.getRawValue();
    // idReception non envoyé : alloué par le serveur (id client ignoré). Le reste typé Reception via cast.
    const body = {
      idDossier: d.idDossier,
      numPassage: 1,
      typePassage: 'INITIAL',
      imCtrlRecept: this.auth.ref() ?? undefined,
      dateReception: v.dateReception || undefined,
      observation: v.observation || undefined,
      complet: v.complet,
    } as Reception;
    this.receptionService.create(body).subscribe({
      next: (created) => {
        this.toast.success('Réception enregistrée.');
        this.submitting.set(false);
        this.referenceAttribuee.set(created.reference ?? null);
        // Maj fine : la ligne quitte la worklist (a-receptionner = SOUMIS sans réception).
        this.retirerDeWorklist(d.idDossier);
        this.selected.set(null);
      },
      error: (e: ApiError) => {
        this.submitting.set(false);
        if (e.fieldErrors) this.formError.set(e); // 403/409 → toast centralisé
      },
    });
  }

  private retirerDeWorklist(idDossier: number): void {
    this.aReceptionner.update((list) => list.filter((x) => x.idDossier !== idDossier));
  }
}
