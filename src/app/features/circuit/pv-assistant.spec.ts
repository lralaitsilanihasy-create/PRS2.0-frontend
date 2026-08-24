import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { PvAssistant } from './pv-assistant';

/**
 * Ligne de tableau « PV reçus » (AUDIT.md A4) : le détail bascule via un vrai `<button>` dans la
 * cellule de référence, jamais un `<tr (click)>`. Verrouille le contrat DOM dont dépend
 * l'accessibilité clavier — un `<tr>` ne peut pas nativement recevoir le focus ni s'activer par
 * Entrée/Espace, un `<button>` le fait sans code additionnel.
 */
describe('PvAssistant — ligne de tableau accessible au clavier', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function creerEtCharger() {
    const fixture = TestBed.createComponent(PvAssistant);
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/aviss').flush([]);
    http.expectOne('/api/pv-examens/definitifs').flush([
      {
        idPv: 1,
        idExamen: 10,
        imCtrlMembre: 'X',
        statutPv: 'SIGNE',
        nbNavettes: 1,
        refePv: 'PV/001/2026',
        dateSignatureMembre: '2026-08-01',
      },
    ]);
    http.expectOne('/api/examens').flush([{ idExamen: 10, idDispatch: 5 }]);
    http.expectOne('/api/dispatchs').flush([{ idDispatch: 5, idReception: 7, interimDispatch: false }]);
    http.expectOne('/api/receptions').flush([{ idReception: 7, idDossier: 3, numPassage: 1, typePassage: 'INITIAL' }]);
    http.expectOne('/api/dossiers').flush([{ idDossier: 3, refeDossier: 'DOS/003/2026' }]);

    fixture.detectChanges();
    return fixture;
  }

  it('bascule le détail via un <button>, jamais un <tr> cliquable', () => {
    const fixture = creerEtCharger();
    const ligne = fixture.nativeElement.querySelector('tr.pva__row') as HTMLTableRowElement;
    const bouton = fixture.nativeElement.querySelector('.pva__toggle') as HTMLButtonElement;

    // La ligne elle-même ne porte plus aucun déclencheur de clic — le bouton est le seul.
    expect(ligne.getAttribute('onclick')).toBeNull();
    expect(bouton.tagName).toBe('BUTTON');
    expect(bouton.type).toBe('button');
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
  });

  it("ouvre puis referme le détail au clic (équivalent Entrée/Espace sur un <button>)", () => {
    const fixture = creerEtCharger();
    const bouton = () => fixture.nativeElement.querySelector('.pva__toggle') as HTMLButtonElement;

    expect(fixture.nativeElement.querySelector('tr.pva__detail')).toBeNull();

    bouton().click();
    fixture.detectChanges();
    expect(bouton().getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('tr.pva__detail')).not.toBeNull();

    bouton().click();
    fixture.detectChanges();
    expect(bouton().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('tr.pva__detail')).toBeNull();
  });

  it('aria-controls du bouton pointe vers la ligne de détail effectivement ouverte', () => {
    const fixture = creerEtCharger();
    const bouton = fixture.nativeElement.querySelector('.pva__toggle') as HTMLButtonElement;
    bouton.click();
    fixture.detectChanges();

    const cible = bouton.getAttribute('aria-controls');
    expect(cible).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${cible}`)).not.toBeNull();
  });
});
