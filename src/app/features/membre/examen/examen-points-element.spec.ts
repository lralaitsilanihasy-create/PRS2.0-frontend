import { ELEMENTS_DEJA_EXAMINES, ELEMENTS_DEJA_EXAMINES_FICHE, pointsDeLElement } from './examen-modele';

// Les 21 points de la grille du dossier de marché (MAOO, recette du 05/11), par leur libellé.
const GRILLE = [
  'CAO désignée, membres déclarés', "PV d'ouverture signé et publié", 'Rejets motivés par le DAO', 'Montant évalué conforme au DAO',
  'Offres anormales : justification demandée', 'Classement et attributaire proposé', 'Post-qualification sur les seuls critères du DAO',
  'Rapport signé de tous les membres', "Projet de marché conforme à l'offre retenue", 'Délai de remise des offres',
  "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires", 'Conformité des documents essentiels',
  'Spécifications techniques', 'Moralité des prix', 'Qualification : activités et critères', 'PV de validation cohérent',
  "Validité de l'offre retenue", 'Offre retenue acceptable', "Publicité effective de l'avis", 'Offres anormales : processus et seuils',
].map((libelPointCtrl) => ({ libelPointCtrl }));
const libelles = (e: string) => pointsDeLElement(e, GRILLE)?.map((p) => p.libelPointCtrl) ?? null;

/** ⚠️ 05/11 (pilote) — le rattachement validé : la grille ne porte que sur les éléments NOUVEAUX du dossier de marché. */
describe('pointsDeLElement — la grille suit l’onglet du dossier de marché (pilote, 27/10 ; rattachement du 05/11)', () => {
  it('la séance d’ouverture : la CAO, le PV d’ouverture, le délai de remise, les documents essentiels', () => {
    expect(libelles('seance')).toEqual(['CAO désignée, membres déclarés', "PV d'ouverture signé et publié", 'Délai de remise des offres',
      "PV d'ouverture : date et heure", "PV d'ouverture : quorum et signataires", 'Conformité des documents essentiels']);
  });

  it('le rapport d’évaluation : rejets, montant évalué, offres anormales, classement, qualification, rapport et PV de validation', () => {
    const l = libelles('evaluation')!;
    expect(l).toEqual(['Rejets motivés par le DAO', 'Montant évalué conforme au DAO', 'Offres anormales : justification demandée',
      'Classement et attributaire proposé', 'Post-qualification sur les seuls critères du DAO', 'Rapport signé de tous les membres',
      'Conformité des documents essentiels', 'Spécifications techniques', 'Moralité des prix', 'Qualification : activités et critères',
      'PV de validation cohérent', 'Offres anormales : processus et seuils']);
    expect(l).not.toContain("PV d'ouverture signé et publié");
  });

  it('l’attribution : le classement, le projet de marché, la validité et l’acceptabilité de l’offre retenue', () => {
    expect(libelles('attribution')).toEqual(['Classement et attributaire proposé', "Projet de marché conforme à l'offre retenue",
      "Validité de l'offre retenue", 'Offre retenue acceptable']);
  });

  it('la fiche de présentation : l’offre retenue au regard des crédits ; les pièces jointes : la décision de la CAO, la publicité', () => {
    expect(libelles('presentation')).toEqual(['Offre retenue acceptable']);
    expect(libelles('pieces')).toEqual(['CAO désignée, membres déclarés', "Publicité effective de l'avis"]);
  });

  it('chacun des 21 points se vérifie sur au moins un élément nouveau', () => {
    const couverts = new Set(['presentation', 'seance', 'evaluation', 'attribution', 'pieces'].flatMap((e) => libelles(e) ?? []));
    expect(GRILLE.filter((p) => !couverts.has(p.libelPointCtrl)).map((p) => p.libelPointCtrl)).toEqual([]);
  });

  it('le rattachement du référentiel (elements) fait foi dès qu’il est servi ; un élément nouveau sans point en a zéro', () => {
    const servis = [
      { libelPointCtrl: 'Rejets motivés par le DAO', elements: ['EVALUATION', 'DAO'] },
      { libelPointCtrl: 'Moralité des prix', elements: ['EVALUATION', 'BORDEREAU'] },
      { libelPointCtrl: "Publicité effective de l'avis", elements: ['PIECES'] },
      { libelPointCtrl: 'Point sans élément', elements: [] },
    ];
    expect(pointsDeLElement('evaluation', servis)?.map((p) => p.libelPointCtrl)).toEqual(['Rejets motivés par le DAO', 'Moralité des prix']);
    expect(pointsDeLElement('pieces', servis)?.map((p) => p.libelPointCtrl)).toEqual(["Publicité effective de l'avis"]);
    expect(pointsDeLElement('attribution', servis)).toEqual([]);
    // Le référentiel porte encore DAO et BORDEREAU en secondaire : déjà examinés, l'écran n'y met aucun point.
    expect(pointsDeLElement('dao', servis)).toEqual([]);
    expect(pointsDeLElement('bordereau', servis)).toEqual([]);
  });

  it('dossier né d’une fiche (DAO) : l’essentiel aux informations du DAO, l’avis, le bordereau, le canevas ; le plan est une référence', () => {
    const DAO = ['Conformité au plan de passation', 'Allotissement', 'Fiche de présentation cohérente', 'Délai de remise des offres',
      'AGPM contrôlé et publié', 'Avis spécifique conforme', 'Remise et ouverture des plis', 'Visite des lieux', 'Prix unitaires ou forfaitaires',
      'Spécifications et DQE', 'Évaluation et attribution', 'Spécifications neutres'].map((libelPointCtrl) => ({ libelPointCtrl }));
    const de = (e: string) => pointsDeLElement(e, DAO, 'FICHE')?.map((p) => p.libelPointCtrl) ?? null;
    expect(de('avis')).toEqual(['Délai de remise des offres', 'Avis spécifique conforme', 'Remise et ouverture des plis', 'Visite des lieux']);
    expect(de('bordereau')).toEqual(['Prix unitaires ou forfaitaires', 'Spécifications et DQE']);
    expect(de('canevas')).toEqual(['Évaluation et attribution']);
    expect(de('presentation')).toEqual(['Fiche de présentation cohérente']);
    expect(de('pieces')).toEqual(['AGPM contrôlé et publié']);
    expect(de('dao')).not.toContain('Avis spécifique conforme');
    expect(de('dao')).not.toContain('AGPM contrôlé et publié');
    expect(de('dao')).toContain('Conformité au plan de passation');
    expect(ELEMENTS_DEJA_EXAMINES_FICHE.has('plan')).toBe(true);
    expect(de('plan')).toEqual([]);
    // Le référentiel, quand il est servi, fait foi aussi ici.
    expect(pointsDeLElement('avis', [{ libelPointCtrl: 'X', elements: ['AVIS', 'DAO'] }, { libelPointCtrl: 'Y', elements: ['DAO'] }], 'FICHE')?.map((p) => p.libelPointCtrl)).toEqual(['X']);
  });

  it('PV de la CNM, informations du DAO, bordereau : déjà examinés, aucun point ; sans élément : toute la grille', () => {
    for (const e of ['pv-cnm', 'dao', 'bordereau']) {
      expect(ELEMENTS_DEJA_EXAMINES.has(e)).toBe(true);
      expect(pointsDeLElement(e, GRILLE)).toEqual([]);
    }
    expect(pointsDeLElement(null, GRILLE)).toBeNull();
  });
});
