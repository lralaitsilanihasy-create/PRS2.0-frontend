import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ToastService } from '../../core/notifications/toast.service';
import { DelaiStandard, ETAPE_CIRCUIT_LABELS, EtapeCircuit } from '../../models';
import { DelaiStandardService } from '../../services';

/**
 * ⚠️ Chronométrage (2026-09-01, HEURES ouvrées depuis le 02/09 — backend `c8d987a`) — écran
 * « Délais standards » : le délai par défaut de chaque étape du circuit, en heures ouvrées
 * (8 h = 1 jour ouvré). Il fournit la prévision des étapes non encore prises en charge — la date
 * annoncée à la PRMP existe donc dès la soumission — et il est remplacé, dossier par dossier, par
 * la prévision réellement saisie à la prise en charge. Le GET rend TOUJOURS les huit étapes
 * (repli serveur à 8 h), le PUT est réservé à l'Administrateur (400 si < 1).
 */
@Component({
  selector: 'app-delais-standards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dst">
      <header class="page-header">
        <h1 class="page-title">Délais standards du circuit</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <!-- Un seul <span> : .alert est en flex, des <strong> nus deviendraient des colonnes. -->
      <p class="alert alert-info">
        <span>
          Ces délais (en <strong>heures ouvrées</strong> — 8 h = 1 jour ouvré) servent de prévision
          par défaut aux étapes que personne n'a encore prises en charge : ils alimentent la
          <strong>date prévisionnelle de fin</strong> annoncée à la PRMP dès la soumission. À la
          prise en charge d'une étape, la prévision saisie par le porteur remplace le délai
          standard — pour ce dossier seulement.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-responsive">
          <table class="cnm-table">
            <thead>
              <tr><th scope="col">Étape</th><th scope="col">Délai standard (heures ouvrées)</th><th scope="col"></th></tr>
            </thead>
            <tbody>
              @for (d of delais(); track d.etape) {
                <tr>
                  <td>
                    {{ d.libelle || etapeLabel(d.etape) }}
                    <span class="cnm-mono dst__code">{{ d.etape }}</span>
                    @if (d.etape === 'ARCHIVAGE') {
                      <span class="badge" title="Chronométrée par profil, mais le compteur global s'arrête à la validation SIGMP.">hors compteur global</span>
                    }
                  </td>
                  <td>
                    <input
                      type="number"
                      class="form-control dst__jours"
                      min="1"
                      step="1"
                      [value]="saisies()[d.etape] ?? d.delaiHeures"
                      [attr.aria-label]="'Délai standard — ' + (d.libelle || etapeLabel(d.etape))"
                      (input)="saisir(d.etape, $any($event.target).value)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      [disabled]="saving() === d.etape || !modifie(d)"
                      (click)="enregistrer(d)"
                    >
                      {{ saving() === d.etape ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="cnm-muted">Référentiel indisponible.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .dst { display: flex; flex-direction: column; gap: 1rem; }
    .dst__jours { max-width: 8rem; }
    .dst__code { font-size: var(--text-xs); color: var(--n-400); margin-left: 0.35rem; }
  `,
})
export class DelaisStandards implements OnInit {
  private readonly service = inject(DelaiStandardService);
  private readonly toast = inject(ToastService);

  readonly delais = signal<DelaiStandard[]>([]);
  /** Saisies en cours, par étape (l'input est contrôlé par [value], pas de formulaire). */
  readonly saisies = signal<Partial<Record<EtapeCircuit, string>>>({});
  readonly loading = signal(true);
  readonly saving = signal<EtapeCircuit | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.delais.set(rows);
        this.saisies.set({});
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  etapeLabel(etape: EtapeCircuit): string {
    return ETAPE_CIRCUIT_LABELS[etape] ?? etape;
  }

  saisir(etape: EtapeCircuit, valeur: string): void {
    this.saisies.update((s) => ({ ...s, [etape]: valeur }));
  }

  modifie(d: DelaiStandard): boolean {
    const saisie = this.saisies()[d.etape];
    return saisie != null && saisie !== '' && Number(saisie) !== d.delaiHeures;
  }

  enregistrer(d: DelaiStandard): void {
    const heures = Number(this.saisies()[d.etape]);
    if (!Number.isInteger(heures) || heures < 1) {
      this.toast.error("Le délai standard est un nombre entier d'heures ouvrées, au moins 1 (8 h = 1 jour ouvré).");
      return;
    }
    this.saving.set(d.etape);
    this.service.update(d.etape, { ...d, delaiHeures: heures }).subscribe({
      next: (maj) => {
        this.saving.set(null);
        this.delais.update((rows) => rows.map((r) => (r.etape === maj.etape ? maj : r)));
        this.saisies.update((s) => {
          const copie = { ...s };
          delete copie[d.etape];
          return copie;
        });
        this.toast.success(`Délai standard de « ${maj.libelle || this.etapeLabel(maj.etape)} » : ${maj.delaiHeures} h ouvrées.`);
      },
      error: () => this.saving.set(null), // 400/403 → dialogue centralisé (message backend)
    });
  }
}
