import { CouvertureSousType, ModeleIntegre, ModelePvResume } from '../../../../models';
import { construireLignes, couvertureSousTypes, filtrer, grouper, recommandation } from './modeles-pv-vue';

const cv = (sousType: string, famille: string, o: Partial<CouvertureSousType> = {}): CouvertureSousType => ({
  sousType, libelle: null, famille, nature: 'PV', produitPar: 'AUCUN', integre: null, modeleRattache: null, ...o,
});
const rattache = (id: number, numeroEnVigueur: number | null = null) => ({ id, code: `M${id}`, numeroEnVigueur });

/** Le jeu de recette du 21/10 : plan servi par l'intégré et repris par PV-PLAN, DAO rattaché à un modèle sans version, le reste sans rien. */
const COUVERTURE: CouvertureSousType[] = [
  ...['MAOO', 'MAOO-CC', 'MAOOI', 'MAOOPREQUAL', 'MAOR', 'MAORI', 'MGG', 'MPI'].map((s) => cv(s, 'DDM')),
  ...['AVN', 'DR', 'INDEMN', 'PENAL', 'SURSIS'].map((s) => cv(s, 'DGC')),
  cv('DSS', 'DSS'),
  ...['DAOO', 'DAOR'].map((s) => cv(s, 'DMC', { modeleRattache: rattache(3) })),
  ...['PPM', 'PPM-AGPM'].map((s) => cv(s, 'DDP', { produitPar: 'INTEGRE', integre: 'PV-PLAN-INTEGRE', modeleRattache: rattache(2) })),
  cv('MAOO', 'DDM', { nature: 'LETTRE_RENVOI', produitPar: 'INTEGRE', integre: 'LETTRE-RENVOI-INTEGREE' }),
];
const MODELES: ModelePvResume[] = [
  { id: 2, code: 'PV-PLAN', libelle: 'PV d’examen du plan de passation', nature: 'PV', etat: 'ACTIF', sousTypes: ['PPM', 'PPM-AGPM'], enVigueur: null, derniere: null },
  { id: 3, code: 'PV-MISE-EN-CONCURRENCE', libelle: 'PV d’examen du DAO', nature: 'PV', etat: 'ACTIF', sousTypes: ['DAOO', 'DAOR'], enVigueur: null,
    derniere: { numero: 1, etat: 'BROUILLON', bloquant: false, deposeeLe: null, enVigueurLe: null } },
  { id: 1, code: 'ESSAI', libelle: 'Essai', nature: 'PV', etat: 'ARCHIVE', sousTypes: [], enVigueur: null, derniere: null },
];
const INTEGRES: ModeleIntegre[] = [
  { code: 'PV-PLAN-INTEGRE', libelle: 'PV d’examen du plan de passation', nature: 'PV', sousTypes: ['PPM', 'PPM-AGPM'], fichiers: Array(12).fill('f.docx'), regle: '', enService: true },
  { code: 'LETTRE-RENVOI-INTEGREE', libelle: 'Lettre de renvoi', nature: 'LETTRE_RENVOI', sousTypes: null, fichiers: ['a', 'b'], regle: '', enService: true },
];
const FAMILLES = { DDM: 'Dossier de marché', DGC: 'Acte de gestion contractuelle', DSS: 'Déclaration sans suite' };

describe('Modèles de procès-verbaux — modèle de vue (21/10)', () => {
  const lignes = construireLignes(MODELES, INTEGRES, COUVERTURE, FAMILLES);

  it('trois états calculés des données : familles à créer, modèles à déposer, intégrés en service ; archivé écarté', () => {
    expect(lignes.filter((l) => l.etat === 'miss').map((l) => [l.nom, l.sousTypes.length, l.badge])).toEqual([
      ['Dossier de marché', 8, '8 manquants'], ['Acte de gestion contractuelle', 5, '5 manquants'], ['Déclaration sans suite', 1, '1 manquant'],
    ]);
    expect(lignes.filter((l) => l.etat === 'prep').map((l) => [l.id, l.badge, l.etape])).toEqual([['gere-2', 'À rédiger', 1], ['gere-3', 'À valider', 2]]);
    expect(lignes.filter((l) => l.etat === 'ok').map((l) => l.id)).toEqual(['integre-PV-PLAN-INTEGRE', 'integre-LETTRE-RENVOI-INTEGREE']);
    expect(lignes.some((l) => l.id === 'gere-1')).toBe(false);
    expect(lignes.find((l) => l.id === 'gere-2')!.remplace).toEqual(['PPM', 'PPM-AGPM']);
  });

  it('couverture : chaque sous-type de PV une fois (la lettre de renvoi ne compte pas)', () => {
    expect(couvertureSousTypes(COUVERTURE)).toEqual({ total: 18, parEtat: { miss: 14, prep: 2, ok: 2 } });
    const enVigueur = COUVERTURE.map((c) => (c.sousType === 'DAOO' ? { ...c, modeleRattache: rattache(3, 1) } : c));
    expect(couvertureSousTypes(enVigueur).parEtat).toEqual({ miss: 14, prep: 1, ok: 3 });
  });

  it('recommandation : le modèle à créer qui couvre le plus de sous-types', () => {
    const r = recommandation(lignes)!;
    expect(r.ligne.nom).toBe('Dossier de marché');
    expect(r.texte).toBe('Créer le modèle « Dossier de marché » couvrirait 8 sous-types d’un coup, soit plus de la moitié des manques.');
    expect(recommandation(lignes.filter((l) => l.etat !== 'miss'))).toBeNull();
  });

  it('recherche sur tous les codes, filtre d’état, groupes dans l’ordre d’urgence et tri', () => {
    expect(filtrer(lignes, 'mgg', 'tous').map((l) => l.nom)).toEqual(['Dossier de marché']);
    expect(filtrer(lignes, 'daor', 'tous').map((l) => l.id)).toEqual(['gere-3']);
    expect(filtrer(lignes, '', 'prep').length).toBe(2);
    expect(grouper(lignes, 'priorite').map((g) => g.etat)).toEqual(['miss', 'prep', 'ok']);
    expect(grouper(lignes, 'priorite')[2].lignes[0].nom).toBe('Lettre de renvoi');
    expect(grouper(lignes, 'nom')[0].lignes.map((l) => l.nom)).toEqual(['Acte de gestion contractuelle', 'Déclaration sans suite', 'Dossier de marché']);
    expect(grouper(filtrer(lignes, 'zzz', 'tous'), 'nom')).toEqual([]);
  });
});
