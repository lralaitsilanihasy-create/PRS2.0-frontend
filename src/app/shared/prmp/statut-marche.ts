import { StatutMarche } from '../../models';

/**
 * ⚠️ Statut « Lancé » — ⚠️ règle du pilote du 30/09, qui remplace celle du 27/09 : « Le statut du marché ne doit être
 * changé en Lancé que lorsque l'avis spécifique est imprimé. » C'est le serveur qui pose `LANCE` à la PREMIÈRE
 * impression de l'avis (`MarcheDto.avisImprimeLe`, demande `demande-backend-2026-09-30-statut-lance-avis.md`) ; la
 * fiche DAO et son examen laissent la ligne « Prévu ». La liste suit la garde du serveur :
 * - sans avis imprimé, « Lancé » n'est pas proposé ;
 * - avec un avis imprimé, « Prévu » ne l'est plus.
 * Le code que la ligne porte déjà reste toujours proposé (on ne cache jamais la valeur affichée), et les statuts
 * manuels (« Changement de projet », « Déclaré sans suite ») le sont dans les deux cas.
 *
 * Fonction pure : les statuts du référentiel, le code courant de la ligne, le fait que son avis soit imprimé → la
 * liste déroulante. Les statuts ACTIFS triés par `ordre`, plus le code courant s'il n'y figure pas (désactivé ou
 * hérité), sinon la ligne ne pourrait ni l'afficher ni le ré-enregistrer.
 */
export function statutsAdmissibles(statuts: readonly StatutMarche[], courant: string | null | undefined, avisImprime: boolean): StatutMarche[] {
  const code = (courant ?? '').trim();
  const exclu = avisImprime ? 'PREVU' : 'LANCE';
  let liste = statuts.filter((s) => s.actif !== false).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  if (code !== exclu) liste = liste.filter((s) => s.code !== exclu);
  if (code && !liste.some((s) => s.code === code)) {
    const connu = statuts.find((s) => s.code === code);
    liste = [...liste, connu ?? { code, libelle: code, actif: false }];
  }
  return liste;
}

/** `AAAA-MM-JJ` → `JJ/MM/AAAA` (la date d'impression de l'avis, servie en ISO). */
export function dateAvis(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
