import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ESPACES_A_FAIRE } from '../../core/navigation/navigation';
import { routePourNotification } from '../../core/notifications/notification-route';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Dossier, Notification, Role } from '../../models';
import { DossierService, NotificationService } from '../../services';
import { DossierConsultation } from '../circuit/dossier-consultation';

/** Profils disposant d'un écran messagerie (routage des notifications MESSAGE). */
const MESSAGERIE_ROLES: Record<string, string> = {
  CHEF_COMMISSION: 'cc',
  VERIFICATEUR: 'verificateur',
  MEMBRE: 'membre',
  SECRETAIRE: 'secretaire',
};

/** Un groupe d'affichage : libellé de date (Aujourd'hui / Hier / date) + notifications du jour. */
interface GroupeJour {
  libelle: string;
  notifs: Notification[];
}

/**
 * ⚠️ Spec notifications (2026-08-02) — écran dédié « Notifications » (TOUS profils) : liste complète
 * scopée serveur (/mes), récentes en tête, regroupées par jour (Aujourd'hui / Hier / dates), marqueur
 * non-lu, filtres (toutes / non lues, par type d'événement), défilement progressif (« Charger plus »),
 * clic → marquage lu + ouverture de l'élément concerné, marquage manuel lu / non-lu unitaire,
 * « Tout marquer lu ». Le compteur de la cloche (NotificationsStore, serveur + SSE) est resynchronisé
 * à chaque action.
 *
 * ⚠️ Lot L4-F6 (2026-09-16) : le repli « consultation » d'un type non mappé mène à la PAGE du dossier
 * pour les huit profils du circuit. Les deux filtres vivent dans l'URL (`?lu=`, `?type=`) : ils
 * partent dans `returnUrl` et la liste se retrouve telle qu'on l'a quittée.
 *
 * ⚠️ Lot L5-F6 (2026-09-16) : l'Administrateur et le Chargé de publication, qui n'ont pas la page du
 * dossier en v1, ne gardent PLUS la modale de consultation — le serveur leur refusait le dossier et
 * le refus était avalé. Leur notification reste lisible, cesse d'être un bouton et le dit
 * (cf. `sansEcran`). La modale demeure pour un profil qui aurait un dossier consultable sans route
 * dédiée : aucun aujourd'hui.
 */
@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DossierConsultation],
  template: `
    <section class="np">
      <header class="page-header page-header--actions">
        <div>
          <div class="page-subtitle">Transverse</div>
          <h1 class="page-title">Notifications</h1>
        </div>
        <button type="button" class="btn btn-outline" (click)="toutLu()" [disabled]="!nbNonLues()">
          Tout marquer lu @if (nbNonLues()) { ({{ nbNonLues() }}) }
        </button>
      </header>
      <!-- Phrase de rôle (proposition 2026-09-22, lot B) : à quoi sert l'écran, pour qui. -->
      <p class="page-role">Tout ce que le circuit vous a signalé, par date ; une notification non lue reste en gras jusqu'à ce que vous l'ouvriez.</p>

      <div class="np__filtres">
        <div class="np__seg" role="tablist">
          <button type="button" class="np__seg-btn" [class.np__seg-btn--actif]="filtreLu() === 'toutes'" (click)="changerFiltreLu('toutes')">
            Toutes ({{ notifs().length }})
          </button>
          <button type="button" class="np__seg-btn" [class.np__seg-btn--actif]="filtreLu() === 'non-lues'" (click)="changerFiltreLu('non-lues')">
            Non lues ({{ nbNonLues() }})
          </button>
        </div>
        <label class="cnm-sr-only" for="np-type">Filtrer par type d'événement</label>
        <select id="np-type" class="form-control np__type" [value]="filtreType() ?? ''" (change)="changerFiltreType($any($event.target).value || null)">
          <option value="">Tous les types d'événements</option>
          @for (t of typesPresents(); track t) { <option [value]="t">{{ libelleType(t) }}</option> }
        </select>
      </div>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        @for (g of groupesAffiches(); track g.libelle) {
          <h2 class="np__jour">{{ g.libelle }}</h2>
          <ul class="np__liste">
            @for (n of g.notifs; track n.idNotification) {
              <li class="np__item" [class.np__item--nonlu]="!n.lu">
                @if (sansEcran(n)) {
                  <!-- ⚠️ Lot 5, F6 (2026-09-16) — aucune destination pour ce profil : ni bouton, ni
                       requête. Le clic partait chercher le dossier, le serveur refusait au Chargé de
                       publication et à l'Administrateur, la branche d'erreur était vide : il ne se
                       passait rien, sans un mot. La ligne le dit, et reste marquable lue à droite. -->
                  <div class="np__corps np__corps--inerte">
                    <span class="np__titre">
                      @if (!n.lu) { <span class="np__point" aria-hidden="true"></span> }
                      {{ n.titre || n.typeNotif }}
                    </span>
                    @if (n.corps) { <span class="np__texte">{{ n.corps }}</span> }
                    <span class="np__note">{{ mentionSansEcran(n) }}</span>
                    <span class="np__meta cnm-mono">{{ heure(n.dateEnvoi) }}</span>
                  </div>
                } @else {
                  <button type="button" class="np__corps" (click)="ouvrir(n)">
                    <span class="np__titre">
                      @if (!n.lu) { <span class="np__point" aria-hidden="true"></span> }
                      {{ n.titre || n.typeNotif }}
                    </span>
                    @if (n.corps) { <span class="np__texte">{{ n.corps }}</span> }
                    <span class="np__meta cnm-mono">{{ heure(n.dateEnvoi) }}</span>
                  </button>
                }
                <div class="np__actions">
                  @if (n.lu) {
                    <button type="button" class="btn btn-outline btn-sm" (click)="basculerLu(n, false)">Marquer non lue</button>
                  } @else {
                    <button type="button" class="btn btn-outline btn-sm" (click)="basculerLu(n, true)">Marquer lue</button>
                  }
                </div>
              </li>
            }
          </ul>
        } @empty {
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">🔔</span>
            <div class="empty-state-title">Aucune notification</div>
            <div class="empty-state-text">{{ filtreLu() === 'non-lues' ? 'Aucune notification non lue.' : 'Vous n\\'avez reçu aucune notification.' }}</div>
          </div>
        }

        @if (resteACharger() > 0) {
          <div class="np__plus">
            <button type="button" class="btn btn-secondary" (click)="chargerPlus()">
              Charger plus ({{ resteACharger() }} restante(s))
            </button>
          </div>
        }
      }
    </section>

    @if (dossierConsulte(); as d) {
      <app-dossier-consultation [dossier]="d" (closed)="dossierConsulte.set(null)" />
    }
  `,
  styles: `
    .np { display: flex; flex-direction: column; gap: 0.5rem; }
    .np__filtres { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .np__seg { display: inline-flex; background: var(--n-100); border-radius: 999px; padding: 3px; }
    .np__seg-btn { border: 0; background: transparent; padding: 0.35rem 1rem; border-radius: 999px; font-weight: 600; color: var(--n-500); cursor: pointer; transition: var(--transition); }
    .np__seg-btn--actif { background: #fff; color: var(--p-600); box-shadow: var(--shadow-sm); }
    .np__type { width: auto; min-width: 16rem; }
    .np__jour { margin: 0.75rem 0 0.25rem; font-size: var(--text-sm); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--n-400); }
    .np__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .np__item { display: flex; align-items: center; gap: 0.75rem; background: #fff; border: 1px solid var(--n-200); border-radius: var(--radius-lg); padding: 0.15rem 0.75rem 0.15rem 0; transition: var(--transition); }
    .np__item:hover { border-color: var(--p-200); box-shadow: var(--shadow-sm); }
    .np__item--nonlu { background: var(--p-50, #eff6ff); border-left: 4px solid var(--p-500, #3b82f6); }
    .np__corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-align: left; background: transparent; border: 0; cursor: pointer; padding: 0.6rem 0 0.6rem 0.9rem; font: inherit; color: inherit; }
    /* Ligne sans destination : même gabarit, mais rien n'y invite au clic (lot L5-F6). */
    .np__corps--inerte { cursor: default; }
    .np__note { color: var(--n-500); font-size: var(--text-sm); font-style: italic; }
    .np__titre { font-weight: 700; color: var(--n-800); display: inline-flex; align-items: center; gap: 0.45rem; }
    .np__point { width: 0.55rem; height: 0.55rem; border-radius: 999px; background: var(--p-500, #3b82f6); flex: none; }
    .np__texte { color: var(--n-600); font-size: var(--text-sm); }
    .np__meta { color: var(--n-400); font-size: var(--text-xs); }
    .np__actions { flex: none; }
    .np__plus { display: flex; justify-content: center; margin-top: 0.75rem; }
  `,
})
export class NotificationsPage {
  private readonly service = inject(NotificationService);
  private readonly dossierService = inject(DossierService);
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly notifs = signal<Notification[]>([]);
  readonly filtreLu = signal<'toutes' | 'non-lues'>('toutes');
  readonly filtreType = signal<string | null>(null);
  /** Fenêtre d'affichage (défilement progressif — « Charger plus » par pas de 20). */
  readonly fenetre = signal(20);
  readonly dossierConsulte = signal<Dossier | null>(null);

  readonly nbNonLues = computed(() => this.notifs().filter((n) => !n.lu).length);
  readonly typesPresents = computed(() =>
    [...new Set(this.notifs().map((n) => n.typeNotif).filter((t): t is string => !!t))].sort(),
  );
  /** Notifications filtrées (récentes en tête). */
  private readonly filtrees = computed(() => {
    const type = this.filtreType();
    return this.notifs()
      .filter((n) => (this.filtreLu() === 'non-lues' ? !n.lu : true))
      .filter((n) => (type ? n.typeNotif === type : true));
  });
  readonly resteACharger = computed(() => Math.max(0, this.filtrees().length - this.fenetre()));
  /** Groupes par jour (Aujourd'hui / Hier / date), sur la fenêtre affichée. */
  readonly groupesAffiches = computed<GroupeJour[]>(() => {
    const groupes: GroupeJour[] = [];
    for (const n of this.filtrees().slice(0, this.fenetre())) {
      const libelle = this.libelleJour(n.dateEnvoi);
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.libelle === libelle) {
        dernier.notifs.push(n);
      } else {
        groupes.push({ libelle, notifs: [n] });
      }
    }
    return groupes;
  });

  constructor() {
    // Filtres repris de l'URL (lot L4-F6) : c'est eux que `returnUrl` ramène au retour de la page.
    const q = this.route.snapshot.queryParamMap;
    if (q.get('lu') === 'non-lues') this.filtreLu.set('non-lues');
    this.filtreType.set(q.get('type'));

    this.charger();
    // Temps réel : toute révision du store (SSE / autre onglet / action locale) recharge la liste.
    // skip(1) : le chargement initial est déjà déclenché ci-dessus — un effect s'exécutant aussi au
    // premier cycle, chaque montage lançait `GET /notifications/mes` deux fois (motif dossiers-liste).
    toObservable(this.store.revision)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.charger(false));
  }

  private charger(avecSpinner = true): void {
    if (avecSpinner) this.loading.set(true);
    this.service.mes().subscribe({
      next: (rows) => {
        this.notifs.set([...rows].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  chargerPlus(): void {
    this.fenetre.update((f) => f + 20);
  }

  changerFiltreLu(v: 'toutes' | 'non-lues'): void {
    this.filtreLu.set(v);
    this.ecrireFiltres();
  }

  changerFiltreType(t: string | null): void {
    this.filtreType.set(t);
    this.ecrireFiltres();
  }

  /** Les filtres dans l'URL, sans nouvelle entrée d'historique : filtrer n'est pas naviguer. */
  private ecrireFiltres(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { lu: this.filtreLu() === 'non-lues' ? 'non-lues' : null, type: this.filtreType() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** URL de la liste, filtres compris : `returnUrl` du lien vers la page d'un dossier. */
  private retour(): string {
    const parametres = [this.filtreLu() === 'non-lues' ? 'lu=non-lues' : '', this.filtreType() ? `type=${encodeURIComponent(this.filtreType() as string)}` : ''].filter(Boolean);
    return `/notifications${parametres.length ? `?${parametres.join('&')}` : ''}`;
  }

  /**
   * Notification SANS écran d'action pour le profil connecté (lot L5-F6, 2026-09-16) : aucune route
   * dédiée, et aucune page du dossier où se replier. C'est le cas du Chargé de publication et de
   * l'Administrateur — absents d'`ESPACES_A_FAIRE`, ils n'ont pas la page en v1 — et celui d'une
   * notification sans objet, pour n'importe quel profil.
   *
   * Jusqu'ici la ligne était un bouton : le clic lançait `GET /api/dossiers/{id}`, le serveur
   * refusait, `error: () => {}` avalait le refus. Rien ne s'ouvrait et rien ne le disait — le
   * « 403 silencieux » du §6b du plan. Désormais la ligne n'est plus un bouton et n'appelle rien ;
   * elle porte la mention. Pour les huit profils du circuit, rien ne change : le repli du lot L4-F6
   * (la page du dossier) répond toujours, donc `routePourNotification` rend une cible.
   */
  sansEcran(n: Notification): boolean {
    const sansPageDossier = !ESPACES_A_FAIRE[(this.auth.role() ?? '') as Role];
    return (
      routePourNotification(n, this.auth.role()) === null && (n.idDossier == null || sansPageDossier)
    );
  }

  /** Mention affichée à la place de l'action ; elle nomme le dossier quand il y en a un. */
  mentionSansEcran(n: Notification): string {
    return n.idDossier != null
      ? 'Aucun écran dédié à votre profil pour ce dossier.'
      : 'Aucun écran dédié à votre profil.';
  }

  /**
   * Clic sur la notification : marquage lu automatique + navigation vers l'ÉCRAN D'ACTION correspondant
   * (mapping partagé `routePourNotification`, demande user 2026-08-11). Type non mappé → repli : la
   * PAGE du dossier (lot L4-F6), sa modale pour qui n'a pas la page, ou la messagerie.
   */
  ouvrir(n: Notification): void {
    if (!n.lu) {
      this.basculerLu(n, true);
    }
    const cible = routePourNotification(n, this.auth.role());
    if (cible) {
      if (cible.genre === 'route-type-dossier' && n.idDossier != null) {
        // Le drill-down « Mes dossiers » exige le type du dossier — résolu à la volée, repli sur le hub.
        this.dossierService.getById(n.idDossier).subscribe({
          next: (d) =>
            void this.router.navigate(d.idTypeDossier ? cible.versCommands(d.idTypeDossier) : cible.repli),
          error: () => void this.router.navigate(cible.repli),
        });
      } else if (cible.genre === 'page-dossier') {
        void this.router.navigate(cible.commands, { queryParams: { returnUrl: this.retour() } });
      } else {
        void this.router.navigate(cible.genre === 'route' ? cible.commands : cible.repli);
      }
      return;
    }
    if (n.idDossier != null) {
      this.dossierService.getById(n.idDossier).subscribe({
        next: (d) => this.dossierConsulte.set(d),
        error: () => {},
      });
    } else if (n.typeObjet === 'MESSAGE') {
      const base = MESSAGERIE_ROLES[this.auth.role() ?? ''];
      if (base) {
        void this.router.navigate([`/${base}/messagerie`]);
      }
    }
  }

  /** Marquage manuel unitaire lu / non-lu (le badge de la cloche suit via le store). */
  basculerLu(n: Notification, lu: boolean): void {
    const call = lu ? this.service.marquerLu(n.idNotification) : this.service.marquerNonLu(n.idNotification);
    call.subscribe({
      next: (maj) => {
        this.notifs.update((l) => l.map((x) => (x.idNotification === maj.idNotification ? maj : x)));
        this.store.actionLocale();
      },
      error: () => {},
    });
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

  /** Libellé du groupe : Aujourd'hui / Hier / « lundi 3 août 2026 ». */
  private libelleJour(iso?: string): string {
    if (!iso) return 'Sans date';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Sans date';
    const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const auj = new Date();
    const aujJour = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate());
    const diff = Math.round((aujJour.getTime() - jour.getTime()) / 86_400_000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(d);
  }

  heure(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  /** Libellé lisible d'un type d'événement (code brut humanisé). */
  libelleType(t: string): string {
    return t.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }
}
