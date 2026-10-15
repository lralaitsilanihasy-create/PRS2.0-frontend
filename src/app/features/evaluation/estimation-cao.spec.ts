import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IndicateursPrixVue } from './etape-anormales';

// ⚠️ Q11 (arbitrage du pilote, 14/10 ; backend V116, B4) — la commission d'appel d'offres lit l'estimation détaillée de la PRMP.
describe('Q11 — l’estimation détaillée de la PRMP, à l’étape des offres anormales', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function monter() {
    const f = TestBed.createComponent(IndicateursPrixVue);
    f.componentRef.setInput('idDmc', 44);
    f.componentRef.setInput('lot', 1);
    f.detectChanges();
    http.expectOne('/api/fiches-marche/44/evaluation/lots/1/indicateurs-prix').flush({ estimation: 3000000, moyenne: 2900000, methodeDao: null, offres: [] });
    f.detectChanges();
    const volet = (f.nativeElement as HTMLElement).querySelector('details.ip__estim') as HTMLDetailsElement;
    volet.open = true;
    volet.dispatchEvent(new Event('toggle'));
    return f;
  }

  it('lue à l’ouverture du volet : chaque article, son prix estimé et son montant', () => {
    const f = monter();
    http.expectOne('/api/fiches-marche/44/evaluation/lots/1/estimation').flush({
      lot: 1, montantPlan: 3000000, totalEstime: 3000000,
      articles: [{ ordre: 1, numeroPrix: null, designation: 'Ordinateur portable', unite: 'U', quantite: 12, prixUnitaireEstime: 250000, montant: 3000000 }],
    });
    f.detectChanges();
    const t = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(t).toContain('Estimation détaillée de la PRMP (non publiée)');
    expect(t).toContain('Ordinateur portable');
  });

  it('une fiche validée avant la règle n’a pas d’estimation détaillée : le volet le dit', () => {
    const f = monter();
    http.expectOne('/api/fiches-marche/44/evaluation/lots/1/estimation').flush({ code: 'X' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Pas d’estimation détaillée pour ce lot');
  });
});
