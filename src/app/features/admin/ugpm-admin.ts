import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CreerUgpmRequest, Prmp, Ugpm } from '../../models';
import { PrmpService, UgpmService } from '../../services';

/**
 * Administration des UGPM (`/api/ugpms`, ADMINISTRATEUR). Le contrat n'expose que **création** et
 * **liste** (pas d'édition/suppression) et la création alloue aussi le **compte** (login + mot de
 * passe) — d'où un écran dédié plutôt que le CRUD générique. La **PRMP de tutelle** est choisie dans
 * la liste `/api/prmps` (une PRMP chapeaute plusieurs UGPM).
 */
@Component({
  selector: 'app-ugpm-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="ua cnm-card">
      <header class="ua__head">
        <h1 class="ua__title">UGPM — unités de gestion de la passation</h1>
        <p class="cnm-muted">
          Créez un compte UGPM et rattachez-le à sa PRMP de tutelle. L'UGPM saisit et corrige les dossiers
          sous le périmètre de sa PRMP ; seule la PRMP peut soumettre.
        </p>
      </header>

      <form class="ua__form cnm-form" [formGroup]="form" (ngSubmit)="creer()" novalidate>
        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Identifiant UGPM *</span>
            <input class="form-control" type="text" formControlName="idUgpm" placeholder="ex. UGPM001" />
            @if (invalide('idUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Libellé</span>
            <input class="form-control" type="text" formControlName="libelle" placeholder="(optionnel)" />
          </label>
          <label class="form-group">
            <span class="form-label">PRMP de tutelle *</span>
            <select class="form-control" formControlName="idPrmpTutelle">
              <option value="" disabled>— Sélectionner —</option>
              @for (p of prmps(); track p.idPrmp) {
                <option [value]="p.idPrmp">{{ prmpLabel(p) }}</option>
              }
            </select>
            @if (invalide('idPrmpTutelle')) { <span class="form-error">Obligatoire.</span> }
            @if (!prmps().length) { <span class="form-hint">Aucune PRMP disponible — créez d'abord une PRMP.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Nom *</span>
            <input class="form-control" type="text" formControlName="nomUgpm" />
            @if (invalide('nomUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Prénoms *</span>
            <input class="form-control" type="text" formControlName="prenomsUgpm" />
            @if (invalide('prenomsUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Matricule *</span>
            <input class="form-control" type="text" formControlName="imUgpm" />
            @if (invalide('imUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">CIN *</span>
            <input class="form-control" type="text" formControlName="cin" />
            @if (invalide('cin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Date CIN *</span>
            <input class="form-control" type="date" formControlName="dateCin" />
            @if (invalide('dateCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Lieu CIN *</span>
            <input class="form-control" type="text" formControlName="lieuCin" />
            @if (invalide('lieuCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Email *</span>
            <input class="form-control" type="email" formControlName="emailUgpm" autocomplete="off" />
            @if (invalide('emailUgpm')) { <span class="form-error">Email valide obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Téléphone *</span>
            <input class="form-control" type="text" formControlName="telUgpm" />
            @if (invalide('telUgpm')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Login *</span>
            <input class="form-control" type="text" formControlName="login" autocomplete="off" />
            @if (invalide('login')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Mot de passe *</span>
            <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password" />
            @if (invalide('motDePasse')) { <span class="form-error">8 caractères minimum.</span> }
          </label>
        </div>
        <footer class="ua__foot">
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Création…' : 'Créer l\\'UGPM' }}
          </button>
        </footer>
      </form>

      <h2 class="ua__sub">UGPM existantes ({{ ugpms().length }})</h2>
      @if (ugpms().length) {
        <table class="cnm-table">
          <thead><tr><th>Identifiant</th><th>Responsable</th><th>Libellé</th><th>PRMP de tutelle</th></tr></thead>
          <tbody>
            @for (u of ugpms(); track u.idUgpm) {
              <tr>
                <td>{{ u.idUgpm }}</td>
                <td>{{ u.nomUgpm }} {{ u.prenomsUgpm }}</td>
                <td>{{ u.libelle || '—' }}</td>
                <td>{{ tutelleLabel(u.idPrmpTutelle) }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="cnm-muted">Aucune UGPM enregistrée.</p>
      }
    </section>
  `,
  styles: `
    .ua { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; max-width: min(64rem, 96vw); }
    .ua__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .ua__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ua__form { display: flex; flex-direction: column; gap: 1rem; }
    .ua__foot { display: flex; justify-content: flex-end; }
    .ua__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
  `,
})
export class UgpmAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ugpmService = inject(UgpmService);
  private readonly prmpService = inject(PrmpService);
  private readonly toast = inject(ToastService);

  readonly prmps = signal<Prmp[]>([]);
  readonly ugpms = signal<Ugpm[]>([]);
  readonly submitting = signal(false);
  private readonly prmpMap = computed(() => new Map(this.prmps().map((p) => [p.idPrmp, this.prmpLabel(p)])));

  readonly form = this.fb.nonNullable.group({
    idUgpm: ['', Validators.required],
    libelle: [''],
    idPrmpTutelle: ['', Validators.required],
    nomUgpm: ['', Validators.required],
    prenomsUgpm: ['', Validators.required],
    imUgpm: ['', Validators.required],
    cin: ['', Validators.required],
    dateCin: ['', Validators.required],
    lieuCin: ['', Validators.required],
    emailUgpm: ['', [Validators.required, Validators.email]],
    telUgpm: ['', Validators.required],
    login: ['', Validators.required],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.prmpService.list().subscribe((r) => this.prmps.set(r));
    this.charger();
  }
  private charger(): void {
    this.ugpmService.list().subscribe((r) => this.ugpms.set(r));
  }

  invalide(champ: string): boolean {
    const c = this.form.get(champ)!;
    return c.invalid && (c.touched || c.dirty);
  }
  prmpLabel(p: Prmp): string {
    return `${p.prenomsPrmp ?? ''} ${p.nomPrmp ?? ''}`.trim() || p.idPrmp;
  }
  tutelleLabel(idPrmp: string): string {
    return this.prmpMap().get(idPrmp) ?? idPrmp;
  }

  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const req = this.form.getRawValue() as CreerUgpmRequest;
    this.ugpmService.creer(req).subscribe({
      next: () => {
        this.toast.success(`UGPM « ${req.idUgpm} » créée.`);
        this.submitting.set(false);
        this.form.reset();
        this.charger();
      },
      error: (_e: ApiError) => this.submitting.set(false), // message via l'intercepteur (409 : id/login pris, tutelle inconnue)
    });
  }
}
