import { PRESENTATION_SOUS_TYPE_FICHE, SOUS_TYPES_FICHE_DAO } from '.';

// ⚠️ 14/10 (constat du pilote) — l'encadré de « Créer dossier » décrit le sous-type choisi.
describe('PRESENTATION_SOUS_TYPE_FICHE — chaque sous-type produit par une fiche se présente', () => {
  it('titre, ligne attendue, raison et documents pour chacun', () => {
    for (const t of SOUS_TYPES_FICHE_DAO) {
      const p = PRESENTATION_SOUS_TYPE_FICHE[t];
      expect(p?.titre && p.ligne && p.raison && p.documents).toBeTruthy();
    }
    expect(PRESENTATION_SOUS_TYPE_FICHE['DAOOPREQUAL'].titre).toContain('pré-qualification');
    expect(PRESENTATION_SOUS_TYPE_FICHE['DC'].documents).toContain('DPIC');
    expect(PRESENTATION_SOUS_TYPE_FICHE['DC'].raison).toContain('nature');
  });
});
