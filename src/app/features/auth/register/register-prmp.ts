import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/errors/api-error';
import { EntitePubliqueDto, RegisterPrmpV2Request } from '../../../models';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'date';
}

/** Champs d'identité de l'inscription PRMP, dans l'ordre du formulaire (tous obligatoires côté API). */
const FIELDS: FieldDef[] = [
  { key: 'login', label: 'Identifiant de connexion', type: 'text' },
  { key: 'motDePasse', label: 'Mot de passe (min. 8 caractères)', type: 'password' },
  { key: 'idPrmp', label: 'Matricule (identifiant)', type: 'text' },
  { key: 'nomPrmp', label: 'Nom', type: 'text' },
  { key: 'prenomsPrmp', label: 'Prénoms', type: 'text' },
  { key: 'arreteNomin', label: 'Arrêté de nomination (référence)', type: 'text' },
  { key: 'dateNomin', label: 'Date de nomination', type: 'date' },
  { key: 'cin', label: 'CIN', type: 'text' },
  { key: 'dateCin', label: 'Date du CIN', type: 'date' },
  { key: 'lieuCin', label: 'Lieu du CIN', type: 'text' },
  { key: 'emailPrmp', label: 'Email', type: 'email' },
  { key: 'telPrmp', label: 'Téléphone', type: 'text' },
];

type EntiteMode = 'existante' | 'proposee';
interface EntiteDecl {
  mode: EntiteMode;
  idEntite: number | null;
  libelle: string;
  adresse: string;
  idLocalite: string;
  categorie: string;
}
const newDecl = (): EntiteDecl => ({
  mode: 'existante',
  idEntite: null,
  libelle: '',
  adresse: '',
  idLocalite: '',
  categorie: '',
});

const TYPES_OK = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Inscription publique d'une PRMP — version 2 (multipart) : identité + déclaration
 * d'entités (existantes et/ou proposées) + pièces (arrêté & CIN obligatoires, photo
 * optionnelle). Crée un compte EN_ATTENTE : la connexion reste refusée tant que
 * l'Administrateur n'a pas validé (§3.1). Erreurs gérées en place (400 par champ, 409 doublon).
 */
@Component({
  selector: 'app-register-prmp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="register-page">
      <div class="register-card cnm-card">
        <h1 class="register-card__title">Inscription PRMP</h1>
        <p class="register-card__subtitle">
          Personne Responsable des Marchés Publics — création de compte
        </p>

        @if (success()) {
          <div class="register-card__success" role="status">
            <span class="badge badge-warning">En attente de validation</span>
            <p>{{ successMessage() }}</p>
            <p class="cnm-muted">
              Votre compte ne sera utilisable qu'une fois <strong>validé par l'Administrateur</strong> :
              la connexion reste refusée jusque-là.
            </p>
            <a class="btn btn-primary register-card__back" routerLink="/login">
              Retour à la connexion
            </a>
          </div>
        } @else {
          @if (errorMessage()) {
            <div class="register-card__error" role="alert">{{ errorMessage() }}</div>
          }

          <form class="register-card__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="reg-main">
              <section class="reg-section">
                <h2 class="reg-section__title">Identifiants &amp; identité</h2>
                <div class="reg-id__grid">
                  @for (f of fields; track f.key) {
                    <label class="form-group">
                      <span class="form-label">{{ f.label }}</span>
                      <input
                        class="form-control"
                        [type]="f.type"
                        [formControlName]="f.key"
                        [class.error]="invalid(f.key)"
                      />
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

              <div class="reg-side">
                <section class="reg-section">
                  <h2 class="reg-section__title">Pièces jointes</h2>
                  <p class="cnm-muted reg-files__note">PDF, JPEG ou PNG.</p>
                  <label class="form-group">
                    <span class="form-label">Arrêté de nomination * (≤ 10 Mo)</span>
                    <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('arrete', $event)" />
                    @if (arrete(); as f) { <span class="form-hint">{{ f.name }}</span> }
                  </label>
                  <label class="form-group">
                    <span class="form-label">CIN * (≤ 5 Mo)</span>
                    <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('cin', $event)" />
                    @if (cin(); as f) { <span class="form-hint">{{ f.name }}</span> }
                  </label>
                  <div class="form-group">
                    <span class="form-label">Photo (optionnelle, ≤ 5 Mo)</span>
                    @if (photo(); as f) {
                      <div class="reg-photo__preview">
                        @if (photoPreview(); as src) { <img class="reg-photo__img" [src]="src" alt="Aperçu de la photo" /> }
                        <div class="reg-photo__meta">
                          <span class="form-hint">{{ f.name }}</span>
                          <button type="button" class="btn btn-secondary btn-sm" (click)="reprendrePhoto()">Reprendre</button>
                          <button type="button" class="btn btn-danger btn-sm" (click)="clearPhoto()">Retirer</button>
                        </div>
                      </div>
                    } @else if (cameraState() === 'live') {
                      <div class="reg-photo__cam">
                        <video #cam class="reg-photo__video" autoplay playsinline muted></video>
                        <div class="reg-photo__actions">
                          <button type="button" class="cnm-btn cnm-btn--primary cnm-btn--sm" (click)="capture()">Capturer</button>
                          <button type="button" class="btn btn-secondary btn-sm" (click)="stopCamera()">Annuler</button>
                        </div>
                      </div>
                    } @else {
                      <div class="reg-photo__choices">
                        <input class="form-control" type="file" accept="image/png,image/jpeg" (change)="onFile('photo', $event)" />
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          (click)="startCamera()"
                          [disabled]="cameraState() === 'starting'"
                        >
                          {{ cameraState() === 'starting' ? 'Ouverture…' : '📷 Prendre une photo' }}
                        </button>
                      </div>
                      @if (cameraError()) { <span class="form-error">{{ cameraError() }}</span> }
                    }
                    <canvas #snap hidden></canvas>
                  </div>
                  @if (fileError()) { <span class="form-error">{{ fileError() }}</span> }
                </section>

                <section class="reg-section reg-entites">
                  <div class="reg-section__head">
                    <h2 class="reg-section__title">Entités</h2>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="addDecl()">+ Ajouter</button>
                  </div>
                  <div class="reg-entites__list">
                    @for (d of declarations(); track $index; let i = $index) {
                      <div class="reg-entite">
                        <div class="reg-entite__row">
                          <select class="form-control" [value]="d.mode" (change)="setMode(i, $any($event.target).value)">
                            <option value="existante">Entité de la liste</option>
                            <option value="proposee">Entité non listée (à proposer)</option>
                          </select>
                          @if (declarations().length > 1) {
                            <button type="button" class="btn btn-danger btn-sm" (click)="removeDecl(i)">Retirer</button>
                          }
                        </div>

                        @if (d.mode === 'existante') {
                          <select
                            class="form-control"
                            [value]="d.idEntite ?? ''"
                            (change)="updateDecl(i, { idEntite: toNum($any($event.target).value) })"
                          >
                            <option value="">— Choisir une entité —</option>
                            @for (e of entites(); track e.idEntiteContract) {
                              <option [value]="e.idEntiteContract">
                                {{ e.libelleEntite }}{{ e.idLocalite ? ' · ' + e.idLocalite : '' }}
                              </option>
                            }
                          </select>
                          @if (!entites().length) {
                            <span class="form-hint">Aucune entité — proposez-en une.</span>
                          }
                        } @else {
                          <div class="reg-entite__grid">
                            <label class="form-group">
                              <span class="form-label">Libellé *</span>
                              <input class="form-control" [value]="d.libelle" (input)="updateDecl(i, { libelle: $any($event.target).value })" />
                            </label>
                            <label class="form-group">
                              <span class="form-label">Code localité *</span>
                              <input class="form-control" maxlength="5" [value]="d.idLocalite" (input)="updateDecl(i, { idLocalite: $any($event.target).value })" />
                            </label>
                            <label class="form-group">
                              <span class="form-label">Adresse</span>
                              <input class="form-control" [value]="d.adresse" (input)="updateDecl(i, { adresse: $any($event.target).value })" />
                            </label>
                            <label class="form-group">
                              <span class="form-label">Catégorie</span>
                              <input class="form-control" [value]="d.categorie" (input)="updateDecl(i, { categorie: $any($event.target).value })" />
                            </label>
                          </div>
                          <span class="form-hint">Proposition validée par l'Administrateur.</span>
                        }
                      </div>
                    }
                  </div>
                  @if (entitesError()) { <span class="form-error">{{ entitesError() }}</span> }
                </section>
              </div>
            </div>

            <div class="reg-footer">
              <button type="submit" class="btn btn-primary register-card__submit" [disabled]="submitting()">
                {{ submitting() ? 'Envoi…' : "S'inscrire" }}
              </button>
              <a class="register-card__login-link" routerLink="/login">Déjà un compte ? Se connecter</a>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .register-page {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cnm-space-4);
      background: var(--cnm-bg);
    }
    .register-card {
      width: 100%;
      max-width: min(72rem, 96vw);
      padding: var(--cnm-space-4) var(--cnm-space-5);
      box-shadow: var(--cnm-shadow);
      max-height: 96vh;
      overflow: auto;
    }
    .register-card__title { margin: 0; font-size: var(--cnm-fs-lg); }
    .register-card__subtitle {
      margin: 2px 0 var(--cnm-space-3);
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
    }
    .register-card__form { display: flex; flex-direction: column; gap: var(--cnm-space-3); }

    /* Disposition 2 colonnes : identité (large) | pièces + entités (latérale) */
    .reg-main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--cnm-space-4); align-items: start; }
    .reg-side { display: flex; flex-direction: column; gap: var(--cnm-space-3); min-width: 0; }
    .reg-id__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--cnm-space-2) var(--cnm-space-3); }

    .reg-section { display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .reg-section__head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-2); }
    .reg-section__title { margin: 0; font-size: var(--cnm-fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--cnm-text-2); font-weight: var(--cnm-fw-semibold); }

    /* Entités : seule cette zone défile si la liste est longue */
    .reg-entites__list { display: flex; flex-direction: column; gap: var(--cnm-space-2); max-height: 13rem; overflow: auto; padding-right: 4px; }
    .reg-entite {
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-2);
      padding: var(--cnm-space-2) var(--cnm-space-3);
      background: var(--cnm-surface-2);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius-sm);
    }
    .reg-entite__row { display: flex; gap: var(--cnm-space-2); align-items: center; }
    .reg-entite__row .form-control { flex: 1; }
    .reg-entite__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cnm-space-2); }

    .reg-files__note { font-size: var(--cnm-fs-xs); margin: 0; }
    .reg-photo__choices { display: flex; gap: var(--cnm-space-2); align-items: center; flex-wrap: wrap; }
    .reg-photo__cam, .reg-photo__preview { display: flex; flex-direction: column; gap: var(--cnm-space-2); align-items: flex-start; }
    .reg-photo__video, .reg-photo__img { width: 100%; max-width: 14rem; border-radius: var(--cnm-radius-sm); border: 1px solid var(--cnm-border); }
    .reg-photo__video { background: #000; }
    .reg-photo__img { background: var(--cnm-surface-2); }
    .reg-photo__actions, .reg-photo__meta { display: flex; gap: var(--cnm-space-2); align-items: center; flex-wrap: wrap; }

    /* Pied : action + lien, pleine largeur */
    .reg-footer { display: flex; align-items: center; gap: var(--cnm-space-4); border-top: 1px solid var(--cnm-border); padding-top: var(--cnm-space-3); }
    .register-card__submit { min-width: 12rem; }
    .register-card__login-link { font-size: var(--cnm-fs-sm); }

    /* Champs resserrés (scopé à la carte) */
    .register-card .form-control { padding: 0.32rem 0.5rem; }
    .register-card .form-group { gap: 2px; margin-bottom: 0; }
    .register-card .form-label { font-size: var(--cnm-fs-xs); }

    .register-card__error {
      background: var(--cnm-danger-bg);
      color: var(--cnm-danger-fg);
      border: 1px solid rgba(252, 129, 129, 0.4);
      border-radius: var(--cnm-radius-sm);
      padding: var(--cnm-space-2) var(--cnm-space-3);
      font-size: var(--cnm-fs-sm);
      margin-bottom: var(--cnm-space-2);
    }
    .register-card__success {
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-3);
      align-items: flex-start;
    }

    /* Responsive : sur petit écran, on repasse en colonnes et on autorise le scroll page */
    @media (max-width: 60rem) {
      .reg-main { grid-template-columns: 1fr; }
      .reg-id__grid { grid-template-columns: 1fr 1fr; }
      .register-card { max-height: none; }
    }
    @media (max-width: 36rem) {
      .reg-id__grid { grid-template-columns: 1fr; }
      .reg-entite__grid { grid-template-columns: 1fr; }
    }
  `,
})
export class RegisterPrmp implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  protected readonly fields = FIELDS;
  readonly form = this.fb.nonNullable.group(
    FIELDS.reduce<Record<string, unknown>>((g, f) => {
      g[f.key] = ['', f.key === 'motDePasse' ? [Validators.required, Validators.minLength(8)] : [Validators.required]];
      return g;
    }, {}),
  );

  readonly entites = signal<EntitePubliqueDto[]>([]);
  readonly declarations = signal<EntiteDecl[]>([newDecl()]);
  readonly arrete = signal<File | null>(null);
  readonly cin = signal<File | null>(null);
  readonly photo = signal<File | null>(null);

  // Capture photo via la caméra (alternative au dépôt de fichier).
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
  readonly entitesError = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  constructor() {
    this.auth.entitesPubliques().subscribe({ next: (e) => this.entites.set(e), error: () => {} });
    // Rattache le flux caméra au <video> dès qu'il est rendu.
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
        this.setPhotoFile(new File([blob], 'photo-capture.jpg', { type: 'image/jpeg' }));
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

  /** Valide (type/taille) puis applique une photo issue de la caméra. */
  private setPhotoFile(file: File): void {
    if (!TYPES_OK.includes(file.type)) {
      this.fileError.set('Format non autorisé (PDF, JPEG ou PNG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.fileError.set('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    this.fileError.set(null);
    this.photo.set(file);
    this.setPreview(file);
  }
  private setPreview(file: File | null): void {
    const prev = this.photoPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.photoPreview.set(file ? URL.createObjectURL(file) : null);
  }

  invalid(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.touched && c.invalid;
  }
  fieldError(key: string): string | undefined {
    return this.fieldErrors()[key];
  }
  toNum(v: string): number | null {
    return v ? Number(v) : null;
  }

  addDecl(): void {
    this.declarations.update((a) => [...a, newDecl()]);
  }
  removeDecl(i: number): void {
    this.declarations.update((a) => a.filter((_, j) => j !== i));
  }
  setMode(i: number, mode: EntiteMode): void {
    this.updateDecl(i, { mode });
  }
  updateDecl(i: number, patch: Partial<EntiteDecl>): void {
    this.declarations.update((a) => a.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  private sig(kind: 'arrete' | 'cin' | 'photo') {
    return kind === 'arrete' ? this.arrete : kind === 'cin' ? this.cin : this.photo;
  }
  onFile(kind: 'arrete' | 'cin' | 'photo', ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    const apply = (f: File | null) => {
      this.sig(kind).set(f);
      if (kind === 'photo') this.setPreview(f);
    };
    if (!file) {
      apply(null);
      return;
    }
    const maxMo = kind === 'arrete' ? 10 : 5;
    if (!TYPES_OK.includes(file.type)) {
      this.fileError.set('Format non autorisé (PDF, JPEG ou PNG).');
      input.value = '';
      apply(null);
      return;
    }
    if (file.size > maxMo * 1024 * 1024) {
      this.fileError.set(`Fichier trop volumineux (max ${maxMo} Mo).`);
      input.value = '';
      apply(null);
      return;
    }
    apply(file);
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.entitesError.set(null);
    this.fileError.set(null);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
    if (this.form.invalid) {
      return;
    }

    const idEntites = this.declarations()
      .filter((d) => d.mode === 'existante' && d.idEntite != null)
      .map((d) => d.idEntite as number);
    const entitesNonListees = this.declarations()
      .filter((d) => d.mode === 'proposee' && d.libelle.trim() && d.idLocalite.trim())
      .map((d) => ({
        libelle: d.libelle.trim(),
        adresse: d.adresse.trim() || undefined,
        idLocalite: d.idLocalite.trim(),
        categorie: d.categorie.trim() || undefined,
      }));
    if (idEntites.length + entitesNonListees.length === 0) {
      this.entitesError.set('Déclarez au moins une entité (existante ou proposée, avec libellé et code localité).');
      return;
    }

    const arrete = this.arrete();
    const cin = this.cin();
    if (!arrete || !cin) {
      this.fileError.set("L'arrêté de nomination et la CIN sont obligatoires.");
      return;
    }

    const data = { ...this.form.getRawValue(), idEntites, entitesNonListees } as unknown as RegisterPrmpV2Request;
    this.submitting.set(true);
    this.auth.registerPrmpV2(data, { arrete, cin, photo: this.photo() }).subscribe({
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
