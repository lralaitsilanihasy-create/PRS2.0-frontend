// Grille de contrôle du sous-type DAO — l'EXEMPLE de docs/grille-controle-dao-exemple-2026-09-26.md, posé ou retiré
// au référentiel par l'API (Administrateur). Idempotent par libellé. Usage :
//   node scripts/grille-dao.mjs            pose les points absents, affiche la grille servie
//   node scripts/grille-dao.mjs --retirer  retire les points de l'exemple (409 si un examen les référence)
// ⚠️ Écrit dans le référentiel de la base de développement. La grille se corrige ensuite dans Administrateur →
// Points de contrôle : ce script n'est qu'un semoir, pas la source de vérité.
// ⚠️ Une description de plus de 255 caractères est refusée (409 « Violation d'une contrainte de données ») :
// les libellés des informations sont abrégés (B08-AV, B08-GB) quand la ligne le demande.
const API = 'http://localhost:8080';
const MDP = 'Test@1234';
const RETIRER = process.argv.includes('--retirer');

const POINTS = [
  ['Conformité au plan de passation', "Objet, mode (AOO), forme (à commande / quantité fixe / contrat-cadre), catégorie et financement du DAO sont-ils ceux de la ligne du plan examinée et de l'AGPM (B01, B02-OB-01, B02-OB-03) ?", true],
  ['Allotissement', "Nombre et intitulés des lots, attribution lot par lot ou en totalité, offres partielles, nombre maximal de lots par candidat : identiques entre le DPAO, l'acte d'engagement et le besoin (B02-LV, B02-AU-02, B02-AU-07, B12) ?", true],
  ['Montants et estimation', "Minimum et maximum de chaque lot (B05-TP-02, B05-TP-03) dans l'enveloppe du plan ; somme des maxima ≤ estimation de la ligne ; cohérence avec les quantités min/max des articles (B12) ?", true],
  ['Garantie de soumission', 'Formes admises (B05-GS-02) conformes au CMP ; montant par lot (B05-GS-03) entre 1 et 2 % du maximum du lot ; validité (B05-GS-04) couvrant la validité des offres plus trente jours (B04-VO-01) ?', true],
  ['Délais de la consultation', "Validité des offres (B04-VO-01), délais d'éclaircissement (B04-DE-02, B04-DE-03), date et heure de remise et d'ouverture (B04-LR-03, B04-LR-04, B04-OP-02, B04-OP-03) : cohérents entre eux, avec le calendrier du plan et le délai légal de publicité ?", true],
  ['Candidats : pièces et capacités', "Pièces exigées (B03-CQ-01, B04-CO-01), fiches de renseignements jointes (B04-CD-01), capacités technique et financière demandées (B03-CQ-02, B03-CQ-03, B03-CQ-09, B03-CQ-10) : proportionnées à l'objet et non discriminantes ?", true],
  ['Évaluation et attribution', "Évaluation par lot ou sur l'ensemble (B06-EO-01), critères additionnels (B06-EO-02), détermination de l'offre évaluée (B06-EO-05), offres anormalement hautes ou basses (B06-EO-07), préférence nationale (B03-CQ-08, B06-EO-09) : conformes au CMP ?", true],
  ['Paiements, avance et garanties financières', 'Avance (taux ≤ 20 %, garantie de restitution, remboursement : B08-AV), acomptes (B08-AC-01), garantie de bonne exécution et retenue (B08-GB, B08-RG), intérêts moratoires (B08-IM-01), délai de paiement (B08-PA-08) : conformes au CCAG ?', true],
  ['Pénalités, garantie et dérogations', "Régime et plafond des pénalités (B09-PR-02, B09-PR-03), délai de garantie (B09-DG-01, B09-DG-02) ; toute dérogation au CCAG est-elle justifiée ET récapitulée à l'article « dérogations » du CCAP (B10-DD-01) ?", true],
  ['Exécution et livraison', 'Délai de livraison par lot (B06-EO-12), lieux de livraison (B09-LL-01), passation des commandes (B09-DX-03), transport, inspection et réception (B09-RT-01, B09-IV-01, B09-DI-01) : réalistes et cohérents avec le besoin ?', false],
  ['Spécifications techniques', 'Articles, quantités minimum et maximum, caractéristiques exigées (B12) : précises, mesurables, sans référence à une marque ou à un fournisseur, cohérentes avec les lots et les montants ?', true],
  ['Cohérence des mentions du dossier', "Références, intitulés, dates et mentions reprises d'un document à l'autre — numéro de l'appel d'offres sur les plis (B04-RO-02), description de l'objet (B02-OB-02), dates laissées en blanc, restes d'un autre dossier — sans contradiction ?", true],
];

// ── Session (cookie + XSRF, comme le navigateur) ──────────────────────────────────────────────
const s = { cookie: '', xsrf: '' };
const maj = (r) => {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const kv = c.split(';')[0];
    const k = kv.slice(0, kv.indexOf('='));
    const v = kv.slice(kv.indexOf('=') + 1);
    s.cookie = [...s.cookie.split('; ').filter((x) => x && !x.startsWith(k + '=')), k + '=' + v].join('; ');
    if (k === 'XSRF-TOKEN') s.xsrf = decodeURIComponent(v);
  }
};
const appel = async (methode, url, corps) => {
  const entetes = { Cookie: s.cookie };
  if (methode !== 'GET') { entetes['X-XSRF-TOKEN'] = s.xsrf; if (corps !== undefined) entetes['Content-Type'] = 'application/json'; }
  const r = await fetch(API + url, { method: methode, headers: entetes, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  maj(r);
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { ok: r.ok, statut: r.status, corps: j, texte: t.slice(0, 200) };
};
const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'ADMIN01', motDePasse: MDP }) });
maj(login);
if (!login.ok) { console.error('connexion ADMIN01 refusée : ' + login.status); process.exit(1); }
maj(await fetch(API + '/api/auth/moi', { headers: { Cookie: s.cookie } })); // amorce du jeton CSRF

const grille = async () => (await appel('GET', '/api/points-ctrls?sousType=DAO')).corps ?? [];
const avant = await grille();
console.log('grille DAO servie : ' + avant.length + ' point(s)');

if (RETIRER) {
  let n = 0;
  for (const [libelle] of POINTS) {
    const p = avant.find((x) => x.libelPointCtrl === libelle);
    if (!p) continue;
    const r = await appel('DELETE', '/api/points-ctrls/' + p.idPointCtrl);
    console.log((r.ok ? '  ✓ retiré ' : '  ✗ ' + r.statut + ' ') + p.idPointCtrl + ' · ' + libelle + (r.ok ? '' : ' — ' + (r.corps?.message ?? r.texte).slice(0, 120)));
    if (r.ok) n++;
  }
  console.log(n + ' point(s) retiré(s) · grille DAO : ' + (await grille()).length);
  process.exit(0);
}

let poses = 0;
for (let i = 0; i < POINTS.length; i++) {
  const [libelle, description, obligatoire] = POINTS[i];
  if (avant.some((x) => x.libelPointCtrl === libelle)) { console.log('  = déjà : ' + libelle); continue; }
  const r = await appel('POST', '/api/points-ctrls', {
    libelPointCtrl: libelle, decriptPointCtrl: description, ordrePointCtrl: i + 1, obligatoire,
    idTypeDossier: 'DMC', idSousType: 'DAO', portee: 'DOSSIER',
  });
  if (!r.ok) { console.error('  ✗ ' + libelle + ' — ' + r.statut + ' ' + (r.corps?.message ?? r.texte).slice(0, 160)); process.exit(1); }
  console.log('  ✓ ' + r.corps.idPointCtrl + ' · ' + libelle);
  poses++;
}
const apres = await grille();
console.log(poses + ' point(s) posé(s) · grille DAO servie : ' + apres.length);
for (const p of [...apres].sort((a, b) => (a.ordrePointCtrl ?? 0) - (b.ordrePointCtrl ?? 0))) console.log('  ' + p.ordrePointCtrl + '. [' + p.idPointCtrl + '] ' + p.libelPointCtrl + (p.obligatoire ? '' : ' (facultatif)'));
