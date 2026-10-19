import { Enveloppe } from '../../models';
import { ITERATIONS_PBKDF2, PhraseIncorrecte, depuisBase64, versBase64, versHex } from './cles-detenteur';

/**
 * ⚠️ 19/10 (pilote, « copie-offre-candidat », V136) — la **copie chiffrée par le candidat** de sa propre saisie, relisible depuis
 * n'importe quel poste avec sa **phrase de relecture**. Même mécanique que l'enveloppe de la clé d'un détenteur (ADR-0013 §3) :
 * PBKDF2-SHA-256 (600 000 itérations, sel de 16 octets) → AES-256-GCM. Le serveur garde l'enveloppe et ne peut pas l'ouvrir ; la
 * phrase ne quitte jamais ce module. Le clair est du JSON (le récapitulatif), jamais une clé.
 */

/** Plus longue que la phrase d'un détenteur : le bloc est sur le serveur, un essai hors ligne doit rester hors de portée. */
export const LONGUEUR_MIN_PHRASE_COPIE = 16;
export const VERSION_COPIE = 1;

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

async function cleCopie(phrase: string, sel: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const matiere = await subtle().importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' }, matiere, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** La phrase est recevable : seize caractères au moins, deux saisies identiques. */
export function phraseCopieRecevable(phrase: string, confirmation: string): 'courte' | 'differente' | null {
  if (phrase.length < LONGUEUR_MIN_PHRASE_COPIE) return 'courte';
  if (phrase !== confirmation) return 'differente';
  return null;
}

/** Chiffre un objet (JSON, UTF-8) sous la phrase ; sel et vecteur d'initialisation sont tirés ici et rangés avec l'enveloppe. */
export async function chiffrerCopie(clair: unknown, phrase: string): Promise<Enveloppe> {
  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cle = await cleCopie(phrase, sel, ITERATIONS_PBKDF2);
  const chiffre = await subtle().encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(JSON.stringify(clair)));
  return { chiffre: versBase64(chiffre), iv: versBase64(iv), sel: versBase64(sel), iterations: ITERATIONS_PBKDF2, kdf: 'PBKDF2-SHA-256', algorithme: 'AES-256-GCM' };
}

/** Déchiffre la copie ; une phrase fausse lève `PhraseIncorrecte` (AES-GCM refuse l'étiquette) — c'est le seul échec attendu. */
export async function dechiffrerCopie<T>(enveloppe: Enveloppe, phrase: string): Promise<T> {
  const cle = await cleCopie(phrase, depuisBase64(enveloppe.sel), enveloppe.iterations);
  let clair: ArrayBuffer;
  try {
    clair = await subtle().decrypt({ name: 'AES-GCM', iv: depuisBase64(enveloppe.iv) }, cle, depuisBase64(enveloppe.chiffre));
  } catch {
    throw new PhraseIncorrecte();
  }
  return JSON.parse(new TextDecoder().decode(clair)) as T;
}

/** L'empreinte SHA-256 (hexadécimal) d'un fichier joint : de quoi le reconnaître dans la copie, sans le garder. */
export async function empreinteFichier(fichier: Blob): Promise<string> {
  return versHex(await subtle().digest('SHA-256', await fichier.arrayBuffer()));
}
