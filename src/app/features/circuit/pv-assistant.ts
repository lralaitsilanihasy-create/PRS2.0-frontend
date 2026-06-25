import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

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
      <header class="pva__header">
        <span class="cnm-section-label">Domaine Assistant</span>
        <h1 class="pva__title">PV reçus</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Référence PV</th><th>Dossier</th><th>Avis</th><th>Date signature</th></tr>
          </thead>
          <tbody>
            @for (pv of pvs(); track pv.idPv) {
              <tr class="pva__row" (click)="basculer(pv)">
                <td class="cnm-mono">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</td>
                <td>{{ dossierRef(pv) }}</td>
                <td><span class="cnm-badge" [class]="avisClasse(pv.idAvis)">{{ avisLabel(pv.idAvis) }}</span></td>
                <td class="cnm-mono">{{ dateSignature(pv) || '—' }}</td>
              </tr>
              @if (ouvert() === pv.idPv) {
                <tr class="pva__detail">
                  <td colspan="4">
                    <dl class="pva__dl">
                      <div><dt>Référence</dt><dd class="cnm-mono">{{ pv.refePv || pv.referencePv || '—' }}</dd></div>
                      <div><dt>Dossier</dt><dd>{{ dossierRef(pv) }}</dd></div>
                      <div><dt>Avis</dt><dd>{{ avisLabel(pv.idAvis) }}</dd></div>
                      <div><dt>Date du PV</dt><dd class="cnm-mono">{{ pv.datePv || '—' }}</dd></div>
                      <div><dt>Signature membre</dt><dd class="cnm-mono">{{ pv.dateSignatureMembre || '—' }}</dd></div>
                      <div><dt>Signature CC</dt><dd class="cnm-mono">{{ pv.dateSignatureCc || '—' }}</dd></div>
                      <div><dt>Signature président</dt><dd class="cnm-mono">{{ pv.dateSignaturePresident || '—' }}</dd></div>
                      @if (pv.syntheseObservations) {
                        <div><dt>Synthèse</dt><dd class="pva__synthese">{{ pv.syntheseObservations }}</dd></div>
                      }
                    </dl>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="4" class="cnm-muted">Aucun PV reçu.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .pva__header { margin-bottom: var(--cnm-space-3); }
    .pva__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .pva__row { cursor: pointer; }
    .pva__row:hover { background: var(--cnm-surface-2); }
    .pva__dl { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: 0; }
    .pva__dl > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .pva__dl dt { flex: 0 0 11rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .pva__dl dd { margin: 0; }
    .pva__synthese { white-space: pre-wrap; }
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

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  readonly ouvert = signal<number | null>(null);
  private readonly avisMap = signal<Map<string, string>>(new Map());

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
        this.pvs.set([...r.pvs].sort((a, b) => this.dateSignature(b).localeCompare(this.dateSignature(a))));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  basculer(pv: PvExamen): void {
    this.ouvert.update((cur) => (cur === pv.idPv ? null : pv.idPv));
  }
  dossierRef(pv: PvExamen): string {
    const d = this.dossierByExamen().get(pv.idExamen);
    return d ? d.refeDossier || 'Dossier #' + d.idDossier : '—';
  }
  avisLabel(id: string): string {
    return this.avisMap().get(id) ?? id;
  }
  /** Couleur du badge d'avis : FAV → vert, DEF → rouge, FAVR → orange, autres → neutre. */
  avisClasse(id: string): string {
    const code = (id || '').toUpperCase();
    if (code.startsWith('FAVR')) {
      return 'cnm-badge--warning';
    }
    if (code.startsWith('FAV')) {
      return 'cnm-badge--success';
    }
    if (code.startsWith('DEF')) {
      return 'cnm-badge--danger';
    }
    return 'cnm-badge--neutral';
  }
  dateSignature(pv: PvExamen): string {
    const dates = [pv.dateSignatureMembre, pv.dateSignatureCc, pv.dateSignaturePresident, pv.datePv].filter(
      (d): d is string => !!d,
    );
    return dates.length ? dates.sort()[dates.length - 1] : '';
  }
}
