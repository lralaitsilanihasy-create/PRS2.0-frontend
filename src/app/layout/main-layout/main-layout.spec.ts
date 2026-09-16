import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { DelegationsAffichageStore } from '../../core/preferences/delegations-affichage.store';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { ActualiteService } from '../../services/actualite.services';
import { KpiService } from '../../services';
import { BadgesMenu, Role } from '../../models';
import { NAV_BY_ROLE } from '../../core/navigation/navigation';
import { MainLayout, routeEnConcentration } from './main-layout';

@Component({ selector: 'app-ecran-factice', template: '<h1>Écran</h1>' })
class EcranFactice {}

/** Branche de route factice : racine → enfants, chacun avec ses `data`. */
function branche(...datas: Record<string, unknown>[]): ActivatedRouteSnapshot {
  let enfant: ActivatedRouteSnapshot | null = null;
  for (const data of [...datas].reverse()) {
    enfant = { data, firstChild: enfant } as unknown as ActivatedRouteSnapshot;
  }
  return enfant as ActivatedRouteSnapshot;
}

describe('Mode « concentration » de la coquille (refonte ergonomique, lot 2)', () => {
  describe('routeEnConcentration', () => {
    it('lit la donnée sur la route la plus profonde', () => {
      expect(routeEnConcentration(branche({}, {}, { title: 'Examiner', concentration: true }))).toBe(true);
    });

    it('reste inactif sans la donnée, ou si elle ne vaut pas exactement true', () => {
      expect(routeEnConcentration(branche({}, { title: 'Tableau de bord' }))).toBe(false);
      expect(routeEnConcentration(branche({ concentration: 'oui' }))).toBe(false);
      expect(routeEnConcentration(null)).toBe(false);
    });
  });

  describe('MainLayout', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [MainLayout],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            { path: 'membre/examiner/:idDossier', component: EcranFactice, data: { title: 'Examiner', concentration: true } },
            { path: 'membre/tableau-de-bord', component: EcranFactice, data: { title: 'Dossiers' } },
          ]),
          {
            provide: AuthService,
            useValue: {
              role: signal(null),
              login: signal(null),
              localite: signal(null),
              ref: () => null,
              nomAffichage: () => null,
              typeActeur: () => null,
              logout: () => undefined,
            },
          },
          { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
          { provide: PermissionsService, useValue: { peutExecuter: () => false } },
          { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
          { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
        ],
      });
    });

    it("replie la barre latérale en tiroir sur l'examen, et la rend ailleurs", async () => {
      const fixture = TestBed.createComponent(MainLayout);
      const router = TestBed.inject(Router);
      const hote = fixture.nativeElement as HTMLElement;

      await router.navigateByUrl('/membre/examiner/42');
      fixture.detectChanges();
      expect(hote.classList.contains('layout--concentration')).toBe(true);
      // Le menu reste accessible : le bouton du tiroir l'ouvre.
      (hote.querySelector('.sidebar-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(hote.querySelector('.sidebar')?.classList.contains('open')).toBe(true);

      await router.navigateByUrl('/membre/tableau-de-bord');
      fixture.detectChanges();
      expect(hote.classList.contains('layout--concentration')).toBe(false);
      // La navigation referme le tiroir.
      expect(hote.querySelector('.sidebar')?.classList.contains('open')).toBe(false);
    });
  });
});

describe('Pastille « À faire » du menu (refonte ergonomique, 2026-09-15)', () => {
  const monter = async (badges: BadgesMenu) => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'membre/a-faire', component: EcranFactice }]),
        {
          provide: AuthService,
          useValue: {
            role: signal('MEMBRE'),
            login: signal('MEMBANT1'),
            localite: signal('ANT'),
            // Un matricule : sans lui, la coquille ne demande pas les pastilles.
            ref: () => 'MEMBANT1',
            nomAffichage: () => 'RAKOTO Jean',
            typeActeur: () => 'CONTROLEUR',
            // Pas de session réelle : le flux de notifications reste éteint.
            isAuthenticated: () => false,
            logout: () => undefined,
          },
        },
        { provide: KpiService, useValue: { badges: () => of(badges) } },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl('/membre/a-faire');
    fixture.detectChanges();
    const entree = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a.nav-item')).find((a) => a.textContent?.includes('À faire')) as HTMLElement;
    return entree;
  };

  it('affiche badges.aFaire sur « À faire », en tête du menu', async () => {
    const entree = await monter({ profil: 'MEMBRE', compteurs: { aExaminer: 2 }, aFaire: 5 });
    expect(entree.getAttribute('href')).toBe('/membre/a-faire');
    expect(entree.querySelector('.nav-badge')?.textContent?.trim()).toBe('5');
  });

  it('pas de pastille quand le champ est absent (backend qui ne le sert pas), nul ou à zéro', async () => {
    expect((await monter({ profil: 'MEMBRE', compteurs: { aExaminer: 2 } })).querySelector('.nav-badge')).toBeNull();
    TestBed.resetTestingModule();
    expect((await monter({ profil: 'MEMBRE', compteurs: {}, aFaire: null })).querySelector('.nav-badge')).toBeNull();
    TestBed.resetTestingModule();
    expect((await monter({ profil: 'MEMBRE', compteurs: {}, aFaire: 0 })).querySelector('.nav-badge')).toBeNull();
  });
});

describe('Bannière de vacance du poste PRMP (recette du 2026-09-15)', () => {
  /**
   * Un conteneur flex (`.alert`) range chaque enfant direct dans sa colonne : du texte et un <strong>
   * posés côte à côte y devenaient trois ou quatre colonnes. Le message doit tenir dans UN enfant.
   */
  const enfantsDirectsMixtes = (el: Element): boolean =>
    Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '') && el.children.length > 0;

  it('le message tient dans un seul bloc : pas de texte à côté du <strong>', async () => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'prmp/tableau-de-bord', component: EcranFactice }]),
        {
          provide: AuthService,
          useValue: { role: signal('PRMP'), login: signal('PRMP001'), localite: signal('ANT'), ref: () => null, nomAffichage: () => null, typeActeur: () => 'PRMP', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(true), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl('/prmp/tableau-de-bord');
    fixture.detectChanges();
    const banniere = (fixture.nativeElement as HTMLElement).querySelector('.alert.vacance-banniere') as HTMLElement;
    expect(banniere).not.toBeNull();
    expect(enfantsDirectsMixtes(banniere)).toBe(false);
    // ⚠️ Lot 5 (2026-09-16) — l'icône (ex-« ⏸ ») est un FRÈRE du span, jamais dedans : le message
    // reste d'un seul tenant, et l'icône garde sa colonne. Deux enfants, pas un de plus.
    expect(banniere.children.length).toBe(2);
    expect(Array.from(banniere.children).map((e) => e.tagName.toLowerCase())).toEqual(['app-icone', 'span']);
    expect(banniere.querySelectorAll('span').length).toBe(1);
    expect(banniere.querySelector('span app-icone')).toBeNull();
    expect(banniere.querySelector('app-icone svg')).not.toBeNull();
    expect(banniere.querySelector('span > strong')?.textContent).toBe('En attente de nomination de la nouvelle PRMP');
  });
});

describe('Barre latérale et en-tête sans emoji (refonte ergonomique, lot 5 — 2026-09-15)', () => {
  it('icônes SVG pour chaque entrée, le marqueur de délégation et la recherche ; aucun emoji', async () => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'president/a-faire', component: EcranFactice }]),
        {
          provide: AuthService,
          useValue: { role: signal('PRESIDENT'), login: signal('PRESID1'), localite: signal(null), ref: () => null, nomAffichage: () => null, typeActeur: () => 'CONTROLEUR', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => true } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl('/president/a-faire');
    fixture.detectChanges();
    const hote = fixture.nativeElement as HTMLElement;
    const entrees = Array.from(hote.querySelectorAll('.sidebar a.nav-item'));
    expect(entrees.length).toBeGreaterThan(5);
    expect(entrees.every((a) => a.querySelector('app-icone.nav-icon svg'))).toBe(true);
    expect(hote.querySelectorAll('.sidebar app-icone.nav-deleg').length).toBe(2);
    expect(hote.querySelector('.sidebar-nav__titre app-icone')).not.toBeNull();
    expect(/\p{Extended_Pictographic}/u.test(hote.querySelector('.sidebar')?.textContent ?? '')).toBe(false);
    // Profil en français dans la pastille de l'en-tête et la carte profil — la couleur suit le code.
    const pastille = hote.querySelector('.topbar-user .profile-badge') as HTMLElement;
    expect(pastille.textContent?.trim()).toBe('Président');
    expect(pastille.classList).toContain('PRESIDENT');
    expect(hote.querySelector('.sidebar-profile .role')?.textContent?.trim()).toBe('Président');
    // Infobulle d'une entrée déléguée : le profil délégué en clair.
    expect(hote.querySelector('.sidebar a.nav-item[title]:not([title=""])')?.getAttribute('title')).toMatch(/^Tâche du profil (Contrôleur vérificateur|Assistant contrôleur) — /);
  });
});

describe('État courant du menu (refonte ergonomique, lot 5 — F3)', () => {
  /**
   * ⚠️ `routerLinkActive` ne posait QU'UNE CLASSE : pour un lecteur d'écran, l'entrée courante
   * n'existait pas. `ariaCurrentWhenActive="page"` l'annonce — et le repère visuel (pastille claire
   * + barre d'accent de 3 px) ne suffit pas à lui seul, il n'est pas lisible à la voix.
   */
  const monter = async (url: string) => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'membre/a-faire', component: EcranFactice },
          { path: 'membre/tableau-de-bord', component: EcranFactice },
          { path: 'membre/resultat-examen', component: EcranFactice },
          { path: 'notifications', component: EcranFactice },
        ]),
        {
          provide: AuthService,
          useValue: { role: signal('MEMBRE'), login: signal('MEMBANT1'), localite: signal('ANT'), ref: () => null, nomAffichage: () => null, typeActeur: () => 'CONTROLEUR', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('pose aria-current="page" sur l’entrée courante, et sur elle seule', async () => {
    const hote = await monter('/membre/tableau-de-bord');
    const courantes = Array.from(hote.querySelectorAll('[aria-current="page"]'));
    expect(courantes.length).toBe(1);
    expect(courantes[0].getAttribute('href')).toBe('/membre/tableau-de-bord');
    // Le repère visuel et le repère vocal désignent la MÊME entrée.
    expect(courantes[0].classList).toContain('active');
    const actives = Array.from(hote.querySelectorAll('.sidebar a.nav-item.active'));
    expect(actives).toEqual(courantes);
  });

  it('l’entrée de tête et l’entrée transverse sont marquées comme les autres', async () => {
    for (const url of ['/membre/a-faire', '/notifications']) {
      TestBed.resetTestingModule();
      const hote = await monter(url);
      const courantes = Array.from(hote.querySelectorAll('[aria-current="page"]'));
      expect(courantes.length, url).toBe(1);
      expect(courantes[0].getAttribute('href'), url).toBe(url);
    }
  });
});

/**
 * ⚠️ Lot 5, F5 (2026-09-16) — la coquille ne porte plus AUCUN caractère tenant lieu d'icône : ni
 * emoji (rendu variable d'un poste à l'autre, hors du style de l'interface), ni glyphe technique
 * détourné (« ☰ », « › », « ⤴ », « ✕ », « ⏸ »). Tout passe par `app-icone` — grille 24, trait 1,8,
 * `currentColor`, `aria-hidden` — dont les tracés vivent dans `shared/ui/icone.ts`.
 *
 * Le balayage porte sur le DOM RENDU, pas sur le texte des fichiers : c'est ce que l'utilisateur
 * voit, et les commentaires du code (qui contiennent des « ⚠️ » par dizaines) n'y sont pas. Pour
 * ajouter un symbole : lui donner son tracé dans `ICONES`, puis `<app-icone nom="…" />`.
 */
/**
 * Emoji, flèches, symboles techniques (⏸), formes géométriques, symboles divers et dingbats
 * (☰, ✕), flèches supplémentaires (⤴) et chevrons simples (‹ ›).
 *
 * La ponctuation française — guillemets « », tiret cadratin, points de suspension — n'en fait
 * volontairement PAS partie : ce sont des caractères de texte, pas des icônes détournées.
 */
const GLYPHES_INTERDITS = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿⤀-⥿⬀-⯿‹›]/u;

describe('Coquille sans glyphe (refonte ergonomique, lot 5 — F5)', () => {
  const monter = async (role: string, login: string, url: string, vacance: boolean) => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'president/a-faire', component: EcranFactice },
          { path: 'prmp/tableau-de-bord', component: EcranFactice },
        ]),
        {
          provide: AuthService,
          useValue: { role: signal(role), login: signal(login), localite: signal('ANT'), ref: () => null, nomAffichage: () => null, typeActeur: () => 'CONTROLEUR', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(vacance), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => true } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const texteAffiche = (hote: HTMLElement) =>
    Array.from(hote.querySelectorAll('.sidebar, .topbar, .vacance-banniere'))
      .map((el) => el.textContent ?? '')
      .join(' ');

  it('barre latérale, barre du haut et bannière de vacance : aucun glyphe tenant lieu d’icône', async () => {
    for (const [role, login, url, vacance] of [
      ['PRESIDENT', 'PRESID1', '/president/a-faire', false],
      ['PRMP', 'PRMP001', '/prmp/tableau-de-bord', true],
    ] as const) {
      TestBed.resetTestingModule();
      const hote = await monter(role, login, url, vacance);
      const fautifs = [...texteAffiche(hote)].filter((c) => GLYPHES_INTERDITS.test(c));
      expect(fautifs, `${role} : ${fautifs.join(' ')}`).toEqual([]);
    }
  });

  it('le bouton de tiroir porte l’icône « menu », son nom accessible et son état', async () => {
    TestBed.resetTestingModule();
    const hote = await monter('PRESIDENT', 'PRESID1', '/president/a-faire', false);
    const bouton = hote.querySelector('.sidebar-toggle') as HTMLButtonElement;
    expect(bouton.getAttribute('aria-label')).toBe('Ouvrir le menu');
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(bouton.textContent?.trim()).toBe('');
    expect(bouton.querySelector('app-icone svg')).not.toBeNull();
  });

  it('les chevrons de repli sont des tracés SVG, pas des « › »', async () => {
    TestBed.resetTestingModule();
    const hote = await monter('PRESIDENT', 'PRESID1', '/president/a-faire', false);
    const chevron = hote.querySelector('.sidebar-nav__titre-chevron') as HTMLElement;
    expect(chevron.tagName.toLowerCase()).toBe('app-icone');
    expect(chevron.querySelector('svg')).not.toBeNull();
  });

  it('le bloc de marque affiche le produit et l’institution, pastille en logotype muet', async () => {
    TestBed.resetTestingModule();
    const hote = await monter('PRESIDENT', 'PRESID1', '/president/a-faire', false);
    expect(hote.querySelector('.sidebar-logo-text .name')?.textContent?.trim()).toBe('PRS 2.0');
    expect(hote.querySelector('.sidebar-logo-text .sub')?.textContent?.trim()).toBe('Commission nationale des marchés');
    expect(hote.querySelector('.sidebar-logo-mark')?.getAttribute('aria-hidden')).toBe('true');
  });
});

/**
 * ⚠️ Lot 5, F2 (2026-09-16) — le menu s'affiche par RUBRIQUES. Le classement lui-même est testé
 * dans `core/navigation/groupes-menu.spec.ts` (sur les dix menus réels de `NAV_BY_ROLE`) ; ce bloc
 * ne vérifie que le RENDU : les intitulés, le pied, et ce qui ne doit pas bouger.
 *
 * Le contrat tenu ici, entrée par entrée : le regroupement ne perd rien, n'ajoute rien, ne double
 * rien. C'est la seule chose qu'un utilisateur remarquerait tout de suite.
 */
describe('Menu par rubriques (refonte ergonomique, lot 5 — F2)', () => {
  const monter = async (role: Role, login: string, delegationsAffichees = true) => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { role: signal(role), login: signal(login), localite: signal('ANT'), ref: () => null, nomAffichage: () => null, typeActeur: () => 'CONTROLEUR', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        // Délégation ascendante active : le Président voit ses deux entrées déléguées.
        { provide: PermissionsService, useValue: { peutExecuter: () => true } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(delegationsAffichees), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  /** Intitulés de rubrique rendus, dans l'ordre du menu. */
  const rubriques = (hote: HTMLElement) =>
    Array.from(hote.querySelectorAll('.sidebar-nav__titre')).map((t) => t.textContent?.trim().replace(/\s+/g, ' ') ?? '');

  /** Chemins des entrées rendues, rubriques puis pied — l'ordre de lecture de l'utilisateur. */
  const chemins = (hote: HTMLElement) =>
    Array.from(hote.querySelectorAll('.sidebar-nav a.nav-item')).map((a) => a.getAttribute('href') ?? '');

  it('range le menu du Président en Mon travail, Décisions, Pilotage, puis Exercé par délégation', async () => {
    const hote = await monter('PRESIDENT', 'PRESID1');
    expect(rubriques(hote)).toEqual(['Mon travail', 'Décisions', 'Pilotage', 'Exercé par délégation']);
    expect(chemins(hote)).toEqual([
      '/president/a-faire',
      '/president/tableau-de-bord',
      '/president/resultat-examen',
      '/president/retraits',
      '/president/repartition-dispatch',
      '/president/chaines-controle',
      '/president/verifications',
      '/president/pv-examens',
      '/notifications',
    ]);
  });

  it('ne perd, n’ajoute et ne double aucune entrée, sur les dix menus', async () => {
    for (const role of Object.keys(NAV_BY_ROLE) as Role[]) {
      TestBed.resetTestingModule();
      const hote = await monter(role, 'TEST001');
      // `?maj=1` de « Mettre à jour un PPM » : c'est le même chemin de route, on compare les chemins.
      const rendus = chemins(hote).map((h) => h.split('?')[0]);
      expect(new Set(rendus).size, `${role} : doublon dans le menu rendu`).toBe(rendus.length);
      expect([...rendus].sort(), `${role}`).toEqual([...NAV_BY_ROLE[role].map((i) => i.path)].sort());
      expect(
        rubriques(hote).filter((t) => t === ''),
        `${role} : intitulé vide rendu`,
      ).toEqual([]);
    }
  });

  it('un menu d’une seule rubrique n’affiche aucun intitulé — il est déjà sa propre rubrique', async () => {
    for (const [role, login] of [
      ['SECRETAIRE', 'SECANT1'],
      ['VERIFICATEUR', 'VERANT1'],
      ['UGPM', 'UGPM001'],
      ['CHARGE_PUBLICATION', 'CTRPUB1'],
    ] as const) {
      TestBed.resetTestingModule();
      const hote = await monter(role, login);
      expect(rubriques(hote), role).toEqual([]);
    }
  });

  it('« Notifications » quitte les rubriques pour le pied, une seule fois, en dernier', async () => {
    for (const [role, login] of [
      ['PRESIDENT', 'PRESID1'],
      ['ADMINISTRATEUR', 'ADMIN01'],
      ['CHARGE_PUBLICATION', 'CTRPUB1'],
    ] as const) {
      TestBed.resetTestingModule();
      const hote = await monter(role, login);
      const nav = hote.querySelector('.sidebar-nav') as HTMLElement;
      const pied = nav.querySelector('.sidebar-nav__pied') as HTMLElement;
      expect(pied, role).not.toBeNull();
      // Le pied ferme le menu, juste au-dessus de la carte de profil.
      expect(pied, role).toBe(nav.lastElementChild);
      expect(Array.from(pied.querySelectorAll('a.nav-item')).map((a) => a.getAttribute('href')), role).toEqual(['/notifications']);
      expect(nav.querySelectorAll('a[href="/notifications"]').length, role).toBe(1);
    }
  });

  it('seule la rubrique déléguée est un bouton ; un intitulé de rubrique ne commande rien', async () => {
    const hote = await monter('PRESIDENT', 'PRESID1');
    const boutons = Array.from(hote.querySelectorAll('button.sidebar-nav__titre'));
    expect(boutons.length).toBe(1);
    expect(boutons[0].textContent?.trim().replace(/\s+/g, ' ')).toBe('Exercé par délégation');
    expect(boutons[0].getAttribute('aria-expanded')).toBe('true');
    // Les autres intitulés ne sont ni des boutons ni des liens : pas de tabulation pour rien.
    expect(hote.querySelectorAll('.sidebar-nav__titre--fixe').length).toBe(3);
    expect(hote.querySelectorAll('button.sidebar-nav__titre--fixe, a.sidebar-nav__titre--fixe').length).toBe(0);
  });

  it('replier la délégation ne range QUE la rubrique déléguée — les autres restent ouvertes', async () => {
    const hote = await monter('PRESIDENT', 'PRESID1', false);
    // L'intitulé reste visible (sans quoi rien ne permettrait de rouvrir), ses entrées non.
    expect(rubriques(hote)).toEqual(['Mon travail', 'Décisions', 'Pilotage', 'Exercé par délégation']);
    expect(hote.querySelector('button.sidebar-nav__titre')?.getAttribute('aria-expanded')).toBe('false');
    expect(chemins(hote)).toEqual([
      '/president/a-faire',
      '/president/tableau-de-bord',
      '/president/resultat-examen',
      '/president/retraits',
      '/president/repartition-dispatch',
      '/president/chaines-controle',
      '/notifications',
    ]);
  });

  /**
   * ⚠️ Décision du 2026-09-16 (point laissé ouvert par F1) — DANS une rubrique, l'ordre reste celui
   * de `NAV_BY_ROLE` : Délais standards · Seuil AGPM · Actualités · Référentiels, et non l'ordre
   * écrit dans la table du plan (§3.2), qui plaçait Référentiels avant Actualités. Le forcer aurait
   * demandé un rang par entrée dans `groupes-menu.ts` — c'est-à-dire un second ordre déclaré, que le
   * pilote ne verrait pas en ajoutant une ligne à `navigation.ts`. Le lot dérive, il ne redéclare pas.
   */
  it('range le menu de l’Administrateur en cinq rubriques, ordre de déclaration conservé dedans', async () => {
    const hote = await monter('ADMINISTRATEUR', 'ADMIN01');
    expect(rubriques(hote)).toEqual(['Suivi', 'Demandes', 'Organisation', 'Paramétrage', 'Données']);
    expect(chemins(hote)).toEqual([
      '/admin/tableau-de-bord',
      '/admin/audit',
      '/admin/sessions',
      '/admin/inscriptions',
      '/admin/rattachements',
      '/admin/chaines-controle',
      '/admin/comptes',
      '/admin/delais-standards',
      '/admin/agpm-seuil',
      '/admin/actualites',
      '/admin/referentiels',
      '/admin/ppm-marches',
      '/admin/marches-previsions',
      '/notifications',
    ]);
  });
});
