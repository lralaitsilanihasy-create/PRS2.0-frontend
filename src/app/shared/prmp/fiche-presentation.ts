import { Capm, Marche, MarchePrevision, ModePassation } from '../../models';

/**
 * ⚠️ Demande user (2026-09-01) — « Fiche de présentation » du dossier de planification : les trois
 * listes du formulaire officiel (pièce jointe obligatoire du dépôt), DÉRIVÉES des marchés saisis à
 * la création du dossier. Rien n'est persisté : la fiche se recalcule depuis le plan.
 *
 *  1. Marchés à passer par MODE DÉROGATOIRE — `tr_mode_passation.CATEGORIE = DEROGATOIRE` ;
 *  2. Marchés à DÉLAIS AMÉNAGÉS — délai de remise des offres (date prévisionnelle d'ouverture des
 *     plis − date prévisionnelle de lancement) STRICTEMENT INFÉRIEUR au « Délai min. (jours) » du
 *     mode (delaiMinJours du référentiel) ;
 *  3. CONTRATS-CADRES — forme de marché `CONTRAT_CADRE`.
 *
 * Les « justifications » du formulaire restent à compléter sur la fiche signée : l'écran affiche la
 * mention, il ne les saisit pas. Les dates viennent des prévisions CAPM, appariées par MOT-CLÉ du
 * libellé de processus (LANCEMENT / OUVERTURE) — même règle que la table partagée des marchés.
 */
export interface LigneFiche {
  idDetail: number;
  objet: string;
  /** Montant estimatif initial (`montEstim`). */
  montant?: number;
  modeLibelle: string;
  /** Délai de remise des offres en jours calendaires ; `null` si l'une des deux dates manque. */
  delaiJours: number | null;
  /** Plancher du mode (`delaiMinJours`) ; `null` si le référentiel n'en déclare pas. */
  delaiMinJours: number | null;
  /** ⚠️ 2026-09-01 — justification saisie à la création (liste 1) ; vide → « À compléter » à l'affichage. */
  justifModeDerogatoire?: string;
  /** Justification saisie à la création (liste 2). */
  justifDelaiAmenage?: string;
}

export interface FichePresentation {
  derogatoires: LigneFiche[];
  delaisAmenages: LigneFiche[];
  contratsCadres: LigneFiche[];
  /** Marchés DISTINCTS présents dans au moins une liste (badge de l'onglet). */
  nbMarchesConcernes: number;
}

/** Jours calendaires entre deux dates `yyyy-MM-dd` (ouverture − lancement) ; `null` si incomplet. */
function delaiCalendaire(lancement?: string, ouverture?: string): number | null {
  if (!lancement || !ouverture) return null;
  const l = Date.parse(lancement);
  const o = Date.parse(ouverture);
  if (Number.isNaN(l) || Number.isNaN(o)) return null;
  return Math.round((o - l) / 86_400_000);
}

export function calculerFichePresentation(
  marches: Marche[],
  previsions: MarchePrevision[],
  modes: ModePassation[],
  capms: Capm[],
): FichePresentation {
  const modeParId = new Map(modes.map((m) => [m.idMode, m]));
  const capmLibelle = new Map(capms.map((c) => [c.idCapm, (c.libelleProcessus ?? '').toUpperCase()]));
  const prevParDetail = new Map<number, MarchePrevision[]>();
  for (const p of previsions) {
    const l = prevParDetail.get(p.idDetail) ?? [];
    l.push(p);
    prevParDetail.set(p.idDetail, l);
  }
  const dateDe = (idDetail: number, motCle: string): string | undefined =>
    prevParDetail.get(idDetail)?.find((p) => (capmLibelle.get(p.idCapm) ?? '').includes(motCle))?.dateDebut;

  const derogatoires: LigneFiche[] = [];
  const delaisAmenages: LigneFiche[] = [];
  const contratsCadres: LigneFiche[] = [];
  const concernes = new Set<number>();

  // ⚠️ Versionnement — une ligne supprimée ne fait plus partie du plan : absente de toute vue officielle.
  for (const m of marches.filter((x) => !x.supprimee)) {
    const mode = m.idMode != null ? modeParId.get(m.idMode) : undefined;
    const delaiJours = delaiCalendaire(dateDe(m.idDetail, 'LANCEMENT'), dateDe(m.idDetail, 'OUVERTURE'));
    const ligne: LigneFiche = {
      idDetail: m.idDetail,
      objet: m.designationMarche ?? '',
      montant: m.montEstim,
      modeLibelle: mode?.libelle ?? '',
      delaiJours,
      delaiMinJours: mode?.delaiMinJours ?? null,
      justifModeDerogatoire: m.justifModeDerogatoire?.trim() || undefined,
      justifDelaiAmenage: m.justifDelaiAmenage?.trim() || undefined,
    };
    if (mode?.categorie === 'DEROGATOIRE') {
      derogatoires.push(ligne);
      concernes.add(m.idDetail);
    }
    if (delaiJours != null && mode?.delaiMinJours != null && delaiJours < mode.delaiMinJours) {
      delaisAmenages.push(ligne);
      concernes.add(m.idDetail);
    }
    if (m.formeMarche === 'CONTRAT_CADRE') {
      contratsCadres.push(ligne);
      concernes.add(m.idDetail);
    }
  }
  return { derogatoires, delaisAmenages, contratsCadres, nbMarchesConcernes: concernes.size };
}
