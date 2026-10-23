import { CouvertureSousType, ModelePvResume } from '../../../models';
import { ecrireExpression, etatModele, evaluerCondition, expressionProposee, grilleFichiers, champsLusPar, dossiersExemples, nommerRubriques, libelleDeCode, modeleSupprimable, nonDeclares, phrasesRegle, expressionEnClair, lireExpression, propositionPourFamille, reprisParModele, sansDocument, tailleLisible } from './modeles-pv-libelles';

const v = (numero: number, etat: 'BROUILLON' | 'EN_VIGUEUR' | 'REMPLACEE', bloquant = false) => ({ numero, etat, bloquant, deposeeLe: null, enVigueurLe: null });
const modele = (o: Partial<ModelePvResume>): ModelePvResume => ({
  id: 1, code: 'PV-MARCHE', libelle: 'PV', nature: 'PV', etat: 'ACTIF', sousTypes: [], enVigueur: null, derniere: null, ...o,
});

describe('Modèles de PV — état d’un modèle (G1, 20/10)', () => {
  it('dit ce qu’il reste à faire', () => {
    expect(etatModele(modele({})).libelle).toBe('Aucune version déposée');
    expect(etatModele(modele({ derniere: v(1, 'BROUILLON', true) })).ton).toBe('ko');
    expect(etatModele(modele({ derniere: v(1, 'BROUILLON') })).libelle).toBe('À mettre en vigueur');
    expect(etatModele(modele({ enVigueur: v(1, 'EN_VIGUEUR'), derniere: v(1, 'EN_VIGUEUR') })).ton).toBe('at');
    expect(etatModele(modele({ sousTypes: ['MAOO'], enVigueur: v(1, 'EN_VIGUEUR'), derniere: v(2, 'BROUILLON') })).libelle).toBe('En vigueur — v2 en préparation');
    expect(etatModele(modele({ etat: 'ARCHIVE', enVigueur: v(1, 'EN_VIGUEUR') })).libelle).toBe('Archivé');
  });

});

const cv = (sousType: string, o: Partial<CouvertureSousType> = {}): CouvertureSousType => ({
  sousType, libelle: null, famille: 'DDM', nature: 'PV', produitPar: 'AUCUN', integre: null, modeleRattache: null, ...o,
});

describe('Modèles de PV — couverture servie (B2, 20/10)', () => {
  it('« Sans document » : rien ne produit et aucun modèle ne sert ; la lettre ne compte pas pour le PV', () => {
    const c = [
      cv('MAOO'),
      cv('MAOO-CC', { modeleRattache: { id: 3, code: 'PV-MARCHE', numeroEnVigueur: null } }),
      cv('PPM', { famille: 'DDP', produitPar: 'INTEGRE', integre: 'PV-PLAN-INTEGRE' }),
      cv('MAOO', { nature: 'LETTRE_RENVOI', produitPar: 'INTEGRE', integre: 'LETTRE-RENVOI-INTEGREE' }),
    ];
    expect(sansDocument(c).map((x) => x.sousType)).toEqual(['MAOO']);
    expect(sansDocument(c, 'LETTRE_RENVOI')).toEqual([]);
  });

  it('un modèle reprend les sous-types encore produits par des fichiers intégrés', () => {
    const r = { id: 2, code: 'PV-PLAN', numeroEnVigueur: null };
    const c = [
      cv('PPM', { famille: 'DDP', produitPar: 'INTEGRE', integre: 'PV-PLAN-INTEGRE', modeleRattache: r }),
      cv('PPM-AGPM', { famille: 'DDP', produitPar: 'INTEGRE', integre: 'PV-PLAN-INTEGRE', modeleRattache: r }),
      cv('MAOO', { modeleRattache: { ...r, id: 3 } }),
    ];
    expect(reprisParModele(c, 2)).toEqual(['PPM', 'PPM-AGPM']);
    expect(reprisParModele(c, 3)).toEqual([]);
  });
});

describe('Modèles de PV — proposition à la création depuis une famille sans modèle', () => {
  it('les trois familles du contrôle ont leur libellé ; les autres, un libellé dérivé', () => {
    expect(propositionPourFamille('DDM', 'Dossier de Marché')).toEqual({ libelle: 'PV d’examen du dossier de marché', code: 'PV-MARCHE' });
    expect(propositionPourFamille('DGC', 'Acte de gestion contractuelle')).toEqual({ libelle: 'PV d’examen — Acte de gestion contractuelle', code: 'PV-DGC' });
  });
});

describe('Modèles de PV — compositeur de conditions', () => {
  it('écrit et relit la grammaire de ConditionsModele', () => {
    const e = ecrireExpression([
      { lien: 'et', cle: 'forme', op: '=', valeur: 'Contrat-cadre' },
      { lien: 'et', cle: 'titulaires', op: '!=', valeur: '1' },
      { lien: 'ou', cle: 'saisi.motif', op: 'renseigne', valeur: '' },
    ]);
    expect(e).toBe('forme = Contrat-cadre et titulaires != 1 ou saisi.motif renseigne');
    expect(lireExpression(e)).toEqual([
      { lien: 'et', cle: 'forme', op: '=', valeur: 'Contrat-cadre' },
      { lien: 'et', cle: 'titulaires', op: '!=', valeur: '1' },
      { lien: 'ou', cle: 'saisi.motif', op: 'renseigne', valeur: '' },
    ]);
  });

  it('une valeur peut contenir « et » ; un terme illisible rend null', () => {
    expect(lireExpression('forme = Au fur et à mesure des besoins')).toEqual([{ lien: 'et', cle: 'forme', op: '=', valeur: 'Au fur et à mesure des besoins' }]);
    expect(lireExpression('avis')).toBeNull();
    expect(lireExpression('')).toEqual([]);
  });

  it('omet les termes incomplets et dit l’expression en clair', () => {
    expect(ecrireExpression([{ lien: 'et', cle: 'avis', op: '=', valeur: '' }, { lien: 'et', cle: 'avis', op: '=', valeur: 'FAVR' }])).toBe('avis = FAVR');
    expect(expressionEnClair('avis = FAVR et agpm = oui', { avis: 'L’avis', agpm: 'AGPM' })).toBe('L’avis vaut « FAVR » et AGPM vaut « oui »');
  });

  it('taille lisible', () => {
    expect(tailleLisible(188_416)).toBe('184 Ko');
    expect(tailleLisible(null)).toBe('—');
  });
});

describe('Modèles de PV — fichiers intégrés en grille (21/10)', () => {
  const pv = ['AF', 'AFSR', 'ANF'].flatMap((a) => ['PPM', 'PPMAGPM'].flatMap((t) => ['CENTRALE', 'REGIONALE'].map((c) => `PV_${a}_${t}_${c}.docx`)));

  it('PV du plan : l’avis en ligne, AGPM × commission en colonne', () => {
    const g = grilleFichiers(pv)!;
    expect(g.colonnes).toEqual(['PPM · centrale', 'PPM · régionale', 'PPM-AGPM · centrale', 'PPM-AGPM · régionale']);
    expect(g.lignes.map((l) => l.libelle)).toEqual(['Favorable', 'Favorable avec réserves', 'Non favorable']);
    expect(g.lignes[1].cellules[2]).toBe('PV_AFSR_PPMAGPM_CENTRALE.docx');
  });

  it('un fichier absent du JAR laisse sa case vide ; la lettre a une ligne ; un nom inconnu rend null', () => {
    expect(grilleFichiers(pv.filter((f) => f !== 'PV_ANF_PPM_REGIONALE.docx'))!.lignes[2].cellules[1]).toBeNull();
    expect(grilleFichiers(['LR_CENTRALE.docx', 'LR_REGIONALE.docx'])).toEqual({
      colonnes: ['Commission centrale', 'Commission régionale'],
      lignes: [{ libelle: 'Lettre', cellules: ['LR_CENTRALE.docx', 'LR_REGIONALE.docx'] }],
    });
    expect(grilleFichiers(['AUTRE.docx'])).toBeNull();
  });

  it('la règle servie se lit en phrases', () => {
    expect(phrasesRegle('Un fichier par avis (FAV ; FAVR). Seul un dossier dont le PPM garde une ligne reçoit un document ; l’avis NSP n’en a pas.')).toEqual([
      'Un fichier par avis (FAV ; FAVR)',
      'Seul un dossier dont le PPM garde une ligne reçoit un document',
      'L’avis NSP n’en a pas',
    ]);
  });
});

describe('Modèles de PV — ce que le Word utilise sans déclaration, et l’aperçu du formulaire (21/10)', () => {
  it('relève les blocs et champs du Word non encore déclarés', () => {
    const r = { conditionsUtilisees: ['FAVORABLE', 'OBS_GENERALE'], champsUtilises: ['motif_defavorable', 'observation_generale'] };
    expect(nonDeclares(r, [{ nom: 'FAVORABLE' }], [{ code: 'observation_generale' }])).toEqual({ conditions: ['OBS_GENERALE'], champs: ['motif_defavorable'] });
    expect(nonDeclares(null, [], [])).toEqual({ conditions: [], champs: [] });
  });

  it('propose l’expression des noms usuels, et un libellé tiré du code', () => {
    expect(expressionProposee('AVEC_RESERVES')).toBe('avis = FAVR');
    expect(expressionProposee('regionale')).toBe('portee = regionale');
    expect(expressionProposee('OBS_INCONNUE')).toBe('');
    expect(libelleDeCode('motif_defavorable')).toBe('Motif defavorable');
  });

  it('évalue une condition comme le serveur : « et » avant « ou », valeur absente', () => {
    expect(evaluerCondition('avis = FAVR', { avis: 'favr' })).toBe(true);
    expect(evaluerCondition('avis = DEF', {})).toBe(false);
    expect(evaluerCondition('avis != DEF', {})).toBe(true);
    expect(evaluerCondition('saisi.obs renseigne', { 'saisi.obs': ' ' })).toBe(false);
    expect(evaluerCondition('avis = FAV et saisi.obs renseigne ou avis = DEF', { avis: 'DEF' })).toBe(true);
    expect(evaluerCondition('avis = FAV et saisi.obs renseigne ou avis = DEF', { avis: 'FAV' })).toBe(false);
    expect(evaluerCondition('illisible', {})).toBeNull();
  });
});

describe('modeleSupprimable (21/10) — la règle de DELETE /api/modeles-pv/{id}', () => {
  const ev = (action: string) => ({ le: '2026-10-21', action, numeroVersion: 1, detail: null, par: 'ADMIN01' });
  const ver = (etat: 'BROUILLON' | 'EN_VIGUEUR' | 'REMPLACEE') => ({ etat }) as never;
  it('jamais en vigueur et sans sous-type : oui ; sinon non', () => {
    expect(modeleSupprimable({ versions: [ver('BROUILLON')], historique: [ev('CREE')], sousTypes: [] })).toBe(true);
    expect(modeleSupprimable({ versions: [ver('REMPLACEE')], historique: [], sousTypes: [] })).toBe(false);
    expect(modeleSupprimable({ versions: [], historique: [ev('MISE_EN_VIGUEUR')], sousTypes: [] })).toBe(false);
    expect(modeleSupprimable({ versions: [], historique: [], sousTypes: [{ id: 'DAOO' } as never] })).toBe(false);
  });
});

describe('OBS_GENERALE (21/10) — règle du départ du serveur, et le champ qu’elle lit', () => {
  it('proposée, et son champ relevé pour être déclaré avant elle', () => {
    expect(expressionProposee('OBS_GENERALE')).toBe('saisi.observation_generale renseigne');
    expect(champsLusPar('saisi.observation_generale renseigne ou avis = DEF')).toEqual(['observation_generale']);
    expect(champsLusPar('avis = FAV')).toEqual([]);
  });
});

describe('dossiersExemples (22/10) — les dossiers proposés pour l’aperçu', () => {
  const d = (idDossier: number, idSousType: string, statut: string) => ({ idDossier, idSousType, statut });
  it('sous-types servis, examinés, les plus avancés puis les plus récents', () => {
    const l = [d(1, 'PPM', 'EN_EXAMEN'), d(2, 'PPM', 'CLOTURE'), d(3, 'DAOO', 'CLOTURE'), d(4, 'PPM-AGPM', 'BROUILLON'), d(5, 'PPM-AGPM', 'CLOTURE')];
    expect(dossiersExemples(l, ['PPM', 'PPM-AGPM']).map((x) => x.idDossier)).toEqual([5, 2, 1]);
    expect(dossiersExemples(l, ['PPM', 'PPM-AGPM'], 1).map((x) => x.idDossier)).toEqual([5]);
    expect(dossiersExemples(l, [])).toEqual([]);
  });
});

describe('nommerRubriques (23/10) — les groupes du catalogue du DAO par leur nom', () => {
  it('« Fiche — rubrique B01-AC » devient « Acheteur » ; un doublon prend son bloc ; le reste ne bouge pas', () => {
    const blocs = [
      { code: 'B01', libelle: 'Identification', rubriques: [{ code: 'B01-AC', libelle: 'Acheteur' }, { code: 'B01-GE', libelle: 'Généralités' }] },
      { code: 'B09', libelle: 'Exécution', rubriques: [{ code: 'B09-GE', libelle: 'Généralités' }] },
    ];
    const c = { groupes: [{ nom: 'Fiche — rubrique B01-AC', variables: [] }, { nom: 'Fiche — rubrique B01-GE', variables: [] }, { nom: 'Fiche — rubrique B09-GE', variables: [] }, { nom: 'Jetons du moteur du DAO', variables: [] }] };
    expect(nommerRubriques(c, blocs).groupes.map((g) => g.nom)).toEqual(['Acheteur', 'Généralités — Identification', 'Généralités — Exécution', 'Jetons du moteur du DAO']);
  });
});
