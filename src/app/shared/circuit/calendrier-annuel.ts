import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ouvrirBlobSur } from '../../core/securite/fichiers-surs';
import { DossierService } from '../../services';

/**
 * ⚠️ Q-pièce (arbitrage du pilote, 14/10 ; backend Q2, V115) — le **calendrier annuel de passation**, produit par l'application à
 * partir du plan contrôlé, remplace la pièce « Calendrier annuel de passation mis à jour et signé ». Depuis un plan, ou depuis un
 * dossier né d'une fiche DAO (le plan de sa ligne). Les processus « sans objet » y figurent avec leur motif ; un plan soumis avant la
 * règle montre ses processus « non daté ».
 */
@Component({
  selector: 'app-calendrier-annuel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ca" [class.ca--en-ligne]="enLigne()">
      <button type="button" class="btn btn-outline btn-sm" [disabled]="chargement()" (click)="ouvrir()">
        {{ chargement() ? 'Production…' : 'Calendrier annuel de passation (PDF)' }}
      </button>
      @if (refus(); as r) { <span class="ca__refus" role="alert">{{ r }}</span> }
    </div>
  `,
  styles: `
    .ca { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .ca--en-ligne { margin-bottom: 0; }
    .ca__refus { color: var(--danger-text); font-size: var(--text-sm); }
  `,
})
export class CalendrierAnnuel {
  private readonly service = inject(DossierService);

  readonly idDossier = input.required<number>();
  /** Posé dans une barre d'actions, à côté d'autres boutons : sans marge basse. */
  readonly enLigne = input(false);
  readonly chargement = signal(false);
  readonly refus = signal<string | null>(null);

  ouvrir(): void {
    this.chargement.set(true);
    this.refus.set(null);
    this.service.calendrierAnnuel(this.idDossier()).subscribe({
      next: (pdf) => {
        this.chargement.set(false);
        ouvrirBlobSur(pdf);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        void codeDuRefus(e).then((code) => {
          this.chargement.set(false);
          this.refus.set(
            code === 'CALENDRIER_INDISPONIBLE'
              ? 'Ce dossier n’a pas de plan de passation dans l’application : le calendrier annuel ne peut pas être produit.'
              : 'Le calendrier annuel n’a pas pu être produit.',
          );
        });
      },
    });
  }
}

/** Le code d'un refus servi à une requête binaire : le corps JSON arrive alors en `Blob`, que `codeErreur` ne lit pas. */
async function codeDuRefus(e: ApiError | HttpErrorResponse): Promise<string | null> {
  const direct = codeErreur(e);
  if (direct) return direct;
  const corps = (((e as ApiError).raw ?? e) as HttpErrorResponse).error as unknown;
  if (!(corps instanceof Blob)) return null;
  try {
    const lu = JSON.parse(await corps.text()) as { code?: unknown };
    return typeof lu.code === 'string' ? lu.code : null;
  } catch {
    return null;
  }
}
