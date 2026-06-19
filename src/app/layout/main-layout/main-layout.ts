import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { NavItem, navFor } from '../../core/navigation/navigation';
import { ControleurService, DossierService, PrmpService, ReceptionService } from '../../services';
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
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prmpService = inject(PrmpService);
  private readonly controleurService = inject(ControleurService);
  private readonly dossierService = inject(DossierService);
  private readonly receptionService = inject(ReceptionService);

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  readonly localite = this.auth.localite;
  readonly navItems = computed(() => navFor(this.auth.role()));
  /** Nom de l'utilisateur courant (résolu depuis sa fiche PRMP / contrôleur). */
  readonly displayName = signal('');
  /** Compteurs affichés en badge à côté de certaines entrées de menu (clé = chemin). */
  readonly counts = signal<Record<string, number>>({});
  /** Compteurs d'alerte (badge rouge) à côté de certaines entrées (clé = chemin). */
  readonly alerts = signal<Record<string, number>>({});

  countFor(path: string): number | undefined {
    return this.counts()[path];
  }
  alertFor(path: string): number | undefined {
    return this.alerts()[path];
  }

  /** Chemins des en-têtes de sous-menu actuellement dépliés. */
  private readonly openGroups = signal<Set<string>>(this.initialOpenGroups());

  constructor() {
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

    // PRMP : badge rouge « dossiers en attente de décision » sur le tableau de bord.
    if (this.auth.role() === 'PRMP') {
      this.rafraichirAlertesPrmp();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirAlertesPrmp());
    }
  }

  /** Recharge le compteur d'alerte PRMP (dossiers EN_ATTENTE_DECISION_PRMP). */
  private rafraichirAlertesPrmp(): void {
    this.dossierService.list('EN_ATTENTE_DECISION_PRMP').subscribe({
      next: (rows) => this.alerts.update((a) => ({ ...a, '/prmp/tableau-de-bord': rows.length })),
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

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
