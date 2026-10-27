import { PieceJointeDossier, TypePieceJointe } from '../../models';
import { elementDeLaPiece } from './reception-form';

const type = (code: string, fournie = false): TypePieceJointe => ({ idTypePiece: 1, code, libellePiece: code, fourniePar: fournie ? 'APPLICATION' : null } as TypePieceJointe);
const piece = (nomFichier: string, produitePar: string | null = 'ATTRIBUTION'): PieceJointeDossier => ({ idPiece: 1, idTypePiece: 1, nomFichier, produitePar } as PieceJointeDossier);

describe('elementDeLaPiece — la pièce lue en données à la réception (pilote, 24/10)', () => {
  it('les pièces fournies par l’application ouvrent leur vue', () => {
    expect(elementDeLaPiece(type('FICHE_PRESENTATION', true), null, true)).toBe('presentation');
    expect(elementDeLaPiece(type('PV_CNM_DMC', true), null, true)).toBe('pv-cnm');
    expect(elementDeLaPiece(type('PV_VALIDATION_CAO', true), null, true)).toBe('evaluation');
    expect(elementDeLaPiece(type('CALENDRIER', true), null, true)).toBe('plan');
    expect(elementDeLaPiece(type('AGPM_CONTROLE', true), null, true)).toBe('plan');
  });

  it('les fichiers joints d’office par l’attribution ouvrent leur vue, comme sur la page du dossier', () => {
    expect(elementDeLaPiece(type('PV_OUVERTURE'), piece('pv-ouverture_5.pdf'), true)).toBe('seance');
    expect(elementDeLaPiece(type('RAPPORT_ANALYSE'), piece('rapport-evaluation_5.pdf'), true)).toBe('evaluation');
    expect(elementDeLaPiece(type('PROJET_MARCHE'), piece('projet-de-marche_5_lot1.pdf'), true)).toBe('attribution');
    expect(elementDeLaPiece(type('DEVIS_ESTIMATIF'), piece('BORDEREAU_ESTIMATIF_00001-PPM_303336_v1.pdf'), true)).toBe('bordereau');
    expect(elementDeLaPiece(type('CAHIER_CHARGES'), piece('DAO_COMPLET_14-CC_303336_v1.pdf'), true)).toBe('fiche-dao');
  });

  it('un journal de publication déposé reste un fichier ; hors dossier né d’une fiche, rien', () => {
    expect(elementDeLaPiece(type('PUBLICATION_AVIS'), piece('journal-avis.pdf', null), true)).toBeNull();
    expect(elementDeLaPiece(type('PV_OUVERTURE'), piece('pv-ouverture_5.pdf'), false)).toBeNull();
    expect(elementDeLaPiece(type('FICHE_PRESENTATION', true), null, false)).toBeNull();
  });
});
