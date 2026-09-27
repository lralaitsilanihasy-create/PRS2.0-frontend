import { StatutMarche } from '../../models';
import { statutsAdmissibles } from './statut-marche';

const REF: StatutMarche[] = [
  { code: 'DSS', libelle: 'Déclaré sans suite', ordre: 13, actif: true },
  { code: 'PREVU', libelle: 'Prévu', ordre: 10, actif: true },
  { code: 'LANCE', libelle: 'Lancé', ordre: 11, actif: true },
  { code: 'CHDP', libelle: 'Changement de projet', ordre: 12, actif: true },
  { code: 'ANCIEN', libelle: 'Ancien statut', ordre: 5, actif: false },
];
const codes = (l: StatutMarche[]): string[] => l.map((s) => s.code);

describe('Statut de marché — « Prévu » ne se choisit plus sur une ligne en mise en concurrence (27/09)', () => {
  it('sans DMC : les statuts actifs, triés par ordre, « Prévu » compris', () => {
    expect(codes(statutsAdmissibles(REF, 'PREVU', false))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS']);
  });

  it('avec un DMC vivant : « Prévu » disparaît, les statuts manuels restent', () => {
    expect(codes(statutsAdmissibles(REF, 'LANCE', true))).toEqual(['LANCE', 'CHDP', 'DSS']);
    expect(codes(statutsAdmissibles(REF, 'DSS', true))).toEqual(['LANCE', 'CHDP', 'DSS']);
  });

  it('une ligne lancée restée « Prévu » (données d’avant la règle) garde son code affiché : on ne cache jamais la valeur portée', () => {
    expect(codes(statutsAdmissibles(REF, 'PREVU', true))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS']);
  });

  it('un code désactivé ou inconnu porté par la ligne est ajouté en queue, pour rester affichable et ré-enregistrable', () => {
    expect(codes(statutsAdmissibles(REF, 'ANCIEN', false))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS', 'ANCIEN']);
    const inconnu = statutsAdmissibles(REF, 'XYZ', true).at(-1);
    expect(inconnu).toEqual({ code: 'XYZ', libelle: 'XYZ', actif: false });
    expect(codes(statutsAdmissibles(REF, '', false))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS']);
  });
});
