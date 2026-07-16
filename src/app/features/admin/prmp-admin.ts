import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { CreerPrmpRequest, Prmp } from '../../models';
import { CompteAuthService, PrmpService } from '../../services';
import { PrmpPiecesAdmin } from './prmp-pieces-admin';

/**
 * Administration des PRMP (`/api/prmps`, ADMINISTRATEUR) : création (fiche **+ compte** login/mot de
 * passe, parité UGPM), modification (PUT — champs métier, ni matricule ni compte), réinitialisation
 * du mot de passe (via `/api/comptes-auth`), suppression (garde métier → 409), et accès aux entités
 * rattachées et aux pièces jointes. Recherche serveur par nom (`/par-nom/{nom}`).
 * Le matricule (`idPrmp`) est l'identifiant, non modifiable.
 */
@Component({
  selector: 'app-prmp-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PrmpPiecesAdmin],
  template: `
    <div class="pa-wrap">
    <section class="pa cnm-card">
      <header class="pa__head">
        <h1 class="pa__title">{{ editId() ? 'Modifier la PRMP ' + editId() : 'Créer une PRMP' }}</h1>
        <p class="cnm-muted">
          Personne Responsable des Marchés Publics. À la création, le compte de connexion (login + mot de
          passe) est créé avec la fiche : la PRMP peut se connecter immédiatement.
        </p>
      </header>

      <form class="pa__form cnm-form" [formGroup]="form" (ngSubmit)="enregistrer()" novalidate>
        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Matricule (identifiant) *</span>
            <input class="form-control" type="text" formControlName="idPrmp" placeholder="matricule PRMP" [readonly]="editId() !== null" />
            @if (editId()) { <span class="form-hint">Non modifiable (identifiant).</span> }
            @if (invalide('idPrmp')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Nom *</span>
            <input class="form-control" type="text" formControlName="nomPrmp" />
            @if (invalide('nomPrmp')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Prénoms *</span>
            <input class="form-control" type="text" formControlName="prenomsPrmp" />
            @if (invalide('prenomsPrmp')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Arrêté de nomination (référence) *</span>
            <input class="form-control" type="text" formControlName="arreteNomin" />
            @if (invalide('arreteNomin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Date de nomination *</span>
            <input class="form-control" type="date" formControlName="dateNomin" />
            @if (invalide('dateNomin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">CIN *</span>
            <input class="form-control" type="text" formControlName="cin" />
            @if (invalide('cin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Date du CIN *</span>
            <input class="form-control" type="date" formControlName="dateCin" />
            @if (invalide('dateCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Lieu du CIN *</span>
            <input class="form-control" type="text" formControlName="lieuCin" />
            @if (invalide('lieuCin')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Email *</span>
            <input class="form-control" type="email" formControlName="emailPrmp" autocomplete="off" />
            @if (invalide('emailPrmp')) { <span class="form-error">Email valide obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Téléphone *</span>
            <input class="form-control" type="text" formControlName="telPrmp" />
            @if (invalide('telPrmp')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <!-- Compte : login + mot de passe obligatoires à la création (parité UGPM). En modification ils
               deviennent optionnels et servent à réinitialiser le mot de passe (via /api/comptes-auth). -->
          <label class="form-group">
            <span class="form-label">Login{{ editId() ? '' : ' *' }}</span>
            <input class="form-control" type="text" formControlName="login" autocomplete="off"
              [placeholder]="editId() ? 'login du compte (pour réinitialiser)' : ''" />
            @if (invalide('login')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Mot de passe{{ editId() ? '' : ' *' }}</span>
            <input class="form-control" type="password" formControlName="motDePasse" autocomplete="new-password"
              [placeholder]="editId() ? 'nouveau (laisser vide = inchangé)' : ''" />
            @if (invalide('motDePasse')) { <span class="form-error">8 caractères minimum.</span> }
            @if (editId()) {
              <span class="form-hint">Optionnel — renseignez le login du compte + le nouveau mot de passe pour le réinitialiser.</span>
            }
          </label>
        </div>

        <!-- Pièces jointes : uniquement à la création (comme l'inscription) ; en modification, elles se
             gèrent via l'action « Pièces » de chaque ligne. Toutes optionnelles. -->
        @if (!editId()) {
          <fieldset class="pa__pieces">
            <legend class="pa__pieces-legend">Pièces jointes (optionnelles) — PDF, JPEG ou PNG</legend>
            <div class="cnm-form-grid">
              <label class="form-group">
                <span class="form-label">Arrêté de nomination <span class="pa__hint">(≤ 10 Mo)</span></span>
                <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('arrete', $event)" />
                @if (arrete(); as f) { <span class="form-hint">{{ f.name }}</span> }
              </label>
              <label class="form-group">
                <span class="form-label">CIN <span class="pa__hint">(≤ 5 Mo)</span></span>
                <input class="form-control" type="file" accept=".pdf,image/png,image/jpeg" (change)="onFile('cin', $event)" />
                @if (cin(); as f) { <span class="form-hint">{{ f.name }}</span> }
              </label>
              <div class="form-group">
                <span class="form-label">Photo <span class="pa__hint">(≤ 5 Mo)</span></span>
                @if (photo(); as f) {
                  <div class="pa__photo-preview">
                    @if (photoPreview(); as src) { <img class="pa__photo-img" [src]="src" alt="Aperçu de la photo" /> }
                    <div class="pa__photo-meta">
                      <span class="form-hint">{{ f.name }}</span>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="reprendrePhoto()">Reprendre</button>
                      <button type="button" class="btn btn-danger btn-sm" (click)="clearPhoto()">Retirer</button>
                    </div>
                  </div>
                } @else if (cameraState() === 'live') {
                  <div class="pa__photo-cam">
                    <video #cam class="pa__photo-video" autoplay playsinline muted></video>
                    <div class="pa__photo-actions">
                      <button type="button" class="btn btn-primary btn-sm" (click)="capture()">Capturer</button>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="stopCamera()">Annuler</button>
                    </div>
                  </div>
                } @else {
                  <div class="pa__photo-choices">
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

        <footer class="pa__foot">
          @if (editId()) {
            <button type="button" class="btn btn-outline" (click)="nouveau()">Annuler</button>
          }
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Enregistrement…' : editId() ? 'Enregistrer les modifications' : 'Créer la PRMP' }}
          </button>
        </footer>
      </form>

      <div class="pa__sub-row">
        <h2 class="pa__sub">PRMP existantes ({{ prmps().length }})</h2>
        <input class="form-control pa__search" type="search" placeholder="Rechercher par nom…" (input)="onSearch($any($event.target).value)" />
      </div>
      @if (prmps().length) {
        <div class="table-responsive"><table class="cnm-table">
          <thead><tr><th>Matricule</th><th>Nom &amp; prénoms</th><th class="col-hide-mobile">Email</th><th class="col-hide-mobile">Téléphone</th><th>Actions</th></tr></thead>
          <tbody>
            @for (p of prmps(); track p.idPrmp) {
              <tr>
                <td>{{ p.idPrmp }}</td>
                <td>{{ p.nomPrmp }} {{ p.prenomsPrmp }}</td>
                <td class="col-hide-mobile">{{ p.emailPrmp }}</td>
                <td class="col-hide-mobile">{{ p.telPrmp }}</td>
                <td>
                  <div class="pa__row-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="voirDetail(p)">Détail</button>
                    <button type="button" class="btn btn-outline btn-sm" (click)="modifier(p)">Modifier</button>
                    <a class="btn btn-secondary btn-sm" routerLink="/admin/comptes/prmp-entites" [queryParams]="{ prmp: p.idPrmp }">Entités</a>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="voirPieces(p)">Pièces</button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="demanderSuppression(p)">Supprimer</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      } @else {
        <p class="cnm-muted">Aucune PRMP.</p>
      }
    </section>

    @if (detail(); as d) {
      <aside class="pa-detail cnm-card">
        <header class="pa-detail__head">
          <h2 class="pa-detail__title">Détail — {{ d.idPrmp }}</h2>
          <button type="button" class="btn btn-outline btn-sm" (click)="fermerDetail()">Fermer</button>
        </header>
        <div class="pa-detail__photo">
          @if (detailPhoto(); as src) {
            <img class="pa-detail__img" [src]="src" alt="Photo de la PRMP" />
          } @else {
            <div class="pa-detail__no-photo">{{ detailPhotoLoading() ? 'Chargement…' : 'Aucune photo' }}</div>
          }
        </div>
        <dl class="pa-detail__list">
          <dt>Nom</dt><dd>{{ d.nomPrmp || '—' }}</dd>
          <dt>Prénoms</dt><dd>{{ d.prenomsPrmp || '—' }}</dd>
          <dt>Arrêté</dt><dd>{{ d.arreteNomin || '—' }}</dd>
          <dt>Date nomination</dt><dd>{{ d.dateNomin || '—' }}</dd>
          <dt>CIN</dt><dd>{{ d.cin || '—' }}</dd>
          <dt>Date CIN</dt><dd>{{ d.dateCin || '—' }}</dd>
          <dt>Lieu CIN</dt><dd>{{ d.lieuCin || '—' }}</dd>
          <dt>Email</dt><dd>{{ d.emailPrmp || '—' }}</dd>
          <dt>Téléphone</dt><dd>{{ d.telPrmp || '—' }}</dd>
        </dl>
      </aside>
    }
    @if (piecesId(); as pid) {
      <app-prmp-pieces-admin [idPrmp]="pid" (close)="fermerPieces()" />
    }
    </div>

    @if (confirmDelete(); as p) {
      <div class="modal-backdrop" (click)="annulerSuppression()">
        <div class="modal confirm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain"><span class="modal-title">Supprimer la PRMP</span></div>
          <div class="modal-body">
            Supprimer la PRMP <strong>{{ p.idPrmp }}</strong> ({{ p.nomPrmp }} {{ p.prenomsPrmp }}) et son compte ?
            Refusé (409) si elle porte des données liées (dossiers, PPM, entités, UGPM…). Action irréversible.
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
    .pa-wrap { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .pa { flex: 1 1 38rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; max-width: 58rem; }
    .pa-detail { flex: 1 1 26rem; position: sticky; top: 1rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .pa-detail__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .pa-detail__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .pa-detail__photo { display: flex; justify-content: center; }
    .pa-detail__img { width: 100%; max-width: 28rem; border-radius: var(--radius-md); border: 1px solid var(--c-100); }
    .pa-detail__no-photo { width: 100%; max-width: 28rem; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--c-100); border-radius: var(--radius-md); color: var(--n-400); font-size: var(--text-md); }
    .pa-detail__list { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.25rem; margin: 0; font-size: var(--text-md); }
    .pa-detail__list dt { color: var(--n-500); font-weight: 600; }
    .pa-detail__list dd { margin: 0; color: var(--c-800); word-break: break-word; }
    .pa-detail__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .pa__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .pa__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .pa__form { display: flex; flex-direction: column; gap: 1rem; }
    .pa__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .pa__sub-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .pa__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .pa__search { min-width: 16rem; max-width: 22rem; }
    .pa__row-actions { display: flex; gap: 0.4rem; flex-wrap: nowrap; white-space: nowrap; }
    .pa__pieces { border: 1px solid var(--c-100); border-radius: var(--radius-md); padding: 0.75rem 1rem 1rem; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .pa__pieces-legend { font-size: var(--text-sm); font-weight: 600; color: var(--c-800); padding: 0 0.35rem; }
    .pa__hint { font-weight: 400; color: var(--n-400); }
    .pa__photo-choices { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .pa__photo-cam, .pa__photo-preview { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .pa__photo-video, .pa__photo-img { width: 100%; max-width: 12rem; border-radius: var(--radius-sm); border: 1px solid var(--c-100); }
    .pa__photo-video { background: #000; }
    .pa__photo-actions, .pa__photo-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class PrmpAdmin implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly prmpService = inject(PrmpService);
  private readonly compteAuth = inject(CompteAuthService);
  private readonly toast = inject(ToastService);

  readonly prmps = signal<Prmp[]>([]);
  readonly submitting = signal(false);
  /** PRMP en cours d'édition (matricule) ; null = mode création. */
  readonly editId = signal<string | null>(null);
  /** PRMP dont la suppression est en attente de confirmation. */
  readonly confirmDelete = signal<Prmp | null>(null);
  private readonly search$ = new Subject<string>();

  // Panneaux de droite (mutuellement exclusifs) : détail (fiche + photo) ou pièces (matricule ciblé).
  readonly detail = signal<Prmp | null>(null);
  readonly detailPhoto = signal<string | null>(null);
  readonly detailPhotoLoading = signal(false);
  readonly piecesId = signal<string | null>(null);

  // Pièces jointes optionnelles à la création (déposées avec la fiche via multipart).
  readonly arrete = signal<File | null>(null);
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

  readonly form = this.fb.nonNullable.group({
    idPrmp: ['', Validators.required],
    nomPrmp: ['', Validators.required],
    prenomsPrmp: ['', Validators.required],
    arreteNomin: ['', Validators.required],
    dateNomin: ['', Validators.required],
    cin: ['', Validators.required],
    dateCin: ['', Validators.required],
    lieuCin: ['', Validators.required],
    emailPrmp: ['', [Validators.required, Validators.email]],
    telPrmp: ['', Validators.required],
    login: ['', Validators.required],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => this.runSearch(term));
    // Rattache le flux caméra au <video> dès qu'il est rendu.
    effect(() => {
      const v = this.video();
      if (this.cameraState() === 'live' && v && this.stream) {
        v.nativeElement.srcObject = this.stream;
        v.nativeElement.play().catch(() => {});
      }
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  ngOnDestroy(): void {
    this.stopStream();
    const p = this.photoPreview();
    if (p) URL.revokeObjectURL(p);
    const d = this.detailPhoto();
    if (d) URL.revokeObjectURL(d);
  }
  private charger(): void {
    this.prmpService.list().subscribe((r) => this.prmps.set(r));
  }

  /** Ouvre le panneau « Pièces » d'une PRMP (ferme le détail). */
  voirPieces(p: Prmp): void {
    this.fermerDetail();
    this.piecesId.set(p.idPrmp);
  }
  fermerPieces(): void {
    this.piecesId.set(null);
  }

  /** Affiche le détail d'une PRMP (panneau de droite) et charge sa photo (pièce PHOTO). */
  voirDetail(p: Prmp): void {
    this.piecesId.set(null);
    this.detail.set(p);
    this.setDetailPhoto(null);
    this.detailPhotoLoading.set(true);
    this.prmpService.downloadPiece(p.idPrmp, 'PHOTO').subscribe({
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

  onSearch(term: string): void {
    this.search$.next(term);
  }
  private runSearch(term: string): void {
    const t = term.trim();
    if (!t) {
      this.charger();
      return;
    }
    this.prmpService.searchByName(t).subscribe({ next: (r) => this.prmps.set(r), error: () => {} });
  }

  invalide(champ: string): boolean {
    const c = this.form.get(champ)!;
    return c.invalid && (c.touched || c.dirty);
  }

  onFile(kind: 'arrete' | 'cin' | 'photo', ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file) {
      const okTypes = kind === 'photo' ? this.IMG_OK : this.TYPES_OK;
      const maxMo = kind === 'arrete' ? 10 : 5;
      if (!okTypes.includes(file.type)) {
        this.fileError.set('Format non autorisé (PDF, JPEG ou PNG).');
        input.value = '';
        this.setFile(kind, null);
        return;
      }
      if (file.size > maxMo * 1024 * 1024) {
        this.fileError.set(`Fichier trop volumineux (max ${maxMo} Mo).`);
        input.value = '';
        this.setFile(kind, null);
        return;
      }
    }
    this.setFile(kind, file);
  }
  private setFile(kind: 'arrete' | 'cin' | 'photo', file: File | null): void {
    if (kind === 'photo') {
      this.photo.set(file);
      this.setPreview(file);
    } else {
      (kind === 'arrete' ? this.arrete : this.cin).set(file);
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
    this.arrete.set(null);
    this.cin.set(null);
    this.stopCamera();
    this.clearPhoto();
    this.form.controls.login.setValidators([Validators.required]);
    this.form.controls.motDePasse.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.login.updateValueAndValidity();
    this.form.controls.motDePasse.updateValueAndValidity();
  }

  /** Charge une PRMP pour édition (compte non modifiable ici, hors réinitialisation du mot de passe). */
  modifier(p: Prmp): void {
    this.editId.set(p.idPrmp);
    this.form.reset();
    this.form.patchValue({
      idPrmp: p.idPrmp,
      nomPrmp: p.nomPrmp,
      prenomsPrmp: p.prenomsPrmp,
      arreteNomin: p.arreteNomin,
      dateNomin: p.dateNomin,
      cin: p.cin,
      dateCin: p.dateCin,
      lieuCin: p.lieuCin,
      emailPrmp: p.emailPrmp,
      telPrmp: p.telPrmp,
    });
    // Compte hors du PUT : login sans contrainte, mot de passe ≥ 8 s'il est saisi.
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
      if (nouveauMdp && !loginCompte) {
        this.form.controls.login.setErrors({ required: true });
        this.form.controls.login.markAsTouched();
        return;
      }
      const body: Prmp = {
        idPrmp: id,
        nomPrmp: v.nomPrmp,
        prenomsPrmp: v.prenomsPrmp,
        arreteNomin: v.arreteNomin,
        dateNomin: v.dateNomin,
        cin: v.cin,
        dateCin: v.dateCin,
        lieuCin: v.lieuCin,
        emailPrmp: v.emailPrmp,
        telPrmp: v.telPrmp,
      };
      this.submitting.set(true);
      this.prmpService.update(id, body).subscribe({
        next: () => {
          if (nouveauMdp && loginCompte) {
            this.compteAuth
              .reinitialiserMotDePasse(loginCompte, { nouveauMotDePasse: nouveauMdp })
              .subscribe({
                next: () => {
                  this.toast.success(`PRMP « ${id} » modifiée, mot de passe réinitialisé.`);
                  this.finaliser();
                },
                error: (_e: ApiError) => this.submitting.set(false),
              });
          } else {
            this.toast.success(`PRMP « ${id} » modifiée.`);
            this.finaliser();
          }
        },
        error: (_e: ApiError) => this.submitting.set(false),
      });
      return;
    }
    const req: CreerPrmpRequest = { ...(v as CreerPrmpRequest) };
    this.submitting.set(true);
    this.prmpService
      .creerAvecPieces(req, { arrete: this.arrete(), cin: this.cin(), photo: this.photo() })
      .subscribe({
        next: () => {
          this.toast.success(`PRMP « ${req.idPrmp} » créée avec son compte.`);
          this.finaliser();
        },
        error: (_e: ApiError) => this.submitting.set(false), // message via l'intercepteur (409 : matricule/login pris)
      });
  }

  demanderSuppression(p: Prmp): void {
    this.confirmDelete.set(p);
  }
  annulerSuppression(): void {
    if (!this.submitting()) {
      this.confirmDelete.set(null);
    }
  }
  confirmerSuppression(): void {
    const p = this.confirmDelete();
    if (!p) {
      return;
    }
    this.submitting.set(true);
    this.prmpService.delete(p.idPrmp).subscribe({
      next: () => {
        this.toast.success(`PRMP « ${p.idPrmp} » supprimée.`);
        this.confirmDelete.set(null);
        if (this.editId() === p.idPrmp) {
          this.nouveau();
        }
        if (this.detail()?.idPrmp === p.idPrmp) {
          this.fermerDetail();
        }
        if (this.piecesId() === p.idPrmp) {
          this.fermerPieces();
        }
        this.finaliser();
      },
      error: (_e: ApiError) => {
        this.submitting.set(false);
        this.confirmDelete.set(null);
      },
    });
  }

  /** Fin d'un enregistrement réussi : repasse en création, recharge la liste. */
  private finaliser(): void {
    this.submitting.set(false);
    this.nouveau();
    this.charger();
  }
}
