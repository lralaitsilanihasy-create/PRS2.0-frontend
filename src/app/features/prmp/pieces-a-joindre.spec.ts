import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TypePieceJointe } from '../../models';
import { PiecesAJoindre, piecesAJoindre } from './pieces-a-joindre';

// ⚠️ 15/10 (V119) — le brouillon d'un dossier produit par la fiche DAO : les pièces qui ne sortent pas de la fiche se joignent ici.
const DAO: TypePieceJointe = { idTypePiece: 6, libellePiece: 'Dossier d’appel d’offres complet', obligatoire: true, code: 'DAO_COMPLET' };
const PLANS: TypePieceJointe = { idTypePiece: 90, libellePiece: 'Descriptif technique et plans des travaux', obligatoire: true, code: 'DESCRIPTIF_PLANS' };

describe('Pièces à joindre au brouillon d’un dossier produit par la fiche', () => {
  let http: HttpTestingController;
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('les obligatoires manquantes d’abord', () => {
    http = { verify: () => undefined } as unknown as HttpTestingController;
    const l = piecesAJoindre([DAO, PLANS], [{ idPiece: 1, idDossier: 5, idTypePiece: 6, nomFichier: 'dao.pdf', idDocumentFiche: 3 }]);
    expect(l.map((x) => x.type.code)).toEqual(['DESCRIPTIF_PLANS', 'DAO_COMPLET']);
  });

  it('joindre plusieurs fichiers sous la même pièce ; une pièce de la fiche ne se retire pas', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PiecesAJoindre);
    f.componentRef.setInput('idDossier', 5);
    f.detectChanges();
    http.expectOne('/api/dossiers/5/pieces-exigees').flush([DAO, PLANS]);
    http.expectOne((r) => r.url === '/api/piece-jointe-dossiers' && r.params.get('dossier') === '5')
      .flush([{ idPiece: 1, idDossier: 5, idTypePiece: 6, nomFichier: 'dao.pdf', idDocumentFiche: 3 }]);
    http.expectOne('/api/dossiers/5/publication-agpm').flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const texte = () => (el.textContent ?? '').replace(/\s+/g, ' ');
    expect(texte()).toContain('1 pièce(s) obligatoire(s) à joindre');
    expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.includes('Retirer')).length).toBe(0);

    for (const [i, nom] of ['descriptif.pdf', 'plan-1.png'].entries()) {
      const champ = el.querySelector('input[aria-label="Joindre : Descriptif technique et plans des travaux"]') as HTMLInputElement;
      Object.defineProperty(champ, 'files', { value: [new File(['x'], nom, { type: nom.endsWith('.png') ? 'image/png' : 'application/pdf' })], configurable: true });
      champ.dispatchEvent(new Event('change'));
      const req = http.expectOne('/api/piece-jointe-dossiers');
      expect(req.request.method).toBe('POST');
      req.flush({ idPiece: 10 + i, idDossier: 5, idTypePiece: 90, nomFichier: nom });
      f.detectChanges();
    }
    expect(texte()).toContain('2 fichier(s)');
    expect(texte()).toContain('Toutes les pièces obligatoires sont jointes');
    expect(Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.includes('Retirer')).length).toBe(2);
  });

  it('18/10 — la publication de l’AGPM déposée sur le plan ne manque pas : elle est reprise d’office à la soumission', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PiecesAJoindre);
    f.componentRef.setInput('idDossier', 5);
    f.detectChanges();
    http.expectOne('/api/dossiers/5/pieces-exigees').flush([{ idTypePiece: 4, libellePiece: 'Publication de l’AGPM (journal)', obligatoire: true, code: 'PUBLICATION_AGPM' }]);
    http.expectOne((r) => r.url === '/api/piece-jointe-dossiers').flush([]);
    http.expectOne('/api/dossiers/5/publication-agpm').flush({ idPublication: 1, idDossierPlan: 9, journal: 'Midi', dateParution: '2026-10-01', referenceAgpm: 'AGPM' });
    f.detectChanges();
    const texte = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(texte).toContain('déposée sur le plan, reprise d’office à la soumission');
    expect(texte).toContain('Toutes les pièces obligatoires sont jointes');
  });
});
