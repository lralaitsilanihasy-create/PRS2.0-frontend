import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { libelleRole } from '../../core/auth/libelles-profils';
import { Role } from '../../models';
import { Icone } from '../../shared/ui/icone';
import { ChangerMotDePasseModal } from '../auth/mon-compte/changer-mot-de-passe-modal';
import { ClocheExterne } from './cloche-externe';

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
      // ⚠️ Lot MS-2 (16/10) — les marchés subséquents des contrats-cadres dont le candidat est titulaire.
      { label: 'Remises en concurrence', path: '/candidat/remises' },
      // ⚠️ Lot MS-3 (16/10) — les bons de commande des contrats-cadres et marchés à commandes.
      { label: 'Bons de commande', path: '/candidat/bons-commande' },
      { label: 'Mon entreprise', path: '/candidat/entreprise' },
      { label: 'Notifications', path: '/candidat/notifications' },
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
    // ⚠️ Lot MS-2 (16/10) — les remises en concurrence des contrats-cadres, évaluées en collège restreint.
    // ⚠️ Lot MS-4 (16/10) — les réceptions des commandes (commission de réception, comptes du même espace).
    navConnecte: [
      { label: 'Mes procédures', path: '/cao/mes-procedures' },
      { label: 'Remises en concurrence', path: '/cao/remises' },
      { label: 'Réceptions', path: '/cao/receptions' },
      { label: 'Notifications', path: '/cao/notifications' },
    ],
    entree: { label: 'Activer mon compte', path: '/cao/activation' },
    piedLien: null,
    apresDeconnexion: '/login',
  },
  depositaire: {
    role: 'DEPOSITAIRE',
    racine: '/depositaire',
    titre: 'Espace du dépositaire',
    navPublique: [],
    navConnecte: [
      { label: 'Mes procédures', path: '/depositaire/mes-procedures' },
      { label: 'Notifications', path: '/depositaire/notifications' },
    ],
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone, ChangerMotDePasseModal, ClocheExterne],
  // ⚠️ 30/10/2026 (design institutionnel, pilote) — même coquille que l'application : bandeau tricolore, en-tête blanc au logo du
  // Ministère, barre de menu foncée (onglet actif clair), pied foncé. La barre « bleu profond » des espaces des commissions (19/10)
  // est remplacée : tous les espaces ont désormais la même barre de menu.
  template: `
    <a class="cnm-sr-only cl-evitement" href="#cl-contenu">Aller au contenu</a>
    <div class="bandeau-tricolore" aria-hidden="true"><span></span><span></span><span></span></div>
    <header class="cl-top">
      <div class="cl-top__in">
        <a class="cl-marque" [routerLink]="config.racine" [attr.aria-label]="config.titre + ' — accueil'">
          <img class="cl-marque__logo" src="mef-logo.png" alt="" width="42" height="42" />
          <span class="cl-marque__texte">
            <span class="cl-marque__s">Commission nationale des marchés</span>
            <span class="cl-marque__t">PRS 2.0 · {{ config.titre }}</span>
          </span>
        </a>
        <div class="cl-top__actions">
          @if (connecte()) {
            <span class="cl-user">
              <span class="cl-user__nom">{{ nom() }}</span>
              <span class="cl-user__role">{{ roleLibelle() }}</span>
            </span>
            <!-- ⚠️ 29/10 (pilote, PRS20 51351b2) — la cloche : le membre, le dépositaire et le candidat lisent leurs notifications. -->
            <app-cloche-externe [espace]="cle" />
            <button type="button" class="cl-btn" title="Changer mon mot de passe" (click)="motDePasseOuvert.set(true)">
              <app-icone nom="key" [taille]="15" /><span class="cl-btn__txt">Mot de passe</span>
            </button>
            <button type="button" class="cl-btn" title="Se déconnecter" (click)="deconnecter()">
              <app-icone nom="exit" [taille]="15" /><span class="cl-btn__txt">Se déconnecter</span>
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
    <!-- ⚠️ 18/10 (pilote) — les entrées en barre pleine largeur, sous la marque. Sur téléphone, la barre défile dans sa bande. -->
    @if (entrees().length) {
      <div class="cl-onglets">
        <nav class="cl-nav" [attr.aria-label]="config.titre">
          @for (l of entrees(); track l.path) {
            <a [routerLink]="l.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ l.label }}</a>
          }
        </nav>
      </div>
    }

    <main id="cl-contenu" class="cl-main"><router-outlet /></main>

    <footer class="cl-pied">
      <div class="cl-pied__in">
        <span>Commission nationale des marchés · Ministère de l'Économie et des Finances · PRS 2.0</span>
        @if (config.piedLien; as p) { <a [routerLink]="p.path">{{ p.label }}</a> }
      </div>
    </footer>

    @if (motDePasseOuvert()) {
      <app-changer-mot-de-passe-modal (ferme)="motDePasseOuvert.set(false)" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; background: var(--page-fond); color: var(--texte); }
    .cl-evitement:focus { position: fixed; inset: auto auto 1rem 1rem; width: auto; height: auto; clip: auto; padding: 0.5rem 0.9rem; background: var(--bouton-principal); color: var(--texte-menu); border-radius: 6px; z-index: 10; }
    /* ⚠️ 31/10 (pilote, Espace de travail, lot 6) — même en-tête que la coquille : bleu nuit profond, compact, fondu avec la barre. */
    .cl-top { background: var(--section-fond); color: var(--texte-menu); }
    .cl-top__in, .cl-main, .cl-pied__in { width: 100%; max-width: 1200px; margin: 0 auto; padding-left: 18px; padding-right: 18px; box-sizing: border-box; }
    .cl-top__in { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; padding-top: 6px; padding-bottom: 6px; }
    .cl-marque { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--texte-menu); }
    .cl-marque:focus-visible { outline: 2px solid var(--or); outline-offset: 2px; }
    .cl-marque__logo { width: 30px; height: 30px; object-fit: contain; flex-shrink: 0; }
    .cl-marque__texte { display: flex; flex-direction: column; line-height: 1.2; }
    .cl-marque__s { font-size: 10.5px; color: var(--texte-menu-secondaire); }
    .cl-marque__t { font-family: var(--police-marque); font-size: 15px; font-weight: 500; color: var(--texte-menu); }
    .cl-onglets { background: var(--menu-fond); }
    .cl-nav { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 12px; box-sizing: border-box; display: flex; align-items: flex-end; gap: 2px; overflow-x: auto; scrollbar-width: thin; }
    .cl-nav a { flex: none; white-space: nowrap; margin-top: 4px; padding: 7px 12px; border-radius: 4px 4px 0 0; color: var(--texte-menu); text-decoration: none; font-size: 13px; transition: background 0.15s ease; }
    .cl-nav a:hover:not(.active) { background: var(--menu-survol); }
    .cl-nav a.active { background: var(--onglet-actif-fond); color: var(--texte); font-weight: 500; }
    .cl-nav a:focus-visible { outline: 2px solid var(--or); outline-offset: -2px; }
    .cl-top__actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; font-size: 12px; color: var(--texte-secondaire); }
    .cl-user { display: flex; flex-direction: column; line-height: 1.2; margin-right: 0.25rem; text-align: right; }
    .cl-user__nom { color: var(--texte-menu); }
    .cl-user__role { font-size: 11px; color: var(--texte-menu-secondaire); }
    .cl-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 4px 10px; border: 1px solid var(--texte-menu-secondaire); border-radius: 4px; background: transparent; color: var(--texte-menu); font: inherit; font-size: 12px; text-decoration: none; cursor: pointer; }
    .cl-btn:hover { background: var(--menu-survol); }
    .cl-btn:focus-visible { outline: 2px solid var(--or); outline-offset: 1px; }
    .cl-btn--primaire { background: var(--bouton-principal); border-color: var(--bouton-principal); color: var(--texte-menu); }
    .cl-btn--primaire:hover { background: var(--bouton-principal); filter: brightness(0.92); }
    .cl-main { flex: 1; padding-top: 14px; padding-bottom: 24px; }
    .cl-pied { background: var(--menu-fond); }
    .cl-pied__in { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 8px; padding-bottom: 8px; font-size: 11px; color: var(--texte-menu); }
    .cl-pied a { color: var(--or); }
    @media (max-width: 720px) {
      .cl-top__actions { margin-left: 0; width: 100%; justify-content: flex-start; }
      .cl-user { text-align: left; margin-right: auto; }
    }
    /* Sur téléphone, les deux boutons du compte se réduisent à leur icône ; le texte reste le nom accessible (masqué à l'écran seul). */
    @media (max-width: 480px) {
      .cl-top__actions { flex-wrap: nowrap; }
      .cl-btn__txt { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .cl-btn { padding: 7px 10px; }
    }
  `,
})
export class EspaceExterneLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** L'espace, lu sur la route racine (`data.espace`) ; à défaut le candidat, l'espace historique. */
  readonly cle: CleEspaceExterne = (inject(ActivatedRoute).snapshot.data['espace'] as CleEspaceExterne | undefined) ?? 'candidat';
  readonly config: ConfigEspace = ESPACES[this.cle];

  /** Connecté EN TANT QUE profil de cet espace : un autre profil est renvoyé ailleurs par `espaceExterneGuard`, il n'arrive pas ici. */
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === this.config.role);
  readonly nom = computed(() => this.auth.nomAffichage() || this.auth.login() || '');
  readonly roleLibelle = computed(() => libelleRole(this.auth.role()));
  readonly motDePasseOuvert = signal(false);
  /** Les entrées de la barre d'onglets : les publiques, puis celles du compte connecté. */
  readonly entrees = computed(() => [...this.config.navPublique, ...(this.connecte() ? this.config.navConnecte : [])]);

  deconnecter(): void {
    this.auth.logout();
    void this.router.navigateByUrl(this.config.apresDeconnexion);
  }
}
