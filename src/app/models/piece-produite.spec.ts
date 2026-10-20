import { messagePieceProduite, origineProduite } from '.';

describe('Pièce produite par l’application (19/10, V137)', () => {
  it('fiche DAO, attribution, ou téléversée', () => {
    expect(origineProduite({ idDocumentFiche: 155, produitePar: null })).toBe('FICHE');
    expect(origineProduite({ idDocumentFiche: null, produitePar: 'ATTRIBUTION' })).toBe('ATTRIBUTION');
    expect(origineProduite({})).toBeNull();
  });

  it('les deux refus sont nommés, les autres laissés au message par défaut', () => {
    expect(messagePieceProduite('PIECE_PRODUITE_PAR_FICHE')).toContain('fiche DAO');
    expect(messagePieceProduite('PIECE_PRODUITE_PAR_APPLICATION')).toContain('dossier de marché');
    expect(messagePieceProduite('AUTRE')).toBeNull();
  });
});
