import { describe, expect, it } from 'vitest';

import { ArticleBesoin, LotBesoin } from '../../models';
import { avertissements, calculerTotaux, construireFormulaires, enLettres, formulairesLivres, prixManquants, saisieVide } from './offre-financiere';

function article(p: Partial<ArticleBesoin> & { idArticle: number }): ArticleBesoin {
  return { designation: 'Article ' + p.idArticle, unite: 'U', caracteristiques: [], ...p };
}

function lot(articles: ArticleBesoin[], p: Partial<LotBesoin> = {}): LotBesoin {
  return { numero: 1, intitule: 'Lot', articles, lieuLivraison: null, delaiExecution: null, garantieSoumission: null, qualification: null, ...p };
}

describe('Offre financière en ligne (lot 5a)', () => {
  describe('enLettres — orthographe traditionnelle', () => {
    it.each([
      [0, 'zéro'],
      [21, 'vingt et un'],
      [71, 'soixante et onze'],
      [80, 'quatre-vingts'],
      [81, 'quatre-vingt-un'],
      [91, 'quatre-vingt-onze'],
      [200, 'deux cents'],
      [201, 'deux cent un'],
      [1000, 'mille'],
      [80000, 'quatre-vingt mille'],
      [200000, 'deux cent mille'],
      [2450000, 'deux millions quatre cent cinquante mille'],
      [200000000, 'deux cents millions'],
      [1001001, 'un million mille un'],
      [5000000000, 'cinq milliards'],
    ])('%d → « %s »', (n, texte) => {
      expect(enLettres(n)).toBe(texte);
    });
  });

  it('marché à commande : le montant au maximum fait l’acte (H1), le minimum est lu en plus ; TVA arrondie', () => {
    const l = lot([article({ idArticle: 1, quantiteMin: 15, quantiteMax: 30 }), article({ idArticle: 2, quantiteMin: 10, quantiteMax: 20 })]);
    const s = { ...saisieVide(), prix: { 1: 2_000_000, 2: 333_333 } };
    const t = calculerTotaux(l, s, 20, false);
    expect(t.ht).toBe(30 * 2_000_000 + 20 * 333_333);
    expect(t.tva).toBe(Math.round(t.ht * 0.2));
    expect(t.ttc).toBe(t.ht + t.tva);
    expect(t.htMin).toBe(15 * 2_000_000 + 10 * 333_333);
    expect(t.ttcMin).toBe(t.htMin! + Math.round(t.htMin! * 0.2));
    expect(t.parSerie).toBeNull();
  });

  it('quantité fixe : pas de minimum ; travaux : sous-totaux par série', () => {
    const l = lot([article({ idArticle: 1, quantite: 2.5, serie: '000' }), article({ idArticle: 2, quantite: 100, serie: '500' }), article({ idArticle: 3, quantite: 10, serie: '500' })]);
    const t = calculerTotaux(l, { ...saisieVide(), prix: { 1: 1000, 2: 50, 3: 7 } }, 20, true);
    expect(t.htMin).toBeNull();
    expect(t.ht).toBe(2500 + 5000 + 70);
    expect(t.parSerie).toEqual([{ serie: '000', ht: 2500 }, { serie: '500', ht: 5070 }]);
  });

  it('un prix vide ou nul manque ; c’est le seul manque bloquant', () => {
    const l = lot([article({ idArticle: 1, quantite: 1 }), article({ idArticle: 2, quantite: 1 }), article({ idArticle: 3, quantite: 1 })]);
    expect(prixManquants(l, { ...saisieVide(), prix: { 1: 10, 2: 0 } }).map((a) => a.idArticle)).toEqual([2, 3]);
  });

  it('fournitures : dates manquantes ou hors délai, conformité incomplète ou non conforme → avertissements', () => {
    const l = lot(
      [article({ idArticle: 1, quantite: 1, caracteristiques: [{ idCaracteristique: 11, libelle: 'RAM', exigence: '8 Go' }, { idCaracteristique: 12, libelle: 'SSD', exigence: '500 Go' }] }), article({ idArticle: 2, quantite: 1 })],
      { delaiExecution: { valeur: 30, unite: 'JOURS', texte: null } },
    );
    const s = {
      prix: { 1: 10, 2: 10 },
      dates: { 1: '2026-12-31' },
      conformite: { 1: { marque: 'M', modele: 'X', caracteristiques: { 11: { proposee: '16 Go', conforme: true }, 12: { proposee: '256 Go', conforme: false } } } },
    };
    const m = avertissements(l, s, 'FOURNITURES_SERVICES', '2026-11-11T10:00', calculerTotaux(l, s, 20, false));
    expect(m).toEqual([
      '1 date(s) de livraison à saisir.',
      '1 date(s) de livraison au-delà du délai de 30 jours fixé par le dossier.',
      'Conformité technique : 1 réponse(s) à compléter (marque, modèle, caractéristique proposée, conforme ou non).',
      '1 caractéristique(s) déclarée(s) non conforme(s) : la commission le lira.',
    ]);
  });

  it('travaux : un prix au-delà de son plafond est averti', () => {
    const l = lot([article({ idArticle: 1, quantite: 1, numeroPrix: '001', plafond: 10, designation: 'Installation de chantier' }), article({ idArticle: 2, quantite: 1 })]);
    const s = { ...saisieVide(), prix: { 1: 200, 2: 800 } };
    const m = avertissements(l, s, 'TRAVAUX', null, calculerTotaux(l, s, 20, true));
    expect(m).toEqual(['Prix 001 « Installation de chantier » : 20 % du montant des travaux, au-delà du plafond de 10 %.']);
  });

  it('les formulaires scellés : bordereau avec lettres, conformité en fournitures seulement', () => {
    const l = lot([article({ idArticle: 1, quantite: 2, caracteristiques: [{ idCaracteristique: 11, libelle: 'RAM', exigence: '8 Go' }] })]);
    const s = { prix: { 1: 21 }, dates: { 1: '2026-12-01' }, conformite: { 1: { marque: ' M ', modele: 'X', caracteristiques: { 11: { proposee: '16 Go', conforme: true } } } } };
    const f = construireFormulaires(l, s, 'FOURNITURES_SERVICES', 20);
    expect(f.bordereau).toEqual([{ idArticle: 1, prixUnitaireHt: 21, prixEnLettres: 'vingt et un', dateLivraison: '2026-12-01' }]);
    expect(f.conformite).toEqual([{ idArticle: 1, marque: 'M', modele: 'X', caracteristiques: [{ idCaracteristique: 11, proposee: '16 Go', conforme: true }] }]);
    expect(f.totaux.ttc).toBe(42 + 8);
    const t = construireFormulaires(l, s, 'TRAVAUX', 20);
    expect(t.conformite).toBeNull();
    expect('dateLivraison' in t.bordereau[0]).toBe(false);
  });

  it('formulaires livrés : 5a partout, 5b aux travaux ; le calendrier des travaux reste à joindre', () => {
    expect([...formulairesLivres('FOURNITURES_SERVICES')]).toEqual(['BORDEREAU', 'CONFORMITE', 'CALENDRIER']);
    expect(formulairesLivres('TRAVAUX').has('K1')).toBe(true);
    expect(formulairesLivres('TRAVAUX').has('CALENDRIER')).toBe(false);
    expect(formulairesLivres('PRESTATIONS_INTELLECTUELLES').size).toBe(0);
  });
});
