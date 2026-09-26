import { ChampFiche, DocumentFiche, ReferentielFiche } from '../../../models';
import {
  BILAN_VIDE,
  aidesRevision,
  formatPiece,
  pieceOuvrable,
  piecesParLot,
  valeursSansCellule,
  allotissementDuPlan,
  nbLotsDuPlan,
  REFERENTIEL_ESQUISSE,
  blocsASaisir,
  cadrageComplet,
  cleValeur,
  documentEffectif,
  documentsProduits,
  largeurChamp,
  lotsDuChamp,
  optionsChoisies,
  basculerOption,
  reprisesAffichees,
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

describe('Fiche DAO — règles pures (esquisse du 22/09)', () => {
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

  it('questions posées : le TYPE n’en est plus une (lot 1c) ; « forme du groupement » si groupement = OUI, « attributaires » en contrat-cadre', () => {
    const base = questionsPosees({ typeMarche: 'QUANTITE_FIXE', categorie: 'FOURNITURES_SERVICES', groupement: 'NON' }).map((q) => q.cle);
    // ⚠️ Lot 1c : le type vient de la forme du marché de la ligne du plan ; l'écran l'injecte en contexte, il ne se demande plus.
    expect(base).not.toContain('typeMarche');
    expect(base.length).toBe(9);
    expect(base).not.toContain('formeGroupement');
    expect(base).not.toContain('attributaires');
    expect(questionsPosees({ typeMarche: 'QUANTITE_FIXE', groupement: 'OUI' }).map((q) => q.cle)).toContain('formeGroupement');
    expect(questionsPosees({ typeMarche: 'CONTRAT_CADRE' }).map((q) => q.cle)).toContain('attributaires');
    // ⚠️ Question du pilote (24/09) : la provenance ne commande AUCUN champ hors des fournitures — le mot n'existe
    // même pas dans les fichiers de correspondance des travaux et des prestations intellectuelles. On ne la pose plus.
    expect(base).toContain('provenance');
    expect(questionsPosees({ typeMarche: 'QUANTITE_FIXE', categorie: 'TRAVAUX' }).map((q) => q.cle)).not.toContain('provenance');
    expect(questionsPosees({ typeMarche: 'QUANTITE_FIXE', categorie: 'PRESTATIONS_INTELLECTUELLES' }).map((q) => q.cle)).not.toContain('provenance');
    // Les travaux gardent la leur : les tranches.
    expect(questionsPosees({ typeMarche: 'QUANTITE_FIXE', categorie: 'TRAVAUX' }).map((q) => q.cle)).toContain('tranches');
  });

  it('cadrage complet : toutes les questions posées répondues, compléments compris (nombre de lots, taux d’avance)', () => {
    const complet = {
      typeMarche: 'QUANTITE_FIXE', categorie: 'FOURNITURES_SERVICES', alloti: 'OUI', nbLots: 3, variantes: 'NON', groupement: 'NON', provenance: 'IMPORTEES',
      typePrix: 'UNITAIRES', prixRevisable: 'NON', garantieSoumission: 'OUI', avance: 'OUI', tauxAvance: 10, penalites: 'CCAG',
    };
    expect(cadrageComplet(complet)).toBe(true);
    expect(cadrageComplet({ ...complet, nbLots: null })).toBe(false);
    expect(cadrageComplet({ ...complet, tauxAvance: 0 })).toBe(false);
    expect(cadrageComplet({ ...complet, avance: 'NON', tauxAvance: null })).toBe(true);
    expect(cadrageComplet({ ...complet, penalites: '' })).toBe(false);
    const puces = resumeCadrage(complet).map((p) => p.texte);
    expect(puces).toEqual(['Alloti · 3 lots', 'Variantes non', 'Groupement non', 'Fournitures importées', 'Prix unitaires', 'Prix ferme', 'Garantie de soumission exigée', 'Avance 10 %', 'Pénalités selon le CCAG']);
    // ⚠️ Relevé sur la démonstration du 24/09 : la mise en minuscule ne doit pas manger un sigle.
    expect(resumeCadrage({ ...complet, penalites: 'PLAFOND_DIFFERENT' }).at(-1)?.texte).toBe('Pénalités plafond différent, à préciser');
  });

  it('allotissement déduit du plan : un lot = non alloti, deux et plus = alloti avec ce nombre', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [champ({ code: 'B02-LV-01', bloc: 'B02', rubrique: 'LV', source: 'PPM', clePpm: 'NB_LOTS_PPM' })],
    };
    // Le champ est retrouvé par sa clé PPM, pas par son code : c'est le référentiel qui fait foi.
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': '4' })).toBe(4);
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': 1 })).toBe(1);
    // Un plan muet, vide ou illisible ne fait rien deviner.
    expect(nbLotsDuPlan(ref, {})).toBeNull();
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': '' })).toBeNull();
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': 'quatre' })).toBeNull();
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': '2,5' })).toBeNull();
    expect(nbLotsDuPlan(ref, { 'B02-LV-01': '0' })).toBeNull();
    expect(nbLotsDuPlan(ref, null)).toBeNull();
    expect(nbLotsDuPlan({ blocs: [], champs: [] }, { 'B02-LV-01': '4' })).toBeNull(); // référentiel sans le champ

    expect(allotissementDuPlan(1)).toEqual({ alloti: 'NON', nbLots: null });
    expect(allotissementDuPlan(2)).toEqual({ alloti: 'OUI', nbLots: 2 });
    expect(allotissementDuPlan(4)).toEqual({ alloti: 'OUI', nbLots: 4 });
    expect(allotissementDuPlan(null)).toBeNull();
  });

  it('documents produits : déduits du référentiel, avec la répartition du contrat-cadre (DPAO → DPAC, CCAP → AE)', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'A', bloc: 'B02', rubrique: 'OB', documentMaitre: 'DPAO' }),
        champ({ code: 'B', bloc: 'B05', rubrique: 'TP', documentMaitre: 'AE' }),
        champ({ code: 'C', bloc: 'B09', rubrique: 'PR', documentMaitre: 'CCAP' }),
        champ({ code: 'D', bloc: 'B06', rubrique: 'AN', documentMaitre: 'AUCUN' }),
      ],
    };
    expect(documentsProduits(ref, 'QUANTITE_FIXE')).toEqual(['DPAO', 'AE', 'CCAP']);
    expect(documentsProduits(ref, 'A_COMMANDE')).toEqual(['DPAO', 'AE', 'CCAP']);
    // Un contrat-cadre ne produit ni DPAO ni CCAP : les champs partagés basculent sur ses deux documents.
    expect(documentsProduits(ref, 'CONTRAT_CADRE')).toEqual(['DPAC', 'AE']);
    // Des prestations intellectuelles consultent des consultants : le DPAO devient DPIC, le CCAP et l'AE restent.
    expect(documentsProduits(ref, 'QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES')).toEqual(['DPIC', 'AE', 'CCAP']);
    expect(documentsProduits(ref, 'QUANTITE_FIXE', 'TRAVAUX')).toEqual(['DPAO', 'AE', 'CCAP']);
    expect(documentsProduits({ blocs: [], champs: [] }, 'QUANTITE_FIXE')).toEqual([]);
  });

  it('le document maître affiché suit la forme puis la catégorie, jamais le code brut', () => {
    expect(documentEffectif('DPAO', 'QUANTITE_FIXE', 'TRAVAUX')).toBe('DPAO');
    expect(documentEffectif('DPAO', 'QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES')).toBe('DPIC');
    expect(documentEffectif('CCAP', 'QUANTITE_FIXE', 'PRESTATIONS_INTELLECTUELLES')).toBe('CCAP');
    expect(documentEffectif('DPAO', 'CONTRAT_CADRE', 'FOURNITURES_SERVICES')).toBe('DPAC');
    expect(documentEffectif('CCAP', 'CONTRAT_CADRE', null)).toBe('AE');
    expect(documentEffectif('AE', null, null)).toBe('AE');
  });

  it('par lot : la clé porte le rang, et un champ par lot se compte autant de fois qu’il y a de lots', () => {
    expect(cleValeur('B05-TP-02', null)).toBe('B05-TP-02');
    expect(cleValeur('B05-TP-02', 2)).toBe('B05-TP-02#2');
    // Un champ ordinaire n'a qu'une cellule, quoi qu'en dise le plan.
    expect(lotsDuChamp({ parLot: false }, true, 3)).toEqual([null]);
    // Un champ par lot n'en a qu'une tant que la ligne n'est pas allotie — c'est le SERVEUR qui le dit.
    expect(lotsDuChamp({ parLot: true }, false, 3)).toEqual([null]);
    expect(lotsDuChamp({ parLot: true }, true, 1)).toEqual([null]);
    expect(lotsDuChamp({ parLot: true }, true, 3)).toEqual([1, 2, 3]);

    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'A', bloc: 'B02', rubrique: 'OB', source: 'SAISIE' }),
        { ...champ({ code: 'B', bloc: 'B05', rubrique: 'TP', source: 'SAISIE', type: 'MONTANT' }), parLot: true },
      ],
    };
    // Sans allotissement : deux informations attendues, une saisie.
    expect(progression(ref, {}, { A: 'x' })).toEqual({ saisis: 1, attendus: 2 });
    // Alloti en trois lots : le champ par lot en attend trois ; « A » plus « B#1 » saisis.
    expect(progression(ref, {}, { A: 'x', 'B#1': 12 }, true, 3)).toEqual({ saisis: 2, attendus: 4 });
    // La clé nue d'un champ par lot ne compte pas sur une ligne allotie : le serveur la refuse.
    expect(progression(ref, {}, { A: 'x', B: 12 }, true, 3)).toEqual({ saisis: 1, attendus: 4 });
  });

  it('ergonomie : la largeur suit le type, et les reprises ne répètent ni elles-mêmes ni le document maître', () => {
    expect(largeurChamp('DATE')).toBe('court');
    expect(largeurChamp('MONTANT')).toBe('court');
    expect(largeurChamp('LISTE')).toBe('moyen');
    expect(largeurChamp('OUI_NON')).toBe('moyen');
    expect(largeurChamp('LISTE_MULTIPLE')).toBe('moyen');
    expect(largeurChamp('TEXTE_LONG')).toBe('long');
    expect(largeurChamp('TEXTE')).toBe('long');
    // ⚠️ Relevé sur une fiche de contrat-cadre : le champ est repris dans l'AE, et son CCAP devient un AE — « AE AE ».
    expect(reprisesAffichees({ documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'] }, 'CONTRAT_CADRE', 'FOURNITURES_SERVICES')).toEqual(['AE']);
    expect(reprisesAffichees({ documentMaitre: 'DPAO', reprises: ['AE', 'CCAP'] }, 'QUANTITE_FIXE', 'TRAVAUX')).toEqual(['AE', 'CCAP']);
    // Un champ n'est jamais « repris » dans son propre document maître.
    expect(reprisesAffichees({ documentMaitre: 'CCAP', reprises: ['CCAP', 'AE'] }, 'QUANTITE_FIXE', 'TRAVAUX')).toEqual(['AE']);
    expect(reprisesAffichees({ documentMaitre: 'DPAO', reprises: [] }, 'QUANTITE_FIXE', null)).toEqual([]);
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

  it('un champ PIECE ne compte ni comme attendu ni comme saisi : il se joint au dossier (lot 5)', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'A', bloc: 'B05', rubrique: 'GS' }),
        champ({ code: 'B', bloc: 'B09', rubrique: 'AN', type: 'PIECE', obligatoire: true }),
      ],
    };
    // Le serveur exclut les PIECE de son bilan ; l'écran doit compter pareil, sinon les deux chiffres se contredisent.
    expect(progression(ref, {}, {})).toEqual({ saisis: 0, attendus: 1 });
    expect(progression(ref, {}, { A: 'x', B: 'quoi que ce soit' })).toEqual({ saisis: 1, attendus: 1 });
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

  it('LISTE_MULTIPLE : la valeur est « A1,A3 » — lecture tolérante, écriture dans l’ordre du référentiel', () => {
    const options = ['A1', 'A2', 'A3', 'A4'];
    // Lecture : ni vide, ni espaces, ni virgule orpheline ne doivent produire une option fantôme.
    expect(optionsChoisies(null)).toEqual([]);
    expect(optionsChoisies('')).toEqual([]);
    expect(optionsChoisies(',')).toEqual([]);
    expect(optionsChoisies('A1, A3')).toEqual(['A1', 'A3']);
    expect(optionsChoisies('A1,,A3,')).toEqual(['A1', 'A3']);
    // Un nombre servi par le serveur se lit quand même (une seule option).
    expect(optionsChoisies(2)).toEqual(['2']);
    // ⚠️ Le serveur accepte aussi le tableau JSON : une valeur relue sous cette forme ne doit pas se perdre.
    expect(optionsChoisies(['A1', 'A3'])).toEqual(['A1', 'A3']);
    expect(optionsChoisies([])).toEqual([]);
    expect(basculerOption(['A3'], 'A1', options, true)).toBe('A1,A3');

    // Écriture : l’ordre est celui du référentiel, pas celui des clics — deux postes cochant A3 puis A1
    // enregistrent la même valeur, sinon le diff de version signale un changement qui n’en est pas un.
    expect(basculerOption('', 'A3', options, true)).toBe('A3');
    expect(basculerOption('A3', 'A1', options, true)).toBe('A1,A3');
    expect(basculerOption('A1,A3', 'A2', options, true)).toBe('A1,A2,A3');
    // Décocher, et décocher ce qui n’était pas coché (rien ne bouge).
    expect(basculerOption('A1,A2,A3', 'A2', options, false)).toBe('A1,A3');
    expect(basculerOption('A1', 'A4', options, false)).toBe('A1');
    // Cocher deux fois : la valeur ne double pas.
    expect(basculerOption('A1', 'A1', options, true)).toBe('A1');
    // Tout décocher rend la chaîne vide — l’information devient « non renseignée ».
    expect(basculerOption('A1', 'A1', options, false)).toBe('');
  });

  it('LISTE_MULTIPLE : une option que le référentiel n’admet plus est CONSERVÉE, en queue', () => {
    // ⚠️ Révision : le référentiel a changé sous une fiche déjà saisie. L’écran n’efface pas en silence une
    // ancienne valeur au premier clic — c’est au rédacteur de la retirer s’il le décide.
    const options = ['A1', 'A2'];
    expect(basculerOption('A1,A9', 'A2', options, true)).toBe('A1,A2,A9');
    expect(basculerOption('A9', 'A1', options, true)).toBe('A1,A9');
    // Et elle se retire comme les autres.
    expect(basculerOption('A1,A9', 'A9', options, false)).toBe('A1');
  });


  it('pièces produites : groupées par lot, les DEUX formats d’une même pièce sur une seule ligne', () => {
    const f = (id: number, type: string, lot: number | null, nom: string, libelle?: string): DocumentFiche =>
      ({ idDocument: id, type, lot, nomFichier: nom, libelle: libelle ?? null } as DocumentFiche);
    // Le dossier réel 2463 sert 86 fichiers pour 43 pièces : chaque pièce existe en .docx ET en .pdf.
    const groupes = piecesParLot([
      f(1, 'BP', 2, 'BP_lot2.xlsx', 'Bordereau des prix — lot 2'),
      f(2, 'AE', 2, 'AE_lot2.pdf'),
      f(3, 'DPAO', null, 'DPAO.docx'),
      f(4, 'AE', 1, 'AE_lot1.pdf'),
      f(5, 'CCAP', null, 'CCAP.pdf'),
      f(6, 'DPAO', null, 'DPAO.pdf', 'Données particulières de l’appel d’offres'),
      f(7, 'AE', 2, 'AE_lot2.docx'),
    ]);
    expect(groupes.map((g) => g.titre)).toEqual(['Communes au dossier', 'Lot 1', 'Lot 2']);
    // Dans un groupe, l'ordre est celui de la lecture d'un dossier : le document de consultation, le CCAP, puis l'AE.
    expect(groupes[0].pieces.map((p) => p.type)).toEqual(['DPAO', 'CCAP']);
    expect(groupes[2].pieces.map((p) => p.type)).toEqual(['AE', 'BP']);
    // Une pièce, deux fichiers — le PDF d'abord : c'est celui qui se lit sans rien installer.
    expect(groupes[0].pieces[0].fichiers.map((x) => x.nomFichier)).toEqual(['DPAO.pdf', 'DPAO.docx']);
    expect(groupes[2].pieces[0].fichiers.map((x) => x.idDocument)).toEqual([2, 7]);
    // Le libellé du serveur suit la pièce, même s'il n'est porté que par l'un de ses fichiers.
    expect(groupes[0].pieces[0].libelle).toBe('Données particulières de l’appel d’offres');
    expect(groupes[0].pieces[1].libelle).toBeNull();
    expect(groupes[0].pieces.map((p) => p.cle)).toEqual(['DPAO#', 'CCAP#']);
    expect(groupes[2].pieces[0].cle).toBe('AE#2');
    // Sans allotissement, un seul groupe — le gabarit n'affiche alors aucun titre.
    expect(piecesParLot([f(8, 'DPAO', null, 'DPAO.pdf')]).map((g) => g.lot)).toEqual([null]);
    expect(piecesParLot([])).toEqual([]);

    // ⚠️ Le socle force un type inerte : un .docx ou un .xlsx « ouvert » s'afficherait en PDF illisible.
    expect(pieceOuvrable({ extension: 'pdf', nomFichier: 'AE.pdf' })).toBe(true);
    expect(pieceOuvrable({ extension: null, nomFichier: 'AE.PDF' })).toBe(true);
    expect(pieceOuvrable({ extension: 'docx', nomFichier: 'AE.docx' })).toBe(false);
    expect(pieceOuvrable({ extension: null, nomFichier: 'BP_lot1.xlsx' })).toBe(false);
    // Le format s'écrit en clair sur le bouton.
    expect(formatPiece({ extension: 'pdf', nomFichier: 'x.pdf' })).toBe('PDF');
    expect(formatPiece({ extension: 'docx', nomFichier: 'x.docx' })).toBe('Word');
    expect(formatPiece({ extension: null, nomFichier: 'x.xlsx' })).toBe('Excel');
    expect(formatPiece({ extension: 'odt', nomFichier: 'x.odt' })).toBe('ODT');
  });

  it('valeurs sans cellule : ce que le référentiel d’aujourd’hui n’affiche plus, et POURQUOI', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'B09-LL-01', bloc: 'B09', rubrique: 'LL', parLot: true }),
        champ({ code: 'B05-GS-02', bloc: 'B05', rubrique: 'GS', condition: 'garantieSoumission = OUI' }),
        champ({ code: 'B02-OB-01', bloc: 'B02', rubrique: 'OB' }),
      ],
    };
    const valeurs = {
      'B09-LL-01': 'Antananarivo', // clé nue d'un champ devenu PAR LOT
      'B09-LL-01#1': 'Antananarivo',
      'B02-AU-03': 'texte libre', // code retiré du référentiel
      'B05-GS-02': 8400000, // rubrique fermée par le cadrage : ce n'est PAS une perte
      'B02-OB-01': 'Mobilier',
      'B02-OB-02': '', // vide : rien à montrer
    };
    const dehors = valeursSansCellule(ref, { garantieSoumission: 'NON' }, valeurs, true, 3);
    expect(dehors.map((v) => [v.cle, v.motif])).toEqual([
      ['B02-AU-03', 'code-retire'],
      ['B09-LL-01', 'hors-forme'],
    ]);
    // Sans allotissement, la clé nue redevient la bonne, et c'est la clé #1 qui sort.
    expect(valeursSansCellule(ref, {}, valeurs, false, 0).map((v) => v.cle)).toEqual(['B02-AU-03', 'B09-LL-01#1']);
    // Un champ désactivé est un code retiré : le serveur ne le sert plus, la valeur reste.
    const desactive: ReferentielFiche = { blocs: [], champs: [champ({ code: 'B02-AU-03', bloc: 'B02', rubrique: 'AU', actif: false })] };
    expect(valeursSansCellule(desactive, {}, { 'B02-AU-03': 'texte' })).toEqual([{ cle: 'B02-AU-03', valeur: 'texte', motif: 'code-retire' }]);
    // Référentiel pas encore chargé : on ne déclare rien orphelin sur une structure vide.
    expect(valeursSansCellule({ blocs: [], champs: [] }, {}, valeurs)).toEqual([]);
  });

  it('aide à la révision : l’ancienne valeur se LIT à côté de la cellule vide, jamais recopiée', () => {
    const ref: ReferentielFiche = {
      blocs: [],
      champs: [
        champ({ code: 'B09-LL-01', bloc: 'B09', rubrique: 'LL', parLot: true }),
        champ({ code: 'B04-CD-01', bloc: 'B04', rubrique: 'CD', type: 'LISTE_MULTIPLE', options: ['A1', 'A2'] }),
        champ({ code: 'B02-OB-01', bloc: 'B02', rubrique: 'OB' }),
        champ({ code: 'B01-AC-01', bloc: 'B01', rubrique: 'AC', source: 'PPM' }),
      ],
    };
    const precedentes = {
      'B09-LL-01': 'Antananarivo', // valeur COMMUNE d'un champ devenu par lot
      'B04-CD-01': 'Fiche A1 et A3', // texte hors des options : le serveur ne l'a pas repris
      'B02-OB-01': 'Mobilier de bureau',
      'B01-AC-01': 'MESupReS',
    };
    // La valeur commune sert d'aide à CHAQUE lot : c'est le cas réel du dossier 2463 (lieu de livraison).
    const aides = aidesRevision(ref, {}, { 'B02-OB-01': 'Mobilier de bureau — 5 lots' }, precedentes, true, 2);
    expect([...aides.entries()]).toEqual([
      ['B09-LL-01#1', 'Antananarivo'],
      ['B09-LL-01#2', 'Antananarivo'],
      ['B04-CD-01', 'Fiche A1 et A3'],
    ]);
    // Une cellule déjà ressaisie n'a plus d'aide ; un champ du PPM n'en a jamais (il n'est pas ressaisi).
    expect(aides.has('B02-OB-01')).toBe(false);
    expect(aides.has('B01-AC-01')).toBe(false);
    // Hors révision (aucune version précédente lue), aucune aide.
    expect(aidesRevision(ref, {}, {}, null, true, 2).size).toBe(0);
    // Un champ qui n'est PLUS par lot retrouve l'ancienne valeur du premier lot.
    expect(aidesRevision(ref, {}, {}, { 'B09-LL-01#1': 'Toamasina' }, false, 0).get('B09-LL-01')).toBe('Toamasina');
    // Une ancienne valeur blanche n'est pas une aide.
    expect(aidesRevision(ref, {}, {}, { 'B02-OB-01': '   ' }, false, 0).has('B02-OB-01')).toBe(false);
  });

});
