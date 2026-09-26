// Garnit les quatre dossiers de démonstration PAR L'API, comme le ferait une PRMP : aucun code touché, aucune
// écriture directe en base.
//
// ⚠️ Le script est piloté par la LIGNE DU PLAN, pas par un numéro de fiche : une remise à zéro de la base
// supprime les fiches et les renumérote, les lignes, elles, sont semées avec le plan. Si la ligne n'a pas encore
// de fiche, le script la crée — c'est le premier geste de la PRMP (« Préparer le dossier »).
//
//   node demo-dao.mjs              garnit, contrôle, valide et crée le dossier des quatre démonstrations
//   node demo-dao.mjs --vider      rouvre une version brouillon et efface les valeurs (pour rejouer)
//   node demo-dao.mjs 303083       une seule ligne du plan
//
// ⚠️ Écrit en base de développement.
import { CADRAGE_TRAVAUX, CADRAGE_PI, CADRAGE_AC, CADRAGE_QF, VALEURS_TRAVAUX, VALEURS_PI, VALEURS_AC, VALEURS_AC_PAR_LOT, VALEURS_QF, CADRAGE_2463, VALEURS_2463, VALEURS_2463_PAR_LOT, ARTICLES_2463 } from './demo-dao-valeurs.mjs';

const API = 'http://localhost:8080';
const args = process.argv.slice(2);
const VIDER = args.includes('--vider');
const SEULE = args.find((a) => /^\d+$/.test(a));
/**
 * ⚠️ 26/09 — `--jeu=<clé>` : applique un jeu NOMMÉ à la ligne passée en argument. Une base vidée puis rejouée
 * renumérote les lignes (303089 → 303090 pour le dossier réel) : la clé, elle, ne bouge pas.
 *   node scripts/demo-dao.mjs 303090 --jeu=2463
 */
const CLE_JEU = (args.find((a) => a.startsWith('--jeu=')) ?? '').slice('--jeu='.length) || null;

let cookie = '';
let xsrf = '';
const majCookies = (r) => {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';');
    const [k, v] = [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)];
    const autres = cookie.split('; ').filter((x) => x && !x.startsWith(k + '='));
    cookie = [...autres, `${k}=${v}`].join('; ');
    if (k === 'XSRF-TOKEN') xsrf = decodeURIComponent(v);
  }
};
const appel = async (methode, url, corps) => {
  const r = await fetch(API + url, {
    method: methode,
    headers: {
      Cookie: cookie,
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
      ...(methode === 'GET' ? {} : { 'X-XSRF-TOKEN': xsrf }),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  majCookies(r);
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch { json = { brut: texte.slice(0, 300) }; }
  return { ok: r.ok, statut: r.status, corps: json };
};

/**
 * Ouvre la session de la PRMP du jeu. ⚠️ Chaque jeu a SA PRMP : le dossier réel 2463 est rattaché au compte LERAVO
 * (rejeu backend du 26/09, une seule PRMP active par entité — IMP001 en est détaché) ; les démonstrations JIRAMA
 * restent à PRMP001. La liste des lignes éligibles (/api/dmcs/eligibles) est scopée sur les entités de la PRMP connectée.
 */
const connexion = async (login = 'PRMP001') => {
  cookie = '';
  xsrf = '';
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, motDePasse: 'Test@1234' }),
  });
  majCookies(r);
  if (!r.ok) { console.error(`connexion refusée (${login})`); process.exit(1); }
};

/** La grammaire des conditions du référentiel : « cle = VAL », « a = X et b = Y », « a = X ou b = Y ». */
const conditionTenue = (condition, cadrage) => {
  if (!condition) return true;
  const un = (t) => {
    const [cle, val] = t.split('=').map((x) => x.trim());
    return String(cadrage[cle] ?? '') === val;
  };
  if (condition.includes(' ou ')) return condition.split(' ou ').some(un);
  if (condition.includes(' et ')) return condition.split(' et ').every(un);
  return un(condition);
};

/** La fiche de cette ligne du plan : celle qui existe, ou celle que le geste « Préparer le dossier » crée. */
const ficheDeLaLigne = async (idDetail) => {
  const existante = await appel('GET', `/api/dmcs/par-marche/${idDetail}`);
  if (existante.ok && (existante.corps?.idDmc ?? existante.corps?.id) != null) return existante.corps.idDmc ?? existante.corps.id;
  const cree = await appel('POST', `/api/dmcs/par-marche/${idDetail}`);
  if (!cree.ok) { console.error(`  ✗ ligne ${idDetail} : ${cree.statut} ` + JSON.stringify(cree.corps).slice(0, 200)); return null; }
  return cree.corps?.idDmc ?? cree.corps?.id ?? null;
};

const garnir = async (idDetail, cadrage, valeurs, titre, parLot = {}, articles = []) => {
  console.log(`\n══ ${titre} — ligne ${idDetail} ══`);
  const idDmc = await ficheDeLaLigne(idDetail);
  if (idDmc == null) return false;
  console.log(`  fiche ${idDmc}`);
  const fiche0 = (await appel('GET', `/api/fiches-marche/${idDmc}`)).corps;
  const cat = fiche0?.categorie;
  const type = fiche0?.typeMarche ?? 'QUANTITE_FIXE';
  const ref = (await appel('GET', `/api/champs-fiche-marche?typeMarche=${type}&categorie=${cat}`)).corps;

  // Une fiche déjà validée se rouvre en brouillon avant toute écriture.
  if (fiche0?.statut === 'VALIDEE' || fiche0?.etat === 'VALIDEE') {
    const rev = await appel('POST', `/api/fiches-marche/${idDmc}/reviser`);
    console.log(`  version rouverte : ${rev.ok ? 'brouillon' : rev.statut}`);
  }

  console.log('— Cadrage —');
  const rc = await appel('PUT', `/api/fiches-marche/${idDmc}/cadrage`, { cadrage });
  if (!rc.ok) { console.error('  ✗ cadrage refusé : ' + JSON.stringify(rc.corps).slice(0, 400)); return false; }
  console.log('  ✓ ' + Object.entries(cadrage).map(([k, v]) => `${k}=${v}`).join(' · '));

  // ⚠️ V43 (25/09) — une information « par lot » se saisit une fois par lot, sous la clé CODE#rang. C'est le serveur
  // qui dit si la ligne est allotie (`saisieParLot`), et combien elle porte de lots (`nbLots`).
  const fiche = (await appel('GET', `/api/fiches-marche/${idDmc}`)).corps;
  const lots = fiche?.saisieParLot === true ? Array.from({ length: fiche.nbLots }, (_, i) => i + 1) : [null];
  const cles = (c) => (c.parLot ? lots : [null]).map((lot) => ({ lot, cle: lot == null ? c.code : `${c.code}#${lot}` }));
  // ⚠️ V47 (26/09) — un champ à `valeurDefaut` (B03-CQ-09, B03-CQ-10) naît DÉJÀ posé dans la fiche : le jeu n'a
  // pas à le fournir, et le payload d'un bloc doit le renvoyer tel quel pour ne pas l'effacer.
  const valeurDe = (c, lot) => {
    const duJeu = c.parLot && lot != null ? parLot[c.code]?.[lot] : valeurs[c.code];
    if (duJeu !== undefined) return duJeu;
    const deLaFiche = fiche?.valeurs?.[lot == null ? c.code : `${c.code}#${lot}`];
    return deLaFiche == null || deLaFiche === '' ? undefined : deLaFiche;
  };
  if (lots[0] != null) console.log(`  ${lots.length} lots au plan : les champs « par lot » se saisissent ${lots.length} fois`);

  const aSaisir = ref.champs.filter((c) => c.source === 'SAISIE' && c.type !== 'PIECE' && conditionTenue(c.condition, cadrage));
  const manquants = aSaisir.filter((c) => c.obligatoire && cles(c).some(({ lot }) => valeurDe(c, lot) === undefined));
  if (manquants.length) {
    console.error(`  ✗ ${manquants.length} information(s) obligatoire(s) sans valeur de démonstration :`);
    manquants.forEach((c) => console.error(`      ${c.code} [${c.type}] ${c.libelle.slice(0, 70)}`));
    return false;
  }
  const inutiles = Object.keys(valeurs).filter((code) => !aSaisir.some((c) => c.code === code));
  if (inutiles.length) console.log(`  ⚠️ ${inutiles.length} valeur(s) sans champ correspondant : ${inutiles.join(' ')}`);

  console.log('— Saisie bloc par bloc —');
  let posees = 0;
  for (const bloc of ref.blocs) {
    const champs = aSaisir.filter((c) => c.bloc === bloc.code && cles(c).some(({ lot }) => valeurDe(c, lot) !== undefined));
    if (!champs.length) continue;
    const corps = {};
    for (const c of champs) for (const { lot, cle } of cles(c)) {
      const v = valeurDe(c, lot);
      if (v === undefined) continue;
      corps[cle] = VIDER ? '' : String(v);
    }
    const r = await appel('PUT', `/api/fiches-marche/${idDmc}/blocs/${bloc.code}`, { valeurs: corps });
    if (!r.ok) {
      console.error(`  ✗ ${bloc.code} refusé (${r.statut}) : ` + JSON.stringify(r.corps).slice(0, 500));
      return false;
    }
    posees += Object.keys(corps).length;
    console.log(`  ✓ ${bloc.code} — ${Object.keys(corps).length} information(s)`);
  }
  console.log(`  ${posees} informations ${VIDER ? 'effacées' : 'posées'}`);
  if (VIDER) return true;

  // ⚠️ Le BESOIN (bloc B12, livré le 25/09) n'est pas fait de champs : c'est une ressource à part,
  // enregistrée lot par lot par remplacement en bloc. Les lots 4 et 5 du 2463 reprennent les lots 2 et 3 —
  // c'est le cas réel du geste « Dupliquer depuis le lot n ».
  if (articles.length) {
    const lots = [...new Set(articles.map((a) => a.lot))].sort((x, y) => x - y);
    let poses = 0;
    for (const lot of lots) {
      const duLot = articles.filter((a) => a.lot === lot);
      const r = await appel('PUT', `/api/fiches-marche/${idDmc}/articles?lot=${lot}`, { articles: VIDER ? [] : duLot });
      if (!r.ok) { console.error(`  ✗ besoin du lot ${lot} : ${r.statut} ` + JSON.stringify(r.corps).slice(0, 220)); return false; }
      poses += VIDER ? 0 : duLot.length;
    }
    const carac = VIDER ? 0 : articles.reduce((n, a) => n + (a.caracteristiques?.length ?? 0), 0);
    console.log(`— Besoin —\n  ✓ ${poses} article(s) sur ${lots.length} lot(s), ${carac} caractéristique(s) exigée(s)`);
  }

  console.log('— Contrôles —');
  const bilan = (await appel('POST', `/api/fiches-marche/${idDmc}/controler`)).corps;
  const lignes = bilan?.controles ?? bilan?.anomalies ?? [];
  const bloquants = lignes.filter((x) => x.bloquant !== false);
  console.log(`  ${lignes.length} ligne(s) au bilan · ${bloquants.length} bloquante(s)`);
  bloquants.slice(0, 8).forEach((x) => console.log(`    ! ${x.champ ?? x.code ?? ''} ${x.message ?? JSON.stringify(x).slice(0, 120)}`));
  if (bloquants.length) return false;

  console.log('— Validation —');
  const v = await appel('POST', `/api/fiches-marche/${idDmc}/valider`);
  if (!v.ok) { console.error('  ✗ validation refusée : ' + JSON.stringify(v.corps).slice(0, 400)); return false; }
  console.log(`  ✓ version ${v.corps?.version ?? '?'} figée`);

  console.log('— Dossier à soumettre —');
  const d = await appel('POST', `/api/fiches-marche/${idDmc}/dossier`);
  if (d.ok) console.log(`  ✓ dossier ${d.corps?.idDossier ?? d.corps?.id ?? ''} créé — ${d.corps?.refeDossier ?? ''}`);
  else if (d.statut === 409) console.log(`  = dossier déjà créé : ${JSON.stringify(d.corps).slice(0, 200)}`);
  else { console.error('  ✗ création du dossier refusée : ' + JSON.stringify(d.corps).slice(0, 300)); return false; }
  return true;
};

const jeux = [
  { id: 303083, cadrage: CADRAGE_TRAVAUX, valeurs: VALEURS_TRAVAUX, titre: 'TRAVAUX — réhabilitation du réseau d’adduction d’eau potable, 2 lots' },
  { id: 303084, cadrage: CADRAGE_PI, valeurs: VALEURS_PI, titre: 'PRESTATIONS INTELLECTUELLES — schéma directeur d’assainissement' },
  { id: 303081, cadrage: CADRAGE_AC, valeurs: VALEURS_AC, parLot: VALEURS_AC_PAR_LOT, titre: 'FOURNITURES À COMMANDE — consommables informatiques, 2 lots' },
  { id: 303080, cadrage: CADRAGE_QF, valeurs: VALEURS_QF, titre: 'FOURNITURES À QUANTITÉ FIXE — mobilier de bureau' },
  // ⚠️ Le DOSSIER RÉEL, semé par `scripts/jeu-donnees-dao-2463.mjs` : MESupReS, cinq lots, à commande.
  { id: 303089, cle: '2463', prmp: 'LERAVO', cadrage: CADRAGE_2463, valeurs: VALEURS_2463, parLot: VALEURS_2463_PAR_LOT, titre: 'DOSSIER RÉEL — matériels informatiques MESupReS, 5 lots à commande', articles: ARTICLES_2463 },
]
  .filter((j) => (CLE_JEU ? j.cle === CLE_JEU : !SEULE || String(j.id) === SEULE))
  .map((j) => (CLE_JEU && SEULE ? { ...j, id: Number(SEULE) } : j));
if (CLE_JEU && !jeux.length) {
  console.error(`aucun jeu ne porte la clé « ${CLE_JEU} »`);
  process.exit(2);
}
let ko = 0;
for (const j of jeux) {
  await connexion(j.prmp);
  if (!(await garnir(j.id, j.cadrage, j.valeurs, j.titre, j.parLot ?? {}, j.articles ?? []))) ko++;
}
console.log(ko === 0 ? `\n${VIDER ? 'REMISE À ZÉRO' : 'DÉMONSTRATION'} PRÊTE` : `\n${ko} fiche(s) en échec`);
process.exit(ko ? 1 : 0);
