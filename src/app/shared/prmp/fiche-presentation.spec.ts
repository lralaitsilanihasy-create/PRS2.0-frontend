import { Capm, Marche, MarchePrevision, ModePassation } from '../../models';
import { calculerFichePresentation } from './fiche-presentation';

/**
 * « Fiche de présentation » — les trois listes du formulaire officiel, dérivées du plan :
 * mode DÉROGATOIRE (catégorie du référentiel), DÉLAIS AMÉNAGÉS (ouverture − lancement <
 * delaiMinJours du mode), CONTRATS-CADRES (forme de marché). Un marché peut cumuler.
 */
describe('calculerFichePresentation', () => {
  const modes: ModePassation[] = [
    { idMode: 1, libelle: 'Appel d’offres ouvert', categorie: 'NORMAL', delaiMinJours: 30 },
    { idMode: 2, libelle: 'Gré à gré', categorie: 'DEROGATOIRE' },
    { idMode: 3, libelle: 'Consultation restreinte', categorie: 'NORMAL' }, // sans délai min déclaré
  ];
  const capms: Capm[] = [
    { idCapm: 10, libelleProcessus: 'Date prévisionnelle de lancement', ordre: 1 },
    { idCapm: 20, libelleProcessus: 'Date prévisionnelle ouverture des plis', ordre: 2 },
  ];
  const marche = (idDetail: number, extra: Partial<Marche>): Marche =>
    ({ idDetail, idDossier: 1, idPpm: 1, designationMarche: `M${idDetail}`, montEstim: 1000 * idDetail, ...extra }) as Marche;
  const prev = (idDetail: number, idCapm: number, dateDebut: string): MarchePrevision =>
    ({ idPrevision: idDetail * 100 + idCapm, idDetail, idCapm, dateDebut }) as MarchePrevision;

  it('classe dérogatoires, délais aménagés et contrats-cadres — et un marché peut cumuler', () => {
    const marches = [
      marche(1, { idMode: 2 }), // dérogatoire
      marche(2, { idMode: 1 }), // AO ouvert, délai 10 j < 30 → délais aménagés
      marche(3, { idMode: 1, formeMarche: 'CONTRAT_CADRE' }), // contrat-cadre ET délai 40 j (conforme)
      marche(4, { idMode: 1 }), // délai 40 j, rien à signaler
    ];
    const previsions = [
      prev(2, 10, '2026-09-07'), prev(2, 20, '2026-09-17'), // 10 jours
      prev(3, 10, '2026-09-01'), prev(3, 20, '2026-10-11'), // 40 jours
      prev(4, 10, '2026-09-01'), prev(4, 20, '2026-10-11'),
    ];
    const f = calculerFichePresentation(marches, previsions, modes, capms);
    expect(f.derogatoires.map((l) => l.idDetail)).toEqual([1]);
    expect(f.delaisAmenages.map((l) => l.idDetail)).toEqual([2]);
    expect(f.delaisAmenages[0].delaiJours).toBe(10);
    expect(f.delaisAmenages[0].delaiMinJours).toBe(30);
    expect(f.contratsCadres.map((l) => l.idDetail)).toEqual([3]);
    expect(f.contratsCadres[0].delaiJours).toBe(40);
    expect(f.nbMarchesConcernes).toBe(3);
  });

  it('délais aménagés : jamais sans les DEUX dates ni sans délai min déclaré au référentiel', () => {
    const marches = [
      marche(1, { idMode: 1 }), // lancement seul
      marche(2, { idMode: 3 }), // dates complètes (5 j) mais mode sans delaiMinJours
    ];
    const previsions = [prev(1, 10, '2026-09-01'), prev(2, 10, '2026-09-01'), prev(2, 20, '2026-09-06')];
    const f = calculerFichePresentation(marches, previsions, modes, capms);
    expect(f.delaisAmenages).toEqual([]);
    expect(f.nbMarchesConcernes).toBe(0);
  });

  it('égalité au plancher = conforme (strictement inférieur seulement)', () => {
    const marches = [marche(1, { idMode: 1 })];
    const previsions = [prev(1, 10, '2026-09-01'), prev(1, 20, '2026-10-01')]; // 30 = min
    expect(calculerFichePresentation(marches, previsions, modes, capms).delaisAmenages).toEqual([]);
  });

  it('ignore les lignes supprimées (versionnement : hors de toute vue officielle)', () => {
    const marches = [marche(1, { idMode: 2, supprimee: true }), marche(2, { formeMarche: 'CONTRAT_CADRE', supprimee: true })];
    const f = calculerFichePresentation(marches, [], modes, capms);
    expect(f.derogatoires).toEqual([]);
    expect(f.contratsCadres).toEqual([]);
    expect(f.nbMarchesConcernes).toBe(0);
  });
});
