import { beneficiairesFiges, etapesDuDao, etapesFigees, projetCourant } from './instantanes-procedure';

describe('Écrans figés de la procédure — lecture des valeurs figées (18/10)', () => {
  it('les imputations « code (montant) ; … » deviennent des rangées', () => {
    expect(beneficiairesFiges('00-21-0-B00-00000 (159 652 575) ; 00-21-0-B03-00000 (14 743 900)')).toEqual([
      { code: '00-21-0-B00-00000', montant: '159 652 575' },
      { code: '00-21-0-B03-00000', montant: '14 743 900' },
    ]);
  });

  it('les étapes gardent leurs « : » internes ; la date, après le dernier, passe en jj/mm/aaaa', () => {
    expect(etapesFigees('Lancement du DAO/DC : avis spécifique d’appel public à la concurrence : 2026-06-22 ; Examen par le bailleur : sans objet')).toEqual([
      { etape: 'Lancement du DAO/DC : avis spécifique d’appel public à la concurrence', date: '22/06/2026' },
      { etape: 'Examen par le bailleur', date: 'sans objet' },
    ]);
  });

  it('le calendrier ne garde que les étapes du DAO, dans l’ordre ; « Remise en forme du DAO » n’est pas la remise des offres', () => {
    const e = etapesFigees('Détermination des besoins : 2026-04-08 ; Établissement du DAO/DC : sur la base du cahier : 2026-05-08 ; Transmission du DAO/DC à la CNM pour examen et avis : 2026-05-18 ; Remise en forme du DAO/DC : 2026-06-07 ; Lancement du DAO/DC : avis : 2026-06-22 ; Remise des offres : propositions : 2026-07-02 ; Ouverture des plis : 2026-07-02 ; Approbation du marché : 2026-08-07');
    expect(etapesDuDao(e).map((x) => [x.libelle, x.date])).toEqual([
      ['Établissement du DAO', '08/05/2026'], ['Transmission à la CNM', '18/05/2026'], ['Lancement (avis spécifique)', '22/06/2026'],
      ['Remise des offres', '02/07/2026'], ['Ouverture des plis', '02/07/2026'],
    ]);
  });

  it('seul le projet d’avis de la version la plus récente est retenu, ses formats réunis', () => {
    const p = projetCourant([
      { idDocument: 1, extension: 'pdf', version: 4, dateGeneration: '2026-10-17T15:50:00' },
      { idDocument: 2, extension: 'docx', version: 5, dateGeneration: '2026-10-17T17:10:00' },
      { idDocument: 3, extension: 'pdf', version: 5, dateGeneration: '2026-10-17T17:10:00' },
    ]);
    expect([p?.version, p?.formats]).toEqual([5, 'PDF et Word']);
    expect(projetCourant([])).toBeNull();
  });
});
