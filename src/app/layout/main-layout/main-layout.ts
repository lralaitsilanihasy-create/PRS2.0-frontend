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
  LettreRenvoiService,
  PpmService,
  PrmpService,
} from '../../services';
import { NotificationCenter } from '../notification-center/notification-center';
import { DossierConsultation } from '../../features/circuit/dossier-consultation';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationCenter, DossierConsultation],
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
  private readonly lettreRenvoiService = inject(LettreRenvoiService);
  private readonly kpiService = inject(KpiService);
  private readonly dossiersRefresh = inject(DossiersRefreshStore);
  private readonly vacanceStore = inject(VacanceStore);
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
   */
  allerAuDossier(): void {
    const saisie = this.recherche().trim();
    if (!saisie || this.rechercheEnCours()) return;
    const q = saisie.toLowerCase();
    this.rechercheEnCours.set(true);
    forkJoin({ dossiers: this.dossierService.list(), ppms: this.ppmService.list() }).subscribe({
      next: ({ dossiers, ppms }) => {
        this.rechercheEnCours.set(false);
        const ppmRef = new Map(ppms.map((p) => [p.idDossier, p.reference]));
        const refDe = (d: { refeDossier?: string; idDossier: number }) =>
          (d.refeDossier || ppmRef.get(d.idDossier) || '').toLowerCase();
        const trouve = dossiers.find((d) => refDe(d).includes(q));
        if (!trouve) {
          this.toast.info(`Aucun dossier pour « ${saisie} ».`);
          return;
        }
        const groupe = trouve.statut === 'BROUILLON' ? 'brouillon' : 'soumis';
        this.recherche.set('');
        void this.router.navigate(['/prmp/dossiers', trouve.idTypeDossier, groupe], {
          queryParams: { focus: trouve.idDossier },
        });
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

  constructor() {
    // Ferme le drawer mobile à chaque navigation (clic sur un lien de menu).
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sidebarOpen.set(false));

    // Vacance PRMP (spec « Mandats PRMP ») : vérifiée à l'ouverture puis à chaque navigation — le
    // déblocage est automatique côté serveur, re-vérifier suffit à lever la bannière et les blocages.
    this.vacanceStore.verifier();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.vacanceStore.verifier());

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

    // Secrétaire : badge « à réceptionner » sur « Mes dossiers » (les écrans Réceptions /
    // Enregistrement ont été fusionnés dedans), rafraîchi à l'ouverture puis à chaque navigation.
    if (this.auth.role() === 'SECRETAIRE') {
      this.rafraichirCompteursSecretaire();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirCompteursSecretaire());
      // Réception enregistrée dans le drill-down (pas de navigation) → badge à jour immédiatement.
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirCompteursSecretaire());
    }

    // PRMP : alerte « à rectifier » + compteurs de contenu du menu.
    if (this.auth.role() === 'PRMP') {
      this.rafraichirAlertesPrmp();
      this.rafraichirCompteursPrmp();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => {
          this.rafraichirAlertesPrmp();
          this.rafraichirCompteursPrmp();
        });
      // Mise à jour immédiate des compteurs après une mutation signalée
      // (ex. lecture d'une lettre de renvoi → décrément du compteur).
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirCompteursPrmp());
    }

    // Vérificateur : badge « À vérifier » (demande user 2026-08-04). Compteur SERVEUR
    // (`/api/kpis/mes-compteurs-verificateur`), miroir exact de la file — il décroît donc de lui-même
    // dès qu'un dossier en sort, notamment à la transmission de la décision à SIGMP.
    if (this.auth.role() === 'VERIFICATEUR') {
      this.rafraichirCompteursVerificateur();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirCompteursVerificateur());
      // Transmission SIGMP faite depuis l'écran de vérification (sans navigation) → badge à jour tout de suite.
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirCompteursVerificateur());
    }

    // Président : compteurs de contenu par item de menu (dérivés des endpoints de liste).
    if (this.auth.role() === 'PRESIDENT') {
      this.rafraichirCompteursPresident();
      this.router.events
        .pipe(
          filter((e) => e instanceof NavigationEnd),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.rafraichirCompteursPresident());
      // Dispatch depuis le drill-down (pas de navigation) → badge « Mes dossiers » à jour immédiatement.
      toObservable(this.dossiersRefresh.revision)
        .pipe(skip(1), takeUntilDestroyed())
        .subscribe(() => this.rafraichirCompteursPresident());
    }
  }

  /**
   * Compteurs de contenu du menu Président : un appel de liste documenté par item
   * (n'affiche que les valeurs > 0). Aucun endpoint de compteurs agrégé n'existe côté API.
   */
  private rafraichirCompteursPresident(): void {
    this.dossierService.list('PRET_DISPATCH').subscribe({
      next: (preDispatch) => {
        // ⚠️ 2026-08-06/07 — « Projets de PV », « PV définitifs », « Lettres de renvoi » et
        // « Demandes de retrait » ne sont plus des entrées de menu : leurs compteurs vivent
        // désormais là où l'utilisateur les lit — sur les cartes du hub « Résultat examen » et sur
        // les cartes de type de « Mes dossiers ». Il ne reste ici que le badge « à dispatcher ».
        const c: Record<string, number> = {
          // Dossiers en attente de dispatch → badge « action à faire » sur « Mes dossiers ».
          '/president/mes-dossiers': preDispatch.length,
        };
        // N'expose que les compteurs > 0 (pas de badge « 0 »).
        const visibles = Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0));
        this.counts.set(visibles);
      },
      error: () => {},
    });
  }

  /**
   * Compteurs de contenu du menu PRMP (un appel de liste documenté par item ; valeurs > 0 seulement).
   * « Dossiers à rectifier » garde son badge d'alerte rouge (rafraichirAlertesPrmp), non dupliqué ici.
   */
  private rafraichirCompteursPrmp(): void {
    forkJoin({
      brouillons: this.dossierService.list('BROUILLON'),
      ppms: this.ppmService.list(),
      verifies: this.dossierService.list('CLOTURE'),
      lettres: this.lettreRenvoiService.getMesLettres(),
      compteurs: this.kpiService.mesCompteurs(),
    }).subscribe({
      next: ({ brouillons, ppms, verifies, lettres, compteurs }) => {
        const c: Record<string, number> = {
          '/prmp/mes-brouillons': brouillons.length,
          '/prmp/ppm-marches': ppms.length,
          '/prmp/dossiers-verifies': verifies.length,
          // Lettres SIGNE non encore lues (le compteur décroît à la lecture) → badge sur le hub
          // « Examen de dossiers » qui regroupe désormais lettres + PV définitifs.
          '/prmp/resultat-examen': lettres.filter((l) => !l.lue).length,
          // Demandes passées à ACCEPTEE/REFUSEE depuis ma dernière consultation (calcul serveur).
          '/prmp/retraits': compteurs.demandesRetraitNouvelles,
        };
        this.counts.set(Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)));
      },
      error: () => {},
    });
  }

  /** Recharge le compteur d'alerte PRMP (dossiers EN_ATTENTE_DECISION_PRMP → à rectifier). */
  private rafraichirAlertesPrmp(): void {
    this.dossierService.list('EN_ATTENTE_DECISION_PRMP').subscribe({
      next: (rows) => this.alerts.update((a) => ({ ...a, '/prmp/a-rectifier': rows.length })),
      error: () => {},
    });
  }

  /**
   * Recharge le badge « À vérifier » du Vérificateur (compteur serveur, scopé à sa localité).
   * File vide → aucun badge (convention du menu : pas de badge « 0 »), d'où le retrait de la clé.
   */
  private rafraichirCompteursVerificateur(): void {
    this.kpiService.mesCompteursVerificateur().subscribe({
      next: (c) =>
        this.counts.update((m) => {
          const suivant = { ...m };
          if (c.aVerifier > 0) {
            suivant[CHEMIN_A_VERIFIER] = c.aVerifier;
          } else {
            delete suivant[CHEMIN_A_VERIFIER];
          }
          return suivant;
        }),
      error: () => {},
    });
  }

  /** Recharge le compteur du Secrétaire (à réceptionner, scopé serveur) → badge « Mes dossiers ». */
  private rafraichirCompteursSecretaire(): void {
    this.dossierService.aReceptionner().subscribe({
      next: (rows) => this.counts.update((c) => ({ ...c, '/secretaire/mes-dossiers': rows.length })),
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
