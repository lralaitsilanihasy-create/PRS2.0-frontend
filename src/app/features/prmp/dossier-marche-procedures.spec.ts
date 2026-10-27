import { LigneEligible } from '../../models';
import { lotsPapierACreer, lotsSansDossierMarche, proceduresPourMarche } from './dossier-marche-procedures';

const ligne = (o: Partial<LigneEligible>): LigneEligible =>
  ({ idDetail: 1, idDossier: 1, refeDossier: null, designationMarche: 'X', idMode: null, libelleMode: null, montEstim: null, dejaDao: true, ...o }) as LigneEligible;

describe('Dossier de marché : les procédures qui peuvent le produire (19/10)', () => {
  const cloture = { idDossier: 100382, refeDossier: '00003/DAOO-CC/CNM/2026', statut: 'CLOTURE' };

  it('garde les procédures en ligne, au dossier de mise en concurrence clôturé', () => {
    const l = [
      ligne({ idDetail: 1, idDmc: 3, nbOffres: 3, dossier: cloture, sousType: 'DAOO-CC' }),
      ligne({ idDetail: 2, idDmc: 4, nbOffres: 0, dossier: cloture, sousType: 'DAOO-CC' }),
      ligne({ idDetail: 3, idDmc: 5, nbOffres: 2, dossier: { ...cloture, statut: 'DISPATCHE' }, sousType: 'DAOO' }),
      ligne({ idDetail: 4, idDmc: null, nbOffres: 0, dossier: null }),
    ];
    expect(proceduresPourMarche(l, null).map((x) => x.idDetail)).toEqual([1]);
  });

  it('le sous-type du marché choisit celui de la mise en concurrence', () => {
    const l = [ligne({ idDetail: 1, idDmc: 3, nbOffres: 3, dossier: cloture, sousType: 'DAOO-CC' }), ligne({ idDetail: 2, idDmc: 6, nbOffres: 1, dossier: cloture, sousType: 'DAOO' })];
    expect(proceduresPourMarche(l, 'MAOO-CC').map((x) => x.idDetail)).toEqual([1]);
    expect(proceduresPourMarche(l, 'MAOO').map((x) => x.idDetail)).toEqual([2]);
  });
});

describe('Lots dont le dossier de marché reste à créer (20/10, B2)', () => {
  it('un lot proposé sans dossier se crée ; au contrôle ou déjà doté, non', () => {
    const a = (lot: number, etat: string) => ({ lot, etat, rapportSigneLe: null, propose: null });
    expect(lotsSansDossierMarche({ attributions: [a(1, 'PROPOSE')], dossiersMarche: [] })).toBe(1);
    expect(lotsSansDossierMarche({ attributions: [a(1, 'AU_CONTROLE')], dossiersMarche: [{ lot: 1, idDossier: 100383, refeDossier: null, statut: 'SOUMIS' }] })).toBe(0);
    expect(lotsSansDossierMarche({ attributions: [a(1, 'EN_EVALUATION')], dossiersMarche: [] })).toBe(0);
  });
  it('sans état servi : repli sur l’absence de dossier, et rien si rien n’est servi', () => {
    expect(lotsSansDossierMarche({ dossiersMarche: [] })).toBe(1);
    expect(lotsSansDossierMarche({})).toBe(0);
  });
});

describe('Remise papier : la procédure figure, et ses lots à créer (27/10, P1-P2)', () => {
  it('une procédure papier figure dès que marchePapier est servi, ouverte ou non, sans offre en ligne', () => {
    const l = [
      ligne({ idDetail: 1, idDmc: 1, nbOffres: 0, dossier: null, sousType: 'DAOO-CC', modeRemise: 'PAPIER', marchePapier: { ouvert: false, motif: 'DOSSIER_NON_CLOTURE' } }),
      ligne({ idDetail: 2, idDmc: 2, nbOffres: 0, dossier: null, sousType: 'DAOO-CC', modeRemise: 'PAPIER', marchePapier: { ouvert: true, motif: null } }),
      ligne({ idDetail: 3, idDmc: 3, nbOffres: 0, dossier: null, sousType: 'DAOO-CC', modeRemise: 'PAPIER', marchePapier: null }),
      ligne({ idDetail: 4, idDmc: 4, nbOffres: 0, dossier: null, sousType: 'DAOO-CC', modeRemise: 'ELECTRONIQUE' }),
    ];
    expect(proceduresPourMarche(l, 'MAOO-CC').map((x) => x.idDetail)).toEqual([1, 2]);
  });

  it('les lots sans dossier de marché restent à créer ; une ligne sans lot a son lot 1', () => {
    expect(lotsPapierACreer({ lots: [{ lot: 1, intitule: 'A' }, { lot: 2, intitule: 'B' }], dossiersMarche: [{ lot: 1, idDossier: 9, refeDossier: null, statut: 'BROUILLON' }] }).map((x) => x.lot)).toEqual([2]);
    expect(lotsPapierACreer({ lots: null, dossiersMarche: [] }).map((x) => x.lot)).toEqual([1]);
  });
});
