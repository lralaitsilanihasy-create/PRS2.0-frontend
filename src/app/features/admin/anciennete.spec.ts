import { PREAVIS_DEMANDE_HEURES, anciennete } from './anciennete';

/**
 * Lot 6 F2 — l'ancienneté de la plus vieille demande est ce qui dit s'il y a urgence. Elle est donc
 * testée pour elle-même : les deux dates servies n'ont pas la même précision, et une attente
 * surévaluée sur un accueil d'administration est un faux signal d'urgence.
 */
const MAINTENANT = new Date('2026-09-17T10:00:00Z');

describe('anciennete — ce que la donnée permet de dire, et rien de plus', () => {
  it("ne rend rien sans date : une file sans doyenne n'affiche pas d'attente", () => {
    expect(anciennete(null, MAINTENANT, 'heure')).toBeNull();
    expect(anciennete(undefined, MAINTENANT, 'jour')).toBeNull();
  });

  it('ne rend rien sur une date illisible — jamais une valeur de repli', () => {
    expect(anciennete('pas-une-date', MAINTENANT, 'heure')).toBeNull();
  });

  it('compte les heures tant que la date est un instant', () => {
    expect(anciennete('2026-09-17T04:00:00Z', MAINTENANT, 'heure')?.libelle).toBe('depuis 6 heures');
    expect(anciennete('2026-09-17T09:00:00Z', MAINTENANT, 'heure')?.libelle).toBe('depuis 1 heure');
    expect(anciennete('2026-09-17T09:40:00Z', MAINTENANT, 'heure')?.libelle).toBe("depuis moins d'une heure");
  });

  it('passe aux jours au-delà de 48 h, pour ne pas annoncer « depuis 72 heures »', () => {
    expect(anciennete('2026-09-14T10:00:00Z', MAINTENANT, 'heure')?.libelle).toBe('depuis 3 jours');
  });

  it("n'exprime PAS en heures une date ramenée à minuit : la granularité « jour » dit le jour", () => {
    // `rattachementDoyenLe` vaut minuit : « depuis 10 heures » inventerait une précision absente.
    expect(anciennete('2026-09-17T00:00:00Z', MAINTENANT, 'jour')?.libelle).toBe("depuis aujourd'hui");
    expect(anciennete('2026-09-16T00:00:00Z', MAINTENANT, 'jour')?.libelle).toBe('depuis hier');
    expect(anciennete('2026-09-13T00:00:00Z', MAINTENANT, 'jour')?.libelle).toBe('depuis 4 jours');
  });

  it(`marque en retard au-delà de ${PREAVIS_DEMANDE_HEURES} h, pas avant`, () => {
    expect(anciennete('2026-09-15T10:00:01Z', MAINTENANT, 'heure')?.enRetard).toBe(false);
    expect(anciennete('2026-09-15T09:59:00Z', MAINTENANT, 'heure')?.enRetard).toBe(true);
  });

  it("ramène à zéro une date future : l'horloge du poste ne crée pas d'attente négative", () => {
    const a = anciennete('2026-09-18T10:00:00Z', MAINTENANT, 'heure');
    expect(a?.ecouleMs).toBe(0);
    expect(a?.enRetard).toBe(false);
    expect(a?.libelle).toBe("depuis moins d'une heure");
  });
});
