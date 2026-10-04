import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { InterimStore } from '../interim/interim.store';
import { authGuard, espaceExterneDe, espaceExterneGuard, externeConnecteGuard, externeHorsSessionGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

/**
 * ⚠️ Soumission en ligne (04/10) — les profils EXTERNES (candidat, membre de CAO) et la coquille interne ne se croisent
 * jamais : chacun est renvoyé vers son espace partout ailleurs, et les agents sont renvoyés chez eux depuis ces espaces.
 * Un appel à `InterimStore.assurer` pour un externe serait un 403 serveur suivi d'un dialogue : le test le compte.
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
            throw new Error('assurer() ne doit pas être appelé pour un profil externe');
          },
        },
      },
    ],
  });
  return { router: TestBed.inject(Router), appelsInterim: () => appels };
}

const route = (data: Record<string, unknown> = {}) => ({ data }) as unknown as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;
const chemin = (r: unknown): string => (r as UrlTree).toString();

describe('Profils externes — gardes (soumission en ligne, lots 1 et 2a)', () => {
  it('espaceExterneDe : /candidat, /cao, rien pour un agent', () => {
    expect(espaceExterneDe('CANDIDAT')).toBe('/candidat');
    expect(espaceExterneDe('MEMBRE_CAO')).toBe('/cao');
    expect(espaceExterneDe('PRMP')).toBeNull();
    expect(espaceExterneDe(null)).toBeNull();
  });

  it('authGuard : un candidat qui vise la coquille interne est renvoyé vers /candidat, un membre de CAO vers /cao', () => {
    setup(true, 'CANDIDAT');
    expect(chemin(TestBed.runInInjectionContext(() => authGuard(route(), state('/notifications'))))).toBe('/candidat');
    TestBed.resetTestingModule();
    setup(true, 'MEMBRE_CAO');
    expect(chemin(TestBed.runInInjectionContext(() => authGuard(route(), state('/prmp/dao'))))).toBe('/cao');
  });

  it('authGuard : un externe passe dans son espace ; un agent passe partout', () => {
    setup(true, 'CANDIDAT');
    expect(TestBed.runInInjectionContext(() => authGuard(route(), state('/candidat/entreprise')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'PRMP');
    expect(TestBed.runInInjectionContext(() => authGuard(route(), state('/prmp/dao')))).toBe(true);
  });

  it('roleGuard : un externe sur un espace interne est refusé vers son espace, SANS appel aux intérims', () => {
    const { appelsInterim } = setup(true, 'MEMBRE_CAO');
    const r = TestBed.runInInjectionContext(() => roleGuard(route({ roles: ['PRMP', 'UGPM'] }), state('/prmp')));
    expect(chemin(r)).toBe('/cao');
    expect(appelsInterim()).toBe(0);
  });

  it('espaceExterneGuard : visiteur et profil attendu passent ; un agent est renvoyé à la racine ; un autre externe, chez lui', () => {
    setup(false, null);
    expect(TestBed.runInInjectionContext(() => espaceExterneGuard(route({ role: 'CANDIDAT' }), state('/candidat/procedures')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'CANDIDAT');
    expect(TestBed.runInInjectionContext(() => espaceExterneGuard(route({ role: 'CANDIDAT' }), state('/candidat/procedures')))).toBe(true);
    TestBed.resetTestingModule();
    setup(true, 'ADMINISTRATEUR');
    expect(chemin(TestBed.runInInjectionContext(() => espaceExterneGuard(route({ role: 'CANDIDAT' }), state('/candidat/procedures'))))).toBe('/');
    TestBed.resetTestingModule();
    setup(true, 'CANDIDAT');
    expect(chemin(TestBed.runInInjectionContext(() => espaceExterneGuard(route({ role: 'MEMBRE_CAO' }), state('/cao/mes-procedures'))))).toBe('/candidat');
  });

  it('externeConnecteGuard : sans session, connexion avec retour à l’écran demandé', () => {
    setup(false, null);
    expect(chemin(TestBed.runInInjectionContext(() => externeConnecteGuard(route(), state('/cao/mes-procedures'))))).toBe('/login?returnUrl=%2Fcao%2Fmes-procedures');
    TestBed.resetTestingModule();
    setup(true, 'MEMBRE_CAO');
    expect(TestBed.runInInjectionContext(() => externeConnecteGuard(route(), state('/cao/mes-procedures')))).toBe(true);
  });

  it('externeHorsSessionGuard : un externe connecté ne revoit ni l’inscription ni l’activation, il retrouve son espace', () => {
    setup(true, 'MEMBRE_CAO');
    expect(chemin(TestBed.runInInjectionContext(() => externeHorsSessionGuard(route(), state('/cao/activation'))))).toBe('/cao');
    TestBed.resetTestingModule();
    setup(false, null);
    expect(TestBed.runInInjectionContext(() => externeHorsSessionGuard(route(), state('/cao/activation')))).toBe(true);
  });
});
