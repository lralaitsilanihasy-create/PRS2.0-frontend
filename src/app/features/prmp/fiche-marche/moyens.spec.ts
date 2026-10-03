import { ligneMateriel, lignePersonnel, minimumIncoherent } from './moyens';

// Exemples des deux DAO réels (fiches des faits du MTP §3 et du MEN, DPAO 6.3).
describe('Matériel et personnel exigés — aperçu de la ligne imprimée', () => {
  it('matériel : minimum en propre, tout en propre, indifférent, par lot', () => {
    expect(ligneMateriel({ designation: 'Camions bennes', caracteristique: '≥ 10 000 kg', nombre: 6, minimumEnPropre: 4 })).toBe(
      '- Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre',
    );
    expect(ligneMateriel({ designation: 'Niveleuse', nombre: 1, minimumEnPropre: 1 })).toBe('- Niveleuse : 1, en propre');
    expect(ligneMateriel({ designation: 'Bétonnière', caracteristique: '≥ 350 l', nombre: 1 })).toBe('- Bétonnière ≥ 350 l : 1');
    expect(ligneMateriel({ designation: 'Pervibrateur', nombre: 1, parLot: true, minimumEnPropre: 0 })).toBe('- Pervibrateur : 1 par lot');
    expect(ligneMateriel({ designation: '', nombre: null })).toBe('- ……… : ………');
  });

  it('personnel : diplôme, expérience dans un domaine, justificatifs ; les morceaux absents disparaissent', () => {
    expect(
      lignePersonnel({ poste: 'Conducteur de travaux', nombre: 1, diplome: 'Ingénieur BTP ou génie civil', experienceAnnees: 5, domaineExperience: 'travaux routiers', justificatifs: 'CV et diplôme certifié' }),
    ).toBe("- Conducteur de travaux (1) : ingénieur BTP ou génie civil ; au moins 5 ans d'expérience en travaux routiers ; justificatifs : CV et diplôme certifié");
    expect(lignePersonnel({ poste: 'Chef de chantier', nombre: 1, parLot: true, experienceAnnees: 3 })).toBe("- Chef de chantier (1 par lot) : au moins 3 ans d'expérience");
    expect(lignePersonnel({ poste: 'Topographe', nombre: 2 })).toBe('- Topographe (2)');
    expect(lignePersonnel({ poste: 'Géotechnicien', nombre: 1, experienceAnnees: 1 })).toBe("- Géotechnicien (1) : au moins 1 an d'expérience");
    // Livraison V60 : un sigle en tête du diplôme garde ses capitales ; un domaine sans années donne « expérience en ».
    expect(lignePersonnel({ poste: 'Chef de chantier', nombre: 1, diplome: 'BTS en génie civil', domaineExperience: 'travaux routiers' })).toBe(
      '- Chef de chantier (1) : BTS en génie civil ; expérience en travaux routiers',
    );
  });

  it('un minimum en propre au-delà du nombre est signalé', () => {
    expect(minimumIncoherent({ designation: 'x', nombre: 2, minimumEnPropre: 3 })).toBe(true);
    expect(minimumIncoherent({ designation: 'x', nombre: 2, minimumEnPropre: 2 })).toBe(false);
    expect(minimumIncoherent({ designation: 'x', nombre: 2 })).toBe(false);
  });
});
