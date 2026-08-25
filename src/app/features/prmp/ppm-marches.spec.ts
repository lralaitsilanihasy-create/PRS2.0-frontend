import { provideHttpClient } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PpmMarches } from './ppm-marches';

/**
 * Pagination **serveur** de l'écran « PPM & marchés rattachés » (AUDIT.md P1) et — hérité de
 * l'écran précédent — son état d'erreur réessayable (AUDIT.md P9).
 *
 * L'écran téléchargeait la table entière des PPM du périmètre pour l'afficher intégralement.
 * Contrairement à « Mes PPM & marchés », aucun filtre mémoire ne réduit la liste affichée — rien
 * n'interdit donc de la paginer côté serveur. Ces tests verrouillent le contrat observable (ce qui
 * part sur le réseau, l'état exposé), pas le rendu, sauf pour les deux derniers qui verrouillent
 * en plus le DOM de l'état d'erreur (motif du test P9 d'origine : un `error()` qui ne mettait pas
 * `erreur` à `true` laissait l'écran VIDE, indiscernable d'un « aucun résultat »).
 */
describe('PpmMarches — pagination serveur et état d’erreur', () => {
  /** Requête GET sur la collection des PPM, quels que soient ses paramètres. */
  const versPpms = (r: HttpRequest<unknown>) => r.url === '/api/ppms' && r.method === 'GET';
  /** Référentiel des marchés (join count) : chargé une fois, hors pagination. */
  const versMarches = (r: HttpRequest<unknown>) => r.url === '/api/marches' && r.method === 'GET';

  function preparer(): { fixture: ComponentFixture<PpmMarches>; http: HttpTestingController } {
    TestBed.configureTestingModule({
      imports: [PpmMarches],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PpmMarches);
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

    const req = http.expectOne(versPpms);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('15');
    req.flush(page([{ idPpm: 1 }, { idPpm: 2 }], 57));

    http.expectOne(versMarches).flush([]);
    fixture.detectChanges();

    // Le total vient du serveur : il ne peut pas être déduit des 2 lignes reçues.
    expect(fixture.componentInstance.total()).toBe(57);
    expect(fixture.componentInstance.ppms()).toHaveLength(2);
    expect(fixture.componentInstance.totalPages()).toBe(4);
    http.verify();
  });

  it('« Suivant » recharge depuis le serveur au lieu de découper un tableau local', () => {
    const { fixture, http } = preparer();
    http.expectOne(versPpms).flush(page([{ idPpm: 1 }], 40));
    http.expectOne(versMarches).flush([]);

    fixture.componentInstance.next();

    const suivante = http.expectOne(versPpms);
    expect(suivante.request.params.get('page')).toBe('1');
    suivante.flush(page([{ idPpm: 16 }], 40, 1));
    expect(fixture.componentInstance.page()).toBe(1);
    http.verify();
  });

  it('« Suivant » sur la dernière page n’émet aucune requête', () => {
    const { fixture, http } = preparer();
    http.expectOne(versPpms).flush(page([{ idPpm: 1 }], 3));
    http.expectOne(versMarches).flush([]);

    fixture.componentInstance.next();
    fixture.componentInstance.next();

    http.verify(); // aucune requête en attente : la borne est respectée
    expect(fixture.componentInstance.page()).toBe(0);
  });

  it('affiche l’état d’erreur — pas la liste vide — quand /api/ppms échoue, et « Réessayer » relance les appels', () => {
    const { fixture, http } = preparer();

    http.expectOne(versPpms).flush('boom', { status: 500, statusText: 'Erreur serveur' });
    http.expectOne(versMarches).flush([]);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(true);
    expect(cmp.loading()).toBe(false);
    // Le message « aucun résultat » ne doit JAMAIS s'afficher à la place de l'erreur.
    expect(fixture.nativeElement.textContent).not.toContain('Aucun PPM dans votre périmètre');

    const bouton = fixture.nativeElement.querySelector('.etat-erreur button') as HTMLButtonElement | null;
    expect(bouton).toBeTruthy();
    bouton!.click();
    fixture.detectChanges();

    // Le clic sur « Réessayer » a bien rejoué charger() — même page demandée au serveur.
    const reprise = http.expectOne(versPpms);
    expect(reprise.request.params.get('page')).toBe('0');
    reprise.flush(page([], 0));
    fixture.detectChanges();

    expect(cmp.erreur()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    http.verify();
  });

  it('une liste vide réussie reste un état DISTINCT de l’erreur', () => {
    const { fixture, http } = preparer();

    http.expectOne(versPpms).flush(page([], 0));
    http.expectOne(versMarches).flush([]);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(false);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucun PPM dans votre périmètre');
    http.verify();
  });
});
