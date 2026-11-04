import { Echeance, MarchePrevision, NoeudFiliation } from '../../../models';
import { datesIncoherentes, jalonsDeLigne, ongletsMasquesDe, prochainsJalons } from './detail-ligne';

/** ⚠️ 03/11 (pilote, lot 3) — le détail d'une ligne du plan : faits de la procédure, jalons prévus et réels, dates incohérentes. */
describe('Détail d’une ligne du plan', () => {
  const capms = new Map([['10', 'LANCEMENT'], ['11', 'OUVERTURE DES PLIS'], ['12', 'ATTRIBUTION']]);
  const p = (idCapm: number, dateDebut: string, sansObjet = false): MarchePrevision => ({ idPrevision: idCapm, idDetail: 1, idCapm, dateDebut, sansObjet }) as MarchePrevision;

  it('les jalons dans l’ordre des dates ; le réel rapproché par le type de jalon ; le retard d’un prévu passé sans réel', () => {
    const ech: Echeance[] = [{ idEcheance: 1, idDetail: 1, typeJalon: 'Lancement', datePrevue: '2026-03-06', dateReelle: '2026-03-10' }];
    const j = jalonsDeLigne([p(12, '2026-04-17'), p(10, '2026-03-06'), p(11, '2026-04-07', true)], capms, ech, '2026-11-03');
    expect(j.map((x) => x.processus)).toEqual(['LANCEMENT', 'ATTRIBUTION']);
    expect(j[0]).toMatchObject({ prevu: '06/03/2026', reel: '10/03/2026', retard: null, ecart: 4 });
    expect(j[1]).toMatchObject({ reel: '', retard: 200 });
  });

  it('par défaut, les jalons réalisés et les trois suivants', () => {
    const j = (reel: string) => ({ processus: 'x', prevu: '01/01/2026', reel, source: null, sansFait: false, retard: null });
    expect(prochainsJalons([j('a'), j(''), j(''), j(''), j(''), j('b')], 3).map((x) => x.reel)).toEqual(['a', '', '', '', 'b']);
    // ⚠️ 04/11 — un jalon « non renseigné » (aucun fait ne le date) ne prend pas la place d'un prochain jalon.
    const nr = { ...j(''), processus: 'nr', sansFait: true };
    expect(prochainsJalons([j('a'), nr, nr, j(''), j(''), j(''), j('')], 3).map((x) => x.processus)).toEqual(['x', 'nr', 'nr', 'x', 'x', 'x']);
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

  it('⚠️ 04/11 (redondances) — les éléments masqués : le plan partout ; la fiche de présentation sauf au dernier dossier ; DAO et bordereau du marché quand le DAO est affiché', () => {
    const noeud = (id: number, lien: string): NoeudFiliation => ({ idDossier: id, refeDossier: null, idTypeDossier: null, idSousType: null, statut: 'CLOTURE', dateRef: null, lien, lot: null, ligne: null, masque: false, enfants: [] });
    const dao = noeud(1, 'MISE_EN_CONCURRENCE'), marche = noeud(2, 'MARCHE'), avenant = noeud(3, 'MODIFICATION');
    expect(ongletsMasquesDe([dao, marche, avenant], dao)).toEqual(['plan', 'presentation']);
    expect(ongletsMasquesDe([dao, marche, avenant], marche)).toEqual(['plan', 'fiche-dao', 'bordereau']);
    expect(ongletsMasquesDe([dao, marche, avenant], avenant)).toEqual(['plan']);
    // Le DAO seul (procédure en cours) garde sa fiche ; un marché sans DAO affiché (version antérieure du plan) garde ses informations du DAO.
    expect(ongletsMasquesDe([dao], dao)).toEqual(['plan']);
    expect(ongletsMasquesDe([marche], marche)).toEqual(['plan']);
  });
});
