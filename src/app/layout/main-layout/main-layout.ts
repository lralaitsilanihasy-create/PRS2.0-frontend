import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { libelleRole } from '../../core/auth/libelles-profils';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { DelegationsAffichageStore } from '../../core/preferences/delegations-affichage.store';
import { MenuCompactStore } from '../../core/preferences/menu-compact.store';
import { ToastService } from '../../core/notifications/toast.service';
import { NavItem, cheminAFaire, navFor } from '../../core/navigation/navigation';
import { libelleCourt, nomAccessibleRail, piedMenu, sectionsMenu } from '../../core/navigation/groupes-menu';
import { PermissionsService } from '../../core/auth/permissions.service';
import { DossiersRefreshStore } from '../../features/prmp/dossiers-refresh.store';
import {
  ControleurService,
  DossierService,
  KpiService,
  PrmpService,
} from '../../services';
import { NotificationCenter } from '../notification-center/notification-center';
import { DossierConsultation } from '../../features/circuit/dossier-consultation';
import { LienDossier } from '../../features/circuit/page-dossier/lien-dossier';
import { ChangerMotDePasseModal } from '../../features/auth/mon-compte/changer-mot-de-passe-modal';
import { ActualitesModal } from '../../shared/actualites/actualites-modal';
import { Icone } from '../../shared/ui/icone';
import { Actualite } from '../../models/actualite.model';
import { ActualiteService } from '../../services/actualite.services';
import { Dossier, estLocaliteCentrale, Role } from '../../models';

/** Entrée de menu du Vérificateur portant le badge du nombre de dossiers restant à traiter. */
const CHEMIN_A_VERIFIER = '/verificateur/a-verifier';

/**
 * ⚠️ Refonte ergonomique, lot 2 (2026-09-14) — MODE « CONCENTRATION » : une route qui déclare
 * `data: { concentration: true }` (l'examen d'un dossier) replie la barre latérale, pour rendre au
 * document et à la grille de contrôle la largeur d'un portable 15 pouces (1366 px). Le menu reste à
 * un clic : il s'ouvre en tiroir par le bouton de l'en-tête, comme sur tablette. La donnée est
 * cherchée sur toute la branche activée (une route enfant peut la porter).
 */
export function routeEnConcentration(racine: ActivatedRouteSnapshot | null): boolean {
  for (let r = racine; r; r = r.firstChild) {
    if (r.data?.['concentration'] === true) return true;
  }
  return false;
}

/**
 * Coquille applicative pour les utilisateurs connectés : en-tête (identité + déconnexion),
 * barre latérale dont les entrées sont filtrées selon le profil, et zone de contenu routée.
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NotificationCenter,
    DossierConsultation,
    ActualitesModal,
    ChangerMotDePasseModal,
    Icone,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  host: {
    '[attr.data-role]': 'role()',
    '[class.layout--concentration]': 'concentration()',
    '[class.layout--rail]': 'railActif()',
  },
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prmpService = inject(PrmpService);
  private readonly controleurService = inject(ControleurService);
  private readonly dossierService = inject(DossierService);
  /** Lot L4-F6 : la recherche de la topbar mène à la page du dossier, dans l'espace du connecté. */
  private readonly lienDossier = inject(LienDossier);
  private readonly kpiService = inject(KpiService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly vacanceStore = inject(VacanceStore);
  private readonly actualiteService = inject(ActualiteService);
  /** Vacance du poste PRMP (spec « Mandats PRMP ») — bannière + standby des actions de traitement. */
  readonly vacance = this.vacanceStore.vacance;
  private readonly toast = inject(ToastService);

  readonly role = this.auth.role;
  readonly login = this.auth.login;
  readonly localite = this.auth.localite;
  private readonly permissions = inject(PermissionsService);
  /**
   * Libellé français du profil connecté (pastille de l'en-tête, carte profil de la barre latérale) —
   * plus jamais le code brut (« CHEF_COMMISSION »), recette du 2026-09-15. Fichier unique :
   * core/auth/libelles-profils.ts.
   */
  readonly roleLibelle = computed(() => libelleRole(this.role()));
  /** Libellé humain d'un profil délégué (infobulle du marqueur de délégation du menu). */
  delegationLabel(role: Role): string {
    return libelleRole(role);
  }
  /**
   * Menu du profil, filtré par la DÉLÉGATION ASCENDANTE (spec 2026-08-14) : une entrée portant
   * `delegation` n'apparaît que si le profil courant peut exécuter les tâches de ce profil (paire
   * active de t_delegation_profil) — le menu suit la base, zéro code.
   */
  private readonly navItems = computed(() =>
    navFor(this.auth.role())
      .filter((item) => !item.delegation || this.permissions.peutExecuter(item.delegation))
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter((c) => !c.delegation || this.permissions.peutExecuter(c.delegation)) }
          : item,
      ),
  );

  /**
   * ⚠️ Demande user (2026-08-28) — le menu est scindé en SECTIONS : d'abord les entrées du profil
   * connecté, puis, sous un intitulé propre, celles exercées par délégation ascendante.
   * Auparavant les deux étaient intercalées (« Vérifications » et « Archivage des PV » tombaient
   * entre « Examen de dossiers » et « Rapports ») : rien ne disait au Président ce qui relevait de
   * sa fonction et ce qu'il exerçait à la place d'un subordonné. Le badge ⤴ le signalait entrée par
   * entrée, pas d'un coup d'œil.
   *
   * ⚠️ Refonte ergonomique, lot 5 F2 (2026-09-16) — les entrées propres se rangent à leur tour en
   * RUBRIQUES (Mon travail, Décisions, Pilotage…) : `sectionsMenu` remplace `separerParDelegation`,
   * qu'il appelle toujours pour la dernière section. Le classement est DÉRIVÉ dans
   * `core/navigation/groupes-menu.ts` — `NAV_BY_ROLE` n'est pas touché, et une entrée que le pilote
   * y ajoute reste affichée (première rubrique) en faisant rougir `groupes-menu.spec.ts`.
   *
   * On enveloppe la liste plutôt que de dupliquer le rendu : le gabarit garde UNE seule boucle
   * d'affichage d'entrée, et une entrée déléguée qui gagnerait des sous-entrées continuerait de
   * s'afficher correctement.
   *
   * Une section vide n'est pas rendue, et un menu qui ne produit qu'une rubrique n'affiche AUCUN
   * intitulé : le Secrétaire, le Vérificateur, l'UGPM et le Chargé de publication retrouvent
   * exactement leur menu d'avant.
   */
  readonly navSections = computed(() => sectionsMenu(this.navItems()));

  /**
   * Entrées du PIED de la barre : « Notifications », répétée à l'identique dans les dix menus. Elle
   * n'est la rubrique de personne — c'est l'entrée transverse. Elle quitte donc les rubriques pour
   * le bas du menu, juste au-dessus de la carte de profil (`sectionsMenu` l'en a déjà retirée).
   */
  readonly navPied = computed(() => piedMenu(this.navItems()));

  /**
   * Repli des rubriques déléguées (demande user 2026-08-28), partagé avec les cartes de
   * « Mes dossiers » : un seul geste range les tâches déléguées partout. Repli d'AFFICHAGE — aucun
   * droit n'est retiré, contrairement aux interrupteurs du 15/08 (cf. `DelegationsAffichageStore`).
   */
  private readonly delegationsAffichage = inject(DelegationsAffichageStore);
  readonly delegationsAffichees = this.delegationsAffichage.affichees;
  basculerDelegations(): void {
    this.delegationsAffichage.basculer();
  }

  /**
   * ⚠️ RAIL COMPACT (refonte ergonomique, lot 5 F4 — décision de Mathieu du 2026-09-16). La barre
   * se réduit à 76 px d'icônes légendées : +139 px rendus au contenu sur les trois écrans visés.
   * C'est une BASCULE de l'utilisateur, mémorisée (`MenuCompactStore`) — rien ne se replie tout seul
   * selon la largeur de l'écran : personne ne doit perdre son menu sans l'avoir demandé.
   */
  private readonly menuCompact = inject(MenuCompactStore);
  /** Préférence brute : l'utilisateur a-t-il demandé le rail ? (état du bouton de bascule) */
  readonly menuReduit = this.menuCompact.reduit;
  /**
   * Rail réellement appliqué. Le rail NE SE SUBSTITUE PAS au mode concentration : sur l'examen, la
   * vérification et la page dossier, la barre reste un TIROIR à 0 px (décision 4 du plan L4), qui
   * rend toute la largeur au document. Un rail de 76 px y serait une régression de 76 px. La
   * préférence n'est pas effacée pour autant : elle reprend à la sortie de ces écrans.
   */
  readonly railActif = computed(() => this.menuReduit() && !this.concentration());

  /** Réduit le menu au rail d'icônes, ou le redéploie (bouton du pied de la barre). */
  basculerMenuCompact(): void {
    this.menuCompact.basculer();
  }

  /**
   * Légende d'une entrée sous son icône, en rail (`groupes-menu.ts`). Purement VISUELLE : elle est
   * `aria-hidden`, le nom accessible de l'entrée est porté par `nomAccessible()` (rendu hors écran)
   * suivi de sa pastille.
   */
  legende(item: NavItem): string {
    return libelleCourt(item, this.role());
  }

  /**
   * Nom accessible d'une entrée de menu — le texte de `.nav-label`, visible en menu large et rangé
   * hors écran en rail.
   *
   * ⚠️ WCAG 2.5.3 « Label in Name » (2026-09-16). En rail, le seul texte VISIBLE d'une entrée est sa
   * légende ; le critère exige qu'il soit contenu dans le nom accessible. Cinq légendes sur trente
   * sont des synonymes et non des fragments : pour celles-là, et pour elles seules, le nom devient
   * « Alertes — Notifications » (cf. `nomAccessibleRail`). En menu large le texte visible EST le
   * libellé complet : le nom accessible n'y bouge pas d'un caractère.
   */
  nomAccessible(item: NavItem): string {
    return this.railActif() ? nomAccessibleRail(item, this.role()) : item.label;
  }

  /**
   * Infobulle d'une entrée : la mention de délégation (spec 2026-08-14) et, EN RAIL, le libellé
   * complet — c'est lui que l'utilisateur vient chercher au survol quand seule la légende est
   * visible. En menu large le libellé est déjà lisible : pas d'infobulle qui répète le texte.
   */
  infobulle(item: NavItem): string {
    const deleg = item.delegation
      ? `Tâche du profil ${this.delegationLabel(item.delegation)} — exercée par délégation active.`
      : '';
    if (!this.railActif()) return deleg;
    return deleg ? `${item.label} — ${deleg}` : item.label;
  }
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
  /** Sidebar ouverte en mode drawer (tablette / mobile, ou mode concentration). Sans effet sinon. */
  readonly sidebarOpen = signal(false);
  /** Route courante en mode « concentration » : barre latérale repliée en tiroir (`routeEnConcentration`). */
  readonly concentration = signal(false);
  /** Dossier ouvert depuis une notification — la modale est rendue par le layout (hors topbar, cf. template). */
  readonly dossierNotification = signal<Dossier | null>(null);
  /**
   * Actualités du profil connecté (spec 2026-08-18). Demandées UNE fois, à la construction du
   * layout — c'est-à-dire à l'ouverture de session, jamais à chaque navigation. La fermeture vide
   * la liste : l'annonce ne réapparaît qu'à la prochaine connexion.
   */
  readonly actualites = signal<Actualite[]>([]);
  /** Modale « Changer mon mot de passe » (tous profils), ouverte depuis la topbar. */
  readonly motDePasseOuvert = signal(false);

  // ── Recherche « aller à un dossier par référence » (topbar) ──
  /** Saisie de la recherche par référence de dossier. */
  readonly recherche = signal('');
  /** Résolution de la référence en cours (désactive le champ). */
  readonly rechercheEnCours = signal(false);
  /**
   * ⚠️ Lot L4-F6 (décision 5 du plan L4, 2026-09-15) — la recherche, jusqu'ici réservée à la PRMP et
   * à son UGPM parce qu'elle atterrissait dans l'espace `/prmp`, s'ouvre aux HUIT profils du circuit :
   * elle mène désormais à la page du dossier, qui vit dans l'espace de chacun. L'endpoint était déjà
   * ouvert à tout profil authentifié et scopé comme la liste des dossiers — aucune référence n'est
   * résolue hors périmètre. L'Administrateur et le Chargé de publication, sans page en v1, n'ont pas
   * le champ.
   */
  readonly peutRechercher = computed(() => this.lienDossier.espace() !== null);
  /** Longueur minimale acceptée par `GET /api/dossiers/recherche` — en deçà, le serveur répond 400. */
  private static readonly LONGUEUR_MIN_RECHERCHE = 2;
  /**
   * Résout la saisie sur la référence **affichée** d'un dossier du périmètre (`refeDossier` ou réf. du PPM)
   * et ouvre sa PAGE (lot L4-F6), avec le retour vers l'écran courant. Aucun résultat → toast.
   *
   * ⚠️ Audit 2026-08-27 (C-1) — la résolution se fait **côté serveur** (`GET /api/dossiers/recherche?q=`,
   * 10 résultats allégés au plus, scopés comme la liste des dossiers). Auparavant, CHAQUE recherche
   * téléchargeait la liste COMPLÈTE des dossiers *et* celle des PPM pour retrouver une ligne en
   * JavaScript : deux tables entières transférées et parsées.
   * La saisie de moins de deux caractères est écartée ici, sans appel — le serveur la refuserait (400).
   *
   * ⚠️ Lot L4-F6 — la destination n'est plus la liste `/prmp/dossiers/:type/:groupe?focus=`, mais la
   * page du dossier : plus besoin d'une famille renseignée pour construire l'URL, et le même geste
   * sert les huit profils du circuit.
   */
  allerAuDossier(): void {
    const saisie = this.recherche().trim();
    if (!saisie || this.rechercheEnCours()) return;
    if (saisie.length < MainLayout.LONGUEUR_MIN_RECHERCHE) {
      this.toast.info(`Saisissez au moins ${MainLayout.LONGUEUR_MIN_RECHERCHE} caractères pour rechercher.`);
      return;
    }
    const retour = this.router.url;
    this.rechercheEnCours.set(true);
    this.dossierService.rechercher(saisie).subscribe({
      next: (resultats) => {
        this.rechercheEnCours.set(false);
        // Le serveur rend les plus récents d'abord : le premier est le meilleur candidat, comme
        // l'était le premier `find` de l'ancienne résolution côté client.
        const trouve = resultats[0];
        if (!trouve) {
          this.toast.info(`Aucun dossier pour « ${saisie} ».`);
          return;
        }
        this.recherche.set('');
        void this.router.navigate(this.lienDossier.commandes(trouve.idDossier), { queryParams: this.lienDossier.params(retour) });
      },
      error: () => {
        this.rechercheEnCours.set(false);
        this.toast.error('Recherche impossible pour le moment.');
      },
    });
  }

  /** Couleur du badge de compteur par item (i=info, w=warning, s=success, d=danger). */
  private readonly badgeSeverites: Record<string, string> = {
    '/prmp/mes-brouillons': 'i',
    '/prmp/ppm-marches': 'i',
    '/prmp/resultat-examen': 'd',
    '/prmp/retraits': 'd',
    [CHEMIN_A_VERIFIER]: 'i',
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

  /** Titre de la page atteinte, lu par la région live de navigation (voir le template). */
  readonly annonceNavigation = signal('');

  /**
   * Annonce le titre de la page après une navigation, et le reporte dans le titre du document
   * (onglet, historique). Le titre est lu dans le DOM rendu — chaque écran porte un `h1` — avec
   * repli sur `route.data.title`, toutes les routes n'en déclarant pas.
   */
  private annoncerPage(): void {
    setTimeout(() => {
      let route = this.router.routerState.root;
      while (route.firstChild) {
        route = route.firstChild;
      }
      const titreRoute = route.snapshot.data['title'] as string | undefined;
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      const titre = (h1 || titreRoute || '').replace(/\s+/g, ' ');
      if (titre) {
        this.annonceNavigation.set(titre);
        document.title = `${titre} — CNM`;
      }
    });
  }

  /** Lien d'évitement : place le focus sur le contenu (l'ancre seule ne le déplace pas partout). */
  allerAuContenu(ev: Event): void {
    ev.preventDefault();
    document.getElementById('contenu-principal')?.focus();
  }

  constructor() {
    // Ferme le drawer mobile à chaque navigation (clic sur un lien de menu).
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.sidebarOpen.set(false);
        this.concentration.set(routeEnConcentration(this.router.routerState.snapshot.root));
        this.annoncerPage();
      });

    // Vacance PRMP (spec « Mandats PRMP ») : vérifiée à l'ouverture puis à chaque navigation — le
    // déblocage est automatique côté serveur, re-vérifier suffit à lever la bannière et les blocages.
    this.vacanceStore.verifier();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.vacanceStore.verifier());

    // Actualités de l'ouverture de session : le serveur renvoie déjà la liste filtrée (profil,
    // statut, fenêtre de dates, interrupteur global) — vide si la fonctionnalité est coupée.
    // L'échec est silencieux : une annonce manquante ne doit pas gêner l'entrée dans l'application,
    // et l'endpoint peut ne pas encore être déployé.
    this.actualiteService.mesActualites().subscribe({
      next: (rows) => this.actualites.set(rows ?? []),
      error: () => this.actualites.set([]),
    });

    const ref = this.auth.ref();
    if (!ref) {
      return;
    }
    // « Nom Prénoms » : résolu par le SERVEUR au login (`nomAffichage`, tous types d'acteur — UGPM
    // comprise, dont le claim `ref` porte la PRMP de tutelle). Les lookups ci-dessous ne restent que
    // pour les sessions persistées ANTÉRIEURES à cette livraison (sans nomAffichage).
    const nomSession = this.auth.nomAffichage();
    if (nomSession) {
      this.displayName.set(nomSession);
    } else if (this.auth.typeActeur() === 'PRMP') {
      this.prmpService.getById(ref).subscribe({
        next: (p) => this.displayName.set(`${p.nomPrmp ?? ''} ${p.prenomsPrmp ?? ''}`.trim()),
        error: () => {},
      });
    } else if (this.auth.typeActeur() === 'CONTROLEUR') {
      this.controleurService.getById(ref).subscribe({
        next: (c) => this.displayName.set(`${c.nomCont ?? ''} ${c.prenomsCont ?? ''}`.trim()),
        error: () => {},
      });
    }

    // Badges de menu : UN appel agrégé (`GET /api/kpis/badges`, livraison backend c16407f)
    // remplace les rejeux d'endpoints de liste par rôle (AUDIT.md P2) — à l'ouverture, à chaque
    // navigation, et immédiatement sur mutation signalée (réception, dispatch, lecture de lettre…).
    // Le compteur Vérificateur reste le miroir exact de sa file (il décroît de lui-même à la
    // transmission SIGMP) ; le CC gagne le même badge « à dispatcher » que le Président.
    const role = this.auth.role();
    // ⚠️ 2026-09-15 — l'Assistant et l'UGPM rejoignent la liste : leur seule pastille est « À faire ».
    if (role && ['PRMP', 'UGPM', 'SECRETAIRE', 'VERIFICATEUR', 'ASSISTANT_CONTROLEUR', 'PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE'].includes(role)) {
      this.rafraichirBadges();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirBadges());
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirBadges());
    }
  }

  /**
   * Compteurs de contenu du menu — un seul appel agrégé (`/api/kpis/badges`), mappé vers les
   * items du profil. Conventions conservées : pas de badge « 0 » (clés filtrées) ; « Dossiers
   * à rectifier » reste une ALERTE rouge distincte des compteurs informatifs.
   * ⚠️ 2026-08-06/07 — chez Président/CC, seuls « à dispatcher » est badgé au menu : les autres
   * compteurs vivent sur les cartes des hubs (« Résultat examen », « Mes dossiers »).
   */
  private rafraichirBadges(): void {
    this.kpiService.badges().subscribe({
      next: ({ compteurs, aFaire }) => {
        const c: Record<string, number> = {};
        switch (this.auth.role()) {
          case 'PRMP':
            // ⚠️ « Mes brouillons » / « PPM & marchés » / « Dossiers vérifiés » ne sont plus des
            // entrées du menu PRMP (retirées le 2026-08-02 au profit des cartes « Mes dossiers ») :
            // ces clés restent mappées pour le menu UGPM et les réintroductions éventuelles — un
            // compteur sans item correspondant n'affiche simplement rien.
            c['/prmp/mes-brouillons'] = compteurs['brouillons'] ?? 0;
            c['/prmp/ppm-marches'] = compteurs['ppmMarches'] ?? 0;
            // ⚠️ Demande pilote (2026-09-13) — plus de pastille sur « Mettre à jour un PPM »
            // (`/prmp/dossiers-verifies`) : le compteur serveur `dossiersVerifies` n'est plus affiché.
            // Lettres SIGNE que l'agent connecté n'a pas encore lues (⚠️ 2026-08-27 : décompte par
            // agent, plus par tutelle) → badge sur le hub « Examen de dossiers ».
            c['/prmp/resultat-examen'] = compteurs['lettresRenvoi'] ?? 0;
            // Demandes passées à ACCEPTEE/REFUSEE depuis ma dernière consultation (calcul serveur).
            c['/prmp/retraits'] = compteurs['demandesRetraitNouvelles'] ?? 0;
            this.alerts.update((a) => ({ ...a, '/prmp/a-rectifier': compteurs['dossiersARectifier'] ?? 0 }));
            break;
          case 'PRESIDENT':
            // ⚠️ 2026-09-12 — « Mes dossiers » retiré : la pastille « à dispatcher » passe sur
            // « Tous les dossiers » (le tableau de bord, où l'action Dispatcher vit désormais).
            c['/president/tableau-de-bord'] = compteurs['predispatch'] ?? 0;
            break;
          case 'CHEF_COMMISSION':
            // ⚠️ 2026-09-03 — le pré-dispatch des dossiers CENTRAUX relève du seul Président : chez
            // le CC de la centrale, ce compteur désignerait des dossiers que son écran ne montre
            // plus (incohérence pastille 2 / total 1 relevée par le pilote) → pastille supprimée.
            // Les CC régionaux gardent leur « à dispatcher ». ⚠️ 2026-09-12 : pastille sur « Tous les dossiers ».
            c['/cc/tableau-de-bord'] = estLocaliteCentrale(this.auth.localite()) ? 0 : compteurs['predispatch'] ?? 0;
            break;
          case 'SECRETAIRE':
            // ⚠️ 2026-09-13 — « Mes dossiers » retiré : la pastille « à réceptionner » passe sur « Tous les dossiers ».
            c['/secretaire/tableau-de-bord'] = compteurs['aReceptionner'] ?? 0;
            break;
          case 'VERIFICATEUR':
            c[CHEMIN_A_VERIFIER] = compteurs['aVerifier'] ?? 0;
            break;
          case 'MEMBRE':
            // ⚠️ Demande pilote (2026-09-13) — pastille « Tous les dossiers » = nb de dossiers portant le
            // bouton « Examiner » (à-examiner : DISPATCHE/A_REEXAMINER attribués), servi par le badges agrégé.
            c['/membre/tableau-de-bord'] = compteurs['aExaminer'] ?? 0;
            break;
        }
        // ⚠️ Refonte ergonomique (2026-09-15) — pastille « À faire » : gestes attendus du connecté, même
        // calcul serveur que l'écran. Champ facultatif : absent (backend qui ne le sert pas) ou nul, rien.
        const aFaireChemin = cheminAFaire(this.auth.role());
        if (aFaireChemin && typeof aFaire === 'number') c[aFaireChemin] = aFaire;
        this.counts.set(Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)));
      },
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

  /** Au chargement, ouvre les sous-menus (à tout niveau) contenant la page active. */
  private initialOpenGroups(): Set<string> {
    const open = new Set<string>();
    this.collectOpenGroups(navFor(this.auth.role()), this.router.url, open);
    return open;
  }
  /**
   * Ajoute à `open` le chemin de chaque groupe (à n'importe quel niveau) dont un descendant **feuille**
   * correspond à `url`. Retourne `true` si un élément de `items` est actif (pour la remontée récursive).
   */
  private collectOpenGroups(items: NavItem[], url: string, open: Set<string>): boolean {
    let active = false;
    for (const item of items) {
      if (item.children?.length) {
        if (this.collectOpenGroups(item.children, url, open)) {
          open.add(item.path);
          active = true;
        }
      } else if (url.startsWith(item.path)) {
        active = true;
      }
    }
    return active;
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
