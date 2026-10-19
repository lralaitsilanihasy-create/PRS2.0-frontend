import { etapesParcoursCao } from './procedure-cao';

describe('Parcours du membre de la CAO selon la séance (19/10)', () => {
  const etats = (e: Parameters<typeof etapesParcoursCao>[0], soumis = false) => etapesParcoursCao(e, soumis).map((x) => x.etat);

  it('avant la séance : tout est à venir', () => {
    expect(etats(null)).toEqual(['avenir', 'avenir', 'avenir']);
    expect(etapesParcoursCao('A_VENIR')[0].detail).toBe('À la date limite');
  });

  it('les parts arrivent, puis le PV attend les signatures', () => {
    expect(etats('OUVERTE')).toEqual(['cours', 'avenir', 'avenir']);
    expect(etats('DECHIFFREE')).toEqual(['fait', 'cours', 'avenir']);
    expect(etats('PV_A_SIGNER')).toEqual(['fait', 'cours', 'avenir']);
  });

  it('PV signé : l’évaluation est en cours ; offres illisibles : l’ouverture est en échec', () => {
    expect(etats('CLOSE')).toEqual(['fait', 'fait', 'cours']);
    expect(etats('ILLISIBLE')).toEqual(['ko', 'avenir', 'avenir']);
  });

  it('dossier de marché soumis : tout ce qui revient à la commission est fait', () => {
    expect(etats('CLOSE', true)).toEqual(['fait', 'fait', 'fait']);
  });
});
