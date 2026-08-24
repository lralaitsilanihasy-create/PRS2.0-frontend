import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PpmMarches } from './ppm-marches';

/**
 * AUDIT.md P9 — avant ce chantier, `error: () => this.loading.set(false)` laissait cet écran
 * VIDE en cas d'échec réseau : indiscernable d'un « aucun résultat ». Ce test verrouille le
 * contrat observable : l'échec affiche l'état d'erreur (pas la liste vide), « Réessayer » relance
 * les DEUX appels réseau, et un succès à liste vide reste un état distinct de l'erreur.
 */
describe('PpmMarches — état d\'erreur de la liste (AUDIT.md P9)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PpmMarches],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('affiche l\'état d\'erreur — pas la liste vide — quand /api/ppms échoue, et « Réessayer » relance les appels', () => {
    const fixture = TestBed.createComponent(PpmMarches);
    fixture.detectChanges();

    http.expectOne('/api/ppms').flush('boom', { status: 500, statusText: 'Erreur serveur' });
    http.expectOne('/api/marches').flush([]);
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

    // Le clic sur « Réessayer » a bien rejoué charger() — mêmes deux appels réseau.
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/marches').flush([]);
    fixture.detectChanges();

    expect(cmp.erreur()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
  });

  it('une liste vide réussie reste un état DISTINCT de l\'erreur', () => {
    const fixture = TestBed.createComponent(PpmMarches);
    fixture.detectChanges();

    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/marches').flush([]);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(false);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucun PPM dans votre périmètre');
  });
});
