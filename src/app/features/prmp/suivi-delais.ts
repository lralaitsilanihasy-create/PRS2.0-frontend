import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';

import { Dossier, Reception } from '../../models';
import { DossierService, ReceptionService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { DossierConsultation } from '../circuit/dossier-consultation';

/**
 * ⚠️ Demande pilote (2026-09-06) — le « Tableau de bord » PRMP devient « SUIVI DES DOSSIERS CNM » :
 * un tableau par dossier déposé — référence, date d'ENREGISTREMENT CNM (la réception par le
 * Secrétaire, premier passage) et FIN DE TRAITEMENT prévue (chronométrage serveur,
 * `datePrevisionnelleFin` ; ⏸ quand la balle est chez la PRMP et que la date glisse).
 * Précisé le jour même : PAS de colonne Statut — l'écran suit les dates, rien d'autre.
 */
@Component({
  selector: 'app-suivi-delais',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EtatErreur, DossierConsultation],
  template: `
    <section>
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Suivi des dossiers CNM</h1>
        </div>
      </header>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger le suivi des délais." (reessayer)="charger()" />
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <!-- ⚠️ Demande pilote (2026-09-06, précisée) : PAS de colonne Statut ici — l'écran
                   suit les DATES, le statut se lit dans « Mes dossiers » et la consultation. -->
              <tr>
                <th scope="col">Référence</th>
                <th scope="col">Dépôt du dossier</th>
                <th scope="col">Enregistrement CNM</th>
                <th scope="col">Fin traitement CNM</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiers(); track d.idDossier) {
                <tr>
                  <td>{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</td>
                  <!-- ⚠️ Terme métier (pilote 2026-09-06) : la date de SOUMISSION est la date de
                       DÉPÔT du dossier — même donnée (champ demandé au backend, « — » sinon). -->
                  <td class="cnm-mono">{{ d.dateSoumission ? (d.dateSoumission | date: 'dd/MM/yyyy') : '—' }}</td>
                  <!-- Enregistrement = réception du dossier par le Secrétaire (premier passage). -->
                  <td class="cnm-mono">{{ enregistrement(d) ? (enregistrement(d) | date: 'dd/MM/yyyy') : '—' }}</td>
                  <!-- ⚠️ Demande pilote (2026-09-07) : la « Fin traitement CNM » est une PROJECTION serveur
                       (aujourd'hui + durée standard restante) présente dès la soumission. On la MASQUE tant que
                       le dossier n'est pas ENREGISTRÉ : le traitement CNM n'a pas encore commencé (le compteur
                       démarre à l'enregistrement = debutCompteur), afficher une fin avant serait trompeur. -->
                  <td class="cnm-mono">
                    @if (enregistrement(d)) {
                      @if (d.datesEtapes?.['CLOTURE']; as clot) {
                        <span class="cnm-fin-cloture">{{ clot | date: 'dd/MM/yyyy HH:mm' }}</span>
                      } @else if (d.datePrevisionnelleFin) {
                        {{ d.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}
                      } @else { — }
                      @if (d.attentePrmp) {
                        <span class="sdl-attente" title="En attente de votre action (compléments, pièces ou rectification) — la date prévisionnelle glisse tant que le dossier ne revient pas à la CNM.">⏸ à vous</span>
                      }
                    } @else {
                      —
                    }
                  </td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="consulte.set(d)">Voir détails</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-cell">Aucun dossier déposé à la CNM.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (consulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="consulte.set(null)" />
    }
  `,
  styles: `
    .sdl-attente { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-full); background: var(--warning-bg, #fffbeb); border: 1px solid var(--warning-bdr, #fde68a); color: var(--warning-text, #92400e); font-size: var(--text-xs); white-space: nowrap; }
  `,
})
export class SuiviDelais {
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  private readonly tous = signal<Dossier[]>([]);
  /** Réception INITIALE par dossier (premier passage du Secrétaire). */
  private readonly receptions = signal<Map<number, Reception>>(new Map());
  /** Dossier ouvert en consultation lecture seule (null = fermé). */
  readonly consulte = signal<Dossier | null>(null);

  /** Dossiers DÉPOSÉS (les brouillons n'ont ni enregistrement ni délai CNM), plus récents d'abord. */
  readonly dossiers = computed(() =>
    this.tous()
      .filter((d) => d.statut !== 'BROUILLON')
      .sort((a, b) => b.idDossier - a.idDossier),
  );

  constructor() {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    forkJoin({
      dossiers: this.dossierService.list(),
      receptions: this.receptionService.list().pipe(catchError(() => of([] as Reception[]))),
    }).subscribe({
      next: ({ dossiers, receptions }) => {
        this.tous.set(dossiers);
        const parDossier = new Map<number, Reception>();
        for (const r of receptions) {
          const connue = parDossier.get(r.idDossier);
          if (!connue || (r.numPassage ?? 99) < (connue.numPassage ?? 99)) {
            parDossier.set(r.idDossier, r);
          }
        }
        this.receptions.set(parDossier);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /**
   * Date d'enregistrement CNM : le champ du DTO dossier dès que le backend le sert
   * (demande 2026-09-06), en repli la réception du premier passage quand elle est lisible.
   */
  enregistrement(d: Dossier): string | null {
    return d.dateEnregistrement ?? this.receptions().get(d.idDossier)?.dateReception ?? null;
  }
}
