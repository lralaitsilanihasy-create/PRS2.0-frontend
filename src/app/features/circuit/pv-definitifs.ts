import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { PvExamen } from '../../models';
import { PvExamenService } from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DetailPvModal } from './detail-pv-modal';

/**
 * « PV définitifs » (MEMBRE / PRESIDENT / CHEF_COMMISSION) — **LECTURE SEULE**.
 * Liste les PV **signés** via `GET /api/pv-examens/definitifs` (complément de « Projets de PV » qui
 * n'expose plus les signés), triés par date de signature décroissante. Aucune action de workflow.
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
                @if (estReferenceComplete(pv.refePv || pv.referencePv)) {
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
  `,
})
export class PvDefinitifs {
  private readonly service = inject(PvExamenService);

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  /** PV ouvert dans le modal de détail (null = fermé). */
  readonly detail = signal<PvExamen | null>(null);

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

  /** Référence complète = au moins 2 « / » (ex. 00006/PPM/CRM-ANT/PV/2026), pas « PV #N ». */
  estReferenceComplete(ref?: string): boolean {
    return !!ref && (ref.match(/\//g) || []).length >= 2;
  }
}
