import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { CompteDaoAdmin } from './compte-dao-admin';

describe('Compte bancaire de l’ARMP — prix des DAO (avis spécifique §B8, 01/10)', () => {
  let fixture: ComponentFixture<CompteDaoAdmin>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const champs = (): HTMLInputElement[] => Array.from(racine().querySelectorAll('input'));
  const saisir = (i: number, v: string): void => { champs()[i].value = v; champs()[i].dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const bouton = (): HTMLButtonElement => Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith('Enregistrer'))!;

  beforeEach(() => {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [CompteDaoAdmin], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CompteDaoAdmin);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('non réglé : l’alerte, l’aperçu en pointillés, et l’enregistrement attend les trois informations', () => {
    http.expectOne('/api/parametres/compte-dao').flush({ banque: null, titulaire: null, numeroCompte: null });
    fixture.detectChanges();
    expect(texte(racine().querySelector('.alert-warning'))).toContain('pas encore réglé');
    expect(texte(racine().querySelector('.cda__apercu'))).toContain('………, compte n° ……… au nom de ………');
    expect(bouton().disabled).toBe(true);
    saisir(0, 'BFV-SG');
    saisir(1, 'ARMP');
    saisir(2, '00008 00001 05000012345 67');
    expect(texte(racine().querySelector('.cda__apercu'))).toContain('BFV-SG, compte n° 00008 00001 05000012345 67 au nom de ARMP');
    bouton().click();
    const req = http.expectOne('/api/parametres/compte-dao');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ banque: 'BFV-SG', titulaire: 'ARMP', numeroCompte: '00008 00001 05000012345 67' });
    req.flush({ banque: 'BFV-SG', titulaire: 'ARMP', numeroCompte: '00008 00001 05000012345 67', misAJourLe: '2026-10-01T10:00:00', misAJourPar: 'ADMIN01' });
    fixture.detectChanges();
    expect(toast.success).toHaveBeenCalled();
    expect(racine().querySelector('.alert-warning')).toBeNull();
    expect(texte(racine().querySelector('.cda__maj'))).toBe('Réglé le 01/10/2026 par ADMIN01');
  });

  it('un refus nominatif (400) s’affiche sous le champ', () => {
    http.expectOne('/api/parametres/compte-dao').flush({ banque: 'BFV-SG', titulaire: 'ARMP', numeroCompte: '1' });
    fixture.detectChanges();
    bouton().click();
    http.expectOne('/api/parametres/compte-dao').flush(
      { status: 400, message: 'Validation échouée', erreurs: [{ champ: 'numeroCompte', message: 'Le numéro de compte est invalide.' }] },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(texte(racine().querySelector('.form-error'))).toBe('Le numéro de compte est invalide.');
  });
});
