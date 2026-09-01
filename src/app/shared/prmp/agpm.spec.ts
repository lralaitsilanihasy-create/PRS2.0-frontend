import { Capm, Marche, MarchePrevision, ModePassation } from '../../models';
import { calculerAgpm } from './agpm';

/**
 * « Projet d'AGPM » — lignes dérivées du plan : marchés dont le mode porte `declencheAgpm`
 * (appels d'offres, selon le référentiel administrable), date du DAO = prévision LANCEMENT.
 */
describe('calculerAgpm', () => {
  const modes: ModePassation[] = [
    { idMode: 1, libelle: 'Appel d’offres ouvert', declencheAgpm: true },
    { idMode: 2, libelle: 'Consultation des Prix Ouverte', declencheAgpm: false },
    { idMode: 3, libelle: 'Appel d’offres restreint', declencheAgpm: true },
  ];
  const capms: Capm[] = [
    { idCapm: 10, libelleProcessus: 'Lancement du DAO/DC : avis spécifique', ordre: 1 },
    { idCapm: 20, libelleProcessus: 'Ouverture des plis', ordre: 2 },
  ];
  const marche = (idDetail: number, extra: Partial<Marche> & { natureLibelle?: string }): Marche & { natureLibelle?: string } =>
    ({ idDetail, idDossier: 1, idPpm: 1, designationMarche: `M${idDetail}`, montEstim: 1000, ...extra }) as Marche & { natureLibelle?: string };

  it('retient les seuls modes declencheAgpm, avec compte, nature, financement et date du DAO', () => {
    const marches = [
      marche(1, { idMode: 1, numCompte: '6111', financement: 'RPI', natureLibelle: 'Fournitures et services' }),
      marche(2, { idMode: 2 }), // CPO : hors AGPM
      marche(3, { idMode: 3, idNature: 7 }), // nature via référentiel
      marche(4, {}), // sans mode
    ];
    const previsions: MarchePrevision[] = [
      { idPrevision: 1, idDetail: 1, idCapm: 10, dateDebut: '2026-06-04' } as MarchePrevision,
      { idPrevision: 2, idDetail: 1, idCapm: 20, dateDebut: '2026-07-04' } as MarchePrevision,
    ];
    const lignes = calculerAgpm(marches, previsions, modes, capms, new Map([[7, 'Travaux']]));
    expect(lignes.map((l) => l.idDetail)).toEqual([1, 3]);
    expect(lignes[0]).toMatchObject({ compte: '6111', nature: 'Fournitures et services', financement: 'RPI', modeLibelle: 'Appel d’offres ouvert', dateDao: '2026-06-04' });
    expect(lignes[1].nature).toBe('Travaux');
    expect(lignes[1].dateDao).toBeNull();
  });

  it('ignore les lignes supprimées (versionnement)', () => {
    expect(calculerAgpm([marche(1, { idMode: 1, supprimee: true })], [], modes, capms)).toEqual([]);
  });
});
