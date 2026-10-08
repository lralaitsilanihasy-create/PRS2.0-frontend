import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { libelleRole } from '../../core/auth/libelles-profils';
import { Role } from '../../models';
import { Icone } from '../../shared/ui/icone';
import { ChangerMotDePasseModal } from '../auth/mon-compte/changer-mot-de-passe-modal';

/** Les espaces externes ; la route racine dit lequel par `data.espace`. ⚠️ V71 : le dépositaire de la part de secours. */
export type CleEspaceExterne = 'candidat' | 'cao' | 'depositaire';

interface Lien {
  label: string;
  path: string;
}

interface ConfigEspace {
  role: Role;
  racine: string;
  titre: string;
  /** Liens offerts à tout visiteur. */
  navPublique: Lien[];
  /** Liens offerts au seul profil connecté. */
  navConnecte: Lien[];
  /** Le geste d'entrée hors session : s'inscrire (candidat), activer son compte (membre de CAO). */
  entree: Lien | null;
  piedLien: Lien | null;
  /** Où mène la déconnexion : les procédures publiques pour le candidat ; la connexion pour le membre de CAO, dont rien n'est public. */
  apresDeconnexion: string;
}

const ESPACES: Readonly<Record<CleEspaceExterne, ConfigEspace>> = {
  candidat: {
    role: 'CANDIDAT',
    racine: '/candidat',
    titre: 'Espace candidat',
    navPublique: [{ label: 'Procédures ouvertes', path: '/candidat/procedures' }],
    navConnecte: [
      { label: 'Mes offres', path: '/candidat/offres' },
      { label: 'Mes invitations', path: '/candidat/invitations' },
      { label: 'Mon entreprise', path: '/candidat/entreprise' },
    ],
    entree: { label: 'Créer un compte', path: '/candidat/inscription' },
    piedLien: { label: "À propos de l'espace candidat", path: '/accueil/candidat' },
    apresDeconnexion: '/candidat/procedures',
  },
  cao: {
    role: 'MEMBRE_CAO',
    racine: '/cao',
    titre: "Espace commission d'appel d'offres",
    navPublique: [],
    navConnecte: [{ label: 'Mes procédures', path: '/cao/mes-procedures' }],
    entree: { label: 'Activer mon compte', path: '/cao/activation' },
    piedLien: null,
    apresDeconnexion: '/login',
  },
  depositaire: {
    role: 'DEPOSITAIRE',
    racine: '/depositaire',
    titre: 'Espace du dépositaire',
    navPublique: [],
    navConnecte: [{ label: 'Mes procédures', path: '/depositaire/mes-procedures' }],
    entree: { label: 'Activer mon compte', path: '/depositaire/activation' },
    piedLien: null,
    apresDeconnexion: '/login',
  },
};

/**
 * Coquille des ESPACES EXTERNES (soumission en ligne, lots 1 et 2a) : le candidat (`/candidat`) et le membre de la
 * commission d'appel d'offres (`/cao`). Volontairement distincte de `MainLayout`, qui charge au démarrage les
 * notifications, les actualités, les intérims, la vacance du poste… autant d'appels que le serveur refuse à ces profils
 * (403 sur toute route interne), et autant de dialogues d'erreur à l'ouverture. Ici : une barre du haut (marque, liens,
 * compte), le contenu, un pied. Hors session, la barre offre la connexion et le geste d'entrée de l'espace.
 */
@Component({
  selector: 'app-espace-externe-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone, ChangerMotDePasseModal],
  template: `
    <a class="cnm-sr-only cl-evitement" href="#cl-contenu">Aller au contenu</a>
    <header class="cl-top">
      <div class="cl-top__in">
        <a class="cl-marque" [routerLink]="config.racine" [attr.aria-label]="config.titre + ' — accueil'">
          <span class="cl-marque__mef" aria-hidden="true">MEF</span>
          <span class="cl-marque__texte">
            <span class="cl-marque__t">PRS 2.0 · {{ config.titre }}</span>
            <span class="cl-marque__s">Commission nationale des marchés</span>
          </span>
        </a>
        <nav class="cl-nav" [attr.aria-label]="config.titre">
          @for (l of config.navPublique; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ l.label }}</a>
          }
          @if (connecte()) {
            @for (l of config.navConnecte; track l.path) {
              <a [routerLink]="l.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ l.label }}</a>
            }
          }
        </nav>
        <div class="cl-top__actions">
          @if (connecte()) {
            <span class="cl-user">
              <span class="cl-user__nom">{{ nom() }}</span>
              <span class="cl-user__role">{{ roleLibelle() }}</span>
            </span>
            <button type="button" class="cl-btn" (click)="motDePasseOuvert.set(true)">
              <app-icone nom="key" [taille]="15" />Mot de passe
            </button>
            <button type="button" class="cl-btn" (click)="deconnecter()">
              <app-icone nom="exit" [taille]="15" />Se déconnecter
            </button>
          } @else {
            @if (config.entree; as e) { <a class="cl-btn" [routerLink]="e.path">{{ e.label }}</a> }
            <a class="cl-btn cl-btn--primaire" routerLink="/login" [queryParams]="{ returnUrl: config.racine }">
              <app-icone nom="key" [taille]="15" />Se connecter
            </a>
          }
        </div>
      </div>
    </header>

    <main id="cl-contenu" class="cl-main"><router-outlet /></main>

    <footer class="cl-pied">
      <div class="cl-pied__in">
        <span>Ministère de l'Économie et des Finances — Commission nationale des marchés</span>
        @if (config.piedLien; as p) { <a [routerLink]="p.path">{{ p.label }}</a> }
      </div>
    </footer>

    @if (motDePasseOuvert()) {
      <app-changer-mot-de-passe-modal (ferme)="motDePasseOuvert.set(false)" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--n-50); color: var(--n-800); }
    .cl-evitement:focus { position: fixed; inset: auto auto 1rem 1rem; width: auto; height: auto; clip: auto; padding: 0.5rem 0.9rem; background: #fff; color: var(--p-800); border-radius: var(--radius-md); z-index: 10; }
    .cl-top { background: #fff; border-bottom: 1px solid var(--n-200); }
    .cl-top__in, .cl-main, .cl-pied__in { width: 100%; max-width: 1200px; margin: 0 auto; padding-left: 16px; padding-right: 16px; box-sizing: border-box; }
    .cl-top__in { min-height: 60px; display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; padding-top: 6px; padding-bottom: 6px; }
    .cl-marque { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--n-800); }
    .cl-marque__mef { width: 36px; height: 36px; border-radius: 50%; background: var(--sidebar-bg); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 0.72rem; letter-spacing: 0.04em; }
    .cl-marque__texte { display: flex; flex-direction: column; line-height: 1.15; }
    .cl-marque__t { font-weight: 800; }
    .cl-marque__s { font-size: var(--text-xs); color: var(--n-500); }
    .cl-nav { display: flex; gap: 0.25rem; margin-left: auto; }
    .cl-nav a { padding: 0.45rem 0.8rem; border-radius: var(--radius-md); color: var(--n-700); text-decoration: none; font-weight: 600; font-size: var(--text-sm); }
    .cl-nav a.active { background: var(--p-50); color: var(--p-800); }
    .cl-nav a:hover { background: var(--n-100); }
    .cl-top__actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .cl-user { display: flex; flex-direction: column; line-height: 1.15; margin-right: 0.25rem; text-align: right; }
    .cl-user__nom { font-weight: 700; font-size: var(--text-sm); }
    .cl-user__role { font-size: var(--text-xs); color: var(--n-500); }
    .cl-btn { display: inline-flex; align-items: center; gap: 0.35rem; height: 34px; padding: 0 0.8rem; border: 1px solid var(--n-300); border-radius: var(--radius-md); background: #fff; color: var(--n-800); font: inherit; font-size: var(--text-sm); font-weight: 600; text-decoration: none; cursor: pointer; }
    .cl-btn:hover { background: var(--n-100); }
    .cl-btn--primaire { background: var(--p-700); border-color: var(--p-700); color: #fff; }
    .cl-btn--primaire:hover { background: var(--p-800); }
    .cl-main { flex: 1; padding-top: 24px; padding-bottom: 32px; }
    .cl-pied { border-top: 1px solid var(--n-200); background: #fff; }
    .cl-pied__in { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 12px; padding-bottom: 12px; font-size: var(--text-xs); color: var(--n-500); }
    .cl-pied a { color: var(--p-700); font-weight: 600; }
    @media (max-width: 720px) { .cl-nav { margin-left: 0; width: 100%; order: 3; } }
  `,
})
export class EspaceExterneLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** L'espace, lu sur la route racine (`data.espace`) ; à défaut le candidat, l'espace historique. */
  readonly config: ConfigEspace = ESPACES[(inject(ActivatedRoute).snapshot.data['espace'] as CleEspaceExterne | undefined) ?? 'candidat'];

  /** Connecté EN TANT QUE profil de cet espace : un autre profil est renvoyé ailleurs par `espaceExterneGuard`, il n'arrive pas ici. */
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === this.config.role);
  readonly nom = computed(() => this.auth.nomAffichage() || this.auth.login() || '');
  readonly roleLibelle = computed(() => libelleRole(this.auth.role()));
  readonly motDePasseOuvert = signal(false);

  deconnecter(): void {
    this.auth.logout();
    void this.router.navigateByUrl(this.config.apresDeconnexion);
  }
}
