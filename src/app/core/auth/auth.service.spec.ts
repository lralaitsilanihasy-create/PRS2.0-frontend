import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LoginResponse } from '../../models';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'cnm.session';

const loginResponse: LoginResponse = {
  token: 'jwt-token',
  login: 'CTRMEM',
  role: 'MEMBRE',
  typeActeur: 'CONTROLEUR',
  ref: 'CTRMEM',
  localite: 'ANT',
  expiresIn: 3600,
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      // provideRouter : AuthService injecte Router pour rediriger à l'expiration.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('authentifie, persiste la session et expose le profil', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    expect(auth.isAuthenticated()).toBe(false);

    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(loginResponse);

    expect(auth.role()).toBe('MEMBRE');
    expect(auth.localite()).toBe('ANT');
    expect(auth.ref()).toBe('CTRMEM');
    expect(auth.isAuthenticated()).toBe(true);
    // ⚠️ Phase 2 du plan cookie : le jeton n'est JAMAIS persisté — seul le profil l'est.
    const stocke = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
    expect('token' in stocke).toBe(false);
    expect(stocke['role']).toBe('MEMBRE');

    http.verify();
  });

  it('hasRole reflète le profil courant', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(loginResponse);

    expect(auth.hasRole('MEMBRE', 'PRESIDENT')).toBe(true);
    expect(auth.hasRole('ADMINISTRATEUR')).toBe(false);
  });

  it('logout efface la session, le stockage, et demande au serveur de vider le cookie', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    http.expectOne('/api/auth/login').flush(loginResponse);

    auth.logout();
    // ⚠️ Phase 2 : un cookie HttpOnly n'est pas supprimable par le JS — le serveur le vide.
    http.expectOne('/api/auth/logout').flush(null);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restaure une session valide depuis le stockage et purge le jeton hérité (avant phase 2)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loginResponse, expiresAt: Date.now() + 60_000 }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('MEMBRE');
    // Le jeton d'une session antérieure à la phase 2 est éliminé du stockage à la restauration.
    const stocke = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
    expect('token' in stocke).toBe(false);
  });

  it('ignore et purge une session expirée', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loginResponse, expiresAt: Date.now() - 1_000 }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
