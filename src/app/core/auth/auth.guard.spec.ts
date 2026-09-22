import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { Interim } from '../../models';
import { InterimStore } from '../interim/interim.store';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

interface AuthStub {
  authenticated: boolean;
  currentRole: string | null;
}

/** `exerces` : intérims ACTIFS que le connecté exerce (intérim désigné, 21/09) — vide par défaut. */
function setup(stub: AuthStub, exerces: Partial<Interim>[] = []) {
  const auth = {
    isAuthenticated: () => stub.authenticated,
    hasRole: (...roles: string[]) =>
      stub.currentRole !== null && roles.includes(stub.currentRole),
    role: () => stub.currentRole,
    ref: () => 'TEST01',
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: InterimStore, useValue: { assurer: () => of({ exerces, subi: null, aVenir: [] }) } },
    ],
  });
  return TestBed.inject(Router);
}

const resoudre = (r: unknown): Promise<boolean | UrlTree> =>
  r instanceof Observable ? firstValueFrom(r as Observable<boolean | UrlTree>) : Promise.resolve(r as boolean | UrlTree);

const route = (roles?: string[]) =>
  ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;

describe('authGuard', () => {
  it('laisse passer un utilisateur authentifié', () => {
    setup({ authenticated: true, currentRole: 'MEMBRE' });
    const result = TestBed.runInInjectionContext(() =>
      authGuard(route(), state('/membre/pv')),
    );
    expect(result).toBe(true);
  });

  it('redirige vers /login avec returnUrl sinon', () => {
    const router = setup({ authenticated: false, currentRole: null });
    const result = TestBed.runInInjectionContext(() =>
      authGuard(route(), state('/membre/pv')),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/login');
    expect(router.serializeUrl(result as UrlTree)).toContain('returnUrl');
  });
});

describe('authGuard — entrée publique (2026-09-22)', () => {
  it('la racine hors session mène à /accueil/prmp, sans returnUrl', () => {
    const router = setup({ authenticated: false, currentRole: null });
    const result = TestBed.runInInjectionContext(() => authGuard(route(), state('/')));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/accueil/prmp');
  });
});

describe('roleGuard', () => {
  it('autorise si le rôle courant est permis', () => {
    setup({ authenticated: true, currentRole: 'ADMINISTRATEUR' });
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(route(['ADMINISTRATEUR']), state('/admin')),
    );
    expect(result).toBe(true);
  });

  it('autorise si aucun rôle n’est exigé', () => {
    setup({ authenticated: true, currentRole: 'PRMP' });
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(route(), state('/')),
    );
    expect(result).toBe(true);
  });

  it('redirige vers /acces-refuse si le rôle n’est pas permis (et qu’aucun intérim ne l’ouvre)', async () => {
    const router = setup({ authenticated: true, currentRole: 'MEMBRE' });
    const result = await resoudre(TestBed.runInInjectionContext(() => roleGuard(route(['ADMINISTRATEUR']), state('/admin'))));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/acces-refuse');
  });

  it('⚠️ intérim désigné (21/09) : l’espace du titulaire s’ouvre à son intérimaire ACTIF — et à lui seul', async () => {
    const router = setup({ authenticated: true, currentRole: 'MEMBRE' }, [{ profilTitulaire: 'CHEF_COMMISSION' }]);
    // Un Membre qui supplée un CC entre dans /cc…
    expect(await resoudre(TestBed.runInInjectionContext(() => roleGuard(route(['CHEF_COMMISSION']), state('/cc/tableau-de-bord'))))).toBe(true);
    // … mais pas dans /president : il ne supplée pas le Président (non transitif).
    const refus = await resoudre(TestBed.runInInjectionContext(() => roleGuard(route(['PRESIDENT']), state('/president'))));
    expect(refus).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(refus as UrlTree)).toContain('/acces-refuse');
  });
});
