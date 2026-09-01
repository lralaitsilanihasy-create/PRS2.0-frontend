import { Capm, Marche, MarchePrevision, ModePassation } from '../../models';

/**
 * ⚠️ Demande user (2026-09-01) — « Projet d'AGPM » (Avis Général de Passation des Marchés) du
 * dossier de planification : DÉRIVÉ du plan, comme la fiche de présentation. Rien n'est persisté.
 *
 * Lignes retenues : les marchés dont le mode porte le drapeau **`declencheAgpm`** du référentiel
 * (administrable — c'est déjà lui qui rend la pièce AGPM obligatoire à la soumission) : appel
 * d'offres ouvert, restreint, international, avec préqualification… selon la configuration.
 *
 * Colonnes du modèle officiel : COMPTE, NATURE, OBJET, MONTANT ESTIMATIF, FINANCEMENT, MODE DE
 * PASSATION, DATE du DAO — la date du DAO est la date prévisionnelle de LANCEMENT (processus CAPM
 * apparié par mot-clé, même règle que la table partagée et la fiche).
 */
export interface LigneAgpm {
  idDetail: number;
  compte: string;
  nature: string;
  objet: string;
  montant?: number;
  financement: string;
  modeLibelle: string;
  /** Date du DAO (`yyyy-MM-dd`) — date prévisionnelle de lancement ; `null` si non datée. */
  dateDao: string | null;
}

export function calculerAgpm(
  marches: (Marche & { natureLibelle?: string })[],
  previsions: MarchePrevision[],
  modes: ModePassation[],
  capms: Capm[],
  natureLibelles = new Map<number, string>(),
): LigneAgpm[] {
  const modeParId = new Map(modes.map((m) => [m.idMode, m]));
  const capmLibelle = new Map(capms.map((c) => [c.idCapm, (c.libelleProcessus ?? '').toUpperCase()]));
  const prevParDetail = new Map<number, MarchePrevision[]>();
  for (const p of previsions) {
    const l = prevParDetail.get(p.idDetail) ?? [];
    l.push(p);
    prevParDetail.set(p.idDetail, l);
  }
  const dateLancement = (idDetail: number): string | null =>
    prevParDetail.get(idDetail)?.find((p) => (capmLibelle.get(p.idCapm) ?? '').includes('LANCEMENT'))?.dateDebut ?? null;

  // ⚠️ Versionnement — une ligne supprimée ne fait plus partie du plan : absente de toute vue officielle.
  return marches
    .filter((m) => !m.supprimee)
    .filter((m) => (m.idMode != null ? modeParId.get(m.idMode)?.declencheAgpm === true : false))
    .map((m) => ({
      idDetail: m.idDetail,
      compte: m.numCompte ?? '',
      nature: m.natureLibelle ?? (m.idNature != null ? natureLibelles.get(m.idNature) ?? '' : ''),
      objet: m.designationMarche ?? '',
      montant: m.montEstim,
      financement: m.financement ?? '',
      modeLibelle: modeParId.get(m.idMode!)?.libelle ?? '',
      dateDao: dateLancement(m.idDetail),
    }));
}
