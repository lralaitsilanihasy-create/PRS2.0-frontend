import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { ApiError, codeErreur, corpsErreur } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { ModeRemise } from '../../../models';
import { FicheMarcheService } from '../../../services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';

const LIBELLE_MODE: Readonly<Record<ModeRemise, string>> = { PAPIER: 'papier', ELECTRONIQUE: 'électronique' };

/** Le refus d'une migration, nommé (contrat R8). */
export function refusMigration(e: ApiError): string {
  switch (codeErreur(e)) {
    case 'MODE_IRREVERSIBLE': {
      const raison = corpsErreur<{ details?: { raison?: string } }>(e)?.details?.raison;
      const pourquoi = raison === 'OFFRES' ? 'des offres sont déjà déposées en ligne'
        : raison === 'CEREMONIE_CLOSE' ? 'la cérémonie des clés est close'
        : raison === 'ATTRIBUTION' ? 'un lot est déjà attribué'
        : 'la procédure a passé le point de non-retour';
      return `Le mode ne peut plus changer : ${pourquoi}.`;
    }
    case 'MODE_IDENTIQUE': return 'La fiche est déjà dans ce mode de remise.';
    case 'MODE_NON_FIGE': return 'Aucune version n’est validée : le mode se change dans le cadrage, sans migration.';
    case 'MOTIF_OBLIGATOIRE': return 'Le motif de la migration est obligatoire.';
    case 'MOTIF_TROP_LONG': return 'Le motif dépasse 1 000 caractères.';
    case 'MODE_INVALIDE': return 'Ce mode de remise n’est pas reconnu.';
    case 'DOSSIER_EN_EXAMEN': return 'Le dossier de la révision est à l’examen de la Commission : la migration attend son issue.';
  }
  if (e.status === 403) return 'Seul l’Administrateur migre le mode de remise d’une procédure.';
  return e.message || 'La migration n’a pas abouti.';
}

/**
 * ⚠️ R8 (V110, 13/10 ; arbitrage Q1 du pilote) — la **migration documentée** du mode de remise, seule exception au mode figé :
 * Administrateur seul. Elle ouvre une révision de la fiche avec le nouveau mode (la version validée reste intacte) ; la PRMP ressaisit
 * ce que le mode exige, puis valide. Impossible dès une offre déposée en ligne, une cérémonie close ou un lot attribué.
 */
@Component({
  selector: 'app-migration-mode',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir()">Migrer le mode de remise…</button>
    @if (ouverte()) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Migrer le mode de remise des offres" appModale (appModaleFermer)="fermer()">
          <div class="modal-header">
            <span class="modal-title">Migrer le mode de remise</span>
            <button type="button" class="btn-close" aria-label="Fermer sans migrer" [disabled]="envoi()" (click)="fermer()">✕</button>
          </div>
          <div class="modal-body mm">
            <p class="text-sm">La fiche est figée en remise <strong>{{ libelle(modeActuel()) }}</strong>. La migration la passe en remise <strong>{{ libelle(cible()) }}</strong> : elle ouvre une <strong>révision</strong> (la version validée reste intacte), que la PRMP complète de ce que ce mode exige, puis valide. Elle est tracée au journal du plan et du dossier, avec votre motif.</p>
            <label class="form-group">
              <span class="form-label">Motif (obligatoire, 1 000 caractères au plus)</span>
              <textarea class="form-control" rows="3" maxlength="1000" [value]="motif()" (input)="motif.set($any($event.target).value)"></textarea>
            </label>
            @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="envoi()" (click)="fermer()">Annuler</button>
            <button type="button" class="btn btn-primary" [disabled]="!motif().trim() || envoi()" (click)="migrer()">{{ envoi() ? 'Migration…' : 'Migrer vers la remise ' + libelle(cible()) }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `.mm { display: flex; flex-direction: column; gap: 0.75rem; }`,
})
export class MigrationMode {
  private readonly service = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** Le mode figé de la fiche (`modeRemiseFige`). */
  readonly modeActuel = input.required<ModeRemise>();
  /** La migration a abouti : la fiche se relit (révision ouverte). */
  readonly migree = output<void>();

  readonly ouverte = signal(false);
  readonly envoi = signal(false);
  readonly motif = signal('');
  readonly refus = signal<string | null>(null);

  cible(): ModeRemise {
    return this.modeActuel() === 'ELECTRONIQUE' ? 'PAPIER' : 'ELECTRONIQUE';
  }

  libelle(m: ModeRemise): string {
    return LIBELLE_MODE[m];
  }

  ouvrir(): void {
    this.motif.set('');
    this.refus.set(null);
    this.ouverte.set(true);
  }

  fermer(): void {
    if (!this.envoi()) this.ouverte.set(false);
  }

  migrer(): void {
    const motif = this.motif().trim();
    if (!motif || this.envoi()) return;
    this.envoi.set(true);
    this.refus.set(null);
    this.service.migrerMode(this.idDmc(), this.cible(), motif).subscribe({
      next: () => {
        this.envoi.set(false);
        this.ouverte.set(false);
        this.toast.success(`Mode migré vers la remise ${this.libelle(this.cible())} : une révision est ouverte, à compléter par la PRMP puis à valider.`);
        this.migree.emit();
      },
      error: (e: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refusMigration(e));
      },
    });
  }
}
