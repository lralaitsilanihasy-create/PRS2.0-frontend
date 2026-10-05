import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ParametresInternes } from '../../models';
import { ParametresInternesEcran } from './parametres-internes';

// ⚠️ Lot 2a/2b (04/10, V66/V67) : les membres détenteurs d'une part viennent de la CAO désignée par la PRMP — le responsable
// les LIT (plus d'appel `…/candidats`, plus de cases) et saisit le quorum, la date de la cérémonie et le dépositaire.
const DONNEES: ParametresInternes = {
  idDmc: 42,
  membresCommission: [{ im: 'K000000001', nom: 'Rakoto', profil: 'MEMBRE_CAO' }, { im: 'K000000002', nom: 'Rabe', profil: 'MEMBRE_CAO' }],
  nombreParts: 2,
  quorum: 2,
  dateCeremonie: null,
  responsable: { im: 'RESP01', nom: 'Randria' },
  etat: 'INCOMPLETS',
  anomalies: [{ regle: 'SE_CEREMONIE', message: 'La cérémonie des clés doit précéder la publication de l’avis.' }],
  avertissements: [{ regle: 'SE_QUORUM_MARGE', message: 'Le quorum est égal au nombre de membres.' }],
  partDeSecours: null,
  journal: [{ date: '2026-09-27T10:00', acteur: 'RESP01', nomActeur: 'Randria', champ: 'quorum', ancienneValeur: null, nouvelleValeur: '2' }],
};

describe('Paramètres internes de la procédure (remise électronique, 27/09 ; membres de la CAO depuis le 04/10)', () => {
  let fixture: ComponentFixture<ParametresInternesEcran>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rendre = (): void => fixture.detectChanges();
  const saisir = (el: Element | null, valeur: string): void => {
    const champ = el as HTMLInputElement;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

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

  /** Charge les paramètres ; la section de la cérémonie (composant enfant) est servie 403, sans effet sur ce qui est testé. */
  function charger(d: ParametresInternes = DONNEES): void {
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush(d);
    rendre();
    http.expectOne('/api/fiches-marche/42/ceremonie').flush({ message: 'Interdit' }, { status: 403, statusText: 'Forbidden' });
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

  it('titulaire : membres de la CAO en lecture, parts, avertissement, journal ; l’enregistrement envoie quorum, date et dépositaire', () => {
    monter();
    charger();
    expect(texte(racine().querySelector('.badge'))).toBe('Paramètres incomplets');
    expect(texte(racine().querySelector('.pi__anomalies'))).toContain('SE_CEREMONIE');
    expect(texte(racine().querySelector('.alert-warning'))).toContain('Le quorum est égal au nombre de membres');
    expect(Array.from(racine().querySelectorAll('.pi__membres li')).map((li) => texte(li))).toEqual(['Rakoto K000000001', 'Rabe K000000002']);
    expect(racine().querySelectorAll('.pi__membres input').length).toBe(0);
    expect(texte(racine().querySelector('#pi-nombre-parts'))).toBe('2 + 1 part de secours');
    expect(texte(racine().querySelector('#pi-responsable'))).toContain('Randria (RESP01)');
    expect(Array.from(racine().querySelectorAll('.pi__journal tbody tr td')).map((td) => texte(td))).toEqual(['27/09/2026 10:00', 'Randria', 'quorum', '—', '2']);

    saisir(racine().querySelector('#pi-ceremonie'), '2026-10-01T09:00');
    const champsDepositaire = racine().querySelectorAll('.pi__depositaire input');
    saisir(champsDepositaire[0], ' Dépositaire de la procédure ');
    saisir(champsDepositaire[1], 'Étude notariale');
    saisir(champsDepositaire[4], 'depositaire@exemple.mg');
    rendre();
    (racine().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
    const put = http.expectOne('/api/fiches-marche/42/parametres-internes');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      quorum: 2,
      dateCeremonie: '2026-10-01T09:00',
      depositaire: { nom: 'Dépositaire de la procédure', organisme: 'Étude notariale', fonction: null, contact: null, email: 'depositaire@exemple.mg', telephone: null },
    });
    put.flush({ ...DONNEES, dateCeremonie: '2026-10-01T09:00', etat: 'COMPLETS', anomalies: [] });
    rendre();
    expect(texte(racine().querySelector('.badge'))).toBe('Paramètres complets');
    expect(toast.success).toHaveBeenCalledWith('Paramètres internes enregistrés — complets.');
  });

  it('400 nominatif sous le champ fautif ; 409 CEREMONIE_CLOSE nommé', () => {
    monter();
    charger();
    const form = racine().querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush({ message: 'Validation échouée', erreurs: [{ champ: 'quorum', message: 'Le quorum est compris entre 2 et le nombre de membres.' }] }, { status: 400, statusText: 'Bad Request' });
    rendre();
    expect(texte(racine().querySelector('#pi-quorum')?.parentElement?.querySelector('.form-error'))).toBe('Le quorum est compris entre 2 et le nombre de membres.');
    expect(toast.error).not.toHaveBeenCalled();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/fiches-marche/42/parametres-internes').flush({ message: 'Conflit', code: 'CEREMONIE_CLOSE' }, { status: 409, statusText: 'Conflict' });
    rendre();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('La cérémonie des clés est close'));
  });
});
