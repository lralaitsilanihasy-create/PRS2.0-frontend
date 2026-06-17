import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

/**
 * Conteneur global des toasts. À monter une seule fois à la racine de l'application.
 */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="alert">
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
  `,
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
}
