import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';

import { ModaleDirective } from '../a11y/modale.directive';
import { Icone } from './icone';

/**
 * Confirmation de sortie d'un écran qui porte des modifications non enregistrées (garde
 * `sortieProtegeeGuard`). Présentationnelle : l'hôte l'affiche quand le routeur lui demande s'il peut
 * partir, et résout la navigation selon le bouton choisi.
 *
 * « Rester » est le choix sûr : il reçoit le focus initial (motif APG « alertdialog » : l'action la
 * moins destructive), et Échap ou ✕ valent « Rester ».
 */
@Component({
  selector: 'app-confirmation-sortie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, Icone],
  template: `
    <div class="modal-backdrop">
      <div
        class="modal confirmation-sortie"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-label]="titre()"
        aria-describedby="confirmation-sortie-message"
        appModale
        (appModaleFermer)="rester.emit()"
      >
        <div class="modal-header">
          <h2 class="modal-title confirmation-sortie__titre"><app-icone nom="alert" [taille]="18" />{{ titre() }}</h2>
          <button type="button" class="btn-close" aria-label="Fermer et rester sur l'écran" (click)="rester.emit()">
            <app-icone nom="x" [taille]="14" />
          </button>
        </div>
        <p class="modal-body confirmation-sortie__message" id="confirmation-sortie-message">{{ message() }}</p>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" (click)="quitter.emit()">{{ libelleQuitter() }}</button>
          <button #boutonRester type="button" class="btn btn-primary" (click)="rester.emit()">{{ libelleRester() }}</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .confirmation-sortie { max-width: 480px; }
    .confirmation-sortie__titre { display: flex; align-items: center; gap: 8px; margin: 0; }
    .confirmation-sortie__titre app-icone { color: var(--warning-text); }
    .confirmation-sortie__message { margin: 0; color: var(--n-700); line-height: 1.5; }
  `,
})
export class ConfirmationSortie implements AfterViewInit {
  private readonly boutonRester = viewChild.required<ElementRef<HTMLButtonElement>>('boutonRester');
  readonly titre = input('Quitter sans enregistrer ?');
  readonly message = input('Les modifications non enregistrées seront perdues.');
  readonly libelleRester = input("Rester sur l'écran");
  readonly libelleQuitter = input('Quitter sans enregistrer');
  readonly rester = output<void>();
  readonly quitter = output<void>();

  /**
   * Passe après `appModale` (qui focalise le conteneur faute d'attribut `autofocus`, refusé par
   * ESLint) : le hook du composant suit ceux des directives de sa propre vue.
   */
  ngAfterViewInit(): void {
    this.boutonRester().nativeElement.focus();
  }
}
