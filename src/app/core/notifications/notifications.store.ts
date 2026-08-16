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
 * - `revision` n'est signalée que si le compteur a réellement changé ou sur événement explicite
 *   (`maj` serveur, action locale) : le poll de repli ne doit pas faire recharger les listes
 *   des écrans toutes les 60 s sans changement. Le poll est d'ailleurs sauté quand le flux SSE
 *   est connecté ou l'onglet caché.
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
  private reconnexionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Vrai tant que le flux SSE est connecté : le polling de repli se met en veille. */
  private fluxActif = false;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.canal = new BroadcastChannel('cnm-notifications');
      this.canal.onmessage = () => this.refresh(true);
    }
    // Onglet redevenu visible : resynchronisation immédiate (les polls en onglet caché sont sautés).
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.auth.token()) {
        this.refresh();
      }
    });
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

  /**
   * Recharge le compteur serveur. La révision (qui fait recharger les listes des écrans)
   * n'est signalée que si la valeur a changé, ou si `forcerRevision` est vrai (événement
   * `maj` du serveur, action locale) — le contenu a pu changer à compteur constant.
   */
  refresh(forcerRevision = false): void {
    this.service.nonLuesCount().subscribe({
      next: (r) => {
        const change = r.nonLues !== this.count();
        this.count.set(r.nonLues);
        if (change || forcerRevision) {
          this.revision.update((v) => v + 1);
        }
      },
      error: () => {},
    });
  }

  /** À appeler après une action locale (lu / non-lu / tout-lu) : recharge + prévient les autres onglets. */
  actionLocale(): void {
    this.refresh(true);
    this.canal?.postMessage('maj');
  }

  /** Flux SSE via fetch-stream (porte le Bearer) ; reconnexion différée en cas de coupure. */
  private connecterFlux(token: string): void {
    const abort = new AbortController();
    this.streamAbort = abort;
    void (async () => {
      let arretDefinitif = false;
      try {
        const rep = await fetch(`${environment.apiUrl}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: abort.signal,
        });
        if (rep.status === 401) {
          // Jeton refusé : reboucler toutes les 5 s n'y changera rien — la minuterie
          // d'expiration (AuthService) et l'intercepteur d'erreurs gèrent la déconnexion.
          arretDefinitif = true;
          throw new Error('non autorisé');
        }
        if (!rep.ok || !rep.body) throw new Error('flux indisponible');
        this.fluxActif = true;
        const reader = rep.body.getReader();
        const decoder = new TextDecoder();
        // Tampon d'événements SSE : un chunk réseau peut couper un événement en deux.
        let tampon = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          tampon += decoder.decode(value, { stream: true });
          const evenements = tampon.split('\n\n');
          tampon = evenements.pop() ?? '';
          if (evenements.some((e) => e.includes('maj'))) {
            this.refresh(true);
          }
        }
      } catch {
        // Coupure / indisponible : le polling assure le repli.
      }
      this.fluxActif = false;
      // Reconnexion (fin de timeout serveur ~30 min ou coupure), sauf si volontairement fermé.
      if (!arretDefinitif && this.streamAbort === abort && this.auth.token()) {
        this.reconnexionTimer = setTimeout(() => {
          if (this.streamAbort === abort && this.auth.token()) {
            this.connecterFlux(this.auth.token()!);
          }
        }, 5000);
      }
    })();
  }

  private deconnecterFlux(): void {
    if (this.reconnexionTimer) {
      clearTimeout(this.reconnexionTimer);
      this.reconnexionTimer = null;
    }
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.fluxActif = false;
  }

  private demarrerPolling(): void {
    this.arreterPolling();
    // Repli seulement : sauté quand le flux SSE est connecté ou que l'onglet est caché.
    this.pollTimer = setInterval(() => {
      if (this.fluxActif || document.hidden) {
        return;
      }
      this.refresh();
    }, 60_000);
  }
  private arreterPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
