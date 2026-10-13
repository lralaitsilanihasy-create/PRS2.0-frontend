import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { SigmpTransitionStore } from '../../core/sigmp/sigmp-transition.store';
import { SigmpTransitionAdmin } from './sigmp-transition-admin';

describe('Transition SIGMP — écran Administrateur (manuel révisé, R3a)', () => {
  let fixture: ComponentFixture<SigmpTransitionAdmin>;
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (): HTMLButtonElement => racine().querySelector('.sta__actions button') as HTMLButtonElement;
  const EN_COURS = { finTransition: null, decisionReference: null, decisionDate: null, transitionEnCours: true, pied: 'Projet — équivalence SIGMP en attente' };

  beforeEach(() => {
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ imports: [SigmpTransitionAdmin], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SigmpTransitionAdmin);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('sans réglage : transition en cours sans terme, pied « en attente », rien à enregistrer', () => {
    http.expectOne('/api/parametres/sigmp-transition').flush(EN_COURS);
    fixture.detectChanges();
    expect(racine().textContent).toContain('Transition en cours');
    expect(racine().textContent).toContain('Projet — équivalence SIGMP en attente');
    expect(bouton().disabled).toBe(true);
  });

  it('enregistre la date de fin et la décision ; l’aperçu du pied suit la saisie ; le magasin partagé reçoit la valeur', () => {
    http.expectOne('/api/parametres/sigmp-transition').flush(EN_COURS);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.poser('finTransition', '2027-06-30');
    c.poser('decisionReference', '12/CNM/2026');
    c.poser('decisionDate', '2026-10-01');
    fixture.detectChanges();
    expect(racine().textContent).toContain('décision n° 12/CNM/2026 du 01/10/2026');
    bouton().click();
    const put = http.expectOne('/api/parametres/sigmp-transition');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ finTransition: '2027-06-30', decisionReference: '12/CNM/2026', decisionDate: '2026-10-01' });
    const regle = { ...EN_COURS, finTransition: '2027-06-30', decisionReference: '12/CNM/2026', decisionDate: '2026-10-01', pied: 'Document produit par la plateforme PRS 2.0 en application de la décision n° 12/CNM/2026 du 01/10/2026' };
    put.flush(regle);
    fixture.detectChanges();
    expect(racine().textContent).toContain('jusqu’au 30/06/2027');
    expect(TestBed.inject(SigmpTransitionStore).pied()).toBe(regle.pied);
    expect(toast.success).toHaveBeenCalled();
  });

  it('une décision incomplète est refusée champ par champ', () => {
    http.expectOne('/api/parametres/sigmp-transition').flush(EN_COURS);
    fixture.detectChanges();
    fixture.componentInstance.poser('decisionReference', '12/CNM/2026');
    fixture.detectChanges();
    bouton().click();
    http.expectOne('/api/parametres/sigmp-transition').flush({ erreurs: [{ champ: 'decisionDate', message: 'La date de la décision est requise.' }] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().querySelector('.form-error')?.textContent).toContain('date de la décision');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
