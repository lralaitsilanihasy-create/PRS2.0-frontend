import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { Dossier, EchangeDto } from '../../models';
import { DossierService, EntiteContractService, LocaliteService, ReferenceLookupService, SaisieService, SousTypeDossierService } from '../../services';
import { MesDossiers } from '../prmp/mes-dossiers';
import { StatutBadge } from '../../shared/circuit';

/**
 * « Dossiers vérifiés / clôturés » (Vérificateur) et « Dossiers vérifiés » (PRMP) — LECTURE SEULE.
 * Liste condensée des dossiers CLOTURE (une ligne par dossier, source serveur selon le profil via
 * `route.data.source`). Le fil chronologique des échanges (`GET /api/dossiers/{id}/historique-echanges`,
 * trié ASC) est masqué par défaut et chargé/affiché uniquement au clic sur le dossier (toggle).
 */
@Component({
  selector: 'app-dossiers-clotures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatutBadge, DatePipe],
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
      } @else {
        <!-- ⚠️ Demande pilote (2026-09-06) — MÊME tableau que la liste des dossiers (Déposés…) :
             table-card à 7 colonnes ; « Ouvrir » déplie l'historique des échanges dans une rangée
             pleine largeur, le versionnement garde ses gestes dans la colonne Actions. -->
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Référence</th><th scope="col">Entité contractante</th><th scope="col">Statut</th><th scope="col">Sous-type</th><th scope="col">Localité</th><th scope="col">Fin traitement CNM</th><th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dossiersAffiches(); track d.idDossier) {
                <tr>
                  <td>{{ d.refeDossier || ('Dossier #' + d.idDossier) }}</td>
                  <td>{{ entiteLabel(d) }}</td>
                  <!-- Statut réel : la liste PRMP couvre toute la phase de vérification (2026-08-03). -->
                  <td>@if (d.statut) { <app-statut-badge [statut]="d.statut" /> } @else { — }</td>
                  <td>{{ sousTypeLabel(d) }}</td>
                  <td>{{ localiteLabel(d) }}</td>
                  <td class="cnm-mono">
                    {{ d.datePrevisionnelleFin ? (d.datePrevisionnelleFin | date: 'dd/MM/yyyy') : '—' }}
                    @if (d.attentePrmp) {
                      <span class="dc__attente" title="En attente de votre action — la date prévisionnelle glisse tant que le dossier ne revient pas à la CNM.">⏸ à vous</span>
                    }
                  </td>
                  <td>
                    <div class="td-actions actions-end">
                      <button type="button" class="btn btn-secondary btn-sm" [attr.aria-expanded]="estOuvert(d.idDossier)" (click)="basculer(d)">
                        {{ estOuvert(d.idDossier) ? 'Fermer' : 'Ouvrir' }}
                      </button>
                      <!-- ⚠️ 2026-08-05 — versionnement : la mise à jour n'est ouverte que sur un PPM
                           dont la Commission a rendu sa décision (409 sinon) ; écran d'ACTION seul. -->
                      @if (source === 'prmp-clotures' && modeMaj() && majPossible(d)) {
                        @if (majEnCoursPour(d); as version) {
                          <a class="btn btn-primary btn-sm" [routerLink]="['/prmp/mise-a-jour', version]"
                            title="Une mise à jour est déjà en cours sur ce plan — rien n'est encore effectif : on la reprend.">Reprendre la mise à jour</a>
                        } @else {
                          <button type="button" class="btn btn-primary btn-sm" (click)="ouvrirMotif(d)">✎ Mettre à jour</button>
                        }
                      }
                    </div>
                  </td>
                </tr>
                @if (source === 'prmp-clotures' && modeMaj() && majPour() === d.idDossier && !majEnCoursPour(d)) {
                  <tr class="dc__row-detail">
                    <td colspan="7">
                      <!-- Motif exigé AVANT toute création : c'est lui qui justifie la version dans l'historique. -->
                      <div class="dc__maj">
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
                      </div>
                    </td>
                  </tr>
                }
                @if (estOuvert(d.idDossier)) {
                  <tr class="dc__row-detail">
                    <td colspan="7">
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
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="7" class="empty-cell">
                  @if (modeMaj()) { Aucun plan n'est en état d'être mis à jour : la Commission doit d'abord avoir rendu sa décision. }
                  @else { Aucun dossier clôturé. }
                </td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (source === 'verifies' && totalPages() > 1) {
          <div class="dc__pager">
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() === 0" (click)="prevPage()">Précédent</button>
            <span class="dc__pager-info">Page {{ pageIndex() + 1 }} / {{ totalPages() }}</span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="pageIndex() + 1 >= totalPages()" (click)="nextPage()">Suivant</button>
          </div>
        }
      }
    </section>
  `,
  styles: `
    /* Rangée de détail (historique / motif de mise à jour) sous la ligne du tableau. */
    .dc__row-detail > td { background: #fbfcff; }
    .dc__attente { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-full); background: var(--warning-bg, #fffbeb); border: 1px solid var(--warning-bdr, #fde68a); color: var(--warning-text, #92400e); font-size: var(--text-xs); white-space: nowrap; }
    .dc__hist { padding: 0.25rem 0.35rem; }
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
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly sousTypeMap = signal<Map<string, string>>(new Map());

  constructor() {
    this.lookups
      .lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite'])
      .subscribe((m) => this.entiteMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    this.lookups.lookup(SousTypeDossierService, 'idSousType', ['libelleSousType']).subscribe((m) => this.sousTypeMap.set(m));
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

  private charger(page: number): void {
    this.loading.set(true);
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
        error: () => this.loading.set(false),
      });
    } else {
      this.dossierService.verifies(page, this.pageSize).subscribe({
        next: (p) => {
          this.pageIndex.set(p.number);
          this.totalPages.set(p.totalPages);
          this.dossiers.set(p.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
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
  localiteLabel(d: Dossier): string {
    return d.idLocalite ? this.localiteMap().get(d.idLocalite) ?? d.idLocalite : '—';
  }
  /** Libellé du sous-type (repli sur le code ; « — » si non renseigné). */
  sousTypeLabel(d: Dossier): string {
    return d.idSousType ? this.sousTypeMap().get(d.idSousType) ?? d.idSousType : '—';
  }
}
