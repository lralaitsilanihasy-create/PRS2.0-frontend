import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RattachementsAdmin } from './rattachements-admin';

/**
 * Rattachements PRMP↔entité en attente (AUDIT.md P9 — écran d'administration hors mutualisation
 * `CrudPage`, chargement écrit à la main via `forkJoin`).
 *
 * Sans état d'erreur distinct, un échec réseau laissait la liste vide — indistinguable d'un
 * « aucun rattachement en attente » réel.
 */
describe('RattachementsAdmin — état d’erreur (AUDIT.md P9)', () => {
  const versLiens = (r: HttpRequest<unknown>) => r.url === '/api/prmp-entites' && r.method === 'GET';
  const versEntites = (r: HttpRequest<unknown>) => r.url === '/api/entite-contracts' && r.method === 'GET';

  function preparer(): { fixture: ComponentFixture<RattachementsAdmin>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(RattachementsAdmin);
    fixture.detectChanges(); // ngOnInit → charger()
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('un échec de l’un des deux appels affiche l’état d’erreur, pas une liste vide', () => {
    const { fixture, http } = preparer();

    // forkJoin : dès qu'un des deux échoue, il se désabonne de l'autre (requête annulée) —
    // un seul flush est donc attendu ici.
    http.expectOne(versLiens).flush('panne', { status: 500, statusText: 'Server Error' });
    http.expectOne(versEntites); // requête annulée par forkJoin, pas de réponse à fournir

    expect(fixture.componentInstance.erreur()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.rattachements()).toHaveLength(0);
    http.verify();
  });

  it('« Réessayer » relance les deux appels et efface l’erreur au succès', () => {
    const { fixture, http } = preparer();
    http.expectOne(versLiens).flush('panne', { status: 500, statusText: 'Server Error' });
    http.expectOne(versEntites);
    expect(fixture.componentInstance.erreur()).toBe(true);

    fixture.componentInstance.charger();
    http.expectOne(versLiens).flush([{ idPrmpEntite: 1, idPrmp: 'P1', idEntiteContract: 9, actif: false }]);
    http.expectOne(versEntites).flush([{ idEntiteContract: 9, libelleEntite: 'Ministère X' }]);

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.rattachements()).toHaveLength(1);
    http.verify();
  });

  it('un succès sans rattachement en attente reste distinct de l’erreur', () => {
    const { fixture, http } = preparer();

    http.expectOne(versLiens).flush([]);
    http.expectOne(versEntites).flush([]);

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.rattachements()).toHaveLength(0);
    http.verify();
  });
});
