import { Injectable, signal } from '@angular/core';

/**
 * Mémoire (inter-navigation) des dossiers « à rectifier » dont la RECTIFICATION PAR IMPORT a été
 * réellement ENREGISTRÉE.
 *
 * ⚠️ Règle durcie (2026-09-06, demande pilote) : « Resoumettre le dossier » ne s'active qu'après
 * un import de PPM rectifié enregistré — un simple aller-retour sur l'écran de rectification ne
 * suffit plus (l'ancien magasin marquait « modifié » au retour de navigation, sans rien vérifier).
 * L'écran « Rectifier le dossier » pose le drapeau au succès du `PUT /api/saisies/ppm/{id}` ;
 * « Dossiers à rectifier » le lit ; la resoumission réussie le consomme. Le composant de route
 * étant détruit/recréé à chaque aller-retour, l'état est porté ici (`providedIn: 'root'`).
 *
 * NB : garde-fou purement UX — le contrat `POST /api/dossiers/{id}/resoumettre` n'expose aucun
 * champ « dossier rectifié » ; le serveur reste l'autorité.
 */
@Injectable({ providedIn: 'root' })
export class DossierModificationStore {
  /** Dossiers dont une rectification a été enregistrée depuis l'arrivée sur « à rectifier ». */
  private readonly _rectifies = signal<Set<number>>(new Set());

  /** Appelé par « Rectifier le dossier » au SUCCÈS de l'enregistrement de l'import. */
  marquerRectifie(idDossier: number): void {
    this._rectifies.update((s) => new Set(s).add(idDossier));
  }

  estRectifie(idDossier: number): boolean {
    return this._rectifies().has(idDossier);
  }

  /** Après resoumission réussie : le dossier repart au vérificateur, le drapeau est consommé. */
  reinitialiser(idDossier: number): void {
    if (!this._rectifies().has(idDossier)) {
      return;
    }
    this._rectifies.update((s) => {
      const n = new Set(s);
      n.delete(idDossier);
      return n;
    });
  }
}
