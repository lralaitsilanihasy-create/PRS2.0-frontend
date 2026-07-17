import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Controleur } from '../../models';
import { ControleurService } from '../../services';

const IMG_OK = ['image/jpeg', 'image/png'];

/**
 * Administration des contrôleurs (`/api/controleurs`, ADMINISTRATEUR) : création/modification de la
 * fiche **avec sa photo** (variante multipart `data` + `photo`), consultation de la photo, suppression
 * (garde métier → 409). Recherche serveur par nom. Le matricule (`imControleur`) est l'identifiant,
 * non modifiable. La photo est facultative (JPEG/PNG ≤ 5 Mo) ; la fournir en modification la remplace.
 */
@Component({
  selector: 'app-controleur-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="ca-wrap">
    <section class="ca cnm-card">
      <header class="ca__head">
        <h1 class="ca__title">{{ editId() ? 'Modifier le contrôleur ' + editId() : 'Nouveau contrôleur' }}</h1>
      </header>

      <form class="ca__form cnm-form" [formGroup]="form" (ngSubmit)="enregistrer()" novalidate>
        <div class="cnm-form-grid">
          <label class="form-group">
            <span class="form-label">Matricule *</span>
            <input class="form-control" type="text" formControlName="imControleur" placeholder="matricule" [readonly]="editId() !== null" />
            @if (editId()) { <span class="form-hint">Non modifiable (identifiant).</span> }
            @if (invalide('imControleur')) { <span class="form-error">Obligatoire.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Nom</span>
            <input class="form-control" type="text" formControlName="nomCont" />
          </label>
          <label class="form-group">
            <span class="form-label">Prénoms</span>
            <input class="form-control" type="text" formControlName="prenomsCont" />
          </label>
          <label class="form-group">
            <span class="form-label">Email</span>
            <input class="form-control" type="email" formControlName="emailCont" autocomplete="off" />
            @if (invalide('emailCont')) { <span class="form-error">Email invalide.</span> }
          </label>
          <label class="form-group">
            <span class="form-label">Téléphone</span>
            <input class="form-control" type="text" formControlName="telCont" />
          </label>
          <label class="form-group">
            <span class="form-label">Profil (id)</span>
            <input class="form-control" type="number" formControlName="idProfile" />
          </label>
          <label class="form-group">
            <span class="form-label">Localité</span>
            <input class="form-control" type="text" formControlName="idLocalite" />
          </label>
          <label class="form-group">
            <span class="form-label">Supérieur (matricule)</span>
            <input class="form-control" type="text" formControlName="idSuperieur" />
          </label>
          <label class="form-group ca__check">
            <span class="form-label">Transversal</span>
            <input type="checkbox" formControlName="transversal" />
          </label>
        </div>

        <!-- Photo (facultative, JPEG/PNG ≤ 5 Mo) : fichier ou caméra ; en modification, la fournir remplace l'actuelle. -->
        <fieldset class="ca__photo">
          <legend class="ca__photo-legend">
            Photo (facultative) — JPEG/PNG ≤ 5 Mo
            @if (editId()) {
              <button type="button" class="btn btn-outline btn-sm ca__see" [disabled]="busyPhoto()" (click)="voirPhoto()">Voir la photo actuelle</button>
            }
          </legend>
          @if (photo(); as f) {
            <div class="ca__preview">
              @if (photoPreview(); as src) { <img class="ca__img" [src]="src" alt="Aperçu de la photo" /> }
              <div class="ca__meta">
                <span class="form-hint">{{ f.name }}</span>
                <button type="button" class="btn btn-secondary btn-sm" (click)="reprendrePhoto()">Reprendre</button>
                <button type="button" class="btn btn-danger btn-sm" (click)="clearPhoto()">Retirer</button>
              </div>
            </div>
          } @else if (cameraState() === 'live') {
            <div class="ca__cam">
              <video #cam class="ca__video" autoplay playsinline muted></video>
              <div class="ca__actions">
                <button type="button" class="btn btn-primary btn-sm" (click)="capture()">Capturer</button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="stopCamera()">Annuler</button>
              </div>
            </div>
          } @else {
            <div class="ca__choices">
              <input class="form-control" type="file" accept="image/png,image/jpeg" (change)="onFile($event)" />
              <button type="button" class="btn btn-secondary btn-sm" (click)="startCamera()" [disabled]="cameraState() === 'starting'">
                {{ cameraState() === 'starting' ? 'Ouverture…' : '📷 Prendre une photo' }}
              </button>
            </div>
            @if (cameraError()) { <span class="form-error">{{ cameraError() }}</span> }
          }
          <canvas #snap hidden></canvas>
          @if (fileError()) { <span class="form-error">{{ fileError() }}</span> }
        </fieldset>

        <footer class="ca__foot">
          @if (editId()) {
            <button type="button" class="btn btn-outline" (click)="nouveau()">Annuler</button>
          }
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Enregistrement…' : editId() ? 'Enregistrer les modifications' : 'Créer le contrôleur' }}
          </button>
        </footer>
      </form>

      <div class="ca__sub-row">
        <h2 class="ca__sub">Contrôleurs ({{ controleurs().length }})</h2>
        <input class="form-control ca__search" type="search" placeholder="Rechercher par nom…" (input)="onSearch($any($event.target).value)" />
      </div>
      @if (controleurs().length) {
        <div class="table-responsive"><table class="cnm-table">
          <thead><tr><th>Matricule</th><th>Nom &amp; prénoms</th><th class="col-hide-mobile">Email</th><th class="col-hide-mobile">Localité</th><th class="col-hide-mobile">Transversal</th><th>Actions</th></tr></thead>
          <tbody>
            @for (c of controleurs(); track c.imControleur) {
              <tr>
                <td>{{ c.imControleur }}</td>
                <td>{{ c.nomCont || '—' }} {{ c.prenomsCont || '' }}</td>
                <td class="col-hide-mobile">{{ c.emailCont || '—' }}</td>
                <td class="col-hide-mobile">{{ c.idLocalite || '—' }}</td>
                <td class="col-hide-mobile">{{ c.transversal ? 'Oui' : 'Non' }}</td>
                <td>
                  <div class="ca__row-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="voirDetail(c)">Détail</button>
                    <button type="button" class="btn btn-outline btn-sm" (click)="modifier(c)">Modifier</button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="demanderSuppression(c)">Supprimer</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      } @else {
        <p class="cnm-muted">Aucun contrôleur.</p>
      }
    </section>

    @if (detail(); as d) {
      <aside class="ca-detail cnm-card">
        <header class="ca-detail__head">
          <h2 class="ca-detail__title">Détail — {{ d.imControleur }}</h2>
          <button type="button" class="btn btn-outline btn-sm" (click)="fermerDetail()">Fermer</button>
        </header>
        <div class="ca-detail__photo">
          @if (detailPhoto(); as src) {
            <img class="ca-detail__img" [src]="src" alt="Photo du contrôleur" />
          } @else {
            <div class="ca-detail__no-photo">{{ detailPhotoLoading() ? 'Chargement…' : 'Aucune photo' }}</div>
          }
        </div>
        <dl class="ca-detail__list">
          <dt>Nom</dt><dd>{{ d.nomCont || '—' }}</dd>
          <dt>Prénoms</dt><dd>{{ d.prenomsCont || '—' }}</dd>
          <dt>Email</dt><dd>{{ d.emailCont || '—' }}</dd>
          <dt>Téléphone</dt><dd>{{ d.telCont || '—' }}</dd>
          <dt>Profil</dt><dd>{{ d.idProfile ?? '—' }}</dd>
          <dt>Localité</dt><dd>{{ d.idLocalite || '—' }}</dd>
          <dt>Supérieur</dt><dd>{{ d.idSuperieur || '—' }}</dd>
          <dt>Transversal</dt><dd>{{ d.transversal ? 'Oui' : 'Non' }}</dd>
        </dl>
      </aside>
    }
    </div>

    @if (confirmDelete(); as c) {
      <div class="modal-backdrop" (click)="annulerSuppression()">
        <div class="modal confirm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain"><span class="modal-title">Supprimer le contrôleur</span></div>
          <div class="modal-body">
            Supprimer le contrôleur <strong>{{ c.imControleur }}</strong> ({{ c.nomCont }} {{ c.prenomsCont }}), son compte et sa photo ?
            Refusé (409) s'il a une activité (subordonnés, examens, PV, vérifications, dispatch…). Action irréversible.
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
    .ca-wrap { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    /* Pleine largeur : la carte occupe tout l'espace disponible (le panneau Détail partage via flex). */
    .ca { flex: 1 1 38rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
    /* Panneau de détail : occupe tout l'espace disponible à droite (grandit), photo pleine largeur. */
    .ca-detail { flex: 1 1 26rem; position: sticky; top: 1rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .ca-detail__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .ca-detail__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ca-detail__photo { display: flex; justify-content: center; }
    .ca-detail__img { width: 100%; max-width: 28rem; border-radius: var(--radius-md); border: 1px solid var(--c-100); }
    .ca-detail__no-photo { width: 100%; max-width: 28rem; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--c-100); border-radius: var(--radius-md); color: var(--n-400); font-size: var(--text-md); }
    .ca-detail__list { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.25rem; margin: 0; font-size: var(--text-md); }
    .ca-detail__list dt { color: var(--n-500); font-weight: 600; }
    .ca-detail__list dd { margin: 0; color: var(--c-800); word-break: break-word; }
    .ca-detail__foot { display: flex; justify-content: flex-end; }
    .ca__head { display: flex; flex-direction: column; gap: 0.35rem; }
    .ca__title { margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--c-800); }
    .ca__form { display: flex; flex-direction: column; gap: 1rem; }
    .ca__check { flex-direction: row; align-items: center; gap: 0.5rem; }
    .ca__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .ca__sub-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .ca__sub { margin: 0.5rem 0 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); }
    .ca__search { min-width: 16rem; max-width: 22rem; }
    .ca__row-actions { display: flex; gap: 0.4rem; flex-wrap: nowrap; white-space: nowrap; }
    .ca__photo { border: 1px solid var(--c-100); border-radius: var(--radius-md); padding: 0.75rem 1rem 1rem; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .ca__photo-legend { font-size: var(--text-sm); font-weight: 600; color: var(--c-800); padding: 0 0.35rem; display: flex; align-items: center; gap: 0.75rem; }
    .ca__choices { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .ca__cam, .ca__preview { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    .ca__video, .ca__img { width: 100%; max-width: 14rem; border-radius: var(--radius-sm); border: 1px solid var(--c-100); }
    .ca__video { background: #000; }
    .ca__actions, .ca__meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  `,
})
export class ControleurAdmin implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly controleurService = inject(ControleurService);
  private readonly toast = inject(ToastService);

  readonly controleurs = signal<Controleur[]>([]);
  readonly submitting = signal(false);
  readonly busyPhoto = signal(false);
  /** Contrôleur en cours d'édition (matricule) ; null = mode création. */
  readonly editId = signal<string | null>(null);
  readonly confirmDelete = signal<Controleur | null>(null);
  private readonly search$ = new Subject<string>();

  // Panneau de détail (à droite) : contrôleur affiché + sa photo (object URL) + état de chargement.
  readonly detail = signal<Controleur | null>(null);
  readonly detailPhoto = signal<string | null>(null);
  readonly detailPhotoLoading = signal(false);

  readonly photo = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('cam');
  private readonly snap = viewChild<ElementRef<HTMLCanvasElement>>('snap');
  private stream: MediaStream | null = null;
  readonly cameraState = signal<'idle' | 'starting' | 'live'>('idle');
  readonly cameraError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);

  readonly form = this.fb.group({
    imControleur: ['', Validators.required],
    nomCont: [''],
    prenomsCont: [''],
    emailCont: ['', Validators.email],
    telCont: [''],
    idProfile: [null as number | null],
    idLocalite: [''],
    idSuperieur: [''],
    transversal: [false],
  });

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => this.runSearch(term));
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

  /** Affiche le détail d'un contrôleur (panneau de droite) et charge sa photo. */
  voirDetail(c: Controleur): void {
    this.detail.set(c);
    this.setDetailPhoto(null);
    this.detailPhotoLoading.set(true);
    this.controleurService.downloadPhoto(c.imControleur).subscribe({
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
  private charger(): void {
    this.controleurService.list().subscribe((r) => this.controleurs.set(r));
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
    this.controleurService.searchByName(t).subscribe({ next: (r) => this.controleurs.set(r), error: () => {} });
  }

  invalide(champ: string): boolean {
    const c = this.form.get(champ)!;
    return c.invalid && (c.touched || c.dirty);
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file) {
      if (!IMG_OK.includes(file.type)) {
        this.fileError.set('Format non autorisé (JPEG ou PNG).');
        input.value = '';
        this.setPhoto(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.fileError.set('Fichier trop volumineux (max 5 Mo).');
        input.value = '';
        this.setPhoto(null);
        return;
      }
    }
    this.setPhoto(file);
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
        this.setPhoto(new File([blob], 'photo-capture.jpg', { type: 'image/jpeg' }));
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
    this.setPhoto(null);
    this.fileError.set(null);
  }
  private setPhoto(file: File | null): void {
    this.photo.set(file);
    const prev = this.photoPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.photoPreview.set(file ? URL.createObjectURL(file) : null);
  }

  /** Ouvre la photo enregistrée du contrôleur en cours d'édition dans un nouvel onglet. */
  voirPhoto(): void {
    const id = this.editId();
    if (!id) {
      return;
    }
    this.busyPhoto.set(true);
    this.controleurService.downloadPhoto(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.busyPhoto.set(false);
      },
      error: (e: ApiError) => {
        this.busyPhoto.set(false);
        if (e.status === 404) {
          this.toast.info('Aucune photo déposée pour ce contrôleur.', 'Photo absente');
        } else {
          this.toast.error('Téléchargement impossible.', 'Erreur');
        }
      },
    });
  }

  nouveau(): void {
    this.editId.set(null);
    this.form.reset({ transversal: false });
    this.stopCamera();
    this.clearPhoto();
  }
  modifier(c: Controleur): void {
    this.editId.set(c.imControleur);
    this.stopCamera();
    this.clearPhoto();
    this.form.reset({ transversal: false });
    this.form.patchValue({
      imControleur: c.imControleur,
      nomCont: c.nomCont ?? '',
      prenomsCont: c.prenomsCont ?? '',
      emailCont: c.emailCont ?? '',
      telCont: c.telCont ?? '',
      idProfile: c.idProfile ?? null,
      idLocalite: c.idLocalite ?? '',
      idSuperieur: c.idSuperieur ?? '',
      transversal: c.transversal,
    });
  }

  private bodyFromForm(imControleur: string): Controleur {
    const v = this.form.getRawValue();
    return {
      imControleur,
      nomCont: v.nomCont?.trim() || undefined,
      prenomsCont: v.prenomsCont?.trim() || undefined,
      emailCont: v.emailCont?.trim() || undefined,
      telCont: v.telCont?.trim() || undefined,
      idProfile: v.idProfile ?? undefined,
      idLocalite: v.idLocalite?.trim() || undefined,
      idSuperieur: v.idSuperieur?.trim() || undefined,
      transversal: !!v.transversal,
    };
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.editId();
    this.submitting.set(true);
    if (id) {
      this.controleurService.modifierAvecPhoto(id, this.bodyFromForm(id), this.photo()).subscribe({
        next: () => {
          this.toast.success(`Contrôleur « ${id} » modifié.`);
          this.finaliser();
        },
        error: (_e: ApiError) => this.submitting.set(false),
      });
      return;
    }
    const matricule = (this.form.getRawValue().imControleur ?? '').trim();
    this.controleurService.creerAvecPhoto(this.bodyFromForm(matricule), this.photo()).subscribe({
      next: () => {
        this.toast.success(`Contrôleur « ${matricule} » créé.`);
        this.finaliser();
      },
      error: (_e: ApiError) => this.submitting.set(false), // message via l'intercepteur (400/409)
    });
  }

  demanderSuppression(c: Controleur): void {
    this.confirmDelete.set(c);
  }
  annulerSuppression(): void {
    if (!this.submitting()) {
      this.confirmDelete.set(null);
    }
  }
  confirmerSuppression(): void {
    const c = this.confirmDelete();
    if (!c) {
      return;
    }
    this.submitting.set(true);
    this.controleurService.delete(c.imControleur).subscribe({
      next: () => {
        this.toast.success(`Contrôleur « ${c.imControleur} » supprimé.`);
        this.confirmDelete.set(null);
        if (this.editId() === c.imControleur) {
          this.nouveau();
        }
        if (this.detail()?.imControleur === c.imControleur) {
          this.fermerDetail();
        }
        this.finaliser();
      },
      error: (_e: ApiError) => {
        this.submitting.set(false);
        this.confirmDelete.set(null);
      },
    });
  }

  private finaliser(): void {
    this.submitting.set(false);
    this.nouveau();
    this.charger();
  }
}
