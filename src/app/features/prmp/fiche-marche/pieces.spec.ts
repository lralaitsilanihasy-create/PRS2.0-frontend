import { lignePiece, PIECES_ADMINISTRATIVES_DOCUMENT_TYPE } from './pieces';

// Exemples des DAO réels (fiches des faits du MTP §4 et du MEN, DPAO 6.2) et du document type.
describe('Pièces de l’offre — aperçu de la ligne imprimée', () => {
  it('numéro, forme, ancienneté ; les morceaux absents disparaissent avec leur virgule', () => {
    expect(lignePiece({ rubrique: 'ADMINISTRATIVE', numero: '01', libelle: 'Carte professionnelle 2026', forme: 'copie légalisée par le centre fiscal', ancienneteMaxMois: 3 })).toBe(
      '- 01 : Carte professionnelle 2026, copie légalisée par le centre fiscal, datée de moins de 3 mois',
    );
    expect(lignePiece({ rubrique: 'ADMINISTRATIVE', libelle: 'Extrait du Registre de Commerce', forme: 'photocopie certifiée' })).toBe(
      '- Extrait du Registre de Commerce, photocopie certifiée',
    );
    expect(lignePiece({ rubrique: 'OFFRE', libelle: 'Méthodologie d’exécution' })).toBe('- Méthodologie d’exécution');
  });

  it('par lot et modèle', () => {
    expect(lignePiece({ rubrique: 'OFFRE', numero: '06', libelle: 'Garantie de soumission', parLot: true })).toBe('- 06 : Garantie de soumission, une par lot');
    expect(lignePiece({ rubrique: 'OFFRE', numero: '8-a', libelle: 'Planning général', modele: 'annexe 5' })).toBe('- 8-a : Planning général, selon le modèle : annexe 5');
    expect(lignePiece({ rubrique: 'OFFRE', libelle: '' })).toBe('- ………');
  });

  it('les six pièces administratives du document type, avec leurs anciennetés (État 211 bis : 3 mois, non-faillite : 2 mois)', () => {
    expect(PIECES_ADMINISTRATIVES_DOCUMENT_TYPE.length).toBe(6);
    expect(PIECES_ADMINISTRATIVES_DOCUMENT_TYPE.every((p) => p.rubrique === 'ADMINISTRATIVE')).toBe(true);
    expect(PIECES_ADMINISTRATIVES_DOCUMENT_TYPE.filter((p) => p.ancienneteMaxMois).map((p) => [p.libelle, p.ancienneteMaxMois])).toEqual([
      ['État 211 bis', 3],
      ['Certificat de non-faillite', 2],
    ]);
  });
});
