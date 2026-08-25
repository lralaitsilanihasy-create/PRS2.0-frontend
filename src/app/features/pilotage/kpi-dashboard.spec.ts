import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiDashboard } from './kpi-dashboard';

/**
 * Tableau de bord KPIs (AUDIT.md P9) — une seule requête sert les trois sections de l'écran :
 * un échec prive donc réellement tout l'écran de données, et le remplacement complet par
 * `<app-etat-erreur>` est le bon motif (pas un artifice à tuile, cf. le tableau de bord Secrétaire).
 */
describe('KpiDashboard — état d’erreur', () => {
  const versTableauBord = (r: HttpRequest<unknown>) =>
    r.url === '/api/kpis/tableau-bord' && r.method === 'GET';

  function preparer(): { fixture: ComponentFixture<KpiDashboard>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(KpiDashboard);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('un échec laisse un état d’erreur réessayable, pas un écran vide silencieux', () => {
    const { fixture, http } = preparer();

    http.expectOne(versTableauBord).flush('panne', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.erreur()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.data()).toBeNull();

    fixture.componentInstance.charger();
    const reprise = http.expectOne(versTableauBord);
    reprise.flush({
      pipelineParStatut: { SOUMIS: 3 },
      nbDossiersSoumis: 3,
      nbDossiersConformes: 1,
      tauxConformitePct: 33,
      topNonConformite: [],
    });

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.data()?.nbDossiersSoumis).toBe(3);
    http.verify();
  });

  it('un succès n’active jamais l’état d’erreur', () => {
    const { fixture, http } = preparer();

    http.expectOne(versTableauBord).flush({
      pipelineParStatut: {},
      nbDossiersSoumis: 0,
      nbDossiersConformes: 0,
      tauxConformitePct: 0,
      topNonConformite: [],
    });

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(false);
    http.verify();
  });
});
