import { signal } from '@angular/core';

import { Dossier, Instantane, PieceJointeDossier } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { documentsDuDossier, repartirEcransFiges } from './documents-du-dossier';

describe('Documents d’un dossier né d’une fiche DAO', () => {
  const contenu = (pieces: Partial<PieceJointeDossier>[] = [], enDonnees: number[] = []): DossierContenuStore =>
    ({
      dossier: signal({ idDossier: 7, idDmc: 1, idDossierPlan: 3, idPvPlan: 68, ficheMarche: { statut: 'VALIDEE', version: 1, typeMarche: 'CONTRAT_CADRE' } } as unknown as Dossier),
      pieces: signal(pieces as PieceJointeDossier[]),
      typesEnDonnees: signal(new Set(enDonnees)),
      controles: signal([]), controlesVisible: signal(false), instantanes: signal([]), instantanesVisible: signal(false),
    }) as unknown as DossierContenuStore;

  it('⚠️ 28/10 (pilote) — le plan de passation vient avant la fiche DAO', () => {
    const cles = documentsDuDossier(contenu([{ nomFichier: 'AVIS_PROJET_7.pdf' }])).map((d) => d.cle);
    expect(cles.slice(0, 3)).toEqual(['presentation', 'plan', 'fiche-dao']);
  });

  it('30/10 (pilote) — « Pièces jointes » ne compte pas un fichier joint sur une pièce que l’application fournit en données', () => {
    const pieces = documentsDuDossier(contenu([{ idTypePiece: 3, nomFichier: 'fiche.pdf' }, { idTypePiece: 9, nomFichier: 'journal.pdf' }], [3]))
      .find((d) => d.cle === 'pieces');
    expect(pieces?.n).toBe(1);
  });
});

describe('⚠️ 01/11 (pilote) — les écrans figés fusionnés dans les éléments du dossier', () => {
  const fige = (ecran: string, n = 1): Instantane => ({ idInstantane: n * 10 + ecran.length, numeroSoumission: n, ecran, figeLe: '2026-08-21T14:05', figePar: 'PRMP001', empreinte: 'x', taille: 1 } as Instantane);
  const marche = ['presentation', 'pv-cnm', 'fiche-dao', 'seance', 'evaluation', 'attribution', 'bordereau', 'pieces'] as const;

  it('un dossier de marché : chaque écran rejoint sa carte, la commission va au rapport, rien ne reste orphelin', () => {
    const { parCarte, orphelins } = repartirEcransFiges([...marche], ['SEANCE', 'EVALUATION', 'ATTRIBUTION', 'CAO', 'AVIS', 'PLAN'].map((e) => fige(e)));
    expect(Object.fromEntries(parCarte)).toEqual({ presentation: ['PLAN', 'AVIS'], seance: ['SEANCE'], evaluation: ['EVALUATION', 'CAO'], attribution: ['ATTRIBUTION'] });
    expect(orphelins).toEqual([]);
  });

  it('un dossier DAO : l’avis va à sa carte quand elle existe, la commission à la fiche de présentation', () => {
    const { parCarte } = repartirEcransFiges(['presentation', 'plan', 'fiche-dao', 'avis', 'pieces'], ['PLAN', 'AVIS', 'CAO'].map((e) => fige(e)));
    expect(Object.fromEntries(parCarte)).toEqual({ presentation: ['PLAN', 'CAO'], avis: ['AVIS'] });
  });

  it('un écran sans carte hôte (acte de gestion) garde la carte « Écrans figés »', () => {
    const { orphelins } = repartirEcransFiges(['pieces'], [fige('ACTE'), fige('ACTE', 2), fige('ATTRIBUTION')]);
    expect(orphelins.map((i) => i.ecran)).toEqual(['ATTRIBUTION', 'ACTE', 'ACTE']);
  });
});
