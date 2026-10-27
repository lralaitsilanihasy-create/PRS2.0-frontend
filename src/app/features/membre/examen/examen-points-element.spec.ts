import { pointsDeLElement } from './examen-modele';

// Les 18 points de la grille du dossier de marché (MAOO-CC), par leur libellé.
const GRILLE = [
  'CAO désignée, membres déclarés', "PV d'ouverture signé et publié", 'Rejets motivés par le DAO', 'Montant évalué conforme au DAO',
  'Offres anormales : justification demandée', 'Classement et attributaire proposé', 'Post-qualification sur les seuls critères du DAO',
  'Rapport signé de tous les membres', "Projet de marché conforme à l'offre retenue", 'Délai de remise des offres',
  "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires", 'Conformité des documents essentiels',
  'Spécifications techniques', 'Moralité des prix', 'Qualification : activités et critères', 'PV de validation cohérent',
  "Validité de l'offre retenue",
].map((libelPointCtrl) => ({ libelPointCtrl }));
const libelles = (e: string) => pointsDeLElement(e, GRILLE)?.map((p) => p.libelPointCtrl) ?? null;

describe('pointsDeLElement — la grille suit l’onglet du dossier de marché (pilote, 27/10)', () => {
  it('la séance d’ouverture : la CAO, le PV d’ouverture et le délai de remise', () => {
    expect(libelles('seance')).toEqual(['CAO désignée, membres déclarés', "PV d'ouverture signé et publié", 'Délai de remise des offres',
      "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires"]);
  });

  it('l’attribution : le classement, le projet de marché et la validité de l’offre', () => {
    expect(libelles('attribution')).toEqual(['Classement et attributaire proposé', "Projet de marché conforme à l'offre retenue", "Validité de l'offre retenue"]);
  });

  it('le rapport d’évaluation porte sur les décisions de la commission', () => {
    const l = libelles('evaluation')!;
    expect(l).toContain('Rapport signé de tous les membres');
    expect(l).toContain('PV de validation cohérent');
    expect(l).not.toContain("PV d'ouverture signé et publié");
  });

  it('un élément sans point propre (fiche de présentation, PV de la CNM) montre toute la grille', () => {
    expect(pointsDeLElement('presentation', GRILLE)).toBeNull();
    expect(pointsDeLElement('pv-cnm', GRILLE)).toBeNull();
    expect(pointsDeLElement(null, GRILLE)).toBeNull();
  });
});
