import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Dossier, PieceJointeDossier, Role, TypePieceJointe } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { DossierPieces, avecProcedure, ficheDuDossier, ongletDuFichier, pieceManquante } from './dossier-pieces';

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

  it('hors brouillon : la liste exigée n’est pas montrée ; seules les pièces fournies par l’application restent, et s’ouvrent (19/10)', () => {
    const { el } = monter('SOUMIS', [
      { idTypePiece: 70, libellePiece: 'Fiche de présentation', obligatoire: true, code: 'FICHE_PRESENTATION', ordre: 1, fourniePar: 'APPLICATION', lien: '/api/dossiers/42/fiche-presentation' },
      { idTypePiece: 71, libellePiece: 'PV de la Commission sur le dossier de mise en concurrence', obligatoire: true, code: 'PV_CNM_DMC', ordre: 2, fourniePar: 'APPLICATION', lien: '/api/pv-examens/64/document' },
      { idTypePiece: 17, libellePiece: 'PV d’ouverture', obligatoire: true, code: 'PV_OUVERTURE', ordre: 3 },
    ]);
    expect(el.querySelector('.pe-ligne')).toBeNull();
    const groupe = el.querySelector('[data-testid="pieces-fournies"]');
    expect(Array.from(groupe?.querySelectorAll('.piece-name') ?? []).map(texte)).toEqual(['Fiche de présentation', 'PV de la Commission sur le dossier de mise en concurrence']);
    (groupe!.querySelectorAll('.btn-ouvrir')[1] as HTMLButtonElement).click();
    expect(TestBed.inject(HttpTestingController).expectOne('/api/pv-examens/64/document').request.responseType).toBe('blob');
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

describe('Dossier de marché né d’une attribution : les fichiers d’office lus dans leur onglet (20/10)', () => {
  const piece = (nomFichier: string, produitePar: 'ATTRIBUTION' | null = 'ATTRIBUTION') => ({ idDossier: 100383, idTypePiece: 1, nomFichier, produitePar });
  it('reconnaît chaque fichier de l’attribution à son nom', () => {
    expect(ongletDuFichier(piece('pv-ouverture_3.pdf'), true)).toBe('seance');
    expect(ongletDuFichier(piece('rapport-evaluation_3.pdf'), true)).toBe('evaluation');
    expect(ongletDuFichier(piece('projet-de-marche_3_lot1.pdf'), true)).toBe('attribution');
    expect(ongletDuFichier(piece('bordereau-offre-4_3_lot1.pdf'), true)).toBe('attribution');
    expect(ongletDuFichier(piece('DAO_COMPLET_13-CC.pdf'), true)).toBe('fiche-dao');
    expect(ongletDuFichier(piece('BORDEREAU_ESTIMATIF_00001.pdf'), true)).toBe('bordereau');
  });
  it('un fichier déposé à la main reste une pièce jointe', () => {
    expect(ongletDuFichier(piece('avis-13-CC-premiere-publication.pdf', null), true)).toBeNull();
    expect(ongletDuFichier(piece('pv-ouverture_3.pdf'), false)).toBeNull();
  });
  it('un dossier porte une procédure s’il naît d’une fiche ou d’une attribution', () => {
    expect(avecProcedure({ idDmc: 3 })).toBe(true);
    expect(avecProcedure({ procedure: { idDmc: 3 } })).toBe(true);
    expect(avecProcedure({})).toBe(false);
    expect(ficheDuDossier({ procedure: { idDmc: 3 } })).toBe(3);
  });
});
