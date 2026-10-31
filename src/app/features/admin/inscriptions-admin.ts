import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { DeuxVolets } from '../../shared/ui/deux-volets';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { blobSur, urlBlobSure } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { InscriptionEnAttente } from '../../models';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
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
  imports: [ModaleDirective, ReactiveFormsModule, RouterLink, DeuxVolets],
  template: `
    <!-- ⚠️ 31/10 (pilote, Espace de travail, lot 3b) — deux volets : les inscriptions à gauche, le détail de celle choisie à
         droite (pièces, informations, gestes), sans changer de page. La première est choisie d'office. -->
    <section class="ia">
      <header class="page-header">
        <h1 class="page-title">Inscriptions en attente ({{ inscriptions().length }})</h1>
        <!-- ⚠️ Lot 6 F1 — « Demandes d'accès » est une entrée de menu UNIQUE depuis le 2026-09-17 :
             inscriptions et rattachements sont deux files de la même demande. L'écran à deux
             onglets est le lot F3 ; d'ici là les deux écrans se renvoient l'un à l'autre, pour que
             rien ne devienne inatteignable. -->
        <a class="btn btn-outline btn-sm" routerLink="/admin/rattachements">Rattachements en attente</a>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <!-- Phrase de rôle (proposition 2026-09-22, lot B) : à quoi sert l'écran, pour qui. -->
      <p class="page-role">Les PRMP qui se sont inscrites et attendent votre validation : vérifiez l'identité et les pièces, puis activez ou refusez le compte.</p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (inscriptions().length) {
        <app-deux-volets [ouvert]="!!view()" [cle]="view()?.i?.login ?? null" libelleListe="Inscriptions en attente" libelleDetail="Détail de l’inscription"
                         invite="Choisissez une inscription : ses pièces et ses informations s’affichent ici.">
          <ul liste class="ia__liste">
            @for (i of inscriptions(); track i.login) {
              <li class="ia__item" [class.ia__item--on]="view()?.i?.login === i.login">
                <button type="button" class="ia__ligne" [attr.aria-pressed]="view()?.i?.login === i.login" (click)="voirDetail(i)">
                  <span class="ia__ligne-tete"><span class="ia__badge" [class.ia__badge--ugpm]="i.type === 'UGPM'">{{ i.type }}</span><span class="ia__login">{{ i.login }}</span></span>
                  <span class="ia__nom">{{ nomComplet(i) }}</span>
                  <span class="ia__email">{{ email(i) }}</span>
                  <span class="ia__perimetre">@if (i.type === 'UGPM') { Tutelle : {{ i.idPrmpTutelle || '—' }} } @else { {{ (i.entitesDeclarees?.length ?? 0) }} entité(s) déclarée(s) }</span>
                </button>
              </li>
            }
          </ul>
          <div detail>
            @if (view(); as v) {
              <div class="ia-detail">
                <header class="ia-detail__head">
                  <h2 class="ia-detail__title">
                    <span class="ia__badge" [class.ia__badge--ugpm]="v.i.type === 'UGPM'">{{ v.i.type }}</span>
                    {{ v.i.login }} — {{ nomComplet(v.i) }}
                  </h2>
                  <div class="ia__actions">
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="busy() === v.i.login" (click)="valider(v.i)">Valider</button>
                    <button type="button" class="btn btn-danger btn-sm" [disabled]="busy() === v.i.login" (click)="demanderRefus(v.i)">Refuser</button>
                  </div>
                </header>
                <div class="ia__pieces" role="group" aria-label="Pièces de l’inscription">
                  <button type="button" class="btn btn-sm" [class.btn-primary]="v.kind === 'detail'" [class.btn-outline]="v.kind !== 'detail'" [attr.aria-pressed]="v.kind === 'detail'" (click)="voirDetail(v.i)">Informations</button>
                  @for (t of pieceTypes(v.i); track t) {
                    <button type="button" class="btn btn-sm" [class.btn-primary]="v.kind === t" [class.btn-outline]="v.kind !== t" [attr.aria-pressed]="v.kind === t" (click)="voirPiece(v.i, t)">{{ pieceLabel(t) }}</button>
                  }
                </div>
                <div class="ia-detail__photo">
                  @if (viewLoading()) {
                    <div class="ia-detail__no-photo" role="status">Chargement…</div>
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
              </div>
            }
          </div>
        </app-deux-volets>
      } @else {
        <p class="cnm-muted">Aucune inscription en attente.</p>
      }
    </section>

    @if (refuseFor(); as i) {
      <div class="modal-backdrop" [class.closing]="closingRefus()">
        <div class="modal confirm-modal cnm-card" role="dialog" aria-modal="true" aria-label="Refus de l'inscription" appModale (appModaleFermer)="fermerRefusAnime()">
          <div class="modal-header-plain"><span class="modal-title">Refuser l'inscription — {{ i.login }}</span></div>
          <div class="modal-body">
            <label class="form-group">
              <span class="form-label">Motif du refus *</span>
              <textarea class="form-control" rows="3" [formControl]="motif"></textarea>
              @if (motif.touched && motif.invalid) { <span class="form-error">Motif obligatoire.</span> }
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerRefusAnime()">Annuler</button>
            <button type="button" class="btn btn-danger" [disabled]="busy() === i.login" (click)="confirmerRefus()">Refuser</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ia { display: flex; flex-direction: column; gap: 0.75rem; }
    .ia__badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: var(--text-xs); font-weight: 500; background: var(--c-100); color: var(--c-800); }
    .ia__badge--ugpm { background: var(--onglet-actif-fond); color: var(--texte); }
    .ia__liste { list-style: none; margin: 0; padding: 0; }
    .ia__item { border-bottom: 1px solid var(--bordure); }
    .ia__item--on { background: var(--onglet-actif-fond); box-shadow: inset 3px 0 0 var(--menu-fond); }
    .ia__ligne { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.6rem 0.8rem; }
    .ia__ligne:hover { background: var(--ligne-survol); }
    .ia__item--on .ia__ligne:hover { background: transparent; }
    .ia__ligne:focus-visible { outline: 2px solid var(--bouton-principal); outline-offset: -2px; }
    .ia__ligne-tete { display: flex; align-items: center; gap: 0.5rem; }
    .ia__login { font-weight: 500; }
    .ia__nom { overflow-wrap: anywhere; }
    .ia__email, .ia__perimetre { color: var(--texte-secondaire); font-size: var(--text-xs); }
    .ia__pieces, .ia__actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .ia-detail { display: flex; flex-direction: column; gap: 0.8rem; }
    .ia-detail__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--bordure); }
    .ia-detail__title { margin: 0; font-size: var(--text-md); font-weight: 500; color: var(--c-800); display: flex; align-items: center; gap: 0.5rem; }
    .ia-detail__photo { display: flex; justify-content: center; }
    .ia-detail__img { width: 100%; max-width: 24rem; border-radius: var(--radius-md); border: 1px solid var(--c-100); }
    .ia-detail__no-photo { width: 100%; max-width: 24rem; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--c-100); border-radius: var(--radius-md); color: var(--n-400); font-size: var(--text-sm); }
    .ia-detail__pdf { width: 100%; height: 30rem; border: 1px solid var(--c-100); border-radius: var(--radius-md); }
    .ia-detail__dl { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 1rem; margin: 0; font-size: var(--text-sm); }
    .ia-detail__dl dt { color: var(--n-500); font-weight: 500; }
    .ia-detail__dl dd { margin: 0; color: var(--c-800); word-break: break-word; }
    .ia-detail__entites { margin: 0; padding-left: 1.1rem; font-size: var(--text-sm); color: var(--c-800); display: flex; flex-direction: column; gap: 0.15rem; }
    .ia-detail__pris { color: var(--n-400); font-size: var(--text-xs); }
    .ia-detail__pieces, .ia-detail__foot { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .ia-detail__foot { border-top: 1px solid var(--c-100); padding-top: 0.75rem; }
  `,
})
export class InscriptionsAdmin implements OnInit, OnDestroy {
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingRefus = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerRefusAnime(): void {
    fermerAvecAnimation(this.closingRefus, () => this.annulerRefus());
  }
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
    // Le type sûr décide de l'aiguillage PDF/image ; `urlBlobSure` est idempotent sur `sur`.
    const sur = blobSur(blob);
    const url = urlBlobSure(sur);
    this.currentUrl = url;
    if (sur.type.includes('pdf')) {
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
        // ⚠️ 31/10 (deux volets) — sans inscription ouverte (ou si elle a quitté la file), la première est choisie d'office.
        const ouverte = this.view()?.i.login;
        if (!rows.some((r) => r.login === ouverte)) {
          if (rows.length) this.openView(rows[0], 'detail');
          else this.fermerDetail();
        }
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
