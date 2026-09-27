import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ParametresInternes } from '../../models';
import { ParametresInternesEcran } from './parametres-internes';

const DONNEES: ParametresInternes = {
  idDmc: 42,
  membresCommission: [{ im: 'MEM001', nom: 'Rakoto', profil: 'Membre' }, { im: 'MEM002', nom: 'Rabe', profil: 'Membre' }],
  nombreParts: 2,
  quorum: 2,
  dateCeremonie: null,
  responsable: { im: 'RESP01', nom: 'Randria' },
  etat: 'INCOMPLETS',
  anomalies: [{ regle: 'SE_CEREMONIE', message: 'La cérémonie des clés doit précéder la publication de l’avis.' }],
  journal: [{ date: '2026-09-27T10:00', acteur: 'RESP01', nomActeur: 'Randria', champ: 'quorum', ancienneValeur: null, nouvelleValeur: '2' }],
};
const CANDIDATS = [
  { im: 'MEM001', nom: 'Rakoto', profil: 'Membre' },
  { im: 'MEM002', nom: 'Rabe', profil: 'Membre' },
  { im: 'CC0001', nom: 'Rasoa', profil: 'Chef de commission' },
];

describe('Paramètres internes de la procédure (remise électronique, 27/09)', () => {
  let fixture: ComponentFixture<ParametresInternesEcran>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();

  function monter(): void {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ idDmc: '42' })).asObservable(), snapshot: { data: {} } } },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ParametresInternesEcran);
    rendre();
  }

  afterEach(() => http.verify());

  it('403 : le refus est nommé à l’écran, sans redirection ni appel de plus (le droit est par procédure, pas par rôle)', () => {
    monter();
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush({ message: 'Interdit' }, { status: 403, statusText: 'Forbidden' });
    rendre();
    expect(texte(racine().querySelector('.alert-warning'))).toContain('Accès réservé au responsable de la procédure');
    expect(racine().querySelector('form')).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('titulaire : membres cochés, parts calculées, quorum proposé, journal avec ancienne et nouvelle valeur ; l’enregistrement envoie les trois valeurs saisies', () => {
    monter();
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush(DONNEES);
    rendre();
    http.expectOne('/api/fiches-marche/42/parametres-internes/candidats').flush(CANDIDATS);
    rendre();
    expect(texte(racine().querySelector('.badge'))).toBe('Paramètres incomplets');
    expect(texte(racine().querySelector('.pi__anomalies'))).toContain('SE_CEREMONIE');
    const cases = Array.from(racine().querySelectorAll('.pi__case input')) as HTMLInputElement[];
    expect(cases.map((c) => c.checked)).toEqual([true, true, false]);
    expect(texte(racine().querySelector('#pi-nombre-parts'))).toBe('2 calculé');
    expect(texte(racine().querySelector('#pi-responsable'))).toContain('Randria (RESP01)');
    expect(Array.from(racine().querySelectorAll('.pi__journal tbody tr td')).map((td) => texte(td))).toEqual(['2026-09-27T10:00', 'Randria', 'quorum', '—', '2']);
    // on ajoute la Chef de commission, on passe le quorum à 3, on date la cérémonie
    cases[2].click();
    rendre();
    expect(texte(racine().querySelector('#pi-nombre-parts'))).toBe('3 calculé');
    const quorum = racine().querySelector('#pi-quorum') as HTMLInputElement;
    quorum.value = '3';
    quorum.dispatchEvent(new Event('input'));
    const ceremonie = racine().querySelector('#pi-ceremonie') as HTMLInputElement;
    ceremonie.value = '2026-10-01T09:00';
    ceremonie.dispatchEvent(new Event('input'));
    rendre();
    (racine().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
    const put = http.expectOne('/api/fiches-marche/42/parametres-internes');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ membresCommission: ['MEM001', 'MEM002', 'CC0001'], quorum: 3, dateCeremonie: '2026-10-01T09:00' });
    put.flush({ ...DONNEES, membresCommission: CANDIDATS, nombreParts: 3, quorum: 3, dateCeremonie: '2026-10-01T09:00', etat: 'COMPLETS', anomalies: [] });
    rendre();
    expect(texte(racine().querySelector('.badge'))).toBe('Paramètres complets');
    expect(toast.success).toHaveBeenCalledWith('Paramètres internes enregistrés — complets.');
  });

  it('400 nominatif sous le champ fautif ; 409 MEMBRE_COMMISSION nommé', () => {
    monter();
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush(DONNEES);
    rendre();
    http.expectOne('/api/fiches-marche/42/parametres-internes/candidats').flush(CANDIDATS);
    rendre();
    const form = racine().querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush({ message: 'Validation échouée', erreurs: [{ champ: 'quorum', message: 'Le quorum est compris entre 2 et le nombre de membres.' }] }, { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('#pi-quorum')?.parentElement?.querySelector('.form-error'))).toBe('Le quorum est compris entre 2 et le nombre de membres.');
    expect(toast.error).not.toHaveBeenCalled();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush({ message: 'Conflit', code: 'MEMBRE_COMMISSION' }, { status: 409, statusText: 'Conflict' });
    rendre();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('ne peut pas détenir une part de clé'));
  });
});
