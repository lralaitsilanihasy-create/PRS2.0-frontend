// Vecteurs de test du scellement (lot 4, ADR-0013 §2) — produits avec les MÊMES bibliothèques et les MÊMES règles que
// `src/app/core/securite/scellement.ts` : `shamir-secret-sharing` 0.0.4, WebCrypto (Node ≥ 20), AES-256-GCM, RSA-OAEP
// 3072 SHA-256 / MGF1-SHA-256. Ils servent au backend à prouver en CI que BouncyCastle recombine les parts du front et
// déchiffre un conteneur entier. Clés privées de TEST seulement, générées ici, sans aucune valeur.
//
//   node scripts/vecteurs-scellement.mjs > docs/vecteurs-scellement-2026-10-04.json          (un morceau, ~25 ko)
//   node scripts/vecteurs-scellement.mjs --deux-morceaux > vecteurs-grands.json         (4 Mio + 1000 o, ~5,6 Mo : à ne pas commiter)
import { webcrypto as c } from 'node:crypto';
import { split } from 'shamir-secret-sharing';

const s = c.subtle;
const b64 = (o) => Buffer.from(o).toString('base64');
const hex = (o) => Buffer.from(o).toString('hex');
const sha = async (o) => hex(await s.digest('SHA-256', o));
const enc = new TextEncoder();

// 1. Shamir seul : un secret de 32 octets, n = 3, seuil 2.
const secret = c.getRandomValues(new Uint8Array(32));
const parts = await split(secret, 3, 2);
const shamir = { secret: hex(secret), n: 3, seuil: 2, parts: parts.map(hex), note: 'Chaque part fait 33 octets : 32 octets de valeurs puis l’abscisse en DERNIER octet. Toute paire de parts doit redonner le secret.' };

// 2. Un conteneur complet : trois détenteurs, quorum 2 ; 3000 octets (un morceau, drapeau « dernier » = 1), ou, avec
//    `--deux-morceaux`, 4 Mio + 1000 octets (le premier morceau plein, « dernier » = 0, le second court).
const TAILLE_MORCEAU = 4 * 1024 * 1024;
const detenteurs = [];
for (const role of ['MEMBRE', 'MEMBRE', 'SECOURS']) {
  const p = await s.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const spki = new Uint8Array(await s.exportKey('spki', p.publicKey));
  const pkcs8 = new Uint8Array(await s.exportKey('pkcs8', p.privateKey));
  detenteurs.push({ role, clePublique: b64(spki), empreinte: await sha(spki), clePriveePkcs8: b64(pkcs8), publique: p.publicKey });
}
const contenu = new Uint8Array(process.argv.includes('--deux-morceaux') ? TAILLE_MORCEAU + 1000 : 3000);
for (let i = 0; i < contenu.length; i += 65536) c.getRandomValues(contenu.subarray(i, Math.min(contenu.length, i + 65536)));
const k = c.getRandomValues(new Uint8Array(32));
const partsK = await split(k, 3, 2);
const partsChiffrees = [];
for (let i = 0; i < 3; i++) partsChiffrees.push({ empreinte: detenteurs[i].empreinte, part: b64(await s.encrypt({ name: 'RSA-OAEP' }, detenteurs[i].publique, partsK[i])) });
const idOffre = c.randomUUID();
const nombreMorceaux = Math.max(1, Math.ceil(contenu.length / TAILLE_MORCEAU));
const enTete = JSON.stringify({ version: 1, idOffre, idDmc: 40, lot: 1, algorithmes: ['AES-256-GCM', 'RSA-OAEP-3072-SHA256', 'SHAMIR-GF256'], tailleMorceau: TAILLE_MORCEAU, nombreMorceaux, tailleContenu: contenu.length, quorum: 2, n: 3, parts: partsChiffrees });
const empreinteEnTete = await sha(enc.encode(enTete));
const cle = await s.importKey('raw', k, 'AES-GCM', false, ['encrypt']);
const morceaux = [];
for (let rang = 0; rang < nombreMorceaux; rang++) {
  const clair = contenu.subarray(rang * TAILLE_MORCEAU, Math.min(contenu.length, (rang + 1) * TAILLE_MORCEAU));
  const iv = c.getRandomValues(new Uint8Array(12));
  const aad = enc.encode(`${idOffre}|1|${rang}|${rang === nombreMorceaux - 1 ? 1 : 0}|${empreinteEnTete}`);
  const ch = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, cle, clair));
  const m = new Uint8Array(12 + ch.length);
  m.set(iv);
  m.set(ch, 12);
  morceaux.push(m);
}
const tout = Buffer.concat([Buffer.from(enc.encode(enTete)), ...morceaux.map((m) => Buffer.from(m))]);
const conteneur = {
  note: 'Le contenu en clair n’est pas un ZIP ici (octets aléatoires) : le vecteur prouve la recombinaison et le déchiffrement, pas la lecture du manifeste.',
  detenteurs: detenteurs.map(({ role, clePublique, empreinte, clePriveePkcs8 }) => ({ role, clePublique, empreinte, clePriveePkcs8 })),
  k: hex(k),
  enTete,
  donneesAuthentifiees: 'UTF-8 de `${idOffre}|1|${rang}|${0|1}|${sha256 hex minuscule des octets UTF-8 de enTete}`',
  morceaux: morceaux.map((m, rang) => ({ rang, base64: b64(m), sha256: '' })),
  empreinte: await sha(tout),
  sha256Contenu: await sha(contenu),
  tailleContenu: contenu.length,
};
for (const m of conteneur.morceaux) m.sha256 = await sha(Buffer.from(m.base64, 'base64'));
process.stdout.write(JSON.stringify({ genere: new Date().toISOString(), bibliotheques: { 'shamir-secret-sharing': '0.0.4', webcrypto: `Node ${process.version}` }, shamir, conteneur }, null, 2) + '\n');
