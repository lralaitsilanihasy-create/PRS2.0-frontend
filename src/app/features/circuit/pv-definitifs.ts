import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { PvExamen } from '../../models';
import { AvisService, ControleurService, PvExamenService, ReferenceLookupService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * « PV définitifs » (MEMBRE / PRESIDENT / CHEF_COMMISSION) — **LECTURE SEULE**.
 * Liste les PV **signés** via `GET /api/pv-examens/definitifs` (complément de « Projets de PV » qui
 * n'expose plus les signés), triés par date de signature décroissante. Aucune action de workflow.
 */
@Component({
  selector: 'app-pv-definitifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="pvd">
      <header class="pvd__header">
        <h1 class="pvd__title">PV définitifs</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (pvs().length) {
        <ul class="pvd__list">
          @for (pv of pvs(); track pv.idPv) {
            <li class="cnm-card pvd__item">
              <div class="pvd__head">
                <span class="pvd__ref">{{ pv.refePv || pv.referencePv || ('PV #' + pv.idPv) }}</span>
                <span class="pvd__date cnm-mono">{{ dateSignature(pv) || '—' }}</span>
                <app-statut-badge [statut]="pv.statutPv" [label]="'Définitif'" />
                <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm pvd__details" (click)="basculer(pv)">
                  {{ ouvert()?.idPv === pv.idPv ? 'Masquer' : 'Voir détails' }}
                </button>
              </div>

              @if (ouvert()?.idPv === pv.idPv) {
                <dl class="pvd__info">
                  <div><dt>Avis</dt><dd>{{ avisLabel(pv.idAvis) }}</dd></div>
                  <div><dt>Navettes</dt><dd>{{ pv.nbNavettes }}</dd></div>
                  @if (pv.dateSoumissionInitiale) { <div><dt>Soumis le</dt><dd class="cnm-mono">{{ pv.dateSoumissionInitiale }}</dd></div> }
                  @if (pv.dateAcceptation) { <div><dt>Accepté le</dt><dd class="cnm-mono">{{ pv.dateAcceptation }}</dd></div> }
                  @if (pv.datePv) { <div><dt>Date PV</dt><dd class="cnm-mono">{{ pv.datePv }}</dd></div> }
                  <div><dt>Membre</dt><dd>{{ signataire(pv.imCtrlMembre, pv.dateSignatureMembre) }}</dd></div>
                  <div><dt>Chef de commission</dt><dd>{{ signataire(pv.imCtrlCc, pv.dateSignatureCc) }}</dd></div>
                  <div><dt>Président</dt><dd>{{ signataire(pv.imCtrlPresident, pv.dateSignaturePresident) }}</dd></div>
                </dl>
                @if (pv.syntheseObservations) {
                  <p class="pvd__synthese"><strong>Synthèse :</strong> {{ pv.syntheseObservations }}</p>
                }
              }
            </li>
          }
        </ul>
      } @else {
        <p class="cnm-muted">Aucun PV définitif.</p>
      }
    </section>
  `,
  styles: `
    .pvd__header { margin-bottom: var(--cnm-space-3); }
    .pvd__title { margin: 0; font-size: var(--cnm-fs-lg); }
    .pvd__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .pvd__item { padding: var(--cnm-space-3) var(--cnm-space-4); }
    .pvd__head { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .pvd__ref { font-weight: var(--cnm-fw-semibold); }
    .pvd__date { color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .pvd__details { margin-left: auto; }
    .pvd__info { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: var(--cnm-space-2) 0 0; }
    .pvd__info > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .pvd__info dt { flex: 0 0 11rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.06em; color: var(--cnm-text-3); }
    .pvd__info dd { margin: 0; color: var(--cnm-text); }
    .pvd__synthese { margin: var(--cnm-space-2) 0 0; font-size: var(--cnm-fs-sm); }
  `,
})
export class PvDefinitifs {
  private readonly service = inject(PvExamenService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(true);
  readonly pvs = signal<PvExamen[]>([]);
  readonly ouvert = signal<PvExamen | null>(null);
  private readonly avisMap = signal<Map<string, string>>(new Map());
  private readonly controleurMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups.lookup(AvisService, 'idAvis', ['libelleAvis']).subscribe((m) => this.avisMap.set(m));
    this.lookups
      .lookup(ControleurService, 'imControleur', ['nomCont', 'prenomsCont'])
      .subscribe((m) => this.controleurMap.set(m));

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

  basculer(pv: PvExamen): void {
    this.ouvert.update((cur) => (cur?.idPv === pv.idPv ? null : pv));
  }

  avisLabel(id: string): string {
    return this.avisMap().get(id) ?? id;
  }
  /** Signataire : nom du contrôleur (+ date si présente), ou « — ». */
  signataire(im?: string, date?: string): string {
    if (!im) {
      return '—';
    }
    const nom = this.controleurMap().get(im) ?? im;
    return date ? `${nom} · signé le ${date}` : nom;
  }
}
