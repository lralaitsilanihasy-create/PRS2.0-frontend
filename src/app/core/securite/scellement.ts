import { zipSync, unzipSync } from 'fflate';
import { combine, split } from 'shamir-secret-sharing';

import { ClesPubliques } from '../../models/cao.model';
import { chiffrerPour, versBase64, versHex } from './cles-detenteur';

/**
 * Le **scellement d'une offre** dans le navigateur du candidat (ADR-0013 §1 « Dépôt », §4 « Le conteneur » ; lot 3, V68).
 * Rien d'écrit à la main :
 * - **WebCrypto** pour AES-256-GCM (le contenu), RSA-OAEP (les parts), SHA-256 (les empreintes) ;
 * - **`shamir-secret-sharing`** (Privy, audits Cure53 et Zellic) pour partager la clé `K` en `n` parts, seuil `quorum` ;
 * - **`fflate`** pour l'archive ZIP du contenu en clair (entrées stockées, sans compression : les pièces sont déjà des PDF).
 *
 * `K` n'existe que le temps du scellement, dans ce module ; elle n'en sort jamais, ni ses parts en clair. Le serveur reçoit
 * un en-tête (en clair, sans secret) et des morceaux chiffrés.
 *
 * ⚠️ **Les données authentifiées d'un morceau** — l'ADR dit « `idOffre | version | rang | dernier | SHA-256(en-tête)` » sans fixer
 * les octets ; le front les fixe ici, et le lot 4 (déchiffrement au serveur) doit faire de même : la chaîne UTF-8
 * `${idOffre}|1|${rang}|${0 ou 1}|${sha256 hexadécimal minuscule des octets UTF-8 de l'en-tête}`.
 */

export const TAILLE_MORCEAU = 4 * 1024 * 1024;
export const ALGORITHMES = ['AES-256-GCM', 'RSA-OAEP-3072-SHA256', 'SHAMIR-GF256'] as const;

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

const encodeur = new TextEncoder();

async function sha256Hex(octets: Uint8Array<ArrayBuffer>): Promise<string> {
  return versHex(await subtle().digest('SHA-256', octets));
}

// ── Le contenu en clair : une archive ZIP (manifeste + pièces) ────────────────────────────────────────────────

/** Les valeurs que la séance d'ouverture lira à haute voix (lot 4) : l'acte d'engagement, en quelques champs. */
export interface ActeEngagementSaisi {
  montantHt: number;
  montantTtc: number;
  monnaie: 'MGA';
  delai: number;
  delaiUnite: 'JOURS' | 'MOIS';
  validiteJours: number;
  rabais: string | null;
}

export interface MembreGroupement {
  nif: string;
  raisonSociale: string;
  mandataire: boolean;
}

/** Une pièce jointe : le fichier rattaché à une pièce attendue par son `code`. */
export interface PieceJointe {
  code: string;
  fichier: File;
}

export interface Manifeste {
  version: 1;
  idDmc: number;
  lot: number | null;
  entreprise: { nif: string; raisonSociale: string };
  groupement: MembreGroupement[] | null;
  acteEngagement: ActeEngagementSaisi;
  pieces: { code: string; nomFichier: string; taille: number; sha256: string }[];
  garantie: { codeVerification: string; nomFichier: string } | null;
  dateScellement: string;
}

/** Un nom d'entrée sûr et unique dans l'archive : `<code>-<nom du fichier>`, sans chemin. */
function nomEntree(code: string, nom: string): string {
  return `${code}-${nom.replace(/[\\/:*?"<>|]+/g, '_')}`;
}

/**
 * L'archive du contenu : `manifeste.json` puis un fichier par pièce. Le manifeste porte l'empreinte de chaque pièce : à
 * l'ouverture, une pièce altérée se voit.
 */
export async function construireContenu(
  base: Omit<Manifeste, 'version' | 'pieces' | 'garantie' | 'dateScellement'>,
  pieces: PieceJointe[],
  garantie: { codeVerification: string; code: string } | null,
  maintenant: string,
): Promise<{ contenu: Uint8Array<ArrayBuffer>; manifeste: Manifeste }> {
  const entrees: Record<string, Uint8Array> = {};
  const lignes: Manifeste['pieces'] = [];
  for (const p of pieces) {
    const octets = new Uint8Array(await p.fichier.arrayBuffer());
    const nom = nomEntree(p.code, p.fichier.name);
    entrees[nom] = octets;
    lignes.push({ code: p.code, nomFichier: nom, taille: octets.length, sha256: await sha256Hex(octets) });
  }
  const pieceGarantie = garantie ? lignes.find((l) => l.code === garantie.code) : null;
  const manifeste: Manifeste = {
    version: 1,
    ...base,
    pieces: lignes,
    garantie: garantie && pieceGarantie ? { codeVerification: garantie.codeVerification, nomFichier: pieceGarantie.nomFichier } : null,
    dateScellement: maintenant,
  };
  const zip = zipSync({ 'manifeste.json': encodeur.encode(JSON.stringify(manifeste, null, 2)), ...entrees }, { level: 0 });
  return { contenu: new Uint8Array(zip.buffer as ArrayBuffer, zip.byteOffset, zip.byteLength), manifeste };
}

/** Relit une archive de contenu (tests ; le lot 4 le fera au serveur). */
export function lireContenu(contenu: Uint8Array): { manifeste: Manifeste; fichiers: Record<string, Uint8Array> } {
  const fichiers = unzipSync(contenu);
  const manifeste = JSON.parse(new TextDecoder().decode(fichiers['manifeste.json'])) as Manifeste;
  return { manifeste, fichiers };
}

// ── Le conteneur : en-tête + morceaux chiffrés ────────────────────────────────────────────────────────────────

export interface EnTete {
  version: 1;
  idOffre: string;
  idDmc: number;
  lot: number | null;
  algorithmes: string[];
  tailleMorceau: number;
  nombreMorceaux: number;
  tailleContenu: number;
  quorum: number;
  n: number;
  parts: { empreinte: string; part: string }[];
}

export interface OffreScellee {
  idOffre: string;
  /** L'en-tête sérialisé, tel qu'il part au serveur et entre dans l'empreinte. */
  enTete: string;
  /** `iv ‖ chiffré ‖ étiquette`, du rang 0 au rang `nombreMorceaux − 1`. */
  morceaux: Uint8Array<ArrayBuffer>[];
  /** SHA-256 hexadécimal de chaque morceau (`X-Empreinte`). */
  empreintesMorceaux: string[];
  /** SHA-256 de l'en-tête (octets UTF-8) puis des morceaux, dans l'ordre : l'empreinte de l'accusé. */
  empreinte: string;
}

/** Les données authentifiées d'un morceau — voir l'en-tête de ce fichier : c'est le contrat avec le lot 4. */
export function donneesAuthentifiees(idOffre: string, rang: number, dernier: boolean, empreinteEnTete: string): Uint8Array<ArrayBuffer> {
  return encodeur.encode(`${idOffre}|1|${rang}|${dernier ? 1 : 0}|${empreinteEnTete}`);
}

/**
 * Scelle un contenu pour les clés publiées d'une procédure. `K` (AES-256) est tirée ici, partagée en `n` parts (seuil
 * `quorum`) chiffrées chacune pour **un** détenteur, dans l'ordre de la liste publiée ; puis elle est oubliée.
 * `progression` reçoit le nombre de morceaux chiffrés.
 */
export async function sceller(
  contenu: Uint8Array<ArrayBuffer>,
  cles: ClesPubliques,
  idDmc: number,
  lot: number | null,
  progression?: (faits: number, total: number) => void,
): Promise<OffreScellee> {
  if (cles.detenteurs.length !== cles.n) throw new Error('La liste des clés publiées est incomplète : la procédure ne peut pas recevoir d’offre.');
  const idOffre = globalThis.crypto.randomUUID();

  // La clé de l'offre, et ses parts.
  const k = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const parts = await split(k, cles.n, cles.quorum);
  const partsChiffrees: EnTete['parts'] = [];
  for (let i = 0; i < cles.detenteurs.length; i++) {
    const d = cles.detenteurs[i];
    partsChiffrees.push({ empreinte: d.empreinte, part: await chiffrerPour(d.clePublique, new Uint8Array(parts[i])) });
  }
  const cle = await subtle().importKey('raw', k, { name: 'AES-GCM' }, false, ['encrypt']);
  k.fill(0);
  for (const p of parts) p.fill(0);

  const nombreMorceaux = Math.max(1, Math.ceil(contenu.length / TAILLE_MORCEAU));
  const enTeteObjet: EnTete = {
    version: 1,
    idOffre,
    idDmc,
    lot,
    algorithmes: [...ALGORITHMES],
    tailleMorceau: TAILLE_MORCEAU,
    nombreMorceaux,
    tailleContenu: contenu.length,
    quorum: cles.quorum,
    n: cles.n,
    parts: partsChiffrees,
  };
  const enTete = JSON.stringify(enTeteObjet);
  const octetsEnTete = encodeur.encode(enTete);
  const empreinteEnTete = await sha256Hex(octetsEnTete);

  const morceaux: Uint8Array<ArrayBuffer>[] = [];
  const empreintesMorceaux: string[] = [];
  for (let rang = 0; rang < nombreMorceaux; rang++) {
    const debut = rang * TAILLE_MORCEAU;
    const clair = contenu.subarray(debut, Math.min(contenu.length, debut + TAILLE_MORCEAU));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const chiffre = new Uint8Array(
      await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: donneesAuthentifiees(idOffre, rang, rang === nombreMorceaux - 1, empreinteEnTete), tagLength: 128 }, cle, clair),
    );
    const morceau = new Uint8Array(iv.length + chiffre.length);
    morceau.set(iv, 0);
    morceau.set(chiffre, iv.length);
    morceaux.push(morceau);
    empreintesMorceaux.push(await sha256Hex(morceau));
    progression?.(rang + 1, nombreMorceaux);
  }

  // L'empreinte de l'accusé : l'en-tête puis les morceaux. WebCrypto n'a pas de hachage incrémental : on concatène.
  const total = octetsEnTete.length + morceaux.reduce((s, m) => s + m.length, 0);
  const tout = new Uint8Array(total);
  tout.set(octetsEnTete, 0);
  let pos = octetsEnTete.length;
  for (const m of morceaux) {
    tout.set(m, pos);
    pos += m.length;
  }
  const empreinte = await sha256Hex(tout);
  return { idOffre, enTete, morceaux, empreintesMorceaux, empreinte };
}

/**
 * Le geste inverse, pour les **tests** et pour vérifier un scellement : à partir de `quorum` parts déchiffrées (base64 des
 * octets de la part), reconstitue `K` et déchiffre. Au lot 4, c'est le serveur qui le fera (BouncyCastle, ADR §2).
 */
export async function desceller(enTete: string, morceaux: Uint8Array<ArrayBuffer>[], partsClaires: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
  const e = JSON.parse(enTete) as EnTete;
  const k = await combine(partsClaires);
  const cle = await subtle().importKey('raw', new Uint8Array(k), { name: 'AES-GCM' }, false, ['decrypt']);
  const empreinteEnTete = await sha256Hex(encodeur.encode(enTete));
  const sortie = new Uint8Array(e.tailleContenu);
  let pos = 0;
  for (let rang = 0; rang < morceaux.length; rang++) {
    const m = morceaux[rang];
    const clair = new Uint8Array(
      await subtle().decrypt({ name: 'AES-GCM', iv: m.subarray(0, 12), additionalData: donneesAuthentifiees(e.idOffre, rang, rang === morceaux.length - 1, empreinteEnTete), tagLength: 128 }, cle, m.subarray(12)),
    );
    sortie.set(clair, pos);
    pos += clair.length;
  }
  return sortie;
}

/** Les formats de `B04-SE-07` en types MIME, pour `validerFichier`. */
export function typesDesFormats(formats: string[] | null | undefined): string[] {
  const types = new Set<string>();
  for (const f of formats ?? ['PDF']) {
    const x = f.toUpperCase();
    if (x === 'PDF' || x === 'PDF/A') types.add('application/pdf');
    else if (x === 'XLSX') types.add('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else if (x === 'DOCX') types.add('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    else if (x === 'ZIP') {
      types.add('application/zip');
      types.add('application/x-zip-compressed');
    } else if (x === 'JPEG' || x === 'JPG') types.add('image/jpeg');
    else if (x === 'PNG') types.add('image/png');
  }
  return [...types];
}

export { versBase64 };
