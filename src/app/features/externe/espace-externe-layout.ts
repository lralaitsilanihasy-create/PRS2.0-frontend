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
  /** ⚠️ 19/10 (pilote) — la barre du haut en bleu profond : les espaces des commissions et du dépositaire, pas celui du candidat. */
  sombre: boolean;
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
    sombre: false,
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
    sombre: true,
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
    sombre: true,
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
  template: `
    <a class="cnm-sr-only cl-evitement" href="#cl-contenu">Aller au contenu</a>
    <header class="cl-top" [class.cl-top--sombre]="config.sombre">
      <div class="cl-top__in">
        <a class="cl-marque" [routerLink]="config.racine" [attr.aria-label]="config.titre + ' — accueil'">
          <span class="cl-marque__mef" aria-hidden="true">MEF</span>
          <span class="cl-marque__texte">
            <span class="cl-marque__t">PRS 2.0 · {{ config.titre }}</span>
            <span class="cl-marque__s">Commission nationale des marchés</span>
          </span>
        </a>
        <div class="cl-top__actions">
          @if (connecte()) {
            <span class="cl-user">
              <span class="cl-user__nom">{{ nom() }}</span>
              <span class="cl-user__role">{{ roleLibelle() }}</span>
            </span>
            <!-- ⚠️ 29/10 (pilote, PRS20 51351b2) — la cloche : le membre, le dépositaire et le candidat lisent leurs notifications. -->
            <app-cloche-externe [espace]="cle" [sombre]="config.sombre" />
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
      <!-- ⚠️ 18/10 (pilote) — les entrées en barre d'onglets pleine largeur, sous la marque : l'en-tête tenait sur deux lignes bancales
           (menu en haut à droite, compte en dessous à gauche). Sur téléphone, la barre défile dans sa bande, la page ne déborde plus. -->
      @if (entrees().length) {
        <div class="cl-onglets">
          <nav class="cl-nav" [attr.aria-label]="config.titre">
            @for (l of entrees(); track l.path) {
              <a [routerLink]="l.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ l.label }}</a>
            }
          </nav>
        </div>
      }
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
    .cl-top__in { min-height: 60px; display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; padding-top: 8px; padding-bottom: 8px; }
    .cl-marque { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--n-800); }
    .cl-marque__mef { width: 36px; height: 36px; border-radius: 50%; background: var(--sidebar-bg); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 0.72rem; letter-spacing: 0.04em; }
    .cl-marque__texte { display: flex; flex-direction: column; line-height: 1.15; }
    .cl-marque__t { font-weight: 800; }
    .cl-marque__s { font-size: var(--text-xs); color: var(--n-500); }
    .cl-onglets { border-top: 1px solid var(--n-200); }
    .cl-nav { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px; box-sizing: border-box; display: flex; gap: 0.15rem; overflow-x: auto; scrollbar-width: thin; }
    .cl-nav a { flex: none; white-space: nowrap; padding: 0.7rem 0.85rem 0.6rem; border-bottom: 3px solid transparent; color: var(--n-600); text-decoration: none; font-weight: 600; font-size: var(--text-sm); }
    .cl-nav a:hover { color: var(--p-800); background: var(--n-100); }
    .cl-nav a.active { color: var(--p-800); border-bottom-color: var(--p-600); }
    .cl-top__actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; }
    .cl-user { display: flex; flex-direction: column; line-height: 1.15; margin-right: 0.25rem; text-align: right; }
    .cl-user__nom { font-weight: 700; font-size: var(--text-sm); }
    .cl-user__role { font-size: var(--text-xs); color: var(--n-500); }
    .cl-btn { display: inline-flex; align-items: center; gap: 0.35rem; height: 34px; padding: 0 0.8rem; border: 1px solid var(--n-300); border-radius: var(--radius-md); background: #fff; color: var(--n-800); font: inherit; font-size: var(--text-sm); font-weight: 600; text-decoration: none; cursor: pointer; }
    .cl-btn:hover { background: var(--n-100); }
    .cl-btn--primaire { background: var(--p-700); border-color: var(--p-700); color: #fff; }
    .cl-btn--primaire:hover { background: var(--p-800); }
    .cl-main { flex: 1; padding-top: 24px; padding-bottom: 32px; }
    .cl-top--sombre { background: var(--sidebar-bg); border-bottom: 0; }
    .cl-top--sombre .cl-marque, .cl-top--sombre .cl-user__nom { color: #fff; }
    .cl-top--sombre .cl-marque__mef { background: #fff; color: var(--p-800); }
    .cl-top--sombre .cl-marque__s, .cl-top--sombre .cl-user__role { color: rgba(255, 255, 255, 0.78); }
    .cl-top--sombre .cl-btn { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.35); color: #fff; }
    .cl-top--sombre .cl-btn:hover { background: rgba(255, 255, 255, 0.2); }
    .cl-top--sombre .cl-onglets { background: #fff; border-top: 0; border-bottom: 1px solid var(--n-200); }
    .cl-pied { border-top: 1px solid var(--n-200); background: #fff; }
    .cl-pied__in { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 12px; padding-bottom: 12px; font-size: var(--text-xs); color: var(--n-500); }
    .cl-pied a { color: var(--p-700); font-weight: 600; }
    @media (max-width: 720px) {
      .cl-top__actions { margin-left: 0; width: 100%; justify-content: flex-start; }
      .cl-user { text-align: left; margin-right: auto; }
    }
    /* Sur téléphone, les deux boutons du compte se réduisent à leur icône ; le texte reste le nom accessible (masqué à l'écran seul). */
    @media (max-width: 480px) {
      .cl-top__actions { flex-wrap: nowrap; }
      .cl-btn__txt { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .cl-btn { padding: 0 0.6rem; }
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
