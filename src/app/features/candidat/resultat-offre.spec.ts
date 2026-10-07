import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../core/notifications/toast.service';
import { ResultatOffre } from '../../models';
import { ResultatOffreCandidat } from './resultat-offre';

// Attribution (tranches 2b, 2c) — le résultat d'une offre, côté candidat.
const BASE: ResultatOffre = {
  idOffre: 'o-2', numero: 2, lot: null, retenu: false, motifRejet: 'Garantie insuffisante (DPAO 6.6)', attributaire: 'Entreprise de recette',
  montant: 166000000, montantTtc: 201600000, delai: '3 mois', lettreDisponible: true, dateInformation: '2026-10-07T16:05:00',
  dateAffichage: '2026-10-07', finDelai: '2026-10-17', signableLe: '2026-10-18',
};

describe('Résultat de l’offre, côté candidat', () => {
  let fixture: ComponentFixture<ResultatOffreCandidat>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function monter(id: string): void {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn() } }] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResultatOffreCandidat);
    fixture.componentRef.setInput('idOffre', id);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('avant l’information (404) : rien ne s’affiche', () => {
    monter('o-2');
    http.expectOne('/api/candidat/offres/o-2/resultat').flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(racine().querySelector('section')).toBeNull();
  });

  it('non retenue : le motif, la lettre, et la demande d’explication écrite', () => {
    monter('o-2');
    http.expectOne('/api/candidat/offres/o-2/resultat').flush(BASE);
    http.expectOne('/api/candidat/offres/o-2/explications').flush([]);
    fixture.detectChanges();
    expect(racine().textContent).toContain('Offre non retenue');
    expect(racine().textContent).toContain('Garantie insuffisante');
    const zone = racine().querySelector('textarea') as HTMLTextAreaElement;
    zone.value = 'Quel montant de garantie était exigé ?';
    zone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer la demande')) as HTMLButtonElement).click();
    const post = http.expectOne('/api/candidat/offres/o-2/explication');
    expect(post.request.body).toEqual({ question: 'Quel montant de garantie était exigé ?' });
    post.flush({ id: 1, idOffre: 'o-2', numero: 2, candidat: null, question: 'Quel montant de garantie était exigé ?', demandeeLe: '2026-10-07T17:00:00', etat: 'EN_ATTENTE', reponse: null, reponseNom: null, reponseTaille: null, reponduLe: null });
    fixture.detectChanges();
    expect(racine().textContent).toContain('En attente de la réponse écrite');
  });

  it('attributaire : il dépose sa pièce fiscale ; une pièce trop ancienne est nommée', () => {
    monter('o-4');
    http.expectOne('/api/candidat/offres/o-4/resultat').flush({ ...BASE, idOffre: 'o-4', retenu: true, motifRejet: null, piecesAttributaire: { echeance: '2026-10-22', delaiDepasse: false, fiscaleConforme: null, socialeConforme: null, pieces: [] } });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Votre offre est retenue');
    const date = racine().querySelector('.ro__pieces input[type=date]') as HTMLInputElement;
    date.value = '2026-01-15';
    date.dispatchEvent(new Event('input'));
    const fichier = racine().querySelector('.ro__pieces input[type=file]') as HTMLInputElement;
    Object.defineProperty(fichier, 'files', { value: [new File(['%PDF'], 'fiscale.pdf', { type: 'application/pdf' })] });
    fichier.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Déposer') as HTMLButtonElement).click();
    const post = http.expectOne('/api/candidat/offres/o-4/pieces-attributaire');
    expect((post.request.body as FormData).get('type')).toBe('FISCALE');
    post.flush({ code: 'PIECE_PERIMEE', message: 'x' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().querySelector('.form-error')?.textContent).toContain('moins de six mois');
  });
});
