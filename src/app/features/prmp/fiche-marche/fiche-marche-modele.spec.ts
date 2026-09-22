import { ChampFiche, ReferentielFiche } from '../../../models';
import {
  BILAN_VIDE,
  REFERENTIEL_ESQUISSE,
  blocsASaisir,
  cadrageComplet,
  champsDeRubrique,
  evaluerCondition,
  progression,
  questionsPosees,
  reprises,
  resumeCadrage,
  rubriqueOuverte,
} from './fiche-marche-modele';

const champ = (p: Partial<ChampFiche> & Pick<ChampFiche, 'code' | 'bloc' | 'rubrique'>): ChampFiche => ({
  rang: 1,
  libelle: p.code,
  type: 'TEXTE',
  source: 'SAISIE',
  documentMaitre: 'DPAO',
  reprises: [],
  typesMarche: ['QUANTITE_FIXE'],
  obligatoire: false,
  ...p,
});

describe('Fiche marché — règles pures (esquisse du 22/09)', () => {
  it('conditions d’affichage : =, !=, et, ou ; vide = toujours ; clé absente = faux', () => {
    const c = { garantieSoumission: 'OUI', provenance: 'IMPORTEES', typePrix: 'UNITAIRES' };
    expect(evaluerCondition(null, c)).toBe(true);
    expect(evaluerCondition('', c)).toBe(true);
    expect(evaluerCondition('garantieSoumission = OUI', c)).toBe(true);
    expect(evaluerCondition('garantieSoumission = NON', c)).toBe(false);
    expect(evaluerCondition('garantieSoumission != NON', c)).toBe(true);
    expect(evaluerCondition('provenance = IMPORTEES et typePrix = UNITAIRES', c)).toBe(true);
    expect(evaluerCondition('provenance = NATIONAL et typePrix = UNITAIRES', c)).toBe(false);
    expect(evaluerCondition('provenance = NATIONAL ou typePrix = UNITAIRES', c)).toBe(true);
    expect(evaluerCondition('avance = OUI', c)).toBe(false); // clé absente
    expect(evaluerCondition('n’importe quoi', c)).toBe(false); // terme illisible = faux, jamais une exception
  });

  it('questions posées : « forme du groupement » seulement si groupement = OUI, « attributaires » seulement en contrat-cadre', () => {
    const base = questionsPosees({ typeMarche: 'QUANTITE_FIXE', groupement: 'NON' }).map((q) => q.cle);
    expect(base).not.toContain('formeGroupement');
    expect(base).not.toContain('attributaires');
    expect(questionsPosees({ typeMarche: 'QUANTITE_FIXE', groupement: 'OUI' }).map((q) => q.cle)).toContain('formeGroupement');
    expect(questionsPosees({ typeMarche: 'CONTRAT_CADRE' }).map((q) => q.cle)).toContain('attributaires');
  });

  it('cadrage complet : toutes les questions posées répondues, compléments compris (nombre de lots, taux d’avance)', () => {
    const complet = {
      typeMarche: 'QUANTITE_FIXE', alloti: 'OUI', nbLots: 3, variantes: 'NON', groupement: 'NON', provenance: 'IMPORTEES',
      typePrix: 'UNITAIRES', prixRevisable: 'NON', garantieSoumission: 'OUI', avance: 'OUI', tauxAvance: 10, penalites: 'CCAG',
    };
    expect(cadrageComplet(complet)).toBe(true);
    expect(cadrageComplet({ ...complet, nbLots: null })).toBe(false);
    expect(cadrageComplet({ ...complet, tauxAvance: 0 })).toBe(false);
    expect(cadrageComplet({ ...complet, avance: 'NON', tauxAvance: null })).toBe(true);
    expect(cadrageComplet({ ...complet, penalites: '' })).toBe(false);
    const puces = resumeCadrage(complet).map((p) => p.texte);
    expect(puces).toEqual(['Quantité fixe', 'Alloti · 3 lots', 'Variantes non', 'Groupement non', 'Fournitures importées', 'Prix unitaires', 'Prix ferme', 'Garantie de soumission exigée', 'Avance 10 %', 'Pénalités selon le ccag']);
  });

  it('rubriques et champs suivent le cadrage ; une rubrique sans champ (référentiel à compléter) reste ouverte', () => {
    const champs = [
      champ({ code: 'B05-GS-01', bloc: 'B05', rubrique: 'GS', condition: 'garantieSoumission = OUI', rang: 1 }),
      champ({ code: 'B05-GS-02', bloc: 'B05', rubrique: 'GS', condition: 'garantieSoumission = OUI', rang: 2, type: 'MONTANT' }),
      champ({ code: 'B05-MO-01', bloc: 'B05', rubrique: 'MO', rang: 1, source: 'PPM' }),
      champ({ code: 'B05-MO-02', bloc: 'B05', rubrique: 'MO', rang: 2, actif: false }),
    ];
    const gs = { code: 'GS', libelle: 'Garantie', rang: 4 };
    const mo = { code: 'MO', libelle: 'Monnaie', rang: 3 };
    expect(rubriqueOuverte(champs, 'B05', gs, { garantieSoumission: 'OUI' })).toBe(true);
    expect(rubriqueOuverte(champs, 'B05', gs, { garantieSoumission: 'NON' })).toBe(false);
    expect(rubriqueOuverte(champs, 'B05', mo, {})).toBe(true);
    expect(rubriqueOuverte(champs, 'B05', { code: 'VP', libelle: 'Variation', rang: 2 }, {})).toBe(true); // sans champ
    expect(champsDeRubrique(champs, 'B05', 'GS', { garantieSoumission: 'OUI' }).map((c) => c.code)).toEqual(['B05-GS-01', 'B05-GS-02']);
    expect(champsDeRubrique(champs, 'B05', 'MO', {}).map((c) => c.code)).toEqual(['B05-MO-01']); // l'inactif est écarté
    // Livraison backend du 22/09 : la rubrique d'un champ est servie en code COMPLET (« B05-GS ») — les deux formes se valent.
    const complets = champs.map((c) => ({ ...c, rubrique: `B05-${c.rubrique}` }));
    expect(champsDeRubrique(complets, 'B05', 'GS', { garantieSoumission: 'OUI' }).map((c) => c.code)).toEqual(['B05-GS-01', 'B05-GS-02']);
    expect(champsDeRubrique(complets, 'B05', 'B05-GS', { garantieSoumission: 'OUI' }).length).toBe(2);
    expect(rubriqueOuverte(complets, 'B05', { code: 'B05-GS', libelle: 'Garantie', rang: 4 }, { garantieSoumission: 'NON' })).toBe(false);
  });

  it('blocs à saisir : B01 (PPM) exclu, B07 seulement en contrat-cadre, ordre par rang', () => {
    expect(blocsASaisir(REFERENTIEL_ESQUISSE, 'QUANTITE_FIXE').map((b) => b.code)).toEqual(['B02', 'B03', 'B04', 'B05', 'B06', 'B08', 'B09', 'B10']);
    const avecB07: ReferentielFiche = { ...REFERENTIEL_ESQUISSE, blocs: [...REFERENTIEL_ESQUISSE.blocs, { code: 'B07', libelle: 'Marchés subséquents', rang: 7, rubriques: [] }] };
    expect(blocsASaisir(avecB07, 'CONTRAT_CADRE').map((b) => b.code)).toContain('B07');
    expect(blocsASaisir(avecB07, 'QUANTITE_FIXE').map((b) => b.code)).not.toContain('B07');
  });

  it('progression : sur les champs ouverts quand ils sont chargés, sur les comptes de l’esquisse sinon', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'A', bloc: 'B05', rubrique: 'GS', condition: 'garantieSoumission = OUI' }),
        champ({ code: 'B', bloc: 'B05', rubrique: 'GS', condition: 'garantieSoumission = OUI' }),
        champ({ code: 'C', bloc: 'B05', rubrique: 'MO', source: 'PPM' }),
      ],
    };
    expect(progression(ref, { garantieSoumission: 'OUI' }, { A: 'x' })).toEqual({ saisis: 1, attendus: 2 });
    expect(progression(ref, { garantieSoumission: 'NON' }, { A: 'x' })).toEqual({ saisis: 0, attendus: 0 });
    // Esquisse : 158 informations en quantité fixe (22 du PPM comprises), comptées comme attendues des rubriques.
    const p = progression(REFERENTIEL_ESQUISSE, {}, {});
    expect(p).toEqual({ saisis: 0, attendus: 158 });
    expect(BILAN_VIDE.bloquants).toEqual([]);
  });

  it('reprises : les champs qui alimentent d’autres documents, avec leur valeur (PPM ou saisie)', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'B01-AC-01', bloc: 'B01', rubrique: 'AC', source: 'PPM', reprises: ['AE', 'CCAP'] }),
        champ({ code: 'B05-GS-02', bloc: 'B05', rubrique: 'GS', reprises: ['AE'], condition: 'garantieSoumission = OUI' }),
        champ({ code: 'B04-LA-01', bloc: 'B04', rubrique: 'LA' }),
      ],
    };
    const r = reprises(ref, { garantieSoumission: 'OUI' }, { 'B05-GS-02': 8400000 }, { 'B01-AC-01': 'MEF' });
    expect(r.map((x) => [x.champ.code, x.valeur])).toEqual([['B01-AC-01', 'MEF'], ['B05-GS-02', 8400000]]);
    expect(reprises(ref, { garantieSoumission: 'NON' }, {}, { 'B01-AC-01': 'MEF' }).length).toBe(1);
    // Recette du 22/09 : un champ CADRAGE repris lit sa valeur dérivée par le serveur (`valeursCadrage`), pas la saisie.
    const avecCadrage: ReferentielFiche = { blocs: [], champs: [champ({ code: 'B05-GS-01', bloc: 'B05', rubrique: 'GS', source: 'CADRAGE', reprises: ['AE'] })] };
    expect(reprises(avecCadrage, {}, {}, {}, { 'B05-GS-01': 'OUI' })[0].valeur).toBe('OUI');
    expect(reprises(avecCadrage, {}, { 'B05-GS-01': 'NON' }, {})[0].valeur).toBeUndefined();
  });
});
