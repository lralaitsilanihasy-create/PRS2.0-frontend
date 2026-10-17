import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { FicheMarche } from '../../models';
import { FicheMarcheService } from '../../services';

/**
 * ⚠️ 06/10 — l'en-tête des écrans d'une procédure (commission, dépôts, retraits, reçus des frais) : le **domaine**, le **numéro du
 * DAO** (à défaut la référence du plan) et l'**objet** du marché, à la place de « ligne 43 du plan » (43 était le n° de procédure).
 * Lit la fiche une fois ; en échec, retombe sur le n° de procédure.
 */
@Component({
  selector: 'app-entete-procedure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-subtitle ep">
      {{ domaine() }} ·
      @if (fiche(); as f) {
        <span class="cnm-mono">{{ reference(f) }}</span>@if (f.designationMarche) { <span class="ep__objet"> — {{ f.designationMarche }}</span> }
      } @else {
        procédure {{ idDmc() }}
      }
    </div>
  `,
  styles: `
    .ep { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ep__objet { text-transform: none; letter-spacing: normal; font-weight: 500; }
  `,
})
export class EnteteProcedure {
  readonly idDmc = input.required<number>();

  private readonly service = inject(FicheMarcheService);
  private readonly auth = inject(AuthService);
  readonly domaine = computed(() => (this.auth.role() === 'ADMINISTRATEUR' ? 'Administration' : this.auth.domainePrmpLabel()));
  readonly fiche = signal<FicheMarche | null>(null);

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.service.lire(id).subscribe({ next: (f) => this.fiche.set(f), error: () => this.fiche.set(null) });
    });
  }

  reference(f: FicheMarche): string {
    return numeroProcedure(f) || f.refeDossier || `procédure ${this.idDmc()}`;
  }
}

/**
 * Le numéro de la procédure, comme le serveur l'imprime sur le DAO complet (charte, R1 et R6 du 16-17/10) : `B02-OB-03` ;
 * pour un contrat-cadre, `B02-OE-01` (« NUMÉRO » du DPAC) d'abord, puis `B02-OB-03`. Vide si aucun n'est saisi.
 */
export function numeroProcedure(f: Pick<FicheMarche, 'typeMarche' | 'valeurs'>): string {
  const texte = (code: string): string => { const v = f.valeurs?.[code]; return typeof v === 'string' ? v.trim() : ''; };
  return (f.typeMarche === 'CONTRAT_CADRE' && texte('B02-OE-01')) || texte('B02-OB-03');
}
