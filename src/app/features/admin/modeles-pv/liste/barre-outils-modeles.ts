import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { FiltreEtat, LIBELLES_ETAT, Tri } from './modeles-pv-vue';

/** Barre d'outils (Toolbar du cahier) : recherche, contrôle segmenté d'état, tri. */
@Component({
  selector: 'app-barre-outils-modeles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    <div class="bom">
      <label class="bom__recherche">
        <span class="bom__loupe" aria-hidden="true"><app-icone nom="search" [taille]="16" /></span>
        <input type="search" placeholder="Modèle ou code (ex. DAOR)" aria-label="Rechercher un modèle ou un code de sous-type"
               [value]="recherche()" (input)="rechercheChange.emit($any($event.target).value)" />
      </label>
      @if (filtre() !== 'tous') {
        <button type="button" class="bom__filtre" (click)="filtreChange.emit('tous')" [attr.aria-label]="'Retirer le filtre ' + libelles[filtre()]">
          {{ libelles[filtre()] }} <span aria-hidden="true">✕</span>
        </button>
      }
      <select class="bom__tri" aria-label="Trier" [value]="tri()" (change)="triChange.emit($any($event.target).value)">
        <option value="priorite" [selected]="tri() === 'priorite'">Tri : priorité</option>
        <option value="nom" [selected]="tri() === 'nom'">Tri : nom</option>
      </select>
    </div>
  `,
  styles: `
    .bom { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .bom__recherche { flex: 1 1 16rem; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border: 1px solid var(--border-control);
      border-radius: 8px; background: var(--card-bg); color: var(--text-muted); }
    .bom__recherche:focus-within { border-color: var(--primary); outline: 2px solid var(--primary); outline-offset: 1px; }
    .bom__recherche input { border: 0; outline: 0; flex: 1; min-width: 0; font: inherit; font-size: 14px; color: var(--text); background: transparent; }
    .bom__recherche input::placeholder { color: var(--text-muted); }
    .bom__loupe { display: inline-flex; }
    .bom__filtre { height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--primary); background: var(--reco-bg); color: var(--texte);
      font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .bom__filtre:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .bom__segments { display: inline-flex; border: 1px solid var(--border-control); border-radius: 8px; overflow: hidden; background: var(--card-bg); }
    .bom__segment { border: 0; background: transparent; font: inherit; font-size: 13px; font-weight: 400; padding: 0 12px; height: 34px; cursor: pointer; color: var(--text-muted); }
    .bom__segment + .bom__segment { border-left: 1px solid var(--border); }
    .bom__segment:hover { background: var(--page-bg); color: var(--text); }
    .bom__segment:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .bom__segment--actif, .bom__segment--actif:hover { background: var(--reco-bg); color: var(--texte); font-weight: 500; }
    .bom__tri { height: 36px; border: 1px solid var(--border-control); border-radius: 8px; padding: 0 10px; font: inherit; font-size: 13px;
      background: var(--card-bg); color: var(--text); }
    .bom__tri:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-color: var(--primary); }
  `,
})
export class BarreOutilsModeles {
  readonly recherche = input('');
  readonly filtre = input<FiltreEtat>('tous');
  readonly tri = input<Tri>('priorite');
  readonly rechercheChange = output<string>();
  readonly filtreChange = output<FiltreEtat>();
  readonly triChange = output<Tri>();

  /** Le filtre se choisit sur les compteurs de la couverture ; la barre ne fait que le rappeler, pour l'enlever. */
  readonly libelles: Readonly<Record<string, string>> = LIBELLES_ETAT;
}
