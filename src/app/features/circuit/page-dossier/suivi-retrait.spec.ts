import { DemandeRetrait, Dossier } from '../../../models';
import { suiviRetrait } from './suivi-retrait';

const dossier = (partiel: Partial<Dossier> = {}): Dossier => ({ idDossier: 42, refeDossier: '00042/PPM/CNM/2026', statut: 'DISPATCHE', ...partiel });
const demande = (partiel: Partial<DemandeRetrait>): DemandeRetrait => ({ idDemandeRetrait: 1, idDossier: 42, idPrmp: 'PRMP001', motifRetrait: 'Doublon', dateDemande: '2026-09-15T23:57:48.376888', statut: 'EN_ATTENTE', ...partiel });

describe('Page dossier — suivi de sa demande de retrait par la PRMP (lot L4-F5)', () => {
  it('aucune demande sur ce dossier : rien (celles des autres dossiers ne comptent pas)', () => {
    expect(suiviRetrait([], dossier())).toBeNull();
    expect(suiviRetrait([demande({ idDossier: 43 })], dossier())).toBeNull();
  });

  it('en attente : les libellés de « Mes demandes », la date, la décision attendue de la CNM', () => {
    expect(suiviRetrait([demande({})], dossier())).toEqual({
      statut: 'EN_ATTENTE',
      libelle: 'En attente',
      texte: 'Demande de retrait déposée le 15/09, en attente de la décision de la Commission nationale des marchés.',
      motifRefus: null,
    });
  });

  it('refusée : la date de décision et le motif du refus ; le dossier poursuit son circuit', () => {
    const v = suiviRetrait([demande({ statut: 'REFUSEE', dateDecision: '2026-09-16T08:30:00', obsDecision: '  Pièces insuffisantes ', imCtrlCc: 'CCANT01' })], dossier());
    expect(v).toEqual({ statut: 'REFUSEE', libelle: 'Refusée', texte: 'Demande de retrait refusée le 16/09 par la Commission nationale des marchés : le dossier poursuit son circuit.', motifRefus: 'Pièces insuffisantes' });
    expect(suiviRetrait([demande({ statut: 'REFUSEE', dateDecision: '2026-09-16T08:30:00', obsDecision: undefined })], dossier())?.motifRefus).toBeNull();
  });

  it('acceptée : tant que le dossier est en brouillon ; resoumis, l’acceptation n’est plus son état', () => {
    const acceptee = demande({ statut: 'ACCEPTEE', dateDecision: '2026-09-16T08:30:00', imCtrlCc: 'PRESID1' });
    expect(suiviRetrait([acceptee], dossier({ statut: 'BROUILLON' }))).toEqual({
      statut: 'ACCEPTEE',
      libelle: 'Acceptée',
      texte: 'Demande de retrait acceptée le 16/09 par la Commission nationale des marchés : le dossier est revenu en brouillon.',
      motifRefus: null,
    });
    expect(suiviRetrait([acceptee], dossier({ statut: 'SOUMIS' }))).toBeNull();
  });

  it('la DERNIÈRE demande fait foi (une nouvelle demande après un refus)', () => {
    const v = suiviRetrait([demande({ idDemandeRetrait: 9, statut: 'EN_ATTENTE' }), demande({ idDemandeRetrait: 4, statut: 'REFUSEE', obsDecision: 'Non' })], dossier());
    expect(v?.statut).toBe('EN_ATTENTE');
  });

  it('règle C2 : ni matricule ni nom du décideur, quelle que soit la décision', () => {
    for (const statut of ['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'] as const) {
      const v = suiviRetrait([demande({ statut, imCtrlCc: 'CCANT01', dateDecision: '2026-09-16T08:30:00', obsDecision: 'Pièces insuffisantes' })], dossier({ statut: 'BROUILLON' }));
      expect(JSON.stringify(v)).not.toMatch(/CCANT01|Chef de commission|Président|Rakotondrabe/);
      expect(v?.texte).toContain('Commission nationale des marchés');
    }
  });
});
