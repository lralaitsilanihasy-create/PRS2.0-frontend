import { OffreEvaluee } from '../../models';
import { etatOffreEtape, offreParDefaut } from './selecteur-offres';

const offre = (id: string, o: Partial<OffreEvaluee> = {}): OffreEvaluee =>
  ({ idOffre: id, numero: 1, entreprise: { nif: '1', raisonSociale: 'E' }, conformite: null, evaluation: null, anormale: null, qualification: null, rang: null, ecartee: null, precisionsEnAttente: 0, ...o }) as OffreEvaluee;

describe('Évaluation : les offres en cartes (19/10)', () => {
  it('examen préliminaire : à décider, conforme, écartée', () => {
    expect(etatOffreEtape(offre('a'), 'CONFORMITE')).toEqual({ libelle: 'À décider', ton: 'afaire' });
    expect(etatOffreEtape(offre('a', { conformite: { decision: 'CONFORME' } as OffreEvaluee['conformite'] }), 'CONFORMITE').ton).toBe('ok');
    expect(etatOffreEtape(offre('a', { conformite: { decision: 'ECARTEE' } as OffreEvaluee['conformite'] }), 'CONFORMITE').ton).toBe('ko');
  });

  it('montant évalué : à évaluer, puis le rang', () => {
    expect(etatOffreEtape(offre('a'), 'EVALUATION').libelle).toBe('Montant à évaluer');
    expect(etatOffreEtape(offre('a', { evaluation: { montantEvalue: 10 } as OffreEvaluee['evaluation'], rang: 2 }), 'EVALUATION')).toEqual({ libelle: 'Rang 2', ton: 'ok' });
  });

  it('offres anormales : justification demandée en attente, rejet en échec', () => {
    expect(etatOffreEtape(offre('a', { anormale: { decision: 'SUSPECTEE' } as OffreEvaluee['anormale'] }), 'ANORMALES').ton).toBe('attente');
    expect(etatOffreEtape(offre('a', { anormale: { decision: 'REJETEE' } as OffreEvaluee['anormale'] }), 'ANORMALES').ton).toBe('ko');
  });

  it('par défaut : la première offre qui attend une décision, sinon la première', () => {
    const faite = offre('a', { conformite: { decision: 'CONFORME' } as OffreEvaluee['conformite'] });
    expect(offreParDefaut([faite, offre('b')], 'CONFORMITE')).toBe('b');
    expect(offreParDefaut([faite], 'CONFORMITE')).toBe('a');
    expect(offreParDefaut([], 'CONFORMITE')).toBeNull();
  });
});
