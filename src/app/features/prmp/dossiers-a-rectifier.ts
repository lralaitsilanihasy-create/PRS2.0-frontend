import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, Notification, ObservationPv } from '../../models';
import { DossierService, NotificationService, ObservationPvService } from '../../services';
import { StatutBadge, decomposerObservation } from '../../shared/circuit';
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

/** Ligne du tableau des observations : libellé figé décomposé en colonnes. */
interface LigneObs {
  obs: ObservationPv;
  contexte: string;
  auLieuDe: string | null;
  lire: string | null;
  demande: string | null;
}

/**
 * « Dossiers à rectifier » (PRMP) : **une seule carte par dossier** EN_ATTENTE_DECISION_PRMP, alimentée par
 * `GET /api/dossiers?statut=EN_ATTENTE_DECISION_PRMP`. Les observations du vérificateur (notifications
 * OBSERVATION_VERIFICATION du dossier) sont **regroupées** dans un historique trié décroissant, la plus
 * récente mise en évidence. La PRMP saisit un motif de rectification puis resoumet le dossier.
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
        <p class="text-muted">Chargement…</p>
      } @else if (cartesAffichees().length) {
        <div class="ar-list">
          @for (c of cartesAffichees(); track c.dossier.idDossier) {
            <div class="card ar-item">
              <!-- ⚠️ Demande user (2026-08-15) — carte REPLIÉE par défaut : seule la ligne d'en-tête
                   est visible, le détail (tableau des observations + resoumission) s'ouvre au clic. -->
              <button type="button" class="ar-item__head" (click)="basculer(c)" [attr.aria-expanded]="estOuvert(c)">
                <span class="ar-item__ref">Dossier {{ c.dossier.refeDossier || '#' + c.dossier.idDossier }}</span>
                <app-statut-badge [statut]="c.dossier.statut" [label]="'À rectifier'" />
                <span class="ar-item__nb">{{ c.obsPv.length }} observation(s) à satisfaire</span>
                <span class="ar-item__date">{{ (c.latest?.dateEnvoi | date: 'dd/MM/yyyy HH:mm') || '—' }}</span>
                <span class="ar-item__chevron" [class.ar-item__chevron--ouvert]="estOuvert(c)" aria-hidden="true">›</span>
              </button>

              @if (estOuvert(c)) {
                <div class="ar-item__corps">
                  <div class="ar-item__actions">
                    <!-- Surbrillance demandée (2026-08-15) : c'est LE geste attendu de la PRMP. -->
                    <button type="button" class="btn ar-item__modifier" (click)="modifierDossier(c)">
                      ✎ Modifier le dossier
                    </button>
                    @if (c.latest) {
                      <span class="ar-item__meta">Dernière transmission : {{ (c.latest.dateEnvoi | date: 'dd/MM/yyyy HH:mm') || '—' }} · vérificateur {{ verificateurDe(c.latest) }}</span>
                    }
                  </div>

                  <h3 class="ar-hist__title">Observations du PV restées non satisfaites</h3>
                  @if (lignesObs(c).length) {
                    <div class="table-card ar-table">
                      <table>
                        <thead>
                          <tr>
                            <th>N°</th>
                            <th>Origine</th>
                            <th>Observation</th>
                            <th>Au lieu de</th>
                            <th>Lire</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (l of lignesObs(c); track l.obs.idObservationPv; let i = $index) {
                            <tr>
                              <td class="cnm-mono">{{ i + 1 }}</td>
                              <td>{{ l.obs.source === 'PIECE' ? 'Pièce jointe' : 'Grille de contrôle' }}</td>
                              <td>
                                {{ l.contexte }}
                                @if (l.demande) { <div class="ar-table__demande">{{ l.demande }}</div> }
                              </td>
                              <td class="ar-table__avant">{{ l.auLieuDe ?? '—' }}</td>
                              <td class="ar-table__apres">{{ l.lire ?? '—' }}</td>
                              <td>
                                <span class="ar-table__statut" [class.ar-table__statut--maintenue]="l.obs.statut === 'MAINTENUE'">
                                  {{ statutObs(l.obs) }}
                                </span>
                                @if (l.obs.statut === 'MAINTENUE' && l.obs.precision) {
                                  <div class="ar-table__precision">« {{ l.obs.precision }} »</div>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="text-muted">Aucune observation restante — resoumettez après modification.</p>
                  }

                  <div class="form-group ar-form">
                    <label class="form-label required">Description des rectifications effectuées</label>
                    <textarea
                      class="form-control"
                      rows="2"
                      maxlength="255"
                      [value]="motif(cleDe(c))"
                      (input)="setMotif(cleDe(c), $any($event.target).value)"
                    ></textarea>
                    @if (errPour(cleDe(c))) { <span class="form-error">{{ errPour(cleDe(c)) }}</span> }
                  </div>
                  <div class="ar-item__foot">
                    @if (!estModifie(c)) {
                      <span class="form-hint">Veuillez modifier le dossier avant de resoumettre.</span>
                    }
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      [disabled]="saving() === cleDe(c) || !estModifie(c)"
                      (click)="demanderResoumission(c)"
                    >
                      {{ saving() === cleDe(c) ? 'Resoumission…' : 'Resoumettre le dossier' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <p class="text-muted">Aucun dossier à rectifier.</p>
      }
    </section>

    @if (confirmCle() !== null) {
      <div class="modal-backdrop" (click)="annulerResoumission()">
        <div class="modal confirm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="modal-header-plain">
            <span class="modal-title">Resoumettre au vérificateur ?</span>
            <button type="button" class="btn-close-plain" (click)="annulerResoumission()">✕</button>
          </div>
          <div class="modal-body">
            <p>Ce dossier sera renvoyé au vérificateur avec votre motif de rectification.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="annulerResoumission()">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="confirmerResoumission()">
              Confirmer la resoumission
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .ar-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .ar-item { padding: 0; border-left: 4px solid var(--warning-text); overflow: hidden; }
    /* En-tête cliquable (carte repliée par défaut). */
    .ar-item__head { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.85rem 1.25rem; border: 0; background: transparent; font: inherit; text-align: left; cursor: pointer; transition: var(--transition); }
    .ar-item__head:hover { background: var(--c-50); }
    .ar-item__ref { font-weight: 700; color: var(--c-800); font-size: var(--text-sm); }
    .ar-item__nb { color: var(--warning-text); font-size: var(--text-xs); font-weight: 700; }
    .ar-item__date { margin-left: auto; color: var(--n-400); font-size: var(--text-xs); }
    .ar-item__chevron { color: var(--n-400); font-weight: 700; transition: transform 0.15s ease; }
    .ar-item__chevron--ouvert { transform: rotate(90deg); }
    .ar-item__corps { padding: 0 1.25rem 1rem; }
    .ar-item__actions { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    /* ⚠️ Surbrillance demandée (2026-08-15) : bouton rempli ambre + halo — impossible à manquer. */
    .ar-item__modifier {
      background: #F59E0B; color: #fff; font-weight: 800; border: 0;
      box-shadow: 0 0 0 3px #FDE68A, 0 6px 14px rgba(180, 83, 9, 0.35);
    }
    .ar-item__modifier:hover { background: #D97706; color: #fff; box-shadow: 0 0 0 3px #FCD34D, 0 6px 14px rgba(180, 83, 9, 0.45); }
    .ar-item__meta { color: var(--n-400); font-size: var(--text-xs); }
    .ar-hist__title { margin: 0 0 0.4rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    /* Tableau des observations non satisfaites. */
    .ar-table table { width: 100%; }
    .ar-table__demande { color: var(--n-500); font-size: var(--text-xs); margin-top: 0.15rem; }
    .ar-table__avant { color: #B91C1C; text-decoration: line-through; }
    .ar-table__apres { color: #15803D; font-weight: 600; }
    .ar-table__statut { display: inline-block; font-size: var(--text-xs); font-weight: 700; padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--c-50); color: var(--n-500); white-space: nowrap; }
    .ar-table__statut--maintenue { background: var(--warning-bg); color: var(--warning-text); }
    .ar-table__precision { color: var(--warning-text); font-size: var(--text-xs); margin-top: 0.2rem; }
    .ar-form { margin-top: 0.75rem; }
    .ar-item__foot { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; }
    .confirm-modal { max-width: 28rem; }
  `,
})
export class DossiersARectifier {
  private readonly dossierService = inject(DossierService);
  private readonly notificationService = inject(NotificationService);
  private readonly observationPvService = inject(ObservationPvService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly modifications = inject(DossierModificationStore);

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

  /** Saisie du motif par carte (clé = cleDe(c), unique par dossier). */
  readonly motifs = signal<Record<number, string>>({});
  /** Erreurs de resoumission par carte (clé = cleDe(c)). */
  readonly errors = signal<Record<number, string>>({});
  /** Clé de carte en cours de resoumission (désactive son bouton). */
  readonly saving = signal<number | null>(null);
  /** Clé de la carte dont la confirmation est ouverte (null = fermée). */
  readonly confirmCle = signal<number | null>(null);

  constructor() {
    // Retour de l'édition du PPM : les dossiers ouverts en édition deviennent « modifiés ».
    this.modifications.consommerRetours();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => this.typeFiltre.set(q.get('type')));
    this.charger();
  }

  /** Le dossier de cette carte a-t-il été ouvert en édition puis re-visité ? (active « Resoumettre »). */
  estModifie(c: CarteRectif): boolean {
    return this.modifications.estModifie(c.dossier.idDossier);
  }

  /**
   * Clic « Modifier le dossier » : mémorise l'intention et navigue vers le **formulaire de rectification
   * restreint** du dossier concerné (`idDossier` de la carte), avec un `returnUrl` vers « Dossiers à rectifier ».
   */
  modifierDossier(c: CarteRectif): void {
    this.modifications.partirEnEdition(c.dossier.idDossier);
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

  /** Clé d'isolement du champ motif d'une carte = id de la dernière notification, sinon id du dossier. */
  cleDe(c: CarteRectif): number {
    return c.latest?.idNotification ?? c.dossier.idDossier;
  }

  // ── Dépliage (2026-08-15 : cartes repliées par défaut, détail au clic) ──
  /** idDossier des cartes dépliées. */
  private readonly ouverts = signal<Set<number>>(new Set());
  estOuvert(c: CarteRectif): boolean {
    return this.ouverts().has(c.dossier.idDossier);
  }
  basculer(c: CarteRectif): void {
    this.ouverts.update((s) => {
      const n = new Set(s);
      if (n.has(c.dossier.idDossier)) n.delete(c.dossier.idDossier);
      else n.add(c.dossier.idDossier);
      return n;
    });
  }

  /** Lignes du tableau : libellé figé décomposé (contexte / au lieu de / lire / demande libre). */
  lignesObs(c: CarteRectif): LigneObs[] {
    return c.obsPv.map((obs) => ({ obs, ...decomposerObservation(obs.libelle ?? '') }));
  }
  statutObs(o: ObservationPv): string {
    if (o.statut === 'MAINTENUE') return `Maintenue${o.iteration != null ? ' (itér. ' + o.iteration + ')' : ''}`;
    return 'Émise';
  }

  motif(cle: number): string {
    return this.motifs()[cle] ?? '';
  }
  setMotif(cle: number, v: string): void {
    this.motifs.update((m) => ({ ...m, [cle]: v }));
  }
  errPour(cle: number): string | undefined {
    return this.errors()[cle];
  }

  /** Vérifie le motif de CETTE carte puis ouvre la confirmation. */
  demanderResoumission(c: CarteRectif): void {
    const cle = this.cleDe(c);
    if (!this.estModifie(c)) {
      this.errors.update((e) => ({ ...e, [cle]: 'Veuillez modifier le dossier avant de resoumettre.' }));
      return;
    }
    if (!this.motif(cle).trim()) {
      this.errors.update((e) => ({ ...e, [cle]: 'Veuillez décrire les corrections apportées.' }));
      return;
    }
    this.errors.update((e) => ({ ...e, [cle]: '' }));
    this.confirmCle.set(cle);
  }
  annulerResoumission(): void {
    this.confirmCle.set(null);
  }
  /** Resoumet le dossier de la carte confirmée avec SON propre motif (EN_ATTENTE_DECISION_PRMP → EN_VERIFICATION). */
  confirmerResoumission(): void {
    const cle = this.confirmCle();
    if (cle == null) {
      return;
    }
    const c = this.cartes().find((x) => this.cleDe(x) === cle);
    this.confirmCle.set(null);
    if (!c) {
      return;
    }
    const idDossier = c.dossier.idDossier;
    this.saving.set(cle);
    this.dossierService.resoumettre(idDossier, { motifRectification: this.motif(cle).trim() }).subscribe({
      next: () => {
        this.toast.success('Dossier resoumis au vérificateur.');
        this.saving.set(null);
        this.modifications.reinitialiser(idDossier);
        this.motifs.update((mm) => {
          const n = { ...mm };
          delete n[cle];
          return n;
        });
        this.charger();
      },
      error: (e: ApiError) => {
        this.saving.set(null);
        const msg =
          e.status === 400
            ? 'Le motif de rectification est obligatoire.'
            : e.status === 409
              ? "Ce dossier n'est pas en attente de rectification."
              : e.message || 'Erreur lors de la resoumission.';
        this.errors.update((er) => ({ ...er, [cle]: msg }));
      },
    });
  }

  /** Matricule du vérificateur extrait du corps de la notification (« le vérificateur X a relevé… »). */
  verificateurDe(m: Notification): string {
    const match = /le vérificateur (\S+) a relevé/.exec(m.corps ?? '');
    return match ? match[1] : '—';
  }

}
