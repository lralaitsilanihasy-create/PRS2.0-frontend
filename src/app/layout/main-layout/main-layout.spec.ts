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
import { BadgesMenu } from '../../models';
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
    expect(banniere.children.length).toBe(1);
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
  });
});
