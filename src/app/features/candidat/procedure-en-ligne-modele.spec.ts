import { DocumentProcedureEnLigne, ProcedureEnLigne, RecuDao } from '../../models';
import { avancementDepot, compteursProcedures, etapesParcours, filtrerProcedures, formatDuFichier, grouperDocuments, jalons, joursAvant, lignesProcedures, tempsRestant } from './procedure-en-ligne-modele';

const procedure = (p: Partial<ProcedureEnLigne> = {}): ProcedureEnLigne => ({
  idDmc: 2, reference: '00001/PPM-AGPM/CNM/2026', objet: 'Fourniture d’articles de bureau', autoriteContractante: 'MEF', categorie: 'FOURNITURES_SERVICES',
  lots: [{ numero: 1, intitule: 'Articles de bureau' }], datePublication: '2027-02-01', dateOuvertureDepots: '2027-02-01T08:00', dateLimite: '2027-03-04T09:00',
  heureReference: null, signatureExigee: 'Simple', formatsAcceptes: ['PDF'], tailleMaxFichierMo: 20, tailleMaxOffreMo: 100, assistance: null, etat: 'A_VENIR',
  depotsOuverts: false, retraitPayant: true, ...p,
});
const recu = (etat: RecuDao['etat']): RecuDao => ({ idRecu: 1, lots: null, montant: 150000, referencePaiement: 'R1', datePaiement: '2026-10-18', banque: null, nomFichier: 'r.pdf', dateDepot: '2026-10-18T10:00', etat, motifRefus: null, dateDecision: null, decidePar: null });
const doc = (code: string, intitule = 'Dossier d’appel d’offres complet'): DocumentProcedureEnLigne => ({ code, intitule, version: 2, taille: 1000 } as DocumentProcedureEnLigne);

describe('Procédure en ligne — présentation (18/10)', () => {
  it('le parcours d’un dossier payant : frais à faire, retrait verrouillé, questions, dépôt à venir', () => {
    const e = etapesParcours(procedure(), null, true);
    expect(e.map((x) => [x.cle, x.etat])).toEqual([['frais', 'a-faire'], ['retrait', 'bloque'], ['questions', 'a-faire'], ['depot', 'a-venir']]);
    expect(e[3].detail).toBe('Du 01/02/2027 à 08:00 au 04/03/2027 à 09:00.');
  });

  it('le reçu fait avancer le parcours : en attente, puis validé (le retrait s’ouvre)', () => {
    expect(etapesParcours(procedure(), recu('EN_ATTENTE'), true).slice(0, 2).map((x) => x.etat)).toEqual(['en-cours', 'bloque']);
    expect(etapesParcours(procedure(), recu('VALIDE'), true).slice(0, 2).map((x) => x.etat)).toEqual(['fait', 'a-faire']);
    expect(etapesParcours(procedure(), recu('REFUSE'), true)[0]).toMatchObject({ etat: 'a-faire', detail: 'Reçu refusé : déposez-en un nouveau.' });
  });

  it('un dossier gratuit n’a pas d’étape de frais ; dépôts ouverts : en cours ; procédure close : tout est clos', () => {
    expect(etapesParcours(procedure({ retraitPayant: false }), null, true).map((x) => x.cle)).toEqual(['retrait', 'questions', 'depot']);
    expect(etapesParcours(procedure({ depotsOuverts: true, etat: 'OUVERTE' }), null, true).at(-1)).toMatchObject({ etat: 'en-cours', detail: 'Ouvert jusqu’au 04/03/2027 à 09:00.' });
    expect(etapesParcours(procedure({ etat: 'CLOSE' }), null, true).every((x) => x.etat === 'clos')).toBe(true);
  });

  it('les documents : un même intitulé en PDF et en Word = une ligne, le PDF d’abord', () => {
    const g = grouperDocuments([doc('DAO_v2.docx'), doc('DAO_v2.pdf'), doc('BP.xlsx', 'Bordereau des prix')]);
    expect(g.map((x) => [x.intitule, x.formats.map((f) => f.format)])).toEqual([['Dossier d’appel d’offres complet', ['PDF', 'Word']], ['Bordereau des prix', ['Excel']]]);
    expect(formatDuFichier('ARCHIVE.7z')).toBe('7Z');
    expect(formatDuFichier('sans-extension')).toBe('Fichier');
  });

  it('le temps restant : jours, demain, heures ; rien une fois la date passée', () => {
    const maintenant = new Date(2026, 9, 18, 16, 0);
    expect(tempsRestant('2027-03-04T09:00', maintenant)).toBe('dans 137 jours');
    expect(tempsRestant('2026-10-19T09:00', maintenant)).toBe('dans 17 heures');
    expect(tempsRestant('2026-10-20T09:00', maintenant)).toBe('dans 2 jours');
    expect(tempsRestant('2026-10-19T17:00', maintenant)).toBe('demain');
    expect(tempsRestant('2026-10-18T09:00', maintenant)).toBeNull();
    expect(tempsRestant(null, maintenant)).toBeNull();
  });

  it('la frise : publication, ouverture, date limite (marquée), passées ou non', () => {
    const j = jalons(procedure(), new Date(2027, 1, 15));
    expect(j.map((x) => [x.libelle, x.date, x.passe, !!x.fort])).toEqual([
      ['Publication de l’avis', '01/02/2027', true, false],
      ['Ouverture des dépôts', '01/02/2027 à 08:00', true, false],
      ['Date limite de remise', '04/03/2027 à 09:00', false, true],
    ]);
  });
});

describe('Liste des procédures (19/10, maquette)', () => {
  const maintenant = new Date(2026, 9, 19, 9, 0);
  const cats = { FOURNITURES_SERVICES: 'Fournitures et services' };
  const ouverte = procedure({ idDmc: 3, reference: '13-CC', etat: 'OUVERTE', depotsOuverts: true, dateOuvertureDepots: '2026-10-19T00:00', datePublication: '2026-10-19', dateLimite: '2026-11-20T09:00' });
  const aVenir = procedure({ idDmc: 2, reference: '12-CC', etat: 'A_VENIR', dateLimite: '2027-03-04T09:00' });
  const ami = { idDmc: 9, reference: 'AMI-1', objet: 'Étude', autoriteContractante: 'MEN', dateLimite: '2026-10-29T08:00', publieLe: '2026-10-09T10:00', ouvert: true };

  it('appels d’offres et AMI dans une même liste, la date limite la plus proche d’abord', () => {
    const l = lignesProcedures([aVenir, ouverte], [ami], cats, maintenant);
    expect(l.map((x) => x.cle)).toEqual(['AMI-9', 'AO-3', 'AO-2']);
    expect(l[1]).toMatchObject({ etat: 'OUVERTE', joursRestants: 32, categorie: 'Fournitures et services', lots: 'Lot unique', lien: ['/candidat', 'procedures', 3] });
    expect(l[1].avancement).toBe(1);
    expect(l[2]).toMatchObject({ etat: 'A_VENIR', avancement: null, joursRestants: 136 });
    expect(l[0]).toMatchObject({ genre: 'AMI', joursRestants: 10, avancement: 50 });
  });

  it('les compteurs : ouvertes, à venir, prochaine échéance en jours', () => {
    expect(compteursProcedures(lignesProcedures([aVenir, ouverte], [], cats, maintenant))).toEqual({ ouvertes: 1, aVenir: 1, prochaine: 32 });
    expect(compteursProcedures([])).toEqual({ ouvertes: 0, aVenir: 0, prochaine: null });
  });

  it('le filtre d’état et la recherche sans accents ni casse', () => {
    const l = lignesProcedures([aVenir, ouverte], [ami], cats, maintenant);
    expect(filtrerProcedures(l, '', 'A_VENIR').map((x) => x.cle)).toEqual(['AO-2']);
    expect(filtrerProcedures(l, 'etude', 'TOUTES').map((x) => x.cle)).toEqual(['AMI-9']);
    expect(filtrerProcedures(l, 'men', 'OUVERTE').map((x) => x.cle)).toEqual(['AMI-9']);
  });

  it('avancement borné de 0 à 100, nul sans dates ; plus de jours une fois la date passée', () => {
    expect(avancementDepot('2026-10-20', '2026-11-20', maintenant)).toBe(0);
    expect(avancementDepot('2026-09-01', '2026-10-01', maintenant)).toBe(100);
    expect(avancementDepot(null, '2026-11-20', maintenant)).toBeNull();
    expect(joursAvant('2026-10-19T08:00', maintenant)).toBeNull();
  });
});
