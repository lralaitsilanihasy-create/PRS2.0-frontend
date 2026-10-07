import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/notifications/toast.service';
import { AmiPublic } from '../../models';
import { AmiEnLigneDetail } from './ami-en-ligne-detail';

// AMI en ligne, tranche AMI-a (07/10, V82) — l'appel publié, côté candidat.
const AMI: AmiPublic = {
  idDmc: 50, reference: 'AMI-50', objet: 'Étude de faisabilité', autoriteContractante: 'Ministère', dateLimite: '2026-11-02T10:00:00',
  criteres: [{ code: 'C1', libelle: 'Expérience', poids: 100, description: null }], pieces: ['Lettre signée', 'Références'], nombreRetenus: 6,
  publications: [], publieLe: '2026-10-08T09:00:00', ouvert: true,
};

describe('Appel à manifestation d’intérêt, côté candidat', () => {
  let fixture: ComponentFixture<AmiEnLigneDetail>;
  let http: HttpTestingController;
  const racine = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bouton = (texte: string): HTMLButtonElement =>
    Array.from(racine().querySelectorAll('button')).find((b) => b.textContent?.includes(texte)) as HTMLButtonElement;

  function monter(connecte: boolean): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ idDmc: '50' }) } } },
        { provide: AuthService, useValue: { role: signal(connecte ? 'CANDIDAT' : null), isAuthenticated: () => connecte } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AmiEnLigneDetail);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('sans session : l’appel se lit, le dépôt demande la connexion', () => {
    monter(false);
    http.expectOne('/api/amis-en-ligne/50').flush(AMI);
    fixture.detectChanges();
    expect(racine().textContent).toContain('Étude de faisabilité');
    expect(racine().textContent).toContain('connectez-vous');
    expect(racine().querySelector('#aed-lettre')).toBeNull();
  });

  it('dépose : un fichier par pièce attendue, renommé par rang, nommé dans la partie expression', () => {
    monter(true);
    http.expectOne('/api/amis-en-ligne/50').flush(AMI);
    http.expectOne('/api/candidat/amis/50/expression').flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.lettre.set('Nous manifestons notre intérêt.');
    fixture.detectChanges();
    expect(bouton('Déposer l’expression').disabled).toBe(true);
    const pdf = (nom: string) => new File(['%PDF-1.4'], nom, { type: 'application/pdf' });
    c.fichiers.set({ 'Lettre signée': pdf('doc.pdf'), Références: pdf('doc.pdf') });
    fixture.detectChanges();
    bouton('Déposer l’expression').click();
    const post = http.expectOne('/api/candidat/amis/50/expression');
    const fd = post.request.body as FormData;
    expect(JSON.parse(fd.get('expression') as string)).toEqual({
      lettre: 'Nous manifestons notre intérêt.', qualifications: null, references: [], groupement: [],
      pieces: [{ libelle: 'Lettre signée', fichier: 'p1-doc.pdf' }, { libelle: 'Références', fichier: 'p2-doc.pdf' }],
    });
    expect((fd.getAll('fichiers') as File[]).map((f) => f.name)).toEqual(['p1-doc.pdf', 'p2-doc.pdf']);
    post.flush({ message: 'x', code: 'PIECES_MANQUANTES', details: { pieces: ['Références'] } }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(racine().textContent).toContain('Des pièces attendues manquent : Références.');
  });

  it('déjà déposée : l’accusé, le remplacement et le retrait', () => {
    monter(true);
    http.expectOne('/api/amis-en-ligne/50').flush(AMI);
    http.expectOne('/api/candidat/amis/50/expression').flush({
      id: 'e-1', numero: 3, nif: '1234567890', raisonSociale: 'Cabinet', etat: 'DEPOSEE', deposeeLe: '2026-10-09T08:00:00', empreinte: 'f00d',
      lettre: 'Intérêt.', qualifications: null, references: [], groupement: [], pieces: [],
    });
    fixture.detectChanges();
    expect(racine().textContent).toContain('n° 3');
    expect(racine().querySelector('#aed-lettre')).toBeNull();
    bouton('Retirer').click();
    http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/candidat/amis/50/expression').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(racine().querySelector('#aed-lettre')).not.toBeNull();
  });
});
