import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { Depots } from '../../models';
import { DepotsDao } from './depots-dao';

// ⚠️ R9b (V112, 14/10, art. 44) — le registre des dépôts porte les tentatives refusées hors délai, horodatées par le serveur.
describe('Registre des dépôts — tentatives refusées (R9b)', () => {
  let http: HttpTestingController;

  function monter(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDmc: '40' }) } } }],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DepotsDao);
    f.detectChanges();
    const charge = (r: Depots): HTMLElement => {
      http.match((req) => req.url !== '/api/fiches-marche/40/depots').forEach((r2) => r2.flush(null));
      http.expectOne('/api/fiches-marche/40/depots').flush(r);
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    };
    return charge({
      clos: true, nombre: 1, dateLimite: '2026-10-14T10:00:00', depots: [],
      tentativesRefusees: [
        { horodatage: '2026-10-14T10:00:03.412', geste: 'SCELLEMENT', motif: 'DELAI_DEPASSE', entreprise: 'Entreprise Tardive', nif: '4000000009', lot: 1, enveloppe: null, idOffre: 'o-9', dateLimite: '2026-10-14T10:00:00' },
        { horodatage: '2026-10-14T10:05:00', geste: 'CREATION', motif: 'DELAI_DEPASSE', entreprise: null, nif: null, lot: null, enveloppe: null, idOffre: null, dateLimite: '2026-10-14T10:00:00' },
      ],
    });
  }

  afterEach(() => http.verify());

  it('les liste à la seconde, avec le geste refusé ; un candidat sans entreprise reste nommé', () => {
    const el = monter();
    expect(el.textContent).toContain('Tentatives de dépôt refusées hors délai : 2');
    const lignes = Array.from(el.querySelectorAll('table')).at(-1)!.querySelectorAll('tbody tr');
    expect(lignes[0].textContent).toContain('14/10/2026 à 10:00:03');
    expect(lignes[0].textContent).toContain('Scellement');
    expect(lignes[1].textContent).toContain('Candidat sans entreprise déclarée');
    expect(lignes[1].textContent).toContain('Création de l’offre');
  });
});
