import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icone } from '../../../../shared/ui/icone';

/**
 * En-tête de la page « Modèles de procès-verbaux » (PageHeader du cahier). Le fil d'Ariane est celui de la coquille, au-dessus :
 * le répéter ici le dédoublerait. « Historique » ouvre le journal de l'application ; l'historique propre à un modèle est sur sa fiche.
 */
@Component({
  selector: 'app-en-tete-modeles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, RouterLink],
  template: `
    <header class="etm">
      <span class="etm__icone" aria-hidden="true"><app-icone nom="file" [taille]="22" /></span>
      <div class="etm__titres">
        <h1 class="etm__titre">Modèles de procès-verbaux</h1>
        <p class="etm__role">Les modèles Word qui produisent les PV et les lettres de renvoi, sous-type par sous-type.</p>
      </div>
      <div class="etm__actions">
        <a class="etm__btn" routerLink="/admin/audit"><app-icone nom="history" [taille]="16" /> Historique</a>
        <button type="button" class="etm__btn etm__btn--principal" (click)="nouveau.emit()"><app-icone nom="plus" [taille]="16" /> Nouveau modèle</button>
      </div>
    </header>
  `,
  styles: `
    .etm { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .etm__icone { width: 44px; height: 44px; border-radius: 8px; background: var(--reco-bg); color: var(--primary);
      display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .etm__titres { flex: 1 1 18rem; min-width: 0; }
    .etm__titre { margin: 0; font-size: 22px; font-weight: 500; color: var(--text); }
    .etm__role { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
    .etm__actions { display: flex; gap: 8px; }
    .etm__btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font: inherit; font-size: 14px;
      font-weight: 500; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); cursor: pointer; text-decoration: none; }
    .etm__btn:hover { background: var(--page-bg); }
    .etm__btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .etm__btn--principal { background: var(--primary); border-color: var(--primary); color: var(--primary-text); }
    .etm__btn--principal:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
  `,
})
export class EnTeteModeles {
  readonly nouveau = output<void>();
}
