import { aujourdhuiServeur, caler, jourIso, lireHeureLocale, maintenantServeur, reinitialiserEcart } from './heure-serveur';

describe('heure-serveur — l’heure de l’application est celle du serveur (24/10)', () => {
  afterEach(() => reinitialiserEcart());

  it('lit une heure de l’API comme une heure locale, sans fuseau', () => {
    const d = lireHeureLocale('2026-12-07T10:42:05')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 12, 7, 10, 42, 5]);
    expect(lireHeureLocale('pas une date')).toBeNull();
  });

  it('cale l’écart serveur − poste : maintenant et aujourd’hui suivent le serveur', () => {
    const poste = new Date(2026, 9, 24, 15, 0, 0).getTime();
    const ecart = caler({ maintenant: '2026-12-07T10:00:00' }, poste);
    expect(ecart).toBe(new Date(2026, 11, 7, 10, 0, 0).getTime() - poste);
    expect(aujourdhuiServeur()).toBe(jourIso(new Date(Date.now() + ecart)));
    expect(Math.abs(maintenantServeur().getTime() - (Date.now() + ecart))).toBeLessThan(1000);
  });

  it('une réponse illisible garde l’écart connu', () => {
    const e = caler({ maintenant: '2026-12-07T10:00:00' });
    expect(caler({ maintenant: '???' })).toBe(e);
  });

  it('jourIso : le jour local, jamais celui d’UTC', () => {
    expect(jourIso(new Date(2026, 11, 7, 23, 59))).toBe('2026-12-07');
    expect(jourIso(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});
