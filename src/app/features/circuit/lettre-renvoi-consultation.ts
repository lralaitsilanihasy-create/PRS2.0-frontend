import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Dossier, LettreRenvoi } from '../../models';
import { DossierService, LettreRenvoiService } from '../../services';
import { StatutBadge } from '../../shared/circuit';

/**
 * Consultation **lecture seule** des lettres de renvoi, partagée :
 * - PRMP (`route.data.source = 'mes'`) → `GET /api/lettre-renvois/mes-lettres` (ses lettres SIGNE) ;
 * - Assistant contrôleur (`'localite'`) → `GET /api/lettre-renvois` (filtré localité, SIGNE).
 *
 * Lien de notification : `…/lettre-renvois/{idLettre}` déplie automatiquement le détail.
 */
@Component({
  selector: 'app-lettre-renvoi-consultation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatutBadge],
  template: `
    <section class="lrc">
      <header class="lrc__header">
        <h1 class="lrc__title">{{ titre }}</h1>
      </header>

      @if (loading()) {
        <p class="cnm-muted">Chargement…</p>
      } @else {
        <table class="cnm-table">
          <thead>
            <tr><th>Référence lettre</th><th>Dossier</th><th>Objet</th><th>Date lettre</th><th>Statut</th></tr>
          </thead>
          <tbody>
            @for (l of lettres(); track l.idLettre) {
              <tr class="lrc__row" (click)="basculer(l)">
                <td class="cnm-mono">{{ l.refLettre || ('#' + l.idLettre) }}</td>
                <td>{{ refDossier(l) }}</td>
                <td>{{ l.objetLettre || '—' }}</td>
                <td class="cnm-mono">{{ l.dateLettre || '—' }}</td>
                <td><app-statut-badge [statut]="l.statut" /></td>
              </tr>
              @if (ouvert() === l.idLettre) {
                <tr class="lrc__detail">
                  <td colspan="5">
                    <dl class="lrc__dl">
                      <div><dt>Référence</dt><dd class="cnm-mono">{{ l.refLettre || '—' }}</dd></div>
                      <div><dt>Objet</dt><dd>{{ l.objetLettre || '—' }}</dd></div>
                      <div><dt>Corps</dt><dd class="lrc__corps">{{ l.corpsLettre || '—' }}</dd></div>
                      <div><dt>Date d'examen</dt><dd class="cnm-mono">{{ l.dateExamen || '—' }}</dd></div>
                      <div><dt>Date lettre</dt><dd class="cnm-mono">{{ l.dateLettre || '—' }}</dd></div>
                      <div><dt>Statut</dt><dd><app-statut-badge [statut]="l.statut" /></dd></div>
                    </dl>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="5" class="cnm-muted">Aucune lettre de renvoi.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .lrc__header { margin-bottom: var(--cnm-space-3); }
    .lrc__title { margin: 0; font-size: var(--cnm-fs-lg); }
    .lrc__row { cursor: pointer; }
    .lrc__row:hover { background: var(--cnm-surface-2); }
    .lrc__dl { display: flex; flex-direction: column; gap: var(--cnm-space-1); margin: 0; }
    .lrc__dl > div { display: flex; gap: var(--cnm-space-2); align-items: baseline; }
    .lrc__dl dt { flex: 0 0 10rem; font-size: var(--cnm-fs-micro); text-transform: uppercase; letter-spacing: 0.04em; color: var(--cnm-text-3); }
    .lrc__dl dd { margin: 0; }
    .lrc__corps { white-space: pre-wrap; }
  `,
})
export class LettreRenvoiConsultation {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LettreRenvoiService);
  private readonly dossierService = inject(DossierService);

  private readonly source = (this.route.snapshot.data['source'] as 'mes' | 'localite') ?? 'localite';
  readonly titre = (this.route.snapshot.data['title'] as string) ?? 'Lettres de renvoi';
  readonly loading = signal(true);
  readonly lettres = signal<LettreRenvoi[]>([]);
  readonly ouvert = signal<number | null>(null);
  private readonly dossierRefs = signal<Map<number, string>>(new Map());

  constructor() {
    const param = this.route.snapshot.paramMap.get('idLettre');
    if (param) {
      this.ouvert.set(Number(param));
    }
    this.dossierService
      .list()
      .subscribe((rows: Dossier[]) =>
        this.dossierRefs.set(new Map(rows.map((d) => [d.idDossier, d.refeDossier ?? '']))),
      );
    const call = this.source === 'mes' ? this.service.getMesLettres() : this.service.getAll();
    call.subscribe({
      next: (rows) => {
        this.lettres.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  basculer(l: LettreRenvoi): void {
    this.ouvert.update((cur) => (cur === l.idLettre ? null : (l.idLettre ?? null)));
  }
  refDossier(l: LettreRenvoi): string {
    const ref = l.idDossier != null ? this.dossierRefs().get(l.idDossier) : '';
    return ref || (l.idDossier != null ? 'Dossier #' + l.idDossier : '—');
  }
}
