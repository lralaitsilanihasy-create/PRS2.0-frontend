import { Dossier, Ppm } from '../../../models';
import { plansEnVigueur } from './plan-passation';

/** ⚠️ 03/11 (pilote, lot 1) — les plans que montre l'écran « Plan de passation ». */
describe('plansEnVigueur', () => {
  const d = (idDossier: number, statut: string, x: Partial<Dossier> = {}): Dossier => ({ idDossier, idTypeDossier: 'DDP', statut, ...x }) as Dossier;
  const ppm = (idDossier: number, exercice: number): Ppm => ({ idDossier, exercice }) as Ppm;

  it('les plans signés, du plus récent au plus ancien ; ni brouillon, ni autre famille', () => {
    const r = plansEnVigueur([d(1, 'CLOTURE'), d(2, 'DECISION_TRANSMISE_SIGMP'), d(3, 'BROUILLON'), d(4, 'CLOTURE', { idTypeDossier: 'DMC' }), d(5, 'EN_EXAMEN')], [ppm(1, 2025), ppm(2, 2026)]);
    expect(r.map((x) => x.idDossier)).toEqual([2, 1]);
  });

  it('une version remplacée par une mise à jour soumise disparaît ; un brouillon de mise à jour ne la remplace pas', () => {
    const r = plansEnVigueur([d(1, 'CLOTURE'), d(2, 'EN_EXAMEN', { idDossierParent: 1 }), d(3, 'CLOTURE'), d(4, 'BROUILLON', { idDossierParent: 3 })], []);
    expect(r.map((x) => x.idDossier)).toEqual([3]);
  });
});
