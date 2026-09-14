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
