import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icone } from '../../../../shared/ui/icone';
import { ICONE_ETAT } from './etats-visuels';
import { Couverture, CouvertureLettres, EtatLigne, FiltreEtat, LIBELLES_ETAT, ORDRE_ETATS } from './modeles-pv-vue';

/**
 * Carte « Couverture des sous-types » (CoverageCard du cahier) : une barre empilée proportionnelle aux trois états, puis trois
 * compteurs qui pilotent le filtre de la liste (un second clic sur le compteur actif revient à « Tous »).
 */
@Component({
  selector: 'app-carte-couverture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @let c = couverture();
    <section class="ccv" aria-labelledby="ccv-titre">
      <div class="ccv__tete">
        <h2 id="ccv-titre" class="ccv__titre">Couverture des sous-types — procès-verbaux</h2>
        <span class="ccv__total">{{ c.total }} sous-types au total</span>
      </div>
      <div class="ccv__barre" role="img" [attr.aria-label]="resume()">
        @for (e of ordreBarre; track e) {
          @if (c.parEtat[e]) { <span [class]="'ccv__part ccv__part--' + e" [style.flex-grow]="c.parEtat[e]"></span> }
        }
      </div>
      <div class="ccv__compteurs">
        @for (e of etats; track e) {
          <button type="button" [class]="'ccv__compteur ccv__compteur--' + e" [class.ccv__compteur--actif]="filtre() === e" [attr.aria-pressed]="filtre() === e"
                  (click)="choisir.emit(filtre() === e ? 'tous' : e)">
            <span class="ccv__libelle"><app-icone [nom]="icones[e]" [taille]="16" /> {{ libelles[e] }}</span>
            <span class="ccv__nombre">{{ c.parEtat[e] }}</span>
            <span class="ccv__unite">sous-types</span>
          </button>
        }
      </div>
      @if (lettres(); as l) {
        @if (l.total) {
          <div class="ccv__lettres" [class.ccv__lettres--manque]="l.aucun">
            <span class="ccv__lettres-titre"><app-icone [nom]="l.aucun ? icones.miss : icones.ok" [taille]="16" /> Lettres de renvoi</span>
            <span class="ccv__lettres-texte">
              {{ l.total - l.aucun }} / {{ l.total }} sous-types couverts
              @if (l.integre) { · {{ l.integre }} par le modèle intégré }
              @if (l.modele) { · {{ l.modele }} par un modèle de l’application }
              @if (l.aucun) { · <strong>{{ l.aucun }} sans lettre</strong> }
            </span>
            @if (l.codeIntegre && l.integre) {
              <button type="button" class="ccv__lettres-voir" (click)="voirLettre.emit(l.codeIntegre)">Voir le modèle</button>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .ccv { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    .ccv__tete { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .ccv__titre { margin: 0; font-size: 15px; font-weight: 500; color: var(--text); }
    .ccv__total { font-size: 13px; color: var(--text-muted); }
    .ccv__barre { display: flex; height: 10px; border-radius: 5px; overflow: hidden; gap: 2px; background: var(--page-bg); }
    .ccv__part { flex-basis: 0; }
    .ccv__part--miss { background: var(--miss-accent); }
    .ccv__part--prep { background: var(--prep-accent); }
    .ccv__part--ok { background: var(--ok-accent); }
    .ccv__compteurs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .ccv__compteur { text-align: left; border: 1px solid; border-radius: 8px; padding: 10px 12px; cursor: pointer;
      font: inherit; display: flex; flex-direction: column; gap: 2px; }
    .ccv__compteur:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .ccv__libelle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
    .ccv__nombre { font-size: 20px; font-weight: 500; }
    .ccv__unite { font-size: 12px; }
    .ccv__compteur { background: var(--card-bg); border-color: var(--border); color: var(--text); border-left-width: 3px; }
    .ccv__compteur:hover { background: var(--page-bg); }
    .ccv__unite { color: var(--text-muted); }
    .ccv__compteur--miss { border-left-color: var(--miss-accent); }
    .ccv__compteur--prep { border-left-color: var(--prep-accent); }
    .ccv__compteur--ok { border-left-color: var(--ok-accent); }
    .ccv__compteur--miss .ccv__libelle { color: var(--miss-text); }
    .ccv__compteur--prep .ccv__libelle { color: var(--prep-text); }
    .ccv__compteur--ok .ccv__libelle { color: var(--ok-text); }
    .ccv__compteur--miss app-icone { color: var(--miss-accent); }
    .ccv__compteur--prep app-icone { color: var(--prep-accent); }
    .ccv__compteur--ok app-icone { color: var(--ok-accent); }
    /* Filtre actif : le fond et la bordure de l'état (1,5 px ; le padding compense le demi-pixel pour ne rien déplacer). */
    .ccv__compteur--actif { border-width: 1.5px 1.5px 1.5px 3px; padding: 9.5px 11.5px 9.5px 12px; }
    .ccv__compteur--miss.ccv__compteur--actif { background: var(--miss-bg); border-color: var(--miss-accent); }
    .ccv__compteur--prep.ccv__compteur--actif { background: var(--prep-bg); border-color: var(--prep-accent); }
    .ccv__compteur--ok.ccv__compteur--actif { background: var(--ok-bg); border-color: var(--ok-accent); }
    .ccv__lettres { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 10px; font-size: 13px; }
    .ccv__lettres-titre { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; color: var(--ok-text); }
    .ccv__lettres-titre app-icone { color: var(--ok-accent); }
    .ccv__lettres--manque .ccv__lettres-titre { color: var(--miss-text); }
    .ccv__lettres--manque .ccv__lettres-titre app-icone { color: var(--miss-accent); }
    .ccv__lettres-texte { color: var(--text-muted); flex: 1; }
    .ccv__lettres-voir { border: 1px solid var(--border); background: var(--card-bg); color: var(--primary); border-radius: 6px; padding: 3px 10px;
      font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ccv__lettres-voir:hover { background: var(--reco-bg); }
    .ccv__lettres-voir:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    @media (max-width: 640px) { .ccv__compteurs { grid-template-columns: 1fr; } }
  `,
})
export class CarteCouverture {
  readonly couverture = input.required<Couverture>();
  readonly filtre = input<FiltreEtat>('tous');
  readonly choisir = output<FiltreEtat>();
  /** ⚠️ 21/10 — la couverture des lettres de renvoi, comptée à part ; « Voir le modèle » ouvre le modèle intégré. */
  readonly lettres = input<CouvertureLettres | null>(null);
  readonly voirLettre = output<string>();

  readonly etats = ORDRE_ETATS;
  /** La barre se lit comme une progression : ce qui est en service d'abord, ce qui reste à créer en dernier. */
  readonly ordreBarre: readonly EtatLigne[] = ['ok', 'prep', 'miss'];
  readonly libelles = LIBELLES_ETAT;
  readonly icones = ICONE_ETAT;

  resume(): string {
    const c = this.couverture();
    return `${c.parEtat.miss} à créer, ${c.parEtat.prep} à déposer, ${c.parEtat.ok} en service, sur ${c.total} sous-types`;
  }

}
