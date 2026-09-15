import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';

import { AFaireTache, Dispatch, Dossier } from '../../../models';
import { DispatchService, DossierService, ReceptionService } from '../../../services';
import type { ModaleAFaire } from '../../home/a-faire/a-faire-navigation';
import type { DispatchItem } from '../dispatch-form';

/**
 * Modale existante d'un geste, ses données chargées : réception et numérotation, dispatch (unitaire,
 * groupé ou réattribution), pièces du dépôt, consultation.
 */
export type ModaleGeste =
  | { type: 'reception'; dossier: Dossier }
  | { type: 'dispatch'; items: DispatchItem[]; reattribution: Dispatch | null }
  | { type: 'pieces-depot'; dossier: Dossier }
  | { type: 'consultation'; dossier: Dossier };

/**
 * Préparation des gestes qui s'exécutent dans une MODALE (refonte ergonomique, lot L4-F3) : lecture du
 * dossier, de sa réception et de son dispatch, puis choix de la modale. Extrait tel quel de l'accueil
 * « À faire » pour servir aussi la page dossier — une seule façon d'ouvrir un geste, deux écrans.
 *
 * Où mène un geste (URL ou modale) reste l'affaire de `cibleGeste` (`a-faire-navigation.ts`) ; ce service
 * ne fait que charger ce que la modale choisie attend. Les lectures gardent leur boîte d'erreur (un 403
 * ou un 409 à l'ouverture se lit dans un toast) ; l'appelant libère son état d'attente sur l'erreur.
 */
@Injectable({ providedIn: 'root' })
export class OuvrirGeste {
  private readonly dossiers = inject(DossierService);
  private readonly receptions = inject(ReceptionService);
  private readonly dispatchs = inject(DispatchService);

  /** Données de la modale `modale` pour la tâche `t`. */
  preparer(modale: ModaleAFaire, t: AFaireTache): Observable<ModaleGeste> {
    const dossier$ = this.dossiers.getById(t.dossier.idDossier);
    switch (modale) {
      case 'reception':
        return dossier$.pipe(map((dossier): ModaleGeste => ({ type: 'reception', dossier })));
      case 'pieces-depot':
        return dossier$.pipe(map((dossier): ModaleGeste => ({ type: 'pieces-depot', dossier })));
      case 'consultation':
        return dossier$.pipe(map((dossier): ModaleGeste => ({ type: 'consultation', dossier })));
      case 'dispatch':
      case 'reattribution':
        return forkJoin({
          dossier: dossier$,
          reception: this.receptions.getById(t.refs.idReception as number),
          dispatch: modale === 'reattribution' ? this.dispatchs.getById(t.refs.idDispatch as number) : of(null),
        }).pipe(map(({ dossier, reception, dispatch }): ModaleGeste => ({ type: 'dispatch', items: [{ dossier, reception }], reattribution: dispatch })));
    }
  }

  /** Dispatch groupé : dossier et réception de chaque tâche (toutes portent `refs.idReception`). */
  preparerLot(taches: readonly AFaireTache[]): Observable<ModaleGeste> {
    return forkJoin(taches.map((t) => forkJoin({ dossier: this.dossiers.getById(t.dossier.idDossier), reception: this.receptions.getById(t.refs.idReception as number) }))).pipe(
      map((items): ModaleGeste => ({ type: 'dispatch', items, reattribution: null })),
    );
  }
}
