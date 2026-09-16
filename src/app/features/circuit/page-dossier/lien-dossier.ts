import { Injectable, inject } from '@angular/core';
import { Params, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ESPACES_A_FAIRE } from '../../../core/navigation/navigation';

/**
 * Lien d'une LISTE vers la page d'un dossier (refonte ergonomique, lot L4-F6, décision 5) :
 * `/<espace>/dossier/:idDossier`, avec `returnUrl` vers l'écran courant.
 *
 * Deux règles tiennent tout le lot :
 * - **l'espace vient du RÔLE** (`ESPACES_A_FAIRE`), pas de l'URL : un écran du circuit est monté dans
 *   plusieurs espaces, et la route canonique de la page vit dans celui du connecté. `disponible()` est
 *   faux pour l'Administrateur et le Chargé de publication, qui n'ont pas la page en v1 — leur écran
 *   garde alors l'ouverture qu'il avait ;
 * - **le retour, c'est l'URL courante entière** (`Router.url`), paramètres de requête compris : la
 *   liste se retrouve à la page, au filtre et au tri où on l'a quittée — à condition qu'ils vivent
 *   dans l'URL. C'est pourquoi F6 y porte d'abord l'état des écrans qui l'avaient gardé en mémoire.
 */
@Injectable({ providedIn: 'root' })
export class LienDossier {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Espace du connecté, `null` s'il n'a pas la page (Administrateur, Chargé de publication). */
  espace(): string | null {
    const role = this.auth.role();
    return (role ? ESPACES_A_FAIRE[role] : undefined) ?? null;
  }

  disponible(): boolean {
    return this.espace() !== null;
  }

  /** Commandes de `[routerLink]` ; tableau vide sans espace (le lien n'est alors pas rendu). */
  commandes(idDossier: number): (string | number)[] {
    const espace = this.espace();
    return espace ? ['/', espace, 'dossier', idDossier] : [];
  }

  /**
   * `{ returnUrl }` vers l'écran courant. `retour` permet de forcer une autre origine quand l'écran
   * sait mieux que `Router.url` où il faut revenir (état encore absent de l'URL, écran encastré).
   */
  params(retour?: string): Params {
    return { returnUrl: retour ?? this.router.url };
  }
}
