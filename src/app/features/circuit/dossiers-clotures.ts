import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, EchangeDto } from '../../models';
import { DossierService, EntiteContractService, ReferenceLookupService, SaisieService } from '../../services';
import { MesDossiers } from '../prmp/mes-dossiers';
import { StatutBadge } from '../../shared/circuit';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * « Dossiers vérifiés / clôturés » (Vérificateur) et « Dossiers vérifiés » (PRMP) — LECTURE SEULE.
 * Liste condensée des dossiers CLOTURE (une ligne par dossier, source serveur selon le profil via
 * `route.data.source`). Le fil chronologique des échanges (`GET /api/dossiers/{id}/historique-echanges`,
 * trié ASC) est masqué par défaut et chargé/affiché uniquement au clic sur le dossier (toggle).
 */
@Component({
  selector: 'app-dossiers-clotures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, EtatErreur],
  template: `
    <section class="dc">
      <header class="page-header page-header--actions" [class.page-header--colle]="encastre">
        <div>
          <div class="page-subtitle">{{ source === 'prmp-clotures' ? 'Domaine PRMP' : 'Domaine Vérificateur' }}</div>
          <h1 class="page-title">{{ titreAffiche() }}</h1>
        </div>
        <!-- Retour aux cartes « Mes dossiers » — uniquement pour la variante PRMP (écran partagé). -->
        @if (source === 'prmp-clotures') {
          <a class="btn btn-retour-hub" routerLink="/prmp/dossiers">← Mes dossiers</a>
        }
      </header>

      @if (!modeMaj() && typeFiltre(); as t) {
        <p class="text-muted">Filtré sur le type <strong>{{ t }}</strong> — <a [routerLink]="[]" [queryParams]="{}">tout afficher</a></p>
      }
      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les dossiers." (reessayer)="charger(pageIndex())" />
      } @else if (dossiersAffiches().length) {
        <ul class="dc__list">
          @for (d of dossiersAffiches(); track d.idDossier) {
            <li class="card dc__item">
              <button
                type="button"
                class="dc__head"
                [attr.aria-expanded]="estOuvert(d.idDossier)"
                (click)="basculer(d)"
              >
                <span class="dc__chevron" aria-hidden="true">{{ estOuvert(d.idDossier) ? '▾' : '▸' }}</span>
                <span class="dc__ref">{{ d.refeDossier || ('Dossier #' + d.idDossier) }} · {{ entiteLabel(d) }}</span>
                <!-- Statut réel : la liste PRMP couvre toute la phase de vérification (2026-08-03). -->
                <app-statut-badge [statut]="d.statut" />
              </button>

              <!-- ⚠️ 2026-08-05 — versionnement : la mise à jour n'est ouverte que sur un PPM dont la
                   Commission a rendu sa décision. Le backend refuse les autres cas (409) ; le bouton
                   n'apparaît donc que là où l'action aboutira. -->
              <!-- Bouton réservé à l'écran d'ACTION : « Dossiers vérifiés » reste en lecture seule. -->
              @if (source === 'prmp-clotures' && modeMaj() && majPossible(d)) {
                <div class="dc__maj">
                  @if (majEnCoursPour(d); as version) {
                    <!-- Une mise à jour est déjà ouverte sur ce plan : on la reprend, on n'en ouvre pas
                         une seconde (le serveur la refuserait, et ce serait incompréhensible). -->
                    <p class="dc__maj-reprise">Une mise à jour est en cours sur ce plan — rien n'est encore effectif.</p>
                    <div class="dc__maj-actions">
                      <a class="btn btn-primary btn-sm" [routerLink]="['/prmp/mise-a-jour', version]">Reprendre la mise à jour</a>
                    </div>
                  } @else if (majPour() === d.idDossier) {
                    <!-- Motif exigé AVANT toute création : c'est lui qui justifie la version dans l'historique. -->
                    <label class="dc__maj-label" [attr.for]="'motif-' + d.idDossier">
                      Motif de la mise à jour <span class="dc__maj-requis">obligatoire</span>
                    </label>
                    <textarea
                      class="form-control"
                      rows="2"
                      [id]="'motif-' + d.idDossier"
                      [value]="motifMaj()"
                      (input)="motifMaj.set($any($event.target).value)"
                      placeholder="Ce qui justifie cette nouvelle version du plan"
                    ></textarea>
                    <div class="dc__maj-actions">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="annulerMiseAJour()">Annuler</button>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="majEnCours() || !motifMaj().trim()" (click)="demarrerMiseAJour(d)">
                        {{ majEnCours() ? 'Création…' : 'Ouvrir la mise à jour' }}
                      </button>
                    </div>
                  } @else {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="ouvrirMotif(d)">
                      ✎ Mettre à jour ce PPM
                    </button>
                  }
                </div>
              }

              @if (estOuvert(d.idDossier)) {
                <div class="dc__hist">
                  @if (chargeEnCours(d.idDossier)) {
                    <p class="text-muted" role="status">Chargement de l'historique…</p>
                  } @else {
                    <h3 class="dc__hist-title">Historique des échanges</h3>
                    @if (echangesDe(d.idDossier).length) {
                      <ul class="dc__ech">
                        @for (e of echangesDe(d.idDossier); track $index; let last = $last) {
                          <li
                            class="dc__ech-item"
                            [class.dc__ech-item--rectif]="e.type === 'RECTIFICATION'"
                            [class.dc__ech-item--final]="last && e.obsLevees"
                          >
                            <span class="dc__ech-meta cnm-mono">{{ e.date }} · {{ e.acteur }}</span>
                            <span class="dc__ech-label">{{ e.type === 'OBSERVATION' ? 'Observation' : 'Rectification PRMP reçue' }}</span>
                            <span class="dc__ech-text">{{ e.texte }}</span>
                            @if (e.type === 'OBSERVATION' && e.obsLevees) {
                              <span class="badge badge-success">{{ last ? 'Dossier clôturé — observations levées' : 'Observations levées' }}</span>
                            }
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="text-muted">Aucun échange enregistré.</p>
                    }
                  }
                </div>
              }
            </li>
          }
        </ul>

        @if (source === 'verifies' && totalPages() > 1) {
          <div class="dc__pager">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="dc__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      } @else if (modeMaj()) {
        <p class="text-muted">
          Aucun plan n'est en état d'être mis à jour : la Commission doit d'abord avoir rendu sa décision.
        </p>
      } @else {
        <p class="text-muted">Aucun dossier clôturé.</p>
      }
    </section>
  `,
  styles: `
    .dc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .dc__item { padding: 0; overflow: hidden; }
    .dc__head { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.1rem; background: none; border: 0; cursor: pointer; text-align: left; font: inherit; color: inherit; }
    .dc__head:hover { background: var(--c-50); }
    .dc__chevron { color: var(--n-400); width: 1em; flex: none; }
    .dc__ref { font-weight: 700; color: var(--c-800); }
    .dc__hist { padding: 0 1.1rem 0.75rem; }
    .dc__hist-title { margin: 0 0 0.4rem; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-400); }
    .dc__ech { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .dc__ech-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; padding: 0.25rem 0.5rem; border-left: 2px solid var(--c-100); }
    .dc__ech-item--rectif { border-left-color: var(--warning-text); }
    .dc__ech-item--final { border-left-color: var(--success-text); background: var(--c-50); }
    .dc__ech-meta { color: var(--n-400); font-size: var(--text-xs); }
    .dc__ech-label { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--n-500); }
    .dc__ech-text { font-size: var(--text-sm); }
    .dc__pager { display: flex; align-items: center; gap: 0.75rem; justify-content: flex-end; margin-top: 0.75rem; }
    /* ⚠️ 2026-08-05 — ouverture d'une mise à jour de PPM (versionnement) : le motif est saisi en ligne. */
    .dc__maj { padding: 0 1.1rem 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
    .dc__maj-label { font-size: var(--text-sm); font-weight: 600; color: var(--n-600); }
    .dc__maj-requis { font-size: 0.7rem; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.04em; }
    .dc__maj textarea { width: min(40rem, 100%); }
    .dc__maj-actions { display: flex; gap: 0.4rem; }
    .dc__maj-reprise { margin: 0; color: var(--n-500); font-size: var(--text-sm); }
    .dc__pager-info { font-size: var(--text-sm); color: var(--n-400); }
  `,
})
export class DossiersClotures {
  private readonly route = inject(ActivatedRoute);
  /** Rendu SOUS les cartes de « Mes dossiers » (route enfant) : l'en-tête se colle alors sous la
   *  topbar pour que le bouton de retour ne bouge pas quand la liste défile. */
  protected readonly encastre = this.route.snapshot.data['encastre'] === true;
  private readonly router = inject(Router);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly saisieService = inject(SaisieService);
  private readonly toast = inject(ToastService);

  /**
   * ⚠️ 2026-08-05 — statuts depuis lesquels une mise à jour de PPM est ouverte : la Commission a rendu
   * sa décision, le PPM est en vigueur. Miroir de la garde serveur — le bouton ne doit pas proposer une
   * action que le backend refuserait.
   */
  private static readonly STATUTS_MAJ = new Set(['DECISION_TRANSMISE_SIGMP', 'CLOTURE']);
  readonly majEnCours = signal(false);
  /** Dossier dont le motif de mise à jour est en cours de saisie (panneau en ligne). */
  readonly majPour = signal<number | null>(null);
  readonly motifMaj = signal('');
  /** idDossier du plan → version en cours ouverte dessus (brouillon rattaché). */
  private readonly versionsEnCours = signal<Map<number, number>>(new Map());

  /** Version de mise à jour déjà ouverte sur ce plan, s'il y en a une. */
  majEnCoursPour(d: Dossier): number | undefined {
    return this.versionsEnCours().get(d.idDossier);
  }

  /** Seule une famille DDP (plan de passation) se versionne. */
  majPossible(d: Dossier): boolean {
    return d.idTypeDossier === 'DDP' && DossiersClotures.STATUTS_MAJ.has(d.statut ?? '');
  }

  ouvrirMotif(d: Dossier): void {
    this.majPour.set(d.idDossier);
    this.motifMaj.set('');
  }
  annulerMiseAJour(): void {
    this.majPour.set(null);
    this.motifMaj.set('');
  }

  /**
   * Ouvre la version suivante : crée le brouillon avec son motif, puis bascule sur son écran d'édition.
   * Le PPM en vigueur n'est pas touché à ce stade — il ne le sera qu'à la soumission de la version.
   */
  demarrerMiseAJour(d: Dossier): void {
    const motif = this.motifMaj().trim();
    if (!motif) {
      this.toast.error('Le motif de la mise à jour est obligatoire.');
      return;
    }
    this.majEnCours.set(true);
    this.saisieService.creerMiseAJour(d.idDossier, motif).subscribe({
      next: (version) => {
        this.majEnCours.set(false);
        void this.router.navigate(['/prmp/mise-a-jour', version.idDossier]);
      },
      error: (e: ApiError) => {
        this.majEnCours.set(false);
        this.toast.error(e.message || 'Mise à jour impossible.');
      },
    });
  }

  readonly source = this.route.snapshot.data['source'] as 'verifies' | 'prmp-clotures';
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Dossiers vérifiés';
  readonly loading = signal(true);
  /** Échec du chargement (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  readonly dossiers = signal<Dossier[]>([]);
  /** ⚠️ Demande user (2026-08-02) — filtre par type (`?type=DDP…`) depuis les cartes « Mes dossiers » (PRMP). */
  readonly typeFiltre = signal<string | null>(null);
  /**
   * ⚠️ 2026-08-05 (demande user) — deux entrées de menu menaient au MÊME écran, ce qui était trompeur.
   * `?maj=1` en fait un écran d'ACTION distinct : titre propre, liste réduite aux seuls PPM réellement
   * versionnables, et bouton de mise à jour proposé ici uniquement. Sans le paramètre, l'écran reste ce
   * qu'il était : la consultation, en lecture seule, de la phase de vérification.
   */
  readonly modeMaj = signal(false);
  readonly titreAffiche = computed(() => (this.modeMaj() ? 'Mettre à jour un PPM' : this.titre));
  readonly dossiersAffiches = computed(() => {
    const t = this.typeFiltre();
    const base = t ? this.dossiers().filter((d) => d.idTypeDossier === t) : this.dossiers();
    return this.modeMaj() ? base.filter((d) => this.majPossible(d)) : base;
  });
  /** Cache des fils par dossier (chargés à la demande) ; absence de clé = pas encore chargé. */
  private readonly historiques = signal<Record<number, EchangeDto[]>>({});
  /** Dossiers dont le fil est en cours de chargement. */
  private readonly chargement = signal<Set<number>>(new Set());
  /** Dossiers dépliés (plusieurs autorisés simultanément). */
  private readonly ouverts = signal<Set<number>>(new Set());
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;
  private readonly entiteMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.typeFiltre.set(q.get('type'));
      const maj = q.get('maj') === '1';
      this.modeMaj.set(maj);
      if (maj) {
        // Mises à jour DÉJÀ ouvertes : on propose de les reprendre plutôt que d'en ouvrir une seconde.
        this.dossierService.list('BROUILLON').subscribe((rows) => {
          const m = new Map<number, number>();
          for (const d of rows) {
            if (d.idDossierParent != null) {
              m.set(d.idDossierParent, d.idDossier);
            }
          }
          this.versionsEnCours.set(m);
        });
      }
    });
    this.charger(0);
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(page: number): void {
    this.loading.set(true);
    this.erreur.set(false);
    // Changement de page : on repart d'une liste condensée, sans fil déplié.
    this.ouverts.set(new Set());
    if (this.source === 'prmp-clotures') {
      // ⚠️ Demande user (2026-08-03) — « Vérifiés » (PRMP) couvre TOUTE la phase de vérification :
      // un dossier rectifié puis resoumis (EN_VERIFICATION) y figure, jusqu'à la clôture.
      this.dossierService.list().subscribe({
        next: (rows) => {
          this.dossiers.set(rows.filter((d) => MesDossiers.STATUTS_VERIFIES.has(d.statut ?? '')));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.erreur.set(true);
        },
      });
    } else {
      this.dossierService.verifies(page, this.pageSize).subscribe({
        next: (p) => {
          this.pageIndex.set(p.number);
          this.totalPages.set(p.totalPages);
          this.dossiers.set(p.content);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.erreur.set(true);
        },
      });
    }
  }

  estOuvert(id: number): boolean {
    return this.ouverts().has(id);
  }
  chargeEnCours(id: number): boolean {
    return this.chargement().has(id);
  }
  echangesDe(id: number): EchangeDto[] {
    return this.historiques()[id] ?? [];
  }

  /**
   * Clic sur un dossier : déplie/replie le fil (toggle). Au premier dépliage seulement, charge
   * `GET /api/dossiers/{id}/historique-echanges` (jamais au chargement de la liste) ; le résultat
   * est mis en cache (échec → fil vide).
   */
  basculer(d: Dossier): void {
    const id = d.idDossier;
    const ouverts = new Set(this.ouverts());
    if (ouverts.has(id)) {
      ouverts.delete(id);
      this.ouverts.set(ouverts);
      return;
    }
    ouverts.add(id);
    this.ouverts.set(ouverts);

    if (this.historiques()[id] !== undefined || this.chargement().has(id)) {
      return;
    }
    this.chargement.update((s) => new Set(s).add(id));
    this.dossierService.historiqueEchanges(id).subscribe({
      next: (echanges) => {
        this.historiques.update((h) => ({ ...h, [id]: echanges }));
        this.chargement.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      },
      error: () => {
        this.historiques.update((h) => ({ ...h, [id]: [] }));
        this.chargement.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      },
    });
  }

  prevPage(): void {
    if (this.pageIndex() > 0) {
      this.charger(this.pageIndex() - 1);
    }
  }
  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.charger(this.pageIndex() + 1);
    }
  }

  entiteLabel(d: Dossier): string {
    return d.idEntiteContract != null
      ? this.entiteMap().get(String(d.idEntiteContract)) ?? '#' + d.idEntiteContract
      : '—';
  }
}
