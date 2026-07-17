import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ModePassation, TypeDmc } from '../../models';
import { ModePassationService, TypeDmcService } from '../../services';

/**
 * Mapping **mode de passation → type de DMC** (ADMINISTRATEUR). Chaque mode porte `idTypeDmc`
 * (`PUT /api/mode-passations/{id}`) qui sert à **dériver** le type de DMC de ses marchés. Les modes
 * non mappés sont signalés pour inciter à compléter la configuration. Le type n'est jamais saisi
 * par l'utilisateur : il découle du mode.
 */
@Component({
  selector: 'app-dmc-mapping-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dm">
      <header class="page-header">
        <h1 class="page-title">Mapping mode de passation → document DMC</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <p class="alert alert-info">
        Le type de DMC d'un marché est <strong>dérivé</strong> de son mode de passation. Associez chaque mode à un type ;
        les modes <strong>non mappés</strong> sont signalés.
      </p>

      @if (loading()) {
        <p class="text-muted">Chargement…</p>
      } @else {
        <div class="table-responsive">
          <table class="cnm-table">
            <thead><tr><th>Mode de passation</th><th>Type de DMC</th><th>État</th></tr></thead>
            <tbody>
              @for (m of modes(); track m.idMode) {
                <tr>
                  <td>{{ m.libelle || ('#' + m.idMode) }}</td>
                  <td>
                    <select
                      class="form-control dm__select"
                      [value]="m.idTypeDmc ?? ''"
                      [disabled]="saving() === m.idMode"
                      (change)="mapper(m, $any($event.target).value)"
                    >
                      <option value="">— Non mappé —</option>
                      @for (t of typesActifs(); track t.idTypeDmc) {
                        <option [value]="t.idTypeDmc">{{ t.code }} — {{ t.libelle }}</option>
                      }
                    </select>
                  </td>
                  <td>
                    @if (m.idTypeDmc) {
                      <span class="badge">{{ codeDe(m.idTypeDmc) }}</span>
                    } @else {
                      <span class="badge badge-warning">Non mappé</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="cnm-muted">Aucun mode de passation.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (!typesActifs().length) {
          <p class="cnm-muted">Aucun type de DMC actif — créez-en d'abord dans « Types de document DMC (par marché) ».</p>
        }
      }
    </section>
  `,
  styles: `
    .dm { display: flex; flex-direction: column; gap: 1rem; }
    .dm__select { min-width: 16rem; max-width: 28rem; }
  `,
})
export class DmcMappingAdmin implements OnInit {
  private readonly modeService = inject(ModePassationService);
  private readonly typeService = inject(TypeDmcService);
  private readonly toast = inject(ToastService);

  readonly modes = signal<ModePassation[]>([]);
  readonly types = signal<TypeDmc[]>([]);
  readonly loading = signal(false);
  /** idMode en cours d'enregistrement (désactive son select). */
  readonly saving = signal<number | null>(null);

  readonly typesActifs = computed(() => this.types().filter((t) => t.actif !== false));
  private readonly typeById = computed(() => new Map(this.types().map((t) => [t.idTypeDmc, t])));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.typeService.list().subscribe({ next: (t) => this.types.set(t), error: () => {} });
    this.modeService.list().subscribe({
      next: (m) => {
        this.modes.set(m);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  codeDe(idTypeDmc?: number | null): string {
    return idTypeDmc ? this.typeById().get(idTypeDmc)?.code ?? `#${idTypeDmc}` : '';
  }

  /** Enregistre le mapping d'un mode (PUT du mode entier avec le nouvel idTypeDmc, ou null pour démapper). */
  mapper(m: ModePassation, valeur: string): void {
    const idTypeDmc = valeur ? Number(valeur) : null;
    const body: ModePassation = { ...m, idTypeDmc };
    this.saving.set(m.idMode);
    this.modeService.update(m.idMode, body).subscribe({
      next: (updated) => {
        this.modes.update((list) => list.map((x) => (x.idMode === m.idMode ? updated : x)));
        this.saving.set(null);
        this.toast.success(`Mapping de « ${m.libelle ?? m.idMode} » enregistré.`);
      },
      error: (_e: ApiError) => this.saving.set(null),
    });
  }
}
