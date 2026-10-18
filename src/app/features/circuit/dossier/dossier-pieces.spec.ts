import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, PieceJointeDossier, Role, TypePieceJointe } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierPieces, pieceManquante } from './dossier-pieces';

const EXIGEES: TypePieceJointe[] = [
  { idTypePiece: 7, libellePiece: 'Projet de DAO', obligatoire: true, code: 'DAO_COMPLET', ordre: 2 },
  { idTypePiece: 3, libellePiece: 'Fiche de présentation signée', obligatoire: true, code: 'FICHE_PRESENTATION', ordre: 1 },
  { idTypePiece: 9, libellePiece: 'Bordereau des prix', obligatoire: false, code: 'BORDEREAU_PRIX', ordre: 3 },
];
const JOINTE = { idPiece: 1, idDossier: 42, idTypePiece: 3, libellePiece: 'Fiche de présentation signée', nomFichier: 'fiche.pdf' } as PieceJointeDossier;

/** Monte l'onglet sur un dossier ; répond aux pièces déposées et aux pièces exigées. */
function monter(statut: Dossier['statut'], exigees: TypePieceJointe[] = EXIGEES, idDmc: number | null = null): { el: HTMLElement; exigeesDemandees: boolean; composant: DossierPieces } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), DossierContenuStore, { provide: AuthService, useValue: { role: signal<Role | null>('PRMP') } }],
  });
  const store = TestBed.inject(DossierContenuStore);
  store.charger(signal({ idDossier: 42, idTypeDossier: 'DMC', idSousType: 'DAOO', statut, idLocalite: 'ANT', idDmc } as Dossier));
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
          req.flush(exigees);
        } else if (url.includes('piece-jointe-dossiers')) req.flush([JOINTE]);
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else if (url.includes('diff')) req.flush({ lignes: [] });
        else req.flush([]);
      }
    }
  }
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, exigeesDemandees, composant: fixture.componentInstance };
}

const texte = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('DossierPieces — pièces exigées par sous-type (manuel de contrôle, M2)', () => {
  it('en brouillon : la liste exigée du dossier, dans l’ordre, cochée pièce par pièce', () => {
    const { el, exigeesDemandees } = monter('BROUILLON');
    expect(exigeesDemandees).toBe(true);
    const lignes = Array.from(el.querySelectorAll('.pe-ligne')).map((l) => Array.from(l.children).map(texte).join(' | '));
    expect(lignes).toEqual([
      '✓ | Fiche de présentation signée | Ajouter des fichiers',
      '✕ | Projet de DAO | obligatoire, manquante | Joindre',
      '– | Bordereau des prix | facultative | Joindre',
    ]);
    expect(texte(el.querySelector('.pieces-group-hd'))).toContain('1 obligatoire(s) manquante(s)');
  });

  it('18/10 — le fichier déposé s’affiche sous sa pièce, et n’est pas répété dans une seconde liste', () => {
    const { el } = monter('BROUILLON');
    const fichiers = Array.from(el.querySelectorAll('.pe-fichier')).map(texte);
    expect(fichiers.length).toBe(1);
    expect(fichiers[0]).toContain('fiche.pdf');
    expect(el.querySelectorAll('.piece-row').length).toBe(0);
  });

  it('18/10 — dossier né d’une fiche : une pièce que montre un onglet n’est plus listée, un renvoi mène à l’onglet', () => {
    const { el, composant } = monter('BROUILLON', [
      { idTypePiece: 28, libellePiece: 'Calendrier annuel', obligatoire: true, code: 'CALENDRIER', ordre: 1, fourniePar: 'APPLICATION' },
      { idTypePiece: 30, libellePiece: 'AGPM contrôlé', obligatoire: true, code: 'AGPM_CONTROLE', ordre: 2, fourniePar: 'APPLICATION' },
      { idTypePiece: 29, libellePiece: 'Publication de l’AGPM (journal)', obligatoire: true, code: 'PUBLICATION_AGPM', ordre: 3 },
    ], 1);
    const lignes = Array.from(el.querySelectorAll('.pe-ligne')).map((l) => Array.from(l.children).map(texte).join(' | '));
    expect(lignes).toEqual(['✕ | Publication de l’AGPM (journal) | obligatoire, manquante | Joindre']);
    const liens = Array.from(el.querySelectorAll('.pe-lien')) as HTMLButtonElement[];
    expect(liens.map(texte)).toEqual(['Plan de passation']);
    expect(liens[0].title).toBe('Calendrier annuel ; AGPM contrôlé');
    const emis: string[] = [];
    composant.voir.subscribe((o) => emis.push(o));
    liens[0].click();
    expect(emis).toEqual(['plan']);
  });

  it('hors brouillon : la liste n’est ni demandée ni montrée', () => {
    const { el, exigeesDemandees } = monter('SOUMIS');
    expect(exigeesDemandees).toBe(false);
    expect(el.querySelector('.pe-ligne')).toBeNull();
  });

  it('17/10 — une pièce fournie par l’application est cochée, ne compte pas manquante, et s’ouvre', () => {
    const { el } = monter('BROUILLON', [
      { idTypePiece: 28, libellePiece: 'AGPM (ou PPM) signé et contrôlé, avec le PV de la Commission', obligatoire: true, code: 'AGPM_CONTROLE', ordre: 1, fourniePar: 'APPLICATION', lien: '/api/pv-examens/61/document', idDossierPlan: 100379, idPvPlan: 61 },
      { idTypePiece: 29, libellePiece: 'Publication de l’AGPM (journal)', obligatoire: true, code: 'PUBLICATION_AGPM', ordre: 2 },
    ]);
    const lignes = Array.from(el.querySelectorAll('.pe-ligne')).map((l) => Array.from(l.children).map(texte).join(' | '));
    expect(lignes).toEqual([
      '✓ | AGPM (ou PPM) signé et contrôlé, avec le PV de la Commission | fournie par l’application | Ouvrir',
      '✕ | Publication de l’AGPM (journal) | obligatoire, manquante | Joindre',
    ]);
    expect(texte(el.querySelector('.pieces-group-hd'))).toContain('1 obligatoire(s) manquante(s)');
    (el.querySelector('.pe-ouvrir') as HTMLButtonElement).click();
    const http = TestBed.inject(HttpTestingController);
    const pv = http.expectOne('/api/pv-examens/61/document');
    expect(pv.request.responseType).toBe('blob');
  });
});

describe('pieceManquante — la règle partagée par la liste des pièces et le bouton « Soumettre » (18/10)', () => {
  const PUB: TypePieceJointe = { idTypePiece: 4, libellePiece: 'Publication de l’AGPM (journal)', obligatoire: true, code: 'PUBLICATION_AGPM' };
  it('manque : obligatoire, ni fournie, ni déposée sur le plan, ni jointe', () => {
    expect(pieceManquante(PUB, [], null)).toBe(true);
  });
  it('ne manque pas : jointe, déposée sur le plan, fournie par l’application, ou facultative', () => {
    expect(pieceManquante(PUB, [{ idPiece: 1, idDossier: 42, idTypePiece: 4 } as PieceJointeDossier], null)).toBe(false);
    expect(pieceManquante(PUB, [], { idPublication: 1 } as never)).toBe(false);
    expect(pieceManquante({ ...PUB, code: 'FICHE_PRESENTATION', fourniePar: 'APPLICATION' }, [], null)).toBe(false);
    expect(pieceManquante({ ...PUB, code: 'AUTRE_DOCUMENT', obligatoire: false }, [], null)).toBe(false);
  });
});
