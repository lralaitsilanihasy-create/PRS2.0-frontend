import { StatutMarche } from '../../models';
import { dateAvis, statutsAdmissibles } from './statut-marche';

const REF: StatutMarche[] = [
  { code: 'DSS', libelle: 'Déclaré sans suite', ordre: 13, actif: true },
  { code: 'PREVU', libelle: 'Prévu', ordre: 10, actif: true },
  { code: 'LANCE', libelle: 'Lancé', ordre: 11, actif: true },
  { code: 'CHDP', libelle: 'Changement de projet', ordre: 12, actif: true },
  { code: 'ANCIEN', libelle: 'Ancien statut', ordre: 5, actif: false },
];
const codes = (l: StatutMarche[]): string[] => l.map((s) => s.code);

describe('Statut de marché — « Lancé » à l’impression de l’avis spécifique (règle du pilote du 30/09)', () => {
  it('sans avis imprimé : « Lancé » n’est pas proposé, même avec une fiche DAO en préparation', () => {
    expect(codes(statutsAdmissibles(REF, 'PREVU', false))).toEqual(['PREVU', 'CHDP', 'DSS']);
    expect(codes(statutsAdmissibles(REF, 'CHDP', false))).toEqual(['PREVU', 'CHDP', 'DSS']);
  });

  it('avec un avis imprimé : « Prévu » disparaît, les statuts manuels restent', () => {
    expect(codes(statutsAdmissibles(REF, 'LANCE', true))).toEqual(['LANCE', 'CHDP', 'DSS']);
    expect(codes(statutsAdmissibles(REF, 'DSS', true))).toEqual(['LANCE', 'CHDP', 'DSS']);
  });

  it('le code déjà porté reste proposé : une ligne « Lancé » d’avant la règle, un avis imprimé sur une ligne restée « Prévu »', () => {
    expect(codes(statutsAdmissibles(REF, 'LANCE', false))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS']);
    expect(codes(statutsAdmissibles(REF, 'PREVU', true))).toEqual(['PREVU', 'LANCE', 'CHDP', 'DSS']);
  });

  it('un code désactivé ou inconnu porté par la ligne est ajouté en queue, pour rester affichable et ré-enregistrable', () => {
    expect(codes(statutsAdmissibles(REF, 'ANCIEN', false))).toEqual(['PREVU', 'CHDP', 'DSS', 'ANCIEN']);
    const inconnu = statutsAdmissibles(REF, 'XYZ', true).at(-1);
    expect(inconnu).toEqual({ code: 'XYZ', libelle: 'XYZ', actif: false });
    expect(codes(statutsAdmissibles(REF, '', false))).toEqual(['PREVU', 'CHDP', 'DSS']);
  });

  it('la date d’impression de l’avis se lit JJ/MM/AAAA', () => {
    expect(dateAvis('2026-10-05')).toBe('05/10/2026');
    expect(dateAvis(null)).toBe('');
  });
});
