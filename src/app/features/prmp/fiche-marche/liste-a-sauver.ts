import { Signal } from '@angular/core';

/**
 * ⚠️ 03/10 — ce que la page de la fiche attend d'un bloc à rendu propre (besoin, moyens, pièces) : ses listes ne sont
 * pas des champs, elles s'enregistrent par leur propre bouton. Avant de quitter le bloc, la page demande à la liste si
 * elle a des saisies non enregistrées (`modifie`), et peut lui faire tout enregistrer (`sauver`, vrai si tout est passé ;
 * faux sur un refus, dont les erreurs restent affichées sous les champs).
 */
export interface ListeASauver {
  readonly modifie: Signal<boolean>;
  sauver(): Promise<boolean>;
}

/** L'empreinte d'une charge : ce qui partirait au serveur, figé en texte pour comparer avant / après. */
export const empreinte = (charge: unknown): string => JSON.stringify(charge);
