import { Echeance, LigneEligible, MarchePrevision, NoeudFiliation } from '../../../models';
import { datesIncoherentes, faitsDeProcedure, jalonsDeLigne, prochainsJalons } from './detail-ligne';

/** ⚠️ 03/11 (pilote, lot 3) — le détail d'une ligne du plan : faits de la procédure, jalons prévus et réels, dates incohérentes. */
describe('Détail d’une ligne du plan', () => {
  const capms = new Map([['10', 'LANCEMENT'], ['11', 'OUVERTURE DES PLIS'], ['12', 'ATTRIBUTION']]);
  const p = (idCapm: number, dateDebut: string, sansObjet = false): MarchePrevision => ({ idPrevision: idCapm, idDetail: 1, idCapm, dateDebut, sansObjet }) as MarchePrevision;

  it('les jalons dans l’ordre des dates ; le réel rapproché par le type de jalon ; le retard d’un prévu passé sans réel', () => {
    const ech: Echeance[] = [{ idEcheance: 1, idDetail: 1, typeJalon: 'Lancement', datePrevue: '2026-03-06', dateReelle: '2026-03-10' }];
    const j = jalonsDeLigne([p(12, '2026-04-17'), p(10, '2026-03-06'), p(11, '2026-04-07', true)], capms, ech, '2026-11-03');
    expect(j.map((x) => x.processus)).toEqual(['LANCEMENT', 'ATTRIBUTION']);
    expect(j[0]).toMatchObject({ prevu: '06/03/2026', reel: '10/03/2026', retard: null });
    expect(j[1]).toMatchObject({ reel: '', retard: 200 });
  });

  it('par défaut, les jalons réalisés et les trois suivants', () => {
    const j = (reel: string) => ({ processus: 'x', prevu: '01/01/2026', reel, source: null, sansFait: false, retard: null });
    expect(prochainsJalons([j('a'), j(''), j(''), j(''), j(''), j('b')], 3).map((x) => x.reel)).toEqual(['a', '', '', '', 'b']);
  });

  it('⚠️ jalons-reels — la date calculée prime, sa source en infobulle ; un processus sans fait n’est pas en retard', () => {
    const prev = [p(101, '2025-12-21'), p(106, '2026-01-30'), p(111, '2026-03-06')];
    const noms = new Map([['101', 'Détermination des besoins'], ['106', 'Transmission du DAO/DC à la CNM'], ['111', 'Lancement du DAO/DC']]);
    const reels = [{ idDetail: 1, idCapm: 106, dateReelle: '2026-06-02', source: 'Réception du dossier 00002/DAOO-CC/CNM/2026, le 02/06/2026' }];
    const j = jalonsDeLigne(prev, noms, [], '2026-11-03', reels);
    expect(j[0]).toMatchObject({ sansFait: true, retard: null, reel: '' });
    expect(j[1]).toMatchObject({ reel: '02/06/2026', source: reels[0].source, retard: null });
    expect(j[2].retard).toBe(242);
    // Sans réponse du serveur, rien n'est « sans fait » : le prévu dépassé reste signalé.
    expect(jalonsDeLigne(prev, noms, [], '2026-11-03', null)[0].retard).toBe(317);
  });

  it('signale l’attribution prévue avant le lancement (RNS 13)', () => {
    expect(datesIncoherentes([p(10, '2026-03-06'), p(12, '2026-02-06')], capms)).toContain('06/02/2026');
    expect(datesIncoherentes([p(10, '2026-03-06'), p(12, '2026-04-17')], capms)).toBeNull();
  });

  it('les faits de la procédure : seulement ce qui existe', () => {
    const e = { idDetail: 1, dejaDao: true, fiche: { statut: 'VALIDEE', version: 2 }, dossier: { idDossier: 5, refeDossier: '00002/DAOO-CC/CNM/2026', statut: 'CLOTURE' },
      modeRemise: 'ELECTRONIQUE', nbOffres: 3, attributions: [{ lot: 1, etat: 'PROPOSE', rapportSigneLe: null, propose: null }] } as unknown as LigneEligible;
    const f = faitsDeProcedure({ avisImprimeLe: '2026-10-28' }, e, []);
    expect(f.map((x) => x[0])).toEqual(['Informations du DAO', 'Dossier de mise en concurrence', 'Remise des offres', 'Avis spécifique', 'Offres déposées', 'Attribution']);
    expect(f[3][1]).toBe('imprimé le 28/10/2026');
    const rj: NoeudFiliation = { idDossier: 9, refeDossier: null, idTypeDossier: 'DMC', idSousType: 'RJ', statut: 'BROUILLON', dateRef: null, lien: 'MISE_EN_CONCURRENCE', lot: null, ligne: null, masque: false, enfants: [] };
    expect(faitsDeProcedure({}, undefined, [rj])[0][0]).toBe('Rapport justificatif');
    expect(faitsDeProcedure({}, undefined, [])).toEqual([]);
  });
});
