import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { DetailModele } from './detail-modele';
import { ICONE_ETAT } from './etats-visuels';
import { LigneModeleComposant } from './ligne-modele';
import { EtatLigne, LIBELLES_ETAT, LigneModele } from './modeles-pv-vue';

/**
 * La liste unique (ModelList du cahier), regroupée par état dans l'ordre d'urgence ; chaque groupe a son en-tête teinté. Une seule
 * ligne ouverte à la fois : son détail se déplie dessous.
 */
@Component({
  selector: 'app-liste-modeles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, LigneModeleComposant, DetailModele],
  template: `
    <div class="lsm">
      @for (g of groupes(); track g.etat) {
        <section [attr.aria-labelledby]="'groupe-' + g.etat">
          <h2 [class]="'lsm__groupe lsm__groupe--' + g.etat" [id]="'groupe-' + g.etat">
            <app-icone [nom]="icones[g.etat]" [taille]="16" /> {{ libelles[g.etat] }} <span class="lsm__nb">{{ g.lignes.length }}</span>
          </h2>
          <ul class="lsm__lignes">
            @for (l of g.lignes; track l.id) {
              <li>
                <app-ligne-modele [ligne]="l" [ouverte]="ouverte() === l.id" (basculer)="basculer.emit(l.id)" (action)="action.emit($event)" />
                @if (ouverte() === l.id) { <app-detail-modele [ligne]="l" (action)="action.emit($event)" (fichiers)="fichiers.emit($event)" /> }
              </li>
            }
          </ul>
        </section>
      } @empty {
        <p class="lsm__vide" role="status">Aucun modèle ne correspond. Essayez un autre code ou retirez le filtre.</p>
      }
    </div>
  `,
  styles: `
    .lsm { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .lsm__groupe { margin: 0; display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 13px; font-size: 13px; font-weight: 500; border-left: 3px solid; }
    section + section .lsm__groupe { border-top: 1px solid var(--border); }
    .lsm__groupe--miss { background: var(--miss-bg); color: var(--miss-text); border-left-color: var(--miss-accent); }
    .lsm__groupe--prep { background: var(--prep-bg); color: var(--prep-text); border-left-color: var(--prep-accent); }
    .lsm__groupe--ok { background: var(--ok-bg); color: var(--ok-text); border-left-color: var(--ok-accent); }
    .lsm__groupe--miss app-icone { color: var(--miss-accent); }
    .lsm__groupe--prep app-icone { color: var(--prep-accent); }
    .lsm__groupe--ok app-icone { color: var(--ok-accent); }
    .lsm__nb { font-weight: 400; }
    .lsm__lignes { list-style: none; margin: 0; padding: 0; }
    .lsm__lignes > li + li { border-top: 0.5px solid var(--border); }
    .lsm__vide { margin: 0; padding: 28px 16px; text-align: center; font-size: 14px; color: var(--text-muted); }
  `,
})
export class ListeModeles {
  readonly groupes = input.required<{ etat: EtatLigne; lignes: LigneModele[] }[]>();
  readonly ouverte = input<string | null>(null);
  readonly basculer = output<string>();
  readonly action = output<LigneModele>();
  readonly fichiers = output<LigneModele>();

  readonly icones = ICONE_ETAT;
  readonly libelles = LIBELLES_ETAT;
}
