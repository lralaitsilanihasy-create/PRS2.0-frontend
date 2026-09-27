import { StatutMarche } from '../../models';

/**
 * ⚠️ Statut « Lancé » (27/09, règle du pilote) — « lorsque la ligne de la PPM est en phase de création de dossier de
 * mise en concurrence, son statut doit être en lancé ». C'est le serveur qui pose `LANCE` à la création du DMC et
 * rend `PREVU` à sa suppression (demande du 27/09) ; la grille, elle, ne propose plus « Prévu » à une ligne qui porte
 * un DMC vivant — sauf si elle le porte encore (données d'avant la règle : on ne cache jamais la valeur affichée).
 * Les statuts manuels (« Changement de projet », « Déclaré sans suite ») restent proposés dans les deux cas.
 *
 * Fonction pure : les statuts du référentiel, le code courant de la ligne, le fait qu'elle soit en mise en
 * concurrence → la liste déroulante. Les statuts ACTIFS triés par `ordre`, plus le code courant s'il n'y figure
 * pas (désactivé ou hérité), sinon la ligne ne pourrait ni l'afficher ni le ré-enregistrer.
 */
export function statutsAdmissibles(statuts: readonly StatutMarche[], courant: string | null | undefined, enMiseEnConcurrence: boolean): StatutMarche[] {
  const code = (courant ?? '').trim();
  let liste = statuts.filter((s) => s.actif !== false).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  if (enMiseEnConcurrence && code !== 'PREVU') liste = liste.filter((s) => s.code !== 'PREVU');
  if (code && !liste.some((s) => s.code === code)) {
    const connu = statuts.find((s) => s.code === code);
    liste = [...liste, connu ?? { code, libelle: code, actif: false }];
  }
  return liste;
}
