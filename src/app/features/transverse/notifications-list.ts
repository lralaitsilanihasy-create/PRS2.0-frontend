import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { InterimStore } from '../../core/interim/interim.store';
import { Notification } from '../../models';
import { NotificationService } from '../../services';

/** Liste des notifications de l'utilisateur (lecture). Réutilisable par tout profil. */
@Component({
  selector: 'app-notifications-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="notifs">
      <h1 class="notifs__title">Notifications</h1>

      @if (loading()) {
        <p class="notifs__info" role="status">Chargement…</p>
      } @else {
        <ul class="notifs__list">
          @for (n of notifications(); track n.idNotification) {
            <li class="notif" [class.notif--unread]="!n.lu">
              <div class="notif__head">
                <span class="notif__type">{{ n.typeNotif }}</span>
                <!-- Intérim désigné (2026-09-21) : copie adressée au titulaire que je supplée. -->
                @if (n.interimDe) {
                  <span class="notif__interim">par intérim de {{ nomTitulaire(n.interimDe) }}</span>
                }
                <span class="notif__date">{{ n.dateEnvoi || '' }}</span>
              </div>
              @if (n.titre) {
                <strong class="notif__titre">{{ n.titre }}</strong>
              }
              @if (n.corps) {
                <p class="notif__corps">{{ n.corps }}</p>
              }
            </li>
          } @empty {
            <li class="notifs__info">Aucune notification.</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .notif__interim { font-size: var(--text-xs); color: var(--info-text, #075985); margin-left: 0.5rem; }
    .notifs__title {
      margin: 0 0 var(--cnm-space-4);
      font-size: var(--cnm-fs-lg);
    }
    .notifs__info {
      color: var(--cnm-text-2);
    }
    .notifs__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-2);
    }
    .notif {
      background: var(--cnm-surface);
      border: 1px solid var(--cnm-border);
      border-radius: var(--cnm-radius);
      padding: var(--cnm-space-3) var(--cnm-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cnm-space-1);
    }
    .notif--unread {
      border-left: 3px solid var(--cnm-brand);
    }
    .notif__head {
      display: flex;
      justify-content: space-between;
      font-size: var(--cnm-fs-xs);
      color: var(--cnm-text-2);
    }
    .notif__type {
      font-weight: var(--cnm-fw-semibold);
      color: var(--cnm-info-fg);
    }
    .notif__corps {
      margin: 0;
      font-size: var(--cnm-fs-sm);
      color: var(--cnm-text-2);
    }
  `,
})
export class NotificationsList {
  private readonly service = inject(NotificationService);
  private readonly interims = inject(InterimStore);
  /** Nom du titulaire suppléé (l'intérimaire le connaît par `interims/mes`) ; sinon le matricule. */
  nomTitulaire(im: string): string {
    return this.interims.nomTitulaire(im);
  }

  readonly notifications = signal<Notification[]>([]);
  readonly loading = signal(false);

  constructor() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.notifications.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
