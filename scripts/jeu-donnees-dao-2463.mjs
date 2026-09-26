// Jeu de données complet, tiré d'un DOSSIER D'APPEL D'OFFRES RÉELLEMENT PUBLIÉ :
//
//   MESupReS — AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026
//   « Fourniture et livraison des matériels informatiques répartis en CINQ (5) lots (à commande) »
//
// Le script rejoue TOUTE la chaîne PAR L'API, rôle par rôle, comme le feraient les vrais acteurs —
// aucune écriture directe en base, aucun code applicatif touché :
//
//   1. l'entité contractante (Administrateur), si elle n'existe pas encore
//   2. le plan de passation : dossier + PPM + la ligne de marché et ses cinq lots (PRMP)
//   3. la soumission du plan à la Commission (PRMP)
//   4. la réception (Secrétaire)
//   5. le dispatch au Membre (Président)
//   6. l'examen et sa soumission — avis favorable (Membre)
//   7. le visa (Président) puis les signatures → PV SIGNÉ, dossier clôturé
//   8. la ligne devient préparable en DAO — `node scripts/demo-dao.mjs <idDetail>` prend le relais
//
//   node jeu-donnees-dao-2463.mjs              joue la chaîne entière
//   node jeu-donnees-dao-2463.mjs --etapes 1-3 s'arrête après l'étape 3
//
// ⚠️ Écrit en base de développement.
const API = 'http://localhost:8080';
const MDP = 'Test@1234';
const args = process.argv.slice(2);
const spec = args.includes('--etapes') ? args[args.indexOf('--etapes') + 1] : '1-8';
const bornes = String(spec).split('-');
const DE = Number(bornes[0]) || 1;
const A = Number(bornes[1] ?? bornes[0]) || 8;

// ── Session par compte (cookie + jeton CSRF, comme le navigateur) ─────────────────────────────
const sessions = new Map();
const ouvrir = async (login) => {
  if (sessions.has(login)) return sessions.get(login);
  const s = { cookie: '', xsrf: '' };
  s.maj = (r) => {
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      const k = kv.slice(0, kv.indexOf('='));
      const v = kv.slice(kv.indexOf('=') + 1);
      s.cookie = [...s.cookie.split('; ').filter((x) => x && !x.startsWith(k + '=')), k + '=' + v].join('; ');
      if (k === 'XSRF-TOKEN') s.xsrf = decodeURIComponent(v);
    }
  };
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, motDePasse: MDP }),
  });
  s.maj(r);
  if (!r.ok) throw new Error('connexion ' + login + ' : ' + r.status);
  // ⚠️ Le jeton CSRF n'arrive pas avec le login : une première lecture le pose (comme le chargement
  // de la page côté navigateur). Sans elle, la première écriture part sans en-tête et se fait refuser.
  const amorce = await fetch(API + '/api/auth/moi', { headers: { Cookie: s.cookie } });
  s.maj(amorce);
  sessions.set(login, s);
  return s;
};
const appel = async (login, methode, url, corps) => {
  const s = await ouvrir(login);
  const entetes = { Cookie: s.cookie };
  if (methode !== 'GET') {
    entetes['X-XSRF-TOKEN'] = s.xsrf;
    if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  }
  const r = await fetch(API + url, { method: methode, headers: entetes, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  s.maj(r);
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { ok: r.ok, statut: r.status, corps: j, texte: t.slice(0, 300) };
};
const echec = (quoi, r) => {
  console.error('  ✗ ' + quoi + ' — ' + r.statut + ' ' + (r.corps?.message ?? r.texte));
  process.exit(1);
};
const etape = (n, titre) => {
  const joue = n >= DE && n <= A;
  if (joue) console.log('\n══ ÉTAPE ' + n + ' — ' + titre + ' ══');
  return joue;
};
const liste = (c) => (Array.isArray(c) ? c : (c?.content ?? []));

// ── Le dossier réel, transcrit ────────────────────────────────────────────────────────────────
const ENTITE = {
  libelleEntite: "MINISTERE DE L'ENSEIGNEMENT SUPERIEUR ET DE LA RECHERCHE SCIENTIFIQUE",
  adresse: 'Fiadanana, 2ème étage porte 204 — Antananarivo 101',
  categorieEntite: 'MINISTERE',
  idOrganigramme: 1,
  niveauHierarchique: 1,
  idLocalite: 'ANT',
};

/** Les cinq lots du DAO. Les montants se déduisent des garanties de soumission réelles (2 % du maximum). */
const LOTS = [
  { designationLot: 'Lot n°1 : ordinateurs et divers pour le Ministère', montLot: 80000000, qteLot: 50, uniteLot: 'unité' },
  { designationLot: 'Lot n°2 : ordinateurs pour Ambatondrazaka', montLot: 108500000, qteLot: 42, uniteLot: 'unité' },
  { designationLot: 'Lot n°3 : divers matériels pour Ambatondrazaka', montLot: 80000000, qteLot: 10, uniteLot: 'unité' },
  { designationLot: 'Lot n°4 : ordinateurs pour Fort-Dauphin', montLot: 108500000, qteLot: 42, uniteLot: 'unité' },
  { designationLot: 'Lot n°5 : divers matériels pour Fort-Dauphin', montLot: 80000000, qteLot: 10, uniteLot: 'unité' },
];

/**
 * Le calendrier prévisionnel : les étapes du mode « appel d'offres ouvert » (référentiel `tr_capm`).
 * ⚠️ Il fait foi pour le contrôle `DATES_ORDRE` de la fiche DAO — les dates de la fiche doivent s'y
 * ranger. Remise et ouverture des plis au 09/11/2026, attribution au 24/12/2026.
 * ⚠️ Toutes ces dates sont des hypothèses [H] (le dossier les laisse en blanc) — docs/jeu-donnees-2463-faits.md §8.
 * Le §8 place le lancement (étape 111) au 09/10/2026 et l'attribution (étape 123) au 10/12/2026 : écart à
 * trancher par le pilote (§10), rien n'est changé ici en attendant.
 */
const PROCESSUS = [
  [101, '2026-06-01', '2026-06-15'], [102, '2026-06-16', '2026-06-30'], [103, '2026-07-01', '2026-07-07'],
  [104, '2026-07-08', '2026-07-31'], [106, '2026-08-03', '2026-08-05'], [107, '2026-08-06', '2026-08-20'],
  [108, '2026-08-21', '2026-08-25'], [109, '2026-08-26', '2026-08-28'], [110, '2026-08-31', '2026-09-04'],
  [111, '2026-09-07', '2026-09-08'], [112, '2026-09-08', '2026-11-09'], [113, '2026-11-09', '2026-11-10'],
  [114, '2026-11-10', '2026-11-20'], [115, '2026-11-23', '2026-11-25'], [116, '2026-11-26', '2026-11-30'],
  [117, '2026-12-01', '2026-12-02'], [118, '2026-12-03', '2026-12-11'], [119, '2026-12-14', '2026-12-16'],
  [120, '2026-12-17', '2026-12-18'], [121, '2026-12-21', '2026-12-23'], [123, '2026-12-24', '2026-12-28'],
  [124, '2026-12-28', '2026-12-29'], [125, '2026-12-30', '2027-01-08'], [126, '2027-01-11', '2027-01-15'],
  [127, '2027-01-18', '2027-01-22'], [128, '2027-01-25', '2027-01-27'], [129, '2027-01-28', '2027-01-29'],
  [130, '2027-02-01', '2028-01-31'],
];

const LIGNE = {
  designationMarche: 'Fourniture et livraison des matériels informatiques répartis en cinq (5) lots (à commande)',
  numCompte: '2463',
  montEstim: 457000000,
  financement: 'RPI', // Ressources Propres Internes (champ borné à 20 caractères)
  idNature: 2, // Fournitures → catégorie FOURNITURES_SERVICES
  idMode: 1, // Appel d'offres ouvert → seul mode qui ouvre la préparation d'un DAO
  formeMarche: 'A_COMMANDE',
  lots: LOTS,
  processus: PROCESSUS.map(([idCapm, dateDebut, dateFin]) => ({ idCapm, dateDebut, dateFin })),
};

const etat = {};

// ── 1. L'entité contractante ──────────────────────────────────────────────────────────────────
if (etape(1, "L'entité contractante — la PRMP la crée, l'Administrateur approuve le rattachement")) {
  const l = await appel('PRMP001', 'GET', '/api/entite-contracts');
  const deja = liste(l.corps).find((e) => e.libelleEntite?.trim() === ENTITE.libelleEntite);
  if (deja) {
    etat.idEntite = deja.idEntiteContract;
    console.log('  = entité déjà au référentiel : ' + deja.idEntiteContract);
  } else {
    // ⚠️ C'est la PRMP qui crée l'entité absente du référentiel (ouvert depuis le 26/07) : le serveur
    // pose alors un rattachement PRMP↔entité EN ATTENTE (`actif = false`) que l'Administrateur approuve.
    const idLibre = Math.max(0, ...liste(l.corps).map((e) => e.idEntiteContract)) + 1;
    const r = await appel('PRMP001', 'POST', '/api/entite-contracts', { idEntiteContract: idLibre, ...ENTITE });
    if (!r.ok) echec("création de l'entité", r);
    etat.idEntite = r.corps.idEntiteContract;
    console.log('  ✓ créée par la PRMP : ' + etat.idEntite + ' · ' + ENTITE.libelleEntite);
  }
  const liens = await appel('ADMIN01', 'GET', '/api/prmp-entites');
  const lien = liste(liens.corps).find((x) => x.idEntiteContract === etat.idEntite);
  if (lien?.actif) {
    console.log('  = rattachement déjà actif (lien ' + lien.idPrmpEntite + ')');
  } else if (lien) {
    const r = await appel('ADMIN01', 'PUT', '/api/prmp-entites/' + lien.idPrmpEntite, { ...lien, actif: true });
    if (!r.ok) echec('approbation du rattachement', r);
    console.log('  ✓ rattachement approuvé par l’Administrateur (lien ' + lien.idPrmpEntite + ')');
  } else {
    const r = await appel('ADMIN01', 'POST', '/api/prmp-entites', { idPrmp: 'IMP001', idEntiteContract: etat.idEntite, actif: true });
    if (!r.ok) echec('rattachement de l’entité à la PRMP', r);
    console.log('  ✓ rattachement créé et activé par l’Administrateur');
  }
}

// ── 2. Le plan de passation ───────────────────────────────────────────────────────────────────
if (etape(2, 'Le plan de passation — dossier, PPM et ligne de marché (PRMP)')) {
  if (etat.idEntite == null) {
    const l = await appel('ADMIN01', 'GET', '/api/entite-contracts');
    etat.idEntite = liste(l.corps).find((e) => e.libelleEntite?.trim() === ENTITE.libelleEntite)?.idEntiteContract;
  }
  const r = await appel('PRMP001', 'POST', '/api/saisies/ppm', {
    idEntiteContract: etat.idEntite,
    exercice: 2026, // [D] de la référence du dossier
    dateSignature: '2026-06-30', // [H] docs/jeu-donnees-2463-faits.md §10
    marches: [LIGNE],
  });
  if (!r.ok) { console.error(JSON.stringify(r.corps,null,1).slice(0,900)); echec('saisie du PPM', r); }
  etat.idDossier = r.corps.idDossier;
  console.log('  ✓ dossier ' + etat.idDossier + ' · ' + r.corps.statut);
  const m = await appel('PRMP001', 'GET', '/api/marches?dossier=' + etat.idDossier);
  const lignes = liste(m.corps);
  etat.idDetail = lignes[0]?.idDetail;
  console.log('  ✓ ligne ' + etat.idDetail + ' · ' + String(lignes[0]?.designationMarche).slice(0, 62) + '…');
  console.log('    ' + LOTS.length + ' lots · ' + PROCESSUS.length + ' étapes prévisionnelles · ' + LIGNE.montEstim.toLocaleString('fr-FR') + ' Ar');
}

/** Retrouve le dossier du plan (relance partielle du script). */
const dossierDuPlan = async () => {
  if (etat.idDossier != null) return etat.idDossier;
  const d = await appel('PRMP001', 'GET', '/api/dossiers?page=0&size=50');
  const trouve = liste(d.corps).find((x) => x.idEntiteContract === 11 || x.idTypeDossier === 1);
  etat.idDossier = trouve?.idDossier;
  return etat.idDossier;
};

// ── 3. La soumission à la Commission ──────────────────────────────────────────────────────────
if (etape(3, 'La soumission du plan à la Commission (PRMP)')) {
  const id = await dossierDuPlan();
  const r = await appel('PRMP001', 'POST', '/api/dossiers/' + id + '/soumettre', {});
  if (!r.ok && r.corps?.code !== 'DEJA_SOUMIS') echec('soumission', r);
  const d = await appel('PRMP001', 'GET', '/api/dossiers/' + id);
  etat.reference = d.corps?.refeDossier;
  console.log('  ✓ dossier ' + id + ' · ' + d.corps?.statut + ' · référence ' + (etat.reference ?? '—'));
}

// ── 4. La réception ───────────────────────────────────────────────────────────────────────────
if (etape(4, 'La réception du dossier (Secrétaire)')) {
  const id = await dossierDuPlan();
  const existe = await appel('SECANT1', 'GET', '/api/receptions/dossier/' + id + '/existe');
  if (existe.corps?.existe) {
    etat.idReception = existe.corps.idReception;
    console.log('  = déjà réceptionné (réception ' + etat.idReception + ')');
  } else {
    const r = await appel('SECANT1', 'POST', '/api/receptions', {
      idDossier: id,
      numPassage: 1,
      typePassage: 'INITIAL',
      imCtrlRecept: 'SECANT1', // ⚠️ nommer le réceptionnaire : sans lui, le circuit n'a pas d'acteur de réception
      dateReception: new Date().toISOString().slice(0, 10),
      complet: true,
      observation: 'Dossier complet : plan de passation, fiche de présentation et pièces jointes.',
    });
    if (!r.ok) echec('réception', r);
    etat.idReception = r.corps.idReception;
    console.log('  ✓ réception ' + etat.idReception + ' · passage ' + r.corps.numPassage);
  }
}

/** Les identifiants du circuit se retrouvent depuis le dossier : le script se relance par étapes. */
const reprendreCircuit = async () => {
  const id = await dossierDuPlan();
  if (etat.idReception == null || etat.idDispatch == null) {
    // ⚠️ La liste des réceptions est scopée (vide pour le Secrétaire une fois le dossier dispatché) :
    // on remonte par les DISPATCHS, dont chaque réception se relit une par une.
    const d = await appel('PRES001', 'GET', '/api/dispatchs');
    for (const x of liste(d.corps)) {
      const rec = await appel('PRES001', 'GET', '/api/receptions/' + x.idReception);
      if (rec.corps?.idDossier === id) { etat.idReception = x.idReception; etat.idDispatch = x.idDispatch; break; }
    }
  }
  if (etat.idExamen == null && etat.idDispatch != null) {
    const x = await appel('PRES001', 'GET', '/api/examens');
    etat.idExamen = liste(x.corps).find((e) => e.idDispatch === etat.idDispatch)?.idExamen ?? null;
  }
  if (etat.idPv == null && etat.idExamen != null) {
    const pv = await appel('PRES001', 'GET', '/api/pv-examens');
    etat.idPv = liste(pv.corps).find((v) => v.idExamen === etat.idExamen)?.idPv ?? null;
  }
  return etat;
};

// ── 5. Le dispatch ────────────────────────────────────────────────────────────────────────────
if (etape(5, 'Le dispatch au Membre examinateur (Président)')) {
  await reprendreCircuit();
  const r = await appel('PRES001', 'POST', '/api/dispatchs', {
    idReception: etat.idReception,
    imCtrlMembre: 'MEMANT1',
    dateDispatch: new Date().toISOString().slice(0, 10),
    instructions: "Examen du plan de passation : vérifier la ligne de matériels informatiques à commande et son allotissement en cinq lots.",
    interimDispatch: false,
  });
  if (!r.ok) echec('dispatch', r);
  etat.idDispatch = r.corps.idDispatch;
  console.log('  ✓ dispatch ' + etat.idDispatch + ' → MEMANT1 (RAFIDIMANANA Rina)');
}

// ── 6. L'examen et sa soumission ──────────────────────────────────────────────────────────────
if (etape(6, "L'examen du plan et sa soumission — avis favorable (Membre)")) {
  await reprendreCircuit();
  if (etat.idDetail == null) {
    const m = await appel('PRMP001', 'GET', '/api/marches?dossier=' + (await dossierDuPlan()));
    etat.idDetail = liste(m.corps)[0]?.idDetail;
  }
  let idExamen = etat.idExamen;
  if (idExamen == null) {
    // ⚠️ `t_examen` porte une clé primaire ASSIGNÉE PAR LE CLIENT (comme le fait l'écran d'examen) :
    // l'omettre laisse une ligne que son propre auteur ne peut plus relire (403).
    const tous = await appel('PRES001', 'GET', '/api/examens');
    const idLibre = Math.max(0, ...liste(tous.corps).map((e) => e.idExamen)) + 1;
    const r = await appel('MEMANT1', 'POST', '/api/examens', {
      idExamen: idLibre,
      idDispatch: etat.idDispatch,
      imCtrlMembre: 'MEMANT1',
      dateExamen: new Date().toISOString().slice(0, 10),
    });
    if (!r.ok) echec("ouverture de l'examen", r);
    idExamen = r.corps?.idExamen ?? idLibre;
  }
  etat.idExamen = idExamen;
  console.log('  ✓ examen ' + idExamen);

  // ⚠️ La soumission exige la GRILLE COMPLÈTE : un point de portée LIGNE par marché, les autres une fois.
  // Le plan est conforme : chaque point est évalué « conforme », sans observation — d'où l'avis favorable.
  const grille = await appel('MEMANT1', 'GET', '/api/points-ctrls?sousType=PPM-AGPM');
  const points = liste(grille.corps).filter((p) => p.portee !== 'SUPPRESSION');
  const deja = await appel('MEMANT1', 'GET', '/api/examen-details?examen=' + idExamen);
  let idDetailExamen = Math.max(0, ...liste(deja.corps).map((d) => d.idDetailExamen));
  let poses = liste(deja.corps).length;
  for (const pt of points) {
    if (liste(deja.corps).some((d) => d.idPtControle === pt.idPointCtrl)) continue;
    const r = await appel('MEMANT1', 'POST', '/api/examen-details', {
      idDetailExamen: ++idDetailExamen,
      idExamen: idExamen,
      idDetail: pt.portee === 'LIGNE' ? etat.idDetail : null,
      idPtControle: pt.idPointCtrl,
      conforme: true,
    });
    if (!r.ok) { console.log('    ⚠️ point ' + pt.idPointCtrl + ' (' + pt.libelPointCtrl + ') : ' + r.statut + ' ' + String(r.corps?.message ?? '').slice(0, 80)); continue; }
    poses++;
  }
  console.log('  ✓ grille évaluée : ' + poses + ' point(s) conformes, aucune observation');

  const s2 = await appel('MEMANT1', 'POST', '/api/examens/' + idExamen + '/soumettre', { idAvis: 'FAV' });
  if (!s2.ok) { console.error(JSON.stringify(s2.corps, null, 1).slice(0, 700)); echec("soumission de l'examen", s2); }
  etat.idPv = s2.corps?.idPv;
  console.log('  ✓ projet de PV ' + etat.idPv + ' · ' + s2.corps?.statutPv + ' · avis ' + s2.corps?.idAvis);
}

// ── 7. Visa et signatures ─────────────────────────────────────────────────────────────────────
if (etape(7, 'Le visa du Président puis les signatures — PV signé')) {
  await reprendreCircuit();
  // ⚠️ Le Membre attributaire ne peut pas RELIRE son propre examen ni son projet de PV (403, §1) —
  // il peut les écrire. L'état se lit donc côté Président, qui voit tout.
  const avant = await appel('PRES001', 'GET', '/api/pv-examens/' + etat.idPv);
  if (avant.corps?.statutPv === 'BROUILLON' || avant.corps?.statutPv === 'EN_RECTIFICATION') {
    const so = await appel('MEMANT1', 'POST', '/api/pv-examens/' + etat.idPv + '/soumettre', { imActeur: 'MEMANT1' });
    if (!so.ok) echec('soumission du projet de PV', so);
    console.log('  ✓ projet soumis · ' + so.corps?.statutPv);
  }
  const etatPv = (await appel('PRES001', 'GET', '/api/pv-examens/' + etat.idPv)).corps?.statutPv;
  const v = etatPv === 'PROJET_SOUMIS' ? await appel('PRES001', 'POST', '/api/pv-examens/' + etat.idPv + '/viser', {
    imActeur: 'PRES001',
    coSignataires: ['MEMANT2'], // second Membre de la centrale : le PV est co-signé par deux personnes distinctes
    commentaire: 'Plan de passation conforme : avis favorable.',
  }) : { ok: true, corps: { statutPv: etatPv } };
  if (!v.ok) echec('visa', v);
  console.log('  ✓ visé · ' + v.corps?.statutPv + ' · co-signataire ' + (v.corps?.imMembreCoSignataire ?? '—'));
  // ⚠️ La part « Membre » est réservée au MEMBRE DÉSIGNÉ au visa (403 pour tout autre, examinateur compris) :
  // le PV est signé par le dispatcheur — sa part est posée par le visa — et par ce co-signataire.
  const vise = await appel('PRES001', 'GET', '/api/pv-examens/' + etat.idPv);
  const designe = vise.corps?.imMembreCoSignataire;
  const sg = await appel(designe, 'POST', '/api/pv-examens/' + etat.idPv + '/signer', { imActeur: designe, role: 'MEMBRE' });
  if (!sg.ok) echec('signature du Membre désigné (' + designe + ')', sg);
  etat.statutPv = sg.corps?.statutPv;
  console.log('  ✓ signé par ' + designe + ' · ' + etat.statutPv);
}

// ── 8. La ligne devient préparable en DAO ─────────────────────────────────────────────────────
if (etape(8, 'La ligne du plan est-elle préparable en DAO ?')) {
  if (etat.idDetail == null) {
    const m = await appel('PRMP001', 'GET', '/api/marches?dossier=' + (await dossierDuPlan()));
    etat.idDetail = liste(m.corps)[0]?.idDetail;
  }
  const el = await appel('PRMP001', 'GET', '/api/dmcs/eligibles');
  const ligne = liste(el.corps).find((x) => x.idDetail === etat.idDetail);
  if (ligne) {
    console.log('  ✓ ligne ' + ligne.idDetail + ' éligible · ' + ligne.categorie + '/' + ligne.formeMarche + ' · ' + ligne.libelleMode);
    console.log('\n  Pour garnir la fiche DAO : node scripts/demo-dao.mjs ' + ligne.idDetail);
  } else {
    console.log('  ✗ la ligne ' + etat.idDetail + " n'est pas servie par /api/dmcs/eligibles (" + liste(el.corps).length + ' ligne(s) au total)');
  }
}

console.log('\n' + JSON.stringify(etat));
