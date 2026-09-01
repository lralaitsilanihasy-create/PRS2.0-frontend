import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dispatch, Dossier, Examen, PvExamen, Reception } from '../../models';
import {
  AvisService,
  DispatchService,
  DossierService,
  ExamenService,
  PvExamenService,
  ReceptionService,
  ReferenceLookupService,
} from '../../services';

/**
 * « PV reçus » (Assistant contrôleur) — **lecture seule** des PV définitifs (signés) reçus en copie.
 * Source : `GET /api/pv-examens/definitifs` (PV `SIGNE`, filtré localité côté serveur). Lien de
 * notification : `…/pv-examens/{idPv}` déplie le détail.
 *
 * NB : `GET /api/pv-examens` ne renvoie que les **projets** (≠ SIGNE) depuis le découpage projets/définitifs ;
 * on utilise donc `…/definitifs` pour afficher les PV reçus (signés).
 */
@Component({
  selector: 'app-pv-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pva">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine Assistant</div>
          <h1 class="page-title">PV reçus</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-card">
        <table>
          <thead>
            <tr><th scope="col">Référence PV</th><th scope="col">Dossier</th><th scope="col">Avis</th><th scope="col">Date signature</th><th scope="col">Archivage</th></tr>
          </thead>
          <tbody>
            @for (pv of pvs(); track pv.idPv) {
              <tr>
                <td>
                  <!-- <button> et non <tr (click)> : le dépliage du détail doit être atteignable au
                       clavier (AUDIT.md A4 — la règle ESLint ignore les <tr>). -->
                  <button
                    type="button"
                    class="pva__toggle"
                    [attr.aria-expanded]="ouvert() === pv.idPv"
                    [attr.aria-controls]="'pva-detail-' + pv.idPv"
                    (click)="basculer(pv)"
                  >
                    <span class="pva__chev" [class.is-open]="ouvert() === pv.idPv" aria-hidden="true">▾</span>
                    <span class="cnm-mono">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                  </button>
                </td>
                <td>{{ dossierRef(pv) }}</td>
                <td><span [class]="avisClasse(pv.idAvis)">{{ avisLabel(pv.idAvis) }}</span></td>
                <td class="cnm-mono">{{ dateSignature(pv) || '—' }}</td>
                <td>
                  <!-- ⚠️ Spec navette : archivage par l'Assistant (après transmission SIGMP) — clôt le dossier. -->
                  @if (pv.dateArchivage) {
                    <span class="badge badge-success">Archivé le {{ pv.dateArchivage }}</span>
                  } @else {
                    <!-- ⚠️ Rattachements (2026-09-01) — badge de CIBLAGE seulement (null = repli
                         localité, rien) ; le bouton reste offert à tout Assistant : pas de garde. -->
                    @if (cibleArchivage(pv); as c) {
                      <span class="pva__cible" [class.pva__cible--moi]="c.moi">
                        {{ c.moi ? 'À archiver par vous' : 'À archiver par ' + c.nom }}
                      </span>
                    }
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="archivage() === pv.idPv"
                      (click)="archiver(pv)">
                      {{ archivage() === pv.idPv ? 'Archivage…' : 'Archiver' }}
                    </button>
                  }
                </td>
              </tr>
              @if (ouvert() === pv.idPv) {
                <tr class="pva__detail">
                  <td colspan="5" [id]="'pva-detail-' + pv.idPv">
                    <dl class="pva__dl">
                      <div><dt>Référence</dt><dd class="cnm-mono">{{ pv.refePv || pv.referencePv || '—' }}</dd></div>
                      <div><dt>Dossier</dt><dd>{{ dossierRef(pv) }}</dd></div>
                      <div><dt>Avis</dt><dd>{{ avisLabel(pv.idAvis) }}</dd></div>
                      <div><dt>Date du PV</dt><dd class="cnm-mono">{{ pv.datePv || '—' }}</dd></div>
                      <div><dt>Signature membre</dt><dd class="cnm-mono">{{ pv.dateSignatureMembre || '—' }}</dd></div>
                      <div><dt>Signature CC</dt><dd class="cnm-mono">{{ pv.dateSignatureCc || '—' }}</dd></div>
                      <div><dt>Signature président</dt><dd class="cnm-mono">{{ pv.dateSignaturePresident || '—' }}</dd></div>
                      <div><dt>Secrétaire de séance</dt><dd>{{ pv.nomSecretaireSeance || '—' }}</dd></div>
                      @if (pv.syntheseObservations) {
                        <div><dt>Synthèse</dt><dd class="pva__synthese">{{ pv.syntheseObservations }}</dd></div>
                      }
                    </dl>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="5" class="text-muted">Aucun PV reçu.</td></tr>
            }
          </tbody>
        </table>
        </div>
      }
    </section>
  `,
  styles: `
    .pva__toggle { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0; background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .pva__chev { flex: none; color: var(--n-400); transition: transform 0.15s; }
    .pva__chev.is-open { transform: rotate(180deg); }
    /* Badge de ciblage (rattachements) : discret pour un collègue, accentué pour « les miens ». */
    .pva__cible {
      display: inline-block;
      margin-right: 0.5rem;
      font-size: var(--text-sm);
      color: var(--n-500);
      background: var(--c-50);
      border: 1px solid var(--c-100);
      border-radius: var(--radius-lg);
      padding: 0.1rem 0.55rem;
      white-space: nowrap;
    }
    .pva__cible--moi {
      color: var(--p-700, #1d4ed8);
      background: var(--p-50, #eff6ff);
      border-color: var(--p-200, #bfdbfe);
      font-weight: 600;
    }
    .pva__dl { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; }
    .pva__dl > div { display: flex; gap: 0.5rem; align-items: baseline; }
    .pva__dl dt { flex: 0 0 11rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .pva__dl dd { margin: 0; }
    .pva__synthese { white-space: pre-wrap; }
    .pva__detail > td { background: var(--c-50); }
  `,
})
export class PvAssistant {
  private readonly route = inject(ActivatedRoute);
  private readonly pvService = inject(PvExamenService);
  private readonly examenService = inject(ExamenService);
  private readonly dispatchService = inject(DispatchService);
  private readonly receptionService = inject(ReceptionService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);

  private readonly toast = inject(ToastService);
  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  readonly ouvert = signal<number | null>(null);
  /** idPv en cours d'archivage (bouton désactivé), null sinon. */
  readonly archivage = signal<number | null>(null);
  private readonly avisMap = signal<Map<string, string>>(new Map());

  /** ⚠️ Spec navette — archive le PV (l'archivage clôt le dossier) ; 409 explicite si SIGMP non transmis. */
  archiver(pv: PvExamen): void {
    this.archivage.set(pv.idPv);
    this.pvService.archiver(pv.idPv).subscribe({
      next: (maj) => {
        this.archivage.set(null);
        this.pvs.update((arr) => arr.map((p) => (p.idPv === maj.idPv ? maj : p)));
        this.toast.success('PV archivé — dossier clôturé.');
      },
      error: (e: ApiError) => {
        this.archivage.set(null);
        this.toast.error(e.message || 'Archivage impossible.');
      },
    });
  }

  private readonly examens = signal<Examen[]>([]);
  private readonly dispatchs = signal<Dispatch[]>([]);
  private readonly receptions = signal<Reception[]>([]);
  private readonly dossiers = signal<Dossier[]>([]);

  /** idExamen → dossier rattaché (PV → examen → dispatch → réception → dossier). */
  private readonly dossierByExamen = computed(() => {
    const recById = new Map(this.receptions().map((r) => [r.idReception, r]));
    const dispById = new Map(this.dispatchs().map((d) => [d.idDispatch, d]));
    const dosById = new Map(this.dossiers().map((d) => [d.idDossier, d]));
    const map = new Map<number, Dossier>();
    for (const e of this.examens()) {
      const disp = e.idDispatch != null ? dispById.get(e.idDispatch) : undefined;
      const rec = disp ? recById.get(disp.idReception) : undefined;
      const dos = rec ? dosById.get(rec.idDossier) : undefined;
      if (dos) {
        map.set(e.idExamen, dos);
      }
    }
    return map;
  });

  constructor() {
    const param = this.route.snapshot.paramMap.get('idPv');
    if (param) {
      this.ouvert.set(Number(param));
    }
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    forkJoin({
      pvs: this.pvService.definitifs(),
      examens: this.examenService.list(),
      dispatchs: this.dispatchService.list(),
      receptions: this.receptionService.list(),
      dossiers: this.dossierService.list(),
    }).subscribe({
      next: (r) => {
        this.examens.set(r.examens);
        this.dispatchs.set(r.dispatchs);
        this.receptions.set(r.receptions);
        this.dossiers.set(r.dossiers);
        // ⚠️ Rattachements (2026-09-01) — « les miens » (imAssistantCible = moi, non archivés) en
        // tête, puis l'ordre par date de signature (tri stable). Ciblage sans garde.
        const ref = this.auth.ref();
        this.pvs.set(
          [...r.pvs]
            .sort((a, b) => this.dateSignature(b).localeCompare(this.dateSignature(a)))
            .sort((a, b) => (this.estMaCible(b, ref) ? 1 : 0) - (this.estMaCible(a, ref) ? 1 : 0)),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Le PV (non archivé) est-il ciblé sur moi via son dossier (`imAssistantCible`) ? */
  private estMaCible(pv: PvExamen, ref: string | null): boolean {
    if (!ref || pv.dateArchivage) return false;
    return this.dossierByExamen().get(pv.idExamen)?.imAssistantCible === ref;
  }

  /** Badge de ciblage d'archivage — `null` (chaîne incomplète, repli localité) = aucun badge. */
  cibleArchivage(pv: PvExamen): { moi: boolean; nom: string } | null {
    const d = this.dossierByExamen().get(pv.idExamen);
    const im = d?.imAssistantCible;
    if (!im) return null;
    return { moi: im === this.auth.ref(), nom: d?.nomAssistantCible || im };
  }

  basculer(pv: PvExamen): void {
    this.ouvert.update((cur) => (cur === pv.idPv ? null : pv.idPv));
  }
  dossierRef(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d ? d.refeDossier || 'Dossier #' + d.idDossier : '—';
  }
  avisLabel(id?: string): string {
    return id ? this.avisMap().get(id) ?? id : '—';
  }
  /** Couleur du badge d'avis : FAV → vert, DEF → rouge, FAVR → orange, autres → neutre. */
  avisClasse(id?: string): string {
    const code = (id || '').toUpperCase();
    if (code.startsWith('FAVR')) {
      return 'badge badge-warning';
    }
    if (code.startsWith('FAV')) {
      return 'badge badge-success';
    }
    if (code.startsWith('DEF')) {
      return 'badge badge-danger';
    }
    return 'badge badge-neutral';
  }
  dateSignature(pv: PvExamen): string {
    const dates = [pv.dateSignatureMembre, pv.dateSignatureCc, pv.dateSignaturePresident, pv.datePv].filter(
      (d): d is string => !!d,
    );
    return dates.length ? dates.sort()[dates.length - 1] : '';
  }
}
