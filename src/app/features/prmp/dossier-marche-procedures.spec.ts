import { LigneEligible } from '../../models';
import { proceduresPourMarche } from './dossier-marche-procedures';

const ligne = (o: Partial<LigneEligible>): LigneEligible =>
  ({ idDetail: 1, idDossier: 1, refeDossier: null, designationMarche: 'X', idMode: null, libelleMode: null, montEstim: null, dejaDao: true, ...o }) as LigneEligible;

describe('Dossier de marché : les procédures qui peuvent le produire (19/10)', () => {
  const cloture = { idDossier: 100382, refeDossier: '00003/DAOO-CC/CNM/2026', statut: 'CLOTURE' };

  it('garde les procédures en ligne, au dossier de mise en concurrence clôturé', () => {
    const l = [
      ligne({ idDetail: 1, idDmc: 3, nbOffres: 3, dossier: cloture, sousType: 'DAOO-CC' }),
      ligne({ idDetail: 2, idDmc: 4, nbOffres: 0, dossier: cloture, sousType: 'DAOO-CC' }),
      ligne({ idDetail: 3, idDmc: 5, nbOffres: 2, dossier: { ...cloture, statut: 'DISPATCHE' }, sousType: 'DAOO' }),
      ligne({ idDetail: 4, idDmc: null, nbOffres: 0, dossier: null }),
    ];
    expect(proceduresPourMarche(l, null).map((x) => x.idDetail)).toEqual([1]);
  });

  it('le sous-type du marché choisit celui de la mise en concurrence', () => {
    const l = [ligne({ idDetail: 1, idDmc: 3, nbOffres: 3, dossier: cloture, sousType: 'DAOO-CC' }), ligne({ idDetail: 2, idDmc: 6, nbOffres: 1, dossier: cloture, sousType: 'DAOO' })];
    expect(proceduresPourMarche(l, 'MAOO-CC').map((x) => x.idDetail)).toEqual([1]);
    expect(proceduresPourMarche(l, 'MAOO').map((x) => x.idDetail)).toEqual([2]);
  });
});
