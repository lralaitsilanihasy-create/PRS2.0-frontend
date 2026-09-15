import { actionLabel } from './journal-libelles';

describe('actionLabel — libellés du journal des actions', () => {
  it('traduit les gestes du dépôt', () => {
    expect(actionLabel('CREATION')).toBe('Création');
    expect(actionLabel('SOUMISSION')).toBe('Soumission');
    expect(actionLabel('TRANSMISSION_COMPLEMENTS_DEPOT')).toBe('Compléments de dépôt');
  });

  it('traduit les gestes du circuit de dispatch et du retrait', () => {
    expect(actionLabel('REPRISE')).toBe('Reprise par le dispatcheur');
    expect(actionLabel('RETRAIT_DISPATCH')).toBe('Retrait du dispatch');
    expect(actionLabel('DEMANDE_RETRAIT')).toBe('Demande de retrait');
    expect(actionLabel('RETRAIT_REFUSE')).toBe('Retrait refusé');
  });

  it("traduit le traitement jusqu'à l'archivage", () => {
    expect(actionLabel('SOUMISSION_EXAMEN')).toBe("Soumission d'examen");
    expect(actionLabel('TRANSMISSION_PRESIDENT')).toBe('Transmission au Président');
    expect(actionLabel('DECISION_VERIFICATION')).toBe('Passage de vérification');
    expect(actionLabel('TRANSMISSION_SIGMP')).toBe('Transmission SIGMP');
    expect(actionLabel('ARCHIVAGE')).toBe('Archivage');
  });

  it('rend le code brut quand le type est inconnu : le backend reste l’autorité', () => {
    expect(actionLabel('GESTE_FUTUR')).toBe('GESTE_FUTUR');
    expect(actionLabel('')).toBe('');
  });
});
