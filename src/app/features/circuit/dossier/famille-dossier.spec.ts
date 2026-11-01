import { etatSuivi } from '../../prmp/suivi-delais';
import { familleDossier } from './famille-dossier';

/** ⚠️ 01/11 (pilote, maquette « Tous mes dossiers », variante B) — famille d'un dossier et état de ses compteurs. */
describe('famille et état d’un dossier', () => {
  it('la famille suit le type du dossier', () => {
    expect(familleDossier({ idTypeDossier: 'DDP' })).toBe('plan');
    expect(familleDossier({ idTypeDossier: 'DMC' })).toBe('mec');
    expect(familleDossier({ idTypeDossier: 'DDM' })).toBe('marche');
    expect(familleDossier({ idTypeDossier: 'DGC' })).toBe('autre');
  });

  it('l’état des compteurs : à traiter par la PRMP, à la Commission, traitement terminé ; un retrait n’y compte pas', () => {
    expect(etatSuivi({ statut: 'BROUILLON' })).toBe('a-traiter');
    expect(etatSuivi({ statut: 'EN_ATTENTE_DECISION_PRMP' })).toBe('a-traiter');
    expect(etatSuivi({ statut: 'EN_EXAMEN', attentePrmp: true })).toBe('a-traiter');
    expect(etatSuivi({ statut: 'EN_EXAMEN' })).toBe('commission');
    expect(etatSuivi({ statut: 'CLOTURE' })).toBe('clos');
    expect(etatSuivi({ statut: 'DECISION_TRANSMISE_SIGMP' })).toBe('clos');
    expect(etatSuivi({ statut: 'RETIRE' })).toBeNull();
  });
});
