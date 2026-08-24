import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Dossier, TypeDossier } from '../../models';
import { DossierService, TypeDossierService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * Accueil « Mes dossiers » (PRMP) : présente **à l'écran** toute l'arborescence type → statut
 * (Brouillons / Soumis) sous forme de cartes, avec compteurs et une synthèse chiffrée en tête.
 * Remplace l'accordéon de sidebar par une page dédiée. Chaque ligne pointe vers
 * `/prmp/dossiers/:type/:groupe` (`DossiersListe`).
 *
 * Types = référentiel `type-dossier` ; compteurs dérivés de deux `GET /api/dossiers` scopés PRMP :
 * `?statut=BROUILLON` pour les brouillons (la liste de base est « hors BROUILLON »), la liste de base
 * pour les soumis. Le bandeau KPI et les barres de répartition sont dérivés (`computed`) de ces
 * compteurs — aucune requête supplémentaire.
 */
@Component({
  selector: 'app-mes-dossiers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, EtatErreur],
  template: `
    <section class="md">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Domaine PRMP</div>
          <h1 class="page-title">Mes dossiers</h1>
        </div>
      </header>
      <p class="md__intro">Retrouvez vos dossiers par <strong>type</strong> et par <strong>statut</strong>.</p>

      @if (loading()) {
        <!-- Synthèse + cartes squelette (placeholder animé du design-system). -->
        <div class="md__kpis">
          @for (i of [1, 2, 3]; track i) {
            <div class="md__kpi"><span class="skeleton md__sk-kpi"></span></div>
          }
        </div>
        <div class="md__grid">
          @for (i of [1, 2, 3]; track i) {
            <article class="md__card md__card--sk">
              <div class="md__inner">
                <div class="md__head">
                  <span class="skeleton md__sk-chip"></span>
                  <div class="md__titles">
                    <span class="skeleton md__sk-line" style="width: 70%"></span>
                    <span class="skeleton md__sk-line" style="width: 40%"></span>
                  </div>
                </div>
                <span class="skeleton md__sk-row"></span>
                <span class="skeleton md__sk-row"></span>
              </div>
            </article>
          }
        </div>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger vos dossiers." (reessayer)="charger()" />
      } @else {
        <!-- Bandeau de synthèse (dérivé des compteurs, sans appel réseau). -->
        <div class="md__kpis">
          <div class="cnm-stat cnm-stat--blue">
            <div class="cnm-stat__icon" aria-hidden="true">📊</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalDossiers() }}</div>
              <div class="cnm-stat__label">Total dossiers</div>
            </div>
          </div>
          <div class="cnm-stat cnm-stat--amber">
            <div class="cnm-stat__icon" aria-hidden="true">📝</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalBrouillons() }}</div>
              <div class="cnm-stat__label">Brouillons</div>
            </div>
          </div>
          <div class="cnm-stat cnm-stat--green">
            <div class="cnm-stat__icon" aria-hidden="true">📤</div>
            <div class="cnm-stat__body">
              <div class="cnm-stat__value">{{ totalSoumis() }}</div>
              <div class="cnm-stat__label">Déposés</div>
            </div>
          </div>
        </div>

        <div class="md__grid">
          @for (t of types(); track t.idTypeDossier) {
            <article class="md__card">
              <div class="md__inner">
                <div class="md__head">
                  <span class="md__chip">{{ chip(t) }}</span>
                  <div class="md__titles">
                    <h2 class="md__title">{{ t.libelleType || t.idTypeDossier }}</h2>
                    <span class="md__code">{{ t.idTypeDossier }}</span>
                  </div>
                  <span class="md__total">{{ total(t.idTypeDossier) }}</span>
                </div>

                <!-- Répartition brouillons / soumis (proportionnelle au total du type). -->
                <div
                  class="md__bar"
                  role="img"
                  [attr.aria-label]="repartitionLabel(t.idTypeDossier)"
                  [class.md__bar--empty]="total(t.idTypeDossier) === 0"
                >
                  <span class="md__bar-seg md__bar-seg--draft" [style.width.%]="pct(t.idTypeDossier, 'brouillon')"></span>
                  <span class="md__bar-seg md__bar-seg--sent" [style.width.%]="pct(t.idTypeDossier, 'soumis')"></span>
                </div>

                <div class="md__rows">
                  <!-- ⚠️ Demande user (2026-08-02) : « Créer » entre directement dans la saisie de la famille. -->
                  <a class="md__row md__row--creer" [routerLink]="['/prmp/soumettre-dossier']" [queryParams]="{ famille: t.idTypeDossier }">
                    <span class="md__row-ic md__row-ic--creer" aria-hidden="true">➕</span>
                    <span class="md__row-label">Créer</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <a class="md__row" [routerLink]="['/prmp/dossiers', t.idTypeDossier, 'brouillon']" routerLinkActive="md__row--actif">
                    <span class="md__row-ic md__row-ic--draft" aria-hidden="true">📝</span>
                    <span class="md__row-label">Brouillons</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'brouillon') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <a class="md__row" [routerLink]="['/prmp/dossiers', t.idTypeDossier, 'soumis']" routerLinkActive="md__row--actif">
                    <span class="md__row-ic md__row-ic--sent" aria-hidden="true">📤</span>
                    <span class="md__row-label">Déposés</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'soumis') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <!-- ⚠️ Demande user (2026-08-02) : accès direct par type aux écrans « à rectifier » / « vérifiés ». -->
                  <a class="md__row" [routerLink]="['/prmp/dossiers/a-rectifier']" [queryParams]="{ type: t.idTypeDossier }" routerLinkActive="md__row--actif">
                    <span class="md__row-ic md__row-ic--rectif" aria-hidden="true">✏️</span>
                    <span class="md__row-label">À rectifier après examen</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'rectifier') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <a class="md__row" [routerLink]="['/prmp/dossiers/verifies']" [queryParams]="{ type: t.idTypeDossier }" routerLinkActive="md__row--actif" [routerLinkActiveOptions]="{ queryParams: 'exact', paths: 'exact', matrixParams: 'ignored', fragment: 'ignored' }">
                    <span class="md__row-ic md__row-ic--verif" aria-hidden="true">✅</span>
                    <span class="md__row-label">Vérifiés</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'verifie') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <!-- ⚠️ 2026-08-05 (demande user) — la mise à jour d'un PPM était trop enfouie : accès
                       direct depuis la carte, comme « Créer ». Famille DDP uniquement (seule versionnable). -->
                  @if (versionnable(t.idTypeDossier)) {
                    <a class="md__row md__row--maj" [routerLink]="['/prmp/dossiers/verifies']" [queryParams]="{ type: t.idTypeDossier, maj: 1 }" routerLinkActive="md__row--actif" [routerLinkActiveOptions]="{ queryParams: 'exact', paths: 'exact', matrixParams: 'ignored', fragment: 'ignored' }">
                      <span class="md__row-ic md__row-ic--maj" aria-hidden="true">🔄</span>
                      <span class="md__row-label">Mettre à jour un PPM</span>
                      <span class="md__row-count">{{ compte(t.idTypeDossier, 'maj') }}</span>
                      <span class="md__row-arrow" aria-hidden="true">›</span>
                    </a>
                  }
                </div>
              </div>
            </article>
          } @empty {
            <div class="empty-state">
              <span class="empty-state-icon" aria-hidden="true">📭</span>
              <div class="empty-state-title">Aucun type de dossier</div>
              <div class="empty-state-text">Aucun type de dossier n'est disponible pour le moment.</div>
            </div>
          }
        </div>
      }

      <!-- ⚠️ 2026-08-07 (demande user) — la liste de la ligne cliquée s'affiche ICI, sous les cartes,
           au même écran. Chaque écran de liste est une route ENFANT (cf. prmp.routes.ts). -->
      <div class="md__liste">
        <router-outlet />
      </div>
    </section>
  `,
  styles: `
    .md { display: flex; flex-direction: column; gap: 1.15rem; }
    .md__intro { margin: -0.4rem 0 0; color: var(--n-500); }

    /* ── Bandeau KPI ── */
    .md__kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 0.9rem;
    }
    .md__kpi {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.9rem 1.1rem 0.9rem 1.25rem;
      background: #fff;
      border: 1px solid var(--n-200);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .md__kpi::before {
      content: '';
      position: absolute;
      top: 0; left: 0; bottom: 0;
      width: 4px;
      background: var(--n-200);
    }
    .md__kpi--total::before { background: var(--grad-primary); }
    .md__kpi--draft::before { background: var(--warning-text); }
    .md__kpi--sent::before { background: var(--success-text); }
    .md__kpi-val {
      font-size: var(--text-3xl);
      font-weight: 800;
      line-height: 1;
      color: var(--n-800);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    .md__kpi--total .md__kpi-val { color: var(--p-600); }
    .md__kpi-lbl {
      font-size: var(--text-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--n-400);
    }

    /* ── Grille de cartes par type — CENTRÉE (largeur bornée, comme le classement du circuit) ── */
    .md__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18.5rem, 22rem));
      gap: 1.1rem;
      justify-content: center;
    }
    .md__card {
      position: relative;
      background: #fff;
      border: 1px solid var(--n-200);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: var(--transition);
    }
    /* Fine barre d'accent dégradée en tête de carte. */
    .md__card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--grad-primary);
    }
    .md__card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
      border-color: var(--p-200);
    }
    .md__inner {
      padding: 1.15rem 1.1rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }

    .md__head { display: flex; align-items: center; gap: 0.75rem; }
    .md__chip {
      flex-shrink: 0;
      width: 2.6rem; height: 2.6rem;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--grad-primary);
      color: #fff; font-weight: 800; font-size: 0.8rem; letter-spacing: 0.02em;
      border-radius: var(--radius-md);
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.35);
    }
    .md__titles { min-width: 0; flex: 1; display: flex; flex-direction: column; }
    .md__title {
      margin: 0;
      font-size: var(--text-md); font-weight: 700; color: var(--n-800);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .md__code {
      font-size: var(--text-xs); color: var(--n-400);
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .md__total {
      flex-shrink: 0;
      min-width: 1.7rem; padding: 0.12rem 0.55rem;
      background: var(--p-50); color: var(--p-600);
      border: 1px solid var(--p-200);
      border-radius: var(--radius-full);
      font-weight: 800; font-size: var(--text-sm); text-align: center;
      font-variant-numeric: tabular-nums;
    }

    /* Barre de répartition brouillons / soumis. */
    .md__bar {
      display: flex;
      height: 6px;
      border-radius: var(--radius-full);
      background: var(--n-100);
      overflow: hidden;
    }
    .md__bar--empty { background: var(--n-100); }
    .md__bar-seg { height: 100%; transition: width 300ms var(--ease-out); }
    .md__bar-seg--draft { background: var(--warning-text); }
    .md__bar-seg--sent { background: var(--success-text); }

    /* Lignes de statut. */
    .md__rows { display: flex; flex-direction: column; gap: 2px; }
    .md__row {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 0.55rem 0.55rem;
      border-radius: var(--radius-md);
      color: var(--n-700); text-decoration: none;
      transition: var(--transition);
    }
    .md__row:hover { background: var(--p-50); color: var(--n-800); }
    .md__row-ic {
      flex-shrink: 0; width: 1.7rem; height: 1.7rem;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: var(--radius-sm); font-size: 0.95rem; line-height: 1;
    }
    .md__row-ic--draft { background: var(--warning-bg); color: var(--warning-text); }
    .md__row-ic--sent { background: var(--success-bg); color: var(--success-text); }
    .md__row-ic--rectif { background: #FEF2F2; color: #B91C1C; }
    .md__row-ic--verif { background: var(--c-50); color: var(--c-600, #4f46e5); }
    .md__row-ic--creer { background: var(--p-50); color: var(--p-600); }
    /* « Créer » : action d'entrée mise en avant (gras + accent), séparée des lignes de consultation. */
    .md__row--creer { font-weight: 700; color: var(--p-600); border-bottom: 1px solid var(--n-100); border-radius: 0; margin-bottom: 2px; }
    .md__row--creer:hover { background: var(--p-50); color: var(--p-700, var(--p-600)); }
    /* « Mettre à jour un PPM » : seconde action d'entrée de la carte, détachée des lignes de consultation. */
    .md__row-ic--maj { background: var(--c-50); color: var(--c-700, #3730a3); }
    .md__row--maj { font-weight: 700; color: var(--c-700, #3730a3); border-top: 1px solid var(--n-100); border-radius: 0; margin-top: 2px; }
    .md__row--maj:hover { background: var(--c-50); }
    .md__row-label { font-weight: 600; }
    .md__row-count {
      margin-left: auto;
      min-width: 1.5rem; padding: 0 0.45rem;
      background: var(--n-100); color: var(--n-600);
      border-radius: var(--radius-full);
      font-weight: 700; font-size: var(--text-sm); text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .md__row:hover .md__row-count { background: var(--p-100); color: var(--p-600); }
    .md__row-arrow {
      color: var(--n-400); font-size: 1.1rem; line-height: 1;
      transition: transform 130ms var(--ease-out), color 130ms var(--ease-out);
    }
    .md__row:hover .md__row-arrow { color: var(--p-500); transform: translateX(3px); }

    /* ── Squelettes de chargement ── */
    .md__card--sk::before { background: var(--n-200); }
    .md__sk-kpi { display: block; width: 60%; height: 1.9rem; }
    .md__sk-chip { display: block; width: 2.6rem; height: 2.6rem; border-radius: var(--radius-md); flex-shrink: 0; }
    .md__sk-line { display: block; height: 0.75rem; }
    .md__sk-line + .md__sk-line { margin-top: 0.4rem; }
    .md__sk-row { display: block; height: 2.5rem; border-radius: var(--radius-md); }

    /* Adoucir la grille KPI/cartes en très petit écran. */
    @media (max-width: 520px) {
      .md__kpis { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class MesDossiers {
  private readonly typeDossierService = inject(TypeDossierService);
  private readonly dossierService = inject(DossierService);

  /** Ordre d'affichage imposé des familles (référentiel non trié) : DDP → DMC → DDM, le reste après. */
  private static readonly ORDRE_FAMILLE: Record<string, number> = { DDP: 0, DMC: 1, DDM: 2 };
  /**
   * ⚠️ Demande user (2026-08-03) — statuts du groupe « Vérifiés » : la phase de vérification complète
   * (dossier rectifié/resoumis compris), pas seulement la clôture. Partagé avec l'écran liste.
   */
  static readonly STATUTS_VERIFIES = new Set([
    'EN_VERIFICATION',
    'OBSERVATIONS_LEVEES',
    'DECISION_TRANSMISE_SIGMP',
    'CLOTURE',
  ]);
  /**
   * ⚠️ 2026-08-05 (versionnement) — statuts depuis lesquels un PPM peut être mis à jour : la Commission
   * a rendu sa décision. Miroir de la garde serveur (`MiseAJourPpmService`) — la carte ne doit pas
   * annoncer un nombre de dossiers plus large que ce que l'action accepte réellement.
   */
  static readonly STATUTS_MAJ = new Set(['DECISION_TRANSMISE_SIGMP', 'CLOTURE']);
  /** Seule la famille DDP (plan de passation) se versionne. */
  static readonly FAMILLE_VERSIONNABLE = 'DDP';

  readonly types = signal<TypeDossier[]>([]);
  readonly loading = signal(true);
  /** Échec du chargement des types de dossier (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  /**
   * idTypeDossier → compteurs dérivés côté client. `rectifier` (EN_ATTENTE_DECISION_PRMP) et
   * `verifie` (CLOTURE) sont des SOUS-ENSEMBLES de `soumis` (⚠️ demande user 2026-08-02).
   */
  private readonly compteurs = signal<Map<string, { brouillon: number; soumis: number; rectifier: number; verifie: number; maj: number }>>(new Map());

  /** Totaux tous types confondus, pour le bandeau de synthèse (dérivés, sans appel réseau). */
  readonly totalBrouillons = computed(() => {
    let n = 0;
    for (const c of this.compteurs().values()) n += c.brouillon;
    return n;
  });
  readonly totalSoumis = computed(() => {
    let n = 0;
    for (const c of this.compteurs().values()) n += c.soumis;
    return n;
  });
  readonly totalDossiers = computed(() => this.totalBrouillons() + this.totalSoumis());

  constructor() {
    this.charger();
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.typeDossierService.list().subscribe({
      next: (rows) => {
        const rang = (id: string) => MesDossiers.ORDRE_FAMILLE[id] ?? 99;
        this.types.set([...rows].sort((a, b) => rang(a.idTypeDossier) - rang(b.idTypeDossier)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
    // Deux appels scopés PRMP : brouillons via ?statut=BROUILLON ; soumis = liste de base filtrée
    // « hors BROUILLON » en DÉFENSIF (le contrat dit la liste de base hors brouillon, mais une
    // régression l'a déjà démentie — un brouillon serait sinon compté deux fois, cf. DossiersListe).
    forkJoin({
      brouillons: this.dossierService.list('BROUILLON'),
      soumis: this.dossierService.list(),
    }).subscribe({
      next: ({ brouillons, soumis }) =>
        this.compteurs.set(this.grouper(brouillons, soumis.filter((d) => d.statut !== 'BROUILLON'))),
      error: () => {},
    });
  }

  private grouper(
    brouillons: Dossier[],
    soumis: Dossier[],
  ): Map<string, { brouillon: number; soumis: number; rectifier: number; verifie: number; maj: number }> {
    const m = new Map<string, { brouillon: number; soumis: number; rectifier: number; verifie: number; maj: number }>();
    const cumuler = (rows: Dossier[], cle: 'brouillon' | 'soumis' | 'rectifier' | 'verifie' | 'maj') => {
      for (const d of rows) {
        const type = d.idTypeDossier;
        if (!type) continue;
        const c = m.get(type) ?? { brouillon: 0, soumis: 0, rectifier: 0, verifie: 0, maj: 0 };
        c[cle]++;
        m.set(type, c);
      }
    };
    // ⚠️ 2026-08-05 — une mise à jour en cours (dossier rattaché à un prédécesseur) ne compte pas comme
    // un brouillon : elle n'est effective qu'à sa création, et se reprend depuis « Mettre à jour un PPM ».
    cumuler(brouillons.filter((d) => d.idDossierParent == null), 'brouillon');
    cumuler(soumis, 'soumis');
    // Sous-ensembles de « soumis » (aucun appel réseau supplémentaire).
    cumuler(soumis.filter((d) => d.statut === 'EN_ATTENTE_DECISION_PRMP'), 'rectifier');
    // ⚠️ Demande user (2026-08-03) — « Vérifiés » couvre TOUTE la phase de vérification : un dossier
    // rectifié puis resoumis (EN_VERIFICATION) y figure, jusqu'à la clôture (SIGMP / archivage).
    cumuler(soumis.filter((d) => MesDossiers.STATUTS_VERIFIES.has(d.statut ?? '')), 'verifie');
    // ⚠️ 2026-08-05 — PPM réellement VERSIONNABLES : la Commission a rendu sa décision. Sous-ensemble
    // strict de « Vérifiés » — un dossier encore en vérification n'est pas mettable à jour. Le compteur
    // est le miroir de la garde serveur, pour ne pas annoncer une action que le backend refuserait.
    cumuler(soumis.filter((d) => MesDossiers.STATUTS_MAJ.has(d.statut ?? '')), 'maj');
    return m;
  }

  /** Pastille courte du type (ex. « PPM », « DAO ») : jusqu'à 3 lettres de son identifiant. */
  chip(t: TypeDossier): string {
    return (t.idTypeDossier || '?').slice(0, 3).toUpperCase();
  }
  /** Vrai pour la famille des plans de passation, seule à se versionner. */
  versionnable(type: string): boolean {
    return type === MesDossiers.FAMILLE_VERSIONNABLE;
  }
  compte(type: string, groupe: 'brouillon' | 'soumis' | 'rectifier' | 'verifie' | 'maj'): number {
    return this.compteurs().get(type)?.[groupe] ?? 0;
  }
  total(type: string): number {
    const c = this.compteurs().get(type);
    return c ? c.brouillon + c.soumis : 0;
  }
  /** Part (%) d'un groupe dans le total du type, pour la barre de répartition (0 si type vide). */
  pct(type: string, groupe: 'brouillon' | 'soumis'): number {
    const t = this.total(type);
    return t === 0 ? 0 : (this.compte(type, groupe) / t) * 100;
  }
  /** Libellé accessible de la barre de répartition. */
  repartitionLabel(type: string): string {
    return `${this.compte(type, 'brouillon')} brouillon(s), ${this.compte(type, 'soumis')} soumis`;
  }
}
