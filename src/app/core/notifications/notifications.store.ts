import { Injectable, effect, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../../services';

/**
 * ⚠️ Spec notifications temps réel (2026-08-02) — store PARTAGÉ du compteur de non-lues :
 * - la valeur vient TOUJOURS du serveur (`GET /mes/non-lues/count`), le front ne fait que la refléter ;
 * - poussée temps réel via SSE (`GET /api/notifications/stream`, fetch-stream avec Bearer — EventSource
 *   ne porte pas de header) : chaque événement `maj` déclenche un rechargement du compteur ;
 * - repli : polling périodique (60 s) si le flux est indisponible ; reconnexion automatique ;
 * - synchronisation entre onglets : BroadcastChannel (une action locale notifie les autres onglets,
 *   qui rechargent) — en plus du SSE serveur qui pousse déjà à tous les flux du destinataire.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly service = inject(NotificationService);
  private readonly auth = inject(AuthService);

  /** Nombre de non-lues (source : serveur). */
  readonly count = signal(0);
  /** Révision : incrémentée à chaque `maj` — les écrans (page, cloche) peuvent recharger leurs listes. */
  readonly revision = signal(0);

  private canal: BroadcastChannel | null = null;
  private streamAbort: AbortController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.canal = new BroadcastChannel('cnm-notifications');
      this.canal.onmessage = () => this.refresh();
    }
    // Suit la session : connecte le flux à la connexion, coupe tout à la déconnexion.
    effect(() => {
      const token = this.auth.token();
      this.deconnecterFlux();
      if (token) {
        this.refresh();
        this.connecterFlux(token);
        this.demarrerPolling();
      } else {
        this.count.set(0);
        this.arreterPolling();
      }
    });
  }

  /** Recharge le compteur serveur + signale une révision (listes à rafraîchir). */
  refresh(): void {
    this.service.nonLuesCount().subscribe({
      next: (r) => {
        this.count.set(r.nonLues);
        this.revision.update((v) => v + 1);
      },
      error: () => {},
    });
  }

  /** À appeler après une action locale (lu / non-lu / tout-lu) : recharge + prévient les autres onglets. */
  actionLocale(): void {
    this.refresh();
    this.canal?.postMessage('maj');
  }

  /** Flux SSE via fetch-stream (porte le Bearer) ; reconnexion différée en cas de coupure. */
  private connecterFlux(token: string): void {
    const abort = new AbortController();
    this.streamAbort = abort;
    void (async () => {
      try {
        const rep = await fetch(`${environment.apiUrl}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: abort.signal,
        });
        if (!rep.ok || !rep.body) throw new Error('flux indisponible');
        const reader = rep.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk.includes('maj')) {
            this.refresh();
          }
        }
      } catch {
        // Coupure / indisponible : le polling assure le repli.
      }
      // Reconnexion (fin de timeout serveur ~30 min ou coupure), sauf si volontairement fermé.
      if (this.streamAbort === abort && this.auth.token()) {
        setTimeout(() => {
          if (this.streamAbort === abort && this.auth.token()) {
            this.connecterFlux(this.auth.token()!);
          }
        }, 5000);
      }
    })();
  }

  private deconnecterFlux(): void {
    this.streamAbort?.abort();
    this.streamAbort = null;
  }

  private demarrerPolling(): void {
    this.arreterPolling();
    this.pollTimer = setInterval(() => this.refresh(), 60_000);
  }
  private arreterPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
