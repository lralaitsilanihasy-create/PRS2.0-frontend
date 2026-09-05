import { entiteImportDifferente, normaliserNomEntite } from './entite-import';

describe('entite-import (garde d’entité des imports PPM)', () => {
  it('normalise accents, casse et espaces', () => {
    expect(normaliserNomEntite('  Direction  Générale de la Sécurité   Routière ')).toBe(
      'DIRECTION GENERALE DE LA SECURITE ROUTIERE',
    );
  });

  it('entité résolue différente → refus (comparaison par id)', () => {
    expect(entiteImportDifferente(9, 'MINISTÈRE DES TRAVAUX PUBLICS', 7, 'DGSR')).toBe(true);
  });

  it('entité résolue identique → accepté', () => {
    expect(entiteImportDifferente(7, 'DGSR', 7, 'DIRECTION GÉNÉRALE DE LA SÉCURITÉ ROUTIÈRE')).toBe(false);
  });

  // ⚠️ Constat pilote 2026-09-05 : « FONDS ROUTIER » (hors référentiel) passait la garde.
  it('entité NON résolue au nom différent → refus (le trou du constat)', () => {
    expect(
      entiteImportDifferente(null, 'FONDS ROUTIER', 7, 'DIRECTION GÉNÉRALE DE LA SÉCURITÉ ROUTIÈRE'),
    ).toBe(true);
  });

  it('entité non résolue mais nom identique (accents/casse près) → accepté', () => {
    expect(
      entiteImportDifferente(null, 'direction générale de la sécurité routière', 7, 'DIRECTION GENERALE DE LA SECURITE ROUTIERE'),
    ).toBe(false);
  });

  it('sans base de comparaison (nom du PDF vide) → pas de blocage par ce garde', () => {
    expect(entiteImportDifferente(null, '', 7, 'DGSR')).toBe(false);
  });
});
