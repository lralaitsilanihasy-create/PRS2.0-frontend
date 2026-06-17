import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Controleur, Dispatch, Dossier, Reception } from '../../models';
import { ControleurService, DispatchService, ProfileService } from '../../services';

interface Option {
  id: string;
  label: string;
}

/**
 * Formulaire de dispatch affiné (modal). PK auto (max+1), réception déduite du dossier,
 * dispatcheur = utilisateur connecté (posé front), interimDispatch=false (Président/CC titulaire).
 * CC et Membre = listes déroulantes des contrôleurs de la localité du dossier (rôle via profils).
 */
@Component({
  selector: 'app-dispatch-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="df__overlay" (click)="closed.emit()">
      <form
        class="df cnm-card cnm-form"
        [formGroup]="form"
        (ngSubmit)="enregistrer()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        novalidate
      >
        <header class="df__head">
          <h2 class="df__title">Dispatcher — {{ dossier().refeDossier || 'Dossier #' + dossier().idDossier }}</h2>
          <button type="button" class="df__close" aria-label="Fermer" (click)="closed.emit()">&times;</button>
        </header>
        <div class="df__body">
          <label class="cnm-field">
            <span class="cnm-field__label">Chef de commission</span>
            <select class="cnm-select" formControlName="imCtrlCc">
              <option [ngValue]="null">— Sélectionner —</option>
              @for (o of ccOptions(); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }
            </select>
            @if (!ccOptions().length) { <span class="cnm-field__hint cnm-muted">Aucun CC pour cette localité.</span> }
          </label>
          <label class="cnm-field">
            <span class="cnm-field__label">Membre assigné *</span>
            <select class="cnm-select" formControlName="imCtrlMembre">
              <option [ngValue]="null">— Sélectionner —</option>
              @for (o of membreOptions(); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }
            </select>
            @if (req('imCtrlMembre')) { <span class="cnm-field__hint">Obligatoire.</span> }
            @if (!membreOptions().length) { <span class="cnm-field__hint cnm-muted">Aucun membre pour cette localité.</span> }
          </label>
          <label class="cnm-field">
            <span class="cnm-field__label">Date de dispatch</span>
            <input class="cnm-input" type="date" formControlName="dateDispatch" />
          </label>
          <label class="cnm-field">
            <span class="cnm-field__label">Instructions</span>
            <textarea class="cnm-textarea" rows="2" formControlName="instructions"></textarea>
          </label>
        </div>
        <footer class="df__foot">
          <button type="button" class="cnm-btn cnm-btn--ghost" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="cnm-btn cnm-btn--primary" [disabled]="submitting()">Dispatcher</button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .df__overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: var(--cnm-space-4); }
    .df { width: 100%; max-width: 30rem; box-shadow: var(--cnm-shadow); }
    .df__head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-3); padding: var(--cnm-space-4) var(--cnm-space-5); border-bottom: 1px solid var(--cnm-border); }
    .df__title { margin: 0; font-size: var(--cnm-fs-md); }
    .df__close { background: transparent; border: 0; color: var(--cnm-text-2); font-size: 1.5rem; line-height: 1; cursor: pointer; }
    .df__close:hover { color: var(--cnm-text); }
    .df__body { padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .df__foot { display: flex; justify-content: flex-end; gap: var(--cnm-space-2); padding: var(--cnm-space-3) var(--cnm-space-5); border-top: 1px solid var(--cnm-border); }
  `,
})
export class DispatchForm {
  readonly dossier = input.required<Dossier>();
  readonly reception = input.required<Reception>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly dispatchService = inject(DispatchService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);

  readonly submitting = signal(false);
  private readonly controleurs = signal<Controleur[]>([]);
  private readonly profileLib = signal<Map<number, string>>(new Map());

  readonly form = this.fb.nonNullable.group({
    imCtrlCc: [null as string | null],
    imCtrlMembre: [null as string | null, Validators.required],
    dateDispatch: [new Date().toISOString().slice(0, 10)],
    instructions: [''],
  });

  private optionsParRole(motif: RegExp): Option[] {
    const loc = this.dossier().idLocalite;
    const libs = this.profileLib();
    return this.controleurs()
      .filter((c) => c.idLocalite === loc && c.idProfile != null && motif.test(libs.get(c.idProfile) ?? ''))
      .map((c) => ({ id: c.imControleur, label: [c.nomCont, c.prenomsCont].filter(Boolean).join(' ') || c.imControleur }));
  }
  readonly ccOptions = computed(() => this.optionsParRole(/chef.*commission/i));
  readonly membreOptions = computed(() => this.optionsParRole(/membre/i));

  constructor() {
    forkJoin({ ctrls: this.controleurService.list(), profiles: this.profileService.list() }).subscribe(
      ({ ctrls, profiles }) => {
        this.controleurs.set(ctrls);
        this.profileLib.set(new Map(profiles.map((p) => [p.idProfile, p.profile ?? ''])));
      },
    );
  }

  req(c: string): boolean {
    const ctrl = this.form.get(c);
    return !!ctrl && ctrl.touched && ctrl.hasError('required');
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    const base: Dispatch = {
      idDispatch: 0,
      idReception: this.reception().idReception,
      imCtrlDispatch: this.auth.ref() ?? undefined,
      imCtrlCc: v.imCtrlCc ?? undefined,
      imCtrlMembre: v.imCtrlMembre ?? undefined,
      dateDispatch: v.dateDispatch || undefined,
      instructions: v.instructions || undefined,
      interimDispatch: false, // Président / CC titulaire
    };
    // Création (action définitive) : idDispatch = PK client (max+1).
    this.dispatchService.list().subscribe((all) => {
      base.idDispatch = (all.length ? Math.max(...all.map((d) => d.idDispatch)) : 0) + 1;
      this.dispatchService.create(base).subscribe({
        next: () => {
          this.toast.success('Dossier dispatché.');
          this.submitting.set(false);
          this.saved.emit();
        },
        error: (_e: ApiError) => this.submitting.set(false), // 400/403/409 → toast centralisé
      });
    });
  }
}
