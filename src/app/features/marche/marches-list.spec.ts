import { provideHttpClient } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { MarchesList } from './marches-list';

/**
 * Pagination **serveur** de l'écran « Marchés » (AUDIT.md P1).
 *
 * L'écran téléchargeait la table entière — scopée au périmètre de l'appelant, mais entière — puis la
 * filtrait et la découpait en mémoire pour n'en afficher que 15 lignes. Le piège, en revisitant ce
 * code plus tard, est de « simplifier » en revenant à `list()` : l'écran resterait correct à l'œil,
 * avec un coût réseau qui croît linéairement avec la base. Ces tests verrouillent donc le contrat
 * observable — ce qui part sur le réseau — et non le rendu.
 *
 * Le second test porte la subtilité qui a motivé un changement côté backend : le filtre PPM doit
 * être **transmis au serveur**. Filtrer après pagination donnerait des pages incomplètes et un
 * total faux, sans que rien ne le signale à l'écran.
 */
describe('MarchesList — pagination serveur', () => {
  /** Requête GET sur la collection des marchés, quels que soient ses paramètres. */
  const versMarches = (r: HttpRequest<unknown>) => r.url === '/api/marches' && r.method === 'GET';

  function preparer(queryParams: Record<string, string> = {}): {
    fixture: ComponentFixture<MarchesList>;
    http: HttpTestingController;
  } {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap(queryParams)) },
        },
      ],
    });
    const fixture = TestBed.createComponent(MarchesList);
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  /** Enveloppe `Page` de Spring Data, telle que servie par le backend. */
  const page = (content: unknown[], totalElements: number, number = 0, size = 15) => ({
    content,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / size)),
    number,
    size,
  });

  it('ne demande que la page affichée, jamais la liste plate', () => {
    const { fixture, http } = preparer();

    const req = http.expectOne(versMarches);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('15');

    req.flush(page([{ idDetail: 1 }, { idDetail: 2 }], 340));
    fixture.detectChanges();

    // Le total vient du serveur : il ne peut pas être déduit des 2 lignes reçues.
    expect(fixture.componentInstance.total()).toBe(340);
    expect(fixture.componentInstance.marches()).toHaveLength(2);
    expect(fixture.componentInstance.totalPages()).toBe(23);
    http.verify();
  });

  it('transmet le filtre PPM au serveur au lieu de filtrer la page reçue', () => {
    const { http } = preparer({ ppm: '42' });

    // L'écran résout aussi la référence du PPM pour l'afficher : requête distincte, sans incidence.
    http.expectOne('/api/ppms/42').flush({ reference: 'PPM-2026-042' });

    const req = http.expectOne(versMarches);
    expect(req.request.params.get('ppm')).toBe('42');
    req.flush(page([{ idDetail: 7, idPpm: 42 }], 1));
    http.verify();
  });

  it('« Suivant » recharge depuis le serveur au lieu de découper un tableau local', () => {
    const { fixture, http } = preparer();
    http.expectOne(versMarches).flush(page([{ idDetail: 1 }], 40));

    fixture.componentInstance.next();

    const suivante = http.expectOne(versMarches);
    expect(suivante.request.params.get('page')).toBe('1');
    suivante.flush(page([{ idDetail: 16 }], 40, 1));
    expect(fixture.componentInstance.page()).toBe(1);
    http.verify();
  });

  it('« Suivant » sur la dernière page n’émet aucune requête', () => {
    const { fixture, http } = preparer();
    http.expectOne(versMarches).flush(page([{ idDetail: 1 }], 3));

    fixture.componentInstance.next();
    fixture.componentInstance.next();

    http.verify(); // aucune requête en attente : la borne est respectée
    expect(fixture.componentInstance.page()).toBe(0);
  });

  it('un échec laisse un état d’erreur réessayable, pas une liste vide silencieuse', () => {
    const { fixture, http } = preparer();
    http.expectOne(versMarches).flush('panne', { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.erreur()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);

    fixture.componentInstance.charger();
    const reprise = http.expectOne(versMarches);
    expect(reprise.request.params.get('page')).toBe('0');
    reprise.flush(page([{ idDetail: 1 }], 1));

    expect(fixture.componentInstance.erreur()).toBe(false);
    http.verify();
  });
});
