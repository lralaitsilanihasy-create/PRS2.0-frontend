import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Notification } from '../../models';
import { NotificationService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import type { CleEspaceExterne } from './espace-externe-layout';
import { routeNotificationExterne } from './notification-externe-route';

type Filtre = 'toutes' | 'non-lues';

/**
 * ⚠️ 29/10 (pilote : « faire en sorte qu'on peut consulter la liste de notifications ») — l'historique des notifications d'un
 * espace externe (CAO, dépositaire, candidat), routé en `/<espace>/notifications` avec `data.espace`. La cloche n'y montre plus que
 * les non lues ; ici, toutes, avec le marquage lu / non lu à l'unité. Le clic ouvre la procédure (`routeNotificationExterne`).
 */
@Component({
  selector: 'app-notifications-externes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <header class="page-header">
      <div class="page-subtitle">{{ sousTitre }}</div>
      <h1 class="page-title">Mes notifications</h1>
    </header>

    <div class="ne__barre">
      <div class="ne__filtres" role="group" aria-label="Filtrer les notifications">
        <button type="button" class="ne__filtre" [class.ne__filtre--actif]="filtre() === 'toutes'" [attr.aria-pressed]="filtre() === 'toutes'" (click)="filtre.set('toutes')">
          Toutes <span class="ne__nb">{{ notifs().length }}</span>
        </button>
        <button type="button" class="ne__filtre" [class.ne__filtre--actif]="filtre() === 'non-lues'" [attr.aria-pressed]="filtre() === 'non-lues'" (click)="filtre.set('non-lues')">
          Non lues <span class="ne__nb">{{ nonLues() }}</span>
        </button>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" (click)="toutLu()" [disabled]="!nonLues()">Tout marquer lu</button>
    </div>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement…</p>
    } @else if (erreur()) {
      <app-etat-erreur message="Vos notifications n'ont pas pu être chargées." (reessayer)="charger()" />
    } @else if (!lignes().length) {
      <div class="empty-state">
        <p class="empty-state-title">{{ filtre() === 'non-lues' ? 'Aucune notification non lue.' : 'Aucune notification pour l’instant.' }}</p>
      </div>
    } @else {
      <ul class="ne__liste" aria-label="Notifications">
        @for (l of lignes(); track l.n.idNotification) {
          <li class="ne__item" [class.ne__item--non-lu]="!l.n.lu">
            <div class="ne__texte">
              <span class="ne__titre">
                @if (!l.n.lu) { <span class="ne__point" aria-hidden="true"></span><span class="cnm-sr-only">Non lue : </span> }
                {{ l.n.titre || l.n.typeNotif }}
              </span>
              @if (l.n.corps) { <span class="ne__corps">{{ l.n.corps }}</span> }
              <span class="ne__date">{{ formatDate(l.n.dateEnvoi) }}</span>
            </div>
            <div class="ne__gestes">
              @if (l.cible; as c) {
                <button type="button" class="btn btn-primary btn-sm" (click)="ouvrir(l.n, c)">Ouvrir la procédure</button>
              }
              @if (l.n.lu) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="marquer(l.n, false)">Marquer non lue</button>
              } @else {
                <button type="button" class="btn btn-ghost btn-sm" (click)="marquer(l.n, true)">Marquer lue</button>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .ne__barre { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; }
    .ne__filtres { display: inline-flex; gap: 0.25rem; padding: 0.2rem; border-radius: 999px; background: var(--n-100); }
    .ne__filtre { display: inline-flex; align-items: center; gap: 0.4rem; border: 0; border-radius: 999px; padding: 0.4rem 0.9rem; background: transparent; color: var(--n-600); font: inherit; font-size: var(--text-sm); font-weight: 500; cursor: pointer; }
    .ne__filtre--actif { background: var(--carte-fond); color: var(--p-800); box-shadow: none; }
    .ne__nb { min-width: 1.4rem; padding: 0 0.35rem; border-radius: 999px; background: var(--n-200); color: var(--n-800); font-size: var(--text-xs); text-align: center; }
    .ne__filtre--actif .ne__nb { background: var(--p-100); }
    .ne__liste { list-style: none; margin: 0; padding: 0; background: var(--carte-fond); border: 1px solid var(--n-200); border-radius: 10px; overflow: hidden; }
    .ne__item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.6rem 1.25rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--n-200); }
    .ne__item:last-child { border-bottom: 0; }
    .ne__item--non-lu { background: var(--p-50); box-shadow: inset 3px 0 0 var(--p-600); }
    .ne__texte { display: flex; flex-direction: column; gap: 0.15rem; flex: 1 1 24rem; min-width: 0; }
    .ne__titre { display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 500; color: var(--n-600); }
    .ne__item--non-lu .ne__titre { font-weight: 500; color: var(--n-800); }
    .ne__point { width: 8px; height: 8px; border-radius: 50%; background: var(--bouton-principal); flex: none; }
    .ne__corps { color: var(--n-500); font-size: var(--text-sm); }
    .ne__date { color: var(--n-500); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
    .ne__gestes { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  `,
})
export class NotificationsExternes {
  private readonly service = inject(NotificationService);
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  private readonly espace: CleEspaceExterne = (inject(ActivatedRoute).snapshot.data['espace'] as CleEspaceExterne | undefined) ?? 'candidat';
  readonly sousTitre = { cao: "Commission d'appel d'offres", depositaire: 'Dépositaire de la part de secours', candidat: 'Espace candidat' }[this.espace];

  readonly filtre = signal<Filtre>('toutes');
  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly notifs = signal<Notification[]>([]);
  readonly nonLues = computed(() => this.notifs().filter((n) => !n.lu).length);
  readonly lignes = computed(() =>
    this.notifs()
      .filter((n) => this.filtre() === 'toutes' || !n.lu)
      .map((n) => ({ n, cible: routeNotificationExterne(n, this.espace) })),
  );

  constructor() {
    // Au chargement, puis à chaque notification reçue ou marquée ailleurs (flux SSE, cloche, autre onglet).
    effect(() => {
      this.store.revision();
      untracked(() => this.charger());
    });
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

  marquer(n: Notification, lu: boolean): void {
    (lu ? this.service.marquerLu(n.idNotification) : this.service.marquerNonLu(n.idNotification)).subscribe({
      next: () => {
        this.notifs.update((l) => l.map((x) => (x.idNotification === n.idNotification ? { ...x, lu } : x)));
        this.store.actionLocale();
      },
      error: () => {},
    });
  }

  ouvrir(n: Notification, cible: string[]): void {
    if (!n.lu) this.marquer(n, true);
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
