import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { DelegationsAffichageStore } from '../../core/preferences/delegations-affichage.store';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { InterimStore } from '../../core/interim/interim.store';
import { ActualiteService } from '../../services/actualite.services';
import { KpiService } from '../../services';
import { BadgesMenu, Role } from '../../models';
import { NAV_BY_ROLE } from '../../core/navigation/navigation';
import { courtContenuDansLibelle, libelleCourt } from '../../core/navigation/groupes-menu';
import { MenuCompactStore } from '../../core/preferences/menu-compact.store';
import { AssistantIaService } from '../../services/assistant-ia.services';
import { EtatAssistantIa } from '../../models/assistant-ia.model';
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
          { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
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
      '/president/interim',
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
      '/president/interim',
      '/notifications',
    ]);
  });

  /**
   * ⚠️ Décision du 2026-09-16 (point laissé ouvert par F1 du lot 5) — DANS une rubrique, l'ordre
   * reste celui de `NAV_BY_ROLE`. Le forcer depuis `groupes-menu.ts` aurait demandé un rang par
   * entrée, c'est-à-dire un second ordre déclaré que le pilote ne verrait pas en ajoutant une ligne
   * à `navigation.ts`. Le lot dérive, il ne redéclare pas — l'ordre du plan L6 (§3) est donc obtenu
   * en déclarant les entrées dans cet ordre-là, ce que fait `navigation.ts` depuis le lot 6 F1.
   *
   * ⚠️ Lot 6 F1 (2026-09-17) — quatre rubriques, précédées de l'accueil : celui-ci forme une section
   * SANS intitulé, c'est pourquoi `rubriques()` n'en compte que quatre alors que le menu en rend
   * cinq. Un intitulé au-dessus d'une seule entrée ne classerait rien.
   */
  it('range le menu de l’Administrateur en quatre rubriques derrière son accueil, ordre de déclaration conservé dedans', async () => {
    const hote = await monter('ADMINISTRATEUR', 'ADMIN01');
    expect(rubriques(hote)).toEqual(['Accès', 'Règles du contrôle', 'Référentiels', 'Traces']);
    expect(chemins(hote)).toEqual([
      '/admin/tableau-de-bord',
      '/admin/inscriptions',
      '/admin/comptes',
      '/admin/chaines-controle',
      '/admin/delais-standards',
      '/admin/referentiels/points-ctrls',
      '/admin/agpm-seuil',
      '/admin/referentiels/regle-alertes',
      '/admin/referentiels',
      '/admin/audit',
      '/admin/actualites',
      '/notifications',
    ]);
  });
});

/**
 * Lot 5, F4 (2026-09-16) — LE RAIL COMPACT. Décision de Mathieu : « bascule utilisateur mémorisée,
 * menu large par défaut ; rien d'automatique selon la largeur d'écran ».
 *
 * Ce que ces specs verrouillent, dans l'ordre de ce qui ferait le plus de mal en régressant :
 *  1. le rail NE SE SUBSTITUE PAS au mode concentration — l'examen, la vérification et la page
 *     dossier gardent leur tiroir à 0 px (décision 4 du plan L4). Un rail de 76 px y reprendrait
 *     76 px à un écran de travail, et personne ne l'aurait demandé ;
 *  2. le libellé complet est rangé hors écran, jamais retiré, et la légende du rail est
 *     `aria-hidden` : le nom accessible d'une entrée vient toujours de son texte, jamais d'un
 *     `aria-label` qui doublerait le libellé sans que personne ne voie les deux diverger ;
 *  3. WCAG 2.5.3 « Label in Name » (2026-09-16) — en rail, la légende est le seul texte VISIBLE :
 *     elle doit se retrouver dans le nom accessible. Les cinq légendes qui sont des synonymes et
 *     non des fragments s'y préfixent (« Alertes — Notifications ») ; les autres, non ;
 *  4. la bascule est nommée par son ACTION, et c'est le store qui porte la mémoire.
 */
describe('Rail compact (refonte ergonomique, lot 5 — F4)', () => {
  const monter = async (reduit: boolean, url = '/membre/tableau-de-bord') => {
    TestBed.resetTestingModule();
    const compact = signal(reduit);
    const basculer = () => compact.set(!compact());
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'membre/tableau-de-bord', component: EcranFactice, data: { title: 'Dossiers' } },
          { path: 'membre/examiner/:idDossier', component: EcranFactice, data: { title: 'Examiner', concentration: true } },
          { path: 'membre/dossier/:idDossier', component: EcranFactice, data: { title: 'Dossier', concentration: true } },
          { path: 'verificateur/verifier/:idDossier', component: EcranFactice, data: { title: 'Vérifier', concentration: true } },
        ]),
        {
          provide: AuthService,
          useValue: { role: signal('MEMBRE'), login: signal('MEMANT1'), localite: signal('ANT'), ref: () => null, nomAffichage: () => null, typeActeur: () => 'CONTROLEUR', isAuthenticated: () => false, logout: () => undefined },
        },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: MenuCompactStore, useValue: { reduit: compact, basculer } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, compact };
  };

  it('pose « layout--rail » sur la coquille quand l’utilisateur a réduit le menu, et pas avant', async () => {
    expect((await monter(false)).hote.classList.contains('layout--rail')).toBe(false);
    expect((await monter(true)).hote.classList.contains('layout--rail')).toBe(true);
  });

  /**
   * ⚠️ ANTI-RÉGRESSION — la spec que le lot devait poser. Le rail est l'état des écrans de LISTE ;
   * sur les écrans de TRAVAIL la barre reste un tiroir, préférence ou pas. Si cette spec devient
   * rouge, c'est que le rail a commencé à manger la largeur de l'examen.
   */
  it('ne se substitue JAMAIS au mode concentration : examen, vérification, page dossier', async () => {
    for (const url of ['/membre/examiner/42', '/membre/dossier/42', '/verificateur/verifier/42']) {
      const { hote } = await monter(true, url);
      expect(hote.classList.contains('layout--concentration'), url).toBe(true);
      expect(hote.classList.contains('layout--rail'), url).toBe(false);
      // La bascule n'est pas proposée là où elle ne ferait rien ; le tiroir, lui, reste ouvrable.
      expect(hote.querySelector('.sidebar-toggle'), url).not.toBeNull();
    }
  });

  it('la préférence n’est pas effacée par le mode concentration : elle reprend à la sortie', async () => {
    const { fixture, hote } = await monter(true, '/membre/examiner/42');
    expect(hote.classList.contains('layout--rail')).toBe(false);
    await TestBed.inject(Router).navigateByUrl('/membre/tableau-de-bord');
    fixture.detectChanges();
    expect(hote.classList.contains('layout--rail')).toBe(true);
  });

  it('le libellé complet reste dans le document, et le nom accessible vient du texte', async () => {
    const { hote } = await monter(true);
    const entrees = Array.from(hote.querySelectorAll('.sidebar-nav a.nav-item'));
    expect(entrees.length).toBeGreaterThan(0);
    for (const a of entrees) {
      // Le nom accessible vient du texte : la légende du rail en est exclue (`aria-hidden`).
      const nom = a.querySelector('.nav-label')?.textContent?.trim() ?? '';
      expect(nom, a.getAttribute('href') ?? '').toBeTruthy();
      // Le libellé complet — celui de l'infobulle — est toujours là, entier.
      expect(nom, a.getAttribute('href') ?? '').toContain(a.getAttribute('title'));
      expect(a.getAttribute('aria-label')).toBeNull();
      const legende = a.querySelector('.nav-court') as HTMLElement;
      expect(legende, a.getAttribute('href') ?? '').not.toBeNull();
      expect(legende.getAttribute('aria-hidden')).toBe('true');
    }
  });

  /**
   * WCAG 2.5.3 « Label in Name ». Mesuré sur le texte RENDU, pas sur la table : c'est ce que voit et
   * ce qu'entend l'utilisateur. Le menu du Membre porte les deux cas — « Dossiers », fragment de
   * « Tous les dossiers », et « Alertes », synonyme de « Notifications ».
   */
  it('en rail, la légende visible se retrouve dans le nom accessible de chaque entrée', async () => {
    const { hote } = await monter(true);
    const entrees = Array.from(hote.querySelectorAll('.sidebar-nav a.nav-item'));
    expect(entrees.length).toBeGreaterThan(0);
    for (const a of entrees) {
      const court = a.querySelector('.nav-court')?.textContent?.trim() ?? '';
      const nom = a.querySelector('.nav-label')?.textContent?.trim() ?? '';
      expect(
        courtContenuDansLibelle(nom, court),
        `${a.getAttribute('href')} : « ${court} » visible, nom accessible « ${nom} »`,
      ).toBe(true);
    }
  });

  it('seules les légendes SYNONYMES élargissent le nom accessible, et jamais en menu large', async () => {
    const nomDe = (hote: HTMLElement, href: string) =>
      (hote.querySelector(`.sidebar-nav a.nav-item[href="${href}"] .nav-label`) as HTMLElement).textContent?.trim();

    const { hote: rail } = await monter(true);
    // Synonyme : le mot lu à l'écran passe en tête, le libellé complet suit.
    expect(nomDe(rail, '/notifications')).toBe('Alertes — Notifications');
    // Fragment : rien à ajouter, l'entrée garde son libellé nu.
    expect(nomDe(rail, '/membre/tableau-de-bord')).toBe('Tous les dossiers');
    expect(nomDe(rail, '/membre/a-faire')).toBe('À faire');
    // L'infobulle, elle, reste le libellé complet — seul.
    expect((rail.querySelector('.sidebar-nav a.nav-item[href="/notifications"]') as HTMLElement).getAttribute('title')).toBe('Notifications');

    // Menu large : le texte visible EST le libellé complet, le nom accessible ne bouge pas.
    const { hote: large } = await monter(false);
    expect(nomDe(large, '/notifications')).toBe('Notifications');
    expect(nomDe(large, '/membre/tableau-de-bord')).toBe('Tous les dossiers');
  });

  it('la légende du rail est le libellé court dérivé, et l’infobulle porte le libellé complet', async () => {
    const { hote } = await monter(true);
    const dossiers = hote.querySelector('.sidebar-nav a.nav-item[href="/membre/tableau-de-bord"]') as HTMLElement;
    expect(dossiers.querySelector('.nav-court')?.textContent?.trim()).toBe(libelleCourt({ label: 'Tous les dossiers', path: '/membre/tableau-de-bord' }, 'MEMBRE'));
    expect(dossiers.getAttribute('title')).toBe('Tous les dossiers');
    // En menu large, le libellé est déjà lisible : pas d'infobulle qui répète le texte affiché.
    const { hote: large } = await monter(false);
    expect((large.querySelector('.sidebar-nav a.nav-item[href="/membre/tableau-de-bord"]') as HTMLElement).getAttribute('title')).toBe('');
  });

  it('l’état courant survit au rail : aria-current sur la seule entrée active', async () => {
    const { hote } = await monter(true);
    const actives = Array.from(hote.querySelectorAll('.sidebar-nav a.nav-item[aria-current="page"]'));
    expect(actives.length).toBe(1);
    expect(actives[0].getAttribute('href')).toBe('/membre/tableau-de-bord');
    expect(actives[0].classList.contains('active')).toBe(true);
  });

  /**
   * Un bouton dont le NOM change ne porte pas `aria-pressed` : les deux se contrediraient (« Déplier
   * le menu, enfoncé »). Le nom dit l'action, comme le bouton de tiroir voisin.
   */
  it('la bascule nomme son ACTION, et confie la mémoire au store', async () => {
    const { fixture, hote, compact } = await monter(false);
    const bouton = hote.querySelector('.topbar-compact') as HTMLButtonElement;
    expect(bouton.getAttribute('aria-label')).toBe('Réduire le menu');
    expect(bouton.getAttribute('aria-pressed')).toBeNull();
    expect(bouton.getAttribute('title')).toBe('Réduire le menu');
    bouton.click();
    fixture.detectChanges();
    expect(compact()).toBe(true);
    expect(hote.classList.contains('layout--rail')).toBe(true);
    expect(bouton.getAttribute('aria-label')).toBe('Déplier le menu');
  });
});

describe('Bouton « Assistant IA » de la barre du haut (lot 1, 2026-09-18)', () => {
  const ETAT_ACTIF: EtatAssistantIa = {
    actif: true,
    disponible: true,
    modele: 'qwen3.5:9b-q4_K_M',
    documents: [{ libelle: 'Manuel de contrôle a priori (CNM, février 2026)', passages: 135 }],
  };

  const monter = (etat: EtatAssistantIa) => {
    let appelsEtat = 0;
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'membre/tableau-de-bord', component: EcranFactice }]),
        {
          provide: AuthService,
          useValue: {
            role: signal('MEMBRE'),
            login: signal('CTRMEM'),
            localite: signal('ANT'),
            // Pas de matricule : la coquille ne demande pas les pastilles, seul l'assistant parle.
            ref: () => null,
            nomAffichage: () => null,
            typeActeur: () => null,
            // Pas de session réelle : le flux de notifications reste éteint.
            isAuthenticated: () => false,
            logout: () => undefined,
          },
        },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
        {
          provide: AssistantIaService,
          useValue: {
            etat: () => {
              appelsEtat++;
              return of(etat);
            },
            poser: () => EMPTY,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
    return { fixture, hote: fixture.nativeElement as HTMLElement, appelsEtat: () => appelsEtat };
  };

  afterEach(() => TestBed.resetTestingModule());

  it("n'est pas proposé quand l'assistant est inactif côté serveur : ni bouton, ni panneau", () => {
    const { hote } = monter({ actif: false, disponible: false, modele: null, documents: [] });

    expect(hote.querySelector('.topbar-ia')).toBeNull();
    expect(hote.querySelector('app-assistant-ia-panneau')).toBeNull();
  });

  it("actif : le bouton ouvre puis referme le panneau, et chaque ouverture rafraîchit l'état", () => {
    const { fixture, hote, appelsEtat } = monter(ETAT_ACTIF);
    const bouton = hote.querySelector<HTMLButtonElement>('.topbar-ia')!;
    expect(bouton.getAttribute('aria-label')).toBe('Assistant IA');
    expect(bouton.getAttribute('aria-controls')).toBe('assistant-ia');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);
    expect(appelsEtat()).toBe(1);

    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(false);
    expect(appelsEtat()).toBe(2);

    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);
  });

  it('fermé depuis le panneau, le focus revient au bouton qui l’avait ouvert', () => {
    const { fixture, hote } = monter(ETAT_ACTIF);
    const bouton = hote.querySelector<HTMLButtonElement>('.topbar-ia')!;
    bouton.click();
    fixture.detectChanges();

    hote.querySelector<HTMLButtonElement>('.aia__fermer')!.click();
    fixture.detectChanges();

    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);
    expect(document.activeElement).toBe(bouton);
  });
});

describe('Fil d’Ariane de la coquille (proposition 2026-09-22, lot B)', () => {
  const monter = async (url: string) => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'membre/a-faire', component: EcranFactice },
          { path: 'membre/tableau-de-bord', component: EcranFactice, data: { title: 'Tous les dossiers' } },
          { path: 'membre/resultat-examen/pv', component: EcranFactice },
          { path: 'membre/dossier/:id', component: EcranFactice, data: { title: 'Dossier', concentration: true } },
        ]),
        {
          provide: AuthService,
          useValue: {
            role: signal('MEMBRE'),
            login: signal('MEMBANT1'),
            localite: signal('ANT'),
            ref: () => 'MEMBANT1',
            nomAffichage: () => 'RAKOTO Jean',
            typeActeur: () => 'CONTROLEUR',
            isAuthenticated: () => false,
            logout: () => undefined,
          },
        },
        { provide: KpiService, useValue: { badges: () => of({}) } },
        { provide: VacanceStore, useValue: { vacance: signal(false), verifier: () => undefined } },
        { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
        { provide: PermissionsService, useValue: { peutExecuter: () => false } },
        { provide: DelegationsAffichageStore, useValue: { affichees: signal(true), basculer: () => undefined } },
        { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(MainLayout);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    const hote = fixture.nativeElement as HTMLElement;
    const nav = hote.querySelector('.fil-ariane');
    if (!nav) return null;
    // Les blancs entre éléments sont retirés à la compilation : on lit les deux parties, pas le textContent global.
    const t = (sel: string): string => (nav.querySelector(sel)?.textContent ?? '').trim();
    return t('.fil-ariane__accueil') + ' › ' + t('.fil-ariane__ici');
  };

  it('« À faire › Tous les dossiers » depuis data.title ; rien sur l’accueil du profil', async () => {
    expect(await monter('/membre/tableau-de-bord')).toBe('À faire › Tous les dossiers');
    TestBed.resetTestingModule();
    expect(await monter('/membre/a-faire')).toBeNull();
  });

  it('sans data.title, le libellé de l’entrée de menu dont le chemin préfixe l’URL ; jamais en concentration', async () => {
    expect(await monter('/membre/resultat-examen/pv')).toBe('À faire › PV et lettres de renvoi');
    TestBed.resetTestingModule();
    expect(await monter('/membre/dossier/42')).toBeNull();
  });
});
