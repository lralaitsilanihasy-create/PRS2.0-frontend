import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FicheSpecifications } from './fiche-specifications';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF = 'application/pdf';

// ⚠️ 17/10 (demande specifications-donnees-et-plans-pdf, B1) — le devis descriptif et les plans des travaux : un PDF, 50 Mo.
describe('Devis descriptif et plans de la fiche de travaux (V73, refondu le 17/10)', () => {
  let fixture: ComponentFixture<FicheSpecifications>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const rendre = (): void => fixture.detectChanges();

  function monter(lecture = false, fichier: object | null = null): void {
    TestBed.configureTestingModule({ imports: [FicheSpecifications], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FicheSpecifications);
    fixture.componentRef.setInput('idDmc', 42);
    fixture.componentRef.setInput('lecture', lecture);
    rendre();
    const q = http.expectOne('/api/fiches-marche/42/specifications');
    if (fichier) q.flush(fichier);
    else q.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    rendre();
  }

  function choisir(f: File): void {
    const champ = racine().querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(champ, 'files', { value: [f], configurable: true });
    champ.dispatchEvent(new Event('change'));
    rendre();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('sans fichier : la pièce manquera au dossier ; un PDF part en PUT multipart, puis s’affiche', () => {
    monter();
    expect(racine().textContent).toContain('Aucun PDF');
    expect(racine().querySelector('input[type=file]')?.getAttribute('accept')).toContain('.pdf');
    choisir(new File(['x'], 'plans.pdf', { type: PDF }));
    const put = http.expectOne('/api/fiches-marche/42/specifications');
    expect(put.request.method).toBe('PUT');
    expect((put.request.body as FormData).get('fichier')).toBeTruthy();
    put.flush({ nomFichier: 'plans.pdf', taille: 2048, deposeLe: '2026-10-17T10:00:00', deposePar: 'PRMP' });
    rendre();
    expect(racine().textContent).toContain('plans.pdf');
    expect(Array.from(racine().querySelectorAll('button')).map((b) => b.textContent?.trim())).toContain('Ouvrir le PDF');
  });

  it('un Word est refusé avant tout envoi ; un 413 est nommé à 50 Mo', () => {
    monter();
    choisir(new File(['x'], 'specs.docx', { type: DOCX }));
    expect(racine().querySelector('.form-error')).not.toBeNull();
    choisir(new File(['x'], 'gros.pdf', { type: PDF }));
    http.expectOne('/api/fiches-marche/42/specifications').flush({ message: 'trop gros' }, { status: 413, statusText: 'Payload Too Large' });
    rendre();
    expect(racine().querySelector('.form-error')?.textContent).toContain('50 Mo');
  });

  it('retirer : DELETE ; en lecture, aucun geste d’écriture', () => {
    monter(false, { nomFichier: 'plans.pdf', taille: 2048, deposeLe: null, deposePar: null });
    (Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes('Retirer')) as HTMLButtonElement).click();
    const del = http.expectOne('/api/fiches-marche/42/specifications');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    rendre();
    expect(racine().textContent).toContain('Aucun PDF');
    TestBed.resetTestingModule();
    monter(true, { nomFichier: 'plans.pdf', taille: 2048, deposeLe: null, deposePar: null });
    expect(racine().querySelector('input[type=file]')).toBeNull();
    expect(Array.from(racine().querySelectorAll('button')).some((b) => b.textContent?.includes('Retirer'))).toBe(false);
  });
});
