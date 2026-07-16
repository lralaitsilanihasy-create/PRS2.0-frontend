import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CreerUgpmRequest, ModifierUgpmRequest, Prmp, Ugpm } from '../../models';
import { CompteAuthService, PrmpService, UgpmService } from '../../services';
import { UgpmPiecesAdmin } from './ugpm-pieces-admin';

/**
 * Administration des UGPM (`/api/ugpms`, ADMINISTRATEUR) : création (POST, avec compte login/mot de
 * passe), **modification** (PUT — champs métier, ni l'id ni le compte) et **suppression** (DELETE —
 * supprime l'UGPM et son compte). La **PRMP de tutelle** est choisie dans `/api/prmps`.
 * L'identifiant d'une UGPM est son **matricule** (`idUgpm`), non modifiable.
 */
@Component({
  selector: 'app-ugpm-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UgpmPiecesAdmin],
  template: `
    <div class="ua-wrap">
    <section class="ua cnm-card">
      <header class="ua__head">
        <h1 class="ua__title">{{ editId() ? 'Modifier l\\'UGPM ' + editId() : 'Créer une UGPM' }}</h1>
        <p class="cnm-muted">
          Une UGPM saisit et corrige les dossiers sous le périmètre de sa PRMP de tutelle ; seule la PRMP
          peut soumettre.
        </p>
      </header>

      <form class="ua__form cnm-form" [formGroup]="form" (ngSubmit)="enregistrer()" novalidate>
        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Matricule (identifiant) *</span>
            <input class="form-control" type="text" formControlName="idUgpm" placeholder="matricule UGPM" [readonly]="editId() !== null" />
            @if (editId()) { <span class="form-hint">Non modifiable (identifiant).</span> }
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
          <!-- Compte : login + mot de passe obligatoires à la création. En modification ils deviennent
               optionnels et servent à réinitialiser le mot de passe (via /api/comptes-auth) — le PUT UGPM
               ne touche pas au compte. Les deux formulaires portent ainsi les mêmes champs. -->
          <label class="form-group">
            <span class="form-label">Login{{ editId() ? '' : ' *' }}</span>
            <input class="form-control" type="text" formControlName="login" autocomplete="off" [readonly]="editId() !== null" />
            @if (editId()) { <span class="form-hint">Login du compte (non modifiable).</span> }
            @if (invalide('login')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Mot de passe{{ editId() ? '' : ' *' }}</span>
            <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password"
              [placeholder]="editId() ? 'nouveau (laisser vide = inchangé)' : ''" />
            @if (invalide('motDePasse')) { <span class="form-error">8 caractères minimum.</span> }
            @if (editId()) {
              <span class="form-hint">Optionnel — saisissez un nouveau mot de passe pour réinitialiser le compte.</span>
            }
          </label>
        </div>

        <!-- Pièces jointes (CIN + photo, pas d'arrêté) : uniquement à la création ; ensuite via l'action
             « Pièces » de chaque ligne. Toutes optionnelles. -->
        @if (!editId()) {
          <fieldset class="ua__pieces">
            <legend class="ua__pieces-legend">Pièces jointes (optionnelles) — PDF, JPEG ou PNG</legend>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">CIN <span class="ua__hint">(≤ 5 Mo)</span></span>
                <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('cin', $event)" />
                @if (cin(); as f) { <span class="form-hint">{{ f.name }}</span> }
              </label>
              <div class="form-group">
                <span class="form-label">Photo <span class="ua__hint">(≤ 5 Mo)</span></span>
                @if (photo(); as f) {
                  <div class="ua__photo-preview">
                    @if (photoPreview(); as src) { <img class="ua__photo-img" [src]="src" alt="Aperçu de la photo" /> }
                    <div class="ua__photo-meta">
                      <span class="form-hint">{{ f.name }}</span>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="reprendrePhoto()">Reprendre</button>
                      <button type="button" class="btn btn-danger btn-sm" (click)="clearPhoto()">Retirer</button>
                    </div>
                  </div>
                } @else if (cameraState() === 'live') {
                  <div class="ua__photo-cam">
                    <video #cam class="ua__photo-video" autoplay playsinline muted></video>
                    <div class="ua__photo-actions">
                      <button type="button" class="btn btn-primary btn-sm" (click)="capture()">Capturer</button>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="stopCamera()">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <div class="ua__photo-choices">
                    <input class="form-control" type="file" accept="image/png,image/jpeg" (change)="onFile('photo', $event)" />
                    <button type="button" class="btn btn-secondary btn-sm" (click)="startCamera()" [disabled]="cameraState() === 'starting'">
                      {{ cameraState() === 'starting' ? 'Ouverture…' : '📷 Prendre une photo' }}
                    </button>
                  </div>
                  @if (cameraError()) { <span class="form-error">{{ cameraError() }}</span> }
                }
                <canvas #snap hidden></canvas>
              </div>
            </div>
            @if (fileError()) { <span class="form-error">{{ fileError() }}</span> }
          </fieldset>
        }

        <footer class="ua__foot">
          @if (editId()) {
            <button type="button" class="btn btn-outline" (click)="nouveau()">Annuler</button>
          }
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Enregistrement…' : editId() ? 'Enregistrer les modifications' : 'Créer l\\'UGPM' }}
          </button>
        </footer>
      </form>

      <h2 class="ua__sub">UGPM existantes ({{ ugpms().length }})</h2>
      @if (ugpms().length) {
        <div class="table-responsive"><table class="cnm-table">
          <thead><tr><th>Matricule</th><th>Responsable</th><th class="col-hide-mobile">Libellé</th><th class="col-hide-mobile">PRMP de tutelle</th><th>Actions</th></tr></thead>
          <tbody>
            @for (u of ugpms(); track u.idUgpm) {
              <tr>
                <td>{{ u.idUgpm }}</td>
                <td>{{ u.nomUgpm }} {{ u.prenomsUgpm }}</td>
                <td class="col-hide-mobile">{{ u.libelle || '—' }}</td>
                <td class="col-hide-mobile">{{ tutelleLabel(u.idPrmpTutelle) }}</td>
                <td>
                  <div class="ua__row-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="voirDetail(u)">Détail</button>
                    <button type="button" class="btn btn-outline btn-sm" (click)="modifier(u)">Modifier</button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="voirPieces(u)">Pièces</button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="demanderSuppression(u)">Supprimer</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      } @else {
        <p class="cnm-muted">Aucune UGPM enregistrée.</p>
      }
    </section>

    @if (detail(); as d) {
      <aside class="ua-detail cnm-card">
        <header class="ua-detail__head">
          <h2 class="ua-detail__title">Détail — {{ d.idUgpm }}</h2>
          <button type="button" class="btn btn-outline btn-sm" (click)="fermerDetail()">Fermer</button>
        </header>
        <div class="ua-detail__photo">
          @if (detailPhoto(); as src) {
            <img class="ua-detail__img" [src]="src" alt="Photo de l'UGPM" />
          } @else {
            <div class="ua-detail__no-photo">{{ detailPhotoLoading() ? 'Chargement…' : 'Aucune photo' }}</div>
          }
        </div>
        <dl class="ua-detail__list">
          <dt>Nom</dt><dd>{{ d.nomUgpm || '—' }}</dd>
          <dt>Prénoms</dt><dd>{{ d.prenomsUgpm || '—' }}</dd>
          <dt>Libellé</dt><dd>{{ d.libelle || '—' }}</dd>
          <dt>PRMP de tutelle</dt><dd>{{ tutelleLabel(d.idPrmpTutelle) }}</dd>
          <dt>CIN</dt><dd>{{ d.cin || '—' }}</dd>
          <dt>Date CIN</dt><dd>{{ d.dateCin || '—' }}</dd>
          <dt>Lieu CIN</dt><dd>{{ d.lieuCin || '—' }}</dd>
          <dt>Email</dt><dd>{{ d.emailUgpm || '—' }}</dd>
          <dt>Téléphone</dt><dd>{{ d.telUgpm || '—' }}</dd>
          <dt>Login</dt><dd>{{ d.login || '—' }}</dd>
        </dl>
      </aside>
    }
    @if (piecesId(); as pid) {
      <app-ugpm-pieces-admin [idUgpm]="pid" (close)="fermerPieces()" />
    }
    </div>

    @if (confirmDelete(); as u) {
      <div class="modal-backdrop" (click)="annulerSuppression()">
        <div class="modal confirm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain"><span class="modal-title">Supprimer l'UGPM</span></div>
          <div class="modal-body">
            Supprimer l'UGPM <strong>{{ u.idUgpm }}</strong> ({{ u.nomUgpm }} {{ u.prenomsUgpm }}) et son compte de connexion ?
            Cette action est irréversible.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerSuppression()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="submitting()" (click)="confirmerSuppression()">Supprimer</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ua-wrap { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .ua-detail { flex: 1 1 26rem; position: sticky; top: 1rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .ua-detail__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .ua-detail__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ua-detail__photo { display: flex; justify-content: center; }
    .ua-detail__img { width: 100%; max-width: 28rem; border-radius: var(--radius-md); border: 1px solid var(--c-100); }
    .ua-detail__no-photo { width: 100%; max-width: 28rem; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--c-100); border-radius: var(--radius-md); color: var(--n-400); font-size: var(--text-md); }
    .ua-detail__list { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.25rem; margin: 0; font-size: var(--text-md); }
    .ua-detail__list dt { color: var(--n-500); font-weight: 600; }
    .ua-detail__list dd { margin: 0; color: var(--c-800); word-break: break-word; }
    .ua-detail__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .ua { flex: 1 1 38rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; max-width: 58rem; }
    .ua__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .ua__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ua__form { display: flex; flex-direction: column; gap: 1rem; }
    .ua__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .ua__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .ua__row-actions { display: flex; gap: 0.4rem; flex-wrap: nowrap; white-space: nowrap; }
    .ua__pieces { border: 1px solid var(--c-100); border-radius: var(--radius-md); padding: 0.75rem 1rem 1rem; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .ua__pieces-legend { font-size: var(--text-sm); font-weight: 600; color: var(--c-800); padding: 0 0.35rem; }
    .ua__hint { font-weight: 400; color: var(--n-400); }
    .ua__photo-choices { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .ua__photo-cam, .ua__photo-preview { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .ua__photo-video, .ua__photo-img { width: 100%; max-width: 12rem; border-radius: var(--radius-sm); border: 1px solid var(--c-100); }
    .ua__photo-video { background: #000; }
    .ua__photo-actions, .ua__photo-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class UgpmAdmin implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly ugpmService = inject(UgpmService);
  private readonly prmpService = inject(PrmpService);
  private readonly compteAuth = inject(CompteAuthService);
  private readonly toast = inject(ToastService);

  readonly prmps = signal<Prmp[]>([]);
  readonly ugpms = signal<Ugpm[]>([]);
  readonly submitting = signal(false);
  /** UGPM en cours d'édition (matricule) ; null = mode création. */
  readonly editId = signal<string | null>(null);
  /** UGPM dont la suppression est en attente de confirmation. */
  readonly confirmDelete = signal<Ugpm | null>(null);
  private readonly prmpMap = computed(() => new Map(this.prmps().map((p) => [p.idPrmp, this.prmpLabel(p)])));

  // Panneaux de droite (mutuellement exclusifs) : détail (fiche + photo) ou pièces (matricule ciblé).
  readonly detail = signal<Ugpm | null>(null);
  readonly detailPhoto = signal<string | null>(null);
  readonly detailPhotoLoading = signal(false);
  readonly piecesId = signal<string | null>(null);

  // Pièces jointes optionnelles à la création (CIN + photo, pas d'arrêté).
  readonly cin = signal<File | null>(null);
  readonly photo = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  private readonly TYPES_OK = ['application/pdf', 'image/jpeg', 'image/png'];
  private readonly IMG_OK = ['image/jpeg', 'image/png'];
  // Capture photo via la caméra (alternative au dépôt de fichier).
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('cam');
  private readonly snap = viewChild<ElementRef<HTMLCanvasElement>>('snap');
  private stream: MediaStream | null = null;
  readonly cameraState = signal<'idle' | 'starting' | 'live'>('idle');
  readonly cameraError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);

  constructor() {
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
    const d = this.detailPhoto();
    if (d) URL.revokeObjectURL(d);
  }

  /** Ouvre le panneau « Pièces » d'une UGPM (ferme le détail). */
  voirPieces(u: Ugpm): void {
    this.fermerDetail();
    this.piecesId.set(u.idUgpm);
  }
  fermerPieces(): void {
    this.piecesId.set(null);
  }

  /** Affiche le détail d'une UGPM (panneau de droite) et charge sa photo (pièce PHOTO). */
  voirDetail(u: Ugpm): void {
    this.piecesId.set(null);
    this.detail.set(u);
    this.setDetailPhoto(null);
    this.detailPhotoLoading.set(true);
    this.ugpmService.downloadPiece(u.idUgpm, 'PHOTO').subscribe({
      next: (blob) => {
        this.setDetailPhoto(URL.createObjectURL(blob));
        this.detailPhotoLoading.set(false);
      },
      error: () => {
        this.setDetailPhoto(null); // 404 = pas de photo
        this.detailPhotoLoading.set(false);
      },
    });
  }
  fermerDetail(): void {
    this.detail.set(null);
    this.setDetailPhoto(null);
    this.detailPhotoLoading.set(false);
  }
  private setDetailPhoto(url: string | null): void {
    const prev = this.detailPhoto();
    if (prev) URL.revokeObjectURL(prev);
    this.detailPhoto.set(url);
  }

  readonly form = this.fb.nonNullable.group({
    idUgpm: ['', Validators.required],
    libelle: [''],
    idPrmpTutelle: ['', Validators.required],
    nomUgpm: ['', Validators.required],
    prenomsUgpm: ['', Validators.required],
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

  onFile(kind: 'cin' | 'photo', ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file) {
      const okTypes = kind === 'photo' ? this.IMG_OK : this.TYPES_OK;
      if (!okTypes.includes(file.type)) {
        this.fileError.set('Format non autorisé (PDF, JPEG ou PNG).');
        input.value = '';
        this.setFile(kind, null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.fileError.set('Fichier trop volumineux (max 5 Mo).');
        input.value = '';
        this.setFile(kind, null);
        return;
      }
    }
    this.setFile(kind, file);
  }
  private setFile(kind: 'cin' | 'photo', file: File | null): void {
    if (kind === 'photo') {
      this.photo.set(file);
      this.setPreview(file);
    } else {
      this.cin.set(file);
    }
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

  /** Repasse en mode création (formulaire vierge, compte requis). */
  nouveau(): void {
    this.editId.set(null);
    this.form.reset();
    this.cin.set(null);
    this.stopCamera();
    this.clearPhoto();
    this.form.controls.login.setValidators([Validators.required]);
    this.form.controls.motDePasse.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.login.updateValueAndValidity();
    this.form.controls.motDePasse.updateValueAndValidity();
  }
  /** Charge une UGPM dans le formulaire pour édition (le compte n'est pas modifiable ici). */
  modifier(u: Ugpm): void {
    this.editId.set(u.idUgpm);
    this.form.reset();
    this.form.patchValue({
      idUgpm: u.idUgpm,
      libelle: u.libelle ?? '',
      idPrmpTutelle: u.idPrmpTutelle,
      nomUgpm: u.nomUgpm,
      prenomsUgpm: u.prenomsUgpm,
      cin: u.cin,
      dateCin: u.dateCin,
      lieuCin: u.lieuCin,
      emailUgpm: u.emailUgpm,
      telUgpm: u.telUgpm,
      // Login exposé par UgpmDto : pré-rempli en lecture seule (cible de la réinitialisation).
      login: u.login ?? '',
    });
    // Compte hors du PUT : login en lecture seule (pré-rempli), mot de passe ≥ 8 s'il est saisi
    // (un nouveau mot de passe ⇒ réinitialisation via /api/comptes-auth).
    this.form.controls.login.clearValidators();
    this.form.controls.motDePasse.setValidators([Validators.minLength(8)]);
    this.form.controls.login.updateValueAndValidity();
    this.form.controls.motDePasse.updateValueAndValidity();
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editId();
    if (id) {
      const nouveauMdp = (v.motDePasse ?? '').trim();
      const loginCompte = (v.login ?? '').trim();
      // Réinitialisation demandée mais login absent : on ne sait pas quel compte cibler.
      if (nouveauMdp && !loginCompte) {
        this.form.controls.login.setErrors({ required: true });
        this.form.controls.login.markAsTouched();
        return;
      }
      const req: ModifierUgpmRequest = {
        libelle: v.libelle || undefined,
        idPrmpTutelle: v.idPrmpTutelle,
        nomUgpm: v.nomUgpm,
        prenomsUgpm: v.prenomsUgpm,
        cin: v.cin,
        dateCin: v.dateCin,
        lieuCin: v.lieuCin,
        emailUgpm: v.emailUgpm,
        telUgpm: v.telUgpm,
      };
      this.submitting.set(true);
      this.ugpmService.modifier(id, req).subscribe({
        next: () => {
          // Compte hors du PUT : si un nouveau mot de passe est fourni, on le réinitialise à part.
          if (nouveauMdp && loginCompte) {
            this.compteAuth
              .reinitialiserMotDePasse(loginCompte, { nouveauMotDePasse: nouveauMdp })
              .subscribe({
                next: () => {
                  this.toast.success(`UGPM « ${id} » modifiée, mot de passe réinitialisé.`);
                  this.finaliserEnregistrement();
                },
                // PUT déjà appliqué ; seul le reset a échoué (ex. login inconnu → 404, toast par l'intercepteur).
                error: (_e: ApiError) => this.submitting.set(false),
              });
          } else {
            this.toast.success(`UGPM « ${id} » modifiée.`);
            this.finaliserEnregistrement();
          }
        },
        error: (_e: ApiError) => this.submitting.set(false),
      });
      return;
    }
    const creation = v as CreerUgpmRequest;
    this.submitting.set(true);
    this.ugpmService.creerAvecPieces(creation, { cin: this.cin(), photo: this.photo() }).subscribe({
      next: () => {
        this.toast.success(`UGPM « ${creation.idUgpm} » créée.`);
        this.finaliserEnregistrement();
      },
      error: (_e: ApiError) => this.submitting.set(false), // message via l'intercepteur (409 : id/login pris, tutelle inconnue)
    });
  }

  /** Fin d'un enregistrement réussi : repasse en mode création et recharge la liste. */
  private finaliserEnregistrement(): void {
    this.submitting.set(false);
    this.nouveau();
    this.charger();
  }

  demanderSuppression(u: Ugpm): void {
    this.confirmDelete.set(u);
  }
  annulerSuppression(): void {
    if (!this.submitting()) {
      this.confirmDelete.set(null);
    }
  }
  confirmerSuppression(): void {
    const u = this.confirmDelete();
    if (!u) {
      return;
    }
    this.submitting.set(true);
    this.ugpmService.delete(u.idUgpm).subscribe({
      next: () => {
        this.toast.success(`UGPM « ${u.idUgpm} » supprimée.`);
        this.submitting.set(false);
        this.confirmDelete.set(null);
        if (this.editId() === u.idUgpm) {
          this.nouveau();
        }
        if (this.detail()?.idUgpm === u.idUgpm) {
          this.fermerDetail();
        }
        if (this.piecesId() === u.idUgpm) {
          this.fermerPieces();
        }
        this.charger();
      },
      error: (_e: ApiError) => {
        this.submitting.set(false);
        this.confirmDelete.set(null);
      },
    });
  }
}
