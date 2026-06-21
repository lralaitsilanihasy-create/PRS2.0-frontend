import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Dossier } from '../../models';
import {
  DossierService,
  EntiteContractService,
  NotificationService,
  ReceptionService,
  ReferenceLookupService,
  VerificationService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierConsultation } from '../circuit/dossier-consultation';

/** Une ligne d'historique : observation envoyée par le vérificateur ou rectification reçue de la PRMP. */
interface Echange {
  type: 'obs' | 'rectif';
  texte: string;
  date: string;
}
/** Carte = un dossier en attente + l'historique de ses échanges (trié DESC). */
interface CarteAttente {
  dossier: Dossier;
  echanges: Echange[];
}

/**
 * « En attente de rectification PRMP » (vérificateur) — LECTURE SEULE.
 * Pour chaque dossier EN_ATTENTE_DECISION_PRMP (GET /api/dossiers/en-attente-prmp), affiche l'historique
 * des échanges : observations envoyées (GET /api/verifications — `observation`/`dateVerif` ; la notif
 * `OBSERVATION_VERIFICATION` est adressée à la PRMP, pas au vérificateur) et rectifications reçues
 * (notifications `RECTIFICATION_PRMP`). Aucune action (le dossier est verrouillé côté vérificateur).
 */
@Component({
  selector: 'app-en-attente-prmp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge, DossierConsultation],
  template: `
    <section class="ep">
      <header class="ep__header">
        <span class="cnm-section-label">Domaine Vérificateur</span>
        <h1 class="ep__title">En attente de rectification PRMP</h1>
      </header>

      <div class="cnm-card ep__note">
        Dossiers transmis à la PRMP pour rectification (lecture seule). Suivez l'historique de vos
        observations envoyées et des rectifications reçues.
      </div>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else if (cartes().length) {
        <ul class="ep__list">
          @for (c of cartes(); track c.dossier.idDossier) {
            <li class="cnm-card ep__item">
              <div class="ep__item-head">
                <span class="ep__ref">{{ c.dossier.refeDossier || ('Dossier #' + c.dossier.idDossier) }} · {{ entiteLabel(c.dossier) }}</span>
                <app-statut-badge [statut]="c.dossier.statut" [label]="'À rectifier'" />
                <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm ep__details" (click)="consulte.set(c.dossier)">
                  Voir détails
                </button>
              </div>

              <div class="ep__hist">
                <h3 class="ep__hist-title">Historique des échanges</h3>
                @if (c.echanges.length) {
                  <ul class="ep__ech">
                    @for (e of c.echanges; track $index; let last = $last) {
                      <li
                        class="ep__ech-item"
                        [class.ep__ech-item--latest]="last && e.type === 'obs'"
                        [class.ep__ech-item--rectif]="e.type === 'rectif'"
                      >
                        <span class="ep__ech-meta cnm-mono">
                          {{ e.date || '—' }} · {{ e.type === 'obs' ? 'Observation envoyée' : 'Rectification PRMP reçue' }}
                        </span>
                        <span class="ep__ech-text">{{ e.texte }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="cnm-muted">Aucun échange enregistré.</p>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="cnm-muted">Aucun dossier en attente de rectification PRMP.</p>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .ep__header { margin-bottom: var(--cnm-space-3); }
    .ep__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .ep__note { padding: var(--cnm-space-3) var(--cnm-space-4); color: var(--cnm-text-2); margin-bottom: var(--cnm-space-3); }
    .ep__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .ep__item { padding: var(--cnm-space-3) var(--cnm-space-4); }
    .ep__item-head { display: flex; align-items: center; gap: var(--cnm-space-2); }
    .ep__ref { font-weight: var(--cnm-fw-semibold); }
    .ep__details { margin-left: auto; }
    .ep__hist { margin-top: var(--cnm-space-2); }
    .ep__hist-title { margin: 0 0 var(--cnm-space-1); font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .ep__ech { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cnm-space-1); }
    .ep__ech-item { display: flex; flex-direction: column; gap: 2px; padding: var(--cnm-space-1) var(--cnm-space-2); border-left: 2px solid var(--cnm-border); }
    .ep__ech-item--latest { border-left-color: var(--cnm-brand); font-weight: var(--cnm-fw-semibold); color: var(--cnm-brand); }
    .ep__ech-item--rectif { border-left-color: var(--cnm-warning-fg); }
    .ep__ech-meta { color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .ep__ech-text { font-size: var(--cnm-fs-sm); }
  `,
})
export class EnAttentePrmp {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly verificationService = inject(VerificationService);
  private readonly notificationService = inject(NotificationService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly loading = signal(true);
  readonly cartes = signal<CarteAttente[]>([]);
  readonly consulte = signal<Dossier | null>(null);
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));

    forkJoin({
      dossiers: this.dossierService.enAttentePrmp(),
      receptions: this.receptionService.list(),
      verifications: this.verificationService.list(),
      notifs: this.notificationService.mes(),
    }).subscribe({
      next: ({ dossiers, receptions, verifications, notifs }) => {
        const dossierParReception = new Map<number, number>();
        receptions.forEach((r) => dossierParReception.set(r.idReception, r.idDossier));

        this.cartes.set(
          dossiers.map((d) => {
            const obs: Echange[] = verifications
              .filter((v) => v.observation && dossierParReception.get(v.idReception) === d.idDossier)
              .map((v) => ({ type: 'obs' as const, texte: v.observation as string, date: v.dateVerif ?? '' }));
            const rectif: Echange[] = notifs
              .filter((n) => n.typeNotif === 'RECTIFICATION_PRMP' && n.idDossier === d.idDossier && n.corps)
              .map((n) => ({ type: 'rectif' as const, texte: n.corps as string, date: n.dateEnvoi ?? '' }));
            const echanges = [...obs, ...rectif].sort((a, b) => a.date.localeCompare(b.date));
            return { dossier: d, echanges };
          }),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
}
