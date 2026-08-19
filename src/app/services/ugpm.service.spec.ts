import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UgpmService } from './comptes.services';

/**
 * `parTutelle` remplace la lecture de la liste COMPLÈTE des UGPM dans le détail d'un PPM.
 *
 * ⚠️ L'enjeu n'est pas cosmétique : `GET /api/ugpms` est réservé à l'ADMINISTRATEUR, si bien que
 * chaque ouverture du modal par une PRMP provoquait un 403 que l'écran devait taire. Le backend
 * (`b264cce`) ouvre `par-tutelle/{idPrmp}` à la PRMP concernée — encore faut-il que le front appelle
 * bien CETTE route, avec l'identifiant échappé. C'est ce que verrouille ce test.
 */
describe('UgpmService.parTutelle', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('interroge la route ciblée « par tutelle », jamais la liste complète', () => {
    const service = TestBed.inject(UgpmService);
    const http = TestBed.inject(HttpTestingController);

    let recues: unknown[] | undefined;
    service.parTutelle('PRMP001').subscribe((r) => (recues = r));

    const req = http.expectOne('/api/ugpms/par-tutelle/PRMP001');
    expect(req.request.method).toBe('GET');
    // La liste complète (réservée à l'Administrateur) ne doit plus être sollicitée.
    http.expectNone('/api/ugpms');

    req.flush([{ idUgpm: 'UGPM010', idPrmpTutelle: 'PRMP001' }]);
    expect(recues).toHaveLength(1);
  });

  it('échappe l’identifiant de tutelle dans l’URL', () => {
    const service = TestBed.inject(UgpmService);
    const http = TestBed.inject(HttpTestingController);

    service.parTutelle('PRMP 001/A').subscribe();
    http.expectOne('/api/ugpms/par-tutelle/PRMP%20001%2FA').flush([]);
  });
});
