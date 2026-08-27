import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { ToastService } from './toast.service';

/**
 * Conteneur global des notifications. À monter une seule fois à la racine de l'application.
 *
 * Deux présentations, selon le registre alimenté par `ToastService` :
 * - la pile discrète des confirmations (succès / information) en haut à droite ;
 * - ⚠️ la **boîte de dialogue d'avertissement** (erreur / avertissement, demande user 2026-08-06),
 *   centrée, avec zoom à l'affichage, fermée explicitement par l'utilisateur (bouton, Échap ou
 *   clic sur le fond). Les avertissements se présentent **un à un** : fermer révèle le suivant.
 */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="status">
          <div class="toast__body">
            @if (toast.title) {
              <strong class="toast__title">{{ toast.title }}</strong>
            }
            <span class="toast__message">{{ toast.message }}</span>
          </div>
          <button
            type="button"
            class="toast__close"
            aria-label="Fermer"
            (click)="toastService.dismiss(toast.id)"
          >
            &times;
          </button>
        </div>
      }
    </div>

    @if (toastService.alerteCourante(); as alerte) {
      <div class="alerte-backdrop">
        <div
          class="alerte alerte--{{ alerte.type }}"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alerte-titre"
          aria-describedby="alerte-message"
          appModale
          appModaleClicExterieur
          (appModaleFermer)="toastService.dismiss(alerte.id)"
        >
          <div class="alerte__icone" aria-hidden="true">{{ icone(alerte.type) }}</div>
          <h2 class="alerte__titre" id="alerte-titre">
            {{ alerte.title || titreParDefaut(alerte.type) }}
          </h2>
          <p class="alerte__message" id="alerte-message">{{ alerte.message }}</p>
          <div class="alerte__actions">
            <button
              #boutonFermer
              type="button"
              class="alerte__bouton"
              (click)="toastService.dismiss(alerte.id)"
            >
              {{ libelleFermeture(alerte.type) }}
            </button>
          </div>
          @if (toastService.alertes().length > 1) {
            <p class="alerte__reste">
              {{ toastService.alertes().length - 1 }} autre(s) message(s) à la suite
            </p>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);

  /** Identité visuelle du dialogue, portée par le service (source unique). */
  protected readonly icone = ToastService.icone;
  protected readonly titreParDefaut = ToastService.titreParDefaut;
  protected readonly libelleFermeture = ToastService.libelleFermeture;

  private readonly boutonFermer = viewChild<ElementRef<HTMLButtonElement>>('boutonFermer');

  constructor() {
    // Le clavier suit le dialogue : Échap et le clic sur le fond sont portés par `appModale`
    // (qui y ajoute le piège de focus et la restitution du focus au déclencheur), et le focus
    // part du bouton (sinon il resterait sur le champ de fichier, derrière le fond).
    effect(() => {
      const bouton = this.boutonFermer();
      if (bouton) {
        bouton.nativeElement.focus();
      }
    });
  }
}
