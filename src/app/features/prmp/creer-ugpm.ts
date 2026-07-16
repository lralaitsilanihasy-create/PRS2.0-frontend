import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { RegisterUgpmRequest } from '../../models';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'date';
}

/** Champs d'identité + compte de l'UGPM (la tutelle est la PRMP connectée, non saisie). */
const FIELDS: FieldDef[] = [
  { key: 'login', label: 'Identifiant de connexion', type: 'text' },
  { key: 'motDePasse', label: 'Mot de passe (min. 8 caractères)', type: 'password' },
  { key: 'idUgpm', label: 'Matricule (identifiant)', type: 'text' },
  { key: 'libelle', label: 'Libellé (optionnel)', type: 'text' },
  { key: 'nomUgpm', label: 'Nom', type: 'text' },
  { key: 'prenomsUgpm', label: 'Prénoms', type: 'text' },
  { key: 'cin', label: 'CIN', type: 'text' },
  { key: 'dateCin', label: 'Date du CIN', type: 'date' },
  { key: 'lieuCin', label: 'Lieu du CIN', type: 'text' },
  { key: 'emailUgpm', label: 'Email', type: 'email' },
  { key: 'telUgpm', label: 'Téléphone', type: 'text' },
];

const TYPES_OK = ['application/pdf', 'image/jpeg', 'image/png'];
const IMG_OK = ['image/jpeg', 'image/png'];

/**
 * Création d'une UGPM par la PRMP connectée (profil PRMP) : identité + compte + pièces
 * (CIN obligatoire, photo optionnelle — fichier ou caméra). La **PRMP de tutelle est la PRMP
 * connectée** (non saisie). Passe par `POST /api/auth/register/ugpm` → compte **EN_ATTENTE**,
 * activé après validation de l'Administrateur.
 */
@Component({
  selector: 'app-creer-ugpm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="cu cnm-card">
      <header class="cu__head">
        <h1 class="cu__title">Créer une UGPM</h1>
        <p class="cnm-muted">
          L'UGPM est créée sous votre PRMP de tutelle (<strong>{{ tutelle() || '—' }}</strong>) ;
          son compte reste <strong>en attente de validation</strong> par l'Administrateur.
        </p>
      </header>

      @if (success()) {
        <div class="cu__success" role="status">
          <span class="badge badge-warning">En attente de validation</span>
          <p>{{ successMessage() }}</p>
          <div class="cu__success-actions">
            <button type="button" class="btn btn-outline" (click)="nouvelle()">Créer une autre UGPM</button>
            <a class="btn btn-primary" routerLink="/prmp/tableau-de-bord">Retour</a>
          </div>
        </div>
      } @else {
        @if (errorMessage()) { <div class="cu__error" role="alert">{{ errorMessage() }}</div> }

        <form class="cu__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="cu__grid">
            <section class="cu__section">
              <h2 class="cu__section-title">Identité &amp; compte</h2>
              <div class="cu__fields">
                @for (f of fields; track f.key) {
                  <label class="form-group">
                    <span class="form-label">{{ f.label }}</span>
                    <input class="form-control" [type]="f.type" [formControlName]="f.key" [class.error]="invalid(f.key)" />
                    @if (form.get(f.key)?.touched && form.get(f.key)?.hasError('required')) {
                      <span class="form-error">Obligatoire.</span>
                    }
                    @if (form.get(f.key)?.touched && form.get(f.key)?.hasError('minlength')) {
                      <span class="form-error">8 car. min.</span>
                    }
                    @if (fieldError(f.key)) { <span class="form-error">{{ fieldError(f.key) }}</span> }
                  </label>
                }
              </div>
            </section>

            <section class="cu__section">
              <h2 class="cu__section-title">Pièces jointes</h2>
              <p class="cnm-muted cu__note">PDF, JPEG ou PNG.</p>
              <label class="form-group">
                <span class="form-label">CIN * (≤ 5 Mo)</span>
                <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('cin', $event)" />
                @if (cin(); as f) { <span class="form-hint">{{ f.name }}</span> }
              </label>
              <div class="form-group">
                <span class="form-label">Photo (optionnelle, ≤ 5 Mo)</span>
                @if (photo(); as f) {
                  <div class="cu__photo-preview">
                    @if (photoPreview(); as src) { <img class="cu__photo-img" [src]="src" alt="Aperçu de la photo" /> }
                    <div class="cu__photo-meta">
                      <span class="form-hint">{{ f.name }}</span>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="reprendrePhoto()">Reprendre</button>
                      <button type="button" class="btn btn-danger btn-sm" (click)="clearPhoto()">Retirer</button>
                    </div>
                  </div>
                } @else if (cameraState() === 'live') {
                  <div class="cu__photo-cam">
                    <video #cam class="cu__photo-video" autoplay playsinline muted></video>
                    <div class="cu__photo-actions">
                      <button type="button" class="btn btn-primary btn-sm" (click)="capture()">Capturer</button>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="stopCamera()">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <div class="cu__photo-choices">
                    <input class="form-control" type="file" accept="image/png,image/jpeg" (change)="onFile('photo', $event)" />
                    <button type="button" class="btn btn-secondary btn-sm" (click)="startCamera()" [disabled]="cameraState() === 'starting'">
                      {{ cameraState() === 'starting' ? 'Ouverture…' : '📷 Prendre une photo' }}
                    </button>
                  </div>
                  @if (cameraError()) { <span class="form-error">{{ cameraError() }}</span> }
                }
                <canvas #snap hidden></canvas>
              </div>
              @if (fileError()) { <span class="form-error">{{ fileError() }}</span> }
            </section>
          </div>

          <footer class="cu__footer">
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              {{ submitting() ? 'Envoi…' : "Créer l'UGPM" }}
            </button>
          </footer>
        </form>
      }
    </section>
  `,
  styles: `
    .cu { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-width: min(64rem, 96vw); }
    .cu__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .cu__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .cu__form { display: flex; flex-direction: column; gap: 1rem; }
    .cu__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
    .cu__section { display: flex; flex-direction: column; gap: 0.5rem; }
    .cu__section-title { margin: 0; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); font-weight: 600; }
    .cu__fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem 0.75rem; }
    .cu__note { font-size: var(--text-xs); margin: 0; }
    .cu__footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--c-100); padding-top: 0.75rem; }
    .cu__photo-choices { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cu__photo-cam, .cu__photo-preview { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .cu__photo-video, .cu__photo-img { width: 100%; max-width: 14rem; border-radius: var(--radius-sm); border: 1px solid var(--c-100); }
    .cu__photo-video { background: #000; }
    .cu__photo-actions, .cu__photo-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cu__success { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
    .cu__success-actions { display: flex; gap: 0.5rem; }
    .cu__error { background: var(--cnm-danger-bg, #fde8e8); color: var(--cnm-danger-fg, #9b1c1c); border: 1px solid rgba(252, 129, 129, 0.4); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; font-size: var(--text-sm); }
    @media (max-width: 60rem) { .cu__grid { grid-template-columns: 1fr; } }
    @media (max-width: 36rem) { .cu__fields { grid-template-columns: 1fr; } }
  `,
})
export class CreerUgpm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly fields = FIELDS;
  /** PRMP de tutelle = la PRMP connectée (son identifiant = ref du JWT). */
  readonly tutelle = this.auth.ref;

  readonly form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
    idUgpm: ['', Validators.required],
    libelle: [''],
    nomUgpm: ['', Validators.required],
    prenomsUgpm: ['', Validators.required],
    cin: ['', Validators.required],
    dateCin: ['', Validators.required],
    lieuCin: ['', Validators.required],
    emailUgpm: ['', [Validators.required, Validators.email]],
    telUgpm: ['', Validators.required],
  });

  readonly cin = signal<File | null>(null);
  readonly photo = signal<File | null>(null);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('cam');
  private readonly snap = viewChild<ElementRef<HTMLCanvasElement>>('snap');
  private stream: MediaStream | null = null;
  readonly cameraState = signal<'idle' | 'starting' | 'live'>('idle');
  readonly cameraError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly fileError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const v = this.video();
      if (this.cameraState() === 'live' && v && this.stream) {
        v.nativeElement.srcObject = this.stream;
        v.nativeElement.play().catch(() => {});
      }
    });
  }

  ngOnDestroy(): void {
    this.stopStream();
    const p = this.photoPreview();
    if (p) URL.revokeObjectURL(p);
  }

  invalid(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.touched && c.invalid;
  }
  fieldError(key: string): string | undefined {
    return this.fieldErrors()[key];
  }

  onFile(kind: 'cin' | 'photo', ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    const apply = (f: File | null) => {
      (kind === 'cin' ? this.cin : this.photo).set(f);
      if (kind === 'photo') this.setPreview(f);
    };
    if (!file) {
      apply(null);
      return;
    }
    const okTypes = kind === 'photo' ? IMG_OK : TYPES_OK;
    if (!okTypes.includes(file.type)) {
      this.fileError.set('Format non autorisé (PDF, JPEG ou PNG).');
      input.value = '';
      apply(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.fileError.set('Fichier trop volumineux (max 5 Mo).');
      input.value = '';
      apply(null);
      return;
    }
    apply(file);
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    const md = navigator.mediaDevices;
    if (!window.isSecureContext || !md?.getUserMedia) {
      this.cameraError.set(
        "Caméra indisponible ici : ouvrez l'application via https ou http://localhost (l'accès caméra est bloqué sur une adresse IP en http), ou importez un fichier.",
      );
      return;
    }
    this.cameraState.set('starting');
    try {
      this.stream = await md.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.cameraState.set('live');
    } catch (e) {
      this.stream = null;
      this.cameraState.set('idle');
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.cameraError.set('Accès à la caméra refusé — autorisez-le ou importez un fichier.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        this.cameraError.set('Aucune caméra détectée — importez plutôt un fichier.');
      } else {
        this.cameraError.set("Impossible d'ouvrir la caméra — importez plutôt un fichier.");
      }
    }
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
  stopCamera(): void {
    this.stopStream();
    this.cameraState.set('idle');
  }
  capture(): void {
    const v = this.video()?.nativeElement;
    const c = this.snap()?.nativeElement;
    if (!v || !c || !v.videoWidth || !v.videoHeight) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        this.stopCamera();
        this.photo.set(new File([blob], 'photo-capture.jpg', { type: 'image/jpeg' }));
        this.setPreview(this.photo());
      },
      'image/jpeg',
      0.9,
    );
  }
  reprendrePhoto(): void {
    this.clearPhoto();
    void this.startCamera();
  }
  clearPhoto(): void {
    this.photo.set(null);
    this.setPreview(null);
    this.fileError.set(null);
  }
  private setPreview(file: File | null): void {
    const prev = this.photoPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.photoPreview.set(file ? URL.createObjectURL(file) : null);
  }

  /** Réinitialise le formulaire pour créer une autre UGPM. */
  nouvelle(): void {
    this.success.set(false);
    this.form.reset();
    this.stopCamera();
    this.clearPhoto();
    this.cin.set(null);
    this.fieldErrors.set({});
    this.errorMessage.set(null);
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.fileError.set(null);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
    const tutelle = this.tutelle();
    if (!tutelle) {
      this.errorMessage.set('PRMP de tutelle introuvable dans la session.');
      return;
    }
    if (this.form.invalid) {
      return;
    }
    const cin = this.cin();
    if (!cin) {
      this.fileError.set('La CIN est obligatoire.');
      return;
    }
    const raw = this.form.getRawValue();
    const data: RegisterUgpmRequest = {
      ...raw,
      libelle: raw.libelle || undefined,
      idPrmpTutelle: tutelle,
    };
    this.submitting.set(true);
    this.auth.registerUgpm(data, { cin, photo: this.photo() }).subscribe({
      next: (res) => {
        this.success.set(true);
        this.successMessage.set(res.message);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
          this.fieldErrors.set(err.fieldErrors);
        } else {
          this.errorMessage.set(err.message);
        }
      },
    });
  }
}
