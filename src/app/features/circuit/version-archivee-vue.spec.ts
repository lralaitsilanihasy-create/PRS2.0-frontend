import { VersionArchiveeDetail } from '../../models';
import { vueVersionArchivee } from './version-archivee-vue';

/**
 * La version archivée est servie dans SA forme (lignes + collections imbriquées) ; le tableau partagé
 * attend trois listes plates regroupées par `idDetail`. Ce qui compte : rien n'est perdu, chaque
 * enfant retrouve sa ligne, et les identifiants synthétiques ne se croisent jamais.
 */
describe('vueVersionArchivee', () => {
  const detail: VersionArchiveeDetail = {
    version: { idDossier: 700, numero: 2, origine: 'RECTIFICATION', cycle: 2, dateVersion: '2026-09-06T01:00:00', nbLignes: 2 },
    lignes: [
      {
        idDetail: 7001,
        designationMarche: 'Marche A',
        montEstim: 250,
        formeMarche: 'QUANTITE_FIXE',
        beneficiaires: [
          { soaCode: 'SOA-A', ancMontBenef: 150, nouvMontBenef: 150 },
          { soaCode: 'SOA-B', numCompte: '6111', ancMontBenef: 100, nouvMontBenef: 100 },
        ],
        lots: [{ designationLot: 'Lot Unique', montLot: 250, qteLot: 2, uniteLot: 'u' }],
        processus: [
          { idCapm: 2, ordre: 2, dateDebut: '2026-03-10', dateFin: '2026-03-20' },
          { idCapm: 1, ordre: 1, dateDebut: '2026-03-01' },
        ],
      },
      { idDetail: 7002, designationMarche: 'Marche B', montEstim: 40, supprimee: true, beneficiaires: [], lots: [], processus: [] },
    ],
  };

  it('projette chaque ligne en Marche rattaché au dossier et au PPM courants', () => {
    const vue = vueVersionArchivee(detail, 700, 700);
    expect(vue.marches).toHaveLength(2);
    expect(vue.marches[0]).toEqual(
      expect.objectContaining({ idDetail: 7001, idDossier: 700, idPpm: 700, designationMarche: 'Marche A', montEstim: 250, formeMarche: 'QUANTITE_FIXE', supprimee: false }),
    );
    // La suppression logique est conservée : le tableau partagé écarte ces lignes, comme pour le plan courant.
    expect(vue.marches[1].supprimee).toBe(true);
  });

  it('aplatit bénéficiaires et dates prévisionnelles par idDetail, sans rien perdre', () => {
    const vue = vueVersionArchivee(detail, 700, 700);
    expect(vue.beneficiaires.map((b) => [b.idDetail, b.soaCode, b.numCompte, b.nouvMontBenef])).toEqual([
      [7001, 'SOA-A', undefined, 150],
      [7001, 'SOA-B', '6111', 100],
    ]);
    expect(vue.previsions.map((p) => [p.idDetail, p.idCapm, p.ordre, p.dateDebut, p.dateFin])).toEqual([
      [7001, 2, 2, '2026-03-10', '2026-03-20'],
      [7001, 1, 1, '2026-03-01', undefined],
    ]);
  });

  it('pose des identifiants synthétiques négatifs, tous distincts', () => {
    const vue = vueVersionArchivee(detail, 700, 700);
    const ids = [...vue.beneficiaires.map((b) => b.idBenef), ...vue.previsions.map((p) => p.idPrevision)];
    expect(ids.every((id) => id < 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('garde le détail d’origine (lots compris) pour un usage ultérieur', () => {
    const vue = vueVersionArchivee(detail, 700, 700);
    expect(vue.detail).toBe(detail);
    expect(vue.detail.lignes[0].lots[0].designationLot).toBe('Lot Unique');
  });
});
