import { AFaireTache, GesteAFaire } from '../../../models';
import { famillePage } from '../../circuit/page-dossier/etape-courante-modele';
import { LIBELLES_GESTES } from './a-faire-libelles';
import { exempleAFairePresident } from './a-faire-contrat.exemple';
import { FAMILLES_GESTES, GESTES_SUR_PAGE, cibleAccueil, cibleDossier, cibleGeste } from './a-faire-navigation';

describe('Accueil « À faire » — geste → écran existant', () => {
  const base = exempleAFairePresident().taches[2]; // dossier 1002, PV 12, réception 380, dispatch 210
  const t = (refs: Partial<AFaireTache['refs']> = {}): AFaireTache => ({ ...base, refs: { ...base.refs, ...refs } });

  it('réception et dispatch : les modales existantes, par-dessus l’accueil', () => {
    expect(cibleGeste('NUMEROTER', t(), 'secretaire')).toEqual({ type: 'modale', modale: 'reception' });
    expect(cibleGeste('DISPATCHER', t(), 'president')).toEqual({ type: 'modale', modale: 'dispatch' });
    expect(cibleGeste('REATTRIBUER', t(), 'cc')).toEqual({ type: 'modale', modale: 'reattribution' });
    // Sans la réception, la modale ne peut pas s'ouvrir : consultation du dossier.
    expect(cibleGeste('DISPATCHER', t({ idReception: null }), 'president')).toEqual({ type: 'modale', modale: 'consultation' });
  });

  it("examen : l'écran d'examen du dossier, dans l'espace du profil", () => {
    expect(cibleGeste('EXAMINER', t(), 'membre')).toEqual({ type: 'route', commandes: ['/membre', 'examiner', 1002], ciblee: true });
    expect(cibleGeste('REPRENDRE_EXAMEN', t(), 'cc')).toMatchObject({ commandes: ['/cc', 'examiner', 1002] });
  });

  it('projet de PV : la gestion du PV ouverte sur CE PV (?gerer=idPv)', () => {
    expect(cibleGeste('VISER', t(), 'president')).toEqual({ type: 'route', commandes: ['/president', 'resultat-examen', 'pv'], queryParams: { gerer: 12 }, ciblee: true });
    expect(cibleGeste('SIGNER', t(), 'membre')).toMatchObject({ commandes: ['/membre', 'resultat-examen', 'pv'], queryParams: { gerer: 12 } });
    expect(cibleGeste('ACCEPTER', t({ idPv: null }), 'cc')).toEqual({ type: 'route', commandes: ['/cc', 'resultat-examen', 'pv'], ciblee: false });
  });

  it('lettres, retraits, vérification, archivage', () => {
    expect(cibleGeste('SIGNER_LETTRE', t({ idLettre: 31 }), 'cc')).toMatchObject({ commandes: ['/cc', 'lettre-renvois', 31], ciblee: true });
    expect(cibleGeste('ARCHIVER_LETTRE', t({ idLettre: 31 }), 'assistant')).toMatchObject({ commandes: ['/assistant', 'lettre-renvois', 31] });
    expect(cibleGeste('DECIDER_RETRAIT', t(), 'president')).toEqual({ type: 'route', commandes: ['/president', 'retraits'], ciblee: false });
    expect(cibleGeste('TRANSMETTRE_SIGMP', t(), 'verificateur')).toMatchObject({ commandes: ['/verificateur', 'verifier', 1002], ciblee: true });
    expect(cibleGeste('ARCHIVER_PV', t(), 'assistant')).toMatchObject({ commandes: ['/assistant', 'pv-examens', 12], ciblee: true });
  });

  it('partie contrôlée : brouillon repris, rectification avec retour, pièces et compléments', () => {
    expect(cibleGeste('SOUMETTRE', t(), 'prmp')).toMatchObject({ commandes: ['/prmp', 'soumettre-dossier'], queryParams: { reprendre: 1002 } });
    expect(cibleGeste('COMPLETER_BROUILLON', t(), 'prmp')).toMatchObject({ queryParams: { reprendre: 1002 } });
    expect(cibleGeste('RECTIFIER', t(), 'prmp')).toMatchObject({ commandes: ['/prmp', 'rectifier', 1002], queryParams: { returnUrl: '/prmp/a-faire' } });
    expect(cibleGeste('COMPLETER_PIECES_DEPOT', t(), 'prmp')).toEqual({ type: 'modale', modale: 'pieces-depot' });
    expect(cibleGeste('TRANSMETTRE_COMPLEMENTS', t({ idLettre: 8 }), 'prmp')).toMatchObject({ commandes: ['/prmp', 'resultat-examen', 'lettre-renvois', 8] });
  });

  it('consultation : suivre ou voir ouvre la consultation du dossier', () => {
    expect(cibleGeste('SUIVRE', t(), 'prmp')).toEqual({ type: 'modale', modale: 'consultation' });
    expect(cibleGeste('VOIR', t(), 'verificateur')).toEqual({ type: 'modale', modale: 'consultation' });
  });

  it('chaque geste du contrat a un libellé, une famille et une cible', () => {
    const gestes = Object.keys(LIBELLES_GESTES) as GesteAFaire[];
    expect(gestes).toHaveLength(25);
    for (const g of gestes) {
      expect(FAMILLES_GESTES[g]).toBeTruthy();
      expect(cibleGeste(g, t({ idLettre: 1 }), 'cc')).toBeTruthy();
    }
  });
});

describe('Accueil « À faire » — lot L4-F6 : geste → page du dossier', () => {
  const base = exempleAFairePresident().taches[2]; // dossier 1002, PV 12, réception 380, dispatch 210
  const t = (refs: Partial<AFaireTache['refs']> = {}): AFaireTache => ({ ...base, refs: { ...base.refs, ...refs } });
  const retour = '/president/a-faire?vue=etape';

  it('consultation : VOIR et SUIVRE mènent à la page, avec le retour vers l’accueil', () => {
    expect(cibleAccueil('VOIR', t(), 'president', retour)).toEqual({
      type: 'route',
      commandes: ['/', 'president', 'dossier', 1002],
      queryParams: { returnUrl: retour },
      ciblee: true,
    });
    expect(cibleAccueil('SUIVRE', t(), 'prmp', '/prmp/a-faire')).toMatchObject({ commandes: ['/', 'prmp', 'dossier', 1002], queryParams: { returnUrl: '/prmp/a-faire' } });
  });

  it('gestes courts : la page s’ouvre sur l’étape (?geste=), jamais une modale sur l’accueil', () => {
    for (const geste of GESTES_SUR_PAGE) {
      const cible = cibleAccueil(geste, t(), 'president', retour);
      expect(cible).toEqual({ type: 'route', commandes: ['/', 'president', 'dossier', 1002], queryParams: { returnUrl: retour, geste }, ciblee: true });
    }
  });

  it('écrans de travail : inchangés, la cible reste celle de l’écran existant', () => {
    for (const geste of ['EXAMINER', 'VERIFIER', 'RECTIFIER', 'SOUMETTRE', 'COMPLETER_BROUILLON', 'ARCHIVER_PV', 'SIGNER_LETTRE', 'TRANSMETTRE_COMPLEMENTS'] as GesteAFaire[]) {
      expect(cibleAccueil(geste, t({ idLettre: 8 }), 'cc', retour)).toEqual(cibleGeste(geste, t({ idLettre: 8 }), 'cc'));
    }
  });

  it('plus aucune modale par dossier depuis l’accueil : tout est une route', () => {
    for (const geste of Object.keys(LIBELLES_GESTES) as GesteAFaire[]) {
      expect(cibleAccueil(geste, t({ idLettre: 1 }), 'cc', retour).type).toBe('route');
    }
  });

  it('GESTES_SUR_PAGE = exactement les gestes que la page exécute chez elle', () => {
    const chezElle = (Object.keys(LIBELLES_GESTES) as GesteAFaire[]).filter((g) => FAMILLES_GESTES[g] !== 'consultation' && famillePage(g) !== 'lien');
    expect([...GESTES_SUR_PAGE].sort()).toEqual(chezElle.sort());
  });

  it('cibleDossier : sans geste, seul le retour est porté', () => {
    expect(cibleDossier(42, 'membre', '/membre/a-faire')).toEqual({ type: 'route', commandes: ['/', 'membre', 'dossier', 42], queryParams: { returnUrl: '/membre/a-faire' }, ciblee: true });
  });
});
