import { FiliationDossier, LigneEligible, NoeudFiliation } from '../../../models';
import { dossiersDeLaLigne, etapeACreer } from './chaine-ligne';

/** ⚠️ 03/11 (pilote) — la chaîne d'une ligne du plan : ses dossiers, puis l'étape suivante à créer. */
describe('dossiersDeLaLigne', () => {
  const noeud = (id: number, lien: string, enfants: NoeudFiliation[] = [], ligne: number | null = null, lot: number | null = null): NoeudFiliation => ({
    idDossier: id, refeDossier: `0000${id}`, idTypeDossier: null, idSousType: null, statut: 'CLOTURE', dateRef: null, lien, lot,
    ligne: ligne == null ? null : { idDetail: ligne, objet: 'x' }, masque: false, enfants,
  });
  const f: FiliationDossier = {
    idDossierDemande: 1,
    racine: noeud(1, 'RACINE', [
      noeud(2, 'MISE_EN_CONCURRENCE', [noeud(3, 'MARCHE', [noeud(5, 'MODIFICATION')], null, 1), noeud(4, 'MARCHE', [], null, 2)], 10),
      noeud(6, 'MISE_EN_CONCURRENCE', [], 11),
      noeud(7, 'VERSION_SUIVANTE', [noeud(8, 'MARCHE', [], 20, 1)]),
    ]),
  };
  const ids = (l: NoeudFiliation[]) => l.map((n) => n.idDossier);

  it('le plan, la mise en concurrence de la ligne, ses marchés et leurs actes — pas ceux des autres lignes', () => {
    expect(ids(dossiersDeLaLigne(f, { idDetail: 10, idDossier: 1 }))).toEqual([1, 2, 3, 5, 4]);
    expect(ids(dossiersDeLaLigne(f, { idDetail: 11, idDossier: 1 }))).toEqual([1, 6]);
  });

  it('une ligne d’une version suivante : sa version du plan, puis son marché sans mise en concurrence', () => {
    expect(ids(dossiersDeLaLigne(f, { idDetail: 20, idDossier: 7 }))).toEqual([7, 8]);
  });

  it('une ligne sans procédure : le plan seul', () => {
    expect(ids(dossiersDeLaLigne(f, { idDetail: 99, idDossier: 1 }))).toEqual([1]);
  });
});

describe('etapeACreer', () => {
  const e = (x: Partial<LigneEligible>): LigneEligible =>
    ({ idDetail: 10, idDossier: 1, refeDossier: null, designationMarche: 'x', idMode: 1, libelleMode: null, montEstim: null, dejaDao: false, ...x }) as LigneEligible;

  it('sans fiche : préparer les informations du DAO, ouvertes sur la ligne', () => {
    expect(etapeACreer(e({}), 'Appel d’offres ouvert', false)).toMatchObject({ bouton: 'Préparer les informations du DAO', commandes: ['/prmp/dao'], params: { dossier: 1, ligne: 10 } });
  });

  it('fiche sans dossier : la reprendre', () => {
    expect(etapeACreer(e({ dejaDao: true, idDmc: 4 }), null, false)).toMatchObject({ bouton: 'Reprendre les informations du DAO', commandes: ['/prmp/dao', 4] });
  });

  it('procédure électronique clôturée, un lot proposé sans dossier : créer le dossier de marché à l’attribution', () => {
    const l = e({ dejaDao: true, idDmc: 4, nbOffres: 2, dossier: { idDossier: 2, refeDossier: 'r', statut: 'CLOTURE' }, dossiersMarche: [],
      attributions: [{ lot: 1, etat: 'PROPOSE', rapportSigneLe: null, propose: null }] });
    expect(etapeACreer(l, null, true)).toMatchObject({ bouton: 'Créer le dossier de marché', commandes: ['/procedure', 4, 'evaluation'] });
    expect(etapeACreer({ ...l, dossiersMarche: [{ lot: 1, idDossier: 3, refeDossier: null, statut: 'BROUILLON' }] }, null, true)).toBeNull();
    expect(etapeACreer({ ...l, dossier: { idDossier: 2, refeDossier: 'r', statut: 'EN_EXAMEN' } }, null, true)).toMatchObject({ bouton: null });
  });

  it('procédure papier : la procédure dans « Dossier de marché », ou pourquoi il attend', () => {
    const l = e({ dejaDao: true, idDmc: 4, modeRemise: 'PAPIER', dossier: { idDossier: 2, refeDossier: 'r', statut: 'CLOTURE' }, lots: [{ lot: 1, intitule: null }], dossiersMarche: [], marchePapier: { ouvert: true, motif: null } });
    expect(etapeACreer(l, null, true)).toMatchObject({ commandes: ['/prmp/dossier-marche'], params: { dmc: 4 } });
    expect(etapeACreer({ ...l, marchePapier: { ouvert: false, motif: 'AVIS_NON_PUBLIE' } }, null, true)?.note).toContain('avis spécifique');
  });

  it('gré à gré hors fiche : le rapport justificatif ; consultation de prix : rien', () => {
    expect(etapeACreer(undefined, 'MARCHE DE GRE A GRE', false)).toMatchObject({ intitule: '', note: null, bouton: 'Créer le rapport justificatif', params: { famille: 'DMC', sousType: 'RJ' } });
    expect(etapeACreer(undefined, 'Gré à gré', true)).toBeNull();
    expect(etapeACreer(undefined, 'Consultation des Prix Ouverte', false)).toBeNull();
  });
});
