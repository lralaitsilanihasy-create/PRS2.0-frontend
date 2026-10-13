import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { CaoQuorumAdmin } from './cao-quorum-admin';

describe('Quorum de la CAO — écran Administrateur (manuel révisé, R1 — V101)', () => {
  let fixture: ComponentFixture<CaoQuorumAdmin>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const radio = (valeur: string): HTMLInputElement => racine().querySelector(`input[type=radio][value=${valeur}]`) as HTMLInputElement;
  const bouton = (): HTMLButtonElement => racine().querySelector('button[type=submit]') as HTMLButtonElement;

  beforeEach(() => {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [CaoQuorumAdmin], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaoQuorumAdmin);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lit la règle en vigueur (majorité) et n’enregistre que si elle change', () => {
    http.expectOne('/api/parametres/cao-quorum').flush({ regle: 'MAJORITE' });
    fixture.detectChanges();
    expect(radio('MAJORITE').checked).toBe(true);
    expect(racine().textContent).toContain('majorité des membres désignés');
    expect(bouton().disabled).toBe(true);
  });

  it('un nombre : envoie la valeur en chaîne, puis affiche la règle réglée', () => {
    http.expectOne('/api/parametres/cao-quorum').flush({ regle: 'MAJORITE' });
    fixture.detectChanges();
    fixture.componentInstance.mode.set('NOMBRE');
    fixture.componentInstance.nombre.set('1');
    fixture.detectChanges();
    expect(bouton().disabled).toBe(false);
    bouton().click();
    const put = http.expectOne('/api/parametres/cao-quorum');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ regle: '1' });
    put.flush({ regle: '1' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('au moins 1 membre(s)');
    expect(toast.success).toHaveBeenCalled();
  });

  it('une règle refusée par le serveur est nommée, sans toast', () => {
    http.expectOne('/api/parametres/cao-quorum').flush({ regle: 'TOUS' });
    fixture.detectChanges();
    fixture.componentInstance.mode.set('MAJORITE');
    fixture.detectChanges();
    bouton().click();
    http.expectOne('/api/parametres/cao-quorum').flush({ code: 'QUORUM_REGLE_INVALIDE', message: 'x' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().querySelector('[role=alert]')?.textContent).toContain('Règle refusée');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
