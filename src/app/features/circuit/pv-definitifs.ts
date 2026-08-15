import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { PvExamen } from '../../models';
import { PvExamenService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DetailPvModal } from './detail-pv-modal';

/**
 * « PV définitifs » (MEMBRE / PRESIDENT / CHEF_COMMISSION / **PRMP** ⚠️ 2026-08-02) — **LECTURE SEULE**.
 * Liste les PV **signés** via `GET /api/pv-examens/definitifs` (complément de « Projets de PV » qui
 * n'expose plus les signés), triés par date de signature décroissante. Aucune action de workflow.
 * Pour la PRMP : liste scopée serveur à SES dossiers, et **uniquement la version PDF** du PV
 * (document officiel signé — pas de modal de détail interne) ; c'est sa base de rectification
 * selon les observations du PV.
 */
@Component({
  selector: 'app-pv-definitifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DetailPvModal],
  template: `
    <section class="pvd">
      <header class="page-header">
        <h1 class="page-title">PV définitifs</h1>
      </header>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else if (pvs().length) {
        <ul class="pvd__list">
          @for (pv of pvs(); track pv.idPv) {
            <li class="card pvd__item">
              <div class="pvd__head">
                <span class="pvd__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                <span class="pvd__date">{{ dateSignature(pv) || '—' }}</span>
                <app-statut-badge [statut]="pv.statutPv" [label]="'Définitif'" />
                @if (estPrmp()) {
                  <!-- ⚠️ 2026-08-02 (demande user) — la PRMP ne reçoit QUE le document officiel signé
                       (PDF), AFFICHÉ directement au clic (pas de téléchargement, pas de modal interne). -->
                  @if (pv.documentDisponible) {
                    <button type="button" class="btn btn-primary btn-sm pvd__details" [disabled]="chargementPdf() === pv.idPv"
                      (click)="afficherPdf(pv)">
                      {{ chargementPdf() === pv.idPv ? 'Chargement…' : '📄 Afficher le PV' }}
                    </button>
                  } @else {
                    <button type="button" class="btn btn-primary btn-sm pvd__details" disabled
                      title="Document non disponible pour ce PV">📄 Afficher le PV</button>
                  }
                } @else if (estReferenceComplete(pv.refePv || pv.referencePv)) {
                  <button type="button" class="btn btn-secondary btn-sm pvd__details" (click)="ouvrirDetailPv(pv)">Voir détails</button>
                } @else {
                  <button type="button" class="btn btn-secondary btn-sm pvd__details" disabled
                    title="Référence incomplète — contactez l'administrateur">Voir détails</button>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="text-muted">Aucun PV définitif.</p>
      }
    </section>

    @if (detail(); as pv) {
      <app-detail-pv-modal [pv]="pv" (fermer)="detail.set(null)" />
    }

    <!-- ⚠️ 2026-08-02 (PRMP) — visionneuse du PDF officiel signé, affichée directement au clic. -->
    @if (apercu(); as ap) {
      <div class="modal-backdrop" (click)="fermerApercu()">
        <div class="modal modal-lg pvd__viewer" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="pvd__viewer-top">
                <app-statut-badge [statut]="'SIGNE'" [label]="'Définitif'" />
                <span class="text-muted text-sm">Document officiel signé</span>
              </div>
              <h2 class="modal-title">{{ ap.reference }}</h2>
            </div>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerApercu()">✕</button>
          </div>
          <div class="modal-body pvd__viewer-body">
            <iframe [src]="ap.url" [title]="ap.reference" class="pvd__viewer-frame"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .pvd__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .pvd__item { padding: 0.75rem 1.1rem; }
    .pvd__head { display: flex; align-items: center; gap: 0.5rem; }
    .pvd__ref { font-weight: 700; color: var(--c-800); }
    .pvd__date { color: var(--n-400); font-size: var(--text-xs); }
    .pvd__details { margin-left: auto; }
    .pvd__info { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.5rem 0 0; }
    .pvd__info > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .pvd__info dt { flex: 0 0 11rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--n-400); }
    .pvd__info dd { margin: 0; color: var(--n-700); }
    .pvd__synthese { margin: 0.5rem 0 0; font-size: var(--text-sm); }
    /* Visionneuse PDF (PRMP) : le corps du modal est entièrement occupé par le document. */
    .pvd__viewer-top { display: flex; align-items: center; gap: 0.5rem; }
    .pvd__viewer-body { padding: 0; }
    .pvd__viewer-frame { display: block; width: 100%; height: 75vh; border: 0; }
  `,
})
export class PvDefinitifs {
  private readonly service = inject(PvExamenService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  /** PV ouvert dans le modal de détail (null = fermé). */
  readonly detail = signal<PvExamen | null>(null);
  /**
   * ⚠️ 2026-08-02 (demande user) — la PRMP (et l'UGPM sous tutelle) ne reçoit que la VERSION PDF du
   * PV signé (document officiel), AFFICHÉE directement : pas de modal de détail (reconstruction interne).
   */
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP' || this.auth.role() === 'UGPM');
  /** idPv dont le PDF est en cours de chargement (bouton désactivé), null sinon. */
  readonly chargementPdf = signal<number | null>(null);
  /** Visionneuse PDF ouverte (PRMP) : référence affichée + URL blob « de confiance » (null = fermée). */
  readonly apercu = signal<{ reference: string; url: SafeResourceUrl; brute: string } | null>(null);

  constructor() {
    this.service.definitifs().subscribe({
      next: (rows) => {
        // Tri par date de signature décroissante (PV le plus récemment signé en tête).
        this.pvs.set([...rows].sort((a, b) => this.dateSignature(b).localeCompare(this.dateSignature(a))));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Date de signature du PV : la plus récente parmi les signatures (repli sur la date du PV). */
  dateSignature(pv: PvExamen): string {
    const dates = [pv.dateSignatureMembre, pv.dateSignatureCc, pv.dateSignaturePresident, pv.datePv].filter(
      (d): d is string => !!d,
    );
    return dates.length ? dates.sort()[dates.length - 1] : '';
  }

  ouvrirDetailPv(pv: PvExamen): void {
    this.detail.set(pv);
  }

  /**
   * Affiche le PDF du PV (PRMP) DIRECTEMENT dans une visionneuse (iframe) — pas de téléchargement
   * (le lecteur du navigateur offre de toute façon impression / enregistrement). L'URL blob est
   * révoquée à la fermeture de la visionneuse.
   */
  afficherPdf(pv: PvExamen): void {
    this.chargementPdf.set(pv.idPv);
    this.service.document(pv.idPv).subscribe({
      next: (blob) => {
        this.chargementPdf.set(null);
        const brute = URL.createObjectURL(blob);
        this.apercu.set({
          reference: pv.refePv || pv.referencePv || 'PV #' + pv.idPv,
          url: this.sanitizer.bypassSecurityTrustResourceUrl(brute),
          brute,
        });
      },
      error: () => {
        this.chargementPdf.set(null);
        this.toast.error('Document du PV indisponible.');
      },
    });
  }

  /** Ferme la visionneuse et libère l'URL blob (l'iframe est détruite en même temps). */
  fermerApercu(): void {
    const ap = this.apercu();
    this.apercu.set(null);
    if (ap) {
      URL.revokeObjectURL(ap.brute);
    }
  }

  /** Référence complète = au moins 2 « / » (ex. 00006/PPM/CRM-ANT/PV/2026), pas « PV #N ». */
  estReferenceComplete(ref?: string): boolean {
    return !!ref && (ref.match(/\//g) || []).length >= 2;
  }
}
