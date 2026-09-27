// Maquette des FORMULAIRES EN LIGNE du candidat (décision du pilote du 27/09 : les classeurs Excel — bordereau des
// prix, liste des fournitures, tableau de conformité — deviennent des formulaires de la future plateforme de dépôt).
// La page est GÉNÉRÉE depuis une fiche DAO réelle servie par l'API : le besoin par lot (articles, quantités,
// caractéristiques exigées), les lieux et délais de livraison, les montants, la monnaie, les réglages de la remise
// électronique. Le candidat n'y saisit que ce que les documents types officiels lui réservent :
//   - document 4 (cadre d'acte d'engagement), annexe « Bordereau des prix pour les fournitures locales » — marché à
//     commande, huit colonnes : le candidat donne la date de livraison et le prix unitaire EXW ; le reste est calculé ;
//   - document 5 (CPS), annexe « Liste des Fournitures et Calendrier de livraison » : « la PRMP remplit ce tableau, à
//     l'exception de la colonne “Date de livraison offerte par le Candidat” » ;
//   - document 5, « Résumé des spécifications techniques requises » : le tableau de conformité en est le pendant, le
//     candidat renseigne la caractéristique proposée, la marque et le modèle, et se prononce sur la conformité.
// Les intitulés de colonnes sont ceux des documents types, tels quels. Rien n'est enregistré : c'est une maquette.
//
//   node scripts/maquette-formulaires-en-ligne.mjs --fiche=19 --version=2 [--prmp=LERAVO] [--sortie=docs/….html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').slice(n.length + 3) || d;
const API = 'http://localhost:8080';
const ID = Number(arg('fiche', '19'));
const VERSION = arg('version', '');
const PRMP = arg('prmp', 'LERAVO');
const jour = new Date().toISOString().slice(0, 10);
const SORTIE = path.resolve(RACINE, arg('sortie', `docs/maquette-${jour}-formulaires-en-ligne.html`));

const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: PRMP, motDePasse: 'Test@1234' }) });
if (!login.ok) { console.error('connexion refusée : ' + login.status); process.exit(1); }
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const lire = async (u) => { const r = await fetch(`${API}${u}`, { headers: { Cookie: cookie } }); return r.ok ? r.json() : null; };

const fiche = await lire(`/api/fiches-marche/${ID}${VERSION ? `/versions/${VERSION}` : ''}`);
if (!fiche) { console.error(`fiche ${ID} introuvable`); process.exit(1); }
const articles = (await lire(`/api/fiches-marche/${ID}/articles`)) ?? [];
const tva = (await lire('/api/parametres/fiche-taux-tva'))?.taux ?? 20;
const v = (code, lot) => fiche.valeurs?.[lot ? `${code}#${lot}` : code] ?? fiche.valeursPpm?.[code] ?? null;
const nbLots = fiche.nbLots ?? 1;

// ⚠️ Les désignations des lots ne sont pas des valeurs de la fiche : elles vivent sur la ligne du plan (t_lot). On les
// lit si l'API les sert ; sinon « Lot n ».
let lots = [];
for (const u of [`/api/lots?detail=${fiche.idDetail}`, `/api/marches/${fiche.idDetail}/lots`]) {
  const l = await lire(u);
  if (Array.isArray(l) && l.length) { lots = l; break; }
  if (l?.content?.length) { lots = l.content; break; }
}
const designationLot = (n) => lots.find((l) => (l.numLot ?? l.rang ?? l.numero) === n)?.designationLot ?? lots[n - 1]?.designationLot ?? `Lot ${n}`;

const procedure = {
  reference: v('B02-OB-03') ?? '', objet: v('B02-OB-01') ?? fiche.designationMarche ?? '', acheteur: v('B01-AC-01') ?? '', adresse: v('B01-AC-02') ?? '',
  planRef: fiche.refeDossier ?? '', forme: v('B01-AC-19') ?? '', monnaie: v('B05-MO-01') ?? 'Ariary', typePrix: fiche.cadrage?.typePrix ?? '',
  dateLimite: v('B04-LR-03') ?? '', heureLimite: v('B04-LR-04') ?? '', fuseau: v('B04-SE-04') ?? '', ouvertureDepots: v('B04-SE-03') ?? '',
  plateforme: v('B04-SE-02') ?? '', formats: String(v('B04-SE-07') ?? '').split(',').filter(Boolean), tailleFichier: v('B04-SE-08'), tailleOffre: v('B04-SE-09'),
  signature: v('B04-SE-05') ?? '', remplacement: v('B04-SE-10') ?? '', assistance: v('B04-SE-14') ?? '', limiteAssistance: v('B04-SE-15') ?? '',
  garantieForme: v('B05-GS-10') ?? '', garantieOriginal: v('B05-GS-11') ?? '', validiteGarantie: v('B05-GS-04'), validiteOffres: v('B04-VO-01'),
  delaiLivraison: v('B09-DX-01'), tva,
  lots: Array.from({ length: nbLots }, (_, i) => i + 1).map((n) => ({
    n, designation: designationLot(n), lieu: v('B09-LL-01', n) ?? v('B09-LL-01') ?? '', delai: v('B06-EO-12', n) ?? v('B06-EO-11') ?? null,
    montantMin: v('B05-TP-02', n), montantMax: v('B05-TP-03', n), garantie: v('B05-GS-03', n) ?? v('B05-GS-03'),
    articles: articles.filter((a) => (a.lot ?? 1) === n).sort((a, b) => a.ordre - b.ordre).map((a, i) => ({
      no: i + 1, designation: a.designation, unite: a.unite, qmin: a.quantiteMin, qmax: a.quantiteMax, q: a.quantite,
      caracteristiques: (a.caracteristiques ?? []).map((c) => ({ libelle: c.libelle, exigence: c.exigence })),
    })),
  })),
};
const aCommande = procedure.lots.some((l) => l.articles.some((a) => a.qmin != null || a.qmax != null));

const h = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fr = (n) => (n == null || n === '' ? '' : new Intl.NumberFormat('fr-FR').format(Number(n)).replace(/ | /g, ' '));
const dateFr = (s) => { if (!s) return ''; const [d, t] = String(s).split('T'); const [a, m, j] = d.split('-'); return `${j}/${m}/${a}${t ? ' ' + t.slice(0, 5) : ''}`; };

const H = [];
H.push(`<title>Offre en ligne ${h(v('B01-AC-17') ?? ID)}</title>`);
H.push('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap">');
H.push(`<style>
:root{--fond:#eef2f8;--papier:#ffffff;--encre:#1f2937;--sourd:#5b6675;--regle:#dde3ec;--ligne:#eef1f6;--accent:#1d4ed8;--accent-doux:#dbeafe;--fiche:#0f766e;--fiche-doux:#ccfbf1;--candidat:#b45309;--candidat-doux:#fef3c7;--calc:#6d28d9;--calc-doux:#ede9fe;--ok:#047857;--ok-doux:#d1fae5;--or:#f5c542;--mono:'DM Mono',ui-monospace,monospace;--font:'Plus Jakarta Sans',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fond:#0f141b;--papier:#171d26;--encre:#e6e9ef;--sourd:#9aa5b4;--regle:#2a3442;--ligne:#1f2733;--accent:#7aa2ff;--accent-doux:#1b2a4a;--fiche:#5eead4;--fiche-doux:#0f3a37;--candidat:#fbbf24;--candidat-doux:#3b2a0a;--calc:#c4b5fd;--calc-doux:#2a1f4d;--ok:#6ee7b7;--ok-doux:#0d3b2c}}
:root[data-theme="dark"]{--fond:#0f141b;--papier:#171d26;--encre:#e6e9ef;--sourd:#9aa5b4;--regle:#2a3442;--ligne:#1f2733;--accent:#7aa2ff;--accent-doux:#1b2a4a;--fiche:#5eead4;--fiche-doux:#0f3a37;--candidat:#fbbf24;--candidat-doux:#3b2a0a;--calc:#c4b5fd;--calc-doux:#2a1f4d;--ok:#6ee7b7;--ok-doux:#0d3b2c}
body{background:var(--fond);color:var(--encre);font-family:var(--font);font-size:14px;line-height:1.45;padding-inline:16px;padding-block:0 56px}
.page{max-width:1180px;margin-inline:auto}
h1,h2,h3{font-weight:700;text-wrap:balance;margin:0}
h1{font-size:clamp(1.3rem,2.6vw,1.75rem)}h2{font-size:1.15rem}h3{font-size:.98rem}
.mono{font-family:var(--mono)}
.bandeau{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 16px;padding:10px 0;border-bottom:3px solid var(--or);margin-bottom:16px}
.bandeau .marque{font-weight:800;letter-spacing:.02em}.bandeau .marque small{font-weight:500;color:var(--sourd)}
.exemple{display:inline-block;border:1px dashed var(--candidat);color:var(--candidat);border-radius:999px;padding:1px 10px;font-size:.78rem}
.sur{font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sourd)}
.carte{background:var(--papier);border:1px solid var(--regle);border-radius:12px;padding:14px 16px}
.proc{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px}
.proc dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0;font-size:.9rem}.proc dt{color:var(--sourd)}.proc dd{margin:0}
.puce{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.74rem;font-family:var(--mono);border:1px solid var(--regle);background:var(--fond)}
.legende{display:flex;flex-wrap:wrap;gap:8px 14px;margin:12px 0;font-size:.84rem}
.legende span::before{content:'';display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.l-fiche::before{background:var(--fiche)}.l-cand::before{background:var(--candidat)}.l-calc::before{background:var(--calc)}
.lots{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}
.lots button{border:1px solid var(--regle);background:var(--papier);color:var(--encre);border-radius:999px;padding:5px 12px;font:inherit;font-size:.86rem;cursor:pointer}
.lots button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.onglets{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--regle);margin-bottom:12px}
.onglets button{border:0;background:transparent;color:var(--sourd);padding:8px 12px;font:inherit;font-weight:600;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
.onglets button[aria-selected="true"]{color:var(--accent);border-color:var(--accent)}
.onglets button:focus-visible,.lots button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.defilant{overflow-x:auto;border:1px solid var(--regle);border-radius:8px;background:var(--papier)}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{padding:7px 8px;border-bottom:1px solid var(--ligne);vertical-align:top;text-align:left}
th{background:var(--fond);font-weight:600;font-size:.76rem;line-height:1.3}
th.num,td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
th .col{display:block;font-family:var(--mono);font-weight:400;color:var(--sourd);font-size:.7rem}
td.fiche{background:var(--fiche-doux)}td.cand{background:var(--candidat-doux)}td.calc{background:var(--calc-doux);font-variant-numeric:tabular-nums}
input,select{font:inherit;font-size:.86rem;color:var(--encre);background:var(--papier);border:1px solid var(--regle);border-radius:6px;padding:4px 6px;min-width:0}
input[type=number]{width:9.5rem;text-align:right}input[type=date]{width:9.5rem}input.txt{width:100%;box-sizing:border-box}
tfoot td{font-weight:600;background:var(--fond)}
.arrete{margin:12px 0 0;font-size:.9rem}.arrete b{font-variant-numeric:tabular-nums}
.note{color:var(--sourd);font-size:.84rem;margin:8px 0 0}
.recap{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:10px}
.recap .carte b{display:block;font-size:1.05rem;margin-top:4px;font-variant-numeric:tabular-nums}
.check{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:6px}.check li{display:flex;gap:8px;align-items:flex-start}
.check li::before{content:'☐';color:var(--sourd)}
.sources{margin-top:28px;padding-top:14px;border-top:1px solid var(--regle);font-size:.84rem;color:var(--sourd)}
.sources code{font-family:var(--mono);font-size:.8em}
@media (max-width:760px){.proc{grid-template-columns:1fr}}
</style>`);
H.push('<div class="page">');
H.push(`<div class="bandeau"><div class="marque">Plateforme de dépôt des offres <small>· maquette PRS 2.0, ${h(jour)}</small></div><div><span class="exemple">Candidat d'exemple : SARL Tsara Informatique — rien n'est enregistré</span></div></div>`);
H.push(`<p class="sur">Appel d'offres ouvert · ${h(procedure.forme)} · ${h(procedure.acheteur)}</p>`);
H.push(`<h1>${h(procedure.reference)} — ${h(procedure.objet)}</h1>`);
H.push('<div class="proc">');
H.push(`<div class="carte"><h2>Votre dépôt</h2><dl><dt>Date et heure limites</dt><dd><b>${h(dateFr(procedure.dateLimite))} ${h(procedure.heureLimite)}</b> — ${h(procedure.fuseau)}</dd><dt>Dépôts ouverts depuis</dt><dd>${h(dateFr(procedure.ouvertureDepots))}</dd><dt>Plateforme</dt><dd class="mono">${h(procedure.plateforme)}</dd><dt>Formats admis</dt><dd>${procedure.formats.map((f) => `<span class="puce">${h(f)}</span>`).join(' ')} · ${h(fr(procedure.tailleFichier))} Mo par fichier, ${h(fr(procedure.tailleOffre))} Mo par offre</dd><dt>Signature exigée</dt><dd>électronique, niveau <b>${h(procedure.signature)}</b></dd><dt>Remplacement ou retrait</dt><dd>${procedure.remplacement === 'OUI' ? 'possible jusqu’à la date limite' : 'non admis'}</dd><dt>Garantie de soumission</dt><dd>${h(procedure.garantieForme)}${procedure.garantieOriginal === 'OUI' ? ' — original papier exigé en plus' : ''} ; validité ${h(procedure.validiteGarantie)} jours</dd><dt>Assistance</dt><dd>${h(procedure.assistance)} — jusqu'au ${h(dateFr(procedure.limiteAssistance))}</dd></dl></div>`);
H.push(`<div class="carte"><h2>Ce que la plateforme sait déjà</h2><p class="note">Ces formulaires sont <b>pré-remplis depuis la fiche DAO</b> de la PRMP : articles, quantités, unités, lieux, délais, monnaie. Le candidat ne saisit que ce que les documents types officiels lui réservent.</p><div class="legende"><span class="l-fiche">Rempli par la fiche</span><span class="l-cand">Saisi par le candidat</span><span class="l-calc">Calculé par la plateforme</span></div><p class="note">Monnaie de l'offre : <b>${h(procedure.monnaie)}</b> · Prix ${h(procedure.typePrix === 'UNITAIRES' ? 'unitaires' : 'global forfaitaire')} · ${aCommande ? 'marché à commande : quantités minimale et maximale' : 'quantités fixes'} · TVA ${h(fr(tva))} %</p></div>`);
H.push('</div>');
H.push('<div class="carte">');
H.push(`<p class="sur">Lot</p><div class="lots" role="tablist" aria-label="Lots">${procedure.lots.map((l) => `<button type="button" role="tab" aria-pressed="${l.n === 1}" data-lot="${l.n}">Lot ${l.n} — ${h(l.designation)}</button>`).join('')}</div>`);
H.push('<div class="onglets" role="tablist" aria-label="Formulaires"><button type="button" role="tab" aria-selected="true" data-doc="bordereau">Bordereau des prix</button><button type="button" role="tab" aria-selected="false" data-doc="calendrier">Liste des fournitures et calendrier</button><button type="button" role="tab" aria-selected="false" data-doc="conformite">Conformité technique</button><button type="button" role="tab" aria-selected="false" data-doc="recap">Récapitulatif et dépôt</button></div>');
H.push('<div id="formulaire"></div>');
H.push('</div>');
H.push(`<div class="sources"><b>Sources</b> — Document type 4 (cadre d'acte d'engagement), annexe « Bordereau des prix pour les fournitures locales », marché à commande, huit colonnes ; document type 5 (CPS), annexes « Liste des Fournitures et Calendrier de livraison » (« la PRMP remplit ce tableau, à l'exception de la colonne “Date de livraison offerte par le Candidat” ») et « Résumé des spécifications techniques requises » (articles, noms, spécifications et normes), dont le tableau de conformité est le pendant. Les intitulés de colonnes sont ceux des documents types. Données : fiche DAO ${h(ID)}${VERSION ? ' version ' + h(VERSION) : ''}, ligne ${h(fiche.idDetail)} du plan ${h(procedure.planRef)}, ${articles.length} articles sur ${nbLots} lot(s). Page générée par <code>scripts/maquette-formulaires-en-ligne.mjs</code>.</div>`);
H.push('</div>');
H.push(`<script>
const P = ${JSON.stringify(procedure)};
const TVA = ${JSON.stringify(tva)};
const etat = { lot: 1, doc: 'bordereau', saisies: {} };
const fr = (n) => (n == null || n === '' || Number.isNaN(n)) ? '—' : new Intl.NumberFormat('fr-FR').format(Math.round(n));
const dateFr = (s) => { if (!s) return ''; const [d, t] = String(s).split('T'); const [a, m, j] = d.split('-'); return j + '/' + m + '/' + a + (t ? ' ' + t.slice(0, 5) : ''); };
const h = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cle = (lot, no, champ) => lot + ':' + no + ':' + champ;
const val = (lot, no, champ) => etat.saisies[cle(lot, no, champ)] ?? '';
function bordereau(l) {
  const lignes = l.articles.map((a) => {
    const pu = Number(val(l.n, a.no, 'pu')) || 0;
    const min = pu * (a.qmin ?? a.q ?? 0), max = pu * (a.qmax ?? a.q ?? 0);
    return \`<tr><td class="fiche mono">\${a.no}</td><td class="fiche">\${h(a.designation)}<br><small class="mono">\${h(a.unite)}</small></td><td class="cand"><input type="date" aria-label="Date de livraison offerte, article \${a.no}" data-champ="date" data-no="\${a.no}" value="\${h(val(l.n, a.no, 'date'))}"></td><td class="cand num"><input type="number" min="0" step="1" inputmode="numeric" aria-label="Prix unitaire EXW, article \${a.no}" data-champ="pu" data-no="\${a.no}" value="\${h(val(l.n, a.no, 'pu'))}"> Ar</td><td class="fiche num">\${fr(a.qmin ?? a.q)}</td><td class="fiche num">\${fr(a.qmax ?? a.q)}</td><td class="calc num">\${fr(min)}</td><td class="calc num">\${fr(max)}</td></tr>\`;
  }).join('');
  const tot = l.articles.reduce((s, a) => { const pu = Number(val(l.n, a.no, 'pu')) || 0; return { min: s.min + pu * (a.qmin ?? a.q ?? 0), max: s.max + pu * (a.qmax ?? a.q ?? 0) }; }, { min: 0, max: 0 });
  const tvaMin = tot.min * TVA / 100, tvaMax = tot.max * TVA / 100;
  return \`<h2>Bordereau des prix pour les fournitures locales — lot \${l.n}, \${h(l.designation)}</h2>
  <p class="note">Monnaie : \${h(P.monnaie)} · Marché : \${h(P.reference)} · Lot n° \${l.n} · Livraison à <b>\${h(l.lieu)}</b>, au plus \${h(l.delai ?? P.delaiLivraison)} jours après chaque bon de commande. La date de remise de l'offre est celle du dépôt sur la plateforme.</p>
  <div class="defilant"><table><thead><tr><th><span class="col">1</span>Article</th><th><span class="col">2</span>Description</th><th><span class="col">3</span>Date de livraison selon EXW</th><th class="num"><span class="col">4</span>Prix unitaire EXW + Frais de transport jusqu'au lieu de destination finale</th><th class="num"><span class="col">5</span>Quantité (Nb. d'unités) minimale</th><th class="num"><span class="col">6</span>Quantité (Nb. d'unités) maximale</th><th class="num"><span class="col">7</span>Montant minimal</th><th class="num"><span class="col">8</span>Montant maximale</th></tr></thead>
  <tbody>\${lignes}</tbody>
  <tfoot><tr><td colspan="6">Montant HTVA</td><td class="num">\${fr(tot.min)}</td><td class="num">\${fr(tot.max)}</td></tr><tr><td colspan="6">TVA (\${fr(TVA)} %)</td><td class="num">\${fr(tvaMin)}</td><td class="num">\${fr(tvaMax)}</td></tr><tr><td colspan="6">Montant TTC</td><td class="num">\${fr(tot.min + tvaMin)}</td><td class="num">\${fr(tot.max + tvaMax)}</td></tr></tfoot></table></div>
  <p class="arrete">Arrêté le montant minimal du marché à la somme de <b>\${fr(tot.min + tvaMin)} \${h(P.monnaie)}</b> y compris la Taxe sur la valeur ajoutée (TVA) au taux de \${fr(TVA)} %, et le montant maximal du marché à la somme de <b>\${fr(tot.max + tvaMax)} \${h(P.monnaie)}</b> — les montants en toutes lettres sont posés par la plateforme à la signature.</p>
  <p class="note">Repères de la fiche pour ce lot : montant minimal \${fr(l.montantMin)} et maximal \${fr(l.montantMax)} \${h(P.monnaie)} ; garantie de soumission \${fr(l.garantie)} \${h(P.monnaie)}.</p>\`;
}
function calendrier(l) {
  const lignes = l.articles.map((a) => \`<tr><td class="fiche mono">\${a.no}</td><td class="fiche">\${h(a.designation)}</td><td class="fiche num">\${a.qmin != null ? fr(a.qmin) + ' à ' + fr(a.qmax) : fr(a.q)}</td><td class="fiche">\${h(a.unite)}</td><td class="fiche">\${h(l.lieu)}</td><td class="fiche">à la commande</td><td class="fiche">\${h(l.delai ?? P.delaiLivraison)} jours après le bon de commande</td><td class="cand"><input type="date" aria-label="Date de livraison offerte, article \${a.no}" data-champ="date" data-no="\${a.no}" value="\${h(val(l.n, a.no, 'date'))}"></td></tr>\`).join('');
  return \`<h2>Liste des Fournitures et Calendrier de livraison — lot \${l.n}</h2>
  <p class="note">Le document type le dit : la PRMP remplit ce tableau, à l'exception de la colonne « Date de livraison offerte par le Candidat ». La date offerte est la même que celle du bordereau (colonne 3) : saisie une fois, reprise partout.</p>
  <div class="defilant"><table><thead><tr><th>Article No.</th><th>Description des Fournitures</th><th class="num">Quantité (Nb. d'unités)</th><th>Unité</th><th>Site (projet) ou Destination finale indiqués aux DPAO</th><th>Date de livraison au plus tôt</th><th>Date de livraison au plus tard</th><th>Date de livraison offerte par le Candidat</th></tr></thead><tbody>\${lignes}</tbody></table></div>\`;
}
function conformite(l) {
  const lignes = l.articles.flatMap((a) => a.caracteristiques.map((c, i) => \`<tr>\${i === 0 ? \`<td class="fiche mono" rowspan="\${a.caracteristiques.length}">\${a.no}</td><td class="fiche" rowspan="\${a.caracteristiques.length}">\${h(a.designation)}</td>\` : ''}<td class="fiche">\${h(c.libelle)}</td><td class="fiche">\${h(c.exigence)}</td><td class="cand"><input class="txt" type="text" aria-label="Caractéristique proposée : \${h(c.libelle)}" data-champ="prop:\${i}" data-no="\${a.no}" value="\${h(val(l.n, a.no, 'prop:' + i))}"></td>\${i === 0 ? \`<td class="cand" rowspan="\${a.caracteristiques.length}"><input class="txt" type="text" placeholder="marque, modèle" aria-label="Marque et modèle, article \${a.no}" data-champ="marque" data-no="\${a.no}" value="\${h(val(l.n, a.no, 'marque'))}"></td>\` : ''}<td class="cand"><select aria-label="Conformité : \${h(c.libelle)}" data-champ="conf:\${i}" data-no="\${a.no}"><option value="">—</option><option value="OUI"\${val(l.n, a.no, 'conf:' + i) === 'OUI' ? ' selected' : ''}>Conforme</option><option value="NON"\${val(l.n, a.no, 'conf:' + i) === 'NON' ? ' selected' : ''}>Non conforme</option></select></td></tr>\`)).join('');
  return \`<h2>Conformité technique — lot \${l.n}</h2>
  <p class="note">Le « Résumé des spécifications techniques requises » du CPS (articles, noms, spécifications et normes) est rempli par la fiche ; le candidat dit ce qu'il propose, la marque et le modèle, et se prononce ligne par ligne.</p>
  <div class="defilant"><table><thead><tr><th>Articles (Nos)</th><th>Noms des Fournitures ou des Services connexes</th><th>Caractéristique</th><th>Spécifications techniques et normes applicables</th><th>Caractéristique proposée</th><th>Marque et modèle</th><th>Conforme</th></tr></thead><tbody>\${lignes}</tbody></table></div>\`;
}
function recap() {
  const cartes = P.lots.map((l) => {
    const tot = l.articles.reduce((s, a) => { const pu = Number(val(l.n, a.no, 'pu')) || 0; return { min: s.min + pu * (a.qmin ?? a.q ?? 0), max: s.max + pu * (a.qmax ?? a.q ?? 0) }; }, { min: 0, max: 0 });
    const dates = l.articles.filter((a) => val(l.n, a.no, 'date')).length, prix = l.articles.filter((a) => val(l.n, a.no, 'pu')).length;
    const conf = l.articles.reduce((s, a) => s + a.caracteristiques.filter((c, i) => val(l.n, a.no, 'conf:' + i)).length, 0), nbConf = l.articles.reduce((s, a) => s + a.caracteristiques.length, 0);
    return \`<div class="carte"><span class="sur">Lot \${l.n}</span><div>\${h(l.designation)}</div><b>\${fr(tot.min * (1 + TVA / 100))} à \${fr(tot.max * (1 + TVA / 100))} \${h(P.monnaie)} TTC</b><p class="note">prix : \${prix}/\${l.articles.length} · dates : \${dates}/\${l.articles.length} · conformité : \${conf}/\${nbConf}</p></div>\`;
  }).join('');
  return \`<h2>Récapitulatif de l'offre et dépôt</h2><div class="recap">\${cartes}</div>
  <h3 style="margin-top:16px">Pièces à joindre, dans les formats admis (\${P.formats.map(h).join(', ')})</h3>
  <ul class="check"><li>Formulaires A1 à A4 remplis et signés (niveau de signature \${h(P.signature)})</li><li>Garantie de soumission par lot : \${h(P.garantieForme)}\${P.garantieOriginal === 'OUI' ? ' ; original papier déposé en plus' : ''}</li><li>Acte d'engagement par lot, produit depuis ce bordereau et signé électroniquement</li><li>Pièces de la clause 6.2 des instructions (identification, situation juridique, fiscale)</li></ul>
  <p class="note">Au dépôt, la plateforme scelle l'offre, horodate à l'heure de référence (\${h(P.fuseau)}) et délivre un accusé de réception ; l'offre reste chiffrée jusqu'à la séance d'ouverture. Remplacement ou retrait \${P.remplacement === 'OUI' ? 'possibles' : 'impossibles'} jusqu'à la date limite.</p>\`;
}
function rendre() {
  const l = P.lots.find((x) => x.n === etat.lot);
  const z = document.getElementById('formulaire');
  z.innerHTML = etat.doc === 'bordereau' ? bordereau(l) : etat.doc === 'calendrier' ? calendrier(l) : etat.doc === 'conformite' ? conformite(l) : recap();
  z.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', () => { etat.saisies[cle(etat.lot, Number(el.dataset.no), el.dataset.champ)] = el.value; if (el.dataset.champ === 'pu') { const actif = document.activeElement === el; rendre(); if (actif) { const n = z.querySelector('[data-champ="pu"][data-no="' + el.dataset.no + '"]'); n && n.focus(); } } }));
}
document.querySelectorAll('.lots button').forEach((b) => b.addEventListener('click', () => { etat.lot = Number(b.dataset.lot); document.querySelectorAll('.lots button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); rendre(); }));
document.querySelectorAll('.onglets button').forEach((b) => b.addEventListener('click', () => { etat.doc = b.dataset.doc; document.querySelectorAll('.onglets button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); rendre(); }));
rendre();
</script>`);
fs.writeFileSync(SORTIE, H.join('\n') + '\n');
console.log(`écrit ${path.relative(RACINE, SORTIE)} — fiche ${ID}${VERSION ? ' v' + VERSION : ''}, ${nbLots} lot(s), ${articles.length} article(s), TVA ${tva} %, lots nommés : ${lots.length ? 'oui' : 'non (« Lot n »)'}`);
