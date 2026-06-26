import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EntiteContract } from '../../models';
import { EntiteContractService, OrganigrammeService } from '../../services';

interface TreeNode {
  entite: EntiteContract;
  depth: number;
}

/**
 * Vue arborescente des entités contractantes (hiérarchie via `idEntiteParent`),
 * éventuellement limitée à un organigramme (`?organigramme=<id>`).
 * La hiérarchie est reconstruite côté client à partir d'un seul chargement de la
 * liste (pas d'endpoint imbriqué). Repli sur l'id si un libellé manque.
 */
@Component({
  selector: 'app-entite-arbre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="arbre">
      <header class="page-header">
        <div>
          <div class="page-subtitle">Référentiels</div>
          <h1 class="page-title">Arbre des entités</h1>
        </div>
        <a class="btn btn-secondary btn-sm" routerLink="/admin/referentiels/entite-contracts">
          Gérer les entités
        </a>
      </header>

      @if (organigrammeFilter()) {
        <div class="arbre__filter">
          <span>Organigramme : <strong>{{ organigrammeLabel() }}</strong></span>
          <a class="btn btn-secondary btn-sm" routerLink="/admin/referentiels/entite-arbre">
            Voir toutes les entités
          </a>
        </div>
      }

      @if (loading()) {
        <p class="arbre__info">Chargement…</p>
      } @else {
        <div class="card arbre__tree">
          @for (node of nodes(); track node.entite.idEntiteContract) {
            <div class="node" [style.padding-left.rem]="0.75 + node.depth * 1.5">
              <span class="node__branch" aria-hidden="true">{{ node.depth > 0 ? '└─' : '' }}</span>
              <span class="node__label">{{ label(node.entite) }}</span>
              @if (node.entite.categorieEntite) {
                <span class="badge badge-neutral">{{ node.entite.categorieEntite }}</span>
              }
              <span class="node__level">niv. {{ node.entite.niveauHierarchique ?? node.depth + 1 }}</span>
            </div>
          } @empty {
            <p class="arbre__info">Aucune entité.</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .arbre__filter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      margin-bottom: 0.75rem;
      background: #fff;
      border: 1px solid var(--c-100);
      border-left: 3px solid var(--c-600);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .arbre__info {
      color: var(--n-400);
      padding: 0.75rem;
    }
    .arbre__tree {
      padding: 0.5rem 0;
    }
    .node {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-top: 0.4rem;
      padding-bottom: 0.4rem;
      padding-right: 1rem;
      font-size: var(--text-sm);
      border-bottom: 1px solid var(--c-50);
    }
    .node:last-child { border-bottom: none; }
    .node__branch {
      color: var(--n-400);
      font-variant-numeric: tabular-nums;
    }
    .node__label {
      color: var(--n-800);
      font-weight: 500;
    }
    .node__level {
      margin-left: auto;
      color: var(--n-400);
      font-variant-numeric: tabular-nums;
      font-size: var(--text-xs);
    }
  `,
})
export class EntiteArbre {
  private readonly service = inject(EntiteContractService);
  private readonly organigrammeService = inject(OrganigrammeService);
  private readonly route = inject(ActivatedRoute);

  private readonly entites = signal<EntiteContract[]>([]);
  readonly loading = signal(false);
  readonly organigrammeFilter = signal<string | null>(null);
  readonly organigrammeLabel = signal<string>('');

  /** Liste aplatie de l'arbre (DFS), avec profondeur, prête à l'affichage. */
  readonly nodes = computed<TreeNode[]>(() => {
    const filter = this.organigrammeFilter();
    const scoped = filter
      ? this.entites().filter((e) => String(e.idOrganigramme) === filter)
      : this.entites();
    return this.buildTree(scoped);
  });

  constructor() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.entites.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.route.queryParamMap.subscribe((params) => {
      const org = params.get('organigramme');
      this.organigrammeFilter.set(org);
      this.organigrammeLabel.set(org ? `#${org}` : '');
      if (org) {
        this.organigrammeService.getById(Number(org)).subscribe({
          next: (o) => this.organigrammeLabel.set(o.libelle ?? `#${org}`),
          error: () => this.organigrammeLabel.set(`#${org}`),
        });
      }
    });
  }

  label(e: EntiteContract): string {
    return e.libelleEntite || `#${e.idEntiteContract}`;
  }

  /** Construit l'arbre par idEntiteParent et l'aplatit en DFS (anti-cycle inclus). */
  private buildTree(entites: EntiteContract[]): TreeNode[] {
    const ids = new Set(entites.map((e) => e.idEntiteContract));
    const childrenOf = (parentId: number | null | undefined): EntiteContract[] =>
      entites
        .filter((e) => e.idEntiteParent === parentId)
        .sort((a, b) => (a.niveauHierarchique ?? 0) - (b.niveauHierarchique ?? 0));

    // Racines : pas de parent, ou parent hors du périmètre chargé.
    const roots = entites.filter(
      (e) => e.idEntiteParent == null || !ids.has(e.idEntiteParent),
    );

    const out: TreeNode[] = [];
    const seen = new Set<number>();
    const visit = (e: EntiteContract, depth: number): void => {
      if (seen.has(e.idEntiteContract)) {
        return; // anti-cycle
      }
      seen.add(e.idEntiteContract);
      out.push({ entite: e, depth });
      for (const child of childrenOf(e.idEntiteContract)) {
        visit(child, depth + 1);
      }
    };
    roots.forEach((r) => visit(r, 0));
    return out;
  }
}
