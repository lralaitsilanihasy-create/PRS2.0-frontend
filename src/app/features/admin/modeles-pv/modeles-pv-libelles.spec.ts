import { ModelePvResume } from '../../../models';
import { ecrireExpression, etatModele, expressionEnClair, lireExpression, sousTypesSansModele, tailleLisible } from './modeles-pv-libelles';

const v = (numero: number, etat: 'BROUILLON' | 'EN_VIGUEUR' | 'REMPLACEE', bloquant = false) => ({ numero, etat, bloquant, deposeeLe: null, enVigueurLe: null });
const modele = (o: Partial<ModelePvResume>): ModelePvResume => ({
  id: 1, code: 'PV-MARCHE', libelle: 'PV', nature: 'PV', etat: 'ACTIF', sousTypes: [], enVigueur: null, derniere: null, ...o,
});

describe('Modèles de PV — état d’un modèle (G1, 20/10)', () => {
  it('dit ce qu’il reste à faire', () => {
    expect(etatModele(modele({})).libelle).toBe('Aucune version déposée');
    expect(etatModele(modele({ derniere: v(1, 'BROUILLON', true) })).ton).toBe('ko');
    expect(etatModele(modele({ derniere: v(1, 'BROUILLON') })).libelle).toBe('À mettre en vigueur');
    expect(etatModele(modele({ enVigueur: v(1, 'EN_VIGUEUR'), derniere: v(1, 'EN_VIGUEUR') })).ton).toBe('at');
    expect(etatModele(modele({ sousTypes: ['MAOO'], enVigueur: v(1, 'EN_VIGUEUR'), derniere: v(2, 'BROUILLON') })).libelle).toBe('En vigueur — v2 en préparation');
    expect(etatModele(modele({ etat: 'ARCHIVE', enVigueur: v(1, 'EN_VIGUEUR') })).libelle).toBe('Archivé');
  });

  it('un sous-type sans modèle actif en vigueur de la nature reste sans document', () => {
    const l = [
      modele({ sousTypes: ['MAOO'], enVigueur: v(1, 'EN_VIGUEUR') }),
      modele({ sousTypes: ['DAOO'], derniere: v(1, 'BROUILLON') }),
      modele({ sousTypes: ['PPM'], nature: 'LETTRE_RENVOI', enVigueur: v(1, 'EN_VIGUEUR') }),
    ];
    expect(sousTypesSansModele(['MAOO', 'DAOO', 'PPM'], l)).toEqual(['DAOO', 'PPM']);
  });
});

describe('Modèles de PV — compositeur de conditions', () => {
  it('écrit et relit la grammaire de ConditionsModele', () => {
    const e = ecrireExpression([
      { lien: 'et', cle: 'forme', op: '=', valeur: 'Contrat-cadre' },
      { lien: 'et', cle: 'titulaires', op: '!=', valeur: '1' },
      { lien: 'ou', cle: 'saisi.motif', op: 'renseigne', valeur: '' },
    ]);
    expect(e).toBe('forme = Contrat-cadre et titulaires != 1 ou saisi.motif renseigne');
    expect(lireExpression(e)).toEqual([
      { lien: 'et', cle: 'forme', op: '=', valeur: 'Contrat-cadre' },
      { lien: 'et', cle: 'titulaires', op: '!=', valeur: '1' },
      { lien: 'ou', cle: 'saisi.motif', op: 'renseigne', valeur: '' },
    ]);
  });

  it('une valeur peut contenir « et » ; un terme illisible rend null', () => {
    expect(lireExpression('forme = Au fur et à mesure des besoins')).toEqual([{ lien: 'et', cle: 'forme', op: '=', valeur: 'Au fur et à mesure des besoins' }]);
    expect(lireExpression('avis')).toBeNull();
    expect(lireExpression('')).toEqual([]);
  });

  it('omet les termes incomplets et dit l’expression en clair', () => {
    expect(ecrireExpression([{ lien: 'et', cle: 'avis', op: '=', valeur: '' }, { lien: 'et', cle: 'avis', op: '=', valeur: 'FAVR' }])).toBe('avis = FAVR');
    expect(expressionEnClair('avis = FAVR et agpm = oui', { avis: 'L’avis', agpm: 'AGPM' })).toBe('L’avis vaut « FAVR » et AGPM vaut « oui »');
  });

  it('taille lisible', () => {
    expect(tailleLisible(188_416)).toBe('184 Ko');
    expect(tailleLisible(null)).toBe('—');
  });
});
