/**
 * ⚠️ 04/11 (pilote, option A) — « Proposer les dates manquantes » du calendrier d'une ligne du plan. Un PDF de plan ne porte que trois
 * dates (lancement, ouverture des plis, attribution) quand la grille CAPM du mode en compte une trentaine, et la soumission exige
 * chaque processus daté ou sans objet (409 CAPM_INCOMPLET). La proposition répartit les processus manquants ENTRE les dates connues,
 * dans l'ordre de la grille ; avant la première date connue et après la dernière, au même pas que les intervalles connus. Elle ne
 * touche ni une date posée, ni un processus sans objet. Ce n'est qu'une proposition : la PRMP la revoit avant de soumettre.
 */

/** Pas par défaut (jours) quand la ligne n'a qu'une date connue. */
const PAS_PAR_DEFAUT = 7;

const jour = (iso: string): number => {
  const [a, m, j] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, j) / 86_400_000;
};
const iso = (n: number): string => {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** Un processus de la grille, dans l'ordre : sa date de début connue (`''` : à proposer) et s'il est sans objet. */
export interface ProcessusAProposer {
  idCapm: number;
  dateDebut: string;
  sansObjet: boolean;
}

/**
 * Les dates de début proposées (idCapm → `yyyy-mm-dd`) pour les processus ni datés ni sans objet. Vide si la ligne n'a aucune
 * date connue : rien ne permet alors de situer son calendrier.
 */
export function proposerDatesManquantes(grille: readonly ProcessusAProposer[]): Map<number, string> {
  const actifs = grille.filter((p) => !p.sansObjet);
  const ancres = actifs.map((p, i) => ({ i, j: p.dateDebut ? jour(p.dateDebut) : null })).filter((a): a is { i: number; j: number } => a.j != null);
  const r = new Map<number, string>();
  if (!ancres.length) return r;

  // Le pas des bords : la moyenne des intervalles connus, en jours par processus (au moins un jour).
  const pas = ancres.length > 1
    ? Math.max(1, Math.round((ancres[ancres.length - 1].j - ancres[0].j) / (ancres[ancres.length - 1].i - ancres[0].i)))
    : PAS_PAR_DEFAUT;

  actifs.forEach((p, i) => {
    if (p.dateDebut) return;
    const avant = [...ancres].reverse().find((a) => a.i < i);
    const apres = ancres.find((a) => a.i > i);
    let j: number;
    if (avant && apres) {
      // Entre deux dates connues : réparti à part égale (deux processus peuvent tomber le même jour si l'intervalle est court).
      j = avant.j + Math.floor(((apres.j - avant.j) * (i - avant.i)) / (apres.i - avant.i));
    } else if (apres) {
      j = apres.j - pas * (apres.i - i);
    } else {
      j = (avant as { i: number; j: number }).j + pas * (i - (avant as { i: number; j: number }).i);
    }
    r.set(p.idCapm, iso(j));
  });
  return r;
}
