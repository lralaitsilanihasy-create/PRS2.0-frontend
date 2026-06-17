import { runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

interface AuthStub {
  authenticated: boolean;
  currentRole: string | null;
}

function setup(stub: AuthStub) {
  const auth = {
    isAuthenticated: () => stub.authenticated,
    hasRole: (...roles: string[]) =>
      stub.currentRole !== null && roles.includes(stub.currentRole),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  return TestBed.inject(Router);
}

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

  it('redirige vers /acces-refuse si le rôle n’est pas permis', () => {
    const router = setup({ authenticated: true, currentRole: 'MEMBRE' });
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(route(['ADMINISTRATEUR']), state('/admin')),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toContain('/acces-refuse');
  });
});
