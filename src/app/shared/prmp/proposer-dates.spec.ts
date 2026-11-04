import { proposerDatesManquantes } from './proposer-dates';

/** ⚠️ 04/11 (pilote, option A) — les dates manquantes du calendrier d'une ligne, proposées entre les dates connues. */
describe('proposerDatesManquantes', () => {
  const p = (idCapm: number, dateDebut = '', sansObjet = false) => ({ idCapm, dateDebut, sansObjet });

  it('répartit entre deux dates connues, sans toucher aux dates posées ni aux processus sans objet', () => {
    const r = proposerDatesManquantes([p(1, '2026-03-02'), p(2), p(3, '', true), p(4), p(5, '2026-03-14')]);
    // Actifs : 1 (02/03), 2, 4, 5 (14/03) — 12 jours sur 3 intervalles : 4 jours chacun.
    expect([...r.entries()]).toEqual([[2, '2026-03-06'], [4, '2026-03-10']]);
  });

  it('avant la première et après la dernière date connue : au pas moyen des intervalles connus', () => {
    const r = proposerDatesManquantes([p(1), p(2), p(3, '2026-03-02'), p(4, '2026-03-12'), p(5), p(6)]);
    expect(r.get(2)).toBe('2026-02-20');
    expect(r.get(1)).toBe('2026-02-10');
    expect(r.get(5)).toBe('2026-03-22');
    expect(r.get(6)).toBe('2026-04-01');
  });

  it('une seule date connue : une semaine par processus ; aucune date connue : rien à proposer', () => {
    expect([...proposerDatesManquantes([p(1, '2026-03-02'), p(2)])]).toEqual([[2, '2026-03-09']]);
    expect(proposerDatesManquantes([p(1), p(2)]).size).toBe(0);
  });

  it('les dates proposées suivent l’ordre de la grille (jamais avant la précédente)', () => {
    const r = proposerDatesManquantes([p(1, '2026-03-02'), p(2), p(3), p(4), p(5), p(6, '2026-03-04')]);
    const dates = [...r.values()];
    expect(dates).toEqual([...dates].sort());
    expect(dates.every((d) => d >= '2026-03-02' && d <= '2026-03-04')).toBe(true);
  });
});
