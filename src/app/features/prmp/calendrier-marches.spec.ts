import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CalendrierMarches } from './calendrier-marches';

/**
 * AUDIT.md P9 — avant ce chantier, `error: () => this.loading.set(false)` laissait cet écran VIDE
 * en cas d'échec réseau : indiscernable d'un « aucune ligne de marché ». Ce test verrouille le
 * contrat observable : l'échec du `forkJoin` (marches/previsions/capm/ppms/echeances/regles)
 * affiche l'état d'erreur (pas le tableau vide), « Réessayer » relance les six appels, et un
 * succès à liste vide reste un état distinct de l'erreur. Écarté de la tranche 2 pour conflit
 * avec une branche parallèle — vérifié à jour sur `polissage` avant traitement (aucun état
 * d'erreur préexistant).
 */
describe('CalendrierMarches — état d\'erreur de la liste (AUDIT.md P9)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendrierMarches],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushSucces(): void {
    http.expectOne('/api/marches').flush([]);
    http.expectOne('/api/marche-previsions').flush([]);
    http.expectOne('/api/capm').flush([]);
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/echeances').flush([]);
    http.expectOne('/api/regle-alertes').flush([]);
  }

  it('affiche l\'état d\'erreur — pas le tableau vide — quand le forkJoin échoue, et « Réessayer » relance les appels', () => {
    const fixture = TestBed.createComponent(CalendrierMarches);
    fixture.detectChanges();

    // Un `forkJoin` désabonne ses membres encore en attente dès la première erreur : flusher
    // celle-ci en dernier évite de flusher une requête déjà annulée par RxJS.
    http.expectOne('/api/marche-previsions').flush([]);
    http.expectOne('/api/capm').flush([]);
    http.expectOne('/api/ppms').flush([]);
    http.expectOne('/api/echeances').flush([]);
    http.expectOne('/api/regle-alertes').flush([]);
    http.expectOne('/api/marches').flush('boom', { status: 500, statusText: 'Erreur serveur' });
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(true);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Aucune ligne de marché.');

    const bouton = fixture.nativeElement.querySelector('.etat-erreur button') as HTMLButtonElement | null;
    expect(bouton).toBeTruthy();
    bouton!.click();
    fixture.detectChanges();

    // Le clic sur « Réessayer » a bien rejoué charger() — un nouveau forkJoin des six appels.
    flushSucces();
    fixture.detectChanges();

    expect(cmp.erreur()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
  });

  it('une liste vide réussie reste un état DISTINCT de l\'erreur', () => {
    const fixture = TestBed.createComponent(CalendrierMarches);
    fixture.detectChanges();

    flushSucces();
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(false);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucune ligne de marché.');
  });
});
