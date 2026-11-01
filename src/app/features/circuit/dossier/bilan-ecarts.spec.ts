import { EcartsEcranInstantane, EcartsInstantanes } from '../../../models';
import { bilanEcarts } from './bilan-ecarts';

const ecran = (e: string, x: Partial<EcartsEcranInstantane> = {}): EcartsEcranInstantane =>
  ({ ecran: e, identique: true, comparable: true, tronque: false, ecarts: [], ...x });
const reponse = (...ecrans: EcartsEcranInstantane[]): EcartsInstantanes => ({ soumission: 1, figeLe: '2026-08-24T10:00', ecrans });

describe('bilanEcarts', () => {
  it('sans réponse ou sans écran de la carte : inconnu', () => {
    expect(bilanEcarts(null, ['PLAN']).etat).toBe('inconnu');
    expect(bilanEcarts(reponse(ecran('PLAN')), []).etat).toBe('inconnu');
    expect(bilanEcarts(reponse(ecran('PLAN')), ['SEANCE']).etat).toBe('inconnu');
  });

  it('un écran comparable qui diffère : écarts, dans l\'ordre de la carte', () => {
    const r = reponse(
      ecran('CAO', { identique: false, ecarts: [{ chemin: 'membres[2]', libelle: 'Membre 3 (ajouté)', soumis: null, actuel: 'RABE' }] }),
      ecran('EVALUATION', { identique: false, tronque: true, ecarts: [{ chemin: 'x', libelle: 'Lot 1 — montant évalué', soumis: '1 Ar', actuel: '2 Ar' }] }),
    );
    const b = bilanEcarts(r, ['EVALUATION', 'CAO']);
    expect(b.etat).toBe('ecarts');
    expect(b.lignes.map((l) => l.ecran)).toEqual(['EVALUATION', 'CAO']);
    expect(b.tronque).toBe(true);
  });

  it('les écrans comparables identiques, un autre non comparable : identique, le non comparable rappelé', () => {
    const b = bilanEcarts(reponse(ecran('PLAN'), ecran('AVIS', { comparable: false, identique: null })), ['PLAN', 'AVIS']);
    expect(b.etat).toBe('identique');
    expect(b.nonComparables).toEqual(['AVIS']);
  });

  it('aucun écran comparable : non comparable, ni ✓ ni ≠', () => {
    expect(bilanEcarts(reponse(ecran('AVIS', { comparable: false, identique: null })), ['AVIS']).etat).toBe('non-comparable');
  });
});
