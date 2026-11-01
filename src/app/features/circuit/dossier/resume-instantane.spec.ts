import { resumeInstantane } from './resume-instantane';

/** ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — la ligne de résumé du sommaire (données de 00009/MAOO-CC/CNM/2026). */
describe('resumeInstantane', () => {
  it('résume chacun des six écrans par le fait qui le distingue', () => {
    expect(resumeInstantane('PLAN', { valeurs: { MONTANT_ESTIMATIF: '12 000 000 000', FORME_MARCHE: 'Contrat cadre' } })).toBe('12 000 000 000 Ar · Contrat cadre');
    expect(resumeInstantane('AVIS', { avis: { disponible: true }, documents: [{ publication: { datePublication: '2026-07-15' } }] })).toBe('avis publié le 15/07/2026');
    expect(resumeInstantane('CAO', { decision: { date: '2026-07-06' }, membres: [{}, {}] })).toBe('2 membres · décision du 06/07/2026');
    expect(resumeInstantane('SEANCE', { ouverteLe: '2026-08-14T08:30:04', offres: [{}, {}, {}], pv: { produit: true, signe: true } })).toBe('ouverte le 14/08/2026 · 3 offres · PV signé');
    expect(resumeInstantane('EVALUATION', { rapport: { signe: true, signeLe: '2026-08-21T11:00:01' } })).toBe('rapport signé le 21/08/2026');
    expect(resumeInstantane('ATTRIBUTION', { lots: [{ proposition: { candidat: 'SAVA Routes et Ouvrages SA' } }] })).toBe('SAVA Routes et Ouvrages SA');
  });

  it('une donnée absente donne une ligne vide ou neutre, jamais une supposition', () => {
    expect(resumeInstantane('AVIS', { avis: { disponible: false }, documents: [] })).toBe('');
    expect(resumeInstantane('EVALUATION', {})).toBe('évaluation en cours');
    expect(resumeInstantane('ATTRIBUTION', { lots: [{}, {}] })).toBe('2 lots');
    expect(resumeInstantane('ACTE', { quoi: 1 })).toBe('');
    expect(resumeInstantane('PLAN', null)).toBe('');
  });
});
