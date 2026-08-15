import { Injectable, computed, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

/** Durées d'auto-fermeture des toasts discrets (ms). Ce qui passe en dialogue ne s'efface pas seul. */
const DEFAULT_TIMEOUTS: Record<ToastType, number> = {
  success: 0,
  info: 4000,
  warning: 0,
  error: 0,
};

/**
 * Types présentés en BOÎTE DE DIALOGUE plutôt qu'en toast discret : les refus (2026-08-06) et, à la
 * même demande, les **acceptations** — l'utilisateur doit voir le résultat de son geste aussi nettement
 * qu'il en voit l'échec. Seul `info`, simple notice de contexte, reste un toast discret.
 */
const TYPES_DIALOGUE: ReadonlySet<ToastType> = new Set<ToastType>(['error', 'warning', 'success']);

/**
 * File de notifications UI. Deux registres, un seul point d'entrée :
 *
 * - **toasts** (`info`) — notices discrètes en haut à droite, auto-effacées ;
 * - **alertes** (`error`, `warning`, `success`) — ⚠️ demande user 2026-08-06 : le résultat d'un geste
 *   est une information dont l'utilisateur doit accuser réception, pas un bandeau qui s'évanouit dans
 *   un coin — d'abord les refus, puis les acceptations à la même demande. Elles s'affichent en **boîte
 *   de dialogue centrée** (zoom à l'ouverture), sans auto-fermeture, une à la fois : la suivante prend
 *   la place quand la précédente est fermée.
 *
 * L'API publique (`success/info/warning/error/dismiss/clear`) est inchangée — aucun appelant à retoucher.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private readonly _alertes = signal<Toast[]>([]);

  /** Toasts discrets en cours d'affichage. */
  readonly toasts = this._toasts.asReadonly();
  /** File des avertissements ; seul le premier est présenté. */
  readonly alertes = this._alertes.asReadonly();
  /** L'avertissement actuellement affiché, `null` s'il n'y en a aucun. */
  readonly alerteCourante = computed<Toast | null>(() => this._alertes()[0] ?? null);

  private nextId = 1;

  show(type: ToastType, message: string, title?: string): number {
    const id = this.nextId++;
    const item: Toast = { id, type, message, title };

    if (TYPES_DIALOGUE.has(type)) {
      // ⚠️ Dédoublonnage sur le SEUL texte, titre ignoré : l'intercepteur d'erreurs publie déjà le
      // message du serveur (titré « Action impossible »), et beaucoup de composants le republient
      // ensuite sans titre — en toast le doublon passait inaperçu, en dialogue il faudrait fermer
      // deux fois. Le premier arrivé (celui de l'intercepteur, titré) l'emporte. Couvre aussi le
      // message identique qui rejoue (double-clic, sondage).
      const dejaEnFile = this._alertes().some((a) => a.message === message);
      if (dejaEnFile) {
        return id;
      }
      this._alertes.update((list) => [...list, item]);
      return id;
    }

    this._toasts.update((list) => [...list, item]);
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

  /** Titre par défaut du dialogue quand l'appelant n'en fournit pas. */
  static titreParDefaut(type: ToastType): string {
    if (type === 'success') return "C'est fait";
    if (type === 'warning') return 'Attention';
    return 'Action impossible';
  }

  /** Pictogramme du dialogue. */
  static icone(type: ToastType): string {
    if (type === 'success') return '✅';
    if (type === 'warning') return '⚠️';
    return '⛔';
  }

  /** Libellé du bouton de fermeture : on n'« a pas compris » une réussite, on continue. */
  static libelleFermeture(type: ToastType): string {
    return type === 'success' ? 'Continuer' : "J'ai compris";
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
    this._alertes.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
    this._alertes.set([]);
  }
}
