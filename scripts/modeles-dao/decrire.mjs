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
 * fin). Un paragraphe hors tableau dont le texte répond à `titres` devient un sous-titre. ⚠️ Le rang d'un repère de
 * DÉBUT se compte dans tout le document ; celui d'un repère de FIN, à partir du début de la plage.
 */
function emetteur(sec, tr, titres = /^(ARTICLE\b|[A-Z]\.\s*-|\d+\.\d*\.?\s)/) {
  const numeros = [...new Set(sec.lignes.map((u) => u.ligne))].sort((x, y) => x - y);
  /** La ligne dont le premier paragraphe non retiré répond au motif — `[motif, rang]` quand le titre revient. */
  const ligneDe = (repere, apres = -Infinity) => {
    const [motif, rang] = Array.isArray(repere) ? repere : [repere, 0];
    const trouvees = numeros.filter((k) => k > apres).filter((k) => {
      const u = sec.lignes.find((x) => x.ligne === k && !sec.retirees.has(x.n));
      return u && correspond(u, motif);
    });
    if (trouvees.length <= rang) throw new Error(`plage : « ${motif} » (rang ${rang}) absent`);
    return trouvees[rang];
  };
  return (de, a = null, trous = []) => {
    const l0 = ligneDe(de);
    // La borne de fin est cherchée après le début : un titre répété (« Non applicable ») ne referme pas la plage trop tôt.
    const l1 = a ? ligneDe(a, l0) : Infinity;
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
    if (genre === 'adapte') {
      // 01/10 (DAO travaux du MEN) — du texte FIXE d'un exemple que le document type invite à adapter (« choisir parmi
      // les exemples suivants en les adaptant ») devient un jeton : une durée figée, une liste de pièces imprimée d'office.
      // Garde-fou : la ligne de la source doit porter cette invitation (motif `adapt`), et rien d'autre qu'un jeton,
      // de la ponctuation ou une unité ne remplace le texte.
      const mots = par.replace(/{{[^{}]+}}/g, ' ').split(/[^p{L}p{N}]+/u).map(reduire).filter(Boolean);
      const intrus = mots.filter((w) => !reduire(f).includes(w) && !UNITES.includes(w));
      if (!/{{[^{}]+}}/.test(par) || intrus.length) erreur(`une adaptation se fait par un jeton${intrus.length ? ` (mots étrangers : ${intrus.join(', ')})` : ''}`);
    }
    if (genre === 'jeton') {
      // Autour des jetons : de la ponctuation, des mots pris dans le trou, ou l'unité du nombre (« {{B07-DU-03}} mois »).
      const mots = par.replace(/\{\{[^{}]+}}/g, ' ').split(/[^\p{L}\p{N}]+/u).map(reduire).filter(Boolean);
      const intrus = mots.filter((w) => !reduire(f).includes(w) && !UNITES.includes(w));
      if (!/\{\{[^{}]+}}/.test(par) || intrus.length) erreur(`pas un jeton${intrus.length ? ` (mots étrangers au trou : ${intrus.join(', ')})` : ''}`);
    }
    if (genre === 'retire' && par !== '') erreur('un retrait ne remplace rien');
    if (genre === 'typo' && reduire(f) !== reduire(par)) erreur('une coquille ne change pas le texte');
    if (!['jeton', 'choix', 'retire', 'typo', 'adapte'].includes(genre)) erreur(`genre inconnu « ${genre} »`);
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
    // ⚠️ 29/09 (lot D4, T-2) — le document type du contrat-cadre sert aussi les travaux (codes harmonisés, Q1).
    'CCAG-FOURNITURES': 'categorie != TRAVAUX',
    'CCAG-TRAVAUX': 'categorie = TRAVAUX',
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
    // ⚠️ 01/10 (avis spécifique §B7.4) — le montant du dossier se saisit par lot sur une ligne allotie ; sans réponse
    // « alloti », le montant unique (jamais rien).
    'MONTANT-LOTS': 'alloti = OUI',
    'MONTANT-UNIQUE': 'alloti != OUI',
    PAPIER: 'modeRemise = PAPIER',
    'B04-SE': 'modeRemise = ELECTRONIQUE',
    DEVISE: 'B05-UM-01 renseigne',
    'SANS-DEVISE': 'B05-UM-01 vide',
  };

  // Titres d'article : « ARTICLE n : » est une numérotation automatique de Word (le sommaire la montre), perdue à la
  // lecture — rendue dans le texte et déclarée en AJOUT, comme les labels « (a) » d'A1. Idem l'appel de note « (1) ».
  const art = (n, motif, rang = 0) => ST(`ARTICLE ${n} : ${ligne(d, motif, rang).texte}`);
  const ajouts = Array.from({ length: 12 }, (_, i) => `ARTICLE ${i + 1} : `);
  const PAYEUR_DPAC = 'libellé au nom de l’Agent comptable de l’ARMP ou au nom du régisseur de recettes de l’ARMP';
  const compteArmpDpac = (t) => {
    if (!t.includes(PAYEUR_DPAC)) throw new Error(`DPAC-CC : « ${PAYEUR_DPAC} » absent`);
    const a = t.replace(PAYEUR_DPAC, 'à verser sur le compte bancaire de l’ARMP : {{PARAM.compte-dao}}');
    ajouts.push(a);
    return a;
  };
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
    ...SI('CCAG-FOURNITURES', C(x('REGLEMENT DE LA CONSULTATION'))),
    // Contrat-cadre de travaux : le titre du document type dit « fournitures et services » — mention retirée (T-2).
    ...SI('CCAG-TRAVAUX', C(x('REGLEMENT DE LA CONSULTATION', [' marché de fournitures et services', '', 'retire']))),
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
    // ⚠️ 01/10 (décision du pilote, Q7 et point 4) — le prix du dossier se verse sur le compte bancaire unique de l'ARMP,
    // comme dans l'avis spécifique : « libellé au nom de l'Agent comptable … ou du régisseur … » est remplacé (ajout déclaré).
    ...['MONTANT-LOTS', 'MONTANT-UNIQUE'].flatMap((c) => SI(c, P(compteArmpDpac(x('Pour tout candidat désirant soumissionner', ["<indiquer l'adresse>", '{{B04-DS-04}}', 'jeton'],
      ['<indiquer en lettres et en chiffres le montant à payer en Ariary ou son équivalent en monnaie librement convertible>',
        c === 'MONTANT-LOTS' ? '{{B04-DS-05.parLot}}' : '{{B04-DS-05.lettres}} ({{B04-DS-05}})', 'jeton']))))),
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
    // ⚠️ 29/09 (lot D4, T-2) — le document type propose lui-même « CCAG Fournitures / CCAG Travaux <choisir> » : la
    // catégorie de la fiche choisit (contrat-cadre de travaux, codes harmonisés sur ceux des fournitures, Q1).
    'CCAG-FOURNITURES': 'categorie != TRAVAUX',
    'CCAG-TRAVAUX': 'categorie = TRAVAUX',
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
    ...SI('CCAG-FOURNITURES', P(x('• Le cahier des clauses administratives générales', ['/marchés de travaux', '', 'retire'], ['<choisir selon le CCAG applicable>', '', 'retire']))),
    ...SI('CCAG-TRAVAUX', P(x('• Le cahier des clauses administratives générales', ['marchés publics de Fournitures courantes et services/', '', 'retire'], ['<choisir selon le CCAG applicable>', '', 'retire']))),

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
    ...SI('PENALITES-CCAG',
      SI('CCAG-FOURNITURES', P(x("Conformément à l'article 12", ['/ article 20 du CCAG Travaux <choisir et rayer la mention inutile>', '', 'retire']))),
      SI('CCAG-TRAVAUX', P(x("Conformément à l'article 12", ['12 du CCAG Fournitures et Services / article ', '', 'retire'], [' <choisir et rayer la mention inutile>', '', 'retire'])))),
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
    ...SI('CCAG-FOURNITURES', P(x('Le titulaire pourra sous-traiter', ["l'article 2.4 du CCAG Travaux/ ", '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
    ...SI('CCAG-TRAVAUX', P(x('Le titulaire pourra sous-traiter', ["/ l'article 5.2 du CCAG Fournitures", '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
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
    ...SI('VERIFICATION-CCAG',
      SI('CCAG-FOURNITURES', P(x('Les opérations de vérification', ['/ ou aux articles 41, 42 et 43 du CCAG Travaux', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
      SI('CCAG-TRAVAUX', P(x('Les opérations de vérification', ['21 et 22 du CCAG Fournitures/ ou aux articles ', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire'])))),
    ...SI('VERIFICATION-LIBRE', P(x('- les dispositions du CCAG', ['- les dispositions du CCAG ne sont pas applicables ou nécessitent une précision', '{{B09-VA-02}}', 'jeton']))),

    // ── Article 14
    ST(x('ARTICLE 14 –')),
    ...SI('GARANTIE-NON', P(x('Aucune garantie'))),
    ...SI('GARANTIE-OUI', P(x('Il est possible de donner', ["Il est possible de donner ici l'objet de la garantie et de renvoyer à un autre document pour la description de sa mise en œuvre (exemple documents à remettre dans les offres se rapportant aux marchés subséquents)", '{{B09-GP-02}}', 'jeton']))),
    ...SI('GARANTIE-ADMISSION', P(garantie(true))),
    ...SI('GARANTIE-MISE-EN-SERVICE', P(garantie(false))),
    ...SI('GARANTIE-CCAG',
      SI('CCAG-FOURNITURES', P(x('Si la garantie est exécutée', ['Si la garantie est exécutée conformément au C.C.A.G.-FCS, ajouter : ', '', 'retire'],
        ["à l'article 44 du CCAG Travaux/ ", '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
      SI('CCAG-TRAVAUX', P(x('Si la garantie est exécutée', ['Si la garantie est exécutée conformément au C.C.A.G.-FCS, ajouter : ', '', 'retire'],
        ['/ aux articles 13 et 23 du CCAG Fournitures', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire'])))),

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
    ...SI('CCAG-FOURNITURES', P(x('La résiliation pourra être prononcée', ['/ articles 46 du CCAG Travaux', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
    ...SI('CCAG-TRAVAUX', P(x('La résiliation pourra être prononcée', ['articles 24 à 33 du CCAG Fournitures/ ', '', 'retire'], ['<choisir et supprimer les mentions inutiles>', '', 'retire']))),
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
  const NIVEAU_TECHNIQUE = 'Niveau exigé : {{B03-CQ-02}}';
  const NIVEAU_FINANCIER = 'Niveau exigé : {{B03-CQ-03}}';
  const NIVEAU_REFERENCES = 'Pièces exigées : {{B03-CQ-04}}';
  const ajouts = [CLAUSE_SE, '{{B04-DE-01}}', '{{B06-EO-02}}', '{{B02-LV-02}}', NIVEAU_TECHNIQUE, NIVEAU_FINANCIER, NIVEAU_REFERENCES];

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
    // Le document type énumère les fiches à remplir sans dire le niveau exigé, que la Commission contrôle : trois ajouts
    // déclarés (décision du pilote du 29/09, analyse des champs non imprimés, Q-a).
    x(r63, 'Chaque Candidat complète'), x(r63, '1°'),
    x(r63, '2°'), NIVEAU_TECHNIQUE, x(r63, '3°'), NIVEAU_FINANCIER, x(r63, '4°'), NIVEAU_REFERENCES,
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
    ...SI('NATIONAL-QUANTITE-FIXE', E(['Bordereau des prix pour les fournitures locales', 0], 'Bordereau des prix pour les fournitures locales')),
    ...SI('NATIONAL-COMMANDE', E(['Bordereau des prix pour les fournitures locales', 1], 'Bordereau des prix et calendrier')),
    ...E('Bordereau des prix et calendrier', ['=ANNEXE', 0]),
    ...SI('ANNEXE-FORFAIT', E(['=ANNEXE', 0], '=ANNEXE')),
    ...SI('SOUS-TRAITANCE', E(['=ANNEXE', 1], '=ANNEXE')),
    ...E(['=ANNEXE', 2]),
  ];
  const titre = ligne(d, 'MARCHÉ PUBLIC DE FOURNITURES').texte;
  toutEstRendu(d, 'AE-F');
  return { fichier: 'AE-F.docx', sigle: 'AE-F', source: 'fournitures-ae', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ CCAP des fournitures (quantité fixe et à commande) ════════════════════════════════════════════
// Source : « 5-Document type d'appel d'offres_Fournitures_Cahier Prescriptions Spéciales » (ARMP) : page de garde, CCAP
// (25 articles), annexes (formule de révision, garanties de bonne exécution et de restitution d'avance). Les
// SPÉCIFICATIONS TECHNIQUES du même document ne sont pas reprises ici : le serveur les produit depuis le besoin (bloc
// B12 : liste des fournitures, tableau de conformité).
function ccapFournitures() {
  const SRC = lireSource('fournitures-ccap');
  const d = sectionCellules(SRC, '2.2 CAHIER DES PRESCRIPTIONS', null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (motif, rang, ...r) => { const u = ligne(d, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  const E = emetteur(d, tr, /^(Article \d|ARTICLE|\d+\.\d+[a-z]?\.\s*-|Annexe au CCAP|CAHIER DES CLAUSES)/);

  const conditions = {
    AOO: "B01-AC-13 = Appel d'offres ouvert",
    PREQUALIFICATION: 'B01-AC-13 contient qualification',
    'DEUX-ETAPES': 'B01-AC-13 contient deux étapes',
    RESTREINT: 'B01-AC-13 contient restreint',
    PROJET: 'B02-AU-01 renseigne',
    ALLOTI: 'alloti = OUI',
    'GROUPEMENT-SOLIDAIRE': 'groupement = OUI et formeGroupement = SOLIDAIRE_OBLIGATOIRE',
    'GROUPEMENT-LIBRE': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    'PIECES-SUPPLEMENTAIRES': 'B09-PC-01 renseigne',
    'DELAI-AJUSTEMENT': 'B09-OM-01 renseigne',
    'VARIATION-QUANTITES': 'typeMarche = QUANTITE_FIXE et B09-OM-02 renseigne',
    COMMANDE: 'typeMarche = A_COMMANDE',
    'VARIATION-COMMANDE': 'typeMarche = A_COMMANDE et B09-OM-02 renseigne',
    'SANS-VARIATION-COMMANDE': 'typeMarche = A_COMMANDE et B09-OM-02 vide',
    'QUANTITE-FIXE': 'typeMarche = QUANTITE_FIXE',
    'SECURITE-NON': 'B09-PS-01 = NON',
    'SECURITE-OUI': 'B09-PS-01 = OUI',
    'SECURITE-NOTIFICATION': 'B09-PS-01 = OUI et B09-PS-02 renseigne',
    'SECURITE-ANNEXE': 'B09-PS-01 = OUI et B09-PS-03 renseigne',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'GARANTIE-AVANCE': 'avance = OUI et B08-AV-04 renseigne',
    'AVANCE-GARANTIE-BANCAIRE': 'avance = OUI et B08-AV-04 = Garantie bancaire',
    'AVANCE-CAUTION': 'avance = OUI et B08-AV-04 = Caution personnelle et solidaire',
    'PAIEMENT-LIVRAISON': 'typePrix = UNITAIRES et B08-PA-05 = À la livraison',
    'PAIEMENT-MENSUEL': 'typePrix = UNITAIRES et B08-PA-05 = Mensuelle',
    'PAIEMENT-TRIMESTRIEL': 'typePrix = UNITAIRES et B08-PA-05 = Trimestrielle',
    FORFAIT: 'typePrix = FORFAITAIRE',
    DEVISE: 'B05-MO-01 contient devise',
    'DEPART-DIFFERE': 'B09-DX-02 renseigne',
    'PENALITES-NON': 'penalites = NON',
    'PENALITES-CCAG': 'penalites = CCAG',
    'PENALITES-PLAFOND': 'penalites = PLAFOND_DIFFERENT',
    'BONNE-EXECUTION-NON': 'B08-GB-01 = NON',
    'BONNE-EXECUTION': 'B08-GB-01 = OUI',
    'BONNE-EXECUTION-BANCAIRE': 'B08-GB-01 = OUI et B06-AN-01 = Garantie bancaire',
    'BONNE-EXECUTION-CAUTION': 'B08-GB-01 = OUI et B06-AN-01 = Cautionnement',
    'BONNE-EXECUTION-MOITIE': 'B08-GB-01 = OUI et B08-RG-01 = OUI',
    'BANCAIRE-MOITIE': 'B08-GB-01 = OUI et B06-AN-01 = Garantie bancaire et B08-RG-01 = OUI',
    'BANCAIRE-ENTIERE': 'B08-GB-01 = OUI et B06-AN-01 = Garantie bancaire et B08-RG-01 = NON',
    'CAUTION-MOITIE': 'B08-GB-01 = OUI et B06-AN-01 = Cautionnement et B08-RG-01 = OUI',
    'CAUTION-ENTIERE': 'B08-GB-01 = OUI et B06-AN-01 = Cautionnement et B08-RG-01 = NON',
    'RETENUE-NON': 'B08-RG-01 = NON',
    'RETENUE-OUI': 'B08-RG-01 = OUI',
    'MATERIELS-NON': 'B09-MC-01 = NON',
    'MATERIELS-OUI': 'B09-MC-01 = OUI',
    'STOCKAGE-NON': 'B09-SK-01 = NON',
    'STOCKAGE-QUANTITE-FIXE': 'B09-SK-01 = OUI et typeMarche = QUANTITE_FIXE',
    'STOCKAGE-COMMANDE': 'B09-SK-01 = OUI et typeMarche = A_COMMANDE',
    MARQUAGE: 'B09-EM-01 renseigne',
    'DOCUMENTS-EMBALLAGE': 'B09-EM-02 renseigne',
    'TRANSPORT-INCOTERM': "B09-RT-01 = Selon l'incoterm",
    'TRANSPORT-FOURNISSEUR': "B09-RT-01 = Transport par le fournisseur jusqu'à la destination finale",
    'TRANSPORT-PARTAGE': 'B09-RT-01 = Responsabilités partagées',
    NATIONAL: 'provenance = NATIONAL',
    IMPORTEES: 'provenance = IMPORTEES',
    CIP: 'provenance = IMPORTEES et B05-CP-01 = CIP',
    CIF: 'provenance = IMPORTEES et B05-CP-01 = CIF',
    'ASSURANCE-INCOTERM': "B09-AS-01 = Selon l'incoterm",
    'ASSURANCE-AUTRE': "B09-AS-01 != Selon l'incoterm",
    'CONTROLE-PRIX-NON': 'B09-CR-01 = NON',
    'CONTROLE-PRIX-OUI': 'B09-CR-01 = OUI',
    GARANTIE: 'B09-DG-01 renseigne',
    'SANS-GARANTIE': 'B09-DG-01 vide',
    INDEMNITE: 'B10-IR-01 = OUI',
  };
  const ajouts = ['{{B09-PC-01}}', '{{B05-VP-02}}', '{{B09-PR-03}}', '{{B09-LF-01}}', '{{B09-LF-02}}', '{{B09-IV-01}}', '{{B09-DI-01}}', '{{B10-AR-01}}', '{{B10-DD-01}}', '{{B08-PA-03}}', '{{B09-DX-03}}'];

  // ── Ce qui ne s'imprime pas
  // Des REPÈRES, pas des paragraphes repris : les chercher par `ligne()` les marquerait « repris » sans les imprimer, et
  // le garde-fou « aucune ligne perdue » ne les verrait plus.
  const repere = (texte) => d.lignes.find((u) => u.texte === texte).ligne;
  const table = repere('TABLE DES MATIERES');
  retirer(d, 'titre de partie du dossier type', '2.2 CAHIER DES PRESCRIPTIONS');
  retirer(d, 'sommaire : ses numéros de page ne valent que pour le document type', (l) => l.ligne === table || (l.ligne > table && l.ligne < table + 60 && /\s\d{1,2}$/.test(l.texte)));
  retirer(d, 'titre du CCAP répété avant le sommaire du document type', (l) => l.ligne === table - 2 && /^CAHIER DES CLAUSES/.test(l.texte));
  retirer(d, 'notes de rédaction du modèle, « à supprimer »', '[note 1]', '[note 2]', '[note 3]', '[note 4]', 'NOTE AUX UTILISATEURS', '<Le document ci-après (CCAP type)');
  retirer(d, 'instruction à l’acheteur', '<préciser selon le cas', '<si le Marché comprend plusieurs lots', '<Préciser si les fournisseurs groupés', '<indiquer les pièces supplémentaires',
    '<Si la Personne Responsable des Marchés Publics souhaite prévoir', '<Cas de Marchés à commandes', "<préciser en cas de fournitures importées", '<Dans le cas où le Marché comporte plusieurs lots',
    "<si l'avance dépasse 5%", "<Indiquer les modalités d'établissement", '<dans le cas de prix unitaires', '<dans le cas de prix forfaitaire', '<Prévoir, le cas échéant',
    '<Si le point de départ des délais', '<Pour les marchés à commandes', 'préciser les modalités et la période de passation', '<Préciser, en fonction de', '<si un plafond différent',
    "<Si une garantie d'exécution est requise", '<Si un délai de garantie contractuelle', '<Si une retenue de garantie est demandée', "<Préciser le cas échéant les spécifications particulières",
    '<Préciser les modalités de livraison', '<Préciser les documents à fournir', "<Si délai donné à la commission", '<Soit, préciser les garanties', '<Si la Personne Responsable des Marchés Publics souhaite fixer',
    '<Exemple : clause', '[Deux pour cent', '[Dix pour cent');
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>\s*:?\s*\.?$/i.test(l.texte));
  retirer(d, "variante « ordre de priorité propre » : l'ordre du CCAG est retenu (la fiche ne porte pas d'ordre propre)", "L'ordre de priorité des pièces contractuelles est le suivant");
  retirer(d, 'exemple de lots accessoires du modèle', "Le mode d'établissement des prix est commun");
  retirer(d, "garantie par chèque de banque : forme non proposée par la fiche (B06-AN-01 : cautionnement ou garantie bancaire)", "- d'un chèque de banque");
  retirer(d, 'exemple de documents du modèle, remplacé par la saisie B09-LF-02', '<nombre> exemplaires de la facture', 'le bon de livraison', 'le certificat de garantie du fabricant', "le certificat d'inspection délivré", "le certificat d'origine", 'pour les fournitures importées : un connaissement');
  retirer(d, 'modalités d’inspection : saisies d’un bloc dans B09-IV-01', '<décrire les fréquences', '< préciser, le cas échéant');
  retirer(d, 'exemple de garantie en heures de fonctionnement du modèle', 'b) La période de garantie est de');
  retirer(d, "clause d'arbitrage d'exemple (CNUDCI), remplacée par la saisie B10-AR-01", 'Tout litige, différend ou plainte', "L'autorité de nomination sera");
  retirer(d, 'mentions à porter d’exemple, remplacées par la saisie B08-PA-03', 'Les décomptes, factures ou mémoires seront établis en', 'le nom et adresse du Fournisseur', 'le numéro du compte bancaire',
    'les références du Marché', 'le montant hors taxe des fournitures', 'le taux et le montant de la TVA', 'le montant TTC dû', 'la date de facturation');
  retirer(d, 'spécifications techniques : produites depuis le besoin (bloc B12 — liste des fournitures, tableau de conformité)', (l) => l.ligne >= repere('SPECIFICATIONS TECHNIQUES'));

  const AC = ["<dénomination de l'autorité contractante>", '{{B01-AC-01}}', 'jeton'];
  const blocs = [
    C(x('MARCHÉ PUBLIC DE FOURNITURES')),
    ...E('AUTORITE CONTRACTANTE', '<indiquer les références', [['<indiquer la dénomination complète >', ['<indiquer la dénomination complète >', '{{B01-AC-01}}', 'jeton']]]),
    P(x('<indiquer les références', ["<indiquer les références et l'intitulé principal du Marché,", '{{B02-OB-03}} — {{B02-OB-01}}', 'jeton'])),
  ];
  retirer(d, 'fin de la même instruction (références du marché)', 'le cas échéant, le projet dans le cadre', "ou le numéro et l'objet du lot compris");
  blocs.push(
    ...E('Marché passé selon', "d'appel d'offres ouvert régie"),
    ...SI('AOO', P(x("d'appel d'offres ouvert régie"))),
    ...SI('PREQUALIFICATION', P(x("d'appel d'offres ouvert avec"))),
    ...SI('DEUX-ETAPES', P(x("d'appel d'offres en deux"))),
    ...SI('RESTREINT', P(x("d'appel d'offres restreint"))),
    ...E('PERSONNE RESPONSABLE', 'Les stipulations du présent CCAP', [['<Insérer le nom>', ['<Insérer le nom>', '{{B01-AC-05}}', 'jeton']]]),
    // Article 1
    ...SI('PROJET', P(x('Les stipulations du présent CCAP')), P(x("<préciser le nom de l'opération", ["<préciser le nom de l'opération, le cas échéant>", '{{B02-AU-01}}', 'jeton']))),
    ...E('Le Marché a pour objet', '<indiquer le lieu où', [["<indiquer l'intitulé", ["<indiquer l'intitulé ou l'objet principal du Marché>", '{{B02-OB-01}}', 'jeton']]]),
    P(x('<indiquer le lieu où', ["<indiquer le lieu où l'Autorité Contractante prend livraison des Fourniture>", '{{B09-LL-01.parLot}}', 'jeton'])),
    ...SI('ALLOTI', P(x('Les fournitures comprennent', ['<nombre >', '{{B02-LV-05}}', 'jeton'])), P(x('- Lot n°1', ["- Lot n°1 : <préciser l'intitulé et/ou l'objet du lot>.", '{{B02-LV-02}}', 'jeton']))),
  );
  retirer(d, 'liste des lots : remplacée par la désignation des lots du plan (B02-LV-02)', '- Lot n°2', '- etc.');
  // Décision du pilote du 29/09 (analyse des champs non imprimés, Q-c) : pas de champ pour le fax de l'acheteur.
  const fax = d.lignes.filter((l) => /^Télécopie/.test(l.texte)).map((l) => l.ligne).sort((a, b) => a - b)[0];
  retirer(d, "télécopie de la PRMP : aucun champ de la fiche, moyen désuet (décision du pilote du 29/09, Q-c)", (l) => l.ligne === fax);
  const fournisseur = 'Aux fins de notification, les coordonnées du Fournisseur';
  blocs.push(
    ...E('La description des fournitures', '<Indiquer la dénomination complète', []),
    P(x("<Indiquer la dénomination complète de l'Autorité", ["<Indiquer la dénomination complète de l'Autorité Contractante>", '{{B01-AC-01}}', 'jeton'])),
    ...E('Article 3.', fournisseur, [
      ["A l'attention de <insérer le nom>", ['<insérer le nom>', '{{B01-AC-05}}', 'jeton']],
      ['n° et rue :', [':', ': {{B01-AC-02}}', 'jeton']],
      ['Adresse électronique : <insérer', ["<insérer l'adresse complète>", '{{B01-AC-06}}', 'jeton']],
    ]),
    // Les coordonnées du Fournisseur restent en blanc : il les porte à la signature. Elles recevaient jusqu'au 29/09 celles
    // de la PRMP, la même plage couvrant les deux blocs.
    ...E(fournisseur, 'Article 4.', []),
  );
  blocs.push(
    ...E('Article 4.', 'Les Fournisseurs groupés seront considérés comme solidaires'),
    ...SI('GROUPEMENT-SOLIDAIRE', P(x('Les Fournisseurs groupés seront considérés comme solidaires'))),
    ...SI('GROUPEMENT-LIBRE', P(xr('Les Fournisseurs groupés seront considérés comme solidaires', 0)), P(x('Les Fournisseurs groupés seront considérés comme conjoints'))),
    ...E('Article 5.', 'Constituent des documents contractuels'),
    ...SI('PIECES-SUPPLEMENTAIRES', P(x('Constituent des documents contractuels')), P('{{B09-PC-01}}')),
    ...E("L'ordre de priorité des pièces contractuelles est celui", 'Le délai de communication par le Fournisseur'),
    ...SI('DELAI-AJUSTEMENT', P(x('Le délai de communication par le Fournisseur', ['<nombre>', '{{B09-OM-01}}', 'jeton']))),
    ...E('Variations maximales', '<Préciser, le cas échéant, pour les Marchés à quantité'),
    ...SI('VARIATION-QUANTITES', P(x('<Préciser, le cas échéant, pour les Marchés à quantité', ['<Préciser, le cas échéant, pour les Marchés à quantité fixes, les variations maximales, augmentation ou réduction, du volume ou des quantités des Fournitures,qui peuvent être exécutées sans avenant:>', 'Variations maximales, augmentation ou réduction, du volume ou des quantités des Fournitures, qui peuvent être exécutées sans avenant : {{B09-OM-02.chiffres}} %', 'jeton']))),
    ...SI('COMMANDE', P(x('Les dispositions du présent Marché sont applicables', ['…….<validité du marché>', '{{B09-OM-03}} mois', 'jeton']))),
    // À commande, la variation au-delà du maximum ou en deçà du minimum est la même donnée que la variation sans avenant
    // de la quantité fixe (B09-OM-02) : restée en pointillés jusqu'au 29/09 (analyse des champs non imprimés).
    // Sans pourcentage saisi, la phrase s'arrête au Bordereau : aucune variation au-delà des bornes n'est admise.
    ...SI('VARIATION-COMMANDE', P(x('Le Minimum et le Maximum', ['………..', '{{B09-OM-02.chiffres}} ', 'jeton']))),
    ...SI('SANS-VARIATION-COMMANDE', P(x('Le Minimum et le Maximum', [", étant entendu que ces quantités sont susceptibles de varier pour chaque article dans la limite de ………..% en sus de maximum ou en dessous du minimum, sans que la valeur totale des commandes puisse être inférieure à la valeur minimale ni supérieure à la valeur maximale prévue dans le présent CPS", '', 'retire']))),
    ...E('Article 7.', 'Non applicable'),
    ...SI('SECURITE-NON', P(xr('=Non applicable', 0))),
    ...SI('SECURITE-OUI', P(x('Les fournitures, objet du présent Marché, sont à exécuter dans un lieu'))),
    ...SI('SECURITE-NOTIFICATION', P(x('<soit :>: que', ['<soit :>: ', '', 'retire']))),
    ...SI('SECURITE-ANNEXE', P(x('<soit :>: mentionnées', ['<soit :>: ', '', 'retire']))),
    ...E('Article 8.', 'Les prix sont fermes et non révisables'),
    ...SI('FERME', E('Les prix sont fermes et non révisables', 'Les prix seront révisables', [['<indiquer la nature des indices', ['<indiquer la nature des indices et les sources où ils peuvent être trouvés>', '{{B05-VP-03}}', 'jeton']]])),
    ...SI('REVISABLE', P(x('Les prix seront révisables')), P('{{B05-VP-02}}')),
    ...E('Article 9.', 'Non applicable', []),
  );
  const avance = [
    ...SI('SANS-AVANCE', P(xr('=Non applicable', 1))),
    ...SI('AVANCE', P(x('Une avance de <pourcentage>', ['<pourcentage>', '{{B08-AV-02.chiffres}} %', 'jeton']))),
    ...SI('GARANTIE-AVANCE', P(x("La demande d'avance doit être accompagnée"))),
    ...SI('AVANCE-GARANTIE-BANCAIRE', P(x('garantie bancaire à première demande'))),
    ...SI('AVANCE-CAUTION', P(x('De caution personnelle et solidaire remplaçant'))),
    ...SI('AVANCE', E("Le remboursement de l'avance sera effectué", '9.1b.')),
  ];
  blocs.push(...avance,
    ...E('9.1b.', 'Termes de paiement'),
    P('{{B08-PA-03}}'),
    ST(x('Termes de paiement')),
    ...SI('PAIEMENT-LIVRAISON', P(x('Les décomptes, factures ou mémoires seront établis à la livraison', [' <ou> mensuellement <ou> trimestriellement', '', 'retire']))),
    ...SI('PAIEMENT-MENSUEL', P(x('Les décomptes, factures ou mémoires seront établis à la livraison', ['à la livraison <ou> ', '', 'retire'], [' <ou> trimestriellement', '', 'retire']))),
    ...SI('PAIEMENT-TRIMESTRIEL', P(x('Les décomptes, factures ou mémoires seront établis à la livraison', ['à la livraison <ou> mensuellement <ou> ', '', 'retire']))),
    ...SI('FORFAIT',
      P(x('Le solde, après règlement')),
      P(x('à concurrence de <pourcentage, par exemple 60%', ['<pourcentage, par exemple 60% ou 70% ou 80%>', '{{B08-PA-06.chiffres}} %', 'jeton'])),
      P(x('à concurrence de <pourcentage, par exemple 40%', ['<pourcentage, par exemple 40%, ou 30% ou 20%>', '{{B08-PA-07.chiffres}} %', 'jeton']))),
    ...E('9.3.', 'Les prix correspondants à des Fournitures étrangères'),
    ...SI('DEVISE', E('Les prix correspondants à des Fournitures étrangères', '9.4.', [['Les prix correspondants', ['<devises>', '{{B05-MO-02}}', 'jeton']]])),
    ...E('9.4.', '<soit :> (Pour le marché à quantités fixes)', [['Le taux des intérêts moratoires', ['<au moins un point>', '{{B08-IM-01.chiffres}} point(s)', 'jeton']]]),
  );
  blocs.push(
    ...SI('QUANTITE-FIXE', P(x('<soit :> (Pour le marché à quantités fixes)', ['<soit :> (Pour le marché à quantités fixes) :', '', 'retire'], ['…………….', '{{B09-DX-01}} jours', 'jeton']))),
    ...SI('COMMANDE', P(x('<soit :> (Pour le marché à commande)', ['<soit :> (Pour le marché à commande) :', '', 'retire'], ['……………..jours', '{{B06-EO-12.parLot}} jours', 'jeton']))),
    ...E('Les Fournitures et services connexes, objet du Marché', 'Le point de départ des délais est'),
    ...SI('DEPART-DIFFERE', P(x('Le point de départ des délais est', ['<par exemple : le premier ordre de services de début d’exécution>', '{{B09-DX-02}}', 'jeton']))),
    ...SI('COMMANDE', P(x('Les prestations feront l’objet de bons de commande', ['<préciser la durée>', '{{B09-OM-03}} mois', 'jeton'], [" s'achevant le <date>", '', 'retire'])), P('{{B09-DX-03}}'),
      E('Chaque bon de commande précisera', 'Article 11.')),
    ...E('Article 11.', 'Les pénalités journalières'),
    ...SI('PENALITES-NON', P(x('Les pénalités journalières'))),
    ...SI('PENALITES-CCAG', P(xr('Les stipulations de l’article 12.1', 0))),
    ...SI('PENALITES-PLAFOND', P(xr('Les stipulations de l’article 12.1', 0)), P(x('Le montant des pénalités est limité', ['<pourcentage>', '{{B09-PR-02.chiffres}} %', 'jeton'])), P('{{B09-PR-03}}')),
    ...E('Article 12.', 'Aucune garantie d', [['Article 12.', ['[note:2]', '', 'retire']]]),
    ...SI('BONNE-EXECUTION-NON', P(x("Aucune garantie d'exécution"))),
    ...SI('BONNE-EXECUTION', P(x('Le montant de la garantie de bonne exécution', ['<insérer le pourcentage>', '{{B08-GB-02.chiffres}} %', 'jeton'], [' ne peut dépasser cinq pour cent (5%) du Montant du Marché>', '', 'retire'])), P(x('La garantie de bonne exécution sera fournie sous forme'))),
    ...SI('BONNE-EXECUTION-BANCAIRE', P(x("- d'une garantie bancaire"))),
    ...SI('BONNE-EXECUTION-CAUTION', P(x("- d'une caution personnelle"))),
    ...SI('BONNE-EXECUTION', P(x('La garantie de bonne exécution sera libellée'))),
    ...SI('BONNE-EXECUTION-MOITIE', P(x('La garantie de bonne exécution est libérée de 50%'))),
    ...E('12.2.', 'Aucune retenue de garantie', [['12.2.', ['[note:3]', '', 'retire']]]),
    ...SI('RETENUE-NON', P(x('Aucune retenue de garantie'))),
    ...SI('RETENUE-OUI', P(x('Une retenue de garantie égale à', ['<insérer le pourcentage sans dépasser 5%>', '{{B08-RG-02.chiffres}} %', 'jeton']))),
    ...E('Article 13.', 'Sans objet'),
    ...SI('MATERIELS-NON', P(x('=Sans objet'))),
    ...SI('MATERIELS-OUI', P(x('La liste des matériels'))),
    ...E('Article 14.', 'Non applicable'),
    ...SI('STOCKAGE-NON', P(xr('=Non applicable', 2))),
    ...SI('STOCKAGE-QUANTITE-FIXE', P(x("Les dispositions de l'article 15.1 du CCAG", ['<compléter par des indications pratiques sur la nature et les quantités de fournitures à stocker, la durée du stockage>', '', 'retire']))),
    ...SI('STOCKAGE-COMMANDE', P(x('<soit > (dans le cas', ["<soit > (dans le cas d'un marché à commande):", '', 'retire']))),
    ...E('Article 15.', 'Le marquage des emballages'),
    ...SI('MARQUAGE', P(x('Le marquage des emballages')), P(x('<Insérer le marquage', ['<Insérer le marquage éventuellement requis>', '{{B09-EM-01}}', 'jeton']))),
    ...SI('DOCUMENTS-EMBALLAGE', P(x('Les documents placés à l')), P(x('<Insérer la liste des documents requis>', ['<Insérer la liste des documents requis>', '{{B09-EM-02}}', 'jeton']))),
    ...E('Article 16.', 'La responsabilité du transport des Fournitures'),
    ...SI('TRANSPORT-INCOTERM', P(x('La responsabilité du transport des Fournitures'))),
    ...SI('TRANSPORT-FOURNISSEUR', P(x('Le Fournisseur est tenu contractuellement'))),
    ...SI('TRANSPORT-PARTAGE', P(x('Les responsabilités respectives', ["<indiquer les responsabilités respectives de l'Autorité contractante et du Fournisseur >", '{{B09-RT-02}}', 'jeton']))),
    ...E('Article 17.', 'Les Fournitures fabriquées ou achetées'),
    ...SI('NATIONAL', P(x('Les Fournitures fabriquées ou achetées', ['<préciser suivant le cas soit:> ', '', 'retire']))),
    ...SI('IMPORTEES', P(x('Les Fournitures importées seront livrées'))),
    ...SI('CIP', P(x('<soit> CIP', ['<soit> ', '', 'retire'], ['<insérer le lieu de destination finale>', '{{B05-CP-05}}', 'jeton']))),
    ...SI('CIF', P(x('<soit> CIF', ['<soit> ', '', 'retire'], ['<insérer le nom du port>', '{{B05-CP-05}}', 'jeton']))),
    P('{{B09-LF-01}}'),
    P(x('Le Fournisseur doit fournir les documents suivants')),
    P('{{B09-LF-02}}'),
    ...E('Les documents ci', 'Les obligations en matière d\'assurance des Fournitures'),
    ...SI('ASSURANCE-INCOTERM', P(x("Les obligations en matière d'assurance des Fournitures"))),
    ...SI('ASSURANCE-AUTRE', P(x("Les obligations en matière d'assurance sont les suivantes")), P(x("<préciser qui est responsable de l'assurance", ["<préciser qui est responsable de l'assurance des Fournitures et jusqu'à quel moment>", '{{B09-AS-02}}', 'jeton']))),
    ...E('Article 19.', 'Non applicable.', [['Article 19.', ['[note:4]', '', 'retire']]]),
    ...SI('CONTROLE-PRIX-NON', P(x('=Non applicable.'))),
    ...SI('CONTROLE-PRIX-OUI', P(x("Les dispositions de l'Article 20 du CCAG", ['<Préciser, le cas échéant, les éléments spécifiques du prix de revient soumis à contrôle et les modalités de ce contrôle>', '', 'retire']))),
    ...E('Article 20.', '<préciser le lieu, par exemple'),
    P(x('<préciser le lieu, par exemple', ['<préciser le lieu, par exemple dans les usines du Fournisseur et/ou au lieu de livraison>', '{{B09-IV-01}}', 'jeton'])),
    ...E('Article 21.', '<soit :> (Pour le cas d’un marché à quantités'),
    ...SI('QUANTITE-FIXE', P(x('<soit :> (Pour le cas d’un marché à quantités', ['<soit :> (Pour le cas d’un marché à quantités fixes) :', '', 'retire'])), P(x('La réception définitive sera prononcée dans les mêmes formes à l’issue'))),
    ...SI('COMMANDE', P(x('<soit :> (Pour le cas d’un marché à commande)', ['<soit :> (Pour le cas d’un marché à commande) :', '', 'retire'])), P(x('La réception définitive sera prononcée dans les mêmes formes à la dernière'))),
    P(x("A l'issue des opérations d'essais", ["A l'issue des opérations d'essais et/ou inspections, la commission de réception prend sa décision de réception, d'ajournement, de réfaction ou de rejet dans un délai de <nombre> jours.", '{{B09-DI-01}}', 'jeton'])),
    ...E('Article 22.', 'Non applicable'),
    ...SI('SANS-GARANTIE', P(xr('=Non applicable', 3))),
    ...SI('GARANTIE',
      P(x('a) Les fournitures doivent être garanties', ['<nombre de mois> ans', '{{B09-DG-01}} mois', 'jeton'], [' <ou> à compter de la date de leur mise en service', '', 'retire'])),
      E('Le Fournisseur se conforme aux garanties', 'Le délai accordé au Fournisseur', [['paye à l', ['<taux de la pénalité>', '{{B09-DG-03.chiffres}} %', 'jeton']]]),
      P(x('Le délai accordé au Fournisseur', ['<durée>', '{{B09-DG-04}}', 'jeton']))),
    ...E('Article 23.', 'Le montant de l\'indemnisation éventuelle'),
    ...SI('INDEMNITE', P(x("Le montant de l'indemnisation éventuelle", ['<pourcentage>', '{{B10-IR-03.chiffres}}', 'jeton']))),
    ...E('Article 24.', 'Article 25'),
    P('{{B10-AR-01}}'),
    ...E('Article 25', ['Annexe au CCAP', 0]),
    P('{{B10-DD-01}}'),
    ...SI('REVISABLE', E(['Annexe au CCAP', 0], 'Annexe au CCAP')),
  );
  // Garanties de bonne exécution (modèles annexés), selon la forme ; réduction de moitié selon la retenue de garantie.
  const moitie = (motif) => P(x(motif));
  blocs.push(
    ...SI('BONNE-EXECUTION-BANCAIRE', E(['Annexe au CCAP', 1], 'La présente garantie sera réduite de moitié', [['(ci-après dénommé « le Fournisseur ») a conclu', AC]])),
    ...SI('BANCAIRE-MOITIE', moitie('La présente garantie sera réduite de moitié')),
    ...SI('BANCAIRE-ENTIERE', P(xr('La présente garantie demeurera valable jusqu’au trentième', 0))),
    ...SI('BONNE-EXECUTION-BANCAIRE', E('La présente garantie est régie par la loi malgache', 'Annexe au CCAP')),
    ...SI('BONNE-EXECUTION-CAUTION', E(['Annexe au CCAP', 2], 'Le présent engagement sera réduit de moitié')),
    ...SI('CAUTION-MOITIE', moitie('Le présent engagement sera réduit de moitié')),
    ...SI('CAUTION-ENTIERE', P(x('Le présent engagement demeurera valable'))),
    ...SI('BONNE-EXECUTION-CAUTION', E(['Le présent engagement est régi par la loi', 0], 'Annexe au CCAP')),
    ...SI('AVANCE-GARANTIE-BANCAIRE', E(['Annexe au CCAP', 3], 'Annexe au CCAP', [['( ci-après dénommé', AC], ['(ci-après dénommé', AC]])),
    ...SI('AVANCE-CAUTION', E(['Annexe au CCAP', 4])),
  );
  const titre = ligne(d, 'CAHIER DES PRESCRIPTIONS SPECIALES').texte;
  toutEstRendu(d, 'CCAP-F');
  return { fichier: 'CCAP-F.docx', sigle: 'CCAP-F', source: 'fournitures-ccap', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ DPIC des prestations intellectuelles ═══════════════════════════════════════════════════════════
// Source : « 2-Dossier type de consultation_PI_Données Particulières des Instructions aux candidats » (ARMP). Le
// fichier contient toute la première partie (page de garde, lettre d'invitation, IC) ; seul le tableau « 1.3 Données
// particulières » est décrit (arbitrage du pilote du 29/09, Q1 : les IC sont jointes telles quelles). Même facture que
// le DPAO des fournitures : les rédactions au choix sont DANS les cellules.
// Q3 (29/09) : la grille de notation garde ses cinq totaux (B06-TP-02 à -06) ; ses sous-critères, postes et
// pondérations restent des blancs VISIBLES, à compléter à la main. Q14 : le texte officiel est reproduit tel quel.
// Champs à créer (demande backend PI-1) : B04-EP-04 (délai de réponse de la PRMP), B05-PF-13 (budget disponible),
// B06-TP-07 (score technique minimum), B06-CS-02 et B06-CS-03 (poids T et F).
function dpicPi() {
  const SRC = lireSource('pi-dpic');
  const d = sectionCellules(SRC, '1.3. DONNEES PARTICULIERES', null);
  const tr = [];
  const x = (vue, motif, ...r) => { const u = ligne(vue, motif); return traiter(tr, u.n, u.texte, ...r); };
  const cel = (...ps) => ps.flat().filter((p) => p !== null && p !== undefined).join('\u001E');
  const SIc = (nom, ...ps) => [`{{SI:${nom}}}`, ...ps.flat(), `{{FINSI:${nom}}}`];
  const SIr = (nom, ...lignes) => [L(`{{SI:${nom}}}`, ''), ...lignes.flat(), L(`{{FINSI:${nom}}}`, '')];
  const clause = (vue) => vue.lignes.filter((u) => u.cellule === 0).map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; }).join('\u001E');
  /** Le n-ième paragraphe d'une vue qui commence par ce motif (une phrase répétée dans la même cellule). */
  const xr = (vue, motif, rang, ...r) => { const u = ligne(vue, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  /**
   * La n-ième rangée dont une cellule commence par ce motif (« Mode de rémunération » ouvre deux rangées). Le premier
   * paragraphe NON VIDE compte : les rangées 8.3 et 9 du modèle ouvrent leur cellule sur un paragraphe vide.
   */
  const rangeeN = (motif, cellule, rang = 0) => {
    const premier = (u) => !d.lignes.some((v) => v.ligne === u.ligne && v.cellule === u.cellule && v.p < u.p);
    const us = d.lignes.filter((u) => u.cellule === cellule && premier(u) && correspond(u, motif));
    if (us.length <= rang) throw new Error(`rangée « ${motif} » (rang ${rang}) absente`);
    return { ...d, lignes: d.lignes.filter((u) => u.ligne === us[rang].ligne) };
  };

  const conditions = {
    PROJET: 'B02-OP-01 renseigne',
    'SANS-PROJET': 'B02-OP-01 vide',
    // Le mode de sélection (B02-MS-01). ⚠️ Son option « Qualité technique, expérience et proposition financière » est
    // aujourd'hui coupée en deux par sa virgule au référentiel (constat du 29/09, demande PI-1) : la condition vise
    // « expérience », présent dans l'option corrigée.
    SFQC: 'B02-MS-01 contient expérience',
    BUDGET: 'B02-MS-01 contient budget prédéterminé',
    'MOINDRE-COUT': 'B02-MS-01 contient note technique minimale',
    'QUALITE-SEULE': 'B02-MS-01 contient exclusivement',
    // Une seule phrase pour les groupements ET la sous-traitance entre candidats de la liste restreinte.
    'ASSOCIATIONS-NON': 'groupement != OUI et B03-SP-01 != OUI',
    'ASSOCIATIONS-OUI': 'groupement = OUI ou B03-SP-01 = OUI',
    'DEUX-ENVELOPPES': 'B04-NP-01 contient financière',
    'TECHNIQUE-SEULE': 'B04-NP-01 contient uniquement',
    'POINTS-PARTICULIERS': 'B04-QT-03 renseigne',
    FORFAIT: 'B05-PF-01 = Prix forfaitaire',
    'BUDGET-DISPONIBLE': 'B05-PF-01 = Prix forfaitaire et B02-MS-01 contient budget prédéterminé',
    'TEMPS-PASSE': 'B05-PF-01 = Temps passé',
    'TEMPS-MAXIMUM': 'B05-PF-01 = Temps passé et B05-PF-04 renseigne',
    ALEA: 'B05-PF-01 = Temps passé et B05-PF-05 renseigne',
    RESULTAT: 'B05-PF-01 = Résultat',
    POURCENTAGE: 'B05-PF-01 contient coût estimatif',
    'POURCENTAGE-DEGRESSIF': 'B05-PF-01 contient coût estimatif et B05-PF-09 renseigne',
    'POURCENTAGE-BAREME': 'B05-PF-01 contient coût estimatif et B05-PF-10 renseigne',
    LANGUE: 'B04-LP-01 contient langue',
    'LANGUE-AUTRE': 'B04-LP-01 contient autre langue',
    'LANGUE-DEUX': 'B04-LP-01 contient seconde langue',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    DEVISE: 'B05-MP-01 renseigne',
    'REUNION-NON': 'B04-RU-01 != OUI',
    'REUNION-OUI': 'B04-RU-01 = OUI',
    PAPIER: 'modeRemise != ELECTRONIQUE',
    'B04-SE': 'modeRemise = ELECTRONIQUE',
    TRANSFERT: 'B06-TP-05 renseigne',
    FINANCIERE: 'B04-NP-01 contient financière',
    'DELAI-AE': 'B02-SP-01 renseigne',
  };
  const CLAUSE_SE = '[[CLAUSE À FOURNIR PAR LE JURISTE : conditions et modalités de la remise électronique des Propositions — plateforme ({{B04-SE-02}}), heure de référence ({{B04-SE-04}}), signature exigée ({{B04-SE-05}}), formats ({{B04-SE-07}}) et tailles admis ({{B04-SE-08}} Mo par fichier, {{B04-SE-09}} Mo par proposition), ouverture électronique en séance seulement, assistance ({{B04-SE-14}}), indisponibilité et prorogation ({{B04-SE-12}} h, {{B04-SE-13}} jours ouvrables)]]';
  const ajouts = [CLAUSE_SE, '{{B04-EP-01}}', '{{B05-PF-11}}', '{{B05-PF-12}}', '{{B04-FL-03}}', '{{B04-LH-01}}', '{{B06-NG-01}}'];

  retirer(d, 'note de rédaction du modèle, « à supprimer »', '[note 1]');
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>\s*:?$/i.test(l.texte));
  const intro = x(d, 'Les Données Particulières qui suivent', ['[note:1]', '', 'retire']);
  const entete = rangee(d, 'Clause des Instructions');

  // ── 1. Client et objet ; mode de sélection
  const r1 = rangee(d, '1. Client et objet');
  const client = cel(
    x(r1, '=Client:'),
    x(r1, '<insérer la dénomination et l', ['<insérer la dénomination et l’adresse du client>', '{{B02-CL-01}}', 'jeton']),
    x(r1, '=Marché'),
    SIc('PROJET', x(r1, 'Le marché, objet de la présente', ['<préciser, le cas échéant, si le marché fait partie d\'un projet ou d\'une opération plus vaste>', '{{B02-OP-01}}', 'jeton'])),
    SIc('SANS-PROJET', x(r1, 'Le marché, objet de la présente', ['s\'inscrit dans <préciser, le cas échéant, si le marché fait partie d\'un projet ou d\'une opération plus vaste>. Il ', '', 'retire'])),
    x(r1, "<décrire l'objet principal", ["<décrire l'objet principal du Marché>", '{{B02-OP-02}}', 'jeton']),
    x(r1, 'La date prévue pour le début', ['<insérer la date>', '{{B02-OP-03}}', 'jeton']),
    x(r1, 'Mode de sélection'),
    x(r1, 'Le Consultant sera sélectionné'),
    SIc('SFQC', x(r1, 'de la qualité technique de la proposition')),
    SIc('BUDGET', x(r1, "d’un budget prédéterminé")),
    SIc('MOINDRE-COUT', x(r1, 'de la meilleure proposition financière')),
    SIc('QUALITE-SEULE', x(r1, 'exclusivement de la qualité technique')));
  retirer(r1, 'instruction à l’acheteur', '<indiquer le mode de sélection');

  // ── 2. Groupements et sous-traitance
  const r2 = rangee(d, '2. Groupements');
  const associations = cel(
    SIc('ASSOCIATIONS-NON', x(r2, 'Les groupements et accords de sous - traitance')),
    SIc('ASSOCIATIONS-OUI', x(r2, 'Les groupements et accords de sous-traitance')));

  // ── 5. Éclaircissements
  const r5 = rangee(d, '5. – Dossier de Consultation');
  const r52 = rangee(d, '5.2. Demande');
  const eclaircissements = cel(
    x(r52, 'Adresse de la PRMP'),
    x(r52, "Afin d’obtenir des éclaircissements"),
    '{{B04-EP-01}}',
    x(r52, 'Adresse électronique :', ['<insérer l’adresse électronique>', '{{B04-EP-02}}', 'jeton']),
    x(r52, "Délai pour l'envoi des demandes"),
    x(r52, '<nombre de jours supérieur', ['<nombre de jours supérieur ou égal à dix>', '{{B04-EP-03}}', 'jeton']),
    x(r52, 'Délai pour la réponse'),
    x(r52, '<nombre de jours sus mentionné', ['<nombre de jours sus mentionné diminué du délai de réponse estimé par la PRMP mais pas inférieur à six (6) jours>', '{{B04-EP-04}}', 'jeton']));
  retirer(r52, "adresse de la PRMP : saisie d'un bloc dans B04-EP-01 (nom, rue, bureau, ville, code postal, télécopie)",
    'Attention de :', 'Rue :', 'Étage/numéro de Bureau', 'Ville :', 'Code postal', 'Numéro de télécopie');

  // ── 6. Assistance du client
  const r6 = rangee(d, '6. Assistance du client');
  const intrants = cel(x(r6, 'Le client fournit les intrants', ['<énumérer les intrants à fournir par le client>', '{{B04-AI-01}}', 'jeton']));

  // ── 7. Préparation des propositions
  const r7 = rangee(d, '7 - Préparation');
  const r72 = rangee(d, '7.2. Contenu');
  const contenu = cel(
    x(r72, 'Les Candidats remettent'),
    SIc('DEUX-ENVELOPPES', x(r72, 'une Proposition technique et une Proposition financière')),
    SIc('TECHNIQUE-SEULE', x(r72, 'uniquement une proposition technique')));
  const r721 = rangee(d, '7.2.1. Proposition Technique');
  const technique = cel(
    x(r721, '=Qualifications'),
    x(r721, 'Les Candidats joignent'),
    x(r721, '1° Une fiche'),
    x(r721, '2° <le cas échéant:>', ['<le cas échéant:> ', '', 'retire']),
    x(r721, 'Description de la Proposition'),
    x(r721, 'La description de la Proposition technique doit'),
    x(r721, 'La composition de l'),
    x(r721, 'Les curriculum vitae'),
    x(r721, 'La Description de la méthodologie'),
    SIc('POINTS-PARTICULIERS', x(r721, '<indiquer ici, le cas échéant, les points', ["<indiquer ici, le cas échéant, les points que le Client souhaite plus particulièrement voir développer et le volume indicatif en nombre de pages format A4 de ce chapitre>", '{{B04-QT-03}}', 'jeton'])),
    x(r721, '<indiquer ici, le cas échéant:> Le calendrier', ['<indiquer ici, le cas échéant:> ', '', 'retire']));

  // ── 7.2.2 Proposition financière : le mode de rémunération (B05-PF-01), en deux rangées du modèle
  const r722 = rangee(d, '7.2.2. Proposition Financière');
  const forfait = cel(
    x(r722, 'Mode de rémunération'),
    SIc('FORFAIT',
      x(r722, "a) Le Marché est rémunéré sur la base d'un prix forfaitaire"),
      x(r722, 'Les Candidats indiquent un montant global'),
      x(r722, 'La rémunération forfaitaire ainsi que'),
      x(r722, 'décomposés en coûts en devises'),
      x(r722, 'ventilés par activité'),
      SIc('BUDGET-DISPONIBLE',
        x(r722, 'le budget disponible est de', ['<montant>', '{{B05-PF-13}}', 'jeton']),
        x(r722, 'Les propositions financières d’un montant supérieur')),
      x(r722, 'Les paiements sont liés aux prestations')));
  retirer(r722, 'instruction à l’acheteur', '<indiquer ici le mode de rémunération', '<ajouter le cas échéant>');
  const r722b = rangeeN('Mode de rémunération', 1, 1);
  const autresModes = cel(
    x(r722b, 'Mode de rémunération'),
    SIc('TEMPS-PASSE',
      x(r722b, 'b) Le Marché est rémunéré au temps passé'),
      x(r722b, '=Les Candidats indiquent:'),
      x(r722b, 'les taux unitaires'),
      x(r722b, 'les frais remboursables mentionnés ci-après'),
      x(r722b, 'Les frais divers mentionnés ci-après'),
      x(r722b, 'La durée prévisionnelle des Prestations'),
      x(r722b, '<soit:> <nombre> jours', ['<soit:> <nombre> jours,', '{{B05-PF-03}}.', 'jeton']),
      SIc('TEMPS-MAXIMUM', x(r722b, '<Ajouter, le cas échéant:> le montant global', ['<Ajouter, le cas échéant:> ', '', 'retire'], ['<montant>', '{{B05-PF-04}}', 'jeton'])),
      SIc('ALEA', x(r722b, '<compléter le cas échéant par la mention', ['<compléter le cas échéant par la mention suivante:> ', '', 'retire'], ['<montant>', '{{B05-PF-05}}', 'jeton']))),
    SIc('RESULTAT',
      x(r722b, 'c) <dans le cas de prestations destinées', ['<dans le cas de prestations destinées à conduire à un résultat, tel que la privatisation d\'une entreprise ou la cession d\'un bien:> ', '', 'retire']),
      x(r722b, 'une rémunération de base forfaitaire'),
      x(r722b, 'une rémunération finale', ['<ou>', 'ou', 'choix'],
        ['<indiquer un montant ou le mode de calcul, par exemple un pourcentage de la cession à effectuer, avec ou sans plafond>', '{{B05-PF-06}}', 'jeton'],
        ["<indiquer l'événement déclenchant la rémunération finale>", '{{B05-PF-07}}', 'jeton']),
      // Mêmes phrases qu'au temps passé : deuxième occurrence dans la cellule.
      xr(r722b, 'les frais remboursables mentionnés ci-après', 1),
      xr(r722b, 'Les frais divers mentionnés ci-après', 1)),
    SIc('POURCENTAGE',
      x(r722b, 'Le Consultant sera rémunéré par un pourcentage'),
      x(r722b, '<indiquer la nature des montants', ['<indiquer la nature des montants servant de base à la rémunération>', '{{B05-PF-08}}', 'jeton']),
      SIc('POURCENTAGE-DEGRESSIF', x(r722b, 'calculé comme suit', ['<prévoir un barème dégressif en fonction du volume des montants servant de base à la rémunération>', '{{B05-PF-09}}', 'jeton'])),
      SIc('POURCENTAGE-BAREME', x(r722b, 'calculé par application du barème', ['<indiquer la profession et les références du barème>', '{{B05-PF-10}}', 'jeton']))));
  retirer(r722b, "unité de la durée choisie dans la saisie libre B05-PF-03 (« 3 mois », « 12 semaines »)", '<soit:> <nombre> semaines', '<soit:> <nombre> mois');
  retirer(r722b, 'instruction à l’acheteur', '<le cas échéant une rémunération au temps passé');
  // « d) <dans le cas de prestations liées…> » : l'instruction retirée, il ne resterait que « d) », que la lecture d'un
  // DAO rempli reconnaissait dans la grille de notation (« d) <Indiquer le poste> ») en sautant tout ce qui la précède
  // (mesure du 29/09). Une seule rédaction est imprimée : la lettre de l'option n'a pas d'objet.
  retirer(r722b, "intitulé d'option réduit à sa lettre une fois l'instruction retirée", 'd) <dans le cas de prestations liées');
  retirer(r722b, 'pourcentage saisi avec la nature des montants dans B05-PF-08', 'égale à <pourcentage>');
  const rFrais = rangee(d, 'Frais remboursables', 1);
  const frais = cel(
    x(rFrais, 'Frais remboursables'),
    x(rFrais, 'Les Candidats devront fournir les coûts'),
    '{{B05-PF-11}}',
    x(rFrais, '=Frais divers'),
    '{{B05-PF-12}}');
  retirer(rFrais, 'instruction à l’acheteur', '<Donner ici la liste des dépenses', 'Donner ici la liste des frais');
  retirer(rFrais, "listes d'exemples du modèle, « à adapter » : remplacées par les saisies B05-PF-11 et B05-PF-12",
    'le coût des voyages', 'le coût, la location', 'le coût d’autres postes', 'indemnité journalière', 'un budget forfaitaire pour le coût des communications',
    "un budget forfaitaire pour le coût d’impression", 'un budget forfaitaire pour le coût des espaces');

  const r73 = rangee(d, '7.3. Langue');
  const langue = cel(
    SIc('LANGUE-AUTRE', x(r73, "La langue de l'offre est:"), x(r73, '<indiquer la langue de l', ["<indiquer la langue de l'offre différente du français>", '{{B04-LP-02}}', 'jeton'])),
    SIc('LANGUE-DEUX', x(r73, "La langue de l'offre est le français ou", ['<préciser la deuxième langue de l\'offre>', '{{B04-LP-02}}', 'jeton'])));
  retirer(r73, 'instruction à l’acheteur', '<Dans le cas où une langue');
  const r74 = rangee(d, '7.4. Délai de validité');
  const validite = cel(x(r74, 'Le délai de validité', ['<nombre>', '{{B04-DP-01}}', 'jeton']));
  const r75 = rangee(d, '7.5. Caractère ferme');
  const prix = cel(SIc('FERME', x(r75, 'Les prix sont fermes')), SIc('REVISABLE', x(r75, 'Les prix sont révisables')));
  const r76 = rangee(d, '7.6. Monnaie');
  const monnaie = cel(x(r76, 'Les prix des Prestations et dépenses sont exprimés', ['<nom de la devise convertible>', '{{B05-MP-01}}', 'jeton']));
  retirer(r76, 'instruction à l’acheteur', "<dans le cas où les prix");
  retirer(r76, 'variante couverte par la saisie libre B05-MP-01 (devise et prestations concernées)', 'Les prix des Prestations réalisées par du Personnel étranger');
  const r77 = rangee(d, '7.7. Réunion');
  const reunion = cel(
    SIc('REUNION-NON', x(r77, "Il n'est pas prévue")),
    SIc('REUNION-OUI', x(r77, 'Les représentants des Candidats sont invités'), x(r77, '<insérer l’adresse complète>', ['<insérer l’adresse complète>', '{{B04-RU-02}}', 'jeton'])));
  retirer(r77, 'lieu, date et heure saisis ensemble dans B04-RU-02', 'le <insérer la date', 'à < insérer');

  // ── 8. Remise des propositions
  const r8 = rangee(d, '8. – Remise');
  const r81 = rangee(d, '8.1. Forme des plis');
  const plis = cel(
    x(r81, 'Outre l’original', ['<insérer le nombre de copies>', '{{B04-FL-01}}', 'jeton']),
    x(r81, 'Les enveloppes intérieure', ['<insérer le nom et/ou le numéro qui doit apparaître sur l’enveloppe de la Proposition pour identifier ce processus de passation des marchés>', '{{B04-FL-02}}', 'jeton']),
    x(r81, 'Aux fins de remise des Propositions, uniquement, l’adresse du Client'),
    '{{B04-FL-03}}');
  retirer(r81, "adresse du Client : saisie d'un bloc dans B04-FL-03", 'Attention :', 'Adresse:', 'Étage/Numéro', 'Ville :', 'Code postal');
  const r82 = rangee(d, '8.2. Lieu, date');
  const remise = cel(
    x(r82, 'Aux fins de remise des Propositions, uniquement, l’adresse de l’Autorité'),
    '{{B04-LH-01}}',
    x(r82, 'La date et heure limites', ['<insérer la date et heure>', '{{B04-LH-02}}', 'jeton']));
  retirer(r82, "adresse de remise : saisie d'un bloc dans B04-LH-01", 'Attention :', 'Adresse:', 'Étage/Numéro', 'Ville :', 'Code postal');
  retirer(r82, 'date et heure saisies ensemble dans B04-LH-02', 'Date :', 'Heure :');
  const r83 = rangeeN('8.3. Remise des Propositions par voie', 0);
  const electronique = cel(SIc('PAPIER', x(r83, 'Le mode de remise des Propositions par voie électronique')), SIc('B04-SE', CLAUSE_SE));
  retirer(r83, 'instruction à l’acheteur (les conditions de la remise électronique sont demandées au juriste)', "<s'il n'est pas possible", '<Dans le cas où il est possible');

  // ── 9. Évaluation : la grille (Q3 — cinq totaux ; le détail reste en blanc visible)
  const r9 = rangeeN('9. Ouverture des plis', 0);
  const r93 = rangee(d, '9.3. Évaluation');
  const grille = cel(
    x(r93, 'La CAO évalue'),
    x(r93, 'Une note comprise entre'),
    x(r93, 'Les critères, sous-critères'),
    x(r93, 'Points'),
    x(r93, '(i) Expérience', ['<de 0 à 10>', '{{B06-TP-02}}', 'jeton']),
    x(r93, '(ii) Conformité'),
    x(r93, 'a) Approche technique'),
    x(r93, 'b)Plan de travail'),
    x(r93, 'c) Organisation'),
    x(r93, 'Total des points pour le critère (ii)', ['<de 20 à 50>', '{{B06-TP-03}}', 'jeton']),
    x(r93, '(iii) Qualifications'),
    x(r93, 'a) Chef de mission'),
    x(r93, 'b) <Indiquer le poste'),
    x(r93, 'c) <Indiquer le poste'),
    x(r93, 'd) <Indiquer le poste'),
    x(r93, 'Total des points pour le critère (iii)', ['<de 30 à 60>', '{{B06-TP-04}}', 'jeton']),
    x(r93, 'Le nombre de points attribués'),
    x(r93, '1)Qualifications générales'),
    x(r93, '2)Pertinence'),
    x(r93, '3)Expérience de la région'),
    x(r93, 'Pondération totale'));
  retirer(r93, "instruction à l’acheteur sur l'emploi des sous-critères", '<Il est possible', "Le critère relatif à l'expérience du Candidat peut", 'Le poids accordé à la méthodologie');
  const r93b = rangee(d, '(iv) Adéquation', 1);
  const transfert = cel(
    SIc('TRANSFERT',
      x(r93b, '(iv) Adéquation'),
      x(r93b, 'a)Pertinence du programme'),
      x(r93b, 'b)Modalité de formation'),
      x(r93b, 'c)Qualifications des experts'),
      x(r93b, 'Total des points pour le critère (iv)', ['<de 0 à 10>', '{{B06-TP-05}}', 'jeton'])),
    x(r93b, '(v)Participation'));
  retirer(r93b, 'instruction à l’acheteur', '<A utiliser lorsque');
  const r93c = rangee(d, '<de 0 à 10>', 0);
  const total = cel(
    x(r93c, '<de 0 à 10>', ['<de 0 à 10>', '{{B06-TP-06}}', 'jeton']),
    x(r93c, 'Total des points pour les cinq'),
    x(r93c, 'Le score technique minimum'),
    x(r93c, '<nombre > Points', ['<nombre >', '{{B06-TP-07}}', 'jeton']));
  const r94 = rangee(d, '9.4. Ouverture des Propositions financières');
  const ouvertureF = cel(
    SIc('DEVISE', x(r94, 'Les prix exprimés en devises'), x(r94, '<date correspondant au quinzième')),
    SIc('FINANCIERE', x(r94, 'Aux fins de calcul du score final'), x(r94, 'Sf = 100')));
  retirer(r94, 'instruction à l’acheteur', '<Dans le cas où les Propositions');
  const r95 = rangee(d, '9.5. Classement');
  const classement = cel(
    x(r95, 'Pour l\'établissement du classement'),
    x(r95, 'T =', ['<entre 0,6 et 0,8>', '{{B06-CS-02}}', 'jeton']),
    x(r95, 'F =', ['<entre 0,4 et 0,2>', '{{B06-CS-03}}', 'jeton']),
    x(r95, 'Total égal à'));
  const r10 = rangee(d, '10. Adresse des négociations');
  const negociations = cel(x(r10, 'Les négociations auront lieu'), '{{B06-NG-01}}');
  retirer(r10, "adresse des négociations : saisie d'un bloc dans B06-NG-01", 'Adresse:', 'Étage/Numéro', 'Ville :');
  const r11 = rangee(d, "11. Signature de l'Acte");
  const signature = cel(x(r11, "Le Candidat devra renvoyer", ['<nombre de jours>', '{{B02-SP-01}}', 'jeton']));
  retirer(r11, 'instruction à l’acheteur', '<dans le cas où le Client souhaite');

  const blocs = [
    P(intro),
    T(2),
    L(...entete.lignes.map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; })),
    L(clause(r1), client),
    L(clause(r2), associations),
    L(clause(r5), ''),
    L(clause(r52), eclaircissements),
    L(clause(r6), intrants),
    L(clause(r7), ''),
    L(clause(r72), contenu),
    L(clause(r721), technique),
    L(clause(r722), forfait),
    L(clause(r722b), autresModes),
    L(clause(rFrais), frais),
    ...SIr('LANGUE', L(clause(r73), langue)),
    L(clause(r74), validite),
    L(clause(r75), prix),
    ...SIr('DEVISE', L(clause(r76), monnaie)),
    L(clause(r77), reunion),
    L(clause(r8), ''),
    L(clause(r81), plis),
    L(clause(r82), remise),
    L(clause(r83), electronique),
    L(clause(r9), ''),
    L(clause(r93), grille),
    L(clause(r93b), transfert),
    L('', total),
    L(clause(r94), ouvertureF),
    ...SIr('SFQC', L(clause(r95), classement)),
    L(clause(r10), negociations),
    ...SIr('DELAI-AE', L(clause(r11), signature)),
    FIN,
  ];
  const titre = [ligne(d, '1.3. DONNEES PARTICULIERES').texte, ligne(d, 'DES INSTRUCTIONS AUX CANDIDATS').texte].join(' ');
  toutEstRendu(d, 'DPIC-PI');
  return { fichier: 'DPIC-PI.docx', sigle: 'DPIC-PI', source: 'pi-dpic', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ AE des prestations intellectuelles ═════════════════════════════════════════════════════════════
// Source : « 4-Dossier type de consultation_PI_Acte d'engagement » (ARMP). Comme aux fournitures, l'acte d'engagement
// est le document du CANDIDAT — en PI il est même préparé APRÈS la négociation (IC 10.3) : identité, montants,
// domiciliation, choix de l'avance, signatures et contenu des annexes restent en blanc. La fiche remplit les trous de
// l'acheteur (autorité, marché, imputation, PRMP, n° des annexes de sous-traitance, durée, pièces contractuelles) et
// choisit les blocs : mode de rémunération (B05-PF-01), révision, sous-traitance, durée, groupement, avance.
function aePi() {
  const SRC = lireSource('pi-ae');
  const d = sectionCellules(SRC, "2.1. CADRE D'ACTE D'ENGAGEMENT", null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (motif, rang, ...r) => { const u = ligne(d, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  const E = emetteur(d, tr);

  const conditions = {
    GROUPEMENT: 'groupement = OUI',
    'GROUPEMENT-CONJOINT': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    REVISABLE: 'prixRevisable = OUI',
    'TEMPS-PASSE': 'B05-PF-01 = Temps passé',
    FORFAIT: 'B05-PF-01 = Prix forfaitaire',
    RESULTAT: 'B05-PF-01 = Résultat',
    'POURCENTAGE-PROFESSION': 'B05-PF-01 contient coût estimatif et B05-PF-10 renseigne',
    'POURCENTAGE-DPIC': 'B05-PF-01 contient coût estimatif et B05-PF-10 vide',
    'SANS-SOUS-TRAITANCE': 'B03-SP-01 != OUI',
    'SOUS-TRAITANCE': 'B03-SP-01 = OUI',
    // « <Insérer le cas échéant> » : le délai court de l'ordre de service de commencer. ⚠️ 29/09 : B09-DP-01 est un OUI_NON
    // (livraison PI-1) — « renseigne » imprimerait la phrase pour un « Non ».
    'DEPART-OS': 'B09-DP-01 = OUI',
    'DUREE-MOIS': 'B09-DP-03 = Nombre de mois',
    'DUREE-DATE': 'B09-DP-03 = Date de fin de marché',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'ANNEXE-FORFAIT': 'B05-PF-01 != Temps passé',
    'ANNEXE-TEMPS': 'B05-PF-01 = Temps passé',
  };
  const ajouts = [];

  retirer(d, 'titre de partie du dossier type', "2.1. CADRE D'ACTE D'ENGAGEMENT");
  retirer(d, 'note aux utilisateurs, « à supprimer dans le DC définitif »', 'Note aux utilisateurs', "L'Acte d’Engagement signé par le candidat", "L'Acte d’Engagement est ensuite signé", 'Les commentaires entre');
  retirer(d, 'instruction à l’acheteur', '<Dans le cas où les prix sont révisables', "Dans le cas d'une rémunération au temps passé :", "Dans le cas d'un marché à prix forfaitaire :",
    '<dans le cas de prestations destinées', '<dans le cas de prestations liées', 'Rayer les dispositions', '<Insérer le cas échéant>');
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', '=Soit :', '=<ou>', (l) => /^<\s*soit\s*>$/i.test(l.texte));

  const MARCHE = "<Indiquer: l'intitulé principal du Marché, le cas échéant le projet dans le cadre duquel le marché est passé, ou le numéro et l'objet du lot compris dans le projet >";
  const blocs = [
    C(x("ACTE D'ENGAGEMENT (A.E)")),
    ...E('AUTORITE CONTRACTANTE', "<Indiquer: l'intitulé", [['<indiquer le nom >', ['<indiquer le nom >', '{{B01-AC-01}}', 'jeton']]]),
    P(x("<Indiquer: l'intitulé", [MARCHE, '{{B02-OB-01}}', 'jeton'])),
    ...E('Marché passé selon', "Engagement à remplir par les MEMBRES", [
      ['Imputation budgétaire', ['<à préciser>', '{{B01-AC-17}}', 'jeton']],
      ['<insérer le nom>', ['<insérer le nom>', '{{B02-CL-02}}', 'jeton']]]),
    ...SI('GROUPEMENT', E("Engagement à remplir par les MEMBRES", 'ARTICLE 2 - PRIX')),
    ...E('ARTICLE 2 - PRIX', 'Les modalités de variation des prix'),
    ...SI('REVISABLE', P(x('Les modalités de variation des prix'))),
    ...SI('TEMPS-PASSE', E('Les Prestations, objet du présent marché, sont rémunérées, par application des taux', 'Les Prestations, objet du présent marché, sont rémunérées par application du prix global')),
    ...SI('FORFAIT', E('Les Prestations, objet du présent marché, sont rémunérées par application du prix global', '(le Consultant indique ici la rémunération de base')),
    ...SI('RESULTAT', E('(le Consultant indique ici la rémunération de base', '(le Consultant indique ici la rémunération proportionnelle')),
    ...SI('POURCENTAGE-PROFESSION', P(x('(le Consultant indique ici la rémunération proportionnelle', ['<soit> ', '', 'retire'], [' <soit> du barème indiqué à la clause 6.2.1 des DPIC', '', 'retire']))),
    ...SI('POURCENTAGE-DPIC', P(x('(le Consultant indique ici la rémunération proportionnelle', ['<soit> du barème en usage dans la profession <soit> ', '', 'retire']))),
    ...E('ARTICLE 3', "Il n'est pas envisagé"),
    ...SI('SANS-SOUS-TRAITANCE', E("Il n'est pas envisagé", 'l’Annexe n° <préciser')),
    ...SI('SOUS-TRAITANCE', E('l’Annexe n° <préciser', 'ARTICLE 4', [
      ['l’Annexe n° <préciser n°> au présent', ['<préciser n°>', '{{B03-SP-02}}', 'jeton']],
      ['L’Annexe n° <préciser n°> constitue', ['<préciser n°>', '{{B03-SP-04}}', 'jeton']]])),
    ...E('ARTICLE 4', 'Le délai de réalisation des Prestations prend effet'),
    ...SI('DEPART-OS', P(x('Le délai de réalisation des Prestations prend effet'))),
    ...E('5.2. Délai', 'La durée globale du marché'),
    ...SI('DUREE-MOIS', P(x('La durée globale du marché', ['<nombre à préciser>', '{{B09-DP-04}}', 'jeton']))),
    ...SI('DUREE-DATE', P(x('Le marché prendra fin', ['<date à préciser>', '{{B09-DP-04}}', 'jeton']))),
    ...E('Le calendrier de réalisation', "Dans le cas d'un groupement de Consultants solidaires"),
    ...SI('GROUPEMENT', E("Dans le cas d'un groupement de Consultants solidaires", "Dans le cas d'un groupement de Consultants conjoints")),
    ...SI('GROUPEMENT-CONJOINT', E("Dans le cas d'un groupement de Consultants conjoints", '6.2 Avance')),
    ...E('6.2 Avance', 'Le CCAP ne prévoit pas'),
    ...SI('SANS-AVANCE', P(x('Le CCAP ne prévoit pas'))),
    ...SI('AVANCE', E('Le Consultant désigné ci-avant', 'Fait en un seul original')),
    ...E('Fait en un seul original', 'Annexe n° 1 :'),
    ...SI('ANNEXE-FORFAIT', P(x("Annexe n° 1 : <Dans le cas d'un prix forfaitaire>", ["<Dans le cas d'un prix forfaitaire>: ", '', 'retire']))),
    ...SI('ANNEXE-TEMPS', P(x("Annexe n° 1 : <dans le cas d'un marché au temps passé>", ["<dans le cas d'un marché au temps passé>: ", '', 'retire']))),
    ...E(['Annexe n° <', 0], ['Annexe n° <', 3]),
    ...SI('REVISABLE', P(xr('Annexe n° <', 3, ['<en cas de prix révisables>: ', '', 'retire']))),
    ...SI('SOUS-TRAITANCE', P(xr('Annexe n° <', 4))),
    ...E(['Annexe n° <', 5], 'Autres pièces contractuelles'),
    P(x('Autres pièces contractuelles', ['<à préciser selon les cas>', '{{B09-DK-01}}', 'jeton'])),
    ...E('En sus de', ['=ANNEXE', 0]),
    ...SI('ANNEXE-FORFAIT', E(['=ANNEXE', 0], '=ANNEXE')),
    ...SI('ANNEXE-TEMPS', E(['=ANNEXE', 1], '=ANNEXE')),
    ...E(['=ANNEXE', 2], ['=ANNEXE', 2]),
    ...SI('REVISABLE', E(['=ANNEXE', 5], '=ANNEXE')),
    ...SI('SOUS-TRAITANCE', E(['=ANNEXE', 6], '=ANNEXE')),
    ...E(['=ANNEXE', 7]),
  ];
  const titre = ligne(d, 'MARCHÉ PUBLIC DE PRESTATIONS INTELLECTUELLES').texte;
  toutEstRendu(d, 'AE-PI');
  return { fichier: 'AE-PI.docx', sigle: 'AE-PI', source: 'pi-ae', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ CPS des prestations intellectuelles (rôle du CCAP) ═════════════════════════════════════════════
// Source : « 5-Dossier type de consultation_PI_Cahier Prescriptions Spéciales » (ARMP) : le CCAP en 21 articles, ses
// annexes (formule de révision, garantie bancaire et caution de restitution d'avance), puis les Termes de référence,
// réduits à une instruction (arbitrage Q11 : pièce téléversée par l'acheteur). Ce que le modèle donne « par exemple »
// (termes de paiement, documents contractuels, vérification, clause d'arbitrage CNUDCI) est remplacé par la saisie, comme
// aux fournitures ; les blancs sans champ (indices, assurances autres qu'automobile, millièmes des pénalités, ville
// d'élection de domicile) restent VISIBLES. Q14 : texte officiel tel quel (« travaux », « article 160 », formule en « }} »).
// Champs à créer (PI-1) : B08-AI-03 (taux de l'avance), B09-OP-02 (délai de vérification). Le lieu d'exécution s'écrit
// dans l'objet (B02-OP-02), que le trou demande ensemble (« l'objet et le lieu ») : deux jetons collés par un tiret ne
// se relisent pas à l'import (mesure du 29/09).
function cpsPi() {
  const SRC = lireSource('pi-cps');
  const d = sectionCellules(SRC, '2.2.  CAHIER DES PRESCRIPTIONS SPECIALES', null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (motif, rang, ...r) => { const u = ligne(d, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  /** Le texte entier d'un paragraphe-instruction, pour le remplacer d'un bloc par un jeton. */
  const texteDe = (motif) => d.lignes.find((l) => correspond(l, motif)).texte;
  const E = emetteur(d, tr, /^(Article \d|\d+\.\d+\.?\s*-?\s|Annexe au CCAP$|CAHIER DES CLAUSES|Termes de référence$)/);

  const conditions = {
    PROJET: 'B02-OP-01 renseigne',
    'SANS-PROJET': 'B02-OP-01 vide',
    'GROUPEMENT-SOLIDAIRE': 'groupement = OUI et formeGroupement = SOLIDAIRE_OBLIGATOIRE',
    'GROUPEMENT-LIBRE': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    'SECURITE-NON': 'B09-MS-01 != OUI',
    'SECURITE-OUI': 'B09-MS-01 = OUI',
    'ASSISTANCE-NON': 'B09-AI-01 != OUI',
    'ASSISTANCE-OUI': 'B09-AI-01 = OUI',
    DEVISE: 'B05-MP-01 renseigne',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'AVANCE-ARIARY': 'avance = OUI et B05-MP-01 vide',
    'AVANCE-DEVISES': 'avance = OUI et B05-MP-01 renseigne',
    'REGLEMENT-COURT': 'B08-RP-01 renseigne',
    'REGLEMENT-TEMPS': 'B08-RP-02 renseigne',
    'REGLEMENT-ETAPES': 'B08-RP-03 renseigne',
    'MATERIEL-NON': 'B09-MF-01 != OUI',
    'MATERIEL-OUI': 'B09-MF-01 = OUI',
    'RESTITUTION-BANCAIRE': 'B09-MF-01 = OUI et B09-MF-02 = Garantie bancaire',
    'RESTITUTION-CAUTION': 'B09-MF-01 = OUI et B09-MF-02 contient caution',
    'RESTITUTION-CHEQUE': 'B09-MF-01 = OUI et B09-MF-02 contient chèque',
    // Q9 : l'art. 14 (un texte de fournitures) ne s'imprime que si le consultant fournit du matériel (B09-FC-01 réactivé).
    'FOURNITURE-MATERIEL': 'B09-FC-01 renseigne',
    'DEPART-OS': 'B09-DP-01 = OUI',
    // Q7 : le cadrage `penalites` (comme ailleurs) ; B09-PP-01 est à retirer (demande PI-1).
    'PENALITES-NON': 'penalites = NON',
    'PENALITES-OUI': 'penalites != NON',
    'PENALITES-PLAFOND': 'penalites = PLAFOND_DIFFERENT',
    'VERIFICATION-DELAI': 'B09-OP-02 renseigne',
    INDEMNITE: 'B10-IN-01 renseigne',
  };
  const ajouts = ['{{B09-NC-01}}', '{{B08-RP-01}}', '{{B08-RP-02}}', '{{B08-RP-03}}', '{{B10-PP-01}}', '{{B10-DP-01}}'];

  const repere = (texte) => d.lignes.find((u) => u.texte === texte).ligne;
  const table = repere('TABLE DES MATIERES');
  const art14 = d.lignes.find((u) => /^Article 14 –/.test(u.texte) && u.ligne > table + 40).ligne;
  const art15 = d.lignes.find((u) => /^Article 15 –/.test(u.texte) && u.ligne > table + 40).ligne;
  retirer(d, 'titre de partie du dossier type', (l) => l.ligne === d.lignes[0].ligne);
  retirer(d, 'note de rédaction du modèle, « à supprimer »', '[note 1]');
  retirer(d, 'sommaire : ses numéros de page ne valent que pour le document type', (l) => l.ligne === table || (l.ligne > table && l.ligne < table + 40 && /\s\d{1,2}$/.test(l.texte)));
  retirer(d, 'fin de la même instruction (références du marché)', 'le cas échéant, le projet dans le cadre', "ou le numéro et l'objet du lot compris");
  // Art. 14 : l'alternative des frais de stockage n'a pas de clé — elle reste visible, « <soit> : » compris.
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => (l.ligne < art14 || l.ligne >= art15) && /^<\s*soit\s*(,\s*le cas échéant\s*)?:?\s*>\s*:?$/i.test(l.texte));
  retirer(d, 'instruction à l’acheteur', '<préciser, lorsque le marché est divisé', '<Dans le cas où le paiement de tout', '<préciser les termes de paiement',
    '<insérer les couvertures', '<dans certains cas seules', '< si le', '<Préciser, en fonction de', '<Si un plafond aux pénalités', '<Lorsqu’il est nécessaire de modifier',
    '<dans le cas où le client souhaite fixer', "<dans le cas d'un marché passé avec un bureau", "<L'exemple de clause présenté");
  retirer(d, "documents d'exemple du modèle, remplacés par la saisie B09-DK-01", '-M.O. du consultant', '-Liste de personnel');
  retirer(d, "termes de paiement d'exemple (« par exemple, comme suit »), remplacés par les saisies B08-RP-01 à B08-RP-03",
    "<Pour les prestations d'une durée", 'Les prestations seront réglées en une seule fois', '<Pour les prestations à rémunération', 'Les prestations seront réglées sur la base',
    '<Pour les prestations donnant lieu', 'a) Vingt (20)', "<ou> à la date de prise", 'b) Dix (10)', 'c) Vingt-cinq', 'd) Vingt-cinq', 'e) Vingt (20)', 'f) La garantie bancaire sera libérée');
  retirer(d, "documents d'exemple du modèle, remplacés par la saisie B09-FC-01", '<nombre> exemplaires de la facture', 'le bon de livraison', 'le certificat de garantie du fabricant', 'pour les fournitures importées : le certificat');
  retirer(d, 'modalités de vérification d’exemple, remplacées par la saisie B09-OP-01', 'Les rapports à remettre par le Consultant');
  retirer(d, "clause d'arbitrage d'exemple (CNUDCI, « à valider »), remplacée par la saisie B10-PP-01", '<Exemple : clause', 'Tous litige', 'Le tribunal arbitral sera composé', "L'autorité de nomination sera", "A défaut d'accord des Parties");
  retirer(d, "Termes de référence : pièce téléversée par l'acheteur, jointe au dossier (arbitrage du pilote du 29/09, Q11)",
    '<Les Termes de référence comprennent', 'a) contexte général', 'b) objectifs', 'c) champ d’application', 'd) formation', 'e) rapports et calendrier', 'f) données, services locaux');

  const blocs = [
    C(x('MARCHÉ PUBLIC')),
    C(x('=DE PRESTATIONS INTELLECTUELLES')),
    C(x('=CAHIER DES PRESCRIPTIONS SPECIALES')),
    ...E('AUTORITE CONTRACTANTE', '<indiquer les références', [["<indiquer le nom et l'adresse>", ["<indiquer le nom et l'adresse>", '{{B02-CL-01}}', 'jeton']]]),
    P(x('<indiquer les références', ["<indiquer les références et l'intitulé principal du Marché,", '{{B02-OB-03}} — {{B02-OB-01}}', 'jeton'])),
    ...E('Marché passé selon', 'Article 1 - Objet', [
      ['<Insérer le nom>', ['<Insérer le nom>', '{{B02-CL-02}}', 'jeton']],
      ['Le CCAP est destiné', ['[note:1]', '', 'retire']]]),
    ...E('Article 1 - Objet', 'Les stipulations du présent'),
    ...SI('PROJET', P(x('Les stipulations du présent', ['<préciser le nom de l’opération, le cas échéant>', '{{B02-OP-01}}', 'jeton']))),
    ...SI('SANS-PROJET', P(x('Les stipulations du présent', [' dans le cadre de <préciser le nom de l’opération, le cas échéant>', '', 'retire']))),
    ...E("L'objet du présent marché", 'A défaut pour le Consultant', [
      ["<indiquer l'objet", ["<indiquer l'objet et le lieu d'exécution des travaux >", '{{B02-OP-02}}', 'jeton']],
      ["<Préciser les nom et coordonnées de l'Autorité", ["<Préciser les nom et coordonnées de l'Autorité Contractante>", '{{B02-CL-01}}', 'jeton']],
      ['<Préciser les nom et coordonnées>', ['<Préciser les nom et coordonnées>', '{{B02-CL-02}}', 'jeton']]]),
    P(x('A défaut pour le Consultant')),
    P('{{B09-NC-01}}'),
    ...E('Article 3 -', 'Les Consultants groupés seront considérés comme solidaires'),
    ...SI('GROUPEMENT-SOLIDAIRE', P(x('Les Consultants groupés seront considérés comme solidaires'))),
    ...SI('GROUPEMENT-LIBRE', P(x('Les Consultants groupés seront considérés comme solidaires')), P(x('Les Consultants groupés seront considérés comme conjoints'))),
    ...E('Article 4 -', 'Article 5 -', [['<Enumérer', [texteDe('<Enumérer'), '{{B09-DK-01}}', 'jeton']]]),
    ...E('Article 5 -', 'Article 6 -', [['Les éventuelles demandes', ['<nombre de jours>', '{{B09-MV-01}}', 'jeton']]]),
    ...E('Article 6 -', '=Non applicable'),
    ...SI('SECURITE-NON', P(xr('=Non applicable', 0))),
    ...SI('SECURITE-OUI', E('Les travaux, objet du présent Marché', 'Article 7')),
    ...E('Article 7', '=Non applicable'),
    ...SI('ASSISTANCE-NON', P(xr('=Non applicable', 1))),
    ...SI('ASSISTANCE-OUI', P(x('Le Client fournit les intrants', ['<énumérer les intrants à fournir par le client>', '{{B09-AI-02}}', 'jeton']))),
    ...E('Article 8 -', 'Les prix du Marché peuvent comporter'),
    ...SI('DEVISE', E('Les prix du Marché peuvent comporter', '8.2.', [['Les prix du Marché peuvent comporter', ['<nom de la devise convertible>', '{{B05-MP-01}}', 'jeton']]])),
    ...E('8.2.', 'Les prix sont fermes'),
    ...SI('FERME', E('Les prix sont fermes', 'Les prix seront révisés')),
    ...SI('REVISABLE', P(x('Les prix seront révisés'))),
    ...E('Article 9.', '=Non applicable'),
    ...SI('SANS-AVANCE', P(xr('=Non applicable', 2))),
    ...SI('AVANCE', P(x("Le montant de l'avance forfaitaire est de"))),
    ...SI('AVANCE-ARIARY', P(x('<pourcentage> du montant total des travaux', ['<pourcentage>', '{{B08-AI-03.chiffres}} %', 'jeton']))),
    ...SI('AVANCE-DEVISES', P(x('<pourcentage> du montant en monnaie nationale', ['<pourcentage>', '{{B08-AI-03.chiffres}} %', 'jeton'])), P(x('<pourcentage> du montant en devises'))),
    ...SI('AVANCE', P(x('Si le Consultant choisit de recevoir'))),
    ...E('Article 10 -', 'Article 11 -'),
    ...SI('REGLEMENT-COURT', P('{{B08-RP-01}}')),
    ...SI('REGLEMENT-TEMPS', P('{{B08-RP-02}}')),
    ...SI('REGLEMENT-ETAPES', P('{{B08-RP-03}}')),
    ...E('Article 11 -', 'Article 12', [['Taux des intérêts moratoires', ['< au moins un>', '{{B08-IP-01.chiffres}}', 'jeton']]]),
    ...E('Article 12', 'Article 13', [['Assurance automobile', ['<insérer le montant >', '{{B09-AP-01}}', 'jeton']]]),
    ...E('Article 13', '=Non applicable.'),
    ...SI('MATERIEL-NON', P(x('=Non applicable.'))),
    ...SI('MATERIEL-OUI', P(x('Au titre de garantie de restitution'))),
    ...SI('RESTITUTION-BANCAIRE', P(x('- une garantie bancaire'))),
    ...SI('RESTITUTION-CAUTION', P(x('-un engagement de caution'))),
    ...SI('RESTITUTION-CHEQUE', P(x('- un cautionnement en numéraire'))),
    ...E('Article 14', 'Les frais de stockage chez le Consultant'),
    ...SI('FOURNITURE-MATERIEL', E('Les frais de stockage chez le Consultant', 'Article 15', [
      ['<Préciser les documents à fournir', ['<Préciser les documents à fournir par le Fournisseur, par exemple>', '{{B09-FC-01}}', 'jeton']]])),
    ...E('Article 15', "Le délai d'exécution du Marché fixé"),
    ...SI('DEPART-OS', P(x("Le délai d'exécution du Marché fixé"))),
    ...E('Article 16', 'Les pénalités journalières prévues'),
    ...SI('PENALITES-NON', P(x('Les pénalités journalières prévues'))),
    ...SI('PENALITES-OUI', P(x('Les pénalités journalières applicables')), P(x('<millièmes>'))),
    ...SI('PENALITES-PLAFOND', P(x('Le montant des pénalités est limité'))),
    ...E('Article 17', 'Article 18', [['<Introduire ici', [texteDe('<Introduire ici'), '{{B09-UR-01}}', 'jeton']]]),
    ...E('Article 18', 'La commission de réception', [['<indiquer les modalités de vérification', [texteDe('<indiquer les modalités de vérification'), '{{B09-OP-01}}', 'jeton']]]),
    ...SI('VERIFICATION-DELAI', P(x('La commission de réception', ['<indiquer le nombre de jours:>', '{{B09-OP-02}}', 'jeton']))),
    ...E('Article 19', "L'indemnité forfaitaire"),
    ...SI('INDEMNITE', P(x("L'indemnité forfaitaire", ['<pourcentage>', '{{B10-IN-01.chiffres}} %', 'jeton']))),
    ...E('Article 20', 'Article 21'),
    P('{{B10-PP-01}}'),
    ...E('Article 21', '=Annexe au CCAP'),
    P('{{B10-DP-01}}'),
    ...SI('REVISABLE', E(['=Annexe au CCAP', 0], '=Annexe au CCAP')),
    ...SI('AVANCE', E(['=Annexe au CCAP', 1], '=Termes de référence')),
    ...E('=Termes de référence'),
  ];
  const titre = [ligne(d, 'MARCHÉ PUBLIC').texte, ligne(d, '=DE PRESTATIONS INTELLECTUELLES').texte].join(' ');
  toutEstRendu(d, 'CPS-PI');
  return { fichier: 'CPS-PI.docx', sigle: 'CPS-PI', source: 'pi-cps', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ DPAO des travaux (marché ordinaire, à tranches ou alloti) ════════════════════════════════════
// Source : « 2-Dossier type d'appel d'offres_Travaux_Données Particulières d'Appel d'Offres » (ARMP). Même facture que
// le DPAO des fournitures : un tableau « Clause des IC | Données particulières », les rédactions au choix dans les
// cellules. Référentiel : feuille « A tranche_Alloti » du classeur DAO_Travaux.xlsx (fiche des travaux, quantité fixe
// et à commande — le document type n'a pas de variante « à commande »). Arbitrages du 29/09 (plan du lot D4) : tranches
// communes à tous les lots (Q3), texte officiel fidèle (Q5) ; monnaie Ariary → a), devises → c) (Q9) ; adresse de la
// PRMP d'un seul bloc (rue : B01-AC-02). Champ à créer (T-1) : B04-VL-02 « visite des lieux obligatoire ».
function dpaoTravaux() {
  const SRC = lireSource('travaux-dpao');
  const d = sectionCellules(SRC, '1.2. - DONNEES PARTICULIERES', null);
  const tr = [];
  const x = (vue, motif, ...r) => { const u = ligne(vue, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (vue, motif, rang, ...r) => { const u = ligne(vue, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  /** Un paragraphe-instruction remplacé entier par un jeton. */
  const xj = (vue, motif, rang, jeton) => { const u = ligne(vue, motif, rang); return traiter(tr, u.n, u.texte, [u.texte, jeton, 'jeton']); };
  const cel = (...ps) => ps.flat().filter((p) => p !== null && p !== undefined).join('\u001E');
  const SIc = (nom, ...ps) => [`{{SI:${nom}}}`, ...ps.flat(), `{{FINSI:${nom}}}`];
  const SIr = (nom, ...lignes) => [L(`{{SI:${nom}}}`, ''), ...lignes.flat(), L(`{{FINSI:${nom}}}`, '')];
  const clause = (vue) => vue.lignes.filter((u) => u.cellule === 0).map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; }).join('\u001E');
  /** La rangée dont une cellule commence (premier paragraphe NON VIDE) par ce motif. */
  const rg = (motif, cellule = 0, rang = 0) => {
    const premier = (u) => !d.lignes.some((v) => v.ligne === u.ligne && v.cellule === u.cellule && v.p < u.p);
    const us = d.lignes.filter((u) => u.cellule === cellule && premier(u) && correspond(u, motif));
    if (us.length <= rang) throw new Error(`rangée « ${motif} » (cellule ${cellule}, rang ${rang}) absente`);
    return { ...d, lignes: d.lignes.filter((u) => u.ligne === us[rang].ligne) };
  };

  const conditions = {
    PROJET: 'B02-OT-01 renseigne',
    ALLOTI: 'alloti = OUI',
    'LOTS-DIVISIBLES': 'alloti = OUI et B02-LT-02 = Divisible',
    'LOTS-TOTALITE': 'alloti = OUI et B02-LT-02 = Totalité des lots',
    'VARIANTES-NON': 'variantes = NON',
    'VARIANTES-OUI': 'variantes = OUI',
    TRANCHES: 'tranches = OUI',
    'TRANCHE-C1': 'tranches = OUI et B02-LT-04 renseigne',
    'TRANCHE-C2': 'tranches = OUI et B02-LT-05 renseigne',
    GROUPEMENT: 'groupement = OUI',
    'GROUPEMENT-LIBRE': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    'GROUPEMENT-SOLIDAIRE': 'groupement = OUI et formeGroupement = SOLIDAIRE_OBLIGATOIRE',
    'SANS-GARANTIE': 'garantieSoumission = NON',
    GARANTIE: 'garantieSoumission = OUI',
    // 01/10 (DAO du MEN : 9 900 000 Ar au lot 1, 7 200 000 Ar au lot 2) — le montant par lot, comme B05-GS-03 en fournitures.
    'GARANTIE-LOTS': 'garantieSoumission = OUI et alloti = OUI',
    'GARANTIE-UNIQUE': 'garantieSoumission = OUI et alloti != OUI',
    'GARANTIE-BANCAIRE': 'garantieSoumission = OUI et B05-GQ-02 = Garantie bancaire',
    'GARANTIE-CAUTION': 'garantieSoumission = OUI et B05-GQ-02 = Caution personnelle et solidaire',
    'GARANTIE-CHEQUE': 'garantieSoumission = OUI et B05-GQ-02 = Chèque de banque',
    'VISITE-OBLIGATOIRE': 'B04-VL-02 = OUI',
    ONG: 'B03-QT-05 = OUI',
    QUALIFICATIONS: 'B03-QT-06 renseigne',
    PREFERENCE: 'B06-PN-01 = OUI',
    'SANS-PREFERENCE': 'B06-PN-01 != OUI',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    ARIARY: 'B05-MN-01 = Ariary',
    DEVISES: 'B05-MN-01 = Devises',
    LANGUE: 'B04-LG-01 renseigne',
    'REUNION-NON': 'B04-RP-01 != OUI',
    'REUNION-OUI': 'B04-RP-01 = OUI',
    PAPIER: 'modeRemise != ELECTRONIQUE',
    'B04-SE': 'modeRemise = ELECTRONIQUE',
    'EVALUATION-PAR-LOT': 'alloti = OUI et B06-EV-01 = Par lot',
    'EVALUATION-ENSEMBLE': "alloti = OUI et B06-EV-01 = Sur l'ensemble des lots",
    'NON-CUMUL': 'alloti = OUI et B09-DL-05 = OUI',
  };
  const CLAUSE_SE = '[[CLAUSE À FOURNIR PAR LE JURISTE : conditions et modalités de la remise électronique — plateforme ({{B04-SE-02}}), heure de référence ({{B04-SE-04}}), signature exigée ({{B04-SE-05}}), formats ({{B04-SE-07}}) et tailles admis ({{B04-SE-08}} Mo par fichier, {{B04-SE-09}} Mo par offre), ouverture électronique en séance seulement, assistance ({{B04-SE-14}}), indisponibilité et prorogation ({{B04-SE-12}} h, {{B04-SE-13}} jours ouvrables)]]';
  const ajouts = [CLAUSE_SE, '{{B02-LV-02}}', '{{B03-QT-06}}'];

  retirer(d, 'note de rédaction du modèle, « à supprimer »', '[note 1]');
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>\s*:?$/i.test(l.texte));
  const intro = x(d, 'Les données particulières ci', ['[note:1]', '', 'retire']);
  const entete = rangee(d, 'Clause des Instructions');

  // ── 1. Maître de l'ouvrage et objet
  const r1 = rg("1. Maître de l'Ouvrage");
  const r1s = rg("Maître de l'Ouvrage", 1);
  const objet = cel(
    x(r1s, "=Maître de l'Ouvrage"),
    x(r1s, "<insérer la dénomination de l'Autorité", ["<insérer la dénomination de l'Autorité Contractante >", '{{B01-AC-01}}', 'jeton']),
    x(r1s, "Objet de l'appel d'offres"),
    SIc('PROJET',
      x(r1s, "Le présent appel d'offres, s'inscrit dans"),
      x(r1s, '<préciser, le cas échéant', ["<préciser, le cas échéant, si le marché fait partie d'un projet ou d'une opération plus vaste>", '{{B02-OT-01}}', 'jeton'])),
    x(r1s, 'L’Appel d’offres a pour objet'),
    x(r1s, '<décrire la consistance', ['<décrire la consistance des travaux à exécuter >', '{{B02-OT-02}}', 'jeton']));

  // ── 1.1 Lots, variantes, tranches (Q3 : tranches communes à tous les lots)
  const r11 = rg('1.1 Lots, variantes et tranches');
  const lots = cel(SIc('ALLOTI',
    x(r11, '=Lots'),
    // ⚠️ B02-LT-01 est conditionné « alloti = NON » au référentiel : condition inversée, à corriger (demande T-1).
    x(r11, 'Les lots suivants faisant partie de', ['<insérer la description du projet global>', '{{B02-LT-01}}', 'jeton']),
    '{{B02-LV-02}}',
    SIc('LOTS-DIVISIBLES', x(r11, 'Le candidat peut soumissionner')),
    SIc('LOTS-TOTALITE', x(r11, 'Le candidat ne peut soumissionner'))));
  retirer(r11, 'formulation pour un DAO portant sur UN lot : le DAO de la fiche porte sur tous les lots de la ligne', 'Le lot <insérer la description du lot>');
  retirer(r11, 'liste des lots : remplacée par la désignation des lots du plan (B02-LV-02)', '<insérer la description du lot>', '=….');
  retirer(r11, 'instruction à l’acheteur', '<en cas de décomposition en lots');
  retirer(r11, "limitation du nombre de lots par candidat : aucun champ de la fiche (plan du lot D4, §6)", '<en cas de limitation de lots');
  const r11b = rg('Variantes', 1);
  const variantesTranches = cel(
    x(r11b, 'Variantes'),
    SIc('VARIANTES-NON', x(r11b, 'Les variantes ne sont pas')),
    SIc('VARIANTES-OUI', x(r11b, 'Les variantes sont autorisées')),
    SIc('TRANCHES',
      x(r11b, '=Tranches'),
      x(r11b, 'Les travaux sont décomposés en tranches'),
      x(r11b, '- tranche ferme:', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-03}}', 'jeton']),
      SIc('TRANCHE-C1', x(r11b, '- tranche conditionnelle 1:', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-04}}', 'jeton'])),
      SIc('TRANCHE-C2', x(r11b, '- tranche conditionnelle 2:', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-05}}', 'jeton'])),
      x(r11b, 'Les candidats doivent soumissionner pour la totalité'),
      x(r11b, "Les délais d'affermissement")));
  retirer(r11b, 'instruction à l’acheteur', '<Insérer l’une des deux options', '<si les travaux comprennent');

  // ── 2. Groupements
  const r2 = rg('2. Groupements');
  const groupements = cel(
    SIc('GROUPEMENT-LIBRE', x(r2, 'Les groupements entre Candidats soumissionnant pour des lots distincts peuvent')),
    SIc('GROUPEMENT-SOLIDAIRE', x(r2, 'Les groupements entre Candidats soumissionnant pour des lots distincts doivent')));
  retirer(r2, 'instruction à l’acheteur', '< en cas de décomposition');

  // ── 5. Composition, éclaircissements
  const r5 = rg('5. – Composition');
  const r51 = rg('5.1 Composition');
  const composition = cel(
    x(r51, '1.3 - modèles de fiches', ['A1, A2,….', '{{B04-CD-01}}', 'jeton']),
    SIc('GARANTIE', x(r51, '- modèle de garantie de soumission')),
    x(r51, '2.5 - Plan'));
  const r52 = rg('5.2. Demandes');
  const eclaircissements = cel(
    x(r52, '=Adresse'),
    x(r52, 'Afin d’obtenir des éclaircissements'),
    x(r52, 'Attention de :', ['<insérer le nom du responsable>', '{{B01-AC-05}}', 'jeton']),
    x(r52, 'Rue :', ['<insérer le nom de la rue>', '{{B01-AC-02}}', 'jeton']),
    x(r52, 'Adresse électronique :', ["<insérer l'adresse>", '{{B01-AC-06}}', 'jeton']),
    x(r52, "Délai pour l'envoi des demandes"),
    x(r52, '<nombre de jours supérieur', ['<nombre de jours supérieur ou égal à six>', '{{B04-EQ-01}}', 'jeton']),
    x(r52, 'Délai pour la réponse'),
    x(r52, '<nombre de jours sus mentionné', ['<nombre de jours sus mentionné diminué du délai de réponse estimé par la PRMP>', '{{B04-EQ-02}}', 'jeton']));
  retirer(r52, "adresse de la PRMP : un seul bloc (B01-AC-02) — étage, ville, code postal et télécopie n'ont pas de champ", 'Etage/numéro de Bureau', 'Ville :', 'Code postal', 'Numéro de télécopie');

  // ── 6. Préparation des offres
  const r6 = rg('6. – Préparation');
  const r62 = rg('6.2. Contenu des offres');
  const contenu = cel(
    x(r62, '1°- Documents ou pièces'),
    x(r62, '<énumérer ces documents', ['<énumérer ces documents ou pièces>', '{{B04-PI-01}}', 'jeton']),
    x(r62, '2° -'),
    // 01/10 — la liste des pièces administratives n'est plus imprimée d'office : c'est B03-CQ-01, saisi (le texte du
    // document type en est la valeur par défaut, demandée au backend). Le MEN exige d'autres pièces que l'ARMP.
    x(r62, 'une photocopie certifiée de la Carte', ['une photocopie certifiée de la Carte Professionnelle de l’année en cours', '{{B03-CQ-01}}', 'adapte']),
    SIc('GARANTIE', x(r62, '4°- Garantie de soumission')),
    SIc('VISITE-OBLIGATOIRE', x(r62, '5°- <le cas échéant>', ['<le cas échéant> ', '', 'retire'])));
  const r63 = rg('6.3. Capacités');
  const capacites = cel(
    x(r63, "Fiches d'information"),
    x(r63, 'Chaque Candidat complète'),
    x(r63, '1°Une fiche'), x(r63, '2°Une fiche'), x(r63, '3°Une fiche'), x(r63, '4°la liste', ['trois dernières années', '{{B03-QT-12.lettres}} dernières années', 'adapte']),
    SIc('ONG', x(r63, 'Les communautés locales'), x(r63, '<indiquer les formulaires')));
  retirer(r63, 'instruction à l’acheteur', '<indiquer ici les renseignements', '<Si les communautés locales');
  retirer(r62, 'pièces administratives : la liste du document type est la valeur par défaut de B03-CQ-01 (adaptée le 01/10)',
    'une photocopie certifiée de l’Etat 211', 'une photocopie certifiée de l’Extrait', 'un certificat de non faillite',
    'une photocopie certifiée du Numéro', 'une photocopie certifiée de la carte statistique');
  const r63q = rg('Qualifications particulières requises', 1);
  const qualifications = cel(
    x(r63q, 'Qualifications particulières requises'),
    x(r63q, 'Aux fins du présent Marché', [' <choisir parmi les exemples suivants en les adaptant si besoin est>', '', 'retire']),
    x(r63q, 'a) avoir réalisé un chiffre'),
    xj(r63q, '<insérer un montant', 0, '{{B03-QT-07}}'),
    // 01/10 — « au cours des trois (5) dernières années » : coquille du document type, et durée que l'acheteur adapte
    // (cinq ans au MEN) → B03-QT-12, la même période qu'au 4° de la clause 6.3.
    x(r63q, 'b) avoir réalisé avec succès', ['trois (5) dernières années', '{{B03-QT-12.lettres}} ({{B03-QT-12}}) dernières années', 'adapte']),
    xj(r63q, '<Indiquer le type de travaux', 0, '{{B03-QT-08.parLot}}'),   // 01/10 : par lot (seuils du MEN : 247,5 M / 180 M)
    x(r63q, '(c) indiquer sous quelle forme'),
    x(r63q, '<indiquer une liste de ces gros', ['<indiquer une liste de ces gros matériels et équipements essentiels>', '{{B03-QT-09}}', 'jeton']),
    // 01/10 — « y compris au moins < par exemple >ans d'expérience en tant que directeur » s'imprimait tel quel : le trou
    // n'a pas de champ (le MEN ne l'exige pas) ; l'exemple est retiré avec son trou, ce qui en tient lieu va dans B03-QT-06.
    x(r63q, '(d) proposer un directeur', ['<par exemple cinq à dix>', '{{B03-QT-10}}', 'jeton'], [', y compris au moins < par exemple >ans d’expérience en tant que directeur', '', 'retire']),
    SIc('QUALIFICATIONS', '{{B03-QT-06}}'));
  retirer(r63q, 'instruction à l’acheteur', '<Indiquer ici les qualifications particulières');
  retirer(r63q, 'autres conditions du personnel clé : saisies dans B03-QT-06', '<Ajouter, si nécessaire');
  const r63p = rg('<Si une préférence nationale', 1);
  const preferencePieces = cel(x(r63p, 'Les Candidats susceptibles de bénéficier'));
  retirer(r63p, 'instruction à l’acheteur', '<Si une préférence nationale');
  const r63g = rg("Qualification des membres d'un groupement", 1);
  const groupementQualif = cel(
    x(r63g, "Qualification des membres d'un groupement"),
    SIc('GROUPEMENT-LIBRE',
      x(r63g, "Chacun des membres d'un groupement d'entreprises conjointes"),
      xr(r63g, 'Le mandataire doit satisfaire', 0),
      xj(r63g, '<préciser les conditions de qualification minimales que le mandataire', 0, '{{B03-GT-04}}')),
    x(r63g, "Dans le cas de groupements d'entreprises solidaires"),
    x(r63g, 'Les qualifications de chacun des membres'),
    x(r63g, 'de plus, chacun des membres'),
    xj(r63g, '<préciser les conditions de qualification minimales que chacun', 0, '{{B03-GT-03}}'),
    xr(r63g, 'Le mandataire doit satisfaire', 1),
    xj(r63g, '<préciser les conditions de qualification minimales que le mandataire', 1, '{{B03-GT-05}}'));
  retirer(r63g, 'instruction à l’acheteur', "<dans le cas où les groupements d'entreprises conjointes", '<la solidarité des membres', '<Pour les marchés qui font intervenir');
  const r64 = rg('6.4. Délai de validité');
  const validite = cel(x(r64, 'Le délai de validité', ['<nombre>', '{{B04-VO-01}}', 'jeton']));
  const r65 = rg('6.5.3. Caractère ferme');
  const prix = cel(SIc('FERME', x(r65, 'Les prix sont fermes')), SIc('REVISABLE', x(r65, 'Les prix sont révisables')));
  const r66 = rg('6.6. Monnaie');
  const monnaie = cel(
    SIc('ARIARY', x(r66, 'a) Les prix seront entièrement libellés dans la monnaie')),
    SIc('DEVISES', x(r66, 'c) Les prix pourront comporter'), x(r66, 'La part libellé en monnaies étrangères'), x(r66, 'Tous les autres éléments'), x(r66, 'Le Maître de l’Ouvrage peut demander')));
  retirer(r66, 'instruction à l’acheteur', "<Indiquer l'une des trois options");
  retirer(r66, "rédaction b) : la monnaie de la fiche n'a que deux réponses (Ariary, Devises) — plan du lot D4, Q9",
    'b) Les prix seront entièrement libellés en Ariary', 'Toutefois le Candidat qui compte engager', 'Les taux de change utilisés par le Candidat');
  const r67 = rg('6.7. Garantie de soumission');
  const garantie = cel(
    SIc('SANS-GARANTIE', x(r67, 'Il n’est pas demandé')),
    SIc('GARANTIE',
      x(r67, 'Une garantie de soumission doit être fournie'),
      SIc('GARANTIE-BANCAIRE', x(r67, '- Soit une garantie bancaire')),
      SIc('GARANTIE-CAUTION', x(r67, '- Soit une caution')),
      SIc('GARANTIE-CHEQUE', x(r67, '- Soit un chèque de banque')),
      x(r67, 'Le montant de la garantie de soumission'),
      SIc('GARANTIE-LOTS', x(r67, '<insérer montant en chiffres', ['<insérer montant en chiffres et en lettres>', '{{B05-GQ-03.parLot}}', 'jeton'])),
      SIc('GARANTIE-UNIQUE', x(r67, '<insérer montant en chiffres', ['<insérer montant en chiffres et en lettres>', '{{B05-GQ-03.lettres}} ({{B05-GQ-03}})', 'jeton']))));
  const r68 = rg('6.8. Langue');
  const langue = cel(x(r68, "La langue de l'offre est le français ou", ["<préciser la deuxième langue de l'offre>", '{{B04-LG-01}}', 'jeton']));
  retirer(r68, 'instruction à l’acheteur', '<Dans le cas où une langue');
  retirer(r68, "rédaction « une autre langue seule » : la fiche n'a qu'un champ de langue, la seconde langue (B04-LG-01)", "=La langue de l'offre est:", "<indiquer la langue de l'offre différente");
  const r69 = rg('6.9. - Réunion préparatoire');
  const reunion = cel(
    SIc('REUNION-NON', x(r69, "Il n'est pas prévue")),
    SIc('REUNION-OUI', x(r69, 'Les représentants des Candidats sont invités'), x(r69, '<adresse complète>', ['<adresse complète>', '{{B04-RP-02}}', 'jeton'])),
    xj(r69, "< préciser les modalités d'accès", 0, '{{B04-VL-01}}'),
    SIc('VISITE-OBLIGATOIRE', x(r69, 'une visite des lieux obligatoire'), x(r69, 'Les Candidats ou leurs représentants sont tenus'), x(r69, 'A l’issue de cette visite')));
  retirer(r69, 'lieu, date et heure saisis ensemble dans B04-RP-02', 'le <date à fixer', 'à < heures>');
  retirer(r69, 'instruction à l’acheteur', '<en cas de visite des lieux obligatoire>');

  // ── 7. Remise des offres (Q5 : la phrase « Une (01) copie » contredit la clause 7.1 — retirée, avec sa raison)
  const r7 = rg('7. – Remise des offres');
  retirer(r7, "contredit la clause 7.1, où le nombre de copies se saisit (B04-FP-01) — plan du lot D4, Q5", 'Toute offre doit être remise');
  const r71 = rg('7.1. Forme des plis');
  const plis = cel(
    SIc('ALLOTI', x(r71, '<en cas d’allotissement> : les offres', ['<en cas d’allotissement> : ', '', 'retire'])),
    x(r71, 'Outre l’original de l’offre'),
    x(r71, '<insérer le nombre de copies>', ['<insérer le nombre de copies>', '{{B04-FP-01}}', 'jeton']),
    x(r71, 'Les enveloppes extérieure et intérieure'),
    xj(r71, '<insérer les mentions', 0, '{{B04-FP-02}}'),
    x(r71, 'Le nom et l’adresse du Maître', [':…….', ': {{B01-AC-01}}, {{B01-AC-02}}', 'jeton']),
    x(r71, '- La référence du présent'),
    x(r71, '- La mention'),
    SIc('ALLOTI', x(r71, '- <en cas d’allotissement> la référence', ['<en cas d’allotissement> ', '', 'retire'])),
    x(r71, 'à l’exclusion de toute mention'));
  const r72 = rg('7.2. Lieu, date');
  const remise = cel(
    x(r72, 'Aux fins de remise des offres'),
    x(r72, 'Attention :', ['<insérer le nom complet de la PRMP ou de son représentant>', '{{B01-AC-05}}', 'jeton']),
    x(r72, 'Lieu :Adresse:', ['<insérer le nom de la rue et le numéro de l’immeuble>', '{{B01-AC-02}}', 'jeton']),
    x(r72, 'Les date et heure limites'),
    x(r72, 'Date :', ['<insérer le jour, mois, année>', '{{B04-OV-02}}', 'jeton']));
  retirer(r72, "adresse de remise : un seul bloc (B01-AC-02) — étage, ville et code postal n'ont pas de champ", 'Étage/Numéro de bureau', 'Ville :', 'Code postal');
  retirer(r72, 'date et heure saisies ensemble dans B04-OV-02 (qui doit porter l’heure : demande T-1)', 'Heure :');
  const r73 = rg('7.3. Remise des offres par voie');
  const electronique = cel(SIc('PAPIER', x(r73, 'Le mode de remise des offres par voie électronique')), SIc('B04-SE', CLAUSE_SE));
  retirer(r73, 'instruction à l’acheteur (les conditions de la remise électronique sont demandées au juriste)', "<s'il n'est pas possible", '<Dans le cas où il est possible');
  const r8 = rg('8. Ouverture des plis');
  const ouverture = cel(x(r8, 'Lieu : (insérer le lieu)', ['(insérer le lieu)', '{{B04-OV-01}}', 'jeton']), x(r8, 'Date : Le même jour'), x(r8, 'Heure : (insérer'));

  // ── 9. Évaluation
  const r9 = rg('9. Evaluation et comparaison');
  const r91 = rg('9.1. - Relations');
  const relations = cel(x(r91, 'Les Candidats devront répondre'), x(r91, '<insérer nombre de jours>', ['<insérer nombre de jours>', '{{B06-RC-01}}', 'jeton']));
  const r94 = rg('9.4. Evaluation des offres');
  const evaluation = cel(
    x(r94, 'Evaluation des offres portant sur plusieurs lots'),
    SIc('EVALUATION-PAR-LOT', x(r94, 'Les offres seront évaluées par lot')),
    SIc('EVALUATION-ENSEMBLE', x(r94, "Le Marché portera sur l'ensemble des lots")));
  const r95 = rg('9.5. Marge de préférence');
  const preference = cel(
    SIc('SANS-PREFERENCE', x(r95, 'Il n’est pas accordé de préférence'), x(r95, '=nationaux')),
    SIc('PREFERENCE', x(r95, 'Il est accordé aux candidats nationaux', ['<pourcentage inférieur ou égal à 10% >', '{{B06-PN-02.chiffres}} %', 'jeton'])));
  retirer(r95, 'instruction à l’acheteur', '<insérer l’une des options');
  const r11d = rg('11. Délai d’exécution');
  const delai = cel(
    x(r11d, 'Le délai d’exécution proposé', ['….. <délai>', '{{B09-DL-01.parLot}}', 'jeton']),   // 01/10 : par lot
    SIc('NON-CUMUL', x(r11d, 'En cas d’attribution de deux')));
  retirer(r11d, 'instruction à l’acheteur', '=<en cas d’allotissement>');

  const blocs = [
    P(intro),
    T(2),
    L(...entete.lignes.map((u) => { d.prises.add(u.n); PRODUITS.add(u.texte); return u.texte; })),
    L(clause(r1), ''),
    L(clause(r1s), objet),
    L(clause(r11), lots),
    L(clause(r11b), variantesTranches),
    ...SIr('GROUPEMENT', L(clause(r2), groupements)),
    L(clause(r5), ''),
    L(clause(r51), composition),
    L(clause(r52), eclaircissements),
    L(clause(r6), ''),
    L(clause(r62), contenu),
    L(clause(r63), capacites),
    L(clause(r63q), qualifications),
    ...SIr('PREFERENCE', L(clause(r63p), preferencePieces)),
    ...SIr('GROUPEMENT', L(clause(r63g), groupementQualif)),
    L(clause(r64), validite),
    L(clause(r65), prix),
    L(clause(r66), monnaie),
    L(clause(r67), garantie),
    ...SIr('LANGUE', L(clause(r68), langue)),
    L(clause(r69), reunion),
    L(clause(r7), ''),
    L(clause(r71), plis),
    L(clause(r72), remise),
    L(clause(r73), electronique),
    L(clause(r8), ouverture),
    L(clause(r9), ''),
    L(clause(r91), relations),
    ...SIr('ALLOTI', L(clause(r94), evaluation)),
    L(clause(r95), preference),
    L(clause(r11d), delai),
    FIN,
  ];
  const titre = ligne(d, '1.2. - DONNEES PARTICULIERES').texte;
  toutEstRendu(d, 'DPAO-T');
  return { fichier: 'DPAO-T.docx', sigle: 'DPAO-T', source: 'travaux-dpao', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ AE des travaux (marché ordinaire) ═══════════════════════════════════════════════════════════════
// Source : « 4-Dossier type d'appel d'offres-Travaux_Acte d'engagement » (ARMP). Document du CANDIDAT (identification,
// montants, domiciliation, choix de l'avance, signatures, annexes) : ses chevrons restent. La fiche remplit les trous de
// l'acheteur et choisit les blocs : procédure, type de prix × tranches, révision, monnaie, groupement, avance, point de
// départ, délai. La sous-traitance reste au candidat (« Rayer les dispositions inapplicables », plan du lot D4, Q9).
// Champs et options à créer (T-1) : B02-MW-04 (maître d'ouvrage délégué, Q6), B02-LT-06 / B02-LT-07 (délais
// d'affermissement, Q2), option « ordre de service de commencer les travaux » de B09-DT-01, option MIXTE de typePrix (Q4).
function aeTravaux() {
  const SRC = lireSource('travaux-ae');
  const d = sectionCellules(SRC, "2.1. CADRE D'ACTE D'ENGAGEMENT", null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (motif, rang, ...r) => { const u = ligne(d, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  const E = emetteur(d, tr);

  const conditions = {
    ALLOTI: 'alloti = OUI',
    'NON-ALLOTI': 'alloti != OUI',
    AOO: "B01-AC-13 = Appel d'offres ouvert",
    PREQUALIFICATION: 'B01-AC-13 contient qualification',
    'DEUX-ETAPES': 'B01-AC-13 contient deux étapes',
    RESTREINT: 'B01-AC-13 contient restreint',
    MOD: 'B02-MW-04 renseigne',
    MOE: 'B02-MW-01 renseigne',
    GROUPEMENT: 'groupement = OUI',
    'GROUPEMENT-CONJOINT': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    ARIARY: 'B05-MN-01 != Devises',
    DEVISES: 'B05-MN-01 = Devises',
    REVISABLE: 'prixRevisable = OUI',
    UNITAIRES: 'typePrix = UNITAIRES et tranches != OUI',
    FORFAIT: 'typePrix = FORFAITAIRE et tranches != OUI',
    'UNITAIRES-TRANCHES': 'typePrix = UNITAIRES et tranches = OUI',
    'FORFAIT-TRANCHES': 'typePrix = FORFAITAIRE et tranches = OUI',
    'TRANCHE-C2': 'tranches = OUI et B02-LT-05 renseigne',
    'DEPART-OS': 'tranches != OUI et B09-DT-01 contient ordre de service',
    TRANCHES: 'tranches = OUI',
    'AFFERMISSEMENT-1': 'tranches = OUI et B02-LT-05 vide',
    'AFFERMISSEMENT-2': 'tranches = OUI et B02-LT-05 renseigne',
    PREPARATION: 'B09-PT-01 = OUI',
    RECEPTION: 'B09-DL-04 renseigne',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'AVANCE-GROUPEMENT': 'avance = OUI et groupement = OUI',
    'ANNEXE-FORFAIT': 'typePrix = FORFAITAIRE',
    'ANNEXE-UNITAIRES': 'typePrix = UNITAIRES',
    'ANNEXE-MIXTE': 'typePrix = MIXTE',
  };
  const ajouts = [];

  retirer(d, 'titre de partie du dossier type', "2.1. CADRE D'ACTE D'ENGAGEMENT");
  retirer(d, 'note aux utilisateurs, « à supprimer dans le DAO définitif »', 'Note aux utilisateurs', "L'Acte d’Engagement signé en un seul", "L'Acte d’Engagement est, après", 'Les commentaires entre');
  retirer(d, 'instruction à l’acheteur', '<préciser selon le cas', '<Dans le cas de paiement avec', '<Dans le cas où les prix sont révisables',
    "Dans le cas d'un marché à prix unitaire :", "Dans le cas d'un marché à prix forfaitaire :", "Dans le cas d'un marché à prix unitaires avec tranches :",
    "Dans le cas d'un marché à prix forfaitaires avec tranches :", "<compléter avec les montants des autres tranches", '<Insérer si le point de départ',
    '<ou, en cas de marché à tranches', '<préciser le cas échéant:>', '<Préciser, le cas échéant>');
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>\s*:?$/i.test(l.texte));
  retirer(d, 'rédaction « date de fin du marché » : le délai d’exécution est retenu (plan du lot D4, Q9)', 'Le marché prendra fin');

  const MARCHE = "<Indiquer: l'intitulé principal du Marché, le cas échéant le projet dans le cadre duquel le marché est passé, ou le numéro et l'objet du lot compris dans le projet >";
  const DAO = ['N° du <date>', 'N° {{B02-OB-03}} du <date>', 'jeton'];
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
    ...E('Imputation budgétaire', "Maître d'Ouvrage Délégué", [
      ['Imputation budgétaire', ['<à préciser>', '{{B01-AC-17}}', 'jeton']],
      ['<insérer le nom>', ['<insérer le nom>', '{{B01-AC-05}}', 'jeton']]]),
    ...SI('MOD', P(x("Maître d'Ouvrage Délégué", ['<préciser le nom du mandataire, le cas échéant>', '{{B02-MW-04}}', 'jeton']))),
    ...SI('MOE', P(x("Maître d'œuvre", ["<préciser le nom du Maître d'œuvre , le cas échéant>", '{{B02-MW-01}}', 'jeton']))),
    ...E('Date de notification du Marché', "Engagement à remplir par les MEMBRES", [
      ["Après avoir pris connaissance", DAO],
      ["L'offre ainsi présentée me lie", ['<date>', '{{DERIVE.fin-validite-offre}}', 'jeton']]]),
    ...SI('GROUPEMENT', E("Engagement à remplir par les MEMBRES", 'ARTICLE 2 - PRIX', [
      ["Après avoir pris connaissance", DAO],
      ["L'offre ainsi présentée nous lie", ['<date>', '{{DERIVE.fin-validite-offre}}', 'jeton']]])),
    ...E('ARTICLE 2 - PRIX', 'La monnaie de compte'),
    ...SI('ARIARY', P(x('La monnaie de compte'))),
    ...SI('DEVISES', P(x('Tous les paiements à réaliser en monnaie différente'))),
    ...SI('REVISABLE', P(x('Les modalités de variation des prix'))),
    ...SI('UNITAIRES', E('Les Travaux, objet du présent marché, seront rémunérés, par application des prix unitaires qui', 'Les Travaux, objet du présent marché, seront rémunérées par application du prix')),
    ...SI('FORFAIT', E('Les Travaux, objet du présent marché, seront rémunérées par application du prix', 'Les Travaux, objet du présent marché, seront rémunérés, par application des prix unitaires résultant')),
    // La tranche conditionnelle 2 (« Tranche conditionnelle … ») est imbriquée dans SA forme de prix.
    ...SI('UNITAIRES-TRANCHES',
      E('Les Travaux, objet du présent marché, seront rémunérés, par application des prix unitaires résultant', ['Tranche conditionnelle … :', 0]),
      SI('TRANCHE-C2', E(['Tranche conditionnelle … :', 0], 'Les Travaux, objet du présent marché, seront rémunérés, par application du prix'))),
    ...SI('FORFAIT-TRANCHES',
      E('Les Travaux, objet du présent marché, seront rémunérés, par application du prix', ['Tranche conditionnelle … :', 0]),
      SI('TRANCHE-C2', E(['Tranche conditionnelle … :', 1], 'ARTICLE 3'))),
    ...E('ARTICLE 3', 'ARTICLE 5', [['Est désigné comme Comptable', ['le……………….', 'le {{B03-NT-01}}', 'jeton']]]),
    ...E('ARTICLE 5', 'Le délai de réalisation des Travaux prend effet'),
    ...SI('DEPART-OS', P(x('Le délai de réalisation des Travaux prend effet'))),
    ...SI('TRANCHES', P(x('La tranche ferme prend effet')), P(x('La (les) tranche(s) conditionnelle(s) prend')), P(x('La (les) date(s) limite'))),
    ...SI('AFFERMISSEMENT-1', P(x('<préciser pour chaque tranche', ['<préciser pour chaque tranche les dates ou le délai à compter de la notification du marché >', '{{B02-LT-06}}', 'jeton']))),
    ...SI('AFFERMISSEMENT-2', P(x('<préciser pour chaque tranche', ['<préciser pour chaque tranche les dates ou le délai à compter de la notification du marché >', '{{B02-LT-06}} ; {{B02-LT-07}}', 'jeton']))),
    ...E('5.2. Délais', 'La période de préparation est comprise', [['Le délai d’exécution est fixé à', ['<insérer délai>', '{{B09-DL-01}}', 'jeton']]]),
    ...SI('PREPARATION', P(x('La période de préparation est comprise'))),
    ...E('Le calendrier prévisionnel', 'La réception de l'),
    ...SI('RECEPTION', P(x("La réception de l'ouvrage", ['<date de fin de marché prévue>', '{{B09-DL-04}}', 'jeton']))),
    ...E('ARTICLE 6', "Dans le cas d'un groupement d'Entrepreneurs solidaires"),
    ...SI('GROUPEMENT', E("Dans le cas d'un groupement d'Entrepreneurs solidaires", "Dans le cas d'un groupement d'Entrepreneurs conjoints")),
    ...SI('GROUPEMENT-CONJOINT', E("Dans le cas d'un groupement d'Entrepreneurs conjoints", '6.2 Avance')),
    ...E('6.2 Avance', 'Le CCAP ne prévoit pas'),
    ...SI('SANS-AVANCE', P(x('Le CCAP ne prévoit pas'))),
    ...SI('AVANCE', E("L'Entrepreneur désigné ci-avant", 'En cas de groupement')),
    ...SI('AVANCE-GROUPEMENT', E('En cas de groupement', 'Fait en un seul original')),
    ...E('Fait en un seul original', 'Annexe n° 1 :'),
    ...SI('ANNEXE-FORFAIT', P(x("Annexe n° 1 : <Dans le cas d'un prix forfaitaire>", ["<Dans le cas d'un prix forfaitaire>: ", '', 'retire']))),
    ...SI('ANNEXE-UNITAIRES', P(x("Annexe n° 1 : <dans le cas d'un marché à prix unitaires>", ["<dans le cas d'un marché à prix unitaires>: ", '', 'retire'])), P(x('détail quantitatif et estimatif.'))),
    ...SI('REVISABLE', P(x('Annexe n° < > : <en cas de prix', ['<en cas de prix révisables:> ', '', 'retire']))),
    ...E("Annexe n° < > : demande d'acceptation", ['=ANNEXE 1', 0]),
    ...SI('ANNEXE-FORFAIT', E(['=ANNEXE 1', 0], ['=ANNEXE 1', 0])),
    ...SI('ANNEXE-UNITAIRES', E(['=ANNEXE 1', 1], ['=ANNEXE 1', 0])),
    ...SI('ANNEXE-MIXTE', E(['=ANNEXE 1', 2], '=ANNEXE')),
    ...SI('REVISABLE', E(['=ANNEXE', 0], '=ANNEXE')),
    ...E(['=ANNEXE', 1]),
  ];
  const titre = ligne(d, 'MARCHÉ PUBLIC DE TRAVAUX').texte;
  toutEstRendu(d, 'AE-T');
  return { fichier: 'AE-T.docx', sigle: 'AE-T', source: 'travaux-ae', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ CCAP des travaux (marché ordinaire) et ses six annexes ════════════════════════════════════════
// Source : « 5-Dossier type d'appel d'offres_Travaux_Cahier Prescriptions Spéciales » (ARMP) : le CCAP en 32 articles,
// puis les six annexes que la fiche annonçait comme « formulaires à remplir » (B11-FR-01 à -06) — formule de révision,
// garantie bancaire et caution de bonne exécution, garantie bancaire et caution de restitution d'avance, cadre du
// bordereau des prix et du détail quantitatif — chacune sous sa condition ; enfin les Spécifications techniques, pièce
// de l'acheteur (titres gardés, notes de rédaction retirées). Ce que le modèle donne « par exemple » (assurances,
// sujétions, approvisionnements, clause d'arbitrage) est remplacé par la saisie, comme aux fournitures ; les blancs sans
// champ restent visibles. Texte officiel fidèle (Q5 : renvoi « article 16 » pour l'article 5 compris).
// Champs à créer (T-1) : B02-MW-04 (maître d'ouvrage délégué), B02-LT-06 / -07 (affermissement), B05-GE-05 (taux de la
// garantie de bonne exécution, ≤ 5 %), B09-BT-01 (travaux de bâtiment : CPC/TBM et décennale). Pénalités : la question
// `penalites` du cadrage (comme ailleurs), B09-PE-01 à retirer.
function ccapTravaux() {
  const SRC = lireSource('travaux-ccap');
  const d = sectionCellules(SRC, 'MARCHÉ PUBLIC DE TRAVAUX', null);
  const tr = [];
  const x = (motif, ...r) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, ...r); };
  const xr = (motif, rang, ...r) => { const u = ligne(d, motif, rang); return traiter(tr, u.n, u.texte, ...r); };
  const xj = (motif, jeton) => { const u = ligne(d, motif); return traiter(tr, u.n, u.texte, [u.texte, jeton, 'jeton']); };
  const E = emetteur(d, tr, /^(Article \d|\d+\.\d+\.?\s*-?\s|\d+\.\d+\.\d+\.?\s|Annexe au CCAP$|CAHIER DES CLAUSES|SPECIFICATIONS TECHNIQUES$)/);
  const NA = (k) => P(xr('=Non applicable', k));

  const conditions = {
    AOO: "B01-AC-13 = Appel d'offres ouvert",
    PREQUALIFICATION: 'B01-AC-13 contient qualification',
    'DEUX-ETAPES': 'B01-AC-13 contient deux étapes',
    RESTREINT: 'B01-AC-13 contient restreint',
    MOD: 'B02-MW-04 renseigne',
    MOE: 'B02-MW-01 renseigne',
    'SANS-MOE': 'B02-MW-01 vide',
    PROJET: 'B02-OT-01 renseigne',
    'SANS-PROJET': 'B02-OT-01 vide',
    ALLOTI: 'alloti = OUI',
    TRANCHES: 'tranches = OUI',
    'TRANCHE-C1': 'tranches = OUI et B02-LT-04 renseigne',
    'TRANCHE-C2': 'tranches = OUI et B02-LT-05 renseigne',
    ESTIMATIONS: 'B08-EF-01 renseigne',
    'GROUPEMENT-SOLIDAIRE': 'groupement = OUI et formeGroupement = SOLIDAIRE_OBLIGATOIRE',
    'GROUPEMENT-LIBRE': 'groupement = OUI et formeGroupement = CONJOINT_OU_SOLIDAIRE',
    BATIMENT: 'B09-BT-01 = OUI',
    'SANS-GBE': 'B05-GE-01 != OUI',
    GBE: 'B05-GE-01 = OUI',
    'GBE-DEVISES': 'B05-GE-01 = OUI et B05-MN-01 = Devises',
    'GBE-BANCAIRE': 'B05-GE-01 = OUI et B05-GE-03 contient bancaire',
    'GBE-CAUTION': 'B05-GE-01 = OUI et B05-GE-03 contient caution',
    'GBE-CHEQUE': 'B05-GE-01 = OUI et B05-GE-03 contient chèque',
    'LIBERATION-MOITIE': 'B05-GE-01 = OUI et B05-GE-04 contient 50',
    'LIBERATION-TOTALE': 'B05-GE-01 = OUI et B05-GE-04 contient 100',
    'RETENUE-NON': 'B05-RG-01 != OUI',
    'RETENUE-OUI': 'B05-RG-01 = OUI',
    'RESTITUTION-NON': 'B05-GA-01 != OUI',
    'RESTITUTION-OUI': 'B05-GA-01 = OUI',
    'AUTRES-GARANTIES-NON': 'B05-AG-01 vide',
    'AUTRES-GARANTIES-OUI': 'B05-AG-01 renseigne',
    'DISCRETION-NON': 'B09-OD-01 != OUI',
    'DISCRETION-OUI': 'B09-OD-01 = OUI',
    'DISCRETION-NOTIFICATION': 'B09-OD-01 = OUI et B09-OD-02 renseigne',
    'DISCRETION-ANNEXE': 'B09-OD-01 = OUI et B09-OD-03 renseigne',
    'PRIX-REVIENT-NON': 'B09-PV-01 != OUI',
    'PRIX-REVIENT-OUI': 'B09-PV-01 = OUI',
    'PRIX-REVIENT-ELEMENTS': 'B09-PV-01 = OUI et B09-PV-02 renseigne',
    'SUJETION-OCCUPE': 'B09-CH-01 renseigne',
    'SUJETION-DELAI': 'B09-CH-02 renseigne',
    'SUJETION-HORAIRE': 'B09-CH-03 renseigne',
    'SUJETION-CLES': 'B09-CH-04 renseigne',
    'SUJETION-PRESTATIONS': 'B09-CH-05 renseigne',
    DEVISES: 'B05-MN-01 = Devises',
    FORFAIT: 'typePrix = FORFAITAIRE',
    UNITAIRES: 'typePrix = UNITAIRES',
    FERME: 'prixRevisable = NON',
    REVISABLE: 'prixRevisable = OUI',
    'REGIE-NON': 'B08-RE-02 != OUI',
    'REGIE-OUI': 'B08-RE-02 = OUI',
    'APPROVISIONNEMENTS-NON': 'B08-AP-01 != OUI',
    'APPROVISIONNEMENTS-OUI': 'B08-AP-01 = OUI',
    'SANS-AVANCE': 'avance = NON',
    AVANCE: 'avance = OUI',
    'AVANCE-ARIARY': 'avance = OUI et B05-MN-01 != Devises',
    'AVANCE-DEVISES': 'avance = OUI et B05-MN-01 = Devises',
    'REGLEMENT-UNIQUE': 'B08-MR-01 = OUI',
    'DECOMPTES-MENSUELS': 'B08-MR-01 != OUI',
    'FORCE-MAJEURE-OUI': 'B09-FM-01 = OUI',
    'FORCE-MAJEURE-NON': 'B09-FM-01 != OUI',
    'PENALITES-NON': 'penalites = NON',
    'PENALITES-OUI': 'penalites != NON',
    'PREPARATION-NON': 'B09-PT-01 != OUI',
    'PREPARATION-OUI': 'B09-PT-01 = OUI',
    HYGIENE: 'B09-PT-01 = OUI et B09-PT-04 renseigne',
    'RECEPTION-TRANCHES': 'tranches = OUI et B09-RP-01 = OUI',
    DEROGATIONS: 'B10-DR-01 renseigne',
    'ANNEXE-GBE-BANCAIRE': 'B05-GE-01 = OUI et B05-GE-03 contient bancaire',
    'ANNEXE-GBE-CAUTION': 'B05-GE-01 = OUI et B05-GE-03 contient caution',
    'ANNEXE-AVANCE': 'avance = OUI et B05-GA-01 = OUI',
    // ⚠️ 30/09 — l'annexe aux spécifications techniques « Liste des Plans » n'est qu'un titre dans le document type : elle
    // reçoit les plans joints au dossier (B04-CD-03, facultatif depuis le 30/09), s'ils sont renseignés.
    PLANS: 'B04-CD-03 renseigne',
  };
  const ajouts = ['{{B04-CD-03}}', '{{B02-LV-02}}', '{{B09-AC-01}}', '{{B09-AC-02}}', '{{B09-AC-03}}', '{{B09-CH-01}}', '{{B09-CH-02}}', '{{B09-CH-03}}', '{{B09-CH-04}}',
    '{{B09-CH-05}}', '{{B08-AP-02}}', '{{B09-RP-04}}', '{{B10-PC-01}}', '{{B10-DR-01}}'];

  // ── Ce qui ne s'imprime pas
  const repere = (debut) => { const u = d.lignes.find((v) => !d.retirees.has(v.n) && v.texte.startsWith(debut)); if (!u) throw new Error(`repère « ${debut} » absent`); return u.ligne; };
  const table = repere('TABLE DES MATIERES');
  const ligneDe = (debut) => d.lignes.find((u) => u.texte.startsWith(debut)).ligne;
  const preambule = ligneDe('Les dispositions du présent Cahier des Clauses Administratives Particulières (CCAP) précisent');
  retirer(d, 'note de rédaction du modèle, « à supprimer »', '[note 1]', 'NOTE AUX UTILISATEURS', '<Le document ci-après (CCAP type)');
  retirer(d, 'sommaire : ses numéros de page ne valent que pour le document type', (l) => l.ligne >= table && l.ligne < preambule);
  retirer(d, 'fin de la même instruction (références du marché)', 'le cas échéant, le projet dans le cadre', "ou le numéro et l'objet du lot compris");
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', (l) => /^<\s*(soit|ou)\s*:?\s*>\s*:?$/i.test(l.texte));
  retirer(d, 'instruction à l’acheteur', '<préciser selon le cas', '<si les travaux comprennent plusieurs lots', '<si les travaux comprennent plusieurs tranches',
    '<Etc. selon le nombre', '<à compléter, le cas échéant>', "<S'il n'est pas désigné", '<préciser le délai de remise', '<Préciser si les Entrepreneurs groupés',
    '<en cas de construction ou réhabilitation', "<Lorsque la durée d'exécution", "<Si une garantie d'exécution est requise", '<Si le Marché comporte un part',
    '<choisir un ou plusieurs des formes', '<Si un délai de garantie contractuelle', '<indiquer les polices', '<les exemples suivants sont à adapter',
    '<Dans le cas où le paiement en devises', "<dans le cas d'un Marché à prix forfaitaire", "<dans le cas d'un Marché à prix unitaire",
    '<soit préciser les modalités', '<si le délai d\'exécution du marché ne dépasse', "<En cas d'établissement de décomptes", '<cas marché à prix',
    '<Définir la limite', '<Fixer ici la limite', '< Fixer ici la limite', '< si le', '<si le Marché fixe une date limite', '<Préciser, en fonction de',
    "<S'il est prévu un plan d'hygiène", '<La fixation par le Marché', '<en cas de dérogation au délai de 20', '<Indiquer, le cas échéant :>',
    "Lorsqu’il est nécessaire de modifier le délai d’un", '<dans le cas d\'un marché passé avec une entreprise', '<Exemple : clause', '<Lorsque l\'on souhaite fixer');
  retirer(d, 'suite de la même instruction (documents contractuels), remplacée par la saisie B09-DC-01', "d'une part les documents tels que", "d'autre part les décompositions du prix");
  retirer(d, 'liste des lots : remplacée par la désignation des lots du plan (B02-LV-02)', '- Lot n°1', '- Lot n°2', '- etc.');
  const assurances = ligneDe('A- Installations et engins de chantier');
  const sujetions = ligneDe('<cas où les travaux sont réalisés');
  retirer(d, "assurances d'exemple du modèle (« exemple à adapter ») : remplacées par les saisies B09-AC-01 à -03", (l) => l.ligne === assurances);
  retirer(d, "sujétions d'exemple du modèle (« à adapter ») : remplacées par les saisies B09-CH-01 à -05", (l) => l.ligne === sujetions);
  retirer(d, "modalités d'exemple des acomptes sur approvisionnements : remplacées par la saisie B08-AP-02", 'A l’appui de tout projet de décompte', 'Les matériaux ne peuvent être pris en compte', 'Le montant pris en compte dans le projet de décompte');
  retirer(d, "rédaction « dates limites » : le délai d'exécution est retenu (plan du lot D4, Q9)", 'Date limite de commencement', "Date limite d'achèvement");
  retirer(d, "clause d'arbitrage d'exemple (CNUDCI, « à valider ») : remplacée par la saisie B10-PC-01", 'Tous litige', 'Le tribunal arbitral sera composé', "L'autorité de nomination sera", "A défaut d'accord des Parties");
  retirer(d, 'notes aux utilisateurs pour préparer le bordereau et le détail quantitatif (pièces de l’acheteur)', (l) => l.ligne >= repere('Notes aux utilisateurs relatives à la préparation du Bordereau des prix et du Détail quantitatif et estimatif') && l.ligne < repere('BORDEREAU DES PRIX'));
  retirer(d, 'notes de rédaction des spécifications techniques (pièce de l’acheteur)', (l) => l.ligne > repere('SPECIFICATIONS TECHNIQUES') && l.ligne < repere('Annexe aux Spécifications Techniques'));

  const MARCHE = "<indiquer les références et l'intitulé principal du Marché,";
  const blocs = [
    C(x('MARCHÉ PUBLIC DE TRAVAUX')),
    C(x('CAHIER DES PRESCRIPTIONS SPECIALES')),
    ...E('AUTORITE CONTRACTANTE', '<indiquer les références', [["<indiquer le nom et l'adresse>", ["<indiquer le nom et l'adresse>", '{{B01-AC-01}} — {{B01-AC-02}}', 'jeton']]]),
    P(x('<indiquer les références', [MARCHE, '{{B02-OB-03}} — {{B02-OB-01}}', 'jeton'])),
    ...E('Marché passé selon', "d'appel d'offres ouvert régie"),
    ...SI('AOO', P(x("d'appel d'offres ouvert régie"))),
    ...SI('PREQUALIFICATION', P(x("d'appel d'offres ouvert avec"))),
    ...SI('DEUX-ETAPES', P(x("d'appel d'offres en deux"))),
    ...SI('RESTREINT', P(x("d'appel d'offres restreint", ['Publics>', 'Publics', 'choix']))),
    ...E('PERSONNE RESPONSABLE', "MAITRE D'OUVRAGE DELEGUE", [['<Insérer le nom>', ['<Insérer le nom>', '{{B01-AC-05}}', 'jeton']]]),
    ...SI('MOD', P(x("MAITRE D'OUVRAGE DELEGUE", ['<préciser le nom du mandataire, le cas échéant>', '{{B02-MW-04}}', 'jeton']))),
    ...SI('MOE', P(x("MAITRE D'ŒUVRE", ["<préciser le nom du Maître d' oeuvre, le cas échéant>", '{{B02-MW-01}}', 'jeton']))),
    ...E('Le présent Cahier des Prescriptions Spéciales comprend', 'Article 1 - Objet', [['Le CCAP est destiné', ['[note:1]', '', 'retire']]]),
    // Article 1
    ...E('Article 1 - Objet', 'Les stipulations du présent'),
    ...SI('PROJET', P(x('Les stipulations du présent', ['<préciser le nom de l’opération, le cas échéant>', '{{B02-OT-01}}', 'jeton']))),
    ...SI('SANS-PROJET', P(x('Les stipulations du présent', [' dans le cadre de <préciser le nom de l’opération, le cas échéant>', '', 'retire']))),
    ...E('Le marché a pour objet', 'Ces travaux comprennent', [["<indiquer l'objet", ["<indiquer l'objet et le lieu d'exécution des travaux >", '{{B02-OT-02}}', 'jeton']]]),
    ...SI('ALLOTI', P(x('Ces travaux comprennent', ['<nombre >', '{{B02-LV-01}}', 'jeton'])), P('{{B02-LV-02}}')),
    ...E('Les caractéristiques techniques des ouvrages', 'Les travaux sont décomposés en tranches'),
    ...SI('TRANCHES',
      P(x('Les travaux sont décomposés en tranches')),
      P(x('- tranche ferme', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-03}}', 'jeton'])),
      SI('TRANCHE-C1', P(x('- tranche conditionnelle 1', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-04}}', 'jeton']))),
      SI('TRANCHE-C2', P(x('- tranche conditionnelle 2', ["<compléter selon le projet, l'objet de la tranche et son étendue>", '{{B02-LT-05}}', 'jeton']))),
      P(x("Les délais d'affermissement"))),
    ...E('1.2.- Intervenants', '1.2.2.', [
      ["<Préciser les nom et coordonnées du Maître de l'ouvrage>", ["<Préciser les nom et coordonnées du Maître de l'ouvrage>", '{{B01-AC-01}}', 'jeton']],
      ['<Préciser les nom et coordonnées>', ['<Préciser les nom et coordonnées>', '{{B01-AC-05}}', 'jeton']]]),
    ...SI('MOD', E('1.2.2.', '1.2.3.', [['<Préciser les nom et coordonnées>', ['<Préciser les nom et coordonnées>', '{{B02-MW-04}}', 'jeton']]])),
    ...E('1.2.3.', "La maîtrise d'œuvre est assurée"),
    ...SI('MOE',
      P(x("La maîtrise d'œuvre est assurée", ["<indiquer les référence du lien contractuel entre le Maître de l'ouvrage et le Maître d'œuvre >", '{{B02-MW-02}}', 'jeton'])),
      P(x("<Préciser le nom et les coordonnées du Maître d'œuvre", ["<Préciser le nom et les coordonnées du Maître d'œuvre >", '{{B02-MW-01}}', 'jeton']))),
    ...SI('SANS-MOE', P(x("Les tâches du maître d'œuvre sont assurées")), P(x('Dans ce cas, le maître d’œuvre sera désigné'))),
    // Articles 2 à 5
    ...E('Article 2 -', '<mentionner l'),
    P(xj("<mentionner l'adresse de notification", '{{B09-NE-01}}')),
    ...E('Article 3 -', 'La communication par l'),
    ...SI('ESTIMATIONS', P(x("La communication par l'Entrepreneur", ['<nombre>', '{{B08-EF-01}}', 'jeton']))),
    ...E('Article 4 -', 'Les Entrepreneurs groupés seront considérés comme solidaires'),
    ...SI('GROUPEMENT-SOLIDAIRE', P(x('Les Entrepreneurs groupés seront considérés comme solidaires'))),
    ...SI('GROUPEMENT-LIBRE', P(x('Les Entrepreneurs groupés seront considérés comme solidaires')), P(x('Les Entrepreneurs groupés seront considérés comme conjoints'))),
    ...E('Article 5 -', 'Délai de notification'),
    ...SI('TRANCHES',
      P(x('Délai de notification de l’ordre de service prescrivant de commencer les travaux de la tranche conditionnelle n°1', ['<nombre de jours ou de mois>', '{{B02-LT-06}}', 'jeton'])),
      SI('TRANCHE-C2', P(x('Délai de notification de l’ordre de service prescrivant de commencer les travaux de la tranche conditionnelle n°2', ['<nombre de jours ou de mois>', '{{B02-LT-07}}', 'jeton'])))),
    // Article 6
    ...E('Article 6 -', '<Enumérer'),
    P(xj('<Enumérer', '{{B09-DC-01}}')),
    ...SI('BATIMENT', E('i) - Arrêté n° 738', 'Article 7 -')),
    // Article 7 — garanties
    ...E('Article 7 -', 'Aucune garantie d'),
    ...SI('SANS-GBE', P(x("Aucune garantie d'exécution"))),
    ...SI('GBE',
      P(x('Le montant de la garantie de bonne exécution est fixé')),
      P(x('<insérer le pourcentage du prix', ['<insérer le pourcentage du prix du Marché qui ne peut dépasser cinq pour cent (5%)>', '{{B05-GE-05.chiffres}} %', 'jeton'])),
      SI('GBE-DEVISES',
        P(x('Montant de la garantie de bonne exécution :')),
        P(xr('<insérer le pourcentage>', 0, ['<insérer le pourcentage>', '{{B05-GE-02}}', 'jeton'])),
        P(x('=et')),
        P(xr('<insérer le pourcentage>', 1, ['<insérer le pourcentage>', '{{B05-GE-05.chiffres}} %', 'jeton']))),
      P(x('La garantie de bonne exécution devra être fournie')),
      SI('GBE-BANCAIRE', P(x('- soit de garantie bancaire'))),
      SI('GBE-CAUTION', P(x('- soit une caution personnelle'))),
      SI('GBE-CHEQUE', P(x('- soit un chèque de banque'))),
      SI('LIBERATION-MOITIE', P(x('La garantie de bonne exécution est libérée de 50%'))),
      SI('LIBERATION-TOTALE', P(x('La garantie de bonne exécution est libérée à 100%')))),
    ...E('7.2.', '=Non applicable'),
    ...SI('RETENUE-NON', NA(0)),
    ...SI('RETENUE-OUI', P(x('Une retenue de garantie de', ['<maximum 5 %>', '{{B05-RG-02.chiffres}} %', 'jeton'], ['<ajouter le cas échéant:> ', '', 'retire']))),
    ...E('7.3.', '=Non applicable'),
    ...SI('RESTITUTION-NON', NA(1)),
    ...SI('RESTITUTION-OUI', P(x("Si l'Entrepreneur choisit de recevoir", ['<ajouter le cas échéant:> ', '', 'retire']))),
    ...E('7.4.', '=Non applicable'),
    ...SI('AUTRES-GARANTIES-NON', NA(2)),
    ...SI('AUTRES-GARANTIES-OUI', P(xj('<soit mentionner les garanties spécifiques', '{{B05-AG-01}}'))),
    // Article 8 — assurances (l'exemple du modèle remplacé par la saisie)
    ...E('Article 8 -', 'Article 9.'),
    P('{{B09-AC-01}}'),
    P('{{B09-AC-02}}'),
    ...SI('BATIMENT', P('{{B09-AC-03}}')),
    // Article 9 — discrétion
    ...E('Article 9.', '=Non applicable'),
    ...SI('DISCRETION-NON', NA(3)),
    ...SI('DISCRETION-OUI', P(x('Les travaux, objet du présent Marché, sont à exécuter'))),
    ...SI('DISCRETION-NOTIFICATION', P(x("Soit : que le Maître d'œuvre", ['Soit : ', '', 'retire']))),
    ...SI('DISCRETION-ANNEXE', P(x('Soit : mentionnées en Annexe', ['Soit : ', '', 'retire']))),
    // Article 10 — prix de revient
    ...E('Article 10 -', '=Non applicable.'),
    ...SI('PRIX-REVIENT-NON', P(x('=Non applicable.'))),
    ...SI('PRIX-REVIENT-OUI', P(x("Les dispositions de l'Article 8 du CCAG"))),
    ...SI('PRIX-REVIENT-ELEMENTS', P(xj('<préciser, le cas échéant, les éléments spécifiques', '{{B09-PV-02}}'))),
    // Article 11 — prix
    ...E('Article 11 -', '11.2.'),
    ...SI('SUJETION-OCCUPE', P('{{B09-CH-01}}')),
    ...SI('SUJETION-DELAI', P('{{B09-CH-02}}')),
    ...SI('SUJETION-HORAIRE', P('{{B09-CH-03}}')),
    ...SI('SUJETION-CLES', P('{{B09-CH-04}}')),
    ...SI('SUJETION-PRESTATIONS', P('{{B09-CH-05}}')),
    ...E('11.2.', 'Les prix du Marché peuvent comporter'),
    ...SI('DEVISES', E('Les prix du Marché peuvent comporter', '11.3.')),
    ...E('11.3.', 'Le Marché est traité sur la base d’un prix forfaitaire'),
    ...SI('FORFAIT', P(x('Le Marché est traité sur la base d’un prix forfaitaire'))),
    ...SI('UNITAIRES', P(x('Le Marché est traité sur la base de prix unitaires', ['<ajouter le cas échéant :> ', '', 'retire']))),
    ...E('11.4.', 'Les prix sont fermes'),
    ...SI('FERME', E('Les prix sont fermes', 'Les prix seront révisés')),
    ...SI('REVISABLE', P(x('Les prix seront révisés'))),
    // Article 12 — règlement, régie
    ...E('Article 12 -', '<préciser ici les modalités'),
    P(xj('<préciser ici les modalités de règlement', '{{B08-RE-01}}')),
    ...E('12.2.', '=Non applicable'),
    ...SI('REGIE-NON', NA(4)),
    ...SI('REGIE-OUI', E('Coefficient de majoration des salaires', 'Article 13 -', [['<Indiquer le taux de charges applicables', ['<Indiquer le taux de charges applicables aux salaires, le taux de frais généraux admis et le taux de marge admis>', '{{B08-RE-03}}', 'jeton']]])),
    // Article 13 — approvisionnements
    ...E('Article 13 -', '=Non applicable'),
    ...SI('APPROVISIONNEMENTS-NON', NA(5)),
    ...SI('APPROVISIONNEMENTS-OUI', P('{{B08-AP-02}}')),
    // Article 14 — avance
    ...E('Article 14.', '=Non applicable'),
    ...SI('SANS-AVANCE', NA(6)),
    ...SI('AVANCE', P(x("Le montant de l'avance forfaitaire est de"))),
    ...SI('AVANCE-ARIARY', P(x('<pourcentage> du montant total des travaux', ['<pourcentage>', '{{B08-AF-03.chiffres}} %', 'jeton']))),
    ...SI('AVANCE-DEVISES',
      P(x('<pourcentage> du montant en monnaie nationale', ['<pourcentage>', '{{B08-AF-04.chiffres}} %', 'jeton'])),
      P(x('<pourcentage> du montant en devises', ['<pourcentage>', '{{B08-AF-05.chiffres}} %', 'jeton']))),
    // Articles 15 et 16
    ...E('Article 15 -', 'Les comptes seront réglés en une seule fois'),
    ...SI('REGLEMENT-UNIQUE', P(x('Les comptes seront réglés en une seule fois'))),
    ...SI('DECOMPTES-MENSUELS', P(x('Délai de remise du projet de décompte'))),
    ...SI('UNITAIRES', P(x('Le règlement des sommes dues à l’Entrepreneur s’effectuera par application des prix unitaires'))),
    ...SI('FORFAIT', E('Le règlement des sommes dues à l’Entrepreneur s’effectuera par application du prix forfaitaire', 'Article 17 -')),
    // Articles 17 à 19 — masse des travaux
    ...E('Article 17 -', 'Article 20 -', [
      ['Le changement dans la masse des travaux peut être demandé par ordre de service sans nécessité de conclure un avenant lorsque ces changements n\'entraîne pas de variations', ['<pourcentage inférieur à 20%>', '{{B09-MA-01}}', 'jeton']],
      ['Le changement dans la masse des travaux peut être demandé par ordre de service sans nécessité de conclure un avenant lorsque ces changements n\'entraîne pas de diminution', ['<pourcentage inférieur à 20%>', '{{B09-MA-02}}', 'jeton']],
      ['La diminution dans la masse des travaux au delà de', ['<pourcentage>', '{{B09-MA-03}}', 'jeton']],
      ['Le changement des quantités de certaines natures', ['<pourcentage inférieur à 30%>', '{{B09-MA-04}}', 'jeton']]]),
    // Article 20 — force majeure
    ...E('Article 20 -', 'Constitueront des cas de force majeure'),
    ...SI('FORCE-MAJEURE-OUI', P(x('Constitueront des cas de force majeure')), P(xj('<à préciser, par exemple', '{{B09-FM-02}}')), ...E('En vue de l’application éventuelle', '=Non applicable')),
    ...SI('FORCE-MAJEURE-NON', NA(7)),
    // Articles 21 et 22 — délais
    ...E('Article 21 -', 'Article 23 -', [
      ["Le délai d'exécution est fixé à", ['<insérer délai>', '{{B09-DL-01}}', 'jeton']],
      ['La PRMP peut notifier une prolongation', ['<indiquer le nombre de jours>', '{{B09-MD-01}}', 'jeton']],
      ["Une prolongation des délais n'est justifiée", ['<nombre>', '{{B09-MD-02}}', 'jeton']]]),
    // Article 23 — pénalités (question `penalites` du cadrage)
    ...E('Article 23 -', 'Les pénalités journalières prévues'),
    ...SI('PENALITES-NON', P(x('Les pénalités journalières prévues'))),
    ...SI('PENALITES-OUI', P(x('Les pénalités journalières applicables')), P(x('<millièmes>', ['<millièmes>', '{{B09-PE-02}}', 'jeton']))),
    // Articles 24 à 27
    ...E('Article 24 -', 'Article 26 -', [
      ['<Indiquer, le cas échéant, les modalités de vérification', [texteDe(d, '<Indiquer, le cas échéant, les modalités de vérification'), '{{B09-VQ-01}}', 'jeton']],
      ['<Indiquer, le cas échéant, quels sont les matériaux', [texteDe(d, '<Indiquer, le cas échéant, quels sont les matériaux'), '{{B09-PM-01}}', 'jeton']]]),
    ...E('Article 26 -', 'Il n\'est pas prévu de période'),
    ...SI('PREPARATION-NON', P(x("Il n'est pas prévu de période"))),
    ...SI('PREPARATION-OUI',
      P(x('26.1.')),
      P(x("<préciser le nombre de jours qui peut déroger", ["<préciser le nombre de jours qui peut déroger au délai de deux mois prévu à l'article 28.1 CCAG >", '{{B09-PT-02}}', 'jeton'])),
      P(x('26.2.')),
      P(xr('<préciser le nombre de jours qui doit être au minimum de 10>', 0, ['<préciser le nombre de jours qui doit être au minimum de 10>', '{{B09-PT-03}}', 'jeton']))),
    ...SI('HYGIENE',
      P(x('26.3.')),
      P(xr('<préciser le nombre de jours qui doit être au minimum de 10>', 1, ['<préciser le nombre de jours qui doit être au minimum de 10>', '{{B09-PT-04}}', 'jeton']))),
    ...E('Article 27 -', '28.1.', [['Le visa du Maître', ['< nombre de jours>', '{{B09-VX-01}}', 'jeton']]]),
    // Article 28 — réception
    ...E('28.1.', 'Les tranches de travaux comportant'),
    ...SI('RECEPTION-TRANCHES', P(x('Les tranches de travaux comportant'))),
    ...E('28.2.', 'La constatation du repliement', [
      ['Par dérogation au CCAG, le délai du début', ['<jours>', '{{B09-RP-03}}', 'jeton']]]),
    P('{{B09-RP-04}}'),
    ...E('La constatation du repliement', 'Article 29 -'),
    // Article 29 — délai de garantie ; 30 (fixe) ; 31 contentieux ; 32 dérogations
    ...E('Article 29 -', 'Article 31 -', [["<Insérer le nombre de mois ou d'années>", ["<Insérer le nombre de mois ou d'années>", '{{B09-GT-01}} mois', 'jeton']]]),
    ...E('Article 31 -', 'Article 32 -'),
    P('{{B10-PC-01}}'),
    ...E('Article 32 -', '=Annexe au CCAP'),
    ...SI('DEROGATIONS', P('{{B10-DR-01}}')),
    // Les six annexes (B11-FR-01 à -06), chacune sous sa condition
    ...SI('REVISABLE', E(['=Annexe au CCAP', 0], '=Annexe au CCAP')),
    ...SI('ANNEXE-GBE-BANCAIRE', E(['=Annexe au CCAP', 1], '=Annexe au CCAP')),
    ...SI('ANNEXE-GBE-CAUTION', E(['=Annexe au CCAP', 2], '=Annexe au CCAP')),
    ...SI('ANNEXE-AVANCE', E(['=Annexe au CCAP', 3], ['=Annexe au CCAP', 1])),
    ...E(['=Annexe au CCAP', 5]),
    ...SI('PLANS', P('{{B04-CD-03}}')),
  ];
  const titre = ligne(d, 'MARCHÉ PUBLIC DE TRAVAUX').texte;
  toutEstRendu(d, 'CCAP-T');
  return { fichier: 'CCAP-T.docx', sigle: 'CCAP-T', source: 'travaux-ccap', titre, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}
/** Le texte entier d'un paragraphe (un trou qui est le paragraphe entier). */
function texteDe(sec, motif) { return sec.lignes.find((l) => correspond(l, motif)).texte; }

// ══ Lettre d'invitation des prestations intellectuelles (plan du 01/10, lot AV-4) ════════════════════════════
// Source : « 1.1. LETTRE D'INVITATION », en tête du volume 1 du dossier type PI (Instructions aux candidats). Une lettre
// PAR candidat de la liste restreinte (Q1) : le destinataire, la liste, le lieu et la date sont saisis à l'impression
// (jetons `{{LETTRE.*}}`, pas des champs de la fiche) ; le mode de sélection vient de la fiche (`B02-MS-01`, conditions
// du DPIC). En-tête commun avec l'avis spécifique : emblème, autorité, PRMP, UGPM.
function lettrePi() {
  const SRC = lireSource('pi-ic');
  const d = sectionDe(SRC, '1.1. LETTRE', 'PREMIERE PARTIE');
  const tr = [];
  const x = (motif, ...r) => { const l = ligne(d, motif); return traiter(tr, l.n, l.texte, ...r); };
  const ajouts = [];
  const ajout = (t) => { ajouts.push(t); return t; };
  retirer(d, 'intitulé d’option : seule la rédaction retenue est imprimée', '<indiquer le mode de sélection', '<soit:>');

  const conditions = {
    // Les mêmes que le DPIC : la rédaction du mode de sélection suit `B02-MS-01`.
    SFQC: 'B02-MS-01 contient expérience',
    BUDGET: 'B02-MS-01 contient budget prédéterminé',
    'MOINDRE-COUT': 'B02-MS-01 contient note technique minimale',
    'QUALITE-SEULE': 'B02-MS-01 contient exclusivement',
  };

  const blocs = [
    C(ajout('{{IMAGE:embleme}}')),
    C(x('<En tête de l', ["<En tête de l'Autorité Contractante>", '{{B01-AC-01}}', 'jeton'])),
    C(ajout('LA PERSONNE RESPONSABLE DES MARCHES PUBLICS')),
    C(ajout('UNITE DE GESTION DE PASSATION DES MARCHES PUBLICS')),
    { type: 'titre', texte: x('1.1. LETTRE', ['1.1. ', '', 'retire']) },
    P(x('Référence:', ['<insérer intitulé et références du Marché>', '{{B02-OB-03}} — {{B02-OB-01}}', 'jeton'])),
    // Q2 — le lieu et la date d'envoi, saisis à l'impression.
    P(x('<insérer : lieu et date>', ['<insérer : lieu et date>', '{{LETTRE.lieu}}, {{LETTRE.date}}', 'jeton'])),
    // Q1 — le destinataire : un candidat de la liste restreinte (nom, puis adresse).
    P(x('< insérer', ['< insérer : Nom et adresse du Consultant>', '{{LETTRE.destinataire}}', 'jeton'])),
    P(x('Madame, Monsieur')),
    P(x('1. Nous avons l’honneur')),
    P(x('Nous vous invitons en conséquence')),
    P(x('2. Une lettre d\'invitation')),
    // La liste restreinte, un candidat par ligne (Q4 : libre, au moins un).
    P(x('<insérer : liste des 5 candidats', ['<insérer : liste des 5 candidats invités à remettre une proposition>', '{{LETTRE.candidats}}', 'jeton'])),
    P(x('3. Le Marché sera attribué')),
    ...SI('SFQC', P(x('de la qualité technique de la proposition'))),
    ...SI('BUDGET', P(x('d’un budget prédéterminé'))),
    ...SI('MOINDRE-COUT', P(x('de la meilleure proposition financière'))),
    ...SI('QUALITE-SEULE', P(x('exclusivement de la qualité technique'))),
    P(x('Les procédures et critères de sélection')),
    P(x('4. Le Dossier de Consultation comprend')),
    P(x('Les documents relatifs à la procédure')),
    P(x('La présente Lettre')),
    P(x('Les instructions aux candidats')),
    P(x('Les Termes de référence')),
    P(x('Les documents constituant le marché')),
    P(x('L\'Acte d\'Engagement')),
    P(x('Le Cahier des Prescriptions Spéciales')),
    P(x('le Cahier des Clauses administratives Générales')),
    P(x('5. Nous vous serions reconnaissants')),
    // Q3 — l'adresse de l'autorité et le courriel de la PRMP.
    P(x('<insérer l’adresse>', ['<insérer l’adresse>', '{{B01-AC-02}} ({{B01-AC-06}})', 'jeton'])),
    P(x('que vous avez reçu cette lettre')),
    P(x('que vous soumettrez une proposition')),
    P(x('Veuillez agréer')),
    P(ajout('La Personne Responsable des Marchés Publics')),
    P(x('<Insérer nom et signature', ['<Insérer nom et signature de la Personne Responsable des Marchés Publics ou de son délégué>', '{{B01-AC-05}}', 'jeton'])),
  ];
  toutEstRendu(d, 'LETTRE-PI');
  return { fichier: 'LETTRE-PI.docx', sigle: 'LETTRE-PI', source: 'pi-ic', titre: null, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ Avis spécifique d'appel d'offres (plan du 30/09, lot AV-1) ═══════════════════════════════════════════════
// Source : « AVIS SPECIFIQUES » en tête du document type du contrat-cadre (fournitures et services) — le seul modèle
// d'avis des documents types ; sa rédaction couvre les trois formes (« à quantités fixes », « à commandes »,
// « contrat-cadre »). AVIS-F : fournitures, tel quel. AVIS-T : travaux, le même modèle ADAPTÉ (arbitrage Q2 du pilote) —
// « pour fournir » → « pour exécuter les travaux suivants : », « Les fournitures » → « Les travaux », prix mixte ; chaque
// texte adapté est un AJOUT déclaré. Les informations de PUBLICATION (date de l'avis, JMP de l'avis général, supports)
// ne sont pas des données du DAO : saisies à l'impression (Q4), elles arrivent en jetons `{{AVIS.*}}`.
function avisSpecifique(categorie) {
  const T = categorie === 'TRAVAUX';
  const SRC = lireSource('contrat-cadre');
  const d = sectionDe(SRC, 'AVIS SPECIFIQUES', 'DONNEES PARTICULIERES D');
  const tr = [];
  const x = (motif, ...r) => { const l = ligne(d, motif); return traiter(tr, l.n, l.texte, ...r); };
  const ajouts = [];
  /** L'adaptation aux travaux d'un texte déjà traité : déclarée en ajout quand elle change quelque chose. */
  const adapte = (t, ...paires) => {
    if (!T) return t;
    const a = paires.reduce((s, [de, par]) => { if (!s.includes(de)) throw new Error(`AVIS-T : « ${de} » absent`); return s.replace(de, par); }, t);
    ajouts.push(a);
    return a;
  };
  const TRAVAUX_OBJET = [['pour fournir ', 'pour exécuter les travaux suivants : ']];
  const TRAVAUX_LOTS = [['Les fournitures sont réparties en', 'Les travaux sont répartis en']];
  const TRAVAUX_LOT_UNIQUE = [['Les fournitures constituent un lot unique indivisible', 'Les travaux constituent un lot unique indivisible']];

  retirer(d, 'bandeau du document type (titre de partie et en-tête de page)', '=AVIS SPECIFIQUES', '=Contrat-cadre');
  retirer(d, 'instruction à l’acheteur : l’adresse est détaillée ligne par ligne ci-dessous', '[insérer Adresse exacte');
  // ⚠️ 30/09 (avis réel de la Région Analamanga, analyse E3) — la date de publication va au bas, avec le lieu.
  retirer(d, 'la date de publication s’imprime au bas de l’avis, avec le lieu (« à …, le … »), comme sur l’avis réel', '[insérer Date de publication]');

  // ⚠️ 30/09 (analyse E4) — paragraphes numérotés 1, 2, 3… : `{{NUM}}` est remplacé par le moteur du serveur, dans
  // l'ordre des paragraphes IMPRIMÉS (le § de la garantie ou celui des marchés subséquents peuvent manquer).
  ajouts.push('{{NUM}} ');
  const num = (t) => { const n = `{{NUM}} ${t}`; if (!PRODUITS.has(t)) ajouts.push(n); return n; };
  /** Un texte hors source (en-tête, adresse, date) : déclaré en ajout. */
  const ajout = (t) => { ajouts.push(t); return t; };

  const conditions = {
    CC: 'typeMarche = CONTRAT_CADRE',
    ORDINAIRE: 'typeMarche != CONTRAT_CADRE',
    'CC-ALLOTI': 'typeMarche = CONTRAT_CADRE et alloti = OUI',
    'CC-LOT-UNIQUE': 'typeMarche = CONTRAT_CADRE et alloti != OUI',
    'ORDINAIRE-ALLOTI': 'typeMarche != CONTRAT_CADRE et alloti = OUI',
    'ORDINAIRE-LOT-UNIQUE': 'typeMarche != CONTRAT_CADRE et alloti != OUI',
    'QF-UNITAIRES': 'typeMarche = QUANTITE_FIXE et typePrix = UNITAIRES',
    'QF-FORFAITAIRE': 'typeMarche = QUANTITE_FIXE et typePrix = FORFAITAIRE',
    'AC-UNITAIRES': 'typeMarche = A_COMMANDE et typePrix = UNITAIRES',
    'AC-FORFAITAIRE': 'typeMarche = A_COMMANDE et typePrix = FORFAITAIRE',
    'CC-UNITAIRES': 'typeMarche = CONTRAT_CADRE et typePrix = UNITAIRES',
    'CC-FORFAITAIRE': 'typeMarche = CONTRAT_CADRE et typePrix = FORFAITAIRE',
    ...(T ? {
      'QF-MIXTE': 'typeMarche = QUANTITE_FIXE et typePrix = MIXTE',
      'AC-MIXTE': 'typeMarche = A_COMMANDE et typePrix = MIXTE',
      'CC-MIXTE': 'typeMarche = CONTRAT_CADRE et typePrix = MIXTE',
    } : {}),
    ELECTRONIQUE: 'modeRemise = ELECTRONIQUE',
    PAPIER: 'modeRemise != ELECTRONIQUE',
    ...(T ? { GARANTIE: 'garantieSoumission = OUI' } : {
      'GARANTIE-LOTS': 'garantieSoumission = OUI et alloti = OUI',
      'GARANTIE-UNIQUE': 'garantieSoumission = OUI et alloti != OUI',
    }),
    'CONSULTATION-EMAIL': 'B04-DS-11 renseigne',
    // ⚠️ 30/09 (analyse E5, E13, E16) — supports de publication facultatifs (clé posée par le serveur à l'impression),
    // montant du DAO par lot, phrase « sans garantie ».
    SUPPORTS: 'supportsPublication renseigne',
    'SANS-SUPPORTS': 'supportsPublication vide',
    'DAO-LOTS': 'alloti = OUI',
    'DAO-UNIQUE': 'alloti != OUI',   // ⚠️ 01/10 — sans réponse « alloti », la variante lot unique (jamais rien)
    'SANS-GARANTIE': 'garantieSoumission != OUI',
  };

  // Le numéro de l'appel d'offres, seul (analyse E2) : B02-OB-03 (marché ordinaire), B02-OE-01 (contrat-cadre).
  const numero = (code) => x('[insérer Numéro et Titre', ['[insérer Numéro et Titre de l’AAO]', `N° {{${code}}}`, 'jeton']);
  // La phrase d'ouverture : offres (ou offres et candidatures en contrat-cadre) × lots. L'objet entre guillemets (E6).
  const sollicite = (cc, alloti) => {
    const objet = ['[insérer une brève description des Fournitures et des services]', '« {{B02-OB-01}} »', 'jeton'];
    const offres = ['des offres [pour le cas d’un contrat-cadre, remplacer par <des offres et des candidatures>]', cc ? 'des offres et des candidatures' : 'des offres', 'choix'];
    const acheteur = ['[insérer le nom de l’Acheteur]', '{{B01-AC-01}}', 'jeton'];
    const lots = alloti
      ? [['[insérer le nombre de lots]', '{{B02-LV-01}} lots', 'jeton'],
        [' ou < [Les fournitures constituent un lot unique indivisible. Ainsi, toute offre partielle n’est pas recevable] >', '', 'retire']]
      : [['Les fournitures sont réparties en [insérer le nombre de lots]. Le (ou les) candidat(s) peut (ou peuvent) soumissionner pour un ou plusieurs lots ou < [Les fournitures constituent un lot unique indivisible. Ainsi, toute offre partielle n’est pas recevable] >',
        'Les fournitures constituent un lot unique indivisible. Ainsi, toute offre partielle n’est pas recevable', 'choix']];
    return adapte(x('Le [insérer le nom de l', acheteur, offres, objet, ...lots), ...TRAVAUX_OBJET, ...(alloti ? TRAVAUX_LOTS : TRAVAUX_LOT_UNIQUE));
  };
  // La procédure : forme × prix.
  const FORME = { QF: '« à quantités fixes »', AC: '« à commandes »', CC: '« contrat-cadre »' };   // entre guillemets (E10)
  const PRIX = { UNITAIRES: 'à prix unitaire', FORFAITAIRE: 'à prix forfaitaire' };
  const procedure = (f, p) => {
    const t = x('La procédure de passation', ['[préciser « à quantités fixes », « à commandes » ou « contrat-cadre »]', FORME[f], 'choix'],
      ['[insérer « à prix unitaire » ou « à prix forfaitaire »]', PRIX[p === 'MIXTE' ? 'UNITAIRES' : p], 'choix']);
    return p === 'MIXTE' ? adapte(t, ['conclu à prix unitaire', 'conclu à prix unitaire et à prix forfaitaire']) : t;
  };
  const prix = T ? ['UNITAIRES', 'FORFAITAIRE', 'MIXTE'] : ['UNITAIRES', 'FORFAITAIRE'];
  // Les plis : adresse et date limite de remise, selon la forme et la catégorie.
  const plis = (adresse, date) => x('Les plis devront parvenir', ['[insérer adresse physique complète y compris N° porte et étage]', `{{${adresse}}}`, 'jeton'],
    ['[insérer date et heure]', date, 'jeton']);
  const garantie = (montant) => x('Chaque offre doit être accompagnée', ['[insérer montant en monnaie nationale]', montant, 'jeton']);

  // Le rappel de l'avis général : « et dans {supports} » seulement si des supports sont saisis (E5).
  const rappel = (supports) => x('Cet Avis spécifique', ['[insérer le numéro du JMP]', '{{AVIS.jmp-numero}}', 'jeton'], ['[insérer la date publication du JMP]', '{{AVIS.jmp-date}}', 'jeton'],
    supports ? ['[préciser les supports utilisés et la date de leur publication]', '{{AVIS.supports}}', 'jeton']
      : [' et dans [préciser les supports utilisés et la date de leur publication]', '', 'retire']);
  // ⚠️ 01/10 (décision du pilote, Q7) — le prix du DAO se paie sur le COMPTE BANCAIRE UNIQUE de l'ARMP, réglé une fois par
  // l'Administrateur (`{{PARAM.compte-dao}}`), au lieu de « libellé au nom de l'Agent comptable ou du régisseur ».
  const PAYEUR = 'libellé au nom de l’Agent comptable de l’ARMP ou au nom du régisseur de recettes de l’ARMP';
  const compteArmp = (t) => {
    if (!t.includes(PAYEUR)) throw new Error(`AVIS : « ${PAYEUR} » absent`);
    return ajout(t.replace(PAYEUR, 'à verser sur le compte bancaire de l’ARMP : {{PARAM.compte-dao}}'));
  };
  // Le retrait du DAO « auprès de » l'autorité nommée (E12, Q6).
  const retrait = () => x('Pour le (ou les) candidat(s) désirant soumissionner', ['l’Autorité contractante', '{{B01-AC-01}}', 'jeton']);

  const blocs = [
    // L'en-tête de l'avis réel (E1) : l'emblème, puis l'autorité, la PRMP et l'UGPM. ⚠️ 30/09 — `{{IMAGE:embleme}}` : le
    // serveur y insère l'image de tête de ses PV (sceau, drapeau, « REPOBLIKAN'I MADAGASIKARA » et devise, dans l'image :
    // les deux lignes de texte ne sont donc pas répétées).
    C(ajout('{{IMAGE:embleme}}')),
    C(x('[insérer : entête', ['[insérer : entête de l’Acheteur]', '{{B01-AC-01}}', 'jeton'])),
    C(ajout('LA PERSONNE RESPONSABLE DES MARCHES PUBLICS')),
    C(ajout('UNITE DE GESTION DE PASSATION DES MARCHES PUBLICS')),
    // Le titre sous l'en-tête, comme sur l'avis réel (centré, gras : le style TITRE, à cette place).
    { type: 'titre', texte: x('Avis d’Appel d’Offres Ouvert') },
    ...SI('ORDINAIRE', C(numero('B02-OB-03'))),
    ...SI('CC', C(numero('B02-OE-01'))),
    ...SI('SUPPORTS', P(num(rappel(true)))),
    ...SI('SANS-SUPPORTS', P(num(rappel(false)))),
    ...SI('ORDINAIRE-ALLOTI', P(num(sollicite(false, true)))),
    ...SI('ORDINAIRE-LOT-UNIQUE', P(num(sollicite(false, false)))),
    ...SI('CC-ALLOTI', P(num(sollicite(true, true)))),
    ...SI('CC-LOT-UNIQUE', P(num(sollicite(true, false)))),
    ...['QF', 'AC', 'CC'].flatMap((f) => prix.flatMap((p) => SI(`${f}-${p}`, P(num(procedure(f, p)))))),
    P(num(x('Le Dossier d’Appel d’Offres complet'))),
    // L'adresse de consultation en liste, avec ses libellés (E11) ; « Adresse » réunit le bureau et la localité.
    P(x('=Nom du Responsable', ['Nom du Responsable', '- Nom du Responsable : {{B04-DS-07}}', 'jeton'])),
    P(x('=Fonction', ['Fonction', '- Fonction : {{B04-DS-08}}', 'jeton'])),
    P((ligne(d, 'Bureau, N° porte'), ajout('- Adresse : {{B04-DS-09}}, {{B04-DS-10}}'))),
    ...SI('CONSULTATION-EMAIL', P(x('E-mail', ['E-mail ]', '- E-mail : {{B04-DS-11}}', 'jeton']))),
    P(num(retrait())),
    // Le montant du DAO : une ligne par lot sur une ligne allotie (E13, `.lignesParLot` : « - Lot n : … (Ar …) »).
    ...SI('DAO-LOTS', P(ajout('{{B04-DS-05.lignesParLot}}')),
      P(compteArmp(x('- [insérer montant en lettres]', ['- [insérer montant en lettres] Ariary (Ar [insérer montant en chiffres]) ', '', 'retire'])))),
    ...SI('DAO-UNIQUE', P(compteArmp(x('- [insérer montant en lettres]', ['[insérer montant en lettres] Ariary', '{{B04-DS-05.lettres}}', 'jeton'], ['[insérer montant en chiffres]', '{{B04-DS-05.chiffres}}', 'jeton'])))),
    // La date limite « le JJ/MM/AAAA à HH h MM (heure locale) » (E15, `.heureLocale`).
    ...SI('ORDINAIRE', P(num(T ? plis('B01-AC-02', '{{B04-OV-02.heureLocale}}') : plis('B04-LR-02', '{{B04-LR-03}}, {{B04-LR-04}}')))),
    ...SI('CC', P(num(plis('B04-RQ-03', '{{B04-CP-02.heureLocale}}')))),
    ...SI('ELECTRONIQUE', P(num(x('La soumission des offres par voie électronique', ['[insérer « sera » ou « ne sera pas »]', 'sera', 'choix'])))),
    ...SI('PAPIER', P(num(x('La soumission des offres par voie électronique', ['[insérer « sera » ou « ne sera pas »]', 'ne sera pas', 'choix'])))),
    ...(T
      ? SI('GARANTIE', P(num(garantie('{{B05-GQ-03.lettres}} ({{B05-GQ-03}})'))))
      : [...SI('GARANTIE-LOTS', P(num(garantie('{{B05-GS-03.parLot}}')))), ...SI('GARANTIE-UNIQUE', P(num(garantie('{{B05-GS-03.lettres}} ({{B05-GS-03}})'))))]),
    ...SI('SANS-GARANTIE', P(num(ajout('La garantie de soumission n’est pas requise.')))),
    ...SI('CC', P(num(x('Les titulaires du contrat-cadre')))),
    // Le lieu et la date au bas (E3, Q3 : la localité de l'autorité), au-dessus de la signature.
    P(ajout('à {{B04-DS-10}}, le {{AVIS.date-publication}}')),
    P(x('La Personne Responsable des Marchés Publics')),
    P('{{B01-AC-05}}'),
  ];
  ajouts.push('{{B01-AC-05}}');   // le nom de la PRMP sous sa qualité, comme au bas des autres documents produits
  toutEstRendu(d, T ? 'AVIS-T' : 'AVIS-F');
  const sigle = T ? 'AVIS-T' : 'AVIS-F';
  return { fichier: `${sigle}.docx`, sigle, source: 'contrat-cadre', titre: null, conditions, blocs, trace: tr, retraits: d.retraits, ajouts };
}

// ══ Sortie ═══════════════════════════════════════════════════════════════════════════════════
const DOCUMENTS = { 'DPAC-CC': dpacContratCadre, 'AE-CC': aeContratCadre, 'DPAO-F': dpaoFournitures, 'AE-F': aeFournitures, 'CCAP-F': ccapFournitures, 'DPIC-PI': dpicPi, 'AE-PI': aePi, 'CPS-PI': cpsPi, 'DPAO-T': dpaoTravaux, 'AE-T': aeTravaux, 'CCAP-T': ccapTravaux, 'AVIS-F': () => avisSpecifique('FOURNITURES_SERVICES'), 'AVIS-T': () => avisSpecifique('TRAVAUX'), 'LETTRE-PI': lettrePi };
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
  // ⚠️ 01/10 — un modèle sans `titre` (l'avis) porte son titre DANS le corps, à sa place : la ligne TITRE de tête, que le
  // moteur imprime avant tout le reste, n'est alors pas écrite (sinon le titre de l'avis sortait au-dessus de l'emblème).
  const commande = [['FICHIER', m.fichier], ...(m.titre ? [['TITRE', m.titre]] : []),
    ...Object.entries(m.conditions).map(([n, e]) => ['CONDITION', `${n}${US}${e}`]),
    ...m.blocs.map((b) => [b.type.toUpperCase(), b.texte])];
  fs.writeFileSync(`modeles/${sigle}.txt`, commande.map((l) => l.join('\t')).join('\n') + '\n', 'utf8');
  const nb = (g) => m.trace.filter((t) => t.genre === g).length;
  const jetons = [...new Set(m.blocs.flatMap((b) => b.texte.match(/\{\{(?!SI:|FINSI:)[^{}]+}}/g) ?? []))];
  console.log(`${sigle} — ${m.blocs.filter((b) => b.type !== 'ligne' && !/^\{\{(SI|FINSI):/.test(b.texte)).length} paragraphes, ${Object.keys(m.conditions).length} conditions, ${jetons.length} jetons distincts ; trous : ${nb('jeton')} jeton(s), ${nb('choix')} choix, ${nb('retire')} retrait(s), ${nb('typo')} coquille(s), ${nb('adapte')} adaptation(s) ; ${m.retraits.length} ligne(s) de la source retirée(s)`);
}
