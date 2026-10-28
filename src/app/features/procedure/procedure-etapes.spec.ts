import { ProcedureInterne } from '../../models';
import { etapesProcedure, prochaineEtape } from './procedure-etapes';

describe('Mes procédures en ligne — frise et prochaine étape (28/10)', () => {
  const p = (x: Partial<ProcedureInterne>): ProcedureInterne => ({
    idDmc: 1, reference: '05-CC/MTP/PRMP/UGPM.2026', objet: 'Voie rapide de Sambava', autoriteContractante: 'MTP', categorie: null,
    statutFiche: 'VALIDEE', responsable: { im: 'RESPRO1', nom: 'RESPONSABLE Procédures' }, parInterim: false,
    etatCao: 'COMPLETE', etatCeremonie: 'CLOSE', datePublication: null, dateOuvertureDepots: null, dateLimite: '2026-12-17T10:00:00',
    dateOuverturePlis: null, etat: 'NON_LANCEE', etatSeance: null, nbOffres: 0, aTraiter: false, ...x,
  });
  const etats = (x: Partial<ProcedureInterne>) => etapesProcedure(p(x)).map((e) => e.etat);

  it('cérémonie close, avis pas encore imprimé : la main est à la PRMP, sans geste pour le responsable', () => {
    expect(etats({})).toEqual(['fait', 'fait', 'encours', 'avenir', 'avenir']);
    expect(prochaineEtape(p({}))).toEqual({ qui: 'La PRMP', texte: 'Imprimer l’avis spécifique : la procédure paraîtra alors dans l’espace candidat.', geste: null });
  });

  it('cérémonie à conduire : c’est au responsable, depuis les paramètres', () => {
    expect(etats({ etatCeremonie: 'A_VENIR' })).toEqual(['fait', 'encours', 'avenir', 'avenir', 'avenir']);
    expect(prochaineEtape(p({ etatCeremonie: 'A_VENIR' })).geste).toBe('parametres');
  });

  it('dépôts ouverts puis clos : le nombre d’offres, puis la séance', () => {
    expect(prochaineEtape(p({ etat: 'OUVERTE', nbOffres: 2 })).texte).toBe('Dépôts ouverts : 2 offres reçues, jusqu’au 17/12/2026 à 10:00.');
    expect(etats({ etat: 'CLOSE', nbOffres: 2 })).toEqual(['fait', 'fait', 'fait', 'fait', 'encours']);
    expect(prochaineEtape(p({ etat: 'CLOSE' })).geste).toBe('seance');
  });

  it('séance close : toutes les étapes faites, l’évaluation suit', () => {
    expect(etats({ etat: 'CLOSE', etatSeance: 'CLOSE' })).toEqual(['fait', 'fait', 'fait', 'fait', 'fait']);
    expect(prochaineEtape(p({ etat: 'CLOSE', etatSeance: 'CLOSE' })).texte).toContain('évaluation');
  });
});
