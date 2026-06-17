import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

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
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('authentifie, persiste la session et expose le profil', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    expect(auth.isAuthenticated()).toBe(false);

    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    const req = http.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(loginResponse);

    expect(auth.token()).toBe('jwt-token');
    expect(auth.role()).toBe('MEMBRE');
    expect(auth.localite()).toBe('ANT');
    expect(auth.ref()).toBe('CTRMEM');
    expect(auth.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    http.verify();
  });

  it('hasRole reflète le profil courant', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    http.expectOne('http://localhost:8080/api/auth/login').flush(loginResponse);

    expect(auth.hasRole('MEMBRE', 'PRESIDENT')).toBe(true);
    expect(auth.hasRole('ADMINISTRATEUR')).toBe(false);
  });

  it('logout efface la session et le stockage', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.authenticate({ login: 'CTRMEM', motDePasse: 'x' }).subscribe();
    http.expectOne('http://localhost:8080/api/auth/login').flush(loginResponse);

    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restaure une session valide depuis le stockage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loginResponse, expiresAt: Date.now() + 60_000 }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('MEMBRE');
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
