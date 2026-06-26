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
      <header class="page-header">
        <h1 class="page-title">Rapports des dossiers</h1>
      </header>

      <div class="rapports__filters">
        <div class="form-group">
          <label class="form-label">Du</label>
          <input class="form-control" type="date" [(ngModel)]="from" />
        </div>
        <div class="form-group">
          <label class="form-label">Au</label>
          <input class="form-control" type="date" [(ngModel)]="to" />
        </div>
      </div>

      <div class="rapports__actions">
        <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="pdf()">
          Télécharger PDF
        </button>
        <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="excel()">
          Télécharger Excel
        </button>
      </div>
      <p class="form-hint">Période facultative : sans dates, tous les dossiers sont inclus.</p>
    </section>
  `,
  styles: `
    .rapports__filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .rapports__filters .form-group { margin-bottom: 0; }
    .rapports__actions {
      display: flex;
      gap: 0.5rem;
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
