import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { urlBlobSure } from '../../core/securite/fichiers-surs';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { Dispatch, Dossier, Examen, PvExamen, Reception } from '../../models';
import {
  ControleurService,
  DispatchService,
  DossierService,
  EntiteContractService,
  ExamenService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';
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
  imports: [ModaleDirective, StatutBadge, DetailPvModal],
  template: `
    <section class="pvd">
      <header class="page-header">
        <h1 class="page-title">PV définitifs</h1>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (pvs().length) {
        <!-- ⚠️ Demande user (2026-08-15) — tableau : référence, entité contractante, date du PV,
             co-signataires, et l'action (le bouton varie selon le profil, comme avant). -->
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Entité contractante</th>
                <th scope="col">Date du PV</th>
                <th scope="col">Co-signataires</th>
                <th scope="col" class="r">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (pv of pvs(); track pv.idPv) {
                <tr>
                  <td>
                    <span class="pvd__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                    <app-statut-badge [statut]="pv.statutPv" [label]="'Définitif'" />
                  </td>
                  <td>{{ entiteDe(pv) }}</td>
                  <td style="white-space:nowrap;">{{ datePvDe(pv) || '—' }}</td>
                  <td>{{ coSignataires(pv) }}</td>
                  <td>
                    <div class="td-actions pvd__actions">
                      @if (estPrmp()) {
                        <!-- ⚠️ 2026-08-02 (demande user) — la PRMP ne reçoit QUE le document officiel
                             signé (PDF), AFFICHÉ directement au clic (pas de modal interne). -->
                        @if (pv.documentDisponible) {
                          <button type="button" class="btn btn-primary btn-sm" [disabled]="chargementPdf() === pv.idPv"
                            (click)="afficherPdf(pv)">
                            {{ chargementPdf() === pv.idPv ? 'Chargement…' : '📄 Afficher le PV' }}
                          </button>
                        } @else {
                          <button type="button" class="btn btn-primary btn-sm" disabled
                            title="Document non disponible pour ce PV">📄 Afficher le PV</button>
                        }
                      } @else if (estReferenceComplete(pv.refePv || pv.referencePv)) {
                        <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirDetailPv(pv)">Voir détails</button>
                      } @else {
                        <button type="button" class="btn btn-secondary btn-sm" disabled
                          title="Référence incomplète — contactez l'administrateur">Voir détails</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-muted">Aucun PV définitif.</p>
      }
    </section>

    @if (detail(); as pv) {
      <app-detail-pv-modal [pv]="pv" (fermer)="detail.set(null)" />
    }

    <!-- ⚠️ 2026-08-02 (PRMP) — visionneuse du PDF officiel signé, affichée directement au clic. -->
    @if (apercu(); as ap) {
      <div class="modal-backdrop" [class.closing]="closingApercu()" (click)="fermerApercuAnime()">
        <div class="modal modal-lg pvd__viewer" role="dialog" aria-modal="true" aria-label="Visionneuse du PV définitif" appModale (appModaleFermer)="fermerApercuAnime()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="pvd__viewer-top">
                <app-statut-badge [statut]="'SIGNE'" [label]="'Définitif'" />
                <span class="text-muted text-sm">Document officiel signé</span>
              </div>
              <h2 class="modal-title">{{ ap.reference }}</h2>
            </div>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerApercuAnime()">✕</button>
          </div>
          <div class="modal-body pvd__viewer-body">
            <iframe [src]="ap.url" [title]="ap.reference" class="pvd__viewer-frame"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .pvd__ref { font-weight: 700; color: var(--c-800); margin-right: 0.5rem; }
    .pvd__actions { justify-content: flex-end; }
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
  /** Animation de sortie du modal (voir `fermerAvecAnimation`). */
  readonly closingApercu = signal(false);
  /** Ferme le modal en jouant l'animation de sortie (voile, Échap, boutons). */
  fermerApercuAnime(): void {
    fermerAvecAnimation(this.closingApercu, () => this.fermerApercu());
  }

  private readonly service = inject(PvExamenService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly examenService = inject(ExamenService);
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  // — Jointures pour les colonnes du tableau (entité du dossier, noms des co-signataires) —
  private readonly examens = signal<Examen[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);
  /** idEntiteContract → libellé et imControleur → nom (repli identifiant si non chargé). */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());
  /** idExamen → dossier rattaché (chaîne examen → dispatch → réception → dossier, comme pv-page). */
  private readonly dossierByExamen = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((d) => [d.idDispatch, d]));
    const dosById = new Map(this.dossiers().map((d) => [d.idDossier, d]));
    const map = new Map<number, Dossier>();
    for (const e of this.examens()) {
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      const dos = rec ? dosById.get(rec.idDossier) : undefined;
      if (dos) map.set(e.idExamen, dos);
    }
    return map;
  });
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
    // UNE vague : PV + chaîne de jointure (chaque liste dégrade en silence si un profil n'y a pas accès).
    forkJoin({
      pvs: this.service.definitifs(),
      examens: this.examenService.list().pipe(catchError(() => of([] as Examen[]))),
      dispatchs: this.dispatchService.list().pipe(catchError(() => of([] as Dispatch[]))),
      receptions: this.receptionService.list().pipe(catchError(() => of([] as Reception[]))),
      dossiers: this.dossierService.list().pipe(catchError(() => of([] as Dossier[]))),
    }).subscribe({
      next: ({ pvs, examens, dispatchs, receptions, dossiers }) => {
        this.examens.set(examens);
        this.dispatchs.set(dispatchs);
        this.receptions.set(receptions);
        this.dossiers.set(dossiers);
        // Tri par date de signature décroissante (PV le plus récemment signé en tête).
        this.pvs.set([...pvs].sort((a, b) => this.dateSignature(b).localeCompare(this.dateSignature(a))));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont']).subscribe((m) => this.controleurMap.set(m));
  }

  /**
   * Dossier du PV : chaîne de jointure, avec REPLI par référence pour les profils dont la chaîne
   * est servie vide (ex. PRMP) — `refePv` = `refeDossier` avec « /PV » avant l'année (contrat).
   */
  private dossierDuPv(pv: PvExamen): Dossier | undefined {
    const parChaine = this.dossierByExamen().get(pv.idExamen);
    if (parChaine) return parChaine;
    const ref = (pv.refePv || '').replace('/PV/', '/');
    return ref ? this.dossiers().find((d) => d.refeDossier === ref) : undefined;
  }

  /** Entité contractante du dossier du PV (« — » si indisponible). */
  entiteDe(pv: PvExamen): string {
    const d = this.dossierDuPv(pv);
    return d?.idEntiteContract != null ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract : '—';
  }

  /** Date du PV (repli : dernière signature si datePv absent). */
  datePvDe(pv: PvExamen): string {
    return pv.datePv || this.dateSignature(pv);
  }

  /**
   * Co-signataires du PV : chaque part effectivement signée (Membre, Chef de commission, Président),
   * nom résolu depuis la fiche contrôleur (repli matricule).
   */
  coSignataires(pv: PvExamen): string {
    const nom = (im?: string) => (im ? this.controleurMap().get(im) ?? im : '');
    const parts: string[] = [];
    if (pv.dateSignatureMembre && pv.imCtrlMembre) parts.push(`${nom(pv.imCtrlMembre)} (Membre)`);
    if (pv.dateSignatureCc && pv.imCtrlCc) parts.push(`${nom(pv.imCtrlCc)} (Chef de commission)`);
    if (pv.dateSignaturePresident && pv.imCtrlPresident) parts.push(`${nom(pv.imCtrlPresident)} (Président)`);
    return parts.length ? parts.join(' · ') : '—';
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
        const brute = urlBlobSure(blob);
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
