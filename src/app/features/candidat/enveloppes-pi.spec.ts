import { Offre, PieceAttendue } from '../../models';
import { piecesDeLEnveloppe } from './depot-offre';
import { enveloppeManquante } from './mes-offres';

const piece = (code: string): PieceAttendue =>
  ({ code, rubrique: 'OFFRE', numero: null, libelle: code, forme: null, ancienneteMaxMois: null, parLot: null, modele: null, obligatoire: true }) as PieceAttendue;

const offre = (o: Partial<Offre>): Offre =>
  ({
    idOffre: 'x', idDmc: 49, reference: null, objet: null, lot: null, etat: 'DEPOSEE', dateCreation: '', dateDepot: null, dateRetrait: null,
    numero: 1, taille: 0, nombreMorceaux: 1, recus: 1, empreinte: null, remplace: null, remplaceePar: null, enveloppe: null, ...o,
  }) as Offre;

describe('Deux enveloppes des prestations intellectuelles (lot 3 PI, tranche PI-b — V86)', () => {
  it('l’acte d’engagement va dans la financière, le reste dans la technique ; une offre ordinaire garde tout', () => {
    const pieces = [piece('PIECE-1'), piece('AE'), piece('PIECE-2')];
    expect(piecesDeLEnveloppe(pieces, 'TECHNIQUE').map((x) => x.code)).toEqual(['PIECE-1', 'PIECE-2']);
    expect(piecesDeLEnveloppe(pieces, 'FINANCIERE').map((x) => x.code)).toEqual(['AE']);
    expect(piecesDeLEnveloppe(pieces, null)).toHaveLength(3);
  });

  it('signale l’enveloppe qui manque à une proposition déposée à moitié, pour le même lot seulement', () => {
    const tech = offre({ idOffre: 't', enveloppe: 'TECHNIQUE', lot: 1 });
    expect(enveloppeManquante(tech, [tech])).toBe('FINANCIERE');
    expect(enveloppeManquante(tech, [tech, offre({ idOffre: 'f', enveloppe: 'FINANCIERE', lot: 2 })])).toBe('FINANCIERE');
    expect(enveloppeManquante(tech, [tech, offre({ idOffre: 'f', enveloppe: 'FINANCIERE', lot: 1 })])).toBeNull();
    // Une financière retirée ne complète rien ; une offre ordinaire ou retirée n'a rien à compléter.
    expect(enveloppeManquante(tech, [tech, offre({ idOffre: 'f', enveloppe: 'FINANCIERE', lot: 1, etat: 'RETIREE' })])).toBe('FINANCIERE');
    expect(enveloppeManquante(offre({}), [])).toBeNull();
    expect(enveloppeManquante(offre({ enveloppe: 'FINANCIERE', etat: 'RETIREE' }), [])).toBeNull();
    expect(enveloppeManquante(offre({ enveloppe: 'FINANCIERE' }), [])).toBe('TECHNIQUE');
  });
});
