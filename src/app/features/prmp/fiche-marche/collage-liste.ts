import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';

import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { LectureListe } from './collage-listes';

/**
 * ⚠️ 03/10 — la fenêtre « Coller une liste », commune au matériel, au personnel et aux pièces : la PRMP colle le passage
 * de son DAO, l'écran le découpe (`lire`) et montre chaque entrée **telle que le DPAO l'imprimera** (`ligne`). Rien n'est
 * ajouté avant le clic, rien n'est enregistré avant « Enregistrer ». Fermeture par « Annuler », ✕ ou Échap (règle du 13/09).
 */
@Component({
  selector: 'app-collage-liste',
  standalone: true,
  imports: [ModaleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .cl { display: flex; flex-direction: column; gap: 0.7rem; }
      .cl__f { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; color: var(--n-600); }
      .cl__zone { font-size: 0.84rem; }
      .cl__etat { margin: 0; font-size: 0.84rem; color: var(--n-500); }
      .cl__apercu { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.6rem 0.8rem; border-left: 3px solid var(--p-300); background: var(--p-50); font-size: 0.84rem; color: var(--n-700); }
      .cl__note { margin: 0; font-size: 0.82rem; color: var(--n-600); }
    `,
  ],
  template: `
    <div class="modal-backdrop">
      <div class="modal modal-lg" role="dialog" aria-modal="true" [attr.aria-label]="titre()" appModale (appModaleFermer)="ferme.emit()">
        <div class="modal-header">
          <span class="modal-title">{{ titre() }}</span>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="ferme.emit()">✕</button>
        </div>
        <div class="modal-body cl">
          <p class="cl__etat">
            Copiez le passage dans votre DAO, puis collez-le ici : une entrée par ligne, ou séparées par « ; » ou « - ».
            Vérifiez l’aperçu ; chaque entrée reste modifiable après l’ajout.
          </p>
          <label class="cl__f">
            <span>Passage copié</span>
            <textarea class="form-control cl__zone" rows="7" [placeholder]="exemple()" [value]="texte()" (input)="texte.set($any($event.target).value)"></textarea>
          </label>
          @if (texte().trim()) {
            <p class="cl__etat" role="status">{{ lecture().entrees.length }} entrée(s) reconnue(s).</p>
            @if (lecture().entrees.length) {
              <div class="cl__apercu">
                @for (e of lecture().entrees; track $index) { <span>{{ ligne()(e) }}</span> }
              </div>
            }
            @if (lecture().note; as note) {
              <p class="cl__note">Mis à part, valant pour toutes les entrées : « {{ note }} »{{ noteUtilisee() ? '' : ' — à reprendre au besoin dans le texte libre du bloc.' }}</p>
            }
          }
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" (click)="ferme.emit()">Annuler</button>
          <button type="button" class="btn btn-primary" [disabled]="!lecture().entrees.length" (click)="ajoute.emit(lecture().entrees)">
            Ajouter {{ lecture().entrees.length }} entrée(s)
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CollageListe<T> implements OnInit {
  readonly titre = input.required<string>();
  readonly exemple = input<string>('');
  readonly lire = input.required<(texte: string) => LectureListe<T>>();
  readonly ligne = input.required<(entree: T) => string>();
  /** La note commune est-elle reprise dans les entrées (les justificatifs du personnel) ? Sinon, on le dit. */
  readonly noteUtilisee = input<boolean>(false);
  readonly ajoute = output<T[]>();
  readonly ferme = output<void>();
  /** ⚠️ 06/10 — un texte de départ (le texte des pièces de la fiche), que la PRMP relit et corrige avant d'ajouter. */
  readonly texteInitial = input<string>('');

  readonly texte = signal('');

  ngOnInit(): void {
    if (this.texteInitial()) this.texte.set(this.texteInitial());
  }
  readonly lecture = computed(() => this.lire()(this.texte()));
}
