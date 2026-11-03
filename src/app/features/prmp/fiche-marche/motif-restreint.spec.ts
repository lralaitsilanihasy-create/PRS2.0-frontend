import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { MotifRestreint } from '../../../models';
import { MotifRestreintFiche } from './motif-restreint';

describe('Motif du recours à l’appel d’offres restreint (V155, demande du 02/11, B2)', () => {
  let fixture: ComponentFixture<MotifRestreintFiche>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (): HTMLButtonElement => racine().querySelector('.mr__pied button') as HTMLButtonElement;

  function monter(motif: MotifRestreint | null, lecture = false): void {
    TestBed.configureTestingModule({
      imports: [MotifRestreintFiche],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MotifRestreintFiche);
    fixture.componentRef.setInput('idDmc', 7);
    fixture.componentRef.setInput('motif', motif);
    fixture.componentRef.setInput('lecture', lecture);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('propose les quatre cas de la loi et n’enregistre qu’avec un cas et une justification', () => {
    monter(null);
    const cas = Array.from(racine().querySelectorAll('.mr__opt-l')).map(texte);
    expect(cas).toEqual(['1° Urgence avérée', '2° Caractère confidentiel', '3° Défaillance du prestataire', '4° Petit nombre de prestataires']);
    expect(texte(racine().querySelector('.mr__manque'))).toContain('à saisir');
    expect(bouton().disabled).toBe(true);

    (racine().querySelectorAll('input[type=radio]')[3] as HTMLInputElement).dispatchEvent(new Event('change'));
    const zone = racine().querySelector('textarea') as HTMLTextAreaElement;
    zone.value = '  Trois entreprises seulement disposent du matériel.  ';
    zone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(bouton().disabled).toBe(false);

    const emis: MotifRestreint[] = [];
    fixture.componentInstance.enregistre.subscribe((m) => emis.push(m));
    bouton().click();
    const req = http.expectOne('/api/fiches-marche/7/motif-restreint');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ motif: 'PETIT_NOMBRE', justification: 'Trois entreprises seulement disposent du matériel.' });
    req.flush({ motif: 'PETIT_NOMBRE', libelle: 'Petit nombre de prestataires', justification: 'Trois entreprises seulement disposent du matériel.', saisiLe: '2026-11-02T20:10:00' });
    expect(emis.length).toBe(1);
  });

  it('montre l’erreur nominative du serveur sous la justification', () => {
    monter(null);
    (racine().querySelectorAll('input[type=radio]')[0] as HTMLInputElement).dispatchEvent(new Event('change'));
    const zone = racine().querySelector('textarea') as HTMLTextAreaElement;
    zone.value = 'x';
    zone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    bouton().click();
    http.expectOne('/api/fiches-marche/7/motif-restreint').flush(
      [{ champ: 'justification', message: 'La justification du recours est obligatoire.' }],
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texte(racine().querySelector('.form-error'))).toContain('obligatoire');
  });

  it('se lit sur une fiche figée', () => {
    monter({ motif: 'URGENCE_AVEREE', libelle: 'Urgence avérée', justification: 'Saison des pluies.', saisiLe: null }, true);
    expect(racine().querySelector('textarea')).toBeNull();
    expect(texte(racine())).toContain('Urgence avérée');
    expect(texte(racine())).toContain('Saison des pluies.');
  });
});
