import { FormeMarche, Marche, MarchePrevision, ServiceBeneficiaire, VersionArchiveeDetail } from '../../models';

/**
 * ⚠️ 2026-09-06 (demande pilote) — une version archivée **prête pour le tableau partagé**
 * (`<app-ppm-marches-table>`), qui attend des `Marche[]`, `ServiceBeneficiaire[]` et
 * `MarchePrevision[]` déjà chargés.
 */
export interface VueVersionArchivee {
  detail: VersionArchiveeDetail;
  marches: Marche[];
  beneficiaires: ServiceBeneficiaire[];
  previsions: MarchePrevision[];
}

/**
 * Projette le contenu d'une version archivée (`GET /api/dossiers/{id}/versions-archivees/{numero}`)
 * dans les formes attendues par le tableau partagé — le **même** tableau que le plan courant, sans
 * rendu spécifique : la version se lit exactement comme le PPM en vigueur, colonnes comprises.
 *
 * Les lignes d'une version portent les mêmes champs qu'un `Marche` ; leurs collections n'ont pas
 * d'identifiant (elles sont figées, sans PK exposée) : les `idBenef` / `idPrevision` sont donc
 * **synthétiques**, négatifs pour ne jamais croiser un identifiant réel — le tableau ne s'en sert
 * que comme clé de regroupement par `idDetail`. Les lots ne sont pas repris : le tableau partagé ne
 * les affiche pas (ils restent disponibles dans `detail` pour un usage ultérieur).
 *
 * Fonction pure, sans Angular : testable à froid.
 */
export function vueVersionArchivee(detail: VersionArchiveeDetail, idDossier: number, idPpm: number): VueVersionArchivee {
  const marches: Marche[] = [];
  const beneficiaires: ServiceBeneficiaire[] = [];
  const previsions: MarchePrevision[] = [];
  let cle = 0;
  for (const l of detail.lignes) {
    marches.push({
      idDetail: l.idDetail,
      idDossier,
      idPpm,
      idLigneOrigine: l.idLigneOrigine,
      designationMarche: l.designationMarche,
      numCompte: l.numCompte,
      montEstim: l.montEstim,
      ancienMontEstim: l.ancienMontEstim,
      nouvMontEstim: l.nouvMontEstim,
      financement: l.financement,
      statut: l.statut,
      idNature: l.idNature,
      idMode: l.idMode,
      formeMarche: l.formeMarche as FormeMarche | undefined,
      justifModeDerogatoire: l.justifModeDerogatoire,
      justifDelaiAmenage: l.justifDelaiAmenage,
      supprimee: l.supprimee ?? false,
    });
    for (const b of l.beneficiaires ?? []) {
      beneficiaires.push({
        idBenef: -++cle,
        idDetail: l.idDetail,
        soaCode: b.soaCode,
        numCompte: b.numCompte,
        ancMontBenef: b.ancMontBenef,
        nouvMontBenef: b.nouvMontBenef,
      });
    }
    for (const p of l.processus ?? []) {
      previsions.push({
        idPrevision: -++cle,
        idDetail: l.idDetail,
        idCapm: p.idCapm,
        dateDebut: p.dateDebut ?? '',
        dateFin: p.dateFin,
        ordre: p.ordre,
      });
    }
  }
  return { detail, marches, beneficiaires, previsions };
}
