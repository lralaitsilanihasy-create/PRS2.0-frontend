import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { PublicationAvisDeposee } from '../../models';
import { PublicationAvisPanneau } from './publication-avis';

describe('Preuve de publication de l’avis (V154, §B2) et lettres avec accusé (V158, §B5)', () => {
  let fixture: ComponentFixture<PublicationAvisPanneau>;
  let http: HttpTestingController;

  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bouton = (debut: string): HTMLButtonElement | undefined =>
    Array.from(racine().querySelectorAll('button')).find((b) => texte(b).startsWith(debut));
  const deposer = (): HTMLButtonElement => racine().querySelector('.modal-footer .btn-primary') as HTMLButtonElement;
  const ecrire = (el: Element, valeur: string): void => {
    (el as HTMLInputElement).value = valeur;
    el.dispatchEvent(new Event('input'));
  };
  const choisirPdf = (): void => {
    const input = racine().querySelector('input[type=file]') as HTMLInputElement;
    const pdf = new File(['%PDF-1.4'], 'lettres.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [pdf] });
    input.dispatchEvent(new Event('change'));
  };

  function monter(role: string, lettres: boolean, publication: PublicationAvisDeposee | null): void {
    TestBed.configureTestingModule({
      imports: [PublicationAvisPanneau],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { role: signal(role) } }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicationAvisPanneau);
    fixture.componentRef.setInput('idDmc', 7);
    fixture.componentRef.setInput('lettres', lettres);
    fixture.detectChanges();
    const req = http.expectOne('/api/fiches-marche/7/publication-avis');
    if (publication) req.flush(publication);
    else req.flush({ code: 'PUBLICATION_AVIS_ABSENTE' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('dépose les lettres avec accusé sans journal, date d’envoi seule', () => {
    monter('PRMP', true, null);
    expect(texte(racine())).toContain('Lettres d’invitation avec accusé : pas encore déposée');
    bouton('Déposer les lettres avec accusé')!.click();
    fixture.detectChanges();
    expect(texte(racine())).toContain('Date d’envoi des lettres');
    choisirPdf();
    ecrire(racine().querySelector('input[type=date]')!, '2026-11-02');
    fixture.detectChanges();
    expect(deposer().disabled).toBe(false);
    deposer().click();
    const req = http.expectOne('/api/fiches-marche/7/publication-avis');
    const fd = req.request.body as FormData;
    expect(fd.get('dateParution')).toBe('2026-11-02');
    expect(fd.has('journal')).toBe(false);
    req.flush({ idPublication: 1, idDmc: 7, nature: 'LETTRES_INVITATION', dateParution: '2026-11-02', deposePar: 'PRMP001', deposeLe: '2026-11-03T08:00:00' });
    fixture.detectChanges();
    expect(texte(racine())).toContain('envoyées le 02/11/2026');
    expect(bouton('Ouvrir les lettres (PDF)')).toBeTruthy();
  });

  it('exige le journal pour l’avis et nomme le refus avant l’impression', () => {
    monter('UGPM', false, null);
    bouton('Déposer la publication de l’avis')!.click();
    fixture.detectChanges();
    choisirPdf();
    ecrire(racine().querySelector('input[type=date]')!, '2026-11-02');
    fixture.detectChanges();
    expect(deposer().disabled).toBe(true);
    ecrire(racine().querySelectorAll('.modal input[type=text]')[0], 'Midi Madagasikara');
    fixture.detectChanges();
    deposer().click();
    http.expectOne('/api/fiches-marche/7/publication-avis').flush({ code: 'AVIS_NON_PUBLIE' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(texte(racine().querySelector('.modal [role=alert]'))).toContain('pas encore imprimé');
  });

  it('se lit seulement hors PRMP et UGPM, et se tait sans dépôt', () => {
    monter('PRESIDENT', true, { idPublication: 1, idDmc: 7, nature: 'LETTRES_INVITATION', dateParution: '2026-11-02' });
    expect(bouton('Remplacer')).toBeUndefined();
    expect(bouton('Ouvrir les lettres (PDF)')).toBeTruthy();
    TestBed.resetTestingModule();
    monter('PRESIDENT', true, null);
    expect(racine().querySelector('section')).toBeNull();
  });
});
