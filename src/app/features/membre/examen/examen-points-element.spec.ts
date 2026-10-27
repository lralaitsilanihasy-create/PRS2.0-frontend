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
  it('la séance d’ouverture : le PV d’ouverture, les documents essentiels, la validité et les activités du candidat', () => {
    expect(libelles('seance')).toEqual(["PV d'ouverture signé et publié", "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires",
      'Conformité des documents essentiels', 'Qualification : activités et critères', "Validité de l'offre retenue"]);
  });

  it('la fiche de présentation : le délai de remise, la date et l’heure, le quorum', () => {
    expect(libelles('presentation')).toEqual(['Délai de remise des offres', "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires"]);
  });

  it('l’attribution : le classement, le projet de marché et la validité de l’offre', () => {
    expect(libelles('attribution')).toEqual(['Classement et attributaire proposé', "Projet de marché conforme à l'offre retenue", "Validité de l'offre retenue"]);
  });

  it('le rapport d’évaluation porte la CAO et les décisions de la commission', () => {
    const l = libelles('evaluation')!;
    expect(l).toContain('CAO désignée, membres déclarés');
    expect(l).toContain('Rapport signé de tous les membres');
    expect(l).toContain('PV de validation cohérent');
    expect(l).not.toContain("PV d'ouverture signé et publié");
  });

  it('chacun des 18 points se vérifie sur au moins un onglet', () => {
    const couverts = new Set(['presentation', 'seance', 'evaluation', 'attribution', 'bordereau', 'dao'].flatMap((e) => libelles(e) ?? []));
    expect(GRILLE.filter((p) => !couverts.has(p.libelPointCtrl)).map((p) => p.libelPointCtrl)).toEqual([]);
  });

  it('un élément sans point propre (PV de la CNM) montre toute la grille', () => {
        expect(pointsDeLElement('pv-cnm', GRILLE)).toBeNull();
    expect(pointsDeLElement(null, GRILLE)).toBeNull();
  });
});
