import { prochainPasCao } from './libelles-cao';

describe('Mes procédures : le prochain pas du membre (19/10)', () => {
  const maintenant = new Date('2026-10-19T12:00:00');

  it('la clé d’abord : perdue, à publier, cérémonie rouverte', () => {
    expect(prochainPasCao({ etatPart: 'PERDUE', etatCeremonie: 'CLOSE', dateLimite: null }, maintenant).ton).toBe('alerte');
    expect(prochainPasCao({ etatPart: 'ABSENTE', etatCeremonie: 'A_VENIR', dateLimite: null }, maintenant)).toEqual({ texte: 'Publier ma clé', ton: 'action' });
    expect(prochainPasCao({ etatPart: 'PUBLIEE', etatCeremonie: 'A_REFAIRE', dateLimite: null }, maintenant).texte).toBe('Cérémonie rouverte : republier ma clé');
  });

  it('puis l’attente : cérémonie pas encore close, dépôts en cours', () => {
    expect(prochainPasCao({ etatPart: 'PUBLIEE', etatCeremonie: 'A_VENIR', dateLimite: null }, maintenant).ton).toBe('attente');
    expect(prochainPasCao({ etatPart: 'VERIFIEE', etatCeremonie: 'CLOSE', dateLimite: '2026-11-20T09:00' }, maintenant).texte).toContain('Dépôts en cours');
  });

  it('date limite passée : la séance et l’évaluation', () => {
    expect(prochainPasCao({ etatPart: 'PUBLIEE', etatCeremonie: 'CLOSE', dateLimite: '2026-10-19T09:00' }, maintenant).ton).toBe('suite');
  });
});
