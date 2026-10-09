import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, PieceJointeDossier, Role, TypePieceJointe } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierPieces } from './dossier-pieces';

const EXIGEES: TypePieceJointe[] = [
  { idTypePiece: 7, libellePiece: 'Projet de DAO', obligatoire: true, code: 'DAO_COMPLET', ordre: 2 },
  { idTypePiece: 3, libellePiece: 'Fiche de présentation signée', obligatoire: true, code: 'FICHE_PRESENTATION', ordre: 1 },
  { idTypePiece: 9, libellePiece: 'Bordereau des prix', obligatoire: false, code: 'BORDEREAU_PRIX', ordre: 3 },
];
const JOINTE = { idPiece: 1, idDossier: 42, idTypePiece: 3, libellePiece: 'Fiche de présentation signée', nomFichier: 'fiche.pdf' } as PieceJointeDossier;

/** Monte l'onglet sur un dossier ; répond aux pièces déposées et aux pièces exigées. */
function monter(statut: Dossier['statut']): { el: HTMLElement; exigeesDemandees: boolean } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), DossierContenuStore, { provide: AuthService, useValue: { role: signal<Role | null>('PRMP') } }],
  });
  const store = TestBed.inject(DossierContenuStore);
  store.charger(signal({ idDossier: 42, idTypeDossier: 'DMC', idSousType: 'DAOO', statut, idLocalite: 'ANT' } as Dossier));
  const fixture = TestBed.createComponent(DossierPieces);
  const http = TestBed.inject(HttpTestingController);
  let exigeesDemandees = false;
  for (let tour = 0; tour < 4; tour++) {
    fixture.detectChanges();
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        const url = req.request.url;
        if (url.endsWith('/pieces-exigees')) {
          exigeesDemandees = true;
          req.flush(EXIGEES);
        } else if (url.includes('piece-jointe-dossiers')) req.flush([JOINTE]);
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else if (url.includes('diff')) req.flush({ lignes: [] });
        else req.flush([]);
      }
    }
  }
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, exigeesDemandees };
}

const texte = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('DossierPieces — pièces exigées par sous-type (manuel de contrôle, M2)', () => {
  it('en brouillon : la liste exigée du dossier, dans l’ordre, cochée pièce par pièce', () => {
    const { el, exigeesDemandees } = monter('BROUILLON');
    expect(exigeesDemandees).toBe(true);
    const lignes = Array.from(el.querySelectorAll('.pe-ligne')).map((l) => Array.from(l.children).map(texte).join(' | '));
    expect(lignes).toEqual([
      '✓ | Fiche de présentation signée | jointe',
      '✕ | Projet de DAO | obligatoire, manquante',
      '– | Bordereau des prix | facultative',
    ]);
    expect(texte(el.querySelector('.pieces-group-hd'))).toContain('1 obligatoire(s) manquante(s)');
  });

  it('hors brouillon : la liste n’est ni demandée ni montrée', () => {
    const { el, exigeesDemandees } = monter('SOUMIS');
    expect(exigeesDemandees).toBe(false);
    expect(el.querySelector('.pe-ligne')).toBeNull();
  });
});
