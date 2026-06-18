import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { navFlat } from '../../core/navigation/navigation';

/**
 * Accueil après connexion, adapté au profil : rappelle l'identité courante et liste
 * les modules accessibles au rôle. Les tableaux de bord dédiés par profil le
 * remplaceront au fil des étapes 8 à 13.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // À l'ouverture de session : le Membre atterrit sur « Dossiers à examiner »,
    // le Secrétaire sur « Réceptions ».
    if (this.auth.role() === 'MEMBRE') {
      void this.router.navigateByUrl('/membre/examens', { replaceUrl: true });
    } else if (this.auth.role() === 'SECRETAIRE') {
      void this.router.navigateByUrl('/secretaire/receptions', { replaceUrl: true });
    }
  }

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  readonly typeActeur = this.auth.typeActeur;
  readonly perimetre = computed(() => this.auth.localite() ?? 'Toutes localités');
  readonly modules = computed(() => navFlat(this.auth.role()));
  /** Seul le Chargé de publication peut réellement accéder au portail (GET réservé). */
  readonly peutAccederPortail = computed(() => this.auth.role() === 'CHARGE_PUBLICATION');
}
