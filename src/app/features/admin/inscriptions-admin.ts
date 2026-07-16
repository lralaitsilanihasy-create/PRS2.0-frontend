import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { InscriptionEnAttente } from '../../models';
import { InscriptionService } from '../../services';

type PieceType = 'ARRETE_NOMIN' | 'CIN' | 'PHOTO';

/**
 * Validation des inscriptions **PRMP et UGPM** en attente (profil ADMINISTRATEUR).
 * Active un compte (`valider`) ou le refuse (`refuser`, motif obligatoire), et permet de consulter
 * les pièces (CIN / photo, + arrêté pour une PRMP). L'UGPM affiche sa PRMP de tutelle.
 */
@Component({
  selector: 'app-inscriptions-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="ia-wrap">
    <section class="ia">
      <header class="page-header">
        <h1 class="page-title">Inscriptions en attente ({{ inscriptions().length }})</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (inscriptions().length) {
        <div class="table-card">
          <table class="cnm-table">
            <thead>
              <tr><th>Type</th><th>Login</th><th>Responsable</th><th>Périmètre</th><th>Pièces</th><th>Actions</th></tr>
            </thead>
            <tbody>
              @for (i of inscriptions(); track i.login) {
                <tr>
                  <td><span class="ia__badge" [class.ia__badge--ugpm]="i.type === 'UGPM'">{{ i.type }}</span></td>
                  <td>{{ i.login }}</td>
                  <td>{{ nomComplet(i) }}<br /><span class="ia__email">{{ email(i) }}</span></td>
                  <td>
                    @if (i.type === 'UGPM') {
                      Tutelle : <strong>{{ i.idPrmpTutelle || '—' }}</strong>
                    } @else {
                      {{ (i.entitesDeclarees?.length ?? 0) }} entité(s) déclarée(s)
                    }
                  </td>
                  <td>
                    <div class="ia__pieces">
                      @for (t of pieceTypes(i); track t) {
                        <button type="button" class="btn btn-outline btn-sm" (click)="voirPiece(i, t)">{{ pieceLabel(t) }}</button>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="ia__actions">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="voirDetail(i)">Détail</button>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="busy() === i.login" (click)="valider(i)">Valider</button>
                      <button type="button" class="btn btn-danger btn-sm" [disabled]="busy() === i.login" (click)="demanderRefus(i)">Refuser</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="cnm-muted">Aucune inscription en attente.</p>
      }
    </section>

    @if (view(); as v) {
      <aside class="ia-detail cnm-card">
        <header class="ia-detail__head">
          <h2 class="ia-detail__title">
            <span class="ia__badge" [class.ia__badge--ugpm]="v.i.type === 'UGPM'">{{ v.i.type }}</span>
            {{ v.i.login }} — {{ viewLabel(v.kind) }}
          </h2>
          <button type="button" class="btn btn-outline btn-sm" (click)="fermerDetail()">Fermer</button>
        </header>
        <div class="ia-detail__photo">
          @if (viewLoading()) {
            <div class="ia-detail__no-photo">Chargement…</div>
          } @else if (viewPdf(); as pdf) {
            <iframe class="ia-detail__pdf" [src]="pdf" title="Document"></iframe>
          } @else if (viewImg(); as img) {
            <img class="ia-detail__img" [src]="img" alt="Document" (error)="onPhotoError()" />
          } @else {
            <div class="ia-detail__no-photo">{{ v.kind === 'detail' ? 'Aucune photo' : 'Aucune pièce' }}</div>
          }
        </div>
        @if (v.kind === 'detail') {
          <dl class="ia-detail__dl">
            <dt>Responsable</dt><dd>{{ nomComplet(v.i) }}</dd>
            <dt>Email</dt><dd>{{ email(v.i) || '—' }}</dd>
            @if (v.i.type === 'UGPM') {
              <dt>PRMP de tutelle</dt><dd>{{ v.i.idPrmpTutelle || '—' }}</dd>
            } @else {
              <dt>Entités déclarées</dt><dd>{{ (v.i.entitesDeclarees?.length ?? 0) }}</dd>
            }
          </dl>
          @if (v.i.type === 'PRMP' && v.i.entitesDeclarees?.length) {
            <ul class="ia-detail__entites">
              @for (e of v.i.entitesDeclarees; track $index) {
                <li>
                  {{ e.libelle || ('#' + e.idEntiteContract) }}
                  @if (e.disponible === false) { <span class="ia-detail__pris">(déjà prise)</span> }
                </li>
              }
            </ul>
          }
        }
      </aside>
    }
    </div>

    @if (refuseFor(); as i) {
      <div class="modal-backdrop" (click)="annulerRefus()">
        <div class="modal confirm-modal cnm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain"><span class="modal-title">Refuser l'inscription — {{ i.login }}</span></div>
          <div class="modal-body">
            <label class="form-group">
              <span class="form-label">Motif du refus *</span>
              <textarea class="form-control" rows="3" [formControl]="motif"></textarea>
              @if (motif.touched && motif.invalid) { <span class="form-error">Motif obligatoire.</span> }
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerRefus()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="busy() === i.login" (click)="confirmerRefus()">Refuser</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ia-wrap { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .ia { flex: 1 1 40rem; display: flex; flex-direction: column; gap: 1rem; }
    .ia__badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: var(--text-xs); font-weight: 700; background: var(--c-100); color: var(--c-800); }
    .ia__badge--ugpm { background: #e7f0ff; color: #1a56db; }
    .ia__email { color: var(--n-400); font-size: var(--text-xs); }
    .ia__pieces, .ia__actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .ia-detail { flex: 1 1 24rem; position: sticky; top: 1rem; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .ia-detail__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .ia-detail__title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--c-800); display: flex; align-items: center; gap: 0.5rem; }
    .ia-detail__photo { display: flex; justify-content: center; }
    .ia-detail__img { width: 100%; max-width: 24rem; border-radius: var(--radius-md); border: 1px solid var(--c-100); }
    .ia-detail__no-photo { width: 100%; max-width: 24rem; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--c-100); border-radius: var(--radius-md); color: var(--n-400); font-size: var(--text-sm); }
    .ia-detail__pdf { width: 100%; height: 30rem; border: 1px solid var(--c-100); border-radius: var(--radius-md); }
    .ia-detail__dl { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 1rem; margin: 0; font-size: var(--text-sm); }
    .ia-detail__dl dt { color: var(--n-500); font-weight: 600; }
    .ia-detail__dl dd { margin: 0; color: var(--c-800); word-break: break-word; }
    .ia-detail__entites { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); color: var(--c-800); display: flex; flex-direction: column; gap: 0.15rem; }
    .ia-detail__pris { color: var(--n-400); font-size: var(--text-xs); }
    .ia-detail__pieces, .ia-detail__foot { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .ia-detail__foot { border-top: 1px solid var(--c-100); padding-top: 0.75rem; }
  `,
})
export class InscriptionsAdmin implements OnInit, OnDestroy {
  private readonly inscriptionService = inject(InscriptionService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly inscriptions = signal<InscriptionEnAttente[]>([]);
  readonly loading = signal(false);
  /** Login en cours de traitement (désactive ses boutons). */
  readonly busy = signal<string | null>(null);
  /** Inscription dont le refus est en cours de saisie (modale). */
  readonly refuseFor = signal<InscriptionEnAttente | null>(null);
  readonly motif = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  // Panneau de droite unifié : « detail » (infos + photo) ou une pièce (CIN/photo/arrêté) affichée en grand.
  readonly view = signal<{ i: InscriptionEnAttente; kind: 'detail' | PieceType } | null>(null);
  readonly viewLoading = signal(false);
  readonly viewImg = signal<string | null>(null); // URL blob pour <img> (image)
  readonly viewPdf = signal<SafeResourceUrl | null>(null); // URL sûre pour <iframe> (PDF)
  private currentUrl: string | null = null;

  ngOnDestroy(): void {
    this.clearDoc();
  }

  voirDetail(i: InscriptionEnAttente): void {
    this.openView(i, 'detail');
  }
  voirPiece(i: InscriptionEnAttente, type: PieceType): void {
    this.openView(i, type);
  }
  fermerDetail(): void {
    this.view.set(null);
    this.clearDoc();
    this.viewLoading.set(false);
  }
  /** L'image n'a pas pu être décodée (contenu absent/non-image) → retire l'aperçu. */
  onPhotoError(): void {
    this.clearDoc();
  }
  viewLabel(kind: 'detail' | PieceType): string {
    return kind === 'detail' ? 'Détail' : this.pieceLabel(kind);
  }

  /** Ouvre le panneau sur le détail ou une pièce, et charge le document (photo pour « detail »). */
  private openView(i: InscriptionEnAttente, kind: 'detail' | PieceType): void {
    this.view.set({ i, kind });
    this.clearDoc();
    this.viewLoading.set(true);
    const type: PieceType = kind === 'detail' ? 'PHOTO' : kind;
    this.inscriptionService.downloadPiece(i.login, type).subscribe({
      next: (blob) => {
        this.setDoc(blob);
        this.viewLoading.set(false);
      },
      error: () => {
        this.clearDoc(); // 404 = pas de pièce
        this.viewLoading.set(false);
      },
    });
  }
  private setDoc(blob: Blob): void {
    this.clearDoc();
    const url = URL.createObjectURL(blob);
    this.currentUrl = url;
    if (blob.type.includes('pdf')) {
      this.viewPdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } else {
      this.viewImg.set(url);
    }
  }
  private clearDoc(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    this.viewImg.set(null);
    this.viewPdf.set(null);
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.inscriptionService.enAttente().subscribe({
      next: (rows) => {
        this.inscriptions.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  nomComplet(i: InscriptionEnAttente): string {
    const nom = i.nom ?? i.nomPrmp ?? i.nomUgpm ?? '';
    const prenoms = i.prenoms ?? i.prenomsPrmp ?? i.prenomsUgpm ?? '';
    return `${nom} ${prenoms}`.trim() || (i.refActeur ?? '—');
  }
  email(i: InscriptionEnAttente): string {
    return i.email ?? i.emailPrmp ?? i.emailUgpm ?? '';
  }
  pieceTypes(i: InscriptionEnAttente): PieceType[] {
    return i.type === 'PRMP' ? ['ARRETE_NOMIN', 'CIN', 'PHOTO'] : ['CIN', 'PHOTO'];
  }
  pieceLabel(t: PieceType): string {
    return t === 'ARRETE_NOMIN' ? 'Arrêté' : t === 'CIN' ? 'CIN' : 'Photo';
  }

  valider(i: InscriptionEnAttente): void {
    if (!confirm(`Valider (activer) le compte « ${i.login} » ?`)) {
      return;
    }
    this.busy.set(i.login);
    this.inscriptionService.valider(i.login).subscribe({
      next: () => {
        this.toast.success(`Inscription « ${i.login} » validée.`);
        this.busy.set(null);
        this.closeDetailIf(i.login);
        this.charger();
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }

  private closeDetailIf(login: string): void {
    if (this.view()?.i.login === login) {
      this.fermerDetail();
    }
  }

  demanderRefus(i: InscriptionEnAttente): void {
    this.motif.reset('');
    this.refuseFor.set(i);
  }
  annulerRefus(): void {
    if (!this.busy()) {
      this.refuseFor.set(null);
    }
  }
  confirmerRefus(): void {
    const i = this.refuseFor();
    if (!i) {
      return;
    }
    if (this.motif.invalid) {
      this.motif.markAsTouched();
      return;
    }
    this.busy.set(i.login);
    this.inscriptionService.refuser(i.login, this.motif.value.trim()).subscribe({
      next: () => {
        this.toast.success(`Inscription « ${i.login} » refusée.`);
        this.busy.set(null);
        this.refuseFor.set(null);
        this.closeDetailIf(i.login);
        this.charger();
      },
      error: (_e: ApiError) => this.busy.set(null),
    });
  }
}
