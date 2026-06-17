import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { NavItem, navFor } from '../../core/navigation/navigation';
import { ControleurService, PrmpService } from '../../services';
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

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  readonly localite = this.auth.localite;
  readonly navItems = computed(() => navFor(this.auth.role()));
  /** Nom de l'utilisateur courant (résolu depuis sa fiche PRMP / contrôleur). */
  readonly displayName = signal('');

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
