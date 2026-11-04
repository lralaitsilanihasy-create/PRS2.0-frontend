import { FiliationDossier, NoeudFiliation } from '../../../models';
import { cibleDuDossier, lienVersLePlan } from './cible-dossier';

/** ⚠️ 04/11 (pilote) — « Tous mes dossiers » mène au plan, sur la ligne du dossier. */
describe('cibleDuDossier', () => {
  const noeud = (id: number, lien: string, enfants: NoeudFiliation[] = [], ligne: { idDetail: number; idLigneOrigine?: number } | null = null): NoeudFiliation => ({
    idDossier: id, refeDossier: null, idTypeDossier: null, idSousType: null, statut: 'CLOTURE', dateRef: null, lien, lot: null,
    ligne: ligne ? { objet: 'x', ...ligne } : null, masque: false, enfants,
  });
  // Plan 100390 → DAO 100401 (ligne 303392) → marché 100402 → avenant 100410 ; une version suivante du plan 100450.
  const f: FiliationDossier = {
    idDossierDemande: 100402,
    racine: noeud(100390, 'RACINE', [
      noeud(100401, 'MISE_EN_CONCURRENCE', [noeud(100402, 'MARCHE', [noeud(100410, 'MODIFICATION')])], { idDetail: 303392, idLigneOrigine: 303392 }),
      noeud(100450, 'VERSION_SUIVANTE'),
    ]),
  };

  it('le marché et son avenant : la ligne de leur mise en concurrence ; les versions du plan', () => {
    expect(cibleDuDossier(f, 100402)).toEqual({ plans: [100390, 100450], idDetail: 303392, idLigneOrigine: 303392 });
    expect(cibleDuDossier(f, 100410).idDetail).toBe(303392);
    expect(cibleDuDossier(f, 100401).idDetail).toBe(303392);
  });

  it('un dossier sans ligne (le plan lui-même) : aucune ligne', () => {
    expect(cibleDuDossier(f, 100390).idDetail).toBeNull();
  });
});

describe('lienVersLePlan', () => {
  it('un plan signé ouvre le plan ; en brouillon, il garde sa page ; un autre dossier ouvre le plan sur sa ligne', () => {
    expect(lienVersLePlan({ idDossier: 100390, idTypeDossier: 'DDP', statut: 'CLOTURE' })).toEqual({ commandes: ['/prmp/plan', 100390], params: {} });
    expect(lienVersLePlan({ idDossier: 100500, idTypeDossier: 'DDP', statut: 'BROUILLON' })).toBeNull();
    expect(lienVersLePlan({ idDossier: 100402, idTypeDossier: 'DDM', statut: 'SOUMIS' })).toEqual({ commandes: ['/prmp/plan'], params: { dossier: 100402 } });
  });
});
