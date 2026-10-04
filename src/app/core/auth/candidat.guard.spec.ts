import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { InterimStore } from '../interim/interim.store';
import { authGuard, candidatConnecteGuard, candidatHorsSessionGuard, espaceCandidatGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

/**
 * ⚠️ Soumission en ligne, lot 1 (04/10) — le CANDIDAT et la coquille interne ne se croisent jamais : il est renvoyé
 * vers `/candidat` partout ailleurs, et les agents sont renvoyés chez eux depuis `/candidat`. Un appel à
 * `InterimStore.assurer` pour un candidat serait un 403 serveur suivi d'un dialogue : le test le compte.
 */
function setup(authenticated: boolean, role: string | null): { router: Router; appelsInterim: () => number } {
  let appels = 0;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: () => authenticated,
          role: () => role,
          hasRole: (...roles: string[]) => role !== null && roles.includes(role),
        },
      },
      {
        provide: InterimStore,
        useValue: {
          assurer: () => {
            appels++;
            throw new Error('assurer() ne doit pas être appelé pour un candidat');
          },
        },
      },
    ],
  });
  return { router: TestBed.inject(Router), appelsInterim: () => appels };
}

const route = (roles?: string[]) => ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;
const chemin = (r: unknown): string => (r as UrlTree).toString();

describe('Candidat — gardes (soumission en ligne, lot 1)', () => {
  it('authGuard : un candidat qui vise la coquille interne est renvoyé vers /candidat', () => {
    setup(true, 'CANDIDAT');
    const r = TestBed.runInInjectionContext(() => authGuard(route(), state('/notifications')));
    expect(chemin(r)).toBe('/candidat');
  });

  it('authGuard : un candidat passe sous /candidat ; un agent passe partout', () => {
    setup(true, 'CANDIDAT');
    expect(TestBed.runInInjectionContext(() => authGuard(route(), state('/candidat/entreprise')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'PRMP');
    expect(TestBed.runInInjectionContext(() => authGuard(route(), state('/prmp/dao')))).toBe(true);
  });

  it('roleGuard : un candidat sur un espace interne est refusé vers /candidat, SANS appel aux intérims', () => {
    const { appelsInterim } = setup(true, 'CANDIDAT');
    const r = TestBed.runInInjectionContext(() => roleGuard(route(['PRMP', 'UGPM']), state('/prmp')));
    expect(chemin(r)).toBe('/candidat');
    expect(appelsInterim()).toBe(0);
  });

  it('espaceCandidatGuard : visiteur et candidat passent, un agent connecté est renvoyé à la racine', () => {
    setup(false, null);
    expect(TestBed.runInInjectionContext(() => espaceCandidatGuard(route(), state('/candidat/procedures')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'CANDIDAT');
    expect(TestBed.runInInjectionContext(() => espaceCandidatGuard(route(), state('/candidat/procedures')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'ADMINISTRATEUR');
    expect(chemin(TestBed.runInInjectionContext(() => espaceCandidatGuard(route(), state('/candidat/procedures'))))).toBe('/');
  });

  it('candidatConnecteGuard : sans session, connexion avec retour à l’écran demandé', () => {
    setup(false, null);
    const r = TestBed.runInInjectionContext(() => candidatConnecteGuard(route(), state('/candidat/entreprise')));
    expect(chemin(r)).toBe('/login?returnUrl=%2Fcandidat%2Fentreprise');
    TestBed.resetTestingModule();
    setup(true, 'CANDIDAT');
    expect(TestBed.runInInjectionContext(() => candidatConnecteGuard(route(), state('/candidat/entreprise')))).toBe(true);
  });

  it('candidatHorsSessionGuard : un candidat connecté ne revoit ni l’inscription ni la confirmation', () => {
    setup(true, 'CANDIDAT');
    expect(chemin(TestBed.runInInjectionContext(() => candidatHorsSessionGuard(route(), state('/candidat/inscription'))))).toBe('/candidat');
    TestBed.resetTestingModule();
    setup(false, null);
    expect(TestBed.runInInjectionContext(() => candidatHorsSessionGuard(route(), state('/candidat/inscription')))).toBe(true);
  });
});
