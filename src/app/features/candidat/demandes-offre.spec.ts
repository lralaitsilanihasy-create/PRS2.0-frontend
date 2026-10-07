import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { DemandeEvaluation } from '../../models';
import { DemandesOffre } from './demandes-offre';

// Évaluation des offres (07/10) — le candidat répond aux demandes de la commission sur son offre.
const PRECISION: DemandeEvaluation = {
  idDemande: 7, idOffre: 'o-1', numero: 1, type: 'PRECISION', question: 'Précisez le délai de livraison du lot 2.', delaiJours: 5,
  echeance: '2026-10-12T09:00:00', demandeeLe: '2026-10-07T09:00:00', etat: 'EN_ATTENTE', reponse: null, fichier: null, tailleFichier: null, reponduLe: null,
};
const JUSTIFICATION: DemandeEvaluation = { ...PRECISION, idDemande: 8, type: 'JUSTIFICATION', question: 'Justifiez le prix unitaire de l’article 3.', demandeeLe: '2026-10-07T10:00:00' };

describe('Demandes de la commission, côté candidat', () => {
  let fixture: ComponentFixture<DemandesOffre>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function monter(precisions: DemandeEvaluation[] | 'absent', justifications: DemandeEvaluation[]): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DemandesOffre);
    fixture.componentRef.setInput('idOffre', 'o-1');
    fixture.detectChanges();
    const p = http.expectOne('/api/candidat/offres/o-1/precisions');
    if (precisions === 'absent') p.flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    else p.flush(precisions);
    http.expectOne('/api/candidat/offres/o-1/justification').flush(justifications);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('sans demande (ou sans évaluation) : rien ne s’affiche', () => {
    monter('absent', []);
    expect(racine().querySelector('section')).toBeNull();
  });

  it('chaque demande part à sa route : précision par son numéro, justification sans numéro', () => {
    monter([PRECISION], [JUSTIFICATION]);
    const zones = racine().querySelectorAll('textarea');
    expect(zones.length).toBe(2);
    zones[0].value = 'Livraison sous 30 jours.';
    zones[0].dispatchEvent(new Event('input'));
    zones[1].value = 'Prix d’un fournisseur local.';
    zones[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const boutons = Array.from(racine().querySelectorAll('button')).filter((b) => b.textContent?.includes('Envoyer ma réponse')) as HTMLButtonElement[];
    boutons[0].click();
    const r1 = http.expectOne('/api/candidat/offres/o-1/precisions/7/reponse');
    expect((r1.request.body as FormData).get('texte')).toBe('Livraison sous 30 jours.');
    r1.flush({ ...PRECISION, etat: 'REPONDUE', reponse: 'Livraison sous 30 jours.', reponduLe: '2026-10-07T11:00:00' });
    boutons[1].click();
    const r2 = http.expectOne('/api/candidat/offres/o-1/justification/reponse');
    r2.flush({ message: 'x', code: 'DELAI_DEPASSE' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Votre réponse (');
    expect(racine().textContent).toContain('Le délai de réponse est passé.');
  });
});
