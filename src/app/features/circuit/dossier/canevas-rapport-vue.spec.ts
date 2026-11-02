import { vueSection } from './canevas-rapport-vue';

describe('vueSection (canevas de rapport, variante A du 02/11)', () => {
  it("fusionne l'exigence du DAO dans la grille quand chaque critère est une ligne de la section", () => {
    const v = vueSection({
      code: 'POST_QUALIFICATION', titre: '7. Vérification de la qualification', partie: null,
      lignes: [{ code: 'a', libelle: 'Chiffre d’affaires', valeur: '25 000 000 000' }, { code: 'b', libelle: 'Durée', valeur: '5' }],
      tableau: { colonnes: ['Critère de qualification', 'Constat', 'Cote (C / NC)'], rangees: ['Chiffre d’affaires', 'Durée'], rangeesVides: 0 },
    });
    expect(v.numero).toBe('7');
    expect(v.nom).toBe('Vérification de la qualification');
    expect(v.criteres).toEqual([{ critere: 'Chiffre d’affaires', exige: '25 000 000 000' }, { critere: 'Durée', exige: '5' }]);
    expect(v.reperes).toEqual([]);
    expect(v.quantite).toBe('2 critères à coter');
  });

  it('range les caractéristiques sous leur article et efface la ligne qui ne fait que les lister', () => {
    const v = vueSection({
      code: 'CONFORMITE', titre: '4. Conformité pour l’essentiel', partie: null,
      lignes: [{ code: 'x', libelle: 'Articles exigés', valeur: 'Décapage\nRemblai' }],
      tableau: {
        colonnes: ['Article et caractéristique exigée', 'Proposition du soumissionnaire', 'Cote (C / SC / NC)'],
        rangees: ['Décapage — Épaisseur : 20 cm', 'Décapage — Largeur : 7 m', 'Remblai — Compactage : 95 % OPM'], rangeesVides: 0,
      },
    });
    expect(v.articles?.map((a) => [a.article, a.caracteristiques.length])).toEqual([['Décapage', 2], ['Remblai', 1]]);
    expect(v.articles?.[0].caracteristiques[0]).toEqual({ caracteristique: 'Épaisseur', exigee: '20 cm' });
    expect(v.reperes).toEqual([]);
    expect(v.quantite).toBe('3 caractéristiques · 2 articles');
  });

  it('garde la grille telle que servie et les repères du DAO au-dessus sinon', () => {
    const v = vueSection({
      code: 'EXAMEN_PRELIMINAIRE', titre: '3. Examen préliminaire', partie: null,
      lignes: [{ code: 'g', libelle: 'Garantie exigée', valeur: 'Oui' }],
      tableau: { colonnes: ['Vérification', 'Cote (C / SC / NC / SO)', 'Observation'], rangees: ['Acte d’engagement présent'], rangeesVides: 0 },
    });
    expect(v.criteres).toBeNull();
    expect(v.articles).toBeNull();
    expect(v.reperes.length).toBe(1);
    expect(v.quantite).toBe('1 vérification à coter');
    expect(vueSection({ code: 'PLIS', titre: '2. Plis reçus', partie: null, lignes: [], tableau: { colonnes: ['N°', 'Soumissionnaire'], rangees: [], rangeesVides: 5 } }).quantite)
      .toBe('5 rangées à remplir');
  });
});
