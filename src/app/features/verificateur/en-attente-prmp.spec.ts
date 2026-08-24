import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EnAttentePrmp } from './en-attente-prmp';

/**
 * AUDIT.md P9 — avant ce chantier, `error: () => this.loading.set(false)` laissait cet écran VIDE
 * en cas d'échec réseau : indiscernable d'un « aucun dossier en attente ». Ce test verrouille le
 * contrat observable : l'échec du `forkJoin` (dossiers/réceptions/vérifications/notifications)
 * affiche l'état d'erreur (pas la liste vide), « Réessayer » relance les quatre appels, et un
 * succès à liste vide reste un état distinct de l'erreur.
 */
describe('EnAttentePrmp — état d\'erreur de la liste (AUDIT.md P9)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EnAttentePrmp],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('affiche l\'état d\'erreur — pas la liste vide — quand le forkJoin échoue, et « Réessayer » relance les appels', () => {
    const fixture = TestBed.createComponent(EnAttentePrmp);
    fixture.detectChanges();

    http.expectOne('/api/entite-contracts').flush([]);
    // Un `forkJoin` désabonne ses membres encore en attente dès la première erreur : flusher
    // celle-ci en dernier évite de flusher une requête déjà annulée par RxJS.
    http.expectOne('/api/receptions').flush([]);
    http.expectOne('/api/verifications').flush([]);
    http.expectOne('/api/notifications/mes').flush([]);
    http.expectOne('/api/dossiers/en-attente-prmp').flush('boom', { status: 500, statusText: 'Erreur serveur' });
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(true);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Aucun dossier en attente de rectification PRMP.');

    const bouton = fixture.nativeElement.querySelector('.etat-erreur button') as HTMLButtonElement | null;
    expect(bouton).toBeTruthy();
    bouton!.click();
    fixture.detectChanges();

    // Le clic sur « Réessayer » a bien rejoué charger() — un nouveau forkJoin des quatre appels.
    http.expectOne('/api/dossiers/en-attente-prmp').flush([]);
    http.expectOne('/api/receptions').flush([]);
    http.expectOne('/api/verifications').flush([]);
    http.expectOne('/api/notifications/mes').flush([]);
    fixture.detectChanges();

    expect(cmp.erreur()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
  });

  it('une liste vide réussie reste un état DISTINCT de l\'erreur', () => {
    const fixture = TestBed.createComponent(EnAttentePrmp);
    fixture.detectChanges();

    http.expectOne('/api/entite-contracts').flush([]);
    http.expectOne('/api/dossiers/en-attente-prmp').flush([]);
    http.expectOne('/api/receptions').flush([]);
    http.expectOne('/api/verifications').flush([]);
    http.expectOne('/api/notifications/mes').flush([]);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(false);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucun dossier en attente de rectification PRMP.');
  });
});
