import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, Routes, provideRouter } from '@angular/router';
import { EMPTY, Subject, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { VacanceStore } from '../../core/vacance/vacance.store';
import { InterimStore } from '../../core/interim/interim.store';
import { ActualiteService } from '../../services/actualite.services';
import { KpiService } from '../../services';
import { BadgesMenu, Role, RoleInterne } from '../../models';
import { NAV_BY_ROLE } from '../../core/navigation/navigation';
import { AssistantIaService } from '../../services/assistant-ia.services';
import { EtatAssistantIa } from '../../models/assistant-ia.model';
import { ENTREES_A_PLAT_MAX } from '../../core/navigation/barre-menu';
import { MainLayout, routeEnConcentration } from './main-layout';
import { DossiersRefreshStore } from '../../features/prmp/dossiers-refresh.store';

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

interface Options {
  role?: Role | null;
  login?: string | null;
  routes?: Routes;
  /** Matricule : sans lui, la coquille ne demande pas les pastilles du menu. */
  ref?: string | null;
  vacance?: boolean;
  delegation?: boolean;
  badges?: BadgesMenu;
  assistant?: EtatAssistantIa;
}

/** Monte la coquille d'un profil, avec ses services doublés ; navigue sur `url` si elle est donnée. */
async function monter(o: Options = {}, url?: string) {
  const providers: unknown[] = [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter(o.routes ?? []),
    {
      provide: AuthService,
      useValue: {
        role: signal(o.role ?? null),
        login: signal(o.login ?? null),
        localite: signal('ANT'),
        ref: () => o.ref ?? null,
        nomAffichage: () => (o.ref ? 'RAKOTO Jean' : null),
        typeActeur: () => 'CONTROLEUR',
        // Pas de session réelle : le flux de notifications reste éteint.
        isAuthenticated: () => false,
        logout: () => undefined,
      },
    },
    { provide: VacanceStore, useValue: { vacance: signal(o.vacance ?? false), verifier: () => undefined } },
    { provide: InterimStore, useValue: { exerces: signal([]), subi: signal(null), aVenir: signal([]), verifier: () => undefined } },
    { provide: PermissionsService, useValue: { peutExecuter: () => o.delegation ?? false } },
    { provide: ActualiteService, useValue: { mesActualites: () => of([]) } },
  ];
  if (o.badges) providers.push({ provide: KpiService, useValue: { badges: () => of(o.badges) } });
  if (o.assistant) {
    const etat = o.assistant;
    providers.push({ provide: AssistantIaService, useValue: { etat: () => of(etat), poser: () => EMPTY } });
  }
  TestBed.configureTestingModule({ imports: [MainLayout], providers: providers as never[] });
  const fixture = TestBed.createComponent(MainLayout);
  if (url) await TestBed.inject(Router).navigateByUrl(url);
  fixture.detectChanges();
  return { fixture, hote: fixture.nativeElement as HTMLElement };
}

const texte = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
/** Libellés de la barre du menu, dans l'ordre de lecture (liens directs et rubriques). */
const barre = (hote: HTMLElement) => Array.from(hote.querySelectorAll('.menu__liste > li > .nav-item .nav-label')).map(texte);

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

  it("range le menu derrière « Menu » sur l'examen, et le rend ailleurs (30/10 : barre horizontale)", async () => {
    const { fixture, hote } = await monter(
      {
        role: 'MEMBRE',
        login: 'MEMANT1',
        routes: [
          { path: 'membre/examiner/:idDossier', component: EcranFactice, data: { title: 'Examiner', concentration: true } },
          { path: 'membre/tableau-de-bord', component: EcranFactice, data: { title: 'Dossiers' } },
        ],
      },
      '/membre/examiner/42',
    );
    const router = TestBed.inject(Router);
    expect(hote.classList.contains('layout--concentration')).toBe(true);
    // Le menu reste accessible : le bouton « Menu » l'ouvre.
    const bouton = hote.querySelector('.menu__bascule') as HTMLButtonElement;
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    bouton.click();
    fixture.detectChanges();
    expect(hote.querySelector('.menu')?.classList.contains('menu--ouvert')).toBe(true);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');

    await router.navigateByUrl('/membre/tableau-de-bord');
    fixture.detectChanges();
    expect(hote.classList.contains('layout--concentration')).toBe(false);
    // La navigation referme le menu.
    expect(hote.querySelector('.menu')?.classList.contains('menu--ouvert')).toBe(false);
  });
});

describe('Pastille « À faire » du menu (refonte ergonomique, 2026-09-15)', () => {
  const entreeAFaire = async (badges: BadgesMenu) => {
    const { hote } = await monter(
      { role: 'MEMBRE', login: 'MEMBANT1', ref: 'MEMBANT1', badges, routes: [{ path: 'membre/a-faire', component: EcranFactice }] },
      '/membre/a-faire',
    );
    return Array.from(hote.querySelectorAll('a.nav-item')).find((a) => a.textContent?.includes('À faire')) as HTMLElement;
  };

  it('affiche badges.aFaire sur « À faire », en tête du menu', async () => {
    const entree = await entreeAFaire({ profil: 'MEMBRE', compteurs: { aExaminer: 2 }, aFaire: 5 });
    expect(entree.getAttribute('href')).toBe('/membre/a-faire');
    expect(entree.querySelector('.nav-badge')?.textContent?.trim()).toBe('5');
  });

  it('⚠️ 30/10 — un seul appel des compteurs au démarrage ; un geste signalé pendant l’appel relit à son terme', async () => {
    const reponses: Subject<BadgesMenu>[] = [];
    TestBed.overrideProvider(KpiService, { useValue: { badges: () => { const r = new Subject<BadgesMenu>(); reponses.push(r); return r; } } });
    await entreeAFaire({ profil: 'MEMBRE', compteurs: {} });
    // Le constructeur et la première fin de navigation : une seule demande.
    expect(reponses.length).toBe(1);
    TestBed.inject(DossiersRefreshStore).notifierChangement();
    TestBed.tick();
    expect(reponses.length).toBe(1);
    reponses[0].next({ profil: 'MEMBRE', compteurs: {}, aFaire: 1 });
    reponses[0].complete();
    expect(reponses.length).toBe(2);
  });

  it('pas de pastille quand le champ est absent (backend qui ne le sert pas), nul ou à zéro', async () => {
    expect((await entreeAFaire({ profil: 'MEMBRE', compteurs: { aExaminer: 2 } })).querySelector('.nav-badge')).toBeNull();
    TestBed.resetTestingModule();
    expect((await entreeAFaire({ profil: 'MEMBRE', compteurs: {}, aFaire: null })).querySelector('.nav-badge')).toBeNull();
    TestBed.resetTestingModule();
    expect((await entreeAFaire({ profil: 'MEMBRE', compteurs: {}, aFaire: 0 })).querySelector('.nav-badge')).toBeNull();
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
    const { hote } = await monter(
      { role: 'PRMP', login: 'PRMP001', vacance: true, routes: [{ path: 'prmp/tableau-de-bord', component: EcranFactice }] },
      '/prmp/tableau-de-bord',
    );
    const banniere = hote.querySelector('.alert.vacance-banniere') as HTMLElement;
    expect(banniere).not.toBeNull();
    expect(enfantsDirectsMixtes(banniere)).toBe(false);
    // L'icône est un FRÈRE du span, jamais dedans : deux enfants, pas un de plus.
    expect(Array.from(banniere.children).map((e) => e.tagName.toLowerCase())).toEqual(['app-icone', 'span']);
    expect(banniere.querySelectorAll('span').length).toBe(1);
    expect(banniere.querySelector('app-icone svg')).not.toBeNull();
    expect(banniere.querySelector('span > strong')?.textContent).toBe('En attente de nomination de la nouvelle PRMP');
  });
});

describe('Coquille institutionnelle (design du 30/10/2026)', () => {
  it('bandeau tricolore, en-tête (logo, institution, application), menu, contenu, pied de page — dans cet ordre', async () => {
    const { hote } = await monter({ role: 'PRESIDENT', login: 'PRESID1', routes: [{ path: 'president/a-faire', component: EcranFactice }] }, '/president/a-faire');
    const ordre = Array.from(hote.children)
      .map((e) => e.className.split(' ')[0])
      .filter((c) => ['bandeau-tricolore', 'entete', 'menu', 'page-content', 'pied-page'].includes(c));
    expect(ordre).toEqual(['bandeau-tricolore', 'entete', 'menu', 'page-content', 'pied-page']);
    expect(hote.querySelectorAll('.bandeau-tricolore > span').length).toBe(3);
    expect(hote.querySelector('.bandeau-tricolore')?.getAttribute('aria-hidden')).toBe('true');
    const logo = hote.querySelector('.entete__logo') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('mef-logo.png');
    expect(logo.getAttribute('alt')).toBe('');
    expect(texte(hote.querySelector('.entete__institution'))).toBe('Commission nationale des marchés');
    expect(texte(hote.querySelector('.entete__appli'))).toBe('PRS 2.0');
    expect(texte(hote.querySelector('.pied-page'))).toBe('Commission nationale des marchés · Ministère de l\'Économie et des Finances · PRS 2.0');
    // Profil en français dans la pastille de l'en-tête — la classe garde le code.
    const pastille = hote.querySelector('.entete__utilisateur .profile-badge') as HTMLElement;
    expect(pastille.textContent?.trim()).toBe('Président');
    expect(pastille.classList).toContain('PRESIDENT');
  });

  it('le bouton « Menu » porte l’icône, son libellé et son état', async () => {
    const { hote } = await monter({ role: 'PRESIDENT', login: 'PRESID1' });
    const bouton = hote.querySelector('.menu__bascule') as HTMLButtonElement;
    expect(texte(bouton)).toBe('Menu');
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(bouton.getAttribute('aria-controls')).toBe('menu-principal');
    expect(bouton.querySelector('app-icone svg')).not.toBeNull();
  });

  it('la PRMP garde « Créer compte UGPM » (naguère au pied de la barre latérale), dans l’en-tête', async () => {
    const { hote } = await monter({ role: 'PRMP', login: 'PRMP001' });
    expect(hote.querySelector('.entete a[href="/prmp/creer-ugpm"]')?.textContent?.trim()).toBe('Créer compte UGPM');
  });
});

/**
 * ⚠️ Lot 5, F5 (2026-09-16) — la coquille ne porte AUCUN caractère tenant lieu d'icône : ni emoji, ni glyphe technique
 * détourné (« ☰ », « › », « ⤴ », « ✕ », « ⏸ »). Tout passe par `app-icone`. Le balayage porte sur le DOM RENDU.
 * La ponctuation française — guillemets « », tiret cadratin, points de suspension — n'en fait volontairement pas partie.
 */
const GLYPHES_INTERDITS = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿⤀-⥿⬀-⯿‹›]/u;

describe('Coquille sans glyphe (refonte ergonomique, lot 5 — F5)', () => {
  it('en-tête, menu (rubriques ouvertes comprises) et bannière de vacance : aucun glyphe tenant lieu d’icône', async () => {
    for (const [role, login, url, vacance] of [
      ['PRESIDENT', 'PRESID1', '/president/a-faire', false],
      ['PRMP', 'PRMP001', '/prmp/tableau-de-bord', true],
    ] as const) {
      TestBed.resetTestingModule();
      const { fixture, hote } = await monter(
        { role, login, vacance, delegation: true, routes: [{ path: 'president/a-faire', component: EcranFactice }, { path: 'prmp/tableau-de-bord', component: EcranFactice }] },
        url,
      );
      const lire = () => Array.from(hote.querySelectorAll('.entete, .menu, .vacance-banniere')).map((el) => el.textContent ?? '').join(' ');
      let vu = lire();
      for (const b of Array.from(hote.querySelectorAll<HTMLButtonElement>('.nav-rubrique'))) {
        b.click();
        fixture.detectChanges();
        vu += lire();
      }
      const fautifs = [...vu].filter((c) => GLYPHES_INTERDITS.test(c));
      expect(fautifs, `${role} : ${fautifs.join(' ')}`).toEqual([]);
    }
  });
});

describe('Entrée active du menu (lot 5 F3 ; 30/10 : sous-pages et retour)', () => {
  const ROUTES: Routes = [
    { path: 'membre/a-faire', component: EcranFactice },
    { path: 'membre/tableau-de-bord', component: EcranFactice },
    { path: 'membre/resultat-examen', component: EcranFactice },
    { path: 'membre/resultat-examen/pv', component: EcranFactice },
    { path: 'membre/dossier/:id', component: EcranFactice },
    { path: 'notifications', component: EcranFactice },
  ];
  const courantes = async (url: string) => {
    TestBed.resetTestingModule();
    const { hote } = await monter({ role: 'MEMBRE', login: 'MEMBANT1', routes: ROUTES }, url);
    return Array.from(hote.querySelectorAll('[aria-current="page"]'));
  };

  it('pose aria-current="page" et la classe active sur l’entrée courante, et sur elle seule', async () => {
    for (const url of ['/membre/tableau-de-bord', '/membre/a-faire', '/notifications']) {
      const c = await courantes(url);
      expect(c.length, url).toBe(1);
      expect(c[0].getAttribute('href'), url).toBe(url);
      expect(c[0].classList, url).toContain('active');
    }
  });

  it('l’entrée reste active sur ses sous-pages', async () => {
    const c = await courantes('/membre/resultat-examen/pv');
    expect(c.map((a) => a.getAttribute('href'))).toEqual(['/membre/resultat-examen']);
  });

  it('une page ouverte depuis une liste (`returnUrl`) garde active l’entrée d’où l’on vient', async () => {
    const c = await courantes('/membre/dossier/42?returnUrl=%2Fmembre%2Ftableau-de-bord');
    expect(c.map((a) => a.getAttribute('href'))).toEqual(['/membre/tableau-de-bord']);
  });
});

/**
 * ⚠️ 30/10/2026 (design institutionnel, Q1) — les RUBRIQUES de `groupes-menu.ts` deviennent les menus déroulants de la
 * barre horizontale. Le classement est testé dans `groupes-menu.spec.ts` ; ce bloc vérifie la BARRE : ce qui est direct,
 * ce qui se déroule, et que rien n'est perdu, ajouté ni doublé.
 */
describe('Menu horizontal par rubriques (design institutionnel, 30/10/2026)', () => {
  it('Président : À faire et Tous les dossiers en direct, puis Décisions, Pilotage, Exercé par délégation, et Notifications à droite', async () => {
    const { hote } = await monter({ role: 'PRESIDENT', login: 'PRESID1', delegation: true });
    expect(barre(hote)).toEqual(['À faire', 'Tous les dossiers', 'Décisions', 'Pilotage', 'Exercé par délégation', 'Notifications']);
    expect(hote.querySelector('.menu__liste > li:last-child')?.classList).toContain('menu__entree--pied');
  });

  it('PRMP : À faire, Mon travail, Décisions, puis Calendrier en direct (rubrique d’une seule entrée)', async () => {
    const { hote } = await monter({ role: 'PRMP', login: 'PRMP001' });
    expect(barre(hote)).toEqual(['À faire', 'Mon travail', 'Décisions', 'Calendrier', 'Notifications']);
  });

  it('Administrateur : son accueil en direct, Accès, Règles du contrôle, Nomenclatures en direct, Traces', async () => {
    const { hote } = await monter({ role: 'ADMINISTRATEUR', login: 'ADMIN01' });
    expect(barre(hote)).toEqual(['Poste d’administration', 'Accès', 'Règles du contrôle', 'Nomenclatures', 'Traces', 'Notifications']);
  });

  it(`un menu de ${ENTREES_A_PLAT_MAX} entrées ou moins reste à plat : aucun déroulant`, async () => {
    for (const [role, login] of [['SECRETAIRE', 'SECANT1'], ['MEMBRE', 'MEMANT1'], ['VERIFICATEUR', 'VERANT1'], ['CHARGE_PUBLICATION', 'CTRPUB1']] as const) {
      TestBed.resetTestingModule();
      const { hote } = await monter({ role, login });
      expect(hote.querySelectorAll('.nav-rubrique').length, role).toBe(0);
      expect(barre(hote), role).toEqual(NAV_BY_ROLE[role].map((i) => i.label));
    }
  });

  it('ne perd, n’ajoute et ne double aucune entrée, sur les dix menus', async () => {
    for (const role of Object.keys(NAV_BY_ROLE) as RoleInterne[]) {
      TestBed.resetTestingModule();
      const { fixture } = await monter({ role, login: 'TEST001', delegation: true });
      const c = fixture.componentInstance;
      const rendus = [...c.barre().flatMap((e) => e.items), ...c.navPied()].map((i) => i.path);
      expect(new Set(rendus).size, `${role} : doublon dans la barre`).toBe(rendus.length);
      expect([...rendus].sort(), role).toEqual([...NAV_BY_ROLE[role].map((i) => i.path)].sort());
    }
  });

  it('une rubrique s’ouvre au clic (titre en bandeau, ses entrées), se referme par Échap en rendant le focus, ou par un clic ailleurs', async () => {
    const { fixture, hote } = await monter({ role: 'PRESIDENT', login: 'PRESID1', delegation: true });
    const bouton = Array.from(hote.querySelectorAll<HTMLButtonElement>('.nav-rubrique')).find((b) => texte(b).startsWith('Pilotage'))!;
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(hote.querySelector('.menu__deroulant')).toBeNull();

    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    const panneau = hote.querySelector('.menu__deroulant') as HTMLElement;
    expect(panneau.id).toBe(bouton.getAttribute('aria-controls'));
    expect(texte(panneau.querySelector('.menu__deroulant-titre'))).toBe('Pilotage');
    expect(Array.from(panneau.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([
      '/president/repartition-dispatch',
      '/president/chaines-controle',
      '/president/interim',
    ]);

    panneau.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(hote.querySelector('.menu__deroulant')).toBeNull();
    expect(document.activeElement).toBe(bouton);

    bouton.click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(hote.querySelector('.menu__deroulant')).toBeNull();
  });

  it('la rubrique déléguée porte sa marque, et ses entrées la mention de délégation en infobulle', async () => {
    const { fixture, hote } = await monter({ role: 'PRESIDENT', login: 'PRESID1', delegation: true });
    const bouton = Array.from(hote.querySelectorAll<HTMLButtonElement>('.nav-rubrique')).find((b) => texte(b).startsWith('Exercé par délégation'))!;
    expect(bouton.querySelector('app-icone.nav-deleg svg')).not.toBeNull();
    bouton.click();
    fixture.detectChanges();
    const liens = Array.from(hote.querySelectorAll('.menu__deroulant a'));
    expect(liens.length).toBe(2);
    expect(liens.every((a) => a.querySelector('app-icone.nav-deleg'))).toBe(true);
    expect(liens[0].getAttribute('title')).toMatch(/^Tâche du profil (Contrôleur vérificateur|Assistant contrôleur) — /);
  });

  it('une rubrique fermée porte la SOMME des pastilles de ses entrées ; elle est active quand une de ses pages l’est', async () => {
    const { hote } = await monter(
      {
        role: 'PRMP',
        login: 'PRMP001',
        ref: 'PRMP001',
        badges: { profil: 'PRMP', compteurs: { recusAValider: 2, reconductionsADecider: 1, lettresRenvoi: 4 } },
        routes: [{ path: 'prmp/recus', component: EcranFactice }],
      },
      '/prmp/recus',
    );
    const rubrique = (t: string) => Array.from(hote.querySelectorAll<HTMLButtonElement>('.nav-rubrique')).find((b) => texte(b).startsWith(t))!;
    expect(texte(rubrique('Mon travail').querySelector('.nav-badge'))).toBe('3');
    expect(texte(rubrique('Décisions').querySelector('.nav-badge'))).toBe('4');
    expect(rubrique('Mon travail').classList).toContain('active');
    expect(rubrique('Décisions').classList).not.toContain('active');
  });
});

describe('Bouton « Assistant IA » de l’en-tête (lot 1, 2026-09-18)', () => {
  const ETAT_ACTIF: EtatAssistantIa = {
    actif: true,
    disponible: true,
    modele: 'qwen3.5:9b-q4_K_M',
    documents: [{ libelle: 'Manuel de contrôle a priori (CNM, février 2026)', passages: 135 }],
  };

  const monterAssistant = async (etat: EtatAssistantIa) => {
    let appelsEtat = 0;
    const { fixture, hote } = await monter({ role: 'MEMBRE', login: 'CTRMEM', assistant: etat });
    TestBed.inject(AssistantIaService).etat = () => {
      appelsEtat++;
      return of(etat);
    };
    return { fixture, hote, appelsEtat: () => appelsEtat };
  };
  const boutonIa = (hote: HTMLElement) => hote.querySelector<HTMLButtonElement>('button[aria-controls="assistant-ia"]');

  afterEach(() => TestBed.resetTestingModule());

  it("n'est pas proposé quand l'assistant est inactif côté serveur : ni bouton, ni panneau", async () => {
    const { hote } = await monterAssistant({ actif: false, disponible: false, modele: null, documents: [] });
    expect(boutonIa(hote)).toBeNull();
    expect(hote.querySelector('app-assistant-ia-panneau')).toBeNull();
  });

  it("actif : le bouton ouvre puis referme le panneau, et chaque ouverture rafraîchit l'état", async () => {
    const { fixture, hote, appelsEtat } = await monterAssistant(ETAT_ACTIF);
    const bouton = boutonIa(hote)!;
    expect(bouton.getAttribute('aria-label')).toBe('Assistant IA');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);

    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(false);
    expect(appelsEtat()).toBe(1);

    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);
  });

  it('fermé depuis le panneau, le focus revient au bouton qui l’avait ouvert', async () => {
    const { fixture, hote } = await monterAssistant(ETAT_ACTIF);
    const bouton = boutonIa(hote)!;
    bouton.click();
    fixture.detectChanges();
    hote.querySelector<HTMLButtonElement>('.aia__fermer')!.click();
    fixture.detectChanges();
    expect(hote.querySelector<HTMLElement>('#assistant-ia')?.hidden).toBe(true);
    expect(document.activeElement).toBe(bouton);
  });
});

describe('Fil d’Ariane de la coquille (proposition 2026-09-22, lot B)', () => {
  const fil = async (url: string) => {
    TestBed.resetTestingModule();
    const { hote } = await monter(
      {
        role: 'MEMBRE',
        login: 'MEMBANT1',
        ref: 'MEMBANT1',
        // 09/10 — une réponse de forme réelle : `{}` sans `compteurs` faisait lever « reading 'aExaminer' ».
        badges: { profil: 'MEMBRE', compteurs: {} },
        routes: [
          { path: 'membre/a-faire', component: EcranFactice },
          { path: 'membre/tableau-de-bord', component: EcranFactice, data: { title: 'Tous les dossiers' } },
          { path: 'membre/resultat-examen/pv', component: EcranFactice },
          { path: 'membre/dossier/:id', component: EcranFactice, data: { title: 'Dossier', concentration: true } },
        ],
      },
      url,
    );
    const nav = hote.querySelector('.fil-ariane');
    if (!nav) return null;
    return texte(nav.querySelector('.fil-ariane__lien')) + ' › ' + texte(nav.querySelector('.fil-ariane__ici'));
  };

  it('« À faire › Tous les dossiers » depuis data.title ; rien sur l’accueil du profil', async () => {
    expect(await fil('/membre/tableau-de-bord')).toBe('À faire › Tous les dossiers');
    expect(await fil('/membre/a-faire')).toBeNull();
  });

  it('sans data.title, le libellé de l’entrée de menu dont le chemin préfixe l’URL ; jamais en concentration', async () => {
    expect(await fil('/membre/resultat-examen/pv')).toBe('À faire › PV et lettres de renvoi');
    expect(await fil('/membre/dossier/42')).toBeNull();
  });
});
