import { PARTIES_RAPPORT, partieDuPoint } from './parties-rapport-evaluation';

/** ⚠️ 05/11 (pilote) — chaque point de la grille rattaché au rapport trouve sa partie ; les autres n'en ont pas. */
describe('partieDuPoint — la partie du rapport d’évaluation qui sert un point de la grille', () => {
  it('les 14 points de la grille du dossier de marché lus dans le rapport vont chacun à leur partie', () => {
    const attendu: [string, string][] = [
      ['CAO désignée, membres déclarés', 'A'],
      ['Rejets motivés par le DAO', 'B'],
      ['Classement et attributaire proposé', 'B'],
      ['Conformité des documents essentiels', 'C'],
      ['Montant évalué conforme au DAO', 'D'],
      ['Offres anormales : justification demandée', 'E'],
      ['Offres anormales : processus et seuils', 'E'],
      ['Moralité des prix', 'E'],
      ['Spécifications techniques', 'F'],
      ['Post-qualification sur les seuls critères du DAO', 'G'],
      ['Qualification : activités et critères', 'G'],
      ['Rapport signé de tous les membres', 'H'],
      ['PV de validation cohérent', 'H'],
    ];
    for (const [libelle, cle] of attendu) expect(partieDuPoint(libelle)?.cle, libelle).toBe(cle);
  });

  it('un point qui ne se lit pas dans le rapport n’a pas de partie', () => {
    for (const l of ['Délai de remise des offres', "PV d'ouverture signé et publié", 'Offre retenue acceptable', "Publicité effective de l'avis", "Projet de marché conforme à l'offre retenue", null]) {
      expect(partieDuPoint(l), String(l)).toBeNull();
    }
  });

  it('les parties annoncent, en clair, les points qu’elles servent — et chacun de ces points les retrouve', () => {
    for (const p of PARTIES_RAPPORT) for (const pt of p.points) expect(partieDuPoint(pt)?.cle, pt).toBe(p.cle);
    expect(PARTIES_RAPPORT.map((p) => p.cle)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });
});
