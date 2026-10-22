import { diffMots, nettoyer, passagesARechercher, resserrer } from './ecarts-diff';

describe('Écarts au document type — lisibilité (22/10)', () => {
  it('nettoie les codes techniques d’une ligne', () => {
    expect(nettoyer('[LIGNE] 2. Groupements\x1F{{SI:GROUPEMENT-LIBRE}}\x1ELes groupements{{FINSI:GROUPEMENT-LIBRE}} de {{B01-AC-01}}')).toBe(
      '2. Groupements | · Les groupements de ‹B01-AC-01›',
    );
  });

  it('ne montre que les mots qui changent, avec du contexte', () => {
    const avant = 'Les données particulières ci - après complètent, précisent ou modifient les clauses des Instructions aux Candidats.';
    const apres = 'Les données particulières ci-après complètent, précisent ou modifient les clauses des Instructions aux Candidats.';
    const s = diffMots(avant, apres);
    expect(s.filter((x) => x.type === 'retire').map((x) => x.texte.trim())).toEqual(['ci - après']);
    expect(s.filter((x) => x.type === 'ajoute').map((x) => x.texte.trim())).toEqual(['ci-après']);
    const r = resserrer(s, 2);
    expect(r.some((x) => x.type === 'coupure')).toBe(true);
    expect(r.map((x) => x.texte).join('')).not.toContain('Instructions aux Candidats');
  });

  it('propose le passage à chercher dans la page', () => {
    expect(passagesARechercher('[PARA] peuvent être conjoint ou solidaire.', '[PARA] peuvent être conjoints ou solidaires.')[0]).toContain('conjoints');
  });
});
