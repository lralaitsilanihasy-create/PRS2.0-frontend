import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { routePourNotification } from '../../core/notifications/notification-route';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Dossier, Notification } from '../../models';
import { DossierService, NotificationService } from '../../services';

/** Profils disposant d'un écran messagerie (pour router les notifications MESSAGE). */
const MESSAGERIE_ROLES: Record<string, string> = {
  CHEF_COMMISSION: 'cc',
  VERIFICATEUR: 'verificateur',
  MEMBRE: 'membre',
  SECRETAIRE: 'secretaire',
};

/**
 * Centre de notifications commun à tous les profils : cloche + compteur de non-lues
 * et panneau listant « mes » notifications (scopées serveur via /mes). Au clic : marquage
 * lu + ouverture de l'élément (dossier → `voirDossier` émis, le LAYOUT rend la modale hors
 * topbar ; message → messagerie si le profil en dispose). Le backend reste l'autorité.
 */
@Component({
  selector: 'app-notification-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="notif">
      <button
        type="button"
        class="notif__bell"
        (click)="toggle()"
        (keydown.escape)="open.set(false)"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="count() > 0 ? 'Notifications, ' + count() + ' non lue(s)' : 'Notifications'"
      >
        <span aria-hidden="true">🔔</span>
        @if (count() > 0) { <span class="notif__badge" aria-hidden="true">{{ count() > 99 ? '99+' : count() }}</span> }
      </button>

      @if (open()) {
        <div class="notif__backdrop" aria-hidden="true" (click)="open.set(false)"></div>
        <div class="notif__panel" role="dialog" aria-label="Notifications" (keydown.escape)="open.set(false)">
          <div class="notif__head">
            <span class="notif__title">Notifications</span>
            <button type="button" class="cnm-btn cnm-btn--ghost cnm-btn--sm" (click)="toutLu()" [disabled]="!count()">
              Tout marquer lu
            </button>
          </div>
          <div class="notif__list">
            @if (loading()) {
              <p class="notif__info">Chargement…</p>
            } @else {
              @for (n of notifs(); track n.idNotification) {
                <button type="button" class="notif__item" [class.notif__item--unread]="!n.lu" (click)="ouvrir(n)">
                  <span class="notif__item-title">{{ n.titre || n.typeNotif }}</span>
                  @if (n.corps) { <span class="notif__item-corps">{{ n.corps }}</span> }
                  <span class="notif__item-date cnm-mono">{{ formatDate(n.dateEnvoi) }}</span>
                </button>
              } @empty {
                <p class="notif__info">Aucune notification.</p>
              }
            }
          </div>
          <!-- ⚠️ Spec notifications (2026-08-02) — accès à l'écran dédié depuis le panneau. -->
          <a class="notif__tout" routerLink="/notifications" (click)="open.set(false)">Voir toutes les notifications ›</a>
        </div>
      }
    </div>

  `,
  styles: `
    .notif { position: relative; display: inline-flex; }
    .notif__bell { position: relative; background: transparent; border: 0; cursor: pointer; font-size: 1.15rem; line-height: 1; padding: 4px; }
    .notif__badge { position: absolute; top: -2px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--cnm-danger-fg); color: #fff; font-size: 10px; font-weight: var(--cnm-fw-semibold); display: flex; align-items: center; justify-content: center; }
    .notif__backdrop { position: fixed; inset: 0; z-index: 1040; }
    .notif__panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1041; width: 22rem; max-width: 90vw; max-height: 70vh; overflow: auto; background: var(--cnm-surface); border: 1px solid var(--cnm-border); border-radius: var(--cnm-radius); box-shadow: var(--cnm-shadow); }
    .notif__head { display: flex; align-items: center; justify-content: space-between; gap: var(--cnm-space-2); padding: var(--cnm-space-3); border-bottom: 1px solid var(--cnm-border); }
    .notif__title { font-weight: var(--cnm-fw-semibold); color: var(--cnm-text); }
    .notif__list { display: flex; flex-direction: column; }
    .notif__info { color: var(--cnm-text-2); padding: var(--cnm-space-3); }
    .notif__item { display: flex; flex-direction: column; gap: 2px; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--cnm-border); padding: var(--cnm-space-3); cursor: pointer; }
    .notif__item:last-child { border-bottom: 0; }
    .notif__item:hover { background: var(--cnm-surface-2); }
    .notif__item--unread { background: var(--cnm-info-bg); box-shadow: inset 3px 0 0 var(--cnm-brand); }
    .notif__item-title { font-weight: var(--cnm-fw-medium); color: var(--cnm-text); font-size: var(--cnm-fs-sm); }
    .notif__item-corps { color: var(--cnm-text-2); font-size: var(--cnm-fs-xs); }
    .notif__item-date { color: var(--cnm-text-3); font-size: var(--cnm-fs-micro); }
    .notif__tout { display: block; text-align: center; padding: var(--cnm-space-3); border-top: 1px solid var(--cnm-border); font-weight: var(--cnm-fw-semibold); font-size: var(--cnm-fs-sm); color: var(--cnm-brand); text-decoration: none; }
    .notif__tout:hover { background: var(--cnm-surface-2); }
  `,
})
export class NotificationCenter {
  private readonly service = inject(NotificationService);
  private readonly dossierService = inject(DossierService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly store = inject(NotificationsStore);

  readonly open = signal(false);
  readonly notifs = signal<Notification[]>([]);
  /** ⚠️ Temps réel (2026-08-02) — compteur SERVEUR partagé (SSE + repli polling + synchro onglets). */
  readonly count = computed(() => this.store.count());
  readonly loading = signal(false);
  /**
   * Dossier à consulter, ÉMIS vers le layout : le modal doit être rendu HORS de la topbar — son
   * `position: fixed; z-index: 99` crée un contexte d'empilement qui passerait le modal SOUS la
   * sidebar (z-index 100) et le voile ne couvrirait pas tout l'écran.
   */
  readonly voirDossier = output<Dossier>();

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.charger();
    }
  }

  private charger(): void {
    this.loading.set(true);
    this.service.mes().subscribe({
      next: (rows) => {
        this.notifs.set([...rows].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ouvrir(n: Notification): void {
    if (!n.lu) {
      this.service.marquerLu(n.idNotification).subscribe({
        next: () => {
          this.notifs.update((l) => l.map((x) => (x.idNotification === n.idNotification ? { ...x, lu: true } : x)));
          this.store.actionLocale(); // décrément immédiat + synchro des autres onglets
        },
        error: () => {},
      });
    }
    // Écran d'ACTION de la notification (mapping partagé avec la page /notifications).
    const cible = routePourNotification(n, this.auth.role());
    if (cible) {
      if (cible.genre === 'route-type-dossier' && n.idDossier != null) {
        this.dossierService.getById(n.idDossier).subscribe({
          next: (d) =>
            void this.router.navigate(d.idTypeDossier ? cible.versCommands(d.idTypeDossier) : cible.repli),
          error: () => void this.router.navigate(cible.repli),
        });
      } else {
        void this.router.navigate(cible.genre === 'route' ? cible.commands : cible.repli);
      }
      this.open.set(false);
      return;
    }
    if (n.idDossier != null) {
      this.dossierService.getById(n.idDossier).subscribe({
        next: (d) => {
          this.voirDossier.emit(d); // le layout rend le modal (hors topbar)
          this.open.set(false);
        },
        error: () => {},
      });
    } else if (n.typeObjet === 'MESSAGE') {
      const base = MESSAGERIE_ROLES[this.auth.role() ?? ''];
      if (base) {
        void this.router.navigate([`/${base}/messagerie`]);
        this.open.set(false);
      }
    }
  }

  /** Horodatage lisible (ex. « 16/06/2026 09:15 ») ; repli sur la valeur brute. */
  formatDate(iso?: string): string {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  toutLu(): void {
    this.service.lireTout().subscribe({
      next: () => {
        this.notifs.update((l) => l.map((x) => ({ ...x, lu: true })));
        this.store.actionLocale(); // badge → 0 partout (recalcul serveur + synchro onglets)
      },
      error: () => {},
    });
  }
}
