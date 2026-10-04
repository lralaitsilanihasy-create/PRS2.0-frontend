import { Enveloppe } from '../../models/cao.model';

/**
 * Les clés d'un détenteur de part (ADR-0013, §1, §3 ; lot 2b) — **WebCrypto seul, rien d'écrit à la main** :
 * - une paire RSA-OAEP de 3072 bits (SHA-256), née dans le navigateur du détenteur ;
 * - la clé publique exportée en SPKI, son **empreinte** = SHA-256 de la SPKI en hexadécimal (le contrôle du détenteur
 *   contre un serveur qui glisserait une clé : il la voit ici, puis dans la liste publiée) ;
 * - la clé privée **enveloppée** (`wrapKey('pkcs8')`) sous AES-256-GCM, par une clé dérivée de la phrase secrète
 *   (PBKDF2-SHA-256, 600 000 itérations, sel de 16 octets). Le serveur reçoit l'enveloppe, jamais la phrase ni la clé.
 * La phrase ne quitte jamais ce module : elle entre, une clé en sort, elle est oubliée.
 */

export const ITERATIONS_PBKDF2 = 600_000;
/** ADR-0013 §3 : douze caractères au moins ; l'écran recommande quatre mots ou plus. */
export const LONGUEUR_MIN_PHRASE = 12;
const RSA_OAEP: RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' };

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

// ── Encodages ─────────────────────────────────────────────────────────────────────────────────────────────────

export function versBase64(octets: ArrayBuffer | Uint8Array): string {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let s = '';
  for (let i = 0; i < vue.length; i += 0x8000) s += String.fromCharCode(...vue.subarray(i, i + 0x8000));
  return btoa(s);
}

export function depuisBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.trim());
  const vue = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) vue[i] = s.charCodeAt(i);
  return vue;
}

export function versHex(octets: ArrayBuffer | Uint8Array): string {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  return Array.from(vue, (o) => o.toString(16).padStart(2, '0')).join('');
}

/** « a1b2 c3d4 … » : l'empreinte par groupes de quatre, pour la comparer à l'œil. */
export function formaterEmpreinte(hex: string | null | undefined): string {
  return (hex ?? '').replace(/(.{4})/g, '$1 ').trim();
}

/** Les huit premiers et les huit derniers caractères : pour une liste, l'infobulle garde l'empreinte entière. */
export function empreinteCourte(hex: string | null | undefined): string {
  if (!hex) return '';
  return hex.length <= 20 ? hex : `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

// ── La paire et la clé publique ───────────────────────────────────────────────────────────────────────────────

/** RSA-OAEP, module de 3072 bits, exposant 65537, SHA-256 — extractible : la clé privée doit pouvoir s'envelopper. */
export function genererPaire(): Promise<CryptoKeyPair> {
  return subtle().generateKey(
    { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKeyPair>;
}

/** La clé publique en SPKI (base64) et son empreinte (SHA-256 hexadécimal). */
export async function exporterClePublique(publique: CryptoKey): Promise<{ clePublique: string; empreinte: string }> {
  const spki = await subtle().exportKey('spki', publique);
  return { clePublique: versBase64(spki), empreinte: versHex(await subtle().digest('SHA-256', spki)) };
}

/** L'empreinte d'une clé publique servie (SPKI base64) — pour la recalculer plutôt que croire celle du serveur. */
export async function empreinteDe(clePubliqueBase64: string): Promise<string> {
  return versHex(await subtle().digest('SHA-256', depuisBase64(clePubliqueBase64)));
}

/** Chiffre pour une clé publique servie (SPKI base64) — c'est le geste du serveur pour le défi, et du candidat au lot 3. */
export async function chiffrerPour(clePubliqueBase64: string, clair: Uint8Array<ArrayBuffer>): Promise<string> {
  const publique = await subtle().importKey('spki', depuisBase64(clePubliqueBase64), RSA_OAEP, false, ['encrypt']);
  return versBase64(await subtle().encrypt({ name: 'RSA-OAEP' }, publique, clair));
}

// ── L'enveloppe ───────────────────────────────────────────────────────────────────────────────────────────────

async function cleEnveloppe(phrase: string, sel: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const matiere = await subtle().importKey('raw', new TextEncoder().encode(phrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
    matiere,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/** Enveloppe la clé privée sous la phrase secrète. Sel et vecteur d'initialisation sont tirés ici, et rangés avec l'enveloppe. */
export async function envelopper(privee: CryptoKey, phrase: string): Promise<Enveloppe> {
  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const kek = await cleEnveloppe(phrase, sel, ITERATIONS_PBKDF2);
  const chiffre = await subtle().wrapKey('pkcs8', privee, kek, { name: 'AES-GCM', iv });
  return { chiffre: versBase64(chiffre), iv: versBase64(iv), sel: versBase64(sel), iterations: ITERATIONS_PBKDF2, kdf: 'PBKDF2-SHA-256', algorithme: 'AES-256-GCM' };
}

/** Levée quand la phrase ne déverrouille pas l'enveloppe (AES-GCM refuse l'étiquette) : c'est le seul cas d'échec attendu. */
export class PhraseIncorrecte extends Error {
  constructor() {
    super('La phrase secrète ne déverrouille pas cette clé.');
    this.name = 'PhraseIncorrecte';
  }
}

/** Déverrouille la clé privée (non extractible, déchiffrement seul) depuis son enveloppe et la phrase. */
export async function desenvelopper(enveloppe: Enveloppe, phrase: string): Promise<CryptoKey> {
  const kek = await cleEnveloppe(phrase, depuisBase64(enveloppe.sel), enveloppe.iterations);
  try {
    return await subtle().unwrapKey('pkcs8', depuisBase64(enveloppe.chiffre), kek, { name: 'AES-GCM', iv: depuisBase64(enveloppe.iv) }, RSA_OAEP, false, ['decrypt']);
  } catch {
    throw new PhraseIncorrecte();
  }
}

/** Déchiffre un défi (ou une part, au lot 4) : RSA-OAEP du serveur, base64 → base64 du clair. */
export async function dechiffrer(privee: CryptoKey, chiffreBase64: string): Promise<string> {
  return versBase64(await subtle().decrypt({ name: 'RSA-OAEP' }, privee, depuisBase64(chiffreBase64)));
}

// ── La phrase du pli de secours, et la copie hors ligne ───────────────────────────────────────────────────────

/**
 * 256 mots français courts, sans accent ni trait d'union : une phrase de sept mots vaut 56 bits, se lit sur un pli et se
 * retape sans faute. Huit bits par mot : un octet aléatoire désigne un mot, sans biais.
 */
const MOTS: readonly string[] = (
  'abri acier aigle ancre arbre arche argent avion azur balai balle banc barque bateau beurre biche bille blason bois bouee bougie ' +
  'boule bourg brise brume bulle cabane cactus cadre caillou calme canal canoe carte cedre cercle chaine chalet champ chant charme ' +
  'chemin chene cheval chevre ciel cigale cirque citron cloche cobalt coccinelle colline comete coquille corail corde coteau coton ' +
  'coude crabe craie crayon crepe cristal cuivre cygne dauphin delta desert dome douve dune ecaille echelle eclair ecole ecume ' +
  'eglise elan email encre epice erable escale etable etoile falaise fanal farine faucon fenetre ferme feuille figue filet flamme ' +
  'fleuve flocon flute foret forge fougere four fourmi fraise frene fuseau galet gare gazon geai genet girafe givre glaise ' +
  'gland globe gorge goutte grange gravier grelot grenat grotte grue hamac havre herbe hetre hibou houle huile iris isard ' +
  'jade jardin jasmin jonc jument koala lagune laine lampe lande lavande lierre lilas lion loutre lueur lune lutin maree marin ' +
  'marmot marron menthe merle miel moulin mousse muguet mure myrtille nacre navire neige noyer nuage oasis ocre oiseau olive ' +
  'ombre onde orage orge ormeau otarie ourson palme panier papyrus pelouse perle phare pierre pigeon pinede piste plage plaine ' +
  'plume poire pomme pont poulain prairie prune puits quai quartz rabot racine radeau rame rayon recif renard rivage riviere ' +
  'roche roseau rosee rouge ruban ruche ruisseau sable safran saphir sapin saule seigle sentier sillon source sureau tamis ' +
  'tilleul tortue toundra trefle tresse tulipe vague vallee vapeur verger verre violon volcan voute yole zebre zinc ' +
  'ambre aube bambou brin canne cerf colibri dentelle epi'
).split(' ');

/** Sept mots tirés au sort (56 bits), séparés par des espaces : la phrase générée du pli de secours (ADR §3, S3). */
export function genererPhrase(nbMots = 7): string {
  if (MOTS.length !== 256) throw new Error(`Liste de mots incomplète : ${MOTS.length} au lieu de 256.`);
  const octets = globalThis.crypto.getRandomValues(new Uint8Array(nbMots));
  return Array.from(octets, (o) => MOTS[o]).join(' ');
}

/** La copie hors ligne d'une enveloppe : un petit JSON que le détenteur garde où il veut. Rien de secret dedans sans la phrase. */
export interface CopieCle {
  version: 1;
  idDmc: number;
  role: 'MEMBRE' | 'SECOURS';
  empreinte: string;
  enveloppe: Enveloppe;
}

export function fichierCopie(copie: Omit<CopieCle, 'version'>): Blob {
  return new Blob([JSON.stringify({ version: 1, ...copie }, null, 2)], { type: 'application/json' });
}

/** Relit une copie ; `null` si ce n'est pas une copie de clé de PRS. */
export function lireCopie(texte: string): CopieCle | null {
  try {
    const o = JSON.parse(texte) as Partial<CopieCle>;
    const e = o.enveloppe;
    if (o.version !== 1 || typeof o.idDmc !== 'number' || typeof o.empreinte !== 'string' || !e) return null;
    if (typeof e.chiffre !== 'string' || typeof e.iv !== 'string' || typeof e.sel !== 'string' || typeof e.iterations !== 'number') return null;
    return { version: 1, idDmc: o.idDmc, role: o.role === 'SECOURS' ? 'SECOURS' : 'MEMBRE', empreinte: o.empreinte, enveloppe: e as Enveloppe };
  } catch {
    return null;
  }
}
