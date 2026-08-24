import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CrudService } from '../../services/api/crud.service';
import { CrudResourceConfig } from './crud-config';
import { CrudPage } from './crud-page';

/** Ressource factice minimale : seul le segment d'URL compte pour ces tests. */
interface Item {
  id: string;
  libelle: string;
}

@Injectable({ providedIn: 'root' })
class ItemService extends CrudService<Item, string> {
  protected readonly resource = 'crud-page-spec-items';
}

/**
 * `CrudPage` (`shared/crud/crud-page.ts`) est l'écran générique piloté par `CrudResourceConfig` :
 * la quasi-totalité des écrans d'administration (référentiels, comptes génériques, journal d'audit,
 * sessions) le réutilisent tel quel via `data.crud`. Le chargement (`load()`) et la recherche
 * (`runSearch()`) sont donc mutualisés ici — un correctif sur ce composant couvre tous ces écrans
 * d'un coup, plutôt que de répéter le motif dans chaque config (AUDIT.md P9).
 *
 * Sans état d'erreur distinct, un échec réseau laissait la liste vide — indistinguable d'un
 * référentiel réellement vide.
 */
describe('CrudPage — état d’erreur mutualisé (AUDIT.md P9)', () => {
  const versItems = (r: HttpRequest<unknown>) => r.url === '/api/crud-page-spec-items' && r.method === 'GET';

  function preparer(config: Partial<CrudResourceConfig> = {}): {
    fixture: ComponentFixture<CrudPage>;
    http: HttpTestingController;
  } {
    const crud: CrudResourceConfig = {
      title: 'Items',
      service: ItemService,
      idKey: 'id',
      fields: [{ key: 'libelle', label: 'Libellé' }],
      ...config,
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { crud } },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CrudPage);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('un échec de chargement affiche l’état d’erreur, pas une liste vide', () => {
    const { fixture, http } = preparer();

    http.expectOne(versItems).flush('panne', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.erreur()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.rows()).toHaveLength(0);
    http.verify();
  });

  it('« Réessayer » (load()) relance le même appel et efface l’erreur au succès', () => {
    const { fixture, http } = preparer();
    http.expectOne(versItems).flush('panne', { status: 500, statusText: 'Server Error' });
    expect(fixture.componentInstance.erreur()).toBe(true);

    fixture.componentInstance.load();
    const reprise = http.expectOne(versItems);
    reprise.flush([{ id: '1', libelle: 'A' }]);

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.rows()).toHaveLength(1);
    http.verify();
  });

  it('un succès à liste vide reste distinct de l’erreur', () => {
    const { fixture, http } = preparer();

    http.expectOne(versItems).flush([]);

    expect(fixture.componentInstance.erreur()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.rows()).toHaveLength(0);
    http.verify();
  });

  it('la recherche serveur distingue aussi un échec d’une absence de résultat', () => {
    const { fixture, http } = preparer({ searchByName: {} });
    http.expectOne(versItems).flush([]);

    fixture.componentInstance.onSearch('xyz');
    // debounceTime(300) : le composant n'émet la requête qu'après le délai — on avance le temps réel.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const req = http.expectOne((r) => r.url === '/api/crud-page-spec-items/par-nom/xyz');
        req.flush('panne', { status: 500, statusText: 'Server Error' });
        expect(fixture.componentInstance.erreur()).toBe(true);
        http.verify();
        resolve();
      }, 320);
    });
  });
});
