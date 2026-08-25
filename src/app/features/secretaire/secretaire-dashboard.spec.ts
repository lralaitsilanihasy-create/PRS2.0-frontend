import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { SecretaireDashboard } from './secretaire-dashboard';

/**
 * Tableau de bord Secrétaire (AUDIT.md P9) : `aReceptionner()` et `list()` sont deux sources
 * indépendantes, chargées séparément (plus de `forkJoin` qui les faisait tomber ensemble). Ces
 * tests verrouillent le contrat observable : l'échec de l'une n'empêche pas l'autre d'aboutir, et
 * le « Réessayer » ne rejoue que la source effectivement en échec — jamais les deux, jamais un
 * rechargement complet de l'écran.
 */
describe('SecretaireDashboard — sources indépendantes', () => {
  const versARecep = (r: HttpRequest<unknown>) => r.url === '/api/dossiers/a-receptionner' && r.method === 'GET';
  const versDossiers = (r: HttpRequest<unknown>) => r.url === '/api/dossiers' && r.method === 'GET';
  const versLocalites = (r: HttpRequest<unknown>) => r.url === '/api/localites' && r.method === 'GET';

  function preparer(): { fixture: ComponentFixture<SecretaireDashboard>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { localite: () => null } },
      ],
    });
    const fixture = TestBed.createComponent(SecretaireDashboard);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('un échec de « à réceptionner » n’empêche pas « dossiers » d’aboutir, et réciproquement', () => {
    const { fixture, http } = preparer();
    fixture.detectChanges();

    http.expectOne(versARecep).flush('panne', { status: 500, statusText: 'Server Error' });
    http.expectOne(versDossiers).flush([{ idDossier: 1, statut: 'PRET_DISPATCH' }, { idDossier: 2, statut: 'CLOTURE' }]);
    http.expectOne(versLocalites).flush([]);
    fixture.detectChanges();

    const instance = fixture.componentInstance;
    // La tuile « À réceptionner » est en échec…
    expect(instance.kpis().find((k) => k.label === 'À réceptionner')?.error).toBe(true);
    // … mais les tuiles alimentées par « dossiers » gardent leurs vraies valeurs, pas des 0.
    expect(instance.kpis().find((k) => k.label === 'Dossiers (localité)')).toEqual(
      expect.objectContaining({ value: 2, error: false }),
    );
    expect(instance.kpis().find((k) => k.label === 'Prêts à dispatcher')).toEqual(
      expect.objectContaining({ value: 1, error: false }),
    );
    expect(instance.pipeline()).toHaveLength(2);
    expect(instance.worklist()[0].error).toBe(true);
    http.verify();
  });

  it('« Réessayer » ne rejoue que la source en échec', () => {
    const { fixture, http } = preparer();
    fixture.detectChanges();

    http.expectOne(versARecep).flush('panne', { status: 500, statusText: 'Server Error' });
    http.expectOne(versDossiers).flush([{ idDossier: 1, statut: 'CLOTURE' }]);
    http.expectOne(versLocalites).flush([]);
    fixture.detectChanges();

    fixture.componentInstance.reessayer();

    // Seule « à réceptionner » repart : « dossiers » n'a pas de requête en attente.
    const reprise = http.expectOne(versARecep);
    http.verify();
    reprise.flush([{ idDossier: 9, statut: 'SOUMIS' }]);

    expect(fixture.componentInstance.kpis().find((k) => k.label === 'À réceptionner')).toEqual(
      expect.objectContaining({ value: 1, error: false }),
    );
  });
});
