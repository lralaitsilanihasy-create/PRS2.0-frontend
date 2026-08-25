import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, forkJoin, skip } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { ToastService } from '../../core/notifications/toast.service';
import { NavItem, navFor } from '../../core/navigation/navigation';
import { PermissionsService } from '../../core/auth/permissions.service';
import { DossiersRefreshStore } from '../../features/prmp/dossiers-refresh.store';
import {
  ControleurService,
  DossierService,
  KpiService,
  PpmService,
  PrmpService,
} from '../../services';
import { NotificationCenter } from '../notification-center/notification-center';
import { DossierConsultation } from '../../features/circuit/dossier-consultation';
import { ActualitesModal } from '../../shared/actualites/actualites-modal';
import { Actualite } from '../../models/actualite.model';
import { ActualiteService } from '../../services/actualite.services';
import { Dossier, Role } from '../../models';

/** Entrée de menu du Vérificateur portant le badge du nombre de dossiers restant à traiter. */
const CHEMIN_A_VERIFIER = '/verificateur/a-verifier';

/**
 * Coquille applicative pour les utilisateurs connectés : en-tête (identité + déconnexion),
 * barre latérale dont les entrées sont filtrées selon le profil, et zone de contenu routée.
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationCenter, DossierConsultation, ActualitesModal],
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
  private readonly ppmService = inject(PpmService);
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
  /** Libellé humain d'un profil délégué (infobulle du marqueur ⤴ du menu). */
  private static readonly LIBELLES_PROFILS: Partial<Record<Role, string>> = {
    SECRETAIRE: 'Secrétaire',
    MEMBRE: 'Membre',
    VERIFICATEUR: 'Contrôleur vérificateur',
    ASSISTANT_CONTROLEUR: 'Assistant contrôleur',
    CHEF_COMMISSION: 'Chef de commission',
  };
  delegationLabel(role: Role): string {
    return MainLayout.LIBELLES_PROFILS[role] ?? role;
  }
  /**
   * Menu du profil, filtré par la DÉLÉGATION ASCENDANTE (spec 2026-08-14) : une entrée portant
   * `delegation` n'apparaît que si le profil courant peut exécuter les tâches de ce profil (paire
   * active de t_delegation_profil) — le menu suit la base, zéro code.
   */
  readonly navItems = computed(() =>
    navFor(this.auth.role())
      .filter((item) => !item.delegation || this.permissions.peutExecuter(item.delegation))
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter((c) => !c.delegation || this.permissions.peutExecuter(c.delegation)) }
          : item,
      ),
  );
  /**
   * ⚠️ Demande user (2026-08-15) — interrupteurs « Délégations » : les tâches déléguées ne
   * s'affichent qu'en ACTIVANT l'interrupteur du profil correspondant (opt-in séparé par profil,
   * défaut désactivé, persisté par matricule). Le menu et tous les écrans suivent `peutExecuter`.
   */
  readonly delegationsDisponibles = this.permissions.delegationsDisponibles;
  exerceDelegation(r: Role): boolean {
    return this.permissions.exerce(r);
  }
  basculerDelegation(r: Role): void {
    this.permissions.basculerExercice(r);
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
  /** Sidebar ouverte en mode drawer (tablette / mobile). Sans effet sur desktop. */
  readonly sidebarOpen = signal(false);
  /** Dossier ouvert depuis une notification — la modale est rendue par le layout (hors topbar, cf. template). */
  readonly dossierNotification = signal<Dossier | null>(null);
  /**
   * Actualités du profil connecté (spec 2026-08-18). Demandées UNE fois, à la construction du
   * layout — c'est-à-dire à l'ouverture de session, jamais à chaque navigation. La fermeture vide
   * la liste : l'annonce ne réapparaît qu'à la prochaine connexion.
   */
  readonly actualites = signal<Actualite[]>([]);

  // ── Recherche « aller à un dossier par référence » (topbar, PRMP/UGPM) ──
  /** Saisie de la recherche par référence de dossier. */
  readonly recherche = signal('');
  /** Résolution de la référence en cours (désactive le champ). */
  readonly rechercheEnCours = signal(false);
  /** La recherche cible l'espace `/prmp` → réservée aux profils qui y accèdent. */
  readonly peutRechercher = computed(() => this.role() === 'PRMP' || this.role() === 'UGPM');
  /**
   * Résout la saisie sur la référence **affichée** d'un dossier du périmètre (`refeDossier` ou réf. du PPM)
   * et navigue vers sa liste (type × groupe) en le mettant en évidence (`?focus=`). Aucun résultat → toast.
   *
   * **Pagination serveur** (constat de relecture, hors AUDIT.md) : deux tables ENTIÈRES (dossiers, ppms)
   * étaient auparavant téléchargées à chaque recherche pour n'en retenir qu'une ligne. Le filtre
   * `reference=` (sous-chaîne, insensible à la casse, sur `REFE_DOSSIER`/`REFERENCE`) est désormais
   * transmis au serveur pour chaque ressource, via `listePage` — même motif que `marches-list.ts` /
   * `dossiers-liste.ts` — et une seule ligne est demandée (`size=1`) : le premier résultat serveur suffit.
   *
   * Le repli sur la référence du PPM reste géré, mais en deux temps : si aucun dossier ne correspond
   * directement, une correspondance côté PPM ne porte que `idDossier` — `statut`/`idTypeDossier`
   * manquent pour naviguer, d'où un `GET /api/dossiers/{id}` ciblé dans ce seul cas.
   */
  allerAuDossier(): void {
    const saisie = this.recherche().trim();
    if (!saisie || this.rechercheEnCours()) return;
    this.rechercheEnCours.set(true);
    forkJoin({
      dossiers: this.dossierService.listePage(0, 1, { reference: saisie }),
      ppms: this.ppmService.listePage(0, 1, { reference: saisie }),
    }).subscribe({
      next: ({ dossiers, ppms }) => {
        const trouve = dossiers.content[0];
        if (trouve) {
          this.rechercheEnCours.set(false);
          this.naviguerVersDossier(trouve);
          return;
        }
        const viaPpm = ppms.content[0];
        if (!viaPpm) {
          this.rechercheEnCours.set(false);
          this.toast.info(`Aucun dossier pour « ${saisie} ».`);
          return;
        }
        // Correspondance trouvée via la référence du PPM : l'objet dossier n'est pas sous la main
        // (seul idDossier l'est) — requête ciblée pour obtenir statut/idTypeDossier avant de naviguer.
        this.dossierService.getById(viaPpm.idDossier).subscribe({
          next: (d) => {
            this.rechercheEnCours.set(false);
            this.naviguerVersDossier(d);
          },
          error: () => {
            this.rechercheEnCours.set(false);
            this.toast.error('Recherche impossible pour le moment.');
          },
        });
      },
      error: () => {
        this.rechercheEnCours.set(false);
        this.toast.error('Recherche impossible pour le moment.');
      },
    });
  }

  /** Navigue vers la liste (type × groupe) du dossier résolu, en le mettant en évidence (`?focus=`). */
  private naviguerVersDossier(dossier: Dossier): void {
    const groupe = dossier.statut === 'BROUILLON' ? 'brouillon' : 'soumis';
    this.recherche.set('');
    void this.router.navigate(['/prmp/dossiers', dossier.idTypeDossier, groupe], {
      queryParams: { focus: dossier.idDossier },
    });
  }

  /** Couleur du badge de compteur par item (i=info, w=warning, s=success, d=danger). */
  private readonly badgeSeverites: Record<string, string> = {
    '/prmp/mes-brouillons': 'i',
    '/prmp/ppm-marches': 'i',
    '/prmp/dossiers-verifies': 's',
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
    if (role && ['PRMP', 'SECRETAIRE', 'VERIFICATEUR', 'PRESIDENT', 'CHEF_COMMISSION'].includes(role)) {
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
      next: ({ compteurs }) => {
        const c: Record<string, number> = {};
        switch (this.auth.role()) {
          case 'PRMP':
            // ⚠️ « Mes brouillons » / « PPM & marchés » / « Dossiers vérifiés » ne sont plus des
            // entrées du menu PRMP (retirées le 2026-08-02 au profit des cartes « Mes dossiers ») :
            // ces clés restent mappées pour le menu UGPM et les réintroductions éventuelles — un
            // compteur sans item correspondant n'affiche simplement rien.
            c['/prmp/mes-brouillons'] = compteurs['brouillons'] ?? 0;
            c['/prmp/ppm-marches'] = compteurs['ppmMarches'] ?? 0;
            c['/prmp/dossiers-verifies'] = compteurs['dossiersVerifies'] ?? 0;
            // Lettres SIGNE non encore lues → badge sur le hub « Examen de dossiers ».
            c['/prmp/resultat-examen'] = compteurs['lettresRenvoi'] ?? 0;
            // Demandes passées à ACCEPTEE/REFUSEE depuis ma dernière consultation (calcul serveur).
            c['/prmp/retraits'] = compteurs['demandesRetraitNouvelles'] ?? 0;
            this.alerts.update((a) => ({ ...a, '/prmp/a-rectifier': compteurs['dossiersARectifier'] ?? 0 }));
            break;
          case 'PRESIDENT':
            c['/president/mes-dossiers'] = compteurs['predispatch'] ?? 0;
            break;
          case 'CHEF_COMMISSION':
            c['/cc/mes-dossiers'] = compteurs['predispatch'] ?? 0;
            break;
          case 'SECRETAIRE':
            c['/secretaire/mes-dossiers'] = compteurs['aReceptionner'] ?? 0;
            break;
          case 'VERIFICATEUR':
            c[CHEMIN_A_VERIFIER] = compteurs['aVerifier'] ?? 0;
            break;
        }
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
