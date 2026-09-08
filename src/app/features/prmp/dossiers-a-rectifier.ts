import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';

import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification, ObservationPv } from '../../models';
import {
  DossierService,
  EntiteContractService,
  LocaliteService,
  NotificationService,
  ObservationPvService,
  ReferenceLookupService,
  SousTypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';
import { DossierModificationStore } from './dossier-modification.store';

/** Une carte « à rectifier » = un dossier EN_ATTENTE_DECISION_PRMP + ses observations non satisfaites. */
interface CarteRectif {
  dossier: Dossier;
  /** Observations OBSERVATION_VERIFICATION du dossier, triées par date décroissante (plus récente d'abord). */
  observations: Notification[];
  /** Observation la plus récente (en-tête de carte + clé d'isolement du champ motif). */
  latest?: Notification;
  /** ⚠️ 2026-08-15 — observations du PV restées NON SATISFAITES (≠ LEVEE), affichées en tableau. */
  obsPv: ObservationPv[];
}

/**
 * « Dossiers à rectifier » (PRMP) : **une seule carte par dossier** EN_ATTENTE_DECISION_PRMP, alimentée par
 * `GET /api/dossiers?statut=EN_ATTENTE_DECISION_PRMP`. Les observations du vérificateur (notifications
 * OBSERVATION_VERIFICATION du dossier) sont **regroupées** dans un historique trié décroissant, la plus
 * récente mise en évidence. ⚠️ Écran unique (2026-09-07) : « Ouvrir » mène directement à l'écran
 * « Rectifier le dossier » (prise en charge + import + description + resoumettre) — plus de modale.
 */
@Component({
  selector: 'app-dossiers-a-rectifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, DatePipe],
  template: `
    <section>
      <header class="page-header page-header--actions" [class.page-header--colle]="encastre">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Dossiers à rectifier</h1>
        </div>
        <a class="btn btn-retour-hub" routerLink="/prmp/dossiers">← Mes dossiers</a>
      </header>

      <div class="alert alert-info">
        Observations transmises par le vérificateur. Corrigez le dossier concerné, puis resoumettez-le.
      </div>

      @if (typeFiltre(); as t) {
        <p class="text-muted">Filtré sur le type <strong>{{ t }}</strong> — <a [routerLink]="[]" [queryParams]="{}">tout afficher</a></p>
      }
      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <!-- MÊME tableau que la liste des dossiers (Déposés…) : table-card à 7 colonnes.
             ⚠️ Écran unique (2026-09-07) — « Ouvrir » mène à l'écran « Rectifier le dossier »
             (prise en charge + import + description + resoumettre), plus de modale. -->
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th><th scope="col">Entité contractante</th><th scope="col">Statut</th><th scope="col">Sous-type</th><th scope="col">Localité</th><th scope="col">Fin traitement CNM</th><th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of cartesAffichees(); track c.dossier.idDossier) {
                <tr [class.cnm-row-cloture]="c.dossier.datesEtapes?.['CLOTURE']">
                  <td>{{ c.dossier.refeDossier || ('Dossier #' + c.dossier.idDossier) }}</td>
                  <td>{{ entiteLabel(c.dossier) }}</td>
                  <td><app-statut-badge [statut]="c.dossier.statut" [label]="'À rectifier'" /></td>
                  <td>{{ sousTypeLabel(c.dossier) }}</td>
                  <td>{{ localiteLabel(c.dossier) }}</td>
                  <td class="cnm-mono">
                    <!-- ⚠️ 2026-09-08 (règle pilote, valable partout) — dossier CLOS : date de CLÔTURE
                         avec l'heure (datesEtapes.CLOTURE) ; sinon la projection (jour). -->
                    @if (c.dossier.datesEtapes?.['CLOTURE']; as clot) {
                      <span class="cnm-fin-cloture">{{ clot | date: 'dd/MM/yyyy HH:mm' }}</span>
                    } @else if (c.dossier.datePrevisionnelleFin) {
                      {{ c.dossier.datePrevisionnelleFin | date: 'dd/MM/yyyy' }}
                    } @else { — }
                    @if (c.dossier.attentePrmp) {
                      <span class="ar-attente" title="En attente de votre rectification — la date prévisionnelle glisse tant que le dossier ne revient pas à la CNM.">⏸ à vous</span>
                    }
                  </td>
                  <td>
                    <div class="td-actions actions-end">
                      <span class="ar-item__nb">{{ c.obsPv.length }} obs.</span>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="modifierDossier(c)">Ouvrir</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty-cell">Aucun dossier à rectifier.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

  `,
  styles: `
    .ar-item__nb { color: var(--warning-text); font-size: var(--text-xs); font-weight: 700; white-space: nowrap; }
    .ar-attente { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-full); background: var(--warning-bg, #fffbeb); border: 1px solid var(--warning-bdr, #fde68a); color: var(--warning-text, #92400e); font-size: var(--text-xs); white-space: nowrap; }
  `,
})
export class DossiersARectifier {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);
  private readonly observationPvService = inject(ObservationPvService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly modifications = inject(DossierModificationStore);
  private readonly lookups = inject(ReferenceLookupService);
  /** Libellés des colonnes du tableau (référentiels en cache partagé). */
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly sousTypeMap = signal<Map<string, string>>(new Map());

  private readonly route = inject(ActivatedRoute);
  /** Rendu SOUS les cartes de « Mes dossiers » (route enfant) : l'en-tête se colle alors sous la
   *  topbar pour que le bouton de retour ne bouge pas quand la liste défile. */
  protected readonly encastre = this.route.snapshot.data['encastre'] === true;
  readonly loading = signal(true);
  /** Une carte par dossier EN_ATTENTE_DECISION_PRMP (dédoublonné par dossier). */
  readonly cartes = signal<CarteRectif[]>([]);
  /** ⚠️ Demande user (2026-08-02) — filtre par type (`?type=DDP…`) depuis les cartes « Mes dossiers ». */
  readonly typeFiltre = signal<string | null>(null);
  readonly cartesAffichees = computed(() => {
    const t = this.typeFiltre();
    return t ? this.cartes().filter((c) => c.dossier.idTypeDossier === t) : this.cartes();
  });


  constructor() {
    this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(SousTypeDossierService, 'idSousType', ['libelleSousType']).subscribe((m) => this.sousTypeMap.set(m));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => this.typeFiltre.set(q.get('type')));
    this.charger();
  }

  /**
   * ⚠️ Règle durcie (2026-09-06) : la rectification de cette carte a-t-elle été réellement
   * ENREGISTRÉE (import de PPM rectifié validé) ? C'est elle qui active « Resoumettre ».
   */
  estModifie(c: CarteRectif): boolean {
    return this.modifications.estRectifie(c.dossier.idDossier);
  }

  /**
   * Clic « Modifier le dossier » : navigue vers le **formulaire de rectification restreint** du
   * dossier concerné, avec un `returnUrl` vers « Dossiers à rectifier ». C'est l'ENREGISTREMENT
   * de l'import là-bas qui posera le drapeau « rectifié » — pas le simple aller-retour.
   */
  modifierDossier(c: CarteRectif): void {
    this.router.navigate(['/prmp/rectifier', c.dossier.idDossier], {
      queryParams: { returnUrl: '/prmp/a-rectifier' },
    });
  }

  private charger(): void {
    this.loading.set(true);
    forkJoin({
      dossiers: this.dossierService.list('EN_ATTENTE_DECISION_PRMP'),
      notifs: this.notificationService.mes(),
    }).subscribe({
      next: ({ dossiers, notifs }) => {
        // Regroupe les observations du vérificateur par dossier (idDossier, repli idObjet).
        const parDossier = new Map<number, Notification[]>();
        for (const n of notifs.filter((x) => x.typeNotif === 'OBSERVATION_VERIFICATION')) {
          const id = n.idDossier ?? n.idObjet;
          if (id == null) {
            continue;
          }
          const arr = parDossier.get(id);
          if (arr) {
            arr.push(n);
          } else {
            parDossier.set(id, [n]);
          }
        }
        // Tri des observations de chaque dossier par date décroissante (plus récente d'abord).
        for (const arr of parDossier.values()) {
          arr.sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? ''));
        }
        // Une carte par dossier EN_ATTENTE_DECISION_PRMP, avec ses observations du PV NON SATISFAITES
        // (≠ LEVEE — le périmètre est figé au PV, une levée est définitivement acquise).
        const aRectifier = dossiers.filter((d) => d.statut === 'EN_ATTENTE_DECISION_PRMP');
        if (!aRectifier.length) {
          this.cartes.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin(
          aRectifier.map((d) => this.observationPvService.parDossier(d.idDossier).pipe(catchError(() => of([] as ObservationPv[])))),
        ).subscribe((obsParDossier) => {
          const cartes: CarteRectif[] = aRectifier
            .map((d, i) => {
              const observations = parDossier.get(d.idDossier) ?? [];
              const obsPv = obsParDossier[i].filter((o) => o.statut !== 'LEVEE');
              return { dossier: d, observations, latest: observations[0], obsPv };
            })
            .sort((a, b) => (b.latest?.dateEnvoi ?? '').localeCompare(a.latest?.dateEnvoi ?? ''));
          this.cartes.set(cartes);
          this.loading.set(false);
        });
      },
      error: () => this.loading.set(false),
    });
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  /** Libellé du sous-type (repli sur le code ; « — » si non renseigné). */
  sousTypeLabel(d: Dossier): string {
    return d.idSousType ? this.sousTypeMap().get(d.idSousType) ?? d.idSousType : '—';
  }

}
