let ko = 0; const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) ko++; };
const login = await fetch('http://localhost:8080/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'PRMP001', motDePasse: 'Test@1234' }) });
const cookie = (login.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0]).join('; ');
const get = async (u) => { const r = await fetch('http://localhost:8080' + u, { headers: { Cookie: cookie } }); const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {} return { s: r.status, j }; };

console.log('— Les anciens dossiers —');
for (const id of [100328, 100329, 100331, 100332]) { const d = await get('/api/dossiers/' + id); ok(d.s === 404, `${id} : ${d.s === 404 ? 'supprimé' : 'toujours là (' + d.s + ' ' + (d.j?.statut ?? '') + ')'}`); }
console.log('— Les anciennes fiches —');
for (const id of [1, 5, 6, 7]) { const f = await get('/api/fiches-marche/' + id); ok(f.s === 404, `fiche ${id} : ${f.s === 404 ? 'supprimée' : 'toujours là (' + f.s + ')'}`); }

console.log('— Le plan semé —');
const d = await get('/api/dossiers/100338');
ok(d.s === 200, `dossier 100338 : ${d.s === 200 ? d.j.statut + ' · ' + d.j.refeDossier : 'absent'}`);

console.log('— Les lignes éligibles à un DAO —');
const el = await get('/api/dmcs/eligibles');
const lignes = el.j ?? [];
console.log(`  ${lignes.length} ligne(s) servies`);
for (const l of lignes) console.log(`     ${l.idDetail} · ${(l.categorie ?? '—').padEnd(28)} ${(l.formeMarche ?? '—').padEnd(14)} · ${l.libelleMode} · outillée cat=${l.categorieOutillee} forme=${l.formeOutillee} · dejaDao=${l.dejaDao}`);
const attendu = {
  303080: ['FOURNITURES_SERVICES', 'QUANTITE_FIXE'],
  303081: ['FOURNITURES_SERVICES', 'A_COMMANDE'],
  303082: ['FOURNITURES_SERVICES', 'CONTRAT_CADRE'],
  303083: ['TRAVAUX', 'QUANTITE_FIXE'],
  303084: ['PRESTATIONS_INTELLECTUELLES', 'QUANTITE_FIXE'],
  303085: ['FOURNITURES_SERVICES', 'A_COMMANDE'],
};
for (const [id, [cat, forme]] of Object.entries(attendu)) {
  const l = lignes.find((x) => String(x.idDetail) === id);
  ok(l != null && l.categorie === cat && l.formeMarche === forme, `${id} : ${l ? `${l.categorie}/${l.formeMarche}` : 'ABSENTE'} (attendu ${cat}/${forme})`);
}
for (const id of [303086, 303087]) ok(!lignes.some((x) => String(x.idDetail) === id), `${id} : écartée (hors appel d'offres)`);
console.log(ko === 0 ? '\nSEMIS VÉRIFIÉ' : `\n${ko} écart(s)`);
