import { FiliationDossier, NoeudFiliation } from '../../../models';
import { cheminDeFiliation } from './chaine-procedure';

/** ⚠️ 01/11 (pilote, maquette « page du dossier », variante A) — la chaîne de la procédure, lue sur la filiation. */
describe('cheminDeFiliation', () => {
  const noeud = (id: number, lien: string, enfants: NoeudFiliation[] = [], masque = false): NoeudFiliation => ({
    idDossier: masque ? null : id, refeDossier: masque ? null : `0000${id}`, idTypeDossier: null, idSousType: null, statut: 'CLOTURE',
    dateRef: null, lien, lot: null, ligne: null, masque, enfants,
  });
  const racine = noeud(1, 'RACINE', [
    noeud(2, 'MISE_EN_CONCURRENCE', [noeud(3, 'MARCHE', [noeud(5, 'MODIFICATION')]), noeud(4, 'MARCHE')]),
    noeud(0, 'MISE_EN_CONCURRENCE', [], true),
  ]);
  const ids = (l: NoeudFiliation[]) => l.map((n) => n.idDossier);

  it('suit le chemin de la racine au dossier, puis ses suites directes', () => {
    const f: FiliationDossier = { idDossierDemande: 2, racine };
    const { chemin, suites } = cheminDeFiliation(f);
    expect(ids(chemin)).toEqual([1, 2]);
    expect(ids(suites)).toEqual([3, 4]);
  });

  it('va jusqu’à un acte de gestion ; le plan seul montre ses mises en concurrence, masquées comprises', () => {
    expect(ids(cheminDeFiliation({ idDossierDemande: 5, racine }).chemin)).toEqual([1, 2, 3, 5]);
    expect(cheminDeFiliation({ idDossierDemande: 1, racine }).suites.map((n) => n.masque)).toEqual([false, true]);
  });

  it('un dossier absent de l’arbre ne donne pas de chaîne', () => {
    expect(cheminDeFiliation({ idDossierDemande: 99, racine }).chemin).toEqual([]);
  });
});
