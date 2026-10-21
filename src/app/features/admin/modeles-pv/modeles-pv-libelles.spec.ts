import { CouvertureSousType, ModelePvResume } from '../../../models';
import { ecrireExpression, etatModele, grilleFichiers, phrasesRegle, expressionEnClair, lireExpression, propositionPourFamille, reprisParModele, sansDocument, tailleLisible } from './modeles-pv-libelles';

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
