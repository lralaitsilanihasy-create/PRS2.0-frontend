import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RapportService } from '../../services';

/**
 * Génération des rapports périodiques (PRESIDENT / ADMINISTRATEUR).
 * Réponses binaires (PDF/Excel) téléchargées côté navigateur ; `from`/`to` facultatifs.
 */
@Component({
  selector: 'app-rapports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <section class="rapports">
      <h1 class="rapports__title">Rapports des dossiers</h1>

      <div class="rapports__filters">
        <label class="field">
          <span class="field__label">Du</span>
          <input type="date" [(ngModel)]="from" />
        </label>
        <label class="field">
          <span class="field__label">Au</span>
          <input type="date" [(ngModel)]="to" />
        </label>
      </div>

      <div class="rapports__actions">
        <button type="button" class="cnm-btn cnm-btn--primary" [disabled]="busy()" (click)="pdf()">
          Télécharger PDF
        </button>
        <button type="button" class="cnm-btn cnm-btn--ghost" [disabled]="busy()" (click)="excel()">
          Télécharger Excel
        </button>
      </div>
      <p class="rapports__hint">Période facultative : sans dates, tous les dossiers sont inclus.</p>
    </section>
  `,
  styles: `
    .rapports__title {
      margin: 0 0 1rem;
      font-size: 1.35rem;
      color: var(--cnm-text);
    }
    .rapports__filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .rapports__actions {
      display: flex;
      gap: 0.5rem;
    }
    .rapports__hint {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--cnm-text-2);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .field__label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--cnm-text-2);
    }
    .field input {
      border: 1px solid var(--cnm-border-strong);
      border-radius: 0.375rem;
      padding: 0.45rem 0.6rem;
    }
    .btn {
      border: 0;
      border-radius: 0.375rem;
      padding: 0.5rem 0.9rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .btn--primary {
      background: var(--cnm-brand);
      color: #fff;
    }
    .btn--ghost {
      background: var(--cnm-surface-2);
      color: var(--cnm-text-2);
    }
  `,
})
export class RapportsPage {
  private readonly service = inject(RapportService);

  from = '';
  to = '';
  readonly busy = signal(false);

  pdf(): void {
    this.télécharger(
      this.service.dossiersPdf(this.from || undefined, this.to || undefined),
      'rapport-dossiers.pdf',
    );
  }

  excel(): void {
    this.télécharger(
      this.service.dossiersExcel(this.from || undefined, this.to || undefined),
      'rapport-dossiers.xlsx',
    );
  }

  private télécharger(source: import('rxjs').Observable<Blob>, filename: string): void {
    this.busy.set(true);
    source.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}
