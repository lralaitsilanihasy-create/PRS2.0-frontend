import { Dossier } from '../../models';
import { exempleAFairePresident, exempleAFairePrmp } from '../../features/home/a-faire/a-faire-contrat.exemple';
import { delaiLigne, friseDossier, jourSemaineDate } from './frise-delai';

/**
 * Lot L4-F2 — la frise et le délai d'« À faire » servent aussi sur un `Dossier` (page dossier), sans
 * seconde règle : même frise pour la tâche et pour le dossier qu'elle porte.
 */
describe('Frise et délai — sur un dossier comme sur une tâche', () => {
  const visa = exempleAFairePresident().taches[2];
  const rectifier = exempleAFairePrmp().taches[1];

  /** Le dossier tel que `GET /api/dossiers/{id}` le sert, avec les mêmes dates et acteurs que la tâche. */
  const dossierDe = (t: typeof visa, attentePrmp = false): Dossier => ({
    idDossier: t.dossier.idDossier,
    statut: t.dossier.statut,
    datesEtapes: t.dossier.datesEtapes,
    acteursEtapes: t.dossier.acteursEtapes,
    attentePrmp,
  });

  it('un dossier donne la même frise que la tâche qui le porte', () => {
    expect(friseDossier(dossierDe(visa))).toEqual(friseDossier(visa));
    expect(friseDossier(dossierDe(visa))[2].acteur).toBe('Naina Razafindrakoto');
  });

  it('sur un dossier, la pause vient de « attentePrmp » (balle chez la PRMP)', () => {
    const frise = friseDossier(dossierDe(rectifier, true));
    expect(frise).toEqual(friseDossier(rectifier));
    expect(frise[5]).toMatchObject({ etat: 'pause', date: 'en pause' });
    expect(friseDossier(dossierDe(rectifier, false))[5]).toMatchObject({ etat: 'courante', date: 'en cours' });
  });

  it('dossier sans dates ni acteurs (PRMP, UGPM) : sept étapes, aucun acteur', () => {
    const frise = friseDossier({ idDossier: 1, statut: 'DISPATCHE', acteursEtapes: null });
    expect(frise.map((e) => e.etat)).toEqual(['faite', 'faite', 'courante', 'a-venir', 'a-venir', 'a-venir', 'a-venir']);
    expect(frise.every((e) => e.acteur === null)).toBe(true);
    expect(frise[2].date).toBe('en cours');
  });

  it("le délai se lit sur l'étape courante servie avec les gestes (paire urgence + délai)", () => {
    const etapeCourante = { urgence: visa.urgence, delai: visa.delai };
    expect(delaiLigne(etapeCourante)).toEqual(delaiLigne(visa));
  });

  it('fin de traitement prévue : jour de la semaine et date complète', () => {
    expect(jourSemaineDate('2026-09-24')).toBe('jeu. 24/09/2026');
    expect(jourSemaineDate(null)).toBe('');
    expect(jourSemaineDate('pas une date')).toBe('');
  });
});
