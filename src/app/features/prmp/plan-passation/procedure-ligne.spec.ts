import { LigneEligible } from '../../../models';
import { liensProcedure, numeroProcedure } from './procedure-ligne';

/** ⚠️ 04/11 (pilote, temps 1) — la rangée « Procédure en ligne » d'une ligne du plan : les mêmes règles que les liens de la fiche. */
describe('liensProcedure', () => {
  const ligne = (x: Partial<LigneEligible>): LigneEligible => ({
    idDetail: 303392, idDossier: 100390, refeDossier: null, designationMarche: 'Routes de Maintirano', idMode: 1, libelleMode: 'AOO', montEstim: 8e9,
    dejaDao: true, idDmc: 10, ...x,
  });
  const libelles = (l: ReturnType<typeof liensProcedure>) => l.map((x) => x.libelle);

  it('sans fiche : rien (la ligne porte « Préparer les informations du DAO »)', () => {
    expect(liensProcedure(ligne({ dejaDao: false, idDmc: null }), 'PRMP')).toEqual([]);
  });

  it('fiche en brouillon, jamais validée : la commission seule (la fiche s’ouvre par « Reprendre les informations du DAO »)', () => {
    expect(libelles(liensProcedure(ligne({ fiche: { statut: 'BROUILLON', version: 1 } }), 'PRMP'))).toEqual(['Commission d’appel d’offres']);
  });

  it('lancée, remise électronique, PRMP : fiche, commission, dépôts (avec le compte), retraits, questions, reçus, séance, évaluation', () => {
    const l = liensProcedure(ligne({
      fiche: { statut: 'VALIDEE', version: 1 }, dossier: { idDossier: 100401, refeDossier: '00002/DAOO/CNM/2026', statut: 'CLOTURE' },
      modeRemise: 'ELECTRONIQUE', nbOffres: 3, recusEnAttente: 2, numeroProcedure: '15/MTP/SG/PRMP.2026',
      attributions: [{ lot: 1, etat: 'PROPOSE', rapportSigneLe: '2026-12-18T15:00:00', propose: null }],
    }), 'PRMP');
    // Dossier clôturé : la fiche, figée, se lit dans la barre du dossier ; le dossier de marché manque encore, l'évaluation reste.
    expect(libelles(l)).toEqual(['Commission d’appel d’offres', 'Dépôts des offres', 'Retraits du DAO', 'Questions des candidats', 'Reçus des frais', 'Séance d’ouverture', 'Évaluation des offres']);
    expect(l.find((x) => x.libelle === 'Dépôts des offres')?.n).toBe('3 offres');
    expect(l.find((x) => x.libelle === 'Reçus des frais')?.n).toBe('2 à valider');
    expect(l.find((x) => x.libelle === 'Séance d’ouverture')?.commandes).toEqual(['/procedure', 10, 'seance']);
    expect(l.find((x) => x.libelle === 'Évaluation des offres')?.n).toBe('Proposition du rapport — dossier de marché à créer');
  });

  it('UGPM : ni dépôts ni retraits (PRMP seule) ; à la Commission : pas encore de séance ni d’évaluation', () => {
    const l = liensProcedure(ligne({
      fiche: { statut: 'VALIDEE', version: 1 }, dossier: { idDossier: 100401, refeDossier: null, statut: 'EN_EXAMEN' }, modeRemise: 'ELECTRONIQUE',
    }), 'UGPM');
    expect(libelles(l)).toEqual(['Ouvrir la fiche DAO', 'Commission d’appel d’offres', 'Questions des candidats', 'Reçus des frais']);
  });

  it('le numéro de la procédure n’est affiché qu’après une première validation (avant, le serveur sert la référence du plan)', () => {
    expect(numeroProcedure({ numeroProcedure: '00001/PPM-AGPM/CNM/2026', modeRemise: null })).toBeNull();
    expect(numeroProcedure({ numeroProcedure: '15/MTP/SG/PRMP.2026', modeRemise: 'ELECTRONIQUE' })).toBe('15/MTP/SG/PRMP.2026');
  });

  it('⚠️ 04/11 (redondances) — chaque lot a son dossier de marché : ni séance ni évaluation (la barre du marché les porte)', () => {
    const l = liensProcedure(ligne({
      fiche: { statut: 'VALIDEE', version: 1 }, dossier: { idDossier: 100401, refeDossier: '00002/DAOO/CNM/2026', statut: 'CLOTURE' }, modeRemise: 'ELECTRONIQUE',
      attributions: [{ lot: 1, etat: 'AU_CONTROLE', rapportSigneLe: '2026-12-18T15:00:00', propose: null }],
      dossiersMarche: [{ lot: 1, idDossier: 100402, refeDossier: null, statut: 'SOUMIS' }],
    }), 'PRMP');
    expect(libelles(l)).toEqual(['Commission d’appel d’offres', 'Dépôts des offres', 'Retraits du DAO', 'Questions des candidats', 'Reçus des frais']);
  });

  it('remise papier : la fiche seule — rien ne se conduit en ligne', () => {
    const l = liensProcedure(ligne({ fiche: { statut: 'VALIDEE', version: 2 }, dossier: { idDossier: 5, refeDossier: 'x', statut: 'EN_EXAMEN' }, modeRemise: 'PAPIER' }), 'PRMP');
    expect(libelles(l)).toEqual(['Ouvrir la fiche DAO']);
  });
});
