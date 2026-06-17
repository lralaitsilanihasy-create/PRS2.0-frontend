import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

/** Durées d'auto-fermeture par type (ms). Les erreurs restent affichées plus longtemps. */
const DEFAULT_TIMEOUTS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

/**
 * File de notifications UI (toasts). Pile centralisée lue par `ToastContainer`.
 * Sert d'affichage des messages d'erreur API et des confirmations d'action.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  /** Liste réactive des toasts en cours d'affichage. */
  readonly toasts = this._toasts.asReadonly();

  private nextId = 1;

  show(type: ToastType, message: string, title?: string): number {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, type, message, title }]);

    const timeout = DEFAULT_TIMEOUTS[type];
    if (timeout > 0) {
      setTimeout(() => this.dismiss(id), timeout);
    }
    return id;
  }

  success(message: string, title?: string): number {
    return this.show('success', message, title);
  }
  info(message: string, title?: string): number {
    return this.show('info', message, title);
  }
  warning(message: string, title?: string): number {
    return this.show('warning', message, title);
  }
  error(message: string, title?: string): number {
    return this.show('error', message, title);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
