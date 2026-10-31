import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Notification } from '../../models';
import { NotificationService } from '../../services';
import { Icone } from '../../shared/ui/icone';
import type { CleEspaceExterne } from './espace-externe-layout';
import { routeNotificationExterne } from './notification-externe-route';

/**
 * ⚠️ 29/10 (pilote : « le compte des membres de la CAO doit avoir des notifications… pour toute information sur la procédure »,
 * PRS20 51351b2) — la cloche des espaces externes. Mêmes routes « à soi » que les internes (`/mes`, compteur, lu, tout lu, flux
 * SSE par le `NotificationsStore` partagé) ; le clic marque lu et ouvre la procédure dans l'espace (`routeNotificationExterne`).
 * ⚠️ 29/10 (pilote, 2e temps) — comme le panneau interne, la cloche ne montre plus que les NON LUES : une notification lue en
 * disparaît. L'historique complet est sur l'écran « Notifications » de l'espace (`notifications-externes.ts`).
 */
@Component({
  selector: 'app-cloche-externe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, RouterLink],
  template: `
    <div class="ce" [class.ce--sombre]="sombre()">
      <button
        type="button"
        class="ce__cloche"
        (click)="basculer()"
        (keydown.escape)="ouvert.set(false)"
        [attr.aria-expanded]="ouvert()"
        [attr.aria-label]="count() > 0 ? 'Notifications, ' + count() + ' non lue(s)' : 'Notifications'"
      >
        <app-icone nom="bell" [taille]="18" />
        @if (count() > 0) { <span class="ce__badge" aria-hidden="true">{{ count() > 99 ? '99+' : count() }}</span> }
      </button>

      @if (ouvert()) {
        <div class="ce__voile" aria-hidden="true" (click)="ouvert.set(false)"></div>
        <div class="ce__panneau" role="dialog" aria-label="Notifications" (keydown.escape)="ouvert.set(false)">
          <div class="ce__tete">
            <span class="ce__titre">Notifications</span>
            <button type="button" class="ce__tout-lu" (click)="toutLu()" [disabled]="!count()">Tout marquer lu</button>
          </div>
          <div class="ce__liste">
            @if (chargement()) {
              <p class="ce__info" role="status">Chargement…</p>
            } @else if (erreur()) {
              <p class="ce__info">Les notifications n'ont pas pu être chargées. <button type="button" class="ce__lien" (click)="charger()">Réessayer</button></p>
            } @else {
              @for (l of lignes(); track l.n.idNotification) {
                @if (l.cible) {
                  <button type="button" class="ce__item" [class.ce__item--non-lu]="!l.n.lu" (click)="ouvrir(l.n, l.cible)">
                    <span class="ce__item-titre">{{ l.n.titre || l.n.typeNotif }}</span>
                    @if (l.n.corps) { <span class="ce__item-corps">{{ l.n.corps }}</span> }
                    <span class="ce__item-date">{{ formatDate(l.n.dateEnvoi) }}</span>
                  </button>
                } @else {
                  <div class="ce__item ce__item--inerte" [class.ce__item--non-lu]="!l.n.lu">
                    <span class="ce__item-titre">{{ l.n.titre || l.n.typeNotif }}</span>
                    @if (l.n.corps) { <span class="ce__item-corps">{{ l.n.corps }}</span> }
                    <span class="ce__item-date">{{ formatDate(l.n.dateEnvoi) }}</span>
                  </div>
                }
              } @empty {
                <p class="ce__info">Aucune notification non lue.</p>
              }
            }
          </div>
          <a class="ce__tout" [routerLink]="['/' + espace(), 'notifications']" (click)="ouvert.set(false)">
            Voir toutes les notifications<app-icone nom="chev" [taille]="12" />
          </a>
        </div>
      }
    </div>
  `,
  styles: `
    .ce { position: relative; display: inline-flex; }
    .ce__cloche { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--n-300); border-radius: var(--radius-md); background: var(--carte-fond); color: var(--n-800); cursor: pointer; }
    .ce__cloche:hover { background: var(--n-100); }
    .ce__cloche:focus-visible { outline: 3px solid var(--p-700); outline-offset: 2px; }
    .ce--sombre .ce__cloche { background: var(--carte-fond); border-color: var(--bordure); color: var(--texte-menu); }
    .ce--sombre .ce__cloche:hover { background: var(--carte-fond); }
    .ce--sombre .ce__cloche:focus-visible { outline-color: var(--bordure); }
    .ce__badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: var(--cnm-danger-fg); color: var(--texte-menu); font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
    .ce__voile { position: fixed; inset: 0; z-index: 1040; }
    .ce__panneau { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1041; width: 24rem; max-width: calc(100vw - 32px); max-height: 70vh; overflow: auto; background: var(--carte-fond); color: var(--n-800); border: 1px solid var(--n-200); border-radius: var(--radius-md); box-shadow: none; text-align: left; }
    .ce__tete { position: sticky; top: 0; z-index: 1; background: var(--carte-fond); display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; border-bottom: 1px solid var(--n-200); }
    .ce__titre { font-weight: 500; }
    .ce__tout-lu, .ce__lien { background: transparent; border: 0; padding: 0.25rem 0.4rem; color: var(--p-700); font: inherit; font-size: var(--text-sm); font-weight: 500; cursor: pointer; }
    .ce__tout-lu:disabled { color: var(--n-400); cursor: default; }
    .ce__liste { display: flex; flex-direction: column; }
    .ce__info { margin: 0; padding: 0.75rem; color: var(--n-500); font-size: var(--text-sm); }
    .ce__item { display: flex; flex-direction: column; gap: 2px; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--n-200); padding: 0.7rem 0.75rem; font: inherit; color: inherit; cursor: pointer; }
    .ce__item:last-child { border-bottom: 0; }
    .ce__item:hover { background: var(--n-50); }
    .ce__item--inerte { cursor: default; }
    .ce__item--inerte:hover { background: inherit; }
    .ce__item--non-lu { background: var(--p-50); box-shadow: inset 3px 0 0 var(--p-600); }
    .ce__item-titre { font-weight: 500; font-size: var(--text-sm); }
    .ce__item-corps { color: var(--n-500); font-size: var(--text-xs); }
    .ce__tout { position: sticky; bottom: 0; background: var(--carte-fond); display: flex; align-items: center; justify-content: center; gap: 2px; padding: 0.7rem; border-top: 1px solid var(--n-200); font-weight: 500; font-size: var(--text-sm); color: var(--p-700); text-decoration: none; }
    .ce__tout:hover { background: var(--n-50); }
    .ce__item-date { color: var(--n-500); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
  `,
})
export class ClocheExterne {
  private readonly service = inject(NotificationService);
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  readonly espace = input.required<CleEspaceExterne>();
  /** La barre du haut en bleu profond (espaces de la CAO et du dépositaire). */
  readonly sombre = input(false);

  readonly ouvert = signal(false);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  private readonly notifs = signal<Notification[]>([]);
  /** Compteur SERVEUR partagé (flux SSE, repli par sondage). */
  readonly count = computed(() => this.store.count());
  readonly lignes = computed(() =>
    this.notifs()
      .filter((n) => !n.lu)
      .map((n) => ({ n, cible: routeNotificationExterne(n, this.espace()) })),
  );

  constructor() {
    // Une notification arrive panneau ouvert (flux SSE) : la liste se recharge.
    effect(() => {
      this.store.revision();
      if (this.ouvert()) untracked(() => this.charger());
    });
  }

  basculer(): void {
    this.ouvert.update((v) => !v);
  }

  charger(): void {
    this.chargement.set(!this.notifs().length);
    this.erreur.set(false);
    this.service.mes().subscribe({
      next: (rows) => {
        this.notifs.set([...rows].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')));
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  ouvrir(n: Notification, cible: string[]): void {
    if (!n.lu) {
      this.service.marquerLu(n.idNotification).subscribe({
        next: () => {
          this.notifs.update((l) => l.map((x) => (x.idNotification === n.idNotification ? { ...x, lu: true } : x)));
          this.store.actionLocale();
        },
        error: () => {},
      });
    }
    this.ouvert.set(false);
    void this.router.navigate(cible);
  }

  toutLu(): void {
    this.service.lireTout().subscribe({
      next: () => {
        this.notifs.update((l) => l.map((x) => ({ ...x, lu: true })));
        this.store.actionLocale();
      },
      error: () => {},
    });
  }

  /** Horodatage lisible (« 29/10/2026 09:15 ») ; repli sur la valeur brute. */
  formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }
}
