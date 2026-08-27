import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Page } from '../../models/common.model';
import { CrudService } from './crud.service';

interface Element {
  id: number;
  libelle: string;
}

@Injectable({ providedIn: 'root' })
class ElementService extends CrudService<Element> {
  protected readonly resource = 'elements';
}

/**
 * `listePage()` est le socle de la pagination serveur adoptée par les grandes listes
 * (« Mes dossiers », pipeline, journal d'audit — livraison backend `c16407f`). Une seule méthode,
 * héritée par une quinzaine de services : une erreur ici ne se voit sur aucun écran en particulier,
 * elle les dégrade tous en même temps.
 *
 * Ce que le test verrouille : les noms `page` et `size` attendus par Spring (`pge`, `taille` ou
 * `pageSize` seraient ignorés côté serveur, qui renverrait alors la liste PLATE — donc tout le jeu
 * de données, exactement la régression que la pagination était censée supprimer), la combinaison
 * avec les filtres métier de la ressource, et la forme de l'enveloppe `Page<T>` rendue à l'appelant.
 */
describe('CrudService.listePage', () => {
  const page = (contenu: Element[]): Page<Element> => ({
    content: contenu,
    totalElements: 42,
    totalPages: 3,
    number: 1,
    size: 20,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('demande la page au format attendu par le serveur (« page » et « size »)', () => {
    const service = TestBed.inject(ElementService);
    const http = TestBed.inject(HttpTestingController);

    let recue: Page<Element> | undefined;
    service.listePage(1, 20).subscribe((p) => (recue = p));

    const req = http.expectOne((r) => r.url === '/api/elements');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');

    req.flush(page([{ id: 1, libelle: 'un' }]));
    expect(recue?.content).toHaveLength(1);
    expect(recue?.totalElements).toBe(42);
    expect(recue?.totalPages).toBe(3);
    expect(recue?.number).toBe(1);
  });

  it('transmet la première page telle quelle — `page=0` ne doit pas être escamoté', () => {
    const service = TestBed.inject(ElementService);
    const http = TestBed.inject(HttpTestingController);

    service.listePage(0, 25).subscribe();

    const req = http.expectOne((r) => r.url === '/api/elements');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
  });

  it('ajoute les filtres métier de la ressource aux paramètres de pagination', () => {
    const service = TestBed.inject(ElementService);
    const http = TestBed.inject(HttpTestingController);

    service.listePage(2, 10, { statut: 'SOUMIS', idLocalite: 'ANT' }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/elements');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('statut')).toBe('SOUMIS');
    expect(req.request.params.get('idLocalite')).toBe('ANT');
    req.flush(page([]));
  });

  it('n’ajoute aucun paramètre parasite quand aucun filtre n’est passé', () => {
    const service = TestBed.inject(ElementService);
    const http = TestBed.inject(HttpTestingController);

    service.listePage(0, 20).subscribe();

    const req = http.expectOne((r) => r.url === '/api/elements');
    expect(req.request.params.keys().sort()).toEqual(['page', 'size']);
    req.flush(page([]));
  });
});
