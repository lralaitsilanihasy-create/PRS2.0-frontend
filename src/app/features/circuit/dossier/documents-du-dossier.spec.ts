import { signal } from '@angular/core';

import { Dossier, PieceJointeDossier } from '../../../models';
import { DossierContenuStore } from './dossier-contenu.store';
import { documentsDuDossier } from './documents-du-dossier';

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
