import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Marche, MarchePrevision, Ppm, Prmp, ServiceBeneficiaire } from '../../models';
import {
  MarcheService,
  MarchePrevisionService,
  PpmService,
  PrmpService,
  ServiceBeneficiaireService,
} from '../../services';
import { PpmMarchesTable } from '../../shared/prmp/ppm-marches-table';
import { EtatErreur } from '../../shared/ui/etat-erreur';

/**
 * PRMP → ses marchés, présentés comme le PPM officiel (tableau partagé lecture seule :
 * bénéficiaires + dates prévisionnelles inclus). Marchés d'un PRMP : jointure client
 * PRMP → PPM (idPrmp) → Marché (idPpm). Bénéficiaires/prévisions chargés en bulk et
 * filtrés par les marchés de chaque PRMP. Listes filtrées par le backend selon le profil.
 */
@Component({
  selector: 'app-prmp-marches-previsions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PpmMarchesTable, EtatErreur],
  template: `
    <section class="mdp">
      <header class="mdp__header">
        <span class="cnm-section-label">Domaine PRMP</span>
        <h1 class="mdp__title">Marchés & dates prévisionnelles</h1>
      </header>

      @if (loading()) {
        <p class="mdp__info" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="Impossible de charger les marchés." (reessayer)="charger()" />
      } @else {
        @for (prmp of prmps(); track prmp.idPrmp) {
          <div class="cnm-card mdp__prmp">
            <button
              type="button"
              class="mdp__head"
              (click)="togglePrmp(prmp.idPrmp)"
              [attr.aria-expanded]="isPrmpOpen(prmp.idPrmp)"
            >
              <span class="mdp__chevron">{{ isPrmpOpen(prmp.idPrmp) ? '▾' : '▸' }}</span>
              <span class="mdp__ref">{{ prmpLabel(prmp) }}</span>
              <span class="cnm-badge cnm-badge--neutral">{{ marchesOf(prmp.idPrmp).length }} marché(s)</span>
            </button>

            @if (isPrmpOpen(prmp.idPrmp)) {
              <div class="mdp__detail">
                @if (marchesOf(prmp.idPrmp).length === 0) {
                  <p class="mdp__empty">Aucun marché pour cette PRMP.</p>
                } @else {
                  <app-ppm-marches-table
                    [marches]="marchesOf(prmp.idPrmp)"
                    [beneficiaires]="benefsOf(prmp.idPrmp)"
                    [previsions]="previsionsOf(prmp.idPrmp)"
                  />
                }
              </div>
            }
          </div>
        } @empty {
          <p class="mdp__info">Aucune PRMP dans votre périmètre.</p>
        }
      }
    </section>
  `,
  styles: `
    .mdp__header { margin-bottom: var(--cnm-space-4); }
    .mdp__title { margin: 2px 0 0; font-size: var(--cnm-fs-lg); }
    .mdp__info,
    .mdp__empty { color: var(--cnm-text-2); padding: var(--cnm-space-2) var(--cnm-space-3); display: inline-block; }
    .mdp__prmp { margin-bottom: var(--cnm-space-3); overflow: hidden; }
    .mdp__head {
      display: flex;
      align-items: center;
      gap: var(--cnm-space-3);
      width: 100%;
      padding: var(--cnm-space-3) var(--cnm-space-4);
      background: transparent;
      border: 0;
      color: var(--cnm-text);
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .mdp__head:hover { background: var(--cnm-surface-2); }
    .mdp__chevron { color: var(--cnm-text-3); width: 1rem; }
    .mdp__ref { font-weight: var(--cnm-fw-semibold); }
    .mdp__sub { color: var(--cnm-text-2); font-size: var(--cnm-fs-sm); flex: 1; }
    .mdp__detail { border-top: 1px solid var(--cnm-border); padding: var(--cnm-space-3); }
  `,
})
export class PrmpMarchesPrevisions {
  private readonly prmpService = inject(PrmpService);
  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);

  readonly prmps = signal<Prmp[]>([]);
  private readonly ppms = signal<Ppm[]>([]);
  private readonly marches = signal<Marche[]>([]);
  private readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  private readonly previsions = signal<MarchePrevision[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  private readonly expandedPrmp = signal<Set<string>>(new Set());

  /** marchés par PRMP : PRMP → PPM (idPrmp) → Marché (idPpm). */
  private readonly byPrmp = computed(() => {
    const ppmIds = new Map<string, Set<number>>();
    for (const ppm of this.ppms()) {
      if (ppm.idPrmp) {
        const set = ppmIds.get(ppm.idPrmp) ?? new Set<number>();
        set.add(ppm.idPpm);
        ppmIds.set(ppm.idPrmp, set);
      }
    }
    const result = new Map<string, Marche[]>();
    const allMarches = this.marches();
    for (const prmp of this.prmps()) {
      const ids = ppmIds.get(prmp.idPrmp) ?? new Set<number>();
      result.set(
        prmp.idPrmp,
        allMarches.filter((m) => ids.has(m.idPpm)),
      );
    }
    return result;
  });

  constructor() {
    this.charger();
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.prmpService.list().subscribe({
      next: (r) => this.prmps.set(r),
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
    this.ppmService.list().subscribe({ next: (r) => this.ppms.set(r) });
    this.marcheService.list().subscribe({
      next: (r) => {
        this.marches.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
    // Bénéficiaires + prévisions en bulk (filtrés ensuite par les marchés de chaque PRMP).
    this.serviceBenefService.list().subscribe({ next: (r) => this.serviceBenefs.set(r) });
    this.previsionService.list().subscribe({ next: (r) => this.previsions.set(r) });
  }

  /**
   * ⚠️ Bénéficiaires et prévisions par PRMP : regroupés UNE fois par jeu de données.
   *
   * Ces tableaux sont passés en entrée à `app-ppm-marches-table` (OnPush). Recalculés à chaque
   * appel — un `Set` et un `filter` sur toute la liste, par PRMP et par cycle de détection — ils
   * changeaient d'identité en permanence et forçaient le re-rendu du tableau (AUDIT.md P6).
   */
  private readonly benefsByPrmp = computed(() => this.regrouperParPrmp(this.serviceBenefs()));
  private readonly previsionsByPrmp = computed(() => this.regrouperParPrmp(this.previsions()));

  /** Regroupe des éléments portant un `idDetail` selon la PRMP propriétaire du marché. */
  private regrouperParPrmp<T extends { idDetail?: number }>(elements: T[]): Map<string, T[]> {
    const prmpDeDetail = new Map<number, string>();
    for (const [idPrmp, marches] of this.byPrmp()) {
      for (const m of marches) {
        if (m.idDetail != null) {
          prmpDeDetail.set(m.idDetail, idPrmp);
        }
      }
    }
    const map = new Map<string, T[]>();
    for (const e of elements) {
      const idPrmp = e.idDetail != null ? prmpDeDetail.get(e.idDetail) : undefined;
      if (idPrmp === undefined) {
        continue;
      }
      const liste = map.get(idPrmp);
      if (liste) {
        liste.push(e);
      } else {
        map.set(idPrmp, [e]);
      }
    }
    return map;
  }

  /** Référence STABLE pour l'absence de résultat — ne jamais renvoyer un `[]` fraîchement créé. */
  private static readonly VIDE: never[] = [];

  marchesOf(idPrmp: string): Marche[] {
    return this.byPrmp().get(idPrmp) ?? PrmpMarchesPrevisions.VIDE;
  }
  benefsOf(idPrmp: string): ServiceBeneficiaire[] {
    return this.benefsByPrmp().get(idPrmp) ?? PrmpMarchesPrevisions.VIDE;
  }
  previsionsOf(idPrmp: string): MarchePrevision[] {
    return this.previsionsByPrmp().get(idPrmp) ?? PrmpMarchesPrevisions.VIDE;
  }
  prmpLabel(p: Prmp): string {
    return `${p.nomPrmp} ${p.prenomsPrmp}`.trim() || p.idPrmp;
  }
  isPrmpOpen(idPrmp: string): boolean {
    return this.expandedPrmp().has(idPrmp);
  }
  togglePrmp(idPrmp: string): void {
    this.expandedPrmp.update((s) => {
      const n = new Set(s);
      if (n.has(idPrmp)) {
        n.delete(idPrmp);
      } else {
        n.add(idPrmp);
      }
      return n;
    });
  }
}
