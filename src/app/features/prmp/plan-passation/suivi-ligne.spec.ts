import { LigneEligible, NoeudFiliation } from '../../../models';
import { suiviDeLigne } from './suivi-ligne';

/** ⚠️ 03/11 (pilote, lot 2) — l'étape d'une ligne du plan, telle que la marge et les compteurs la montrent. */
describe('suiviDeLigne', () => {
  const n = (lien: string, statut: string, x: Partial<NoeudFiliation> = {}): NoeudFiliation => ({
    idDossier: 1, refeDossier: '00002/DAOO-CC/CNM/2026', idTypeDossier: null, idSousType: 'DAOO-CC', statut, dateRef: null, lien, lot: null, ligne: null, masque: false, enfants: [], ...x,
  });
  const e = (x: Partial<LigneEligible>): LigneEligible => ({ idDetail: 1, idDossier: 9, refeDossier: null, designationMarche: 'x', idMode: 1, libelleMode: null, montEstim: null, dejaDao: false, ...x }) as LigneEligible;

  it('appel d’offres : à lancer, puis informations du DAO en brouillon ou validées', () => {
    expect(suiviDeLigne(e({}), [], 'Appel d’offres ouvert')).toMatchObject({ etape: 'lancer', precision: 'Informations du DAO', famille: 'neutre' });
    expect(suiviDeLigne(e({ dejaDao: true, idDmc: 3, fiche: { statut: 'BROUILLON', version: 1 } }), [], null)).toMatchObject({ etape: 'preparation', precision: 'Brouillon' });
    expect(suiviDeLigne(e({ dejaDao: true, idDmc: 3, fiche: { statut: 'VALIDEE', version: 2 } }), [], null)).toMatchObject({ etape: 'preparation', precision: 'Validées' });
  });

  it('dossier de mise en concurrence : à la Commission pendant le circuit, lancée une fois clôturé ; le marché l’emporte', () => {
    expect(suiviDeLigne(undefined, [n('MISE_EN_CONCURRENCE', 'EN_EXAMEN')], null)).toMatchObject({ etape: 'commission', famille: 'examen' });
    expect(suiviDeLigne(undefined, [n('MISE_EN_CONCURRENCE', 'CLOTURE')], null)).toMatchObject({ etape: 'lancee', precision: '00002/DAOO-CC/CNM/2026', famille: 'favorable' });
    expect(suiviDeLigne(undefined, [n('MISE_EN_CONCURRENCE', 'CLOTURE'), n('MARCHE', 'BROUILLON', { refeDossier: null, lot: 1 }), n('MARCHE', 'CLOTURE', { lot: 2 })], null))
      .toMatchObject({ etape: 'marche', precision: '2 lots' });
  });

  it('gré à gré : rapport justificatif à créer, puis en brouillon, puis clôturé', () => {
    expect(suiviDeLigne(undefined, [], 'MARCHE DE GRE A GRE PPP')).toMatchObject({ etape: 'lancer', precision: 'Rapport justificatif' });
    expect(suiviDeLigne(undefined, [n('MISE_EN_CONCURRENCE', 'BROUILLON', { idSousType: 'RJ', refeDossier: null })], 'Gré à gré')).toMatchObject({ etape: 'preparation', libelle: 'Rapport justificatif', precision: 'Brouillon' });
    expect(suiviDeLigne(undefined, [n('MISE_EN_CONCURRENCE', 'CLOTURE', { idSousType: 'RJ' })], 'Gré à gré')).toMatchObject({ etape: 'lancee', libelle: 'Rapport clôturé' });
  });

  it('consultation de prix : sans étape définie (question au pilote)', () => {
    expect(suiviDeLigne(undefined, [], 'Consultation des Prix Ouverte')).toMatchObject({ etape: 'aucune', precision: 'Consultation des Prix Ouverte' });
  });
});
