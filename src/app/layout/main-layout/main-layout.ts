import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, forkJoin, skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { NavItem, navFor } from '../../core/navigation/navigation';
import { DossiersRefreshStore } from '../../features/prmp/dossiers-refresh.store';
import {
  ControleurService,
  DemandeRetraitService,
  DispatchService,
  DossierService,
  LettreRenvoiService,
  PpmService,
  PrmpService,
  PvExamenService,
  ReceptionService,
} from '../../services';
import { NotificationCenter } from '../notification-center/notification-center';

/**
 * Coquille applicative pour les utilisateurs connectés : en-tête (identité + déconnexion),
 * barre latérale dont les entrées sont filtrées selon le profil, et zone de contenu routée.
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationCenter],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  host: { '[attr.data-role]': 'role()' },
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prmpService = inject(PrmpService);
  private readonly controleurService = inject(ControleurService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);
  private readonly ppmService = inject(PpmService);
  private readonly dispatchService = inject(DispatchService);
  private readonly pvExamenService = inject(PvExamenService);
  private readonly lettreRenvoiService = inject(LettreRenvoiService);
  private readonly demandeRetraitService = inject(DemandeRetraitService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  readonly localite = this.auth.localite;
  readonly navItems = computed(() => navFor(this.auth.role()));
  /** Nom de l'utilisateur courant (résolu depuis sa fiche PRMP / contrôleur). */
  readonly displayName = signal('');
  /** Initiales (1 à 2 lettres) pour l'avatar du bloc profil de la sidebar. */
  readonly initials = computed(() => {
    const source = (this.displayName() || this.login() || '').trim();
    if (!source) return '?';
    const mots = source.split(/\s+/);
    const lettres = mots.length > 1 ? mots[0][0] + mots[1][0] : source.slice(0, 2);
    return lettres.toUpperCase();
  });
  /** Compteurs affichés en badge à côté de certaines entrées de menu (clé = chemin). */
  readonly counts = signal<Record<string, number>>({});
  /** Compteurs d'alerte (badge rouge) à côté de certaines entrées (clé = chemin). */
  readonly alerts = signal<Record<string, number>>({});
  /** Sidebar ouverte en mode drawer (tablette / mobile). Sans effet sur desktop. */
  readonly sidebarOpen = signal(false);

  /** Couleur du badge de compteur par item (i=info, w=warning, s=success, d=danger). */
  private readonly badgeSeverites: Record<string, string> = {
    '/prmp/mes-brouillons': 'i',
    '/prmp/ppm-marches': 'i',
    '/prmp/dossiers-verifies': 's',
    '/prmp/lettre-renvois': 'd',
  };
  badgeSeverity(path: string): string {
    return this.badgeSeverites[path] ?? '';
  }

  countFor(path: string): number | undefined {
    return this.counts()[path];
  }
  alertFor(path: string): number | undefined {
    return this.alerts()[path];
  }

  /** Chemins des en-têtes de sous-menu actuellement dépliés. */
  private readonly openGroups = signal<Set<string>>(this.initialOpenGroups());

  constructor() {
    // Ferme le drawer mobile à chaque navigation (clic sur un lien de menu).
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sidebarOpen.set(false));

    const ref = this.auth.ref();
    if (!ref) {
      return;
    }
    if (this.auth.typeActeur() === 'PRMP') {
      this.prmpService.getById(ref).subscribe({
        next: (p) => this.displayName.set(`${p.nomPrmp ?? ''} ${p.prenomsPrmp ?? ''}`.trim()),
        error: () => {},
      });
    } else {
      this.controleurService.getById(ref).subscribe({
        next: (c) => this.displayName.set(`${c.nomCont ?? ''} ${c.prenomsCont ?? ''}`.trim()),
        error: () => {},
      });
    }

    // Secrétaire : badges « nombre de dossiers » sur Réceptions et Enregistrement,
    // rafraîchis à l'ouverture puis à chaque navigation (ex. après une réception enregistrée).
    if (this.auth.role() === 'SECRETAIRE') {
      this.rafraichirCompteursSecretaire();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirCompteursSecretaire());
    }

    // PRMP : alerte « à rectifier » + compteurs de contenu du menu.
    if (this.auth.role() === 'PRMP') {
      this.rafraichirAlertesPrmp();
      this.rafraichirCompteursPrmp();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => {
          this.rafraichirAlertesPrmp();
          this.rafraichirCompteursPrmp();
        });
      // Mise à jour immédiate des compteurs après une mutation signalée
      // (ex. lecture d'une lettre de renvoi → décrément du compteur).
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirCompteursPrmp());
    }

    // Président : compteurs de contenu par item de menu (dérivés des endpoints de liste).
    if (this.auth.role() === 'PRESIDENT') {
      this.rafraichirCompteursPresident();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirCompteursPresident());
    }
  }

  /**
   * Compteurs de contenu du menu Président : un appel de liste documenté par item
   * (n'affiche que les valeurs > 0). Aucun endpoint de compteurs agrégé n'existe côté API.
   */
  private rafraichirCompteursPresident(): void {
    forkJoin({
      preDispatch: this.dossierService.list('PRET_DISPATCH'),
      dispatchs: this.dispatchService.list(),
      projetsPv: this.pvExamenService.list(),
      pvDefinitifs: this.pvExamenService.definitifs(),
      lettres: this.lettreRenvoiService.getAll(),
      retraits: this.demandeRetraitService.aValider(),
    }).subscribe({
      next: ({ preDispatch, dispatchs, projetsPv, pvDefinitifs, lettres, retraits }) => {
        const c: Record<string, number> = {
          '/president/pre-dispatch': preDispatch.length,
          '/president/circuit/dispatch': dispatchs.length,
          '/president/circuit/pv': projetsPv.length,
          '/president/circuit/pv-definitifs': pvDefinitifs.length,
          '/president/lettre-renvois': lettres.length,
          '/president/retraits': retraits.length,
        };
        // N'expose que les compteurs > 0 (pas de badge « 0 »).
        const visibles = Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0));
        this.counts.set(visibles);
      },
      error: () => {},
    });
  }

  /**
   * Compteurs de contenu du menu PRMP (un appel de liste documenté par item ; valeurs > 0 seulement).
   * « Dossiers à rectifier » garde son badge d'alerte rouge (rafraichirAlertesPrmp), non dupliqué ici.
   */
  private rafraichirCompteursPrmp(): void {
    forkJoin({
      brouillons: this.dossierService.list('BROUILLON'),
      ppms: this.ppmService.list(),
      verifies: this.dossierService.list('CLOTURE'),
      lettres: this.lettreRenvoiService.getMesLettres(),
    }).subscribe({
      next: ({ brouillons, ppms, verifies, lettres }) => {
        const c: Record<string, number> = {
          '/prmp/mes-brouillons': brouillons.length,
          '/prmp/ppm-marches': ppms.length,
          '/prmp/dossiers-verifies': verifies.length,
          // Lettres SIGNE non encore lues (le compteur décroît à la lecture).
          '/prmp/lettre-renvois': lettres.filter((l) => !l.lue).length,
        };
        this.counts.set(Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)));
      },
      error: () => {},
    });
  }

  /** Recharge le compteur d'alerte PRMP (dossiers EN_ATTENTE_DECISION_PRMP → à rectifier). */
  private rafraichirAlertesPrmp(): void {
    this.dossierService.list('EN_ATTENTE_DECISION_PRMP').subscribe({
      next: (rows) => this.alerts.update((a) => ({ ...a, '/prmp/a-rectifier': rows.length })),
      error: () => {},
    });
  }

  /** Recharge les compteurs du Secrétaire (à réceptionner / réceptionnés), scopés serveur. */
  private rafraichirCompteursSecretaire(): void {
    this.dossierService.aReceptionner().subscribe({
      next: (rows) => this.counts.update((c) => ({ ...c, '/secretaire/receptions': rows.length })),
      error: () => {},
    });
    this.receptionService.list().subscribe({
      next: (rows) => this.counts.update((c) => ({ ...c, '/secretaire/enregistrement': rows.length })),
      error: () => {},
    });
  }

  isOpen(item: NavItem): boolean {
    return this.openGroups().has(item.path);
  }

  toggle(item: NavItem): void {
    const next = new Set(this.openGroups());
    if (next.has(item.path)) next.delete(item.path);
    else next.add(item.path);
    this.openGroups.set(next);
  }

  /** Au chargement, ouvre le sous-menu contenant la page active. */
  private initialOpenGroups(): Set<string> {
    const url = this.router.url;
    const open = new Set<string>();
    for (const item of navFor(this.auth.role())) {
      if (item.children?.some((c) => url.startsWith(c.path))) open.add(item.path);
    }
    return open;
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
