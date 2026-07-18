import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Dossier, TypeDossier } from '../../models';
import { DossierService, TypeDossierService } from '../../services';

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
  imports: [RouterLink],
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
      } @else {
        <!-- Bandeau de synthèse (dérivé des compteurs, sans appel réseau). -->
        <div class="md__kpis">
          <div class="md__kpi md__kpi--total">
            <span class="md__kpi-val">{{ totalDossiers() }}</span>
            <span class="md__kpi-lbl">Total dossiers</span>
          </div>
          <div class="md__kpi md__kpi--draft">
            <span class="md__kpi-val">{{ totalBrouillons() }}</span>
            <span class="md__kpi-lbl">Brouillons</span>
          </div>
          <div class="md__kpi md__kpi--sent">
            <span class="md__kpi-val">{{ totalSoumis() }}</span>
            <span class="md__kpi-lbl">Soumis</span>
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
                  <a class="md__row" [routerLink]="['/prmp/dossiers', t.idTypeDossier, 'brouillon']">
                    <span class="md__row-ic md__row-ic--draft" aria-hidden="true">📝</span>
                    <span class="md__row-label">Brouillons</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'brouillon') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
                  <a class="md__row" [routerLink]="['/prmp/dossiers', t.idTypeDossier, 'soumis']">
                    <span class="md__row-ic md__row-ic--sent" aria-hidden="true">📤</span>
                    <span class="md__row-label">Soumis</span>
                    <span class="md__row-count">{{ compte(t.idTypeDossier, 'soumis') }}</span>
                    <span class="md__row-arrow" aria-hidden="true">›</span>
                  </a>
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

    /* ── Grille de cartes par type ── */
    .md__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18.5rem, 1fr));
      gap: 1.1rem;
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
      color: var(--n-300); font-size: 1.1rem; line-height: 1;
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

  readonly types = signal<TypeDossier[]>([]);
  readonly loading = signal(true);
  /** idTypeDossier → { brouillon, soumis } (compteurs dérivés côté client). */
  private readonly compteurs = signal<Map<string, { brouillon: number; soumis: number }>>(new Map());

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
    this.typeDossierService.list().subscribe({
      next: (rows) => {
        this.types.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

  private grouper(brouillons: Dossier[], soumis: Dossier[]): Map<string, { brouillon: number; soumis: number }> {
    const m = new Map<string, { brouillon: number; soumis: number }>();
    const cumuler = (rows: Dossier[], cle: 'brouillon' | 'soumis') => {
      for (const d of rows) {
        const type = d.idTypeDossier;
        if (!type) continue;
        const c = m.get(type) ?? { brouillon: 0, soumis: 0 };
        c[cle]++;
        m.set(type, c);
      }
    };
    cumuler(brouillons, 'brouillon');
    cumuler(soumis, 'soumis');
    return m;
  }

  /** Pastille courte du type (ex. « PPM », « DAO ») : jusqu'à 3 lettres de son identifiant. */
  chip(t: TypeDossier): string {
    return (t.idTypeDossier || '?').slice(0, 3).toUpperCase();
  }
  compte(type: string, groupe: 'brouillon' | 'soumis'): number {
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
