import { EssentielDossier } from '../../../models';
import { OngletDossier } from '../dossier/documents-du-dossier';
import { casesEssentiel } from './essentiel-dossier';

/** ⚠️ 01/11 (pilote, variante A, lot 2 — « essentiel-dossier », B1) — l'exemple de la demande : 00009/MAOO-CC/CNM/2026. */
describe('L’essentiel du dossier — cases', () => {
  const complet: EssentielDossier = {
    avis: { code: 'FAV', libelle: 'Favorable', refePv: '00009/MAOO-CC/CNM/PV/2026', definitif: true, idPv: 41 },
    attributions: [{ lot: 1, attributaire: 'SAVA Routes et Ouvrages SA', numeroOffre: 1, montant: 11279883606, idDossierMarche: 100398 }],
    contrat: { forme: 'CONTRAT_CADRE', libelleForme: 'Contrat cadre', signeLe: '2026-09-14', finLe: '2027-09-16' },
    suites: { bonsCommande: 1, dernierBon: { numero: 1, date: '2026-10-05T11:00:00' }, actesGestion: 0 },
  };
  const marche = new Set<OngletDossier>(['pv-cnm', 'attribution']);

  it('une case par bloc, chacune vers l’élément qui la justifie', () => {
    const c = casesEssentiel(complet, marche);
    expect(c.map((x) => [x.cle, x.cible])).toEqual([['avis', 'pv-cnm'], ['attribution', 'attribution'], ['contrat', 'attribution'], ['suites', 'historique']]);
    expect(c[0].lignes).toEqual(['Favorable', 'PV 00009/MAOO-CC/CNM/PV/2026, définitif']);
    expect(c[0].ton).toBe('favorable');
    expect(c[1].lignes.map((l) => l.replace(/\s/g, ' '))).toEqual(['SAVA Routes et Ouvrages SA', 'offre n° 1 · 11 279 883 606 Ar']);
    expect(c[2].lignes).toEqual(['Contrat cadre', 'signé le 14/09/2026 · jusqu’au 16/09/2027']);
    expect(c[3].lignes).toEqual(['1 bon de commande', 'dernier n° 1 du 05/10/2026']);
  });

  it('un plan n’a que l’avis ; sans élément ouvrable, la case ne s’ouvre pas', () => {
    const c = casesEssentiel({ avis: { code: 'FAVR', libelle: 'Favorable avec réserves', refePv: null, definitif: false, idPv: 3 },
      attributions: null, contrat: null, suites: null }, new Set());
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ cle: 'avis', cible: null, ton: 'examen', lignes: ['Favorable avec réserves', 'PV, projet'] });
  });

  it('plusieurs lots : un attributaire par lot ; suites sans bon de commande', () => {
    const c = casesEssentiel({ avis: null, contrat: null,
      attributions: [{ lot: 1, attributaire: 'A', numeroOffre: 2, montant: null, idDossierMarche: 1 }, { lot: 2, attributaire: 'B', numeroOffre: null, montant: 5, idDossierMarche: 2 }],
      suites: { bonsCommande: 0, dernierBon: null, actesGestion: 2 } }, marche);
    expect(c[0].titre).toBe('Attributaires, par lot');
    expect(c[0].lignes).toEqual(['Lot 1 : A · offre n° 2', 'Lot 2 : B · 5 Ar']);
    expect(c[1].lignes).toEqual(['2 actes de gestion']);
  });
});
