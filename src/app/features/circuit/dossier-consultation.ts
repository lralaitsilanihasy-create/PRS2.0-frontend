import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Dossier, Marche, Ppm } from '../../models';
import {
  LocaliteService,
  MarcheService,
  ModePassationService,
  PpmService,
  ReferenceLookupService,
  TypeDossierService,
} from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Consultation d'un dossier en LECTURE SEULE (modale réutilisable).
 * - PPM : en-tête du PPM + lignes de marché (mode en libellé).
 * - DAO/MAOO : infos du dossier.
 * Contenu reconstruit via les listes scopées (GET /api/ppms, /api/marches) filtrées par
 * idDossier (1 appel chacun, pas de N+1) ; libellés via référentiels en cache. Aucune action.
 */
@Component({
  selector: 'app-dossier-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <div [class.dc__overlay]="!embedded()" (click)="onOverlayClick()">
      <div
        class="dc cnm-card"
        [class.dc--embedded]="embedded()"
        (click)="$event.stopPropagation()"
        [attr.role]="embedded() ? null : 'dialog'"
        [attr.aria-modal]="embedded() ? null : 'true'"
      >
        <header class="dc__head">
          <h2 class="dc__title">{{ dossier().refeDossier || ('Dossier #' + dossier().idDossier) }}</h2>
          @if (!embedded()) {
            <button type="button" class="dc__close" aria-label="Fermer" (click)="closed.emit()">&times;</button>
          }
        </header>

        <div class="dc__body">
          <dl class="dc__info">
            <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
            <div><dt>Localité</dt><dd>{{ localiteLabel() }}</dd></div>
            <div><dt>Date réf.</dt><dd class="cnm-mono">{{ dossier().dateRef || '—' }}</dd></div>
            <div><dt>Statut</dt><dd><app-statut-badge [statut]="dossier().statut" /></dd></div>
          </dl>

          @if (estPpm()) {
            @if (loadingContenu()) {
              <p class="dc__muted">Chargement du contenu…</p>
            } @else {
              @if (ppm(); as p) {
                <h3 class="dc__sub">PPM</h3>
                <dl class="dc__info">
                  <div><dt>Référence</dt><dd>{{ p.reference || '—' }}</dd></div>
                  <div><dt>Exercice</dt><dd>{{ p.exercice }}</dd></div>
                  <div><dt>Signataire</dt><dd>{{ p.signataire || '—' }}</dd></div>
                  <div><dt>Date signature</dt><dd class="cnm-mono">{{ p.dateSignature || '—' }}</dd></div>
                  <div><dt>Libellé</dt><dd>{{ p.libelle || '—' }}</dd></div>
                </dl>
              }

              <div class="cnm-marches dc__marches">
                <h3 class="dc__sub">Lignes de marché</h3>
                @if (marches().length) {
                  <table class="cnm-table">
                    <thead>
                      <tr><th>#</th><th>Désignation</th><th class="cnm-num">Montant estimé</th><th>Mode</th><th>Statut</th></tr>
                    </thead>
                    <tbody>
                      @for (m of marches(); track m.idDetail) {
                        <tr>
                          <td class="cnm-mono">{{ m.idDetail }}</td>
                          <td>{{ m.designationMarche || '—' }}</td>
                          <td class="cnm-num">{{ montant(m.montEstim) }}</td>
                          <td>{{ modeLabel(m.idMode) }}</td>
                          <td>{{ m.statut || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="dc__muted">Aucune ligne de marché.</p>
                }
              </div>
            }
          }
        </div>

        @if (!embedded()) {
          <footer class="dc__foot">
            <button type="button" class="cnm-btn cnm-btn--ghost" (click)="closed.emit()">Fermer</button>
          </footer>
        }
      </div>
    </div>
  `,
  styles: `
    .dc__overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: var(--cnm-space-4); }
    .dc { width: 100%; max-width: 44rem; max-height: 85vh; overflow: auto; box-shadow: var(--cnm-shadow); }
    .dc--embedded { max-width: none; max-height: none; overflow: visible; box-shadow: none; border: 0; }
    .dc__head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-3); padding: var(--cnm-space-4) var(--cnm-space-5); border-bottom: 1px solid var(--cnm-border); }
    .dc__title { margin: 0; font-size: var(--cnm-fs-md); }
    .dc__close { background: transparent; border: 0; color: var(--cnm-text-2); font-size: 1.5rem; line-height: 1; cursor: pointer; }
    .dc__close:hover { color: var(--cnm-text); }
    .dc__body { padding: var(--cnm-space-4) var(--cnm-space-5); display: flex; flex-direction: column; gap: var(--cnm-space-3); }
    .dc__sub { margin: var(--cnm-space-2) 0 0; font-size: var(--cnm-fs-md); }
    .dc__marches { padding: var(--cnm-space-2) var(--cnm-space-3); border-radius: 0 var(--cnm-radius-sm) var(--cnm-radius-sm) 0; display: flex; flex-direction: column; gap: var(--cnm-space-2); }
    .dc__info { display: flex; flex-wrap: wrap; gap: var(--cnm-space-4); margin: 0; }
    .dc__info dt { font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.08em; color: var(--cnm-text-3); }
    .dc__info dd { margin: 2px 0 0; color: var(--cnm-text); }
    .dc__muted { color: var(--cnm-text-2); }
    .dc__foot { display: flex; justify-content: flex-end; padding: var(--cnm-space-3) var(--cnm-space-5); border-top: 1px solid var(--cnm-border); }
  `,
})
export class DossierConsultation implements OnInit {
  readonly dossier = input.required<Dossier>();
  /** En mode embarqué : rendu inline (sans overlay, bouton fermer, ni pied) pour insertion dans une colonne. */
  readonly embedded = input(false);
  readonly closed = output<void>();

  /** Clic sur l'overlay : ferme la modale (sans effet en mode embarqué). */
  onOverlayClick(): void {
    if (!this.embedded()) {
      this.closed.emit();
    }
  }

  private readonly ppmService = inject(PpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly lookups = inject(ReferenceLookupService);

  readonly ppm = signal<Ppm | null>(null);
  readonly marches = signal<Marche[]>([]);
  readonly loadingContenu = signal(false);
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());

  readonly estPpm = computed(() => this.dossier().idTypeDossier === 'PPM');
  readonly typeLabel = computed(() => {
    const id = this.dossier().idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier().idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });

  ngOnInit(): void {
    this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).subscribe((m) => this.typeMap.set(m));
    this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).subscribe((m) => this.localiteMap.set(m));
    if (this.estPpm()) {
      const id = this.dossier().idDossier;
      this.loadingContenu.set(true);
      this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).subscribe((m) => this.modeMap.set(m));
      forkJoin({ ppms: this.ppmService.list(), marches: this.marcheService.list() }).subscribe({
        next: ({ ppms, marches }) => {
          this.ppm.set(ppms.find((p) => p.idDossier === id) ?? null);
          this.marches.set(marches.filter((m) => m.idDossier === id));
          this.loadingContenu.set(false);
        },
        error: () => this.loadingContenu.set(false),
      });
    }
  }

  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
}
