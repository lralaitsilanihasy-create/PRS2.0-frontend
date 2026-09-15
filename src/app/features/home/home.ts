import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { isApiError } from '../../core/errors/api-error';
import { cheminAFaire, navFlat } from '../../core/navigation/navigation';
import { Role } from '../../models';
import { DossierService } from '../../services';
import { Icone } from '../../shared/ui/icone';
import { estAFaireIndisponible } from './a-faire/a-faire-modele';

/** Atterrissage d'avant l'accueil « À faire » (repli) ; un profil absent reste sur cette page. */
const ATTERRISSAGE_HISTORIQUE: Readonly<Partial<Record<Role, string>>> = {
  // ⚠️ 2026-09-12/13 : « Mes dossiers » retiré des espaces P/CC, Secrétaire, PRMP puis Membre — chaque
  // profil atterrissait sur « Tous les dossiers » (le tableau de bord porte toute action par dossier).
  MEMBRE: '/membre/tableau-de-bord',
  SECRETAIRE: '/secretaire/tableau-de-bord',
  PRMP: '/prmp/tableau-de-bord',
  PRESIDENT: '/president/tableau-de-bord',
  CHEF_COMMISSION: '/cc/tableau-de-bord',
};

/**
 * Accueil après connexion.
 *
 * ⚠️ Refonte ergonomique (2026-09-15) — les huit profils du circuit atterrissent sur « À faire »
 * (`/<espace>/a-faire`). L'accueil SONDE d'abord `GET /api/dossiers/a-faire` : servi, il y conduit en
 * transmettant la réponse (pas de second appel) ; pas encore servi (404, 501, route inconnue du
 * backend…), il retombe sur l'atterrissage d'avant. Une panne passagère conduit quand même à « À faire »,
 * qui l'affiche avec « Réessayer ». Les autres profils, et les repliés sans atterrissage dédié
 * (Vérificateur, Assistant, UGPM), gardent cette page : identité et modules du rôle.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dossierService = inject(DossierService);

  /** Sonde en cours : la page n'affiche qu'un indicateur, le temps de choisir l'atterrissage. */
  readonly redirection = signal(false);

  constructor() {
    const role = this.auth.role();
    const aFaire = cheminAFaire(role);
    if (!aFaire) return;
    this.redirection.set(true);
    this.dossierService.aFaire(false).subscribe({
      next: (reponse) => void this.router.navigateByUrl(aFaire, { replaceUrl: true, state: { aFaire: reponse } }),
      error: (e: unknown) => {
        if (isApiError(e) && e.status === 401) return; // session expirée : l'intercepteur mène au login
        if (!estAFaireIndisponible(e)) {
          void this.router.navigateByUrl(aFaire, { replaceUrl: true });
          return;
        }
        const historique = role ? ATTERRISSAGE_HISTORIQUE[role] : undefined;
        if (historique) void this.router.navigateByUrl(historique, { replaceUrl: true });
        else this.redirection.set(false);
      },
    });
  }

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  /** « Nom Prénoms » résolu au login (serveur) — repli sur le login pour une session antérieure. */
  readonly nomAffiche = computed(() => this.auth.nomAffichage() || this.auth.login() || '');
  readonly typeActeur = this.auth.typeActeur;
  readonly perimetre = computed(() => this.auth.localite() ?? 'Toutes localités');
  readonly modules = computed(() => navFlat(this.auth.role()));
  /** Seul le Chargé de publication peut réellement accéder au portail (GET réservé). */
  readonly peutAccederPortail = computed(() => this.auth.role() === 'CHARGE_PUBLICATION');
}
