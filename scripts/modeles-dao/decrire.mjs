// Lot D — « DAO complet » (feu vert du pilote du 28/09) : décrit les documents produits sur les DOCUMENTS TYPES
// OFFICIELS de l'ARMP, au lieu des listes « libellé : valeur » du lot 2a (le « lot 2b » annoncé par le générateur du
// serveur). Premier document : les Données particulières d'appel à concurrence (DPAC) du contrat-cadre, fournitures
// et services.
//
// Même principe que la chaîne des formulaires du candidat (`../modeles-candidat/decrire-armp.mjs`) : le texte n'est
// JAMAIS retapé — chaque paragraphe est lu dans `sources/<document>.txt` (produit par `extraire.mjs`) —, et ce qui est
// écrit ici, c'est la STRUCTURE et le SORT de chaque trou du modèle. Un trou `<…>` a l'un de ces sorts, tous tracés :
//
//   jeton   — une information de la fiche le remplit : `{{CODE}}` (contrat des jetons des formulaires du candidat) ;
//             le texte autour des jetons ne peut être que de la ponctuation ou des mots pris dans le trou ;
//   choix   — le modèle propose lui-même ses rédactions (« choisir entre … / … ») : l'une d'elles est gardée MOT POUR
//             MOT, dans une section conditionnelle `{{SI:NOM}}` … `{{FINSI:NOM}}` ;
//   retire  — une instruction à l'acheteur (« Préciser… », exemples, « OU ») disparaît du document final, comme le
//             modèle le demande (« les commentaires … doivent être supprimés du contrat finalisé ») ;
//   typo    — une coquille de frappe du modèle (espace manquante) : même texte à la ponctuation près.
//
// Les conditions sont DÉCLARÉES en tête du fichier de commande (`CONDITION nom US expression`), dans la syntaxe des
// conditions du référentiel (`cle = valeur`, `et`), plus `cle renseigne` / `cle vide` ; le moteur du serveur les évalue
// sur le cadrage et sur les valeurs de la fiche (demande backend du 28/09, lot D). Trois garde-fous font échouer le
// script au lieu de produire un modèle faux : un fragment introuvable dans sa ligne, un « choix » qui n'est pas une
// rédaction du modèle, et une ligne de la source ni reprise ni déclarée retirée (avec sa raison).
//
//   node decrire.mjs [DPAC-CC]      → modeles/<sigle>.txt (commande Decalque et moteur du serveur) et .json (trace)
import fs from 'node:fs';
import { cle, droite, lireSource, propre, reduire } from './commun.mjs';

// ── Outils ─────────────────────────────────────────────────────────────────────────────────────
const US = '\u001F';
/** Les unités qu'un jeton peut porter sans que le trou les nomme. */
const UNITES = ['mois', 'jours', 'jour', 'ans', 'heures'];

/** Une section de la source : ses lignes non vides, numérotées, et le registre de ce qui en est fait. */
function sectionDe(src, debut, fin) {
  const i = src.findIndex((l) => cle(l).startsWith(cle(debut)));
  if (i < 0) throw new Error(`section « ${debut} » absente`);
  const j = fin ? src.findIndex((l, k) => k > i && cle(l).startsWith(cle(fin))) : src.length;
  if (j < 0) throw new Error(`fin de section « ${fin} » absente`);
  const lignes = [];
  // Les ligatures typographiques du document type (« ﬁ » de « notiﬁcation ») sont dépliées : elles déjoueraient la
  // recherche et les polices du PDF du serveur ne les ont pas toutes. C'est la seule normalisation ajoutée à `propre`.
  const deplier = (s) => s.replace(/[ﬀ-ﬆ]/g, (c) => c.normalize('NFKC'));
  for (let k = i; k < j; k++) if (src[k].trim()) lignes.push({ n: k + 1, brut: deplier(src[k]), texte: deplier(propre(src[k])) });
  return { lignes, prises: new Set(), retirees: new Set(), retraits: [] };
}

/**
 * ⚠️ Lot D2 (28/09) — une section lue PARAGRAPHE DE CELLULE par paragraphe de cellule (source extraite avec
 * `--paragraphes` : cellules séparées par une tabulation, paragraphes d'une cellule par RS). Chaque paragraphe est une
 * unité (`n` = « ligne.cellule.paragraphe ») : un choix se fait à l'intérieur d'une cellule, et le garde-fou « aucune
 * ligne perdue » vaut paragraphe par paragraphe. Mêmes outils ensuite (`ligne`, `retirer`, `toutEstRendu`).
 */
function sectionCellules(src, debut, fin) {
  const i = src.findIndex((l) => cle(l).startsWith(cle(debut)));
  if (i < 0) throw new Error(`section « ${debut} » absente`);
  const j = fin ? src.findIndex((l, k) => k > i && cle(l).startsWith(cle(fin))) : src.length;
  const deplier = (s) => s.replace(/[ﬀ-ﬆ]/g, (c) => c.normalize('NFKC'));
  const lignes = [];
  for (let k = i; k < j; k++) {
    const cellules = src[k].split('\t');
    cellules.forEach((cel, c) => cel.split('\u001E').forEach((par, p) => {
      if (par.trim()) lignes.push({ n: `${k + 1}.${c}.${p}`, ligne: k + 1, cellule: c, p, nbCellules: cellules.length, brut: deplier(par), texte: deplier(propre(par)) });
    }));
  }
  return { lignes, prises: new Set(), retirees: new Set(), retraits: [] };
}

/** La ligne de tableau dont une cellule commence par ce motif : une vue de la section réduite à ses paragraphes. */
function rangee(sec, motif, cellule = 0) {
  const u = sec.lignes.find((x) => !sec.retirees.has(x.n) && x.cellule === cellule && x.p === 0 && correspond(x, motif));
  if (!u) throw new Error(`rangée « ${motif} » (cellule ${cellule}) absente`);
  return { ...sec, lignes: sec.lignes.filter((x) => x.ligne === u.ligne) };
}

/**
 * ⚠️ Lot D2 — l'émetteur générique, pour un document surtout FIXE (l'acte d'engagement du candidat) : il reprend une
 * plage de la source telle quelle — paragraphes, et lignes de tableau avec leurs cellules vides —, n'y remplace que
 * les trous déclarés (`trous` : `[motif, ...remplacements]`), et ce qui a été retiré avant (`retirer`) n'y paraît pas.
 * La plage va de la ligne dont le premier paragraphe répond à `de` (incluse) à celle qui répond à `a` (exclue, ou la
 * fin). Un paragraphe hors tableau dont le texte répond à `titres` devient un sous-titre.
 */
function emetteur(sec, tr, titres = /^(ARTICLE\b|[A-Z]\.\s*-|\d+\.\d*\.?\s)/) {
  const numeros = [...new Set(sec.lignes.map((u) => u.ligne))].sort((x, y) => x - y);
  /** La ligne dont le premier paragraphe non retiré répond au motif — `[motif, rang]` quand le titre revient. */
  const ligneDe = (repere) => {
    const [motif, rang] = Array.isArray(repere) ? repere : [repere, 0];
    const trouvees = numeros.filter((k) => {
      const u = sec.lignes.find((x) => x.ligne === k && !sec.retirees.has(x.n));
      return u && correspond(u, motif);
    });
    if (trouvees.length <= rang) throw new Error(`plage : « ${motif} » (rang ${rang}) absent`);
    return trouvees[rang];
  };
  return (de, a = null, trous = []) => {
    const l0 = ligneDe(de);
    const l1 = a ? ligneDe(a) : Infinity;
    const out = [];
    let colonnes = 0;
    const texte = (u) => {
      sec.prises.add(u.n);
      const t = trous.find(([m]) => correspond(u, m));
      if (t) return traiter(tr, u.n, u.texte, ...t.slice(1));
      PRODUITS.add(u.texte);
      return u.texte;
    };
    for (const n of numeros.filter((k) => k >= l0 && k < l1)) {
      const us = sec.lignes.filter((u) => u.ligne === n && !sec.retirees.has(u.n));
      if (!us.length) continue;
      const nb = us[0].nbCellules;
      if (nb === 1) {
        if (colonnes) { out.push(FIN); colonnes = 0; }
        for (const u of us) { const t = texte(u); out.push(titres.test(t) ? ST(t) : P(t)); }
        continue;
      }
      if (colonnes !== nb) { if (colonnes) out.push(FIN); out.push(T(nb)); colonnes = nb; }
      out.push(L(...Array.from({ length: nb }, (_, c) => us.filter((u) => u.cellule === c).map(texte).join('\u001E'))));
    }
    if (colonnes) out.push(FIN);
    return out;
  };
}

/** Tout texte lu dans la source ou tiré d'elle par `traiter` : un paragraphe du modèle qui n'en vient pas est un AJOUT déclaré. */
const PRODUITS = new Set();

/** Recherche sensible à la casse (« OBJET DU CONTRAT-CADRE » n'est pas « Objet du contrat-cadre ») ; `=texte` : exact. */
const correspond = (l, motif) => (motif.startsWith('=') ? cle(l.texte) === cle(motif.slice(1)) : cle(l.texte).startsWith(cle(motif)));

/** La n-ième ligne de la section, hors lignes retirées, qui commence par ce préfixe. */
function ligne(sec, motif, rang = 0) {
  const trouvees = sec.lignes.filter((l) => !sec.retirees.has(l.n) && correspond(l, motif));
  if (trouvees.length <= rang) throw new Error(`« ${motif} » : ${trouvees.length} ligne(s) trouvée(s), rang ${rang} demandé`);
  sec.prises.add(trouvees[rang].n);
  PRODUITS.add(trouvees[rang].texte);
  for (const c of trouvees[rang].brut.split('\t')) PRODUITS.add(propre(c));
  return trouvees[rang];
}

/** Traite les trous d'un texte (une ligne, ou une cellule) : `[fragment, par, genre]`, dans l'ordre. */
function traiter(trace, n, texte, ...remplacements) {
  let t = texte;
  for (const [fragment, par, genre] of remplacements) {
    const cherche = droite(propre(fragment));
    const i = droite(t).indexOf(cherche);
    if (i < 0) throw new Error(`ligne ${n} : fragment « ${fragment} » absent de « ${t} »`);
    const f = t.slice(i, i + cherche.length);
    const erreur = (m) => { throw new Error(`ligne ${n} : ${m} (« ${f} » → « ${par} »)`); };
    if (genre === 'choix' && !droite(f).includes(droite(par))) erreur('le choix n’est pas une rédaction du modèle');
    if (genre === 'jeton') {
      // Autour des jetons : de la ponctuation, des mots pris dans le trou, ou l'unité du nombre (« {{B07-DU-03}} mois »).
      const mots = par.replace(/\{\{[^{}]+}}/g, ' ').split(/[^\p{L}\p{N}]+/u).map(reduire).filter(Boolean);
      const intrus = mots.filter((w) => !reduire(f).includes(w) && !UNITES.includes(w));
      if (!/\{\{[^{}]+}}/.test(par) || intrus.length) erreur(`pas un jeton${intrus.length ? ` (mots étrangers au trou : ${intrus.join(', ')})` : ''}`);
    }
    if (genre === 'retire' && par !== '') erreur('un retrait ne remplace rien');
    if (genre === 'typo' && reduire(f) !== reduire(par)) erreur('une coquille ne change pas le texte');
    if (!['jeton', 'choix', 'retire', 'typo'].includes(genre)) erreur(`genre inconnu « ${genre} »`);
    trace.push({ ligne: n, genre, source: f, par });
    t = t.slice(0, i) + par + t.slice(i + f.length);
  }
  // Ce qu'un retrait laisse : une espace avant la ponctuation, deux-points orphelins en fin de phrase.
  const final = propre(t.replace(/\s+([.,;)])/g, '$1').replace(/\(\s+/g, '('));
  PRODUITS.add(final);
  return final;
}

/** Déclare des lignes retirées du document final, avec leur raison (instruction, exemple, sommaire, bandeau, « OU »). */
function retirer(sec, raison, ...motifs) {
  for (const m of motifs) {
    const trouvees = sec.lignes.filter((l) => !sec.prises.has(l.n) && !sec.retirees.has(l.n) && (typeof m === 'function' ? m(l) : correspond(l, m)));
    if (!trouvees.length) throw new Error(`retrait « ${m} » : aucune ligne`);
    for (const l of trouvees) { sec.retirees.add(l.n); sec.retraits.push({ ligne: l.n, texte: l.texte, raison }); }
  }
}

/** Aucune ligne de la source n'est perdue en silence. */
function toutEstRendu(sec, sigle) {
  const oubliees = sec.lignes.filter((l) => !sec.prises.has(l.n) && !sec.retirees.has(l.n));
  if (oubliees.length) throw new Error(`${sigle} : ${oubliees.length} ligne(s) de la source ni reprise(s) ni retirée(s) :\n` + oubliees.map((l) => `   ${l.n}: ${l.texte.slice(0, 110)}`).join('\n'));
}

const P = (texte) => ({ type: 'para', texte });
const ST = (texte) => ({ type: 'sous_titre', texte });
const C = (texte) => ({ type: 'centre', texte });
const T = (n) => ({ type: 'table', texte: String(n) });
const L = (...cellules) => ({ type: 'ligne', texte: cellules.join(US) });
const FIN = { type: 'fin_table', texte: '' };
/** Une section conditionnelle : ses blocs n'apparaissent que si la condition déclarée est vraie. */
const SI = (nom, ...blocs) => [P(`{{SI:${nom}}}`), ...blocs.flat(), P(`{{FINSI:${nom}}}`)];

// ══ DPAC du contrat-cadre ══════════════════════════════════════════════════════════════════════
// Source : « Document type Contrat-cadre — Fournitures & Prestations de services » (ARMP, 2019), partie
// « DONNEES PARTICULIERES D'APPEL A CONCURRENCE » (le règlement de la consultation), jusqu'à l'acte d'engagement.
function dpacContratCadre() {
  const SRC = lireSource('contrat-cadre');
  const d = sectionDe(SRC, 'DONNEES PARTICULIERES D', "ACTE D'ENGAGEMENT ET CAHIER");
  const tr = [];
  /** Une ligne, ses trous traités. */
  const x = (motif, ...r) => { const l = ligne(d, motif); return traiter(tr, l.n, l.texte, ...r); };
  const xr = (motif, rang, ...r) => { const l = ligne(d, motif, rang); return traiter(tr, l.n, l.texte, ...r); };

  // D'abord ce qui ne s'imprime pas : le sommaire (numéros de page, perdus au rendu), les bandeaux de couverture,
  // les instructions et les exemples. Ils sont écartés AVANT la lecture, pour ne pas être pris pour les titres
  // qu'ils répètent (« Objet du contrat-cadre 3 »).
  retirer(d, 'sommaire : ses numéros de page ne valent que pour le document type', '=Table des matières', (l) => /\t\s*\d+\s*$/.test(l.brut));
  retirer(d, 'bandeau de couverture du document type', '=Contrat-cadre');
  retirer(d, 'alternative : seule la rédaction retenue est imprimée', '=OU');
  retirer(d, 'exemples du modèle, à supprimer du document finalisé', '(Par exemple', '- Le cadre type', '- Le détail estimatif');
  retirer(d, 'instruction à l’acheteur', '<Choisir entre les deux options', 'Option 1', 'Option 2', 'Dans ce cas');
  retirer(d, 'exemple de critères d’élimination du modèle (remplacé par la saisie B06-SC-02)', '- Candidats n', '- Candidats dont', '- etc');
  retirer(d, 'instruction à l’acheteur', 'Ici, la rédaction est laissée');
  retirer(d, 'exemple de critères d’attribution du modèle, « donné à titre purement indicatif » (remplacé par la saisie B06-CA-01)',
    '<La rédaction est libre', 'Critère 1', 'Critère 2', 'La façon de travailler', 'La proposition de prix de référence', "L'offre ayant obtenu la note N");

  const conditions = {
    MONO: 'attributaires = MONO',
    MULTI: 'attributaires = MULTI',
    'RC-BESOIN': 'B02-PC-02 = Au fur et à mesure des besoins',
    'RC-CALENDRIER': 'B02-PC-02 = Selon le calendrier fixé ci-après',
    'PRIX-UNITAIRES': 'typePrix = UNITAIRES',
    'PRIX-FORFAITAIRE': 'typePrix = FORFAITAIRE',
    RECONDUCTIBLE: 'B02-DC-03 = OUI',
    'NON-RECONDUCTIBLE': 'B02-DC-03 = NON',
    ALLOTI: 'alloti = OUI',
    'NON-ALLOTI': 'alloti = NON',
    PAPIER: 'modeRemise = PAPIER',
    'B04-SE': 'modeRemise = ELECTRONIQUE',
    DEVISE: 'B05-UM-01 renseigne',
    'SANS-DEVISE': 'B05-UM-01 vide',
  };

  // Titres d'article : « ARTICLE n : » est une numérotation automatique de Word (le sommaire la montre), perdue à la
  // lecture — rendue dans le texte et déclarée en AJOUT, comme les labels « (a) » d'A1. Idem l'appel de note « (1) ».
  const art = (n, motif, rang = 0) => ST(`ARTICLE ${n} : ${ligne(d, motif, rang).texte}`);
  const ajouts = Array.from({ length: 12 }, (_, i) => `ARTICLE ${i + 1} : `);
  ajouts.push('(1) ');

  // Remise électronique : les conditions de transmission ne sont écrites nulle part dans le modèle (« <préciser les
  // modalités …> ») ; comme pour C1 / C2 (27/09), la clause ne s'invente pas — elle est demandée au juriste, visible.
  const CLAUSE_SE = '[[CLAUSE À FOURNIR PAR LE JURISTE : conditions de la transmission électronique — plateforme ({{B04-SE-02}}), heure de référence ({{B04-SE-04}}), signature exigée ({{B04-SE-05}}), formats ({{B04-SE-07}}) et tailles admis ({{B04-SE-08}} Mo par fichier, {{B04-SE-09}} Mo par offre), assistance ({{B04-SE-14}}), indisponibilité et prorogation ({{B04-SE-12}} h, {{B04-SE-13}} jours ouvrables)]]';
  ajouts.push(CLAUSE_SE);

  // La page de garde : une cellule de Word porte deux mentions (« MARCHE DE : … NUMÉRO : … »), rendues en deux paragraphes.
  const garde = x('MARCHE DE', ['<Préciser la nature du marché>', '{{B01-AC-12}}', 'jeton'], ["<indiquer le numéro de l'appel d'offres ou de la consultation(1)>", '{{B02-OE-01}}', 'jeton']);
  const coupe = garde.indexOf('NUM');
  PRODUITS.add(propre(garde.slice(0, coupe))).add(propre(garde.slice(coupe)));

  // Le calendrier de l'article 2 : un tableau « Date estimative | Etape », une ligne par étape propre au contrat-cadre.
  const entete = ligne(d, 'Date estimative').brut.split('\t').map(propre);
  const etape = (rang, jeton) => {
    const l = ligne(d, '<préciser la date>', rang);
    const [date, libelle] = l.brut.split('\t').map(propre);
    return L(traiter(tr, l.n, date, ['<préciser la date>', jeton, 'jeton']), libelle);
  };

  // Le choix « au fur et à mesure / selon le calendrier » (art. 1) : le modèle n'a pas refermé son chevron.
  const RC1 = '<choisir entre les deux rédactions suivantes : « au fur et à mesure des besoins » / « selon le calendrier fixé ci-après »';
  const RC9 = "<choisir entre les deux rédactions suivantes : « lors de la survenance du besoin » / « selon le calendrier fixé à l'article premier du présent contrat-cadre>";
  const DEVISE = "<en cas d'appel d'offres international, préciser la monnaie en devise>";
  const MONO = '<préciser si le contrat-cadre est attribué à un seul titulaire (mono-attributaire) ou à plusieurs titulaires (multi attributaire)>';
  const procedure = [['<préciser la procédure de passation choisie>', '{{B01-AC-13}}', 'jeton'], ["<préciser la référence de l'article du code se rapportant à la procédure choisie>", '{{B02-PC-01}}', 'jeton']];

  const blocs = [
    // ── Page de garde
    C(x("<Insérer l'En-tête de l'Acheteur>", ["<Insérer l'En-tête de l'Acheteur>", '{{B01-AC-01}}', 'jeton'])),
    P(propre(garde.slice(0, coupe))),
    P(propre(garde.slice(coupe))),
    P(x('OBJET DU CONTRAT-CADRE', ["<Préciser l'objet du Contrat-cadre>", '{{B02-OB-01}}', 'jeton'])),
    C(x('REGLEMENT DE LA CONSULTATION')),
    P(x('PROCEDURE DE CONSULTATION', ['<Préciser la procédure de mise en concurrence adoptée>', '{{B01-AC-13}}', 'jeton'])),
    P(x('REPRESENTANT', ['<indiquer le nom et le(s) prénom(s) de la PRMP>', '{{B01-AC-05}}', 'jeton'])),
    P(x('DATE ET HEURE LIMITES DE REMISE', ["<préciser la date et l'heure limite de remise des offres>", '{{B04-CP-02}}', 'jeton'])),

    // ── Article 1
    art(1, 'OBJET ET ETENDUE DU CONTRAT-CADRE'),
    ST(x('Objet du contrat-cadre')),
    P(x('Le présent contrat-cadre a pour objet')),
    P(x('Il porte sur', ["<détailler l'objet de la prestation>", '{{B02-OB-01}}', 'jeton'], ['.Les détails', '. Les détails', 'typo'])),
    ST(x('Procédure de mise en concurrence')),
    ...SI('MONO', P(x('La présente consultation', [MONO, 'un seul titulaire (mono-attributaire)', 'choix'], ...procedure))),
    ...SI('MULTI', P(x('La présente consultation', [MONO, 'plusieurs titulaires (multi attributaire)', 'choix'], ...procedure))),
    ...SI('RC-BESOIN', P(x('Les attributaires issus', [RC1, 'au fur et à mesure des besoins', 'choix']))),
    ...SI('RC-CALENDRIER',
      P(x('Les attributaires issus', [RC1, 'selon le calendrier fixé ci-après', 'choix'])),
      P(x('<établir à cet emplacement le calendrier', ['<établir à cet emplacement le calendrier escompté pour la remise en concurrence des titulaires du contrat-cadre>', '{{B02-PC-03}}', 'jeton']))),
    P(x('Les marchés subséquents issus')),

    // ── Article 2
    art(2, 'DISPOSITIONS GENERALES'),
    ST(x('Forme du contrat')),
    ...SI('PRIX-UNITAIRES', P(x('Le contrat-cadre est conclu à', ['<préciser la forme de prix : prix unitaires ou prix forfaitaires>', 'prix unitaires', 'choix']))),
    ...SI('PRIX-FORFAITAIRE', P(x('Le contrat-cadre est conclu à', ['<préciser la forme de prix : prix unitaires ou prix forfaitaires>', 'prix forfaitaires', 'choix']))),
    ST(x('Montant du contrat')),
    P(x('Le montant du Contrat', ['<indiquer le montant indicatif du contrat-cadre>', '{{B05-MT-01.chiffres}}', 'jeton'])),
    ST(x('Durée du contrat')),
    P(x('La durée de validité du Contrat', ['<préciser la durée maximale du contrat>', '{{B02-DC-01}}', 'jeton'], ['<préciser la durée de validité du contrat>', '{{B02-DC-02}}', 'jeton'])),
    ...SI('RECONDUCTIBLE', P(x('Cette période de validité peut être reconduite',
      ['<préciser les conditions de reconduction de la période de validité>', '{{B02-DC-04}}', 'jeton'],
      ["(par exemple : annuellement, 2 fois pour une durée complémentaire de 12 mois dans la limite d'une durée maximale de 36 mois à compter de la date de notification)", '', 'retire']))),
    ...SI('NON-RECONDUCTIBLE', P(x('La période de validité du contrat n'))),
    ST(x('Allotissement')),
    ...SI('ALLOTI', P(x("Préciser les modalités d'allotissement", ["Préciser les modalités d'allotissement", '{{B02-AL-02}}', 'jeton']))),
    ...SI('NON-ALLOTI', P(x('Sans objet', ['(si le contrat ne prévoit pas de lot)', '', 'retire']))),
    ST(x('Calendrier prévisionnel de la consultation')),
    T(2),
    L(...entete),
    etape(0, '{{B04-CP-02}}'),
    etape(1, '{{B04-CP-06}}'),
    etape(2, '{{B04-CP-07}}'),
    etape(3, '{{B04-CP-08}}'),
    FIN,
    P(x('La date prévisionnelle de notification', ['<indiquer la date>', '{{B04-CP-05}}', 'jeton'])),

    // ── Article 3
    art(3, 'DOSSIER DE CONSULTATION (1)'),
    ST(x('3.1.Contenu du dossier')),
    P(x('Le dossier de consultation(1) contient')),
    P(x("-L'avis d'appel public")),
    P(x('-Le présent Règlement')),
    P(x('- La lettre de soumission')),
    P(x('-Le projet de contrat-cadre')),
    P(x("les actes d'engagement")),
    P(x('le cahier des clauses administratives particulières')),
    P(x('le document portant clauses techniques')),
    P(x('<autres à ajouter éventuellement>', ['<autres à ajouter éventuellement>', '{{B04-DS-01}}', 'jeton'])),
    ST(x('3.2.Langue de rédaction')),
    P(x('Le Dossier complet, rédigé en langue française')),
    // Le modèle ne met pas de trou derrière ces trois libellés : l'adresse de consultation est demandée au backend
    // (B04-DS-07 à 09, demande du 28/09) ; tant qu'elle manque, le moteur imprime des pointillés.
    P(x('Nom du Responsable', [':', ': {{B04-DS-07}}', 'jeton'])),
    P(x('Fonction', [':', ': {{B04-DS-08}}', 'jeton'])),
    P(x('Bureau, N° porte', [':', ': {{B04-DS-09}}', 'jeton'])),
    P(x('Localité', ['<préciser autant que possible avec des détails fins, tels que lot ou numéro de l’immeuble, nom de rue, quartier, ville>', '{{B04-DS-10}}', 'jeton'])),
    ST(x('3. 3.Modalités')),
    P(x('Pour tout candidat désirant soumissionner', ["<indiquer l'adresse>", '{{B04-DS-04}}', 'jeton'],
      ['<indiquer en lettres et en chiffres le montant à payer en Ariary ou son équivalent en monnaie librement convertible>', '{{B04-DS-05.lettres}} ({{B04-DS-05}})', 'jeton'])),
    ST(x('3.4.Modification')),
    P(x("L'Autorité contractante se réserve")),
    P(x('Si la date limite de réception des offres est reportée')),

    // ── Article 4
    art(4, 'PRESENTATION DES OFFRES'),
    P(x('Les soumissionnaires remettent')),
    ST(x('4.1.Pièces constitutives')),
    P(x('<énumérer les pièces de candidatures', ['<énumérer les pièces de candidatures requises par le contrat>', '{{B04-PO-01}}', 'jeton'])),
    ST(x('4.2.Pièces constitutives')),
    P(x("<énumérer les pièces devant constituer", ["<énumérer les pièces devant constituer l'offre du candidat>", '{{B04-PO-02}}', 'jeton'])),

    // ── Article 5
    art(5, 'MODALITES DE REMISE DES OFFRES'),
    ST(x('5.1 - Transmission sous support papier')),
    P(x('<Préciser les modalités de remise des offres>', ['<Préciser les modalités de remise des offres>', '{{B04-RQ-01}}', 'jeton'])),
    P(x('Les candidats transmettent leur offre')),
    P(x('Offre pour', ["< indiquer l'objet du contrat-cadre>", '{{B04-RQ-02}}', 'jeton'])),
    C(x('NE PAS OUVRIR')),
    P(x('Ce pli doit contenir', ["<indiquer l'adresse exacte et précise>", '{{B04-RQ-03}}', 'jeton'])),
    P(x('Les plis qui seraient remis')),
    ST(x('5.2 - Transmission électronique')),
    ...SI('PAPIER', P(x('La transmission de dossiers par voie électronique'))),
    ...SI('B04-SE',
      P(x('La transmission par voie électronique est admise', ["<préciser les modalités d'envoi des dossiers par voie électronique>", '', 'retire'])),
      P(CLAUSE_SE),
      P(x('<Même si', ['<Même si', 'Même si', 'choix'], ['sous forme papier.>', 'sous forme papier.', 'choix']))),

    // ── Article 6
    art(6, 'EXAMEN DES CANDIDATURES ET DES OFFRES'),
    ST(x('6.1 - Sélection des candidatures')),
    P(x('6.1.1.')),
    P(x("La séance d'ouverture des plis")),
    P(x("Avant de procéder à l'examen")),
    P(x('Les candidatures conformes')),
    ST(x('6.1.2.')),
    P(x('<énumérer ici les critères', ["<énumérer ici les critères d'élimination des candidats (ils doivent être objectifs, réalistes et en rapport avec l'objet du marché), par exemple :", '{{B06-SC-02}}', 'jeton'])),
    ST(x('6.2. La procédure de sélection')),
    P(x('La procédure de sélection des offres se déroule')),
    ST(x('1. Rejet des offres hors-délais')),
    P(x("Le représentant de l'autorité contractante écarte")),
    ST(x('2. Analyse des offres')),
    P(x("Le comité d'évaluation procède")),
    ST(x('3. Rejet des offres non recevables')),
    P(x("Le comité d'évaluation rejette")),
    ST(x('4. Comparaison des offres')),
    P(x('<préciser les critères et le', ['<préciser les critères et le mécanisme de jugement des offres>', '{{B06-SO-05}}', 'jeton'])),

    // ── Article 7
    art(7, "CRITÈRES D'ATTRIBUTION DU CONTRAT-CADRE"),
    P(x('<énumérer les critères que', ["<énumérer les critères que l'Autorité contractante a retenu pour l'attribution du contrat-cadre ainsi que les modalités d'appréciation>", '{{B06-CA-01}}', 'jeton'])),
    P(x("L'Autorité contractante peut ne pas donner suite")),

    // ── Article 8
    art(8, 'LANGUE DE LA CONSULTATION (1)'),
    ...SI('SANS-DEVISE', P(x("L'offre des candidats ainsi que", [`(ou en ${DEVISE})`, '', 'retire'], [`(ou en ${DEVISE})`, '', 'retire']))),
    ...SI('DEVISE', P(x("L'offre des candidats ainsi que", [DEVISE, '{{B05-UM-01}}', 'jeton'], [DEVISE, '{{B05-UM-01}}', 'jeton']))),

    // ── Article 9
    art(9, 'PASSATION DES MARCHÉS SUBSÉQUENTS'),
    ...SI('RC-BESOIN', P(x('Pendant la durée du contrat-cadre, les marchés subséquents', [RC9, 'lors de la survenance du besoin', 'choix']))),
    ...SI('RC-CALENDRIER', P(x('Pendant la durée du contrat-cadre, les marchés subséquents', [RC9, "selon le calendrier fixé à l'article premier du présent contrat-cadre", 'choix']))),
    P(x('La mise en compétition des titulaires', ["<indiquer l'adresse précise et exacte>", '{{B07-PS-02}}', 'jeton'], ['<préciser le délai en heure>', '{{B07-PS-03}}', 'jeton'])),
    P(x('A défaut, le titulaire')),
    P(x('La demande de devis ou de facture pro-forma précisera')),
    P(x('La nature et la quantité du besoin')),
    P(x("L'adresse du site de livraison")),
    P(x('Le(s) critère(s) pondéré(s)')),
    P(x('Le cas échéant')),
    P(x('Critère(s) pondéré(s) de jugement')),
    P(x('Le devis ou la facture pro-forma précisera')),
    P(x('La référence du chaque produit')),
    P(x('Le type de matériel')),
    P(x('Les quantités')),
    P(x('Le prix unitaire et le prix total')),
    P(x('Le montant total remisé')),
    P(x('Le montant TTC')),
    P(x('Le devis ou la facture pro-forma devra répondre')),

    // ── Articles 10 à 12
    art(10, 'AUTRES RENSEIGNEMENTS'),
    P(x("Toute demande d'informations", ["<indiquer l'adresse exacte et précise de la personne à qui on devra adresser les demandes d'informations>", '{{B04-RC-01}}', 'jeton'], ['<préciser le nombre de jours>', '{{B04-RC-02}}', 'jeton'])),
    P(x('Si une question est posée')),
    art(11, 'VOIES ET DÉLAIS DE RECOURS'),
    P(x("L'instance chargée des procédures de recours", ['<indiquer la juridiction compétente pour trancher les litiges nés du présent contrat-cadre>', '{{B06-AN-03}}', 'jeton'])),
    art(12, 'CALENDRIER PRÉVISIONNEL'),
    P(x('Avis Spécifique', ['<indiquer la date de lancement de la mise en concurrence>', '{{B04-CP-01}}', 'jeton'])),
    P(x('Date et heure limites de réception', ["<indiquer la date et l'heure limites de remise des offres>", '{{B04-CP-02}}', 'jeton'])),
    P(x("Séance de la Commission", ["<indiquer la date de début de la séance d'évaluation des offres et candidatures>", '{{B04-CP-03}}', 'jeton'])),
    P(x('Attribution du contrat-cadre', ["<indiquer la date d'attribution du contrat-cadre>", '{{B04-CP-04}}', 'jeton'])),
    P(x('Notification du contrat-cadre', ['<indiquer la date de notification du contrat-cadre au(x) titulaire(s)>', '{{B04-CP-05}}', 'jeton'])),

    // ── La note (1) du modèle, en fin de document
    P('(1) ' + x('Le terme «consultation»')),
    P(x('Ainsi, le présent document est valable')),
  ];
  const titre = ligne(d, 'DONNEES PARTICULIERES D').texte;
  toutEstRendu(d, 'DPAC-CC');
  void xr;
  return { fichier: 'DPAC-CC.docx', sigle: 'DPAC-CC', source: 'contrat-cadre', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ AE du contrat-cadre (« contrat-cadre valant acte d'engagement et CCAP ») ════════════════════
// Même source, partie « ACTE D'ENGAGEMENT ET CAHIER DES CLAUSES ADMINISTRATIVES PARTICULIERES », jusqu'à la lettre
// d'invitation au marché subséquent (qui n'est pas une pièce du DAO : elle naît après l'attribution).
//
// Ce qui RESTE entre chevrons : ce qui se remplit APRÈS le DAO — par le candidat (identification, compte bancaire,
// signature, annexes : renvois (2) à (11) du modèle) ou à la notification (numéro du contrat-cadre, dates de
// notification, mise au point, signature de l'autorité). Comme dans les formulaires du candidat, ces crochets restent.
// Un document par lot quand le contrat-cadre est alloti (« chaque lot faisant l'objet d'un contrat-cadre
// distinct ») : `{{LOT}}` est le numéro du lot du document (demande backend du 28/09).
function aeContratCadre() {
  const SRC = lireSource('contrat-cadre');
  const d = sectionDe(SRC, "ACTE D'ENGAGEMENT ET CAHIER", "LETTRE D'INVITATION POUR");
  const tr = [];
  const x = (motif, ...r) => { const l = ligne(d, motif); return traiter(tr, l.n, l.texte, ...r); };
  const xr = (motif, rang, ...r) => { const l = ligne(d, motif, rang); return traiter(tr, l.n, l.texte, ...r); };

  const MONO = 'attributaires = MONO';
  const MULTI = 'attributaires = MULTI';
  const UNIQUE = 'B07-FS-01 = Marchés uniques non fractionnés';
  const conditions = {
    AOO: 'B01-AC-13 contient ouvert',
    AOR: 'B01-AC-13 contient restreint',
    CONSULTATION: 'B01-AC-13 contient consultation',
    GROUPEMENT: 'groupement = OUI',
    ALLOTI: 'alloti = OUI',
    'NON-ALLOTI': 'alloti = NON',
    'NA-MONO': `alloti = NON et ${MONO}`,
    'NA-MULTI': `alloti = NON et ${MULTI}`,
    'A-MONO': `alloti = OUI et ${MONO}`,
    'A-MULTI': `alloti = OUI et ${MULTI}`,
    'FS-UNIQUE': UNIQUE,
    'FS-FRACTIONNE': 'B07-FS-01 = Marchés fractionnés par bons de commande successifs',
    MONO,
    MULTI,
    'COMPLETUDE-DELAI': `${MONO} et B07-MA-02 = À compter de la notification de la demande de complétude`,
    'COMPLETUDE-DEMANDE': `${MONO} et B07-MA-02 = Lors de la demande de complétude`,
    'MULTI-NON-ALLOTI': `${MULTI} et alloti = NON`,
    'LOTS-CORRESPONDANTS': `${MULTI} et alloti = OUI et B07-MA-04 = Titulaires des lots correspondant à l'objet du marché`,
    'LOTS-TOUS': `${MULTI} et alloti = OUI et B07-MA-04 = Titulaires de tous les lots`,
    'RC-BESOIN': `${MULTI} et B02-PC-02 = Au fur et à mesure des besoins`,
    'RC-CALENDRIER': `${MULTI} et B02-PC-02 = Selon le calendrier fixé ci-après`,
    'DUREE-FIXEE': 'B07-DU-02 = OUI',
    'DUREE-LIBRE': 'B07-DU-02 = NON',
    RECONDUCTIBLE: 'B02-DC-03 = OUI',
    'NON-RECONDUCTIBLE': 'B02-DC-03 = NON',
    'DELAI-AC': `${UNIQUE} et B07-DE-01 = Fixés par l'autorité contractante`,
    'DELAI-CANDIDATS': `${UNIQUE} et B07-DE-01 = À l'initiative des candidats`,
    'DELAI-SUBSEQUENTS': `${UNIQUE} et B07-DE-01 = Fixés dans les marchés subséquents`,
    'PENALITES-NON': 'B07-PE-01 = Non applicables',
    'PENALITES-CCAG': "B07-PE-01 = Fixées dans le contrat-cadre et B07-PE-02 = Conformément à l'article 12 du CCAG",
    'PENALITES-DEROGATION': 'B07-PE-01 = Fixées dans le contrat-cadre et B07-PE-02 = Dérogation au CCAG',
    'PENALITES-SUBSEQUENTS': 'B07-PE-01 = Fixées dans les marchés subséquents',
    // Prix (art. 9) : mono-attributaire, prix unitaires / forfaitaires / mixtes (« reprendre les choix 1.1 et 1.2 ») ;
    // bordereau ou catalogue selon B05-PM-05 (« catalogue joint »).
    'MONO-PU-BORDEREAU': `${MONO} et B05-PM-01 = Prix unitaires et B05-PM-05 != OUI ou ${MONO} et B05-PM-01 = Prix mixtes et B05-PM-05 != OUI`,
    'MONO-PU-CATALOGUE': `${MONO} et B05-PM-01 = Prix unitaires et B05-PM-05 = OUI ou ${MONO} et B05-PM-01 = Prix mixtes et B05-PM-05 = OUI`,
    'MONO-PF': `${MONO} et B05-PM-01 = Prix forfaitaires ou ${MONO} et B05-PM-01 = Prix mixtes`,
    'MULTI-REFERENCEMENT-BORDEREAU': `${MULTI} et B05-PM-02 = NON et B05-PM-05 != OUI`,
    'MULTI-REFERENCEMENT-CATALOGUE': `${MULTI} et B05-PM-02 = NON et B05-PM-05 = OUI`,
    'MULTI-PRIX-BORDEREAU': `${MULTI} et B05-PM-02 = OUI et B05-PM-05 != OUI`,
    'MULTI-PRIX-CATALOGUE': `${MULTI} et B05-PM-02 = OUI et B05-PM-05 = OUI`,
    AVANCE: 'avance = OUI',
    'AVANCE-SOUS-TRAITANT': 'B08-FI-05 = OUI',
    'EXECUTION-COMMUNE': 'B09-EA-01 = OUI',
    'EXECUTION-SANS': 'B09-EA-01 = NON',
    'VERIFICATION-CCAG': 'B09-VA-01 = Dispositions du CCAG applicables',
    'VERIFICATION-LIBRE': 'B09-VA-01 = Clause libre',
    'GARANTIE-NON': 'B09-GP-01 = NON',
    'GARANTIE-OUI': 'B09-GP-01 = OUI',
    'GARANTIE-ADMISSION': "B09-GP-01 = OUI et B09-GP-04 = À partir de l'admission",
    'GARANTIE-MISE-EN-SERVICE': 'B09-GP-01 = OUI et B09-GP-04 = À partir de la date de mise en service',
    'GARANTIE-CCAG': 'B09-GP-01 = OUI et B09-GP-05 = OUI',
    'ASSURANCE-NON': 'B09-AU-01 = NON',
    'ASSURANCE-OUI': 'B09-AU-01 = OUI',
    'PRIX-CRITERE': `${MONO} ou B05-PM-02 = OUI`,
  };

  // Les rédactions « au choix » de la partie 7.4 (deux options chacune : à compter de la notification ou de l'ordre
  // de service) sont écrites par la PRMP d'un bloc dans B07-DE-02 / B07-DE-03 ; la dérogation au CCAG des pénalités
  // (« rédiger librement la rubrique ») dans B07-PE-03. Ce sont des paragraphes ajoutés, faits d'un seul jeton.
  const ajouts = ['{{B07-DE-02}}', '{{B07-DE-03}}', '{{B07-PE-03}}'];

  const cataloguePU = (catalogue) => ['bordereau de prix unitaires/ catalogue (choisir)', catalogue ? 'catalogue' : 'bordereau de prix unitaires', 'choix'];
  const X = ['X %', '{{B05-PM-04.chiffres}} %', 'jeton'];
  const aRemplir = ['(à remplir par le candidat si ce pourcentage est un critère et rédiger le règlement de la consultation en conséquence)', '', 'retire'];
  const prix21 = (catalogue) => x('Choix 2.1 : le prix', ["Choix 2.1 : le prix n'est pas un critère d'attribution de le contrat-cadre (le contrat-cadre est alors un référencement de candidats – les critères d'attribution du contrat-cadre sont des critères de capacité et des critères qualitatifs)", '', 'retire'],
    ['au bordereau de prix unitaires/dans le catalogue (choisir)', catalogue ? 'dans le catalogue' : 'au bordereau de prix unitaires', 'choix']);
  const prix22 = (catalogue) => x('Choix 2.2 : le prix', ["Choix 2.2 : le prix est un critère pour l'attribution du contrat-cadre", '', 'retire'],
    ['dans le bordereau de prix unitaires/ dans le catalogue (choisir)', catalogue ? 'dans le catalogue' : 'dans le bordereau de prix unitaires', 'choix'],
    ['dans le bordereau de prix unitaires complémentaires/ dans le nouveau catalogue fournisseur (choisir)', catalogue ? 'dans le nouveau catalogue fournisseur' : 'dans le bordereau de prix unitaires complémentaires', 'choix']);
  const garantie = (admission) => x('Le délai de garantie', ['X mois/ année', '{{B09-GP-03}} mois', 'jeton'],
    ...(admission ? [['/ de la date de mise en service <choisir>', '', 'retire']] : [["l'admission/ de ", '', 'retire'], ['<choisir>', '', 'retire']]));
  const lotOuUnique = "UNIQUE/ LOT n°____ (choisir entre contrat-cadre unique ou alloti, dans ce dernier cas préciser le numéro du lot)";
  const groupe = (rang) => [
    P(xr('Dénomination sociale', rang)), P(xr('Ayant son siège social', rang)), P(xr('Ayant pour num', rang)),
  ];

  const blocs = [
    // ── Page de garde
    C(x("<insérer l'en-tête de l'Acheteur>", ["<insérer l'en-tête de l'Acheteur>", '{{B01-AC-01}}', 'jeton'])),
    C(x('INTITULE DU CONTRAT-CADRE', ['INTITULE DU CONTRAT-CADRE', '{{B02-OB-01}}', 'jeton'])),
    ...SI('NON-ALLOTI', C(x('CONTRAT-CADRE Valant', [lotOuUnique, 'UNIQUE', 'choix']))),
    ...SI('ALLOTI', C(x('CONTRAT-CADRE Valant', ['UNIQUE/ ', '', 'retire'], ['____', '{{LOT}}', 'jeton'], ['(choisir entre contrat-cadre unique ou alloti, dans ce dernier cas préciser le numéro du lot)', '', 'retire']))),
    C(x('Code des marchés publics')),
    P(xr('Cadre réservé', 0)),
    P(xr('Cadre réservé', 1)),
    P(x('Ce document comporte')),

    // ── Préambule
    ST(x('PREAMBULE')),
    P(x('Personne Publique contractante', ["<indiquer le nom et l'adresse exacte et complète>", '{{B01-AC-01}}, {{B01-AC-02}}', 'jeton'])),
    P(x('Personne habilitée', ['<indiquer le nom>, par délégation du <à compléter> (décision de la délégation en date du <préciser la date>)', '{{B02-SG-04}}', 'jeton'])),
    P(x('Personne responsable des marchés passés', ['Nom, par délégation du <à compléter> (décision de la délégation en date du <préciser la date>)', '{{B02-SG-01}} ({{B02-SG-02}})', 'jeton'])),
    P(x('Procédure de passation du contrat-cadre')),
    ...SI('AOO', P(x("Soit, Appel d'offres ouvert", ['Soit, ', '', 'retire']))),
    ...SI('AOR', P(x("Soit, Appel d'offres restreint", ['Soit, ', '', 'retire']))),
    ...SI('CONSULTATION', P(x("Soit, Consultation d'entreprises", ['Soit, ', '', 'retire']))),

    // ── Article 1 — Contractants : l'autorité, puis le titulaire, que le CANDIDAT identifie (crochets conservés)
    ST(x('ARTICLE 1er')),
    P(x('Le contrat-cadre est conclu entre')),
    P(x("- D'une part", ["<préciser le nom de l'autorité contractante>", '{{B01-AC-01}}', 'jeton'])),
    P(x('Représentée par : <insérer', ['<insérer le nom de la PRMP, personne habilité à signer le contrat-cadre>', '{{B01-AC-05}}', 'jeton'],
      ["<désigner la nature et le numéro de l'acte de nomination> du < préciser la date>", '{{B02-SG-03}}', 'jeton'])),
    P(x("– Et d'autre part")),
    P(x('❏ Le co-contractant')),
    ...groupe(0),
    P(xr('=Représentée par :', 0)),
    P(xr('Nom :', 0)),
    P(x('Qualité (4)')),
    P(xr('❏ Représentant légal', 0)),
    P(xr('❏ Ayant reçu pouvoir', 0)),
    ...SI('GROUPEMENT',
      P(x('=OU')),
      P(x("Le groupement d'entrepreneurs")),
      P(x('❏ 1er co-traitant')),
      ...groupe(1),
      P(xr('=Représentée par :', 1)),
      P(xr('Nom :', 1)),
      P(x('Qualité(5)')),
      P(xr('❏ Représentant légal', 1)),
      P(xr('❏ Ayant reçu pouvoir', 1)),
      P(x('En cas de groupement conjoint')),
      P(x('❏2e co-traitant')),
      ...groupe(2),
      P(x('=Représenté par :')),
      P(xr('Nom :', 2)),
      P(x('Qualité (7)')),
      P(xr('❏ Représentant légal', 2)),
      P(xr('❏ Ayant reçu pouvoir', 2))),

    // ── Article 2
    ST(x('ARTICLE 2 –')),
    P(x('Le présent contrat-cadre a pour objet')),
    P(x("L'objet de cet accord", ["<préciser l'objet des marchés qui seront passés et renvoyer les détails de la prestation aux clauses techniques ou spécifications techniques qui définissent le besoin minimal par référence à des performances ou à des exigences fonctionnelles à atteindre>", '{{B02-OB-01}}', 'jeton'])),
    ...SI('NA-MONO', P(x("Le contrat-cadre n'est pas alloti", ['<choisir entre multi-attributaire ou mono-attributaire >', 'mono-attributaire', 'choix']))),
    ...SI('NA-MULTI', P(x("Le contrat-cadre n'est pas alloti", ['<choisir entre multi-attributaire ou mono-attributaire >', 'multi-attributaire', 'choix']))),
    ...SI('A-MONO', P(x('Le contrat-cadre est alloti', ['<choisir entre multi-attributaire ou mono-attributaire >', 'mono-attributaire', 'choix']))),
    ...SI('A-MULTI', P(x('Le contrat-cadre est alloti', ['<choisir entre multi-attributaire ou mono-attributaire >', 'multi-attributaire', 'choix']))),
    ...SI('ALLOTI',
      P(x('Les prestations sont réparties', ['<nombre de lots>', '{{B02-LV-05}}', 'jeton'])),
      P(x('- lot n° 1', ["- lot n° 1 : <préciser le numéro, l'intitulé et l'objet du lot>.", '{{B02-AL-02}}', 'jeton'])),
      P(x('Le présent contrat-cadre est passé pour le lot', ["<préciser le numéro, l'intitulé et l'objet du lot>", '{{LOT}}', 'jeton']))),

    // ── Article 3
    ST(x('ARTICLE 3 –')),
    ...SI('FS-UNIQUE', P(x('Marchés uniques'))),
    ...SI('FS-FRACTIONNE', P(x('Marchés fractionnés'))),
    P(x('Le Service de', ['Le Service de/ la Direction de <indiquer la désignation exacte du Service ou de la Direction ou autres>', '{{B07-FS-02}}', 'jeton'])),
    P(x('Il communiquera')),

    // ── Article 4
    ST(x('ARTICLE 4 –')),
    ...SI('COMPLETUDE-DELAI', P(x('Choix 1.1 : A la survenance', ['Choix 1.1 : ', '', 'retire'], ["<indiquer, en jours, le délai accordé pour compléter éventuellement l'offre initiale>", '{{B07-MA-01}}', 'jeton']))),
    ...SI('COMPLETUDE-DEMANDE', P(x('Choix 1.2 : A la survenance', ['Choix 1.2 : ', '', 'retire']))),
    ...SI('MULTI-NON-ALLOTI', P(xr('Pendant la durée de validité du contrat-cadre', 0))),
    ...SI('LOTS-CORRESPONDANTS', P(x('Option 1 : <si remise', ['Option 1 : <si remise en concurrence lors de la survenance des besoins, adopter la rédaction suivante :>', '', 'retire']))),
    ...SI('LOTS-TOUS', P(xr('Pendant la durée de validité du contrat-cadre', 1))),
    ...SI('RC-BESOIN', P(x('Option 1 : Cette', ['Option 1 : ', '', 'retire']))),
    ...SI('RC-CALENDRIER', P(x('Option 2 : Cette', ['Option 2 : ', '', 'retire'], ["<choisir et compléter - exemple à l'issue d'une période déterminée>", '{{B02-PC-03}}', 'jeton']))),
    ...SI('MULTI',
      P(x('Elle se fera', ['<lister les critères, les sous-critères et leurs pondérations respectives>', '{{B07-MA-06}}', 'jeton'])),
      P(x('Les titulaires du contrat-cadre devront'))),

    // ── Article 5
    ST(x('ARTICLE 5 –')),
    ...SI('MONO', P(xr('Les termes non couverts', 0, ['<lister les différents termes>', '{{B07-TN-01}}', 'jeton']))),
    ...SI('MULTI', P(xr('Les termes non couverts', 1, ['<lister les différents termes>', '{{B07-TN-02}}', 'jeton']))),

    // ── Article 6 — le CCAG des fournitures courantes et services : ce modèle est celui de la catégorie
    ST(x('ARTICLE 6 –')),
    P(x('Les pièces contractuelles')),
    P(x('➢ Pièces particulières')),
    P(x('• Le présent contrat-cadre valant')),
    P(x('• Les marchés conclus')),
    P(x('• Les clauses techniques')),
    P(x('• Le bordereau de prix unitaires portant')),
    P(x('• Le bordereau de prix unitaires complémentaires')),
    P(x('• Le catalogue joint')),
    P(x('• Toutes autres')),
    P(x('➢ Pièces générales')),
    P(x('• Le cahier des clauses administratives générales', ['/marchés de travaux', '', 'retire'], ['<choisir selon le CCAG applicable>', '', 'retire'])),

    // ── Article 7
    ST(x('ARTICLE 7 –')),
    ST(x('7.1')),
    P(x('La durée du contrat-cadre est de', ['<préciser la durée - cette durée ne peut excéder 2 ans>', '{{B02-DC-02}} mois', 'jeton'])),
    P(x('La conclusion des marchés')),
    ST(x('7.2')),
    P(x('Il est précisé que')),
    ...SI('DUREE-FIXEE', P(x('La durée des marchés subséquents', ['<préciser le nombre de jours>', '{{B07-DU-03}}', 'jeton']))),
    ...SI('DUREE-LIBRE', P(x('La durée sera fixée'))),
    ST(x('7.3')),
    ...SI('NON-RECONDUCTIBLE', P(x("Le contrat-cadre n'est pas reconductible"))),
    ...SI('RECONDUCTIBLE',
      P(x('Le contrat-cadre est reconductible', ['<préciser le nombre de fois>', '{{B07-DU-04}}', 'jeton'], ["<préciser le nombre d'années maximum sans pour autant peut excéder X ans>", '{{B07-DU-05}}', 'jeton'])),
      P(x("L'autorité contractante prend par écrit", ['<préciser le nombre de mois>', '{{B07-DU-07}}', 'jeton'])),
      P(x('Le titulaire du contrat-cadre ne peut')),
      P(x('La période de reconduction'))),
    ST(x('7.4')),
    ...SI('DELAI-AC', P('{{B07-DE-02}}')),
    ...SI('DELAI-CANDIDATS', P('{{B07-DE-03}}')),
    ...SI('DELAI-SUBSEQUENTS', P(x("Les délais d'exécution seront"))),
    ...SI('FS-FRACTIONNE', P(x("La durée maximale d'exécution")), P(x('Les bons de commande successifs'))),
    ST(x('7.5')),
    ...SI('PENALITES-NON', P(x('Les pénalités de retard ne'))),
    ...SI('PENALITES-CCAG', P(x("Conformément à l'article 12", ['/ article 20 du CCAG Travaux <choisir et rayer la mention inutile>', '', 'retire']))),
    ...SI('PENALITES-DEROGATION', P('{{B07-PE-03}}')),
    ...SI('PENALITES-SUBSEQUENTS', P(x('Les pénalités de retard seront'))),

    // ── Article 8
    ST(x('ARTICLE 8 –')),
    P(x('Le montant du contrat-cadre', ['<indiquer le montant indicatif en Ariary H.T, et indiquer montant indicatif en Ariary T.T.C>', '{{B05-MT-01}} H.T. et {{B05-MT-02}} T.T.C.', 'jeton'])),

    // ── Article 9
    ST(x('ARTICLE 9 –')),
    ST(x('9.1')),
    ...SI('MONO-PU-BORDEREAU',
      P(x('Les marchés subséquents conclus sur la base du présent accord seront traités', cataloguePU(false))),
      P(x("A chaque complétude de l'offre, l'augmentation des prix", cataloguePU(false), X, aRemplir))),
    ...SI('MONO-PU-CATALOGUE',
      P(x('Les marchés subséquents conclus sur la base du présent accord seront traités', cataloguePU(true))),
      P(x("A chaque complétude de l'offre, l'augmentation des prix", cataloguePU(true), X, aRemplir)),
      P(x('Ajouter si catalogue joint au contrat-cadre', ['Ajouter si catalogue joint au contrat-cadre : ', '', 'retire']))),
    ...SI('MONO-PF',
      P(x("Les prestations faisant l'objet")),
      P(x('– Prix hors T.V.A.')),
      P(x("A chaque complétude de l'offre, l'augmentation de ce montant", X, ['<à remplir par le candidat si ce pourcentage est un critère et rédiger le règlement de la consultation en conséquence>', '', 'retire']))),
    ...SI('MULTI-REFERENCEMENT-BORDEREAU', P(prix21(false))),
    ...SI('MULTI-REFERENCEMENT-CATALOGUE', P(prix21(true)), P(x('Ajouter si catalogue joint aux marchés', ['Ajouter si catalogue joint aux marchés subséquents : ', '', 'retire']))),
    ...SI('MULTI-PRIX-BORDEREAU', P(prix22(false)), P(x('Ajouter si bordereau', ['Ajouter si bordereau de prix unitaires joint à le contrat-cadre : ', '', 'retire'], X,
      ["(à remplir par le candidat si ce pourcentage est un critère d'attribution du contrat-cadre et rédiger le règlement de la consultation en conséquence)", '', 'retire']))),
    ...SI('MULTI-PRIX-CATALOGUE', P(prix22(true)), P(x('Ajouter si catalogue joint au présent', ['Ajouter si catalogue joint au présent contrat-cadre : ', '', 'retire']))),
    ST(x('9.2')),
    P(x('Les prix sont réputés', ['(point à préciser le cas échéant)', '({{B05-PM-03}})', 'jeton'])),
    ST(x('9.3')),
    P(x('Les offres seront établies')),
    P(x('Les prix des marchés sont fermes', ['(a priori la durée des marchés subséquents ne sera pas supérieure à un an).', '', 'retire'])),
    P(x('Si le bon de commande', ["(l'actualisation est facultative pour les fournitures et services courants)", '', 'retire'])),
    P(x('Indice n')),
    P(x('Où Pn')),
    P(x('Po est le prix')),

    // ── Article 10
    ST(x('ARTICLE 10 –')),
    ...SI('AVANCE',
      ST(x('10.1')),
      P(x('Une avance sera accordée au(x)')),
      P(x("L' (es) entreprise(s)")),
      P(x('❏ Souhaite')),
      P(x('❏ Renoncer')),
      ST(x('10.2')),
      P(x("Le règlement de l'avance", ['<fixer, en jours calendaires, le délai de paiement des avances>', '{{B08-FI-02}} jours calendaires', 'jeton'])),
      ST(x('10.3')),
      P(x("Le montant de l'avance", ['<fixer un montant ne dépassant pas 20% du montant TTC du marché subséquent>', '{{B08-AV-02.chiffres}} % du montant TTC du marché subséquent', 'jeton'])),
      ST(x('10.4')),
      P(x('Les modalités de remboursement'))),
    ...SI('AVANCE-SOUS-TRAITANT', ST(x('10.5')), P(x('Une avance sera accordée au sous-traitant'))),

    // ── Article 11
    ST(x('ARTICLE 11 –')),
    ST(x('11.1')),
    P(x('Le titulaire pourra sous-traiter', ["l'article 2.4 du CCAG Travaux/ ", '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire'])),
    P(x('. Les sous-traitants', ['. Les', 'Les', 'typo'])),
    ST(x('11.2')),
    P(x('Le sous-traitant adresse')),

    // ── Article 12
    ST(x('ARTICLE 12 –')),
    ...SI('EXECUTION-COMMUNE', P(x('Ces modalités générales', ["Ces modalités générales d'exécution commune pourront être définies à cet article", '{{B09-EA-02}}', 'jeton']))),
    ...SI('EXECUTION-SANS', P(x('=Sans objet.'))),
    P(x('Dans les deux cas')),

    // ── Article 13 (le modèle écrit « ARTICLE 1 3 »)
    ST(x('ARTICLE 1 3', ['ARTICLE 1 3', 'ARTICLE 13', 'typo'])),
    P(x("La réception est l'acte")),
    ...SI('VERIFICATION-CCAG', P(x('Les opérations de vérification', ['/ ou aux articles 41, 42 et 43 du CCAG Travaux', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
    ...SI('VERIFICATION-LIBRE', P(x('- les dispositions du CCAG', ['- les dispositions du CCAG ne sont pas applicables ou nécessitent une précision', '{{B09-VA-02}}', 'jeton']))),

    // ── Article 14
    ST(x('ARTICLE 14 –')),
    ...SI('GARANTIE-NON', P(x('Aucune garantie'))),
    ...SI('GARANTIE-OUI', P(x('Il est possible de donner', ["Il est possible de donner ici l'objet de la garantie et de renvoyer à un autre document pour la description de sa mise en œuvre (exemple documents à remettre dans les offres se rapportant aux marchés subséquents)", '{{B09-GP-02}}', 'jeton']))),
    ...SI('GARANTIE-ADMISSION', P(garantie(true))),
    ...SI('GARANTIE-MISE-EN-SERVICE', P(garantie(false))),
    ...SI('GARANTIE-CCAG', P(x('Si la garantie est exécutée', ['Si la garantie est exécutée conformément au C.C.A.G.-FCS, ajouter : ', '', 'retire'],
      ["à l'article 44 du CCAG Travaux/ ", '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),

    // ── Article 15
    ST(x('ARTICLE 15 –')),
    P(x('Si la durée ou les délais')),
    ST(x('15.1')),
    P(x('Les prestations qui ont données')),
    P(x('Le règlement des prestations', ["après livraison chaque commande/ à l'issue de chaque phase de réalisation du marché/ autres <choisir ou supprimer>", '{{B08-FP-01}}', 'jeton'])),
    ST(x('15.2')),
    P(x('Les demandes de paiement seront', ['<indiquer le nom et adresse du service responsable de la vérification des demandes de paiement>', '{{B08-FP-02}}', 'jeton'])),
    P(x('Outre les mentions légales')),
    P(x('• Le numéro du marché')),
    P(x('• la date du ou des bons')),
    P(x('• les prestations exécutées')),
    P(x('• le montant H.T.')),
    P(x('• le taux et le montant')),
    ST(x('15.3')),
    P(x('Le délai de paiement est de 75', ['<à préciser, mais ne doit pas être inférieur à UN point>', '{{B08-FP-04.chiffres}}', 'jeton'])),
    ST(x('15.4')),
    P(x('Les sommes dues')),
    P(x('Nom et adresse de la Banque')),
    P(x('Titulaire du compte')),
    P(x('Code banque')),
    P(x('Clé Relevé')),
    P(x('Les avis de virement')),
    P(x("L'autorité contractante se libérera")),
    P(x('En cas de modification des coordonnées', ['<indiquer le nom du service acheteur>', '{{B10-MT-01}}', 'jeton'])),

    // ── Article 16
    ST(x('ARTICLE 16 –')),
    ...SI('ASSURANCE-NON', P(x('Sans objet (ou', ['Sans objet (ou inapplicable)', 'Sans objet', 'choix']))),
    ...SI('ASSURANCE-OUI', P(x('Le(s) titulaire(s)')), P(x("L'attestation devra", ['<indiquer le délai en jours>', '{{B09-AU-03}}', 'jeton']))),

    // ── Article 17
    ST(x('ARTICLE 17 –')),
    ST(x('17.1')),
    P(x('En cas de modification de sa dénomination', ['<indiquer le nom du service acheteur>', '{{B10-MT-01}}', 'jeton'])),
    ST(x('17.2')),
    P(x('Le titulaire doit informer', ['<indiquer le nom du service acheteur>', '{{B10-MT-02}}', 'jeton'])),
    P(x("En cas d'acceptation")),

    // ── Article 18
    ST(x('ARTICLE 18 –')),
    ST(x('18.1')),
    ...SI('NON-RECONDUCTIBLE',
      P(x('La résiliation du contrat-cadre pourra')),
      P(x('– <indiquer', ['<indiquer le nombre de mois>', '{{B10-RS-02}}', 'jeton'], ['<supprimer cette disposition si le contrat-cadre est reconductible>', '', 'retire']))),
    P(x("La résiliation n'ouvrira", ['<disposition à supprimer si le contrat-cadre prévoit un minimum en quantité ou en valeur>', '', 'retire'])),
    ST(x('18.2')),
    P(x('La résiliation pourra être prononcée', ['/ articles 46 du CCAG Travaux', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire'])),
    P(x("L'autorité contractante se réserve le droit de résilier", ['<Lister les différentes hypothèses>', '{{B10-RS-03}}', 'jeton'])),

    // ── Article 19
    ST(x('ARTICLE 19 –')),
    P(x('En cas de litiges', ['<préciser la juridiction à saisir>', '{{B10-VR-01}}', 'jeton'])),

    // ── Article 20 — ce que signe le candidat, puis l'autorité (crochets conservés)
    ST(x('ARTICLE 20 –')),
    ST(x('20.1')),
    P(x('Je, soussigné')),
    P(x("ATTESTE SUR L'HONNEUR, sous peine")),
    P(x("ATTESTE SUR L'HONNEUR QUE le travail")),
    ...SI('PRIX-CRITERE', P(x("L'offre ainsi présentée ne me lie", ['<préciser le délai de validité des offres>', '{{B04-VO-01}}', 'jeton']))),
    P(x("ATTESTE SUR L'HONNEUR QUE j'ai")),
    P(x("M'ENGAGE SANS RESERVE et conformément")),
    P(x("M'ENGAGE SANS RESERVE, conformément")),
    P(x("L'offre ainsi présentée me lie", ["<date qui doit correspondre au lendemain de la fin délai de validité de l'offre>", '{{DERIVE.fin-validite-offre}}', 'jeton'])),
    P(x('Le présent contrat-cadre comporte')),
    P(x('Fait en un seul original')),
    P(xr('Fait à', 0)),
    P(x('Signature du titulaire (11)')),
    P(x('Nom et qualité du signataire')),
    P(x('<insérer le nom, prénom(s)')),
    P(x('=Cachet')),
    P(x('ATTENTION')),
    ST(x('20.2')),
    P(x('Le présent contrat-cadre (12)')),
    P(x("<Cocher l'option choisie>")),
    P(x('❏ A fait')),
    P(x("❏ N'a pas")),
    ST(x('20.3')),
    P(x('Est acceptée')),
    P(xr('Fait à', 1)),
    P(x("Pour l'autorité contractante")),
    P(x('Représenté par : <insérer', ['<insérer les nom et prénom(s) du signataire>', '{{B02-SG-04}}', 'jeton'])),

    // ── Les renvois du modèle
    ST(x('Liste des renvois')),
    ...Array.from({ length: 12 }, (_, i) => P(x(`(${i + 1}) `))),
  ];

  // Ce qui ne s'imprime pas : bandeau, instructions de remplissage, intitulés « Choix n » / « Option n » (seule la
  // rédaction retenue reste), exemples du modèle.
  retirer(d, 'bandeau de couverture du document type', '=Contrat-cadre');
  retirer(d, 'instructions de remplissage du modèle, « à supprimer du contrat finalisé »', 'Instructions de remplissage', '<Choisir une procédure',
    '<Ajouter le paragraphe ci-dessous', 'Les dispositions sont à adapter', "(d'autres cas de pénalités", '< choisir entre les deux options',
    '<Ajouter la phrase suivante si le prix', '<Choisir entre les deux options rédactionnelles');
  retirer(d, 'intitulé de choix ou d’option : seule la rédaction retenue est imprimée', (l) => /^(Choix|Option)\b/.test(l.texte));
  retirer(d, 'coordonnées du service : comprises dans la saisie B07-FS-02', 'Coordonnées du service');
  retirer(d, 'liste des lots : remplacée par la saisie B02-AL-02', '- lot n° 2', '- …');
  retirer(d, 'exemples du modèle', 'Par exemple', 'Exemple :', 'En remplacement des dispositions', '- pour chacun des', '- pour chaque jour', 'Exemple en fournitures');

  const titre = ligne(d, "ACTE D'ENGAGEMENT ET CAHIER").texte;
  toutEstRendu(d, 'AE-CC');
  return { fichier: 'AE-CC.docx', sigle: 'AE-CC', source: 'contrat-cadre', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ DPAO des fournitures (quantité fixe et à commande) ═══════════════════════════════════════════
// Source : « 2-Document type d'appel d'offres_Fournitures_Données Particulières d'Appel d'Offres » (ARMP). Un tableau
// « Clause des IC | Données particulières » : les rédactions au choix sont DANS les cellules. Un seul modèle pour les
// deux formes : ce qui n'appartient qu'à l'une (« 1.2 Marché à commandes », délai de livraison) est conditionné par
// `typeMarche`. Marqueurs à deux niveaux : un paragraphe `{{SI:X}}` dans une cellule, et une LIGNE de tableau
// `{{SI:X}}` qui ouvre ou ferme des rangées entières (demande backend du lot D2).
function dpaoFournitures() {
  const SRC = lireSource('fournitures-dpao');
  const d = sectionCellules(SRC, '1.2. - DONNEES PARTICULIERES', null);
  const tr = [];
  const x = (vue, motif, ...r) => { const u = ligne(vue, motif); return traiter(tr, u.n, u.texte, ...r); };
  const cel = (...ps) => ps.flat().filter((p) => p !== null && p !== undefined).join('\u001E');
  const SIc = (nom, ...ps) => [`{{SI:${nom}}}`, ...ps.flat(), `{{FINSI:${nom}}}`];
  const SIr = (nom, ...lignes) => [L(`{{SI:${nom}}}`, ''), ...lignes.flat(), L(`{{FINSI:${nom}}}`, '')];
  const clause = (vue) => vue.lignes.filter((u) => u.cellule === 0).map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; }).join('\u001E');

  const conditions = {
    PROJET: 'B02-AU-01 renseigne',
    ALLOTI: 'alloti = OUI',
    'LOTS-DIVISIBLES': 'alloti = OUI et B02-AU-02 = Lot par lot (attribution divisible)',
    'LOTS-TOTALITE': 'alloti = OUI et B02-AU-02 = Totalité des lots à un seul attributaire',
    'VARIANTES-NON': 'variantes = NON',
    'VARIANTES-OUI': 'variantes = OUI',
    'VARIANTES-MOINS-DISANTE': "variantes = OUI et B02-VA-01 = Offre de base évaluée la moins-disante",
    'VARIANTES-TOUTES': 'variantes = OUI et B02-VA-01 = Toutes les offres conformes aux spécifications',
    COMMANDE: 'typeMarche = A_COMMANDE',
    'QUANTITE-FIXE': 'typeMarche = QUANTITE_FIXE',
    'QUANTITE-FIXE-ALLOTI': 'typeMarche = QUANTITE_FIXE et alloti = OUI',
    GROUPEMENT: 'groupement = OUI',
    'GROUPEMENT-LIBRE': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    'GROUPEMENT-SOLIDAIRE': 'groupement = OUI et formeGroupement = SOLIDAIRE_OBLIGATOIRE',
    FABRICANT: 'B03-CQ-05 = OUI',
    QUALIFICATIONS: 'B03-CQ-06 renseigne',
    ONG: 'B03-CQ-07 renseigne',
    PREFERENCE: 'B03-CQ-08 = OUI',
    'SANS-PREFERENCE': 'B03-CQ-08 = NON',
    NATIONAL: 'provenance = NATIONAL',
    'NATIONAL-SAISI': 'provenance = NATIONAL et B05-CP-02 renseigne',
    'NATIONAL-TYPE': 'provenance = NATIONAL et B05-CP-02 vide',
    IMPORTEES: 'provenance = IMPORTEES',
    CIP: 'provenance = IMPORTEES et B05-CP-01 = CIP',
    CIF: 'provenance = IMPORTEES et B05-CP-01 = CIF',
    'TRANSPORT-INTERIEUR': 'provenance = IMPORTEES et B05-CP-04 = OUI',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    ARIARY: 'B05-MO-01 = Ariary',
    DEVISE: 'B05-MO-01 contient devise',
    'SANS-GARANTIE': 'garantieSoumission = NON',
    GARANTIE: 'garantieSoumission = OUI',
    CHEQUE: 'garantieSoumission = OUI et B05-GS-02 contient Chèque',
    'GARANTIE-LOTS': 'garantieSoumission = OUI et alloti = OUI',
    'GARANTIE-UNIQUE': 'garantieSoumission = OUI et alloti = NON',
    LANGUE: 'B04-LA-01 = OUI',
    PAPIER: 'modeRemise = PAPIER',
    'B04-SE': 'modeRemise = ELECTRONIQUE',
    'EVALUATION-PAR-LOT': 'alloti = OUI et B06-EO-01 = Par lot',
    'EVALUATION-ENSEMBLE': "alloti = OUI et B06-EO-01 = Sur l'ensemble des lots",
    CRITERES: 'B06-EO-02 renseigne',
    QUANTITES: 'B06-EO-10 renseigne',
  };
  const CLAUSE_SE = '[[CLAUSE À FOURNIR PAR LE JURISTE : conditions et modalités de la remise électronique — plateforme ({{B04-SE-02}}), heure de référence ({{B04-SE-04}}), signature exigée ({{B04-SE-05}}), formats ({{B04-SE-07}}) et tailles admis ({{B04-SE-08}} Mo par fichier, {{B04-SE-09}} Mo par offre), ouverture électronique en séance seulement, assistance ({{B04-SE-14}}), indisponibilité et prorogation ({{B04-SE-12}} h, {{B04-SE-13}} jours ouvrables)]]';
  // Paragraphes faits d'un seul jeton, là où le modèle laisse l'acheteur rédiger un bloc (adresse, critères).
  const ajouts = [CLAUSE_SE, '{{B04-DE-01}}', '{{B06-EO-02}}', '{{B02-LV-02}}'];

  // En tête du document : bandeaux du dossier type, note de rédaction.
  retirer(d, 'note de rédaction du modèle, « à supprimer »', '[note 1]');
  const intro = x(d, 'Les données particulières ci', ['[note:1]', '', 'retire']);
  const entete = rangee(d, 'Clause des Instructions');

  // ── 1. Acheteur et objet
  const r1 = rangee(d, '1. Acheteur');
  const r1s = rangee(d, 'Acheteur', 1);
  const acheteur = cel(
    x(r1s, '=Acheteur'),
    x(r1s, "<insérer la dénomination de l'Autorité Contractante>", ["<insérer la dénomination de l'Autorité Contractante>", '{{B01-AC-01}}', 'jeton']),
    x(r1s, "Objet de l'appel d'offres"),
    SIc('PROJET',
      x(r1s, "Le présent appel d'offres"),
      x(r1s, '<préciser, le cas échéant', ["<préciser, le cas échéant, si le marché fait partie d'un projet ou d'une opération plus vaste>", '{{B02-AU-01}}', 'jeton'])),
    x(r1s, "L'appel d'offres a pour objet"),
    x(r1s, '<décrire le type de fournitures', ['<décrire le type de fournitures à livrer et de services connexes à réaliser>', '{{B02-OB-02}}', 'jeton']),
  );
  retirer(r1s, 'instruction à l’acheteur', '<en cas de décomposition en lots, indiquer si le marché concerne un ou plusieurs lots :>');

  // ── 1.1 Lots et variantes
  const r11 = rangee(d, '1.1 Lots et variantes');
  const lots = cel(SIc('ALLOTI',
    x(r11, '=Lots'),
    x(r11, "L'appel d'offres porte sur les lots suivants", ['<insérer la description du projet global>', '{{B02-OB-01}}', 'jeton']),
    '{{B02-LV-02}}',
    SIc('LOTS-DIVISIBLES', x(r11, 'Chaque lot est indivisible'), x(r11, 'Les candidats peuvent soumissionner')),
    SIc('LOTS-TOTALITE', x(r11, 'Les candidats ne peuvent soumissionner'))));
  retirer(r11, 'formulation pour un DAO portant sur UN lot : le DAO de la fiche porte sur tous les lots de la ligne', 'Le marché porte sur le lot');
  retirer(r11, 'liste des lots : remplacée par la désignation des lots du plan (B02-LV-02)', '<insérer la description du lot>', '=….');
  retirer(r11, 'instruction à l’acheteur', '<en cas de décomposition en lots');
  const r11v = rangee(d, 'Variantes', 1);
  const variantes = cel(
    x(r11v, '=Variantes'),
    SIc('VARIANTES-NON', x(r11v, 'Les variantes ne sont pas')),
    SIc('VARIANTES-OUI', x(r11v, 'Les variantes sont autorisées')),
    SIc('VARIANTES-MOINS-DISANTE', x(r11v, "L'Acheteur ne considèrera")),
    SIc('VARIANTES-TOUTES', x(r11v, "L'Acheteur considérera")));
  retirer(r11v, 'instruction à l’acheteur', '<Insérer l', '<Lorsque les variantes');

  // ── 1.2 Marché à commandes (à commande seulement)
  const r12 = rangee(d, '1.2 Marché à commandes');
  const commande = cel(
    x(r12, "L'appel d'offre porte sur un marché à commande"),
    x(r12, '<insérer la description des fournitures>', ['<insérer la description des fournitures>', '{{B02-OB-02}}', 'jeton']),
    x(r12, 'pour les quantités minimales'),
    x(r12, 'pour une durée de'),
    x(r12, '<insérer la durée', ['<insérer la durée, sans dépasser trois ans>', '{{B02-AU-04}} mois', 'jeton']));
  retirer(r12, 'instruction à l’acheteur', "<s'il s'agit d'un marché à commandes");

  // ── 2. Groupements
  const r2 = rangee(d, '2. Groupements');
  const groupements = cel(
    SIc('GROUPEMENT-LIBRE', x(r2, 'Les groupements entre Candidats soumissionnant pour des lots distincts peuvent')),
    SIc('GROUPEMENT-SOLIDAIRE', x(r2, 'Les groupements entre Candidats soumissionnant pour des lots distincts doivent')));
  retirer(r2, 'instruction à l’acheteur', '< en cas de décomposition');

  // ── 5. Composition, éclaircissements
  const r5 = rangee(d, '5. – Composition');
  const r51 = rangee(d, '5.1Composiition');
  const composition = cel(x(r51, '1.3 :'), x(r51, '- Modèles de garantie'), x(r51, '2.5 :'));
  const r52 = rangee(d, '5.2. Demandes');
  const eclaircissements = cel(
    x(r52, '=Adresse'),
    x(r52, "Afin d'obtenir des éclaircissements"),
    '{{B04-DE-01}}',
    x(r52, "Délai pour l'envoi des demandes"),
    x(r52, '<nombre de jours supérieur', ['<nombre de jours supérieur ou égal à six>', '{{B04-DE-02}}', 'jeton']),
    x(r52, 'Délai pour la réponse'),
    x(r52, '<nombre de jours sus mentionné', ['<nombre de jours sus mentionné diminué du délai de réponse estimé par la PRMP>', '{{B04-DE-03}}', 'jeton']));
  retirer(r52, "adresse de la PRMP : saisie d'un bloc dans B04-DE-01 (nom, rue, bureau, ville, code postal, télécopie, courriel)",
    'Attention de', 'Rue :', 'Etage/numéro', 'Ville :', 'Code postal', 'Numéro de télécopie', 'Adresse électronique');

  // ── 6. Préparation des offres
  const r6 = rangee(d, '6. – Préparation');
  const r62 = rangee(d, '6.2. Contenu des offres');
  const contenu = cel(x(r62, 'Documents ou pièces à remettre'), x(r62, '<énumérer ces documents', ['<énumérer ces documents ou pièces>', '{{B04-CO-01}}', 'jeton']));
  const r63 = rangee(d, '6.3. Capacités');
  const capacites = cel(
    x(r63, 'Chaque Candidat complète'), x(r63, '1°'), x(r63, '2°'), x(r63, '3°'), x(r63, '4°'),
    SIc('FABRICANT', x(r63, '5°')),
    SIc('QUALIFICATIONS', x(r63, 'Les qualifications particulières suivantes', ['<indiquer ici, ces qualifications>', '{{B03-CQ-06}}', 'jeton'])));
  retirer(r63, 'instruction à l’acheteur', '<indiquer ici les renseignements', '<Si des qualifications');
  const r63b = rangee(d, '<Si les communautés', 1);
  const ongPreference = cel(
    SIc('ONG', x(r63b, 'Les communautés locales'), x(r63b, '<indiquer les formulaires', ['<indiquer les formulaires ou informations que ces communautés et ONG sont dispensés de produire>', '{{B03-CQ-07}}', 'jeton'])),
    SIc('PREFERENCE', x(r63b, 'Les Candidats susceptibles de bénéficier')));
  retirer(r63b, 'instruction à l’acheteur', '<Si les communautés', '<Si une préférence');
  const r65 = rangee(d, '6.5. Délai de validité');
  const validite = cel(x(r65, 'Le délai de validité', ['<nombre>', '{{B04-VO-01}}', 'jeton']));
  const r66 = rangee(d, '6.6. Contenu et décomposition');
  const prix = cel(
    x(r66, 'La destination finale'),
    x(r66, "<indiquer le lieu d'utilisation", ["<indiquer le lieu d'utilisation des Fournitures>", '{{B09-LL-01.parLot}}', 'jeton']),
    x(r66, 'Terme commercial de livraison'),
    SIc('NATIONAL', x(r66, 'a) Pour les Fournitures acquises')),
    SIc('NATIONAL-TYPE', x(r66, 'i) le prix des fournitures EXW'), x(r66, 'ii) le prix des transports')),
    SIc('NATIONAL-SAISI', '{{B05-CP-02}}'),
    SIc('IMPORTEES', x(r66, 'b) Pour les Fournitures à importer'), x(r66, 'le prix des fournitures correspond')),
    SIc('CIP', x(r66, 'CIP <indiquer', ['<indiquer le lieu de destination qui peut être différent du lieu de destination finale si un changement de mode de transport est nécessaire>', '{{B05-CP-05}}', 'jeton'])),
    SIc('CIF', x(r66, 'CIF <indiquer', ['<indiquer le port de destination>', '{{B05-CP-05}}', 'jeton'])),
    SIc('TRANSPORT-INTERIEUR', x(r66, 'le prix des transports intérieurs, assurance et autres services locaux afférents à la livraison des fournitures du lieu')));
  ajouts.push('{{B05-CP-02}}');
  retirer(r66, 'instruction à l’acheteur', '<Les exemples suivants', "<indiquer ici au cas où l'Acheteur");
  const r663 = rangee(d, '6.6.3. Caractère ferme');
  const revision = cel(SIc('FERME', x(r663, 'Les prix sont fermes')), SIc('REVISABLE', x(r663, 'Les prix sont révisables')));
  const r67 = rangee(d, '6.7. Monnaie');
  const monnaie = cel(
    SIc('ARIARY', x(r67, 'tous les prix sont exprimés en Ariary')),
    SIc('DEVISE', x(r67, 'Les prix des fournitures importées'), x(r67, '<insérer le nom de la devise>', ['<insérer le nom de la devise>', '{{B05-MO-02}}', 'jeton'])));
  const r68 = rangee(d, '6.8. Garantie de soumission');
  const garantie = cel(
    SIc('SANS-GARANTIE', x(r68, "Il n'est pas demandé")),
    SIc('GARANTIE', x(r68, 'Une garantie de soumission doit être fournie')),
    SIc('CHEQUE', x(r68, 'Un chèque de banque')),
    SIc('GARANTIE', x(r68, 'Le montant de la garantie de soumission')),
    SIc('GARANTIE-LOTS', x(r68, '<insérer le montant en chiffres', ['<insérer le montant en chiffres et en lettres>', '{{B05-GS-03.parLot}}', 'jeton'])),
    SIc('GARANTIE-UNIQUE', x(r68, '<insérer le montant en chiffres', ['<insérer le montant en chiffres et en lettres>', '{{B05-GS-03.lettres}} ({{B05-GS-03}})', 'jeton'])));
  const r69 = rangee(d, '6.9. Langue');
  const langue = cel(x(r69, "La langue de l'offre est le français", ["<préciser la deuxième langue de l'offre>", '{{B04-LA-02}}', 'jeton']));
  retirer(r69, 'instruction à l’acheteur', '<Dans le cas où une langue');
  retirer(r69, "formulation d'une langue AUTRE que le français : la fiche ne connaît qu'une langue admise en plus du français (B04-LA-02)", "La langue de l'offre est:", "<indiquer la langue de l'offre différente");

  // ── 7. Remise des offres
  const r7 = rangee(d, '7. – Remise');
  const r71 = rangee(d, '7.1. Forme des plis');
  const plis = cel(
    SIc('ALLOTI', x(r71, "<En cas d'allotissement", ["<En cas d'allotissement, les offres devront être présentées séparément pour chacun des lots>", 'les offres devront être présentées séparément pour chacun des lots', 'choix'])),
    x(r71, "Outre l'original"),
    x(r71, '<insérer le nombre de copies>', ['<insérer le nombre de copies>', '{{B04-RO-01}}', 'jeton']),
    x(r71, 'Les enveloppes devront comporter'),
    x(r71, '<insérer les mentions', ["<insérer les mentions et/ou le numéro du DAO qui doit apparaître sur l'enveloppe de l'offre pour identifier ce processus de passation des marchés>", '{{B04-RO-02}}', 'jeton']),
    SIc('ALLOTI', x(r71, '<insérer le numéro du lot', ["<insérer le numéro du lot auquel se rapporte l'offre>", "numéro du lot auquel se rapporte l'offre", 'choix'])));
  const r72 = rangee(d, '7.2. Lieu, date');
  const remise = cel(
    x(r72, 'Aux fins de remise des offres'),
    x(r72, 'Attention :', ['<insérer le nom complet de la PRMP ou de son représentant>', '{{B04-LR-01}}', 'jeton']),
    x(r72, 'Adresse:', ["<insérer le nom de la rue et le numéro de l'immeuble>", '{{B04-LR-02}}', 'jeton']),
    x(r72, 'Les date et heure limites'),
    x(r72, 'Date :', ['<insérer le jour, mois, année>', '{{B04-LR-03}}', 'jeton']),
    x(r72, 'Heure :', ["<insérer l'heure en utilisant les 24 heures>", '{{B04-LR-04}}', 'jeton']));
  retirer(r72, "adresse de remise : saisie d'un bloc dans B04-LR-02 (rue, bureau, ville, code postal)", 'Étage/Numéro', 'Ville :', 'Code postal');
  const r73 = rangee(d, '7.3. Remise des offres par voie');
  const electronique = cel(SIc('PAPIER', x(r73, 'Le mode de remise des offres par voie électronique')), SIc('B04-SE', CLAUSE_SE));
  retirer(r73, 'instruction à l’acheteur (les conditions de la remise électronique sont demandées au juriste)', "<s'il n'est pas possible", '<Dans le cas où il est possible');
  const r8 = rangee(d, '8. Ouverture des plis');
  const ouverture = cel(x(r8, 'Lieu :', ["<indiquer avec précision le lieu où se déroule l'ouverture des plis>", '{{B04-OP-01}}', 'jeton']), x(r8, 'Date et heure'));

  // ── 9. Évaluation
  const r9 = rangee(d, '9. Evaluation');
  const r91 = rangee(d, '9.1. - Relations');
  const relations = cel(x(r91, 'Les Candidats devront répondre'), x(r91, '<insérer le nombre de jours>', ['<insérer le nombre de jours>', '{{B06-EP-01}}', 'jeton']));
  const r94 = rangee(d, '9.4. Evaluation des offres');
  const evaluation = cel(
    x(r94, 'Evaluation des offres portant sur plusieurs lots'),
    SIc('EVALUATION-PAR-LOT', x(r94, 'Les offres seront évaluées par lot')),
    SIc('EVALUATION-ENSEMBLE', x(r94, "Le Marché portera sur l'ensemble des lots")));
  const r94b = rangee(d, 'Critères additionnels', 1);
  const criteres = cel(x(r94b, 'Critères additionnels'), x(r94b, "L'évaluation d'une offre par l'Acheteur"), '{{B06-EO-02}}');
  retirer(r94b, 'instruction à l’acheteur', '<indiquer ici les critères additionnels', '<choisir un ou plusieurs');
  for (const m of ['Variation par rapport au calendrier', 'Variantes au Calendrier', 'Coût de remplacement', 'Frais de fonctionnement', 'Performance et rendement']) {
    const v = rangee(d, m, 1);
    retirer(v, 'critères additionnels d’exemple du modèle, « à adapter » : remplacés par la saisie B06-EO-02', () => true);
  }
  const r95 = rangee(d, '9.5. Préférence');
  const preference = cel(
    SIc('SANS-PREFERENCE', x(r95, "Il n'est pas accordé"), x(r95, '=nationaux.')),
    SIc('PREFERENCE', x(r95, 'Il est accordé une préférence'), x(r95, '<préciser', ['<préciser le pourcentage de préférence inférieur ou égal à 10% >', '{{B06-EO-09.chiffres}} %', 'jeton'])));
  retirer(r95, 'instruction à l’acheteur', "<insérer l'une des options");
  const r11q = rangee(d, '11. Modification');
  const quantites = cel(x(r11q, "L'autorité contractante, au moment", ['<préciser en chiffres et en lettres le pourcentage>', '{{B06-EO-10.chiffres}}', 'jeton']));
  const r12d = rangee(d, '12. Délai de livraison');
  const delai = cel(
    SIc('QUANTITE-FIXE', x(r12d, 'Le délai de livraison est fixé à', ['<préciser le délai de livraison>', '{{B06-EO-11}} jours', 'jeton'],
      [', sans toutefois dépasser <insérer le nombre de jours> jours <préciser par lot en cas d\'allotissement>', '', 'retire'])),
    SIc('QUANTITE-FIXE-ALLOTI', x(r12d, "En cas d'attribution de deux")),
    SIc('COMMANDE', x(r12d, 'Le délai de livraison est fixé dans le bon', ['<préciser le délai de livraison maximum>', '{{B06-EO-12.parLot}}', 'jeton'], [' (en chiffres et en lettres)', '', 'retire'])));
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>$/i.test(l.texte));
  retirer(r12d, 'instruction à l’acheteur', '<Pour le cas');

  const blocs = [
    P(intro),
    T(2),
    L(...entete.lignes.map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; })),
    L(clause(r1), acheteur),
    ...SIr('ALLOTI', L(clause(r11), lots)),
    L(clause(r11v).length ? clause(r11v) : '', variantes),
    ...SIr('COMMANDE', L(clause(r12), commande)),
    ...SIr('GROUPEMENT', L(clause(r2), groupements)),
    L(clause(r5), ''),
    L(clause(r51), composition),
    L(clause(r52), eclaircissements),
    L(clause(r6), ''),
    L(clause(r62), contenu),
    L(clause(r63), capacites),
    L('', ongPreference),
    L(clause(r65), validite),
    L(clause(r66), prix),
    L(clause(r663), revision),
    L(clause(r67), monnaie),
    L(clause(r68), garantie),
    ...SIr('LANGUE', L(clause(r69), langue)),
    L(clause(r7), ''),
    L(clause(r71), plis),
    L(clause(r72), remise),
    L(clause(r73), electronique),
    L(clause(r8), ouverture),
    L(clause(r9), ''),
    L(clause(r91), relations),
    ...SIr('ALLOTI', L(clause(r94), evaluation)),
    ...SIr('CRITERES', L('', criteres)),
    L(clause(r95), preference),
    ...SIr('QUANTITES', L(clause(r11q), quantites)),
    L(clause(r12d), delai),
    FIN,
  ];
  const titre = ligne(d, '1.2. - DONNEES PARTICULIERES').texte;
  toutEstRendu(d, 'DPAO-F');
  return { fichier: 'DPAO-F.docx', sigle: 'DPAO-F', source: 'fournitures-dpao', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ AE des fournitures (quantité fixe et à commande) ══════════════════════════════════════════════
// Source : « 4-Document type d'appel d'offres_Fournitures_Cadre d'acte d'engagement » (ARMP). L'acte d'engagement
// est d'abord le document du CANDIDAT (identification, prix, domiciliation, bordereaux, signatures) : ses chevrons
// restent. La fiche remplit une douzaine de trous (autorité, marché, procédure, imputation, PRMP, n° du DAO, fin de
// validité des offres, délais, comptable assignataire, pièces contractuelles) et choisit les blocs selon la forme, le
// type de prix, la provenance, le groupement, l'avance et la sous-traitance. Un AE par lot quand la ligne est allotie.
function aeFournitures() {
  const SRC = lireSource('fournitures-ae');
  const d = sectionCellules(SRC, "2.1. CADRE D'ACTE D'ENGAGEMENT", null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const E = emetteur(d, tr);

  const conditions = {
    ALLOTI: 'alloti = OUI',
    'NON-ALLOTI': 'alloti = NON',
    AOO: "B01-AC-13 = Appel d'offres ouvert",
    PREQUALIFICATION: 'B01-AC-13 contient qualification',
    'DEUX-ETAPES': 'B01-AC-13 contient deux étapes',
    RESTREINT: 'B01-AC-13 contient restreint',
    GROUPEMENT: 'groupement = OUI',
    'GROUPEMENT-CONJOINT': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    'PRIX-UNITAIRES': 'typeMarche = QUANTITE_FIXE et typePrix = UNITAIRES',
    'PRIX-FORFAITAIRE': 'typeMarche = QUANTITE_FIXE et typePrix = FORFAITAIRE',
    COMMANDE: 'typeMarche = A_COMMANDE',
    'QUANTITE-FIXE': 'typeMarche = QUANTITE_FIXE',
    'SANS-SOUS-TRAITANCE': 'B03-ST-01 = NON',
    'SOUS-TRAITANCE': 'B03-ST-01 = OUI',
    'DEPART-DIFFERE': 'typeMarche = QUANTITE_FIXE et B09-DX-02 renseigne',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'ANNEXE-FORFAIT': 'typePrix = FORFAITAIRE',
    'ANNEXE-UNITAIRES': 'typePrix = UNITAIRES',
    IMPORTEES: 'provenance = IMPORTEES',
    'NATIONAL-QUANTITE-FIXE': 'provenance = NATIONAL et typeMarche = QUANTITE_FIXE',
    'NATIONAL-COMMANDE': 'provenance = NATIONAL et typeMarche = A_COMMANDE',
  };
  const ajouts = [];

  // Ce qui ne s'imprime pas : le titre de partie du dossier type, la note aux utilisateurs (« à supprimer dans le DAO
  // définitif »), les instructions et les intitulés d'option.
  retirer(d, 'titre de partie du dossier type', "2.1. CADRE D'ACTE D'ENGAGEMENT");
  retirer(d, 'note aux utilisateurs, « à supprimer dans le DAO définitif »', 'Note aux utilisateurs', "L'Acte d'Engagement signé en un seul", "L'Acte d'Engagement est, après", 'Les commentaires entre');
  retirer(d, 'instruction à l’acheteur', '<préciser selon le cas', 'Rayer les dispositions', '<Insérer si le point de départ', '<mentionner le délai global>',
    "<dans le cas d'un marché à prix forfaitaire>", "Dans le cas d'un marché à prix unitaire :", "Dans le cas d'un marché à prix forfaitaire :", "Dans le cas d'un marché à commande :");
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', '=Soit :', (l) => /^<\s*soit\s*:?\s*>/i.test(l.texte));
  retirer(d, "variante « délai global à compter d'un ordre de service » : la fiche ne distingue que le cas où le point de départ diffère (B09-DX-02)", 'Le délai de réalisation des du marché');

  const MARCHE = "<Indiquer: l'intitulé principal du Marché, le cas échéant le projet dans le cadre duquel le marché est passé, ou le numéro et l'objet du lot compris dans le projet >";
  const DAO = ["N° du <date>", 'N° {{B02-OB-03}} du <date>', 'jeton'];
  const blocs = [
    C(x("ACTE D'ENGAGEMENT (A.E)")),
    ...E('AUTORITE CONTRACTANTE', "<Indiquer: l'intitulé", [['<indiquer le nom >', ['<indiquer le nom >', '{{B01-AC-01}}', 'jeton']]]),
    ...SI('NON-ALLOTI', P(x("<Indiquer: l'intitulé", [MARCHE, '{{B02-OB-01}}', 'jeton']))),
    ...SI('ALLOTI', P(x("<Indiquer: l'intitulé", [MARCHE, '{{B02-OB-01}} — lot n° {{LOT}}', 'jeton']))),
    ...E('Marché passé selon', "d'appel d'offres ouvert régie"),
    ...SI('AOO', P(x("d'appel d'offres ouvert régie"))),
    ...SI('PREQUALIFICATION', P(x("d'appel d'offres ouvert avec"))),
    ...SI('DEUX-ETAPES', P(x("d'appel d'offres en deux"))),
    ...SI('RESTREINT', P(x("d'appel d'offres restreint", ['Publics>', 'Publics', 'choix']))),
    ...E('Imputation budgétaire', "Engagement à remplir par les MEMBRES", [
      ['Imputation budgétaire', ['<à préciser>', '{{B01-AC-17}}', 'jeton']],
      ['<insérer le nom>', ['<insérer le nom>', '{{B01-AC-05}}', 'jeton']],
      ["Après avoir pris connaissance", DAO],
      ["L'offre ainsi présentée me lie", ['<date>', '{{DERIVE.fin-validite-offre}}', 'jeton']]]),
    ...SI('GROUPEMENT', E("Engagement à remplir par les MEMBRES", 'ARTICLE 2 - PRIX', [
      ["Après avoir pris connaissance", DAO],
      ["L'offre ainsi présentée nous lie", ['<date>', '{{DERIVE.fin-validite-offre}}', 'jeton']]])),
    ...E('ARTICLE 2 - PRIX', 'Les fournitures, objet du présent marché, sont rémunérées, par application du ou des prix'),
    ...SI('PRIX-UNITAIRES', E('Les fournitures, objet du présent marché, sont rémunérées, par application du ou des prix', 'Les fournitures, objet du présent marché, sont rémunérées, par application du prix global',
      [['Les fournitures, objet du présent marché', ["<N° de l'Annexe>", '', 'retire']]])),
    ...SI('PRIX-FORFAITAIRE', E('Les fournitures, objet du présent marché, sont rémunérées, par application du prix global', 'Le montant du marché est fixé à')),
    ...SI('COMMANDE', E('Le montant du marché est fixé à', 'ARTICLE 3')),
    ...E('ARTICLE 3', "Il n'est pas envisagé"),
    ...SI('SANS-SOUS-TRAITANCE', E("Il n'est pas envisagé", "l'Annexe n° <préciser")),
    ...SI('SOUS-TRAITANCE', E("l'Annexe n° <préciser", 'ARTICLE 4')),
    ...E('ARTICLE 4', 'ARTICLE 5', [['Est désigné comme Comptable', ['le….', 'le {{B03-NA-03}}.', 'jeton']]]),
    ...E('ARTICLE 5', 'Le délai de réalisation des prestations suivantes'),
    ...SI('DEPART-DIFFERE', P(x('Le délai de réalisation des prestations suivantes')),
      P(x('<Préciser les Fournitures ou Services', ['<Préciser les Fournitures ou Services Connexes dont le délai de réalisation commence postérieurement à la date de notification:>', '{{B09-DX-02}}', 'jeton']))),
    ...SI('COMMANDE', P(x('Le délai de réalisation des prestations prend effet'))),
    ...E('5.2. Délai', "Le délai d'exécution est fixé à"),
    ...SI('QUANTITE-FIXE', P(x("Le délai d'exécution est fixé à", ['…', '{{B09-DX-01}} jours', 'jeton'], [', sans toutefois dépasser …', '', 'retire']))),
    ...SI('COMMANDE', P(x("Le délai d'exécution est fixé dans le bon", ['…………jours', '{{B06-EO-12}} jours', 'jeton']))),
    ...E('Les calendriers proposés', "Dans le cas d'un groupement de Fournisseurs solidaires"),
    ...SI('GROUPEMENT', E("Dans le cas d'un groupement de Fournisseurs solidaires", "Dans le cas d'un groupement de Fournisseurs conjoints")),
    ...SI('GROUPEMENT-CONJOINT', E("Dans le cas d'un groupement de Fournisseurs conjoints", '6.2 Avance')),
    ...E('6.2 Avance', 'Le CCAP ne prévoit pas'),
    ...SI('SANS-AVANCE', P(x('Le CCAP ne prévoit pas'))),
    ...SI('AVANCE', E('Le Fournisseur désigné ci-avant', 'Fait en un seul original')),
    ...E('Fait en un seul original', 'Annexe n° 1 :'),
    ...SI('ANNEXE-FORFAIT', P(x('Annexe n° 1 :', ["<Dans le cas d'un prix forfaitaire > :", '', 'retire']))),
    ...SI('ANNEXE-UNITAIRES', P(x('Annexe n° 2 :', ["<dans le cas d'un marché à prix unitaires>:", '', 'retire']))),
    ...E('Annexe n° <', 'Autres pièces contractuelles'),
    P(x('Autres pièces contractuelles', ['<à préciser selon les cas>', '{{B09-PC-02}}', 'jeton'])),
    ...E('B. - ACCEPTATION', 'Bordereau des prix des Fournitures à importer'),
    ...SI('IMPORTEES', E('Bordereau des prix des Fournitures à importer', ['Bordereau des prix pour les fournitures locales', 0])),
    ...SI('NATIONAL-QUANTITE-FIXE', E(['Bordereau des prix pour les fournitures locales', 0], ['Bordereau des prix pour les fournitures locales', 1])),
    ...SI('NATIONAL-COMMANDE', E(['Bordereau des prix pour les fournitures locales', 1], 'Bordereau des prix et calendrier')),
    ...E('Bordereau des prix et calendrier', ['=ANNEXE', 0]),
    ...SI('ANNEXE-FORFAIT', E(['=ANNEXE', 0], ['=ANNEXE', 1])),
    ...SI('SOUS-TRAITANCE', E(['=ANNEXE', 1], ['=ANNEXE', 2])),
    ...E(['=ANNEXE', 2]),
  ];
  const titre = ligne(d, 'MARCHÉ PUBLIC DE FOURNITURES').texte;
  toutEstRendu(d, 'AE-F');
  return { fichier: 'AE-F.docx', sigle: 'AE-F', source: 'fournitures-ae', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ Sortie ═══════════════════════════════════════════════════════════════════════════════════
const DOCUMENTS = { 'DPAC-CC': dpacContratCadre, 'AE-CC': aeContratCadre, 'DPAO-F': dpaoFournitures, 'AE-F': aeFournitures };
fs.mkdirSync('modeles', { recursive: true });
const voulus = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DOCUMENTS);
for (const sigle of voulus) {
  const m = DOCUMENTS[sigle]();
  // Une condition utilisée et non déclarée, ou déclarée et jamais utilisée, est une erreur de description.
  // Les marqueurs peuvent être un paragraphe, un paragraphe de cellule ou une ligne de tableau (lot D2) : on les
  // cherche partout, morceau par morceau.
  const morceaux = (b) => b.texte.split(/[\u001E\u001F]/);
  const utilisees = new Set(m.blocs.flatMap(morceaux).map((t) => /^\{\{SI:([A-Z0-9-]+)}}$/.exec(t)?.[1]).filter(Boolean));
  for (const n of utilisees) if (!m.conditions[n]) throw new Error(`${sigle} : condition ${n} utilisée, non déclarée`);
  for (const n of Object.keys(m.conditions)) if (!utilisees.has(n)) throw new Error(`${sigle} : condition ${n} déclarée, jamais utilisée`);
  // Tout paragraphe (ou cellule) vient de la source, ou est un ajout déclaré (seul, ou en tête d'un texte de la source).
  const vient = (t) => PRODUITS.has(t) || m.ajouts.includes(t) || m.ajouts.some((a) => t.startsWith(a) && PRODUITS.has(t.slice(a.length)));
  const orphelins = m.blocs.filter((b) => !['table', 'fin_table', 'vide'].includes(b.type))
    .flatMap(morceaux).filter((t) => t && !/^\{\{(SI|FINSI):[A-Z0-9-]+}}$/.test(t) && !vient(t));
  // Un jeton nu imprime déjà l'unité de son champ (MONTANT : « Ariary », POURCENTAGE : « % ») : suivi de l'unité en dur,
  // le document dirait « 15 % % » (constat du backend, 28/09 ; « Ariary Ariary » du C1 le 27/09) — il faut `.chiffres`.
  const doublons = m.blocs.flatMap((b) => [...b.texte.matchAll(/\{\{([A-Z0-9-]+)\}\}\s*(%|Ariary)/g)].map((x) => x[0]));
  if (doublons.length) throw new Error(`${sigle} : unité écrite après un jeton nu (${doublons.join(', ')}) — utiliser .chiffres`);
  if (orphelins.length) throw new Error(`${sigle} : ${orphelins.length} texte(s) ni lu(s) dans la source ni déclaré(s) en ajout :\n` + orphelins.map((t) => `   « ${t.slice(0, 110)} »`).join('\n'));
  fs.writeFileSync(`modeles/${sigle}.json`, JSON.stringify(m, null, 1), 'utf8');
  const commande = [['FICHIER', m.fichier], ['TITRE', m.titre],
    ...Object.entries(m.conditions).map(([n, e]) => ['CONDITION', `${n}${US}${e}`]),
    ...m.blocs.map((b) => [b.type.toUpperCase(), b.texte])];
  fs.writeFileSync(`modeles/${sigle}.txt`, commande.map((l) => l.join('\t')).join('\n') + '\n', 'utf8');
  const nb = (g) => m.trace.filter((t) => t.genre === g).length;
  const jetons = [...new Set(m.blocs.flatMap((b) => b.texte.match(/\{\{(?!SI:|FINSI:)[^{}]+}}/g) ?? []))];
  console.log(`${sigle} — ${m.blocs.filter((b) => b.type !== 'ligne' && !/^\{\{(SI|FINSI):/.test(b.texte)).length} paragraphes, ${Object.keys(m.conditions).length} conditions, ${jetons.length} jetons distincts ; trous : ${nb('jeton')} jeton(s), ${nb('choix')} choix, ${nb('retire')} retrait(s), ${nb('typo')} coquille(s) ; ${m.retraits.length} ligne(s) de la source retirée(s)`);
}
