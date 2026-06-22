import { Injectable, signal } from '@angular/core';

/**
 * Mémoire (inter-navigation) des dossiers « à rectifier » que la PRMP a ouverts en édition.
 *
 * Sur l'écran « Dossiers à rectifier », le bouton « Resoumettre » d'une carte n'est actif que si
 * son dossier a été modifié, c.-à-d. la PRMP a navigué vers l'édition du PPM (`/prmp/ppm-marches`)
 * puis est revenue sur cet écran. Le composant de route étant détruit/recréé à chaque aller-retour,
 * l'état est porté ici (`providedIn: 'root'`, survit à la navigation), isolé par `idDossier`.
 *
 * NB : garde-fou purement UX — le contrat `POST /api/dossiers/{id}/resoumettre` n'expose aucun
 * champ « dossier modifié ».
 */
@Injectable({ providedIn: 'root' })
export class DossierModificationStore {
  /** Dossiers partis en édition (clic « Modifier ») et pas encore confirmés au retour. */
  private readonly enEdition = new Set<number>();
  /** Dossiers considérés « modifiés » (retour d'édition effectué). */
  private readonly _modifies = signal<Set<number>>(new Set());

  /** Clic « Modifier le dossier » : mémorise l'intention avant de quitter l'écran. */
  partirEnEdition(idDossier: number): void {
    this.enEdition.add(idDossier);
  }

  /**
   * À l'ouverture de « Dossiers à rectifier » : tout dossier parti en édition devient « modifié »
   * (la PRMP est revenue). À appeler une fois à la construction du composant.
   */
  consommerRetours(): void {
    if (!this.enEdition.size) {
      return;
    }
    this._modifies.update((s) => {
      const n = new Set(s);
      for (const id of this.enEdition) {
        n.add(id);
      }
      return n;
    });
    this.enEdition.clear();
  }

  estModifie(idDossier: number): boolean {
    return this._modifies().has(idDossier);
  }

  /** Après resoumission réussie : le dossier quitte l'état « modifié ». */
  reinitialiser(idDossier: number): void {
    if (!this._modifies().has(idDossier)) {
      return;
    }
    this._modifies.update((s) => {
      const n = new Set(s);
      n.delete(idDossier);
      return n;
    });
  }
}
