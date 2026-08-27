import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ErrorResponse } from '../../models';
import { ApiError } from '../errors/api-error';
import { ToastService } from '../notifications/toast.service';
import { errorInterceptor } from './error.interceptor';

/**
 * Interception du 409 de **verrou optimiste** (contrat figé dans
 * `backend/docs/plan-conflit-version.md`).
 *
 * ⚠️ L'enjeu : tous les 409 se ressemblent côté HTTP (règle métier, doublon, clé étrangère…) et
 * le front les titrait « Action impossible ». Or celui-ci n'est pas une action interdite — c'est
 * une donnée qui a bougé sous les pieds de l'utilisateur, et la marche à suivre (« Rechargez puis
 * réessayez ») n'a de sens que si le titre l'annonce. Seul le champ `code` les distingue : ces cas
 * verrouillent sa lecture, le titre dédié, et le fait que `code` reste propagé aux écrans — c'est
 * lui qui déclenche le rechargement de la ressource.
 */
describe('errorInterceptor — 409 CONFLIT_VERSION', () => {
  /** Corps renvoyé par le backend, repris mot pour mot du contrat. */
  const corpsConflit: ErrorResponse = {
    timestamp: '2026-08-27T10:15:00',
    status: 409,
    error: 'Conflict',
    message: 'La donnée a été modifiée par une autre opération entre-temps. Rechargez puis réessayez.',
    path: '/api/ppms/12',
    code: 'CONFLIT_VERSION',
  };

  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { error: vi.fn(), success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: toast as unknown as ToastService },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** Joue un PUT et le fait échouer avec le corps donné ; renvoie l'erreur propagée à l'écran. */
  function putEnEchec(corps: ErrorResponse): ApiError | undefined {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    let recue: ApiError | undefined;
    http.put('/api/ppms/12', {}).subscribe({ error: (e: ApiError) => (recue = e) });
    ctrl.expectOne('/api/ppms/12').flush(corps, { status: corps.status, statusText: corps.error });
    return recue;
  }

  it('titre le toast « Donnée modifiée entre-temps » et garde le message du backend', () => {
    putEnEchec(corpsConflit);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(corpsConflit.message, 'Donnée modifiée entre-temps');
  });

  it('propage le code aux écrans, qui rechargent leur ressource', () => {
    const erreur = putEnEchec(corpsConflit);

    expect(erreur?.status).toBe(409);
    expect(erreur?.code).toBe('CONFLIT_VERSION');
  });

  it('laisse les 409 génériques (sans code) au titre « Action impossible »', () => {
    const erreur = putEnEchec({
      timestamp: '2026-08-27T10:15:00',
      status: 409,
      error: 'Conflict',
      message: 'Transition non autorisée dans l’état actuel du dossier.',
      path: '/api/ppms/12',
    });

    expect(erreur?.code).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith('Transition non autorisée dans l’état actuel du dossier.', 'Action impossible');
  });

  it('ne toaste toujours pas un 400 porteur d’erreurs de champ (laissé au formulaire)', () => {
    const erreur = putEnEchec({
      timestamp: '2026-08-27T10:15:00',
      status: 400,
      error: 'Bad Request',
      message: 'Validation échouée.',
      path: '/api/ppms/12',
      erreurs: [{ champ: 'exercice', message: 'Obligatoire.' }],
    });

    expect(erreur?.fieldErrors).toEqual({ exercice: 'Obligatoire.' });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
