import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { DossiersClotures } from './dossiers-clotures';

/**
 * AUDIT.md P9 — avant ce chantier, `error: () => this.loading.set(false)` laissait cet écran VIDE
 * en cas d'échec réseau : indiscernable d'un « aucun dossier clôturé ». Ce test verrouille le
 * contrat observable : l'échec affiche l'état d'erreur (pas la liste vide), « Réessayer » relance
 * l'appel (rejoué avec le bon numéro de page), et un succès à liste vide reste un état distinct de
 * l'erreur. Choisi pour cette tranche circuit car son chargement est un simple GET (pas de
 * `forkJoin`) : un cas de figure plus courant que celui déjà couvert côté PRMP.
 */
describe('DossiersClotures — état d\'erreur de la liste (AUDIT.md P9)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DossiersClotures],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { source: 'prmp-clotures' }, paramMap: convertToParamMap({}) },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('affiche l\'état d\'erreur — pas la liste vide — quand /api/dossiers échoue, et « Réessayer » relance l\'appel', () => {
    const fixture = TestBed.createComponent(DossiersClotures);
    fixture.detectChanges();

    http.expectOne('/api/entite-contracts').flush([]);
    http.expectOne('/api/dossiers').flush('boom', { status: 500, statusText: 'Erreur serveur' });
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(true);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Aucun dossier clôturé.');

    const bouton = fixture.nativeElement.querySelector('.etat-erreur button') as HTMLButtonElement | null;
    expect(bouton).toBeTruthy();
    bouton!.click();
    fixture.detectChanges();

    // Le clic sur « Réessayer » a bien rejoué charger(pageIndex()) — un nouvel appel réseau.
    http.expectOne('/api/dossiers').flush([]);
    fixture.detectChanges();

    expect(cmp.erreur()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
  });

  it('une liste vide réussie reste un état DISTINCT de l\'erreur', () => {
    const fixture = TestBed.createComponent(DossiersClotures);
    fixture.detectChanges();

    http.expectOne('/api/entite-contracts').flush([]);
    http.expectOne('/api/dossiers').flush([]);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    expect(cmp.erreur()).toBe(false);
    expect(cmp.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.etat-erreur')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aucun dossier clôturé.');
  });
});
