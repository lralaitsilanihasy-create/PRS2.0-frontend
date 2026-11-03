import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ToastService } from '../../../core/notifications/toast.service';
import { ListeRestreinte } from '../../../models';
import { ListeRestreinteFiche } from './liste-restreinte';

describe('Liste restreinte saisie (V156, demande du 02/11, B3)', () => {
  let fixture: ComponentFixture<ListeRestreinteFiche>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const enregistrer = (): HTMLButtonElement =>
    Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith('Enregistrer la liste')) as HTMLButtonElement;
  const ecrire = (el: Element, valeur: string): void => {
    (el as HTMLInputElement).value = valeur;
    el.dispatchEvent(new Event('input'));
  };

  function monter(liste: ListeRestreinte | null, lecture = false): void {
    TestBed.configureTestingModule({
      imports: [ListeRestreinteFiche],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ListeRestreinteFiche);
    fixture.componentRef.setInput('idDmc', 9);
    fixture.componentRef.setInput('liste', liste);
    fixture.componentRef.setInput('lecture', lecture);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('ouvre sur trois lignes vides et n’enregistre qu’avec une source et trois candidats complets', () => {
    monter(null);
    expect(racine().querySelectorAll('.lr__cand').length).toBe(3);
    expect(Array.from(racine().querySelectorAll('.lr__opt-l')).map(texte)).not.toContain('Appel public à candidatures');
    expect(enregistrer().disabled).toBe(true);

    (racine().querySelectorAll('input[type=radio]')[2] as HTMLInputElement).dispatchEvent(new Event('change'));
    racine().querySelectorAll('.lr__cand').forEach((li, i) => {
      ecrire(li.querySelector('.lr__ch--nom input')!, ` Entreprise ${i + 1} `);
      ecrire(li.querySelector('.lr__ch--adr textarea')!, `Lot ${i + 1}, Antananarivo`);
    });
    ecrire(racine().querySelectorAll('input[type=email]')[0], 'contact@e1.mg');
    fixture.detectChanges();
    expect(enregistrer().disabled).toBe(false);

    enregistrer().click();
    const req = http.expectOne('/api/fiches-marche/9/liste-restreinte');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.source).toBe('REGISTRE_ARMP');
    expect(req.request.body.candidats[0]).toEqual({ nom: 'Entreprise 1', adresse: 'Lot 1, Antananarivo', email: 'contact@e1.mg', idCandidat: null, nif: null });
    req.flush({ ...req.request.body, libelleSource: 'Registre de l’ARMP', saisiLe: '2026-11-02T22:00:00' });
  });

  it('place l’erreur nominative du serveur sous le champ du bon candidat', () => {
    monter({ source: 'BASE_AUTORITE', candidats: [{ nom: 'A', adresse: 'a' }, { nom: 'B', adresse: 'b' }, { nom: 'C', adresse: 'c' }] });
    ecrire(racine().querySelectorAll('.lr__cand')[1].querySelectorAll('input')[2], 'C000000099');
    fixture.detectChanges();
    enregistrer().click();
    http.expectOne('/api/fiches-marche/9/liste-restreinte').flush(
      [{ champ: 'candidats[1].idCandidat', message: 'Compte candidat inconnu : C000000099.' }],
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texte(racine().querySelectorAll('.lr__cand')[1].querySelector('.form-error'))).toContain('Compte candidat inconnu');
  });

  it('⚠️ V161 (B4) — la liste de l’appel à candidatures se lit sans se saisir ; la seconde voie est proposée tant que rien n’est saisi', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    monter({ source: 'APPEL_CANDIDATURES', libelleSource: 'Appel public à candidatures', candidats: [{ nom: 'A', adresse: 'a', idCandidat: 'C000000001' }, { nom: 'B', adresse: 'b' }, { nom: 'C', adresse: 'c' }] });
    expect(racine().querySelector('input')).toBeNull();
    expect(racine().querySelectorAll('.lr__lue li').length).toBe(3);
    expect(texte(racine())).toContain('compte C000000001');
    expect(racine().querySelector('.lr__appel')).toBeNull();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    monter(null);
    fixture.componentRef.setInput('lienAppel', ['/prmp', 'dao', 9, 'ami']);
    fixture.detectChanges();
    expect(racine().querySelector('.lr__appel a')?.getAttribute('href')).toBe('/prmp/dao/9/ami');
  });

  it('se lit sur une fiche figée', () => {
    monter({ source: 'ORGANISME_PROFESSIONNEL', libelleSource: 'Organisme professionnel', candidats: [{ nom: 'A', adresse: 'a', nif: '123' }] }, true);
    expect(racine().querySelector('input')).toBeNull();
    expect(texte(racine())).toContain('Organisme professionnel');
    expect(texte(racine())).toContain('NIF 123');
  });
});
