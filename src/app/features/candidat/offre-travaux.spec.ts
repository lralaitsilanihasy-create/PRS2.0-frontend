import { describe, expect, it } from 'vitest';

import { BesoinEnLigne, LotBesoin } from '../../models';
import { avertissementsTravaux, calculerK1, construireTravaux, moyenneCa, prixSousDetail, referencesRetenues, saisieTravauxVide, seuilLiquidite } from './offre-travaux';

const lot: LotBesoin = {
  numero: null,
  intitule: null,
  lieuLivraison: null,
  delaiExecution: null,
  garantieSoumission: null,
  articles: [
    { idArticle: 1, designation: 'Installation et repli de chantier', unite: 'Fft', quantite: 1, numeroPrix: '001', sousDetail: true, plafond: 10, caracteristiques: [] },
    { idArticle: 2, designation: 'Maçonnerie de moellons', unite: 'm³', quantite: 100, numeroPrix: '529', caracteristiques: [] },
  ],
  qualification: {
    liquiditeMontant: 50_000_000,
    liquiditePourcentage: 10,
    chiffreAffaires: { montant: 5_000_000_000, annees: 5, meilleures: 3, domaine: 'travaux routiers' },
    references: { montant: 2_500_000_000, nombre: 3, annees: 10, cumul: true },
  },
};
const besoin: BesoinEnLigne = {
  idDmc: 1, categorie: 'TRAVAUX', typeMarche: 'QUANTITE_FIXE', formulaires: true, tauxTva: 20, monnaie: 'MGA', lots: [lot],
  personnel: [{ idPersonnel: 41, poste: 'Conducteur de travaux', nombre: 1, experienceAnnees: 5 }],
  materiel: [{ idMateriel: 17, designation: 'Camion benne', nombre: 6, minimumEnPropre: 4 }],
};
const totaux = { ht: 1_000_000_000, tva: 200_000_000, ttc: 1_200_000_000, htMin: null, ttcMin: null, parSerie: null };

describe('Offre des travaux en ligne (lot 5b)', () => {
  it('K1 : formule de l’annexe 2, arrondie au centième par défaut ; A3 nul pour un siège à Madagascar', () => {
    const s = { ...saisieTravauxVide(), k1: { a1: 5, a2: 10, a5: 10, a9: 3 } };
    expect(calculerK1(s, 20)).toEqual({ A1: 15, A2: 10, A3: 0, k1: 1.26 }); // 1,15 × 1,10 = 1,265 → 1,26
    const etranger = calculerK1({ ...s, siegeEtranger: true }, 20); // 1,265 / (1 − 0,03 × 1,2) = 1,3122…
    expect(etranger.A3).toBe(3);
    expect(etranger.k1).toBe(1.31);
    expect(calculerK1(saisieTravauxVide(), 20).k1).toBe(1);
  });

  it('sous-détail : prix = D × K1 / R', () => {
    const sd = { rendement: 2, lignes: [{ nature: 'MAIN_OEUVRE' as const, designation: 'Manœuvre', unite: 'h', quantite: 10, prixUnitaire: 1000 }, { nature: 'MATERIEL' as const, designation: 'Camion', unite: 'j', quantite: 1, prixUnitaire: 30000 }] };
    expect(prixSousDetail(sd, 1.25)).toBe(Math.round((40000 * 1.25) / 2));
    expect(prixSousDetail(undefined, 1.25)).toBeNull();
  });

  it('capacités : moyenne des meilleures années, seuil de liquidité le plus exigeant, références de la période cumulées', () => {
    const s = {
      ...saisieTravauxVide(),
      chiffresAffaires: { 2025: 6e9, 2024: 4e9, 2023: 5e9, 2022: 7e9, 2021: 1e9 },
      references: [
        { objet: 'A', maitreOuvrage: 'X', annee: 2020, montant: 1e9 },
        { objet: 'B', maitreOuvrage: 'Y', annee: 2010, montant: 9e9 }, // hors période (10 ans)
        { objet: 'C', maitreOuvrage: 'Z', annee: 2024, montant: 1.2e9 },
      ],
    };
    expect(moyenneCa(lot, s, '2026-11-11T10:00')).toBe(6e9); // (7 + 6 + 5) / 3
    expect(seuilLiquidite(lot, 1_200_000_000)).toBe(120_000_000);
    expect(referencesRetenues(lot, s, '2026-11-11T10:00')).toBe(2.2e9);
  });

  it('avertissements : sous-détail incohérent, capacités, personnel, matériel', () => {
    const s = {
      ...saisieTravauxVide(),
      sousDetails: { 1: { rendement: 1, lignes: [{ nature: 'MATERIEL' as const, designation: 'Camion', unite: 'j', quantite: 10, prixUnitaire: 100000 }] } },
      chiffresAffaires: { 2025: 6e9, 2024: 6e9, 2023: 6e9 },
      liquidite: { montant: 100_000_000, nature: 'ligne de crédit', emetteur: 'Banque' },
      references: [{ objet: 'A', maitreOuvrage: 'X', annee: 2024, montant: 3e9 }],
      personnel: { 41: [{ nom: 'Conducteur', diplome: 'Ingénieur', experienceAnnees: 3 }] },
      materiel: { 17: { designation: 'Camion benne', nombre: 6, enPropre: 2 } },
    };
    const m = avertissementsTravaux(lot, besoin, s, { 1: 1_100_000, 2: 5000 }, totaux, 20, '2026-11-11T10:00');
    expect(m.map((x) => x.replace(/[\u202f\u00a0]/g, ' '))).toEqual([
      'Sous-détail du prix 001 : 1 000 000 Ar calculés, contre 1 100 000 Ar au bordereau (écart de plus de 1 %).',
      'Liquidité : 100 000 000 Ar attestés, pour 120 000 000 Ar exigés.',
      'Personnel « Conducteur de travaux » : 1 personne(s) sous les 5 ans d’expérience exigés.',
      'Matériel « Camion benne » : 2 en propre, pour 4 exigés.',
    ]);
  });

  it('les parties scellées : seulement celles que la fiche demande', () => {
    const s = { ...saisieTravauxVide(), materiel: { 17: { designation: 'Camion benne 10 t', nombre: 6, enPropre: 4 } }, personnel: { 41: [{ nom: ' Conducteur ', diplome: 'Ingénieur', experienceAnnees: 8 }] } };
    const f = construireTravaux(lot, besoin, s, 20, '2026-11-11T10:00');
    expect(f.k1?.taux).toHaveLength(9);
    expect(f.sousDetails?.map((x) => x.idArticle)).toEqual([1]);
    expect(f.capacites).toEqual({ chiffresAffaires: [], liquidite: null, references: [] });
    expect(f.personnel).toEqual([{ idPersonnel: 41, nom: 'Conducteur', diplome: 'Ingénieur', experienceAnnees: 8 }]);
    expect(f.materiel).toEqual([{ idMateriel: 17, designation: 'Camion benne 10 t', nombre: 6, enPropre: 4 }]);
    const sansCapacites = construireTravaux({ ...lot, qualification: null, articles: [lot.articles[1]] }, { ...besoin, personnel: [], materiel: [] }, s, 20, null);
    expect(Object.keys(sansCapacites)).toEqual(['k1']);
  });
});
