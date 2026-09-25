// Garnit les quatre dossiers de démonstration — travaux (6), prestations intellectuelles (7), fournitures à
// commande (5) et fournitures à quantité fixe (1) — PAR L'API, comme le ferait une PRMP. Aucun code touché.
//
//   node demo-dao.mjs            garnit, contrôle, valide et crée le dossier des quatre fiches
//   node demo-dao.mjs --vider    rouvre une version brouillon et efface les valeurs (pour rejouer)
//   node demo-dao.mjs 6            une seule fiche (6 travaux · 7 études · 5 à commande · 1 quantité fixe)
//
// ⚠️ Écrit en base de développement.
import { CADRAGE_TRAVAUX, CADRAGE_PI, CADRAGE_AC, CADRAGE_QF, VALEURS_TRAVAUX, VALEURS_PI, VALEURS_AC, VALEURS_AC_PAR_LOT, VALEURS_QF } from './demo-dao-valeurs.mjs';

const API = 'http://localhost:8080';
const args = process.argv.slice(2);
const VIDER = args.includes('--vider');
const SEULE = args.find((a) => /^\d+$/.test(a));

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

const connexion = async () => {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'PRMP001', motDePasse: 'Test@1234' }),
  });
  majCookies(r);
  if (!r.ok) { console.error('connexion refusée'); process.exit(1); }
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

const garnir = async (idDmc, cadrage, valeurs, titre, parLot = {}) => {
  console.log(`\n══ ${titre} — fiche ${idDmc} ══`);
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
  const valeurDe = (c, lot) => (c.parLot && lot != null ? parLot[c.code]?.[lot] : valeurs[c.code]);
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

await connexion();
const jeux = [
  { id: 6, cadrage: CADRAGE_TRAVAUX, valeurs: VALEURS_TRAVAUX, titre: 'TRAVAUX — réhabilitation du bâtiment administratif' },
  { id: 7, cadrage: CADRAGE_PI, valeurs: VALEURS_PI, titre: 'PRESTATIONS INTELLECTUELLES — étude de faisabilité et AMO' },
  { id: 5, cadrage: CADRAGE_AC, valeurs: VALEURS_AC, parLot: VALEURS_AC_PAR_LOT, titre: 'FOURNITURES À COMMANDE — matériels informatiques, 2 lots' },
  { id: 1, cadrage: CADRAGE_QF, valeurs: VALEURS_QF, titre: 'FOURNITURES À QUANTITÉ FIXE — équipements de protection individuelle' },
].filter((j) => !SEULE || String(j.id) === SEULE);
let ko = 0;
for (const j of jeux) if (!(await garnir(j.id, j.cadrage, j.valeurs, j.titre, j.parLot ?? {}))) ko++;
console.log(ko === 0 ? `\n${VIDER ? 'REMISE À ZÉRO' : 'DÉMONSTRATION'} PRÊTE` : `\n${ko} fiche(s) en échec`);
process.exit(ko ? 1 : 0);
