import {
  LONGUEUR_MIN_PHRASE,
  PhraseIncorrecte,
  chiffrerPour,
  dechiffrer,
  depuisBase64,
  desenvelopper,
  empreinteDe,
  envelopper,
  exporterClePublique,
  fichierCopie,
  formaterEmpreinte,
  genererPaire,
  genererPhrase,
  lireCopie,
  versBase64,
} from './cles-detenteur';

/**
 * Lot 2b (ADR-0013) — le module ne fait que des appels WebCrypto ; ce qui se teste, c'est l'aller-retour complet qu'un
 * détenteur vivra : générer, exporter, envelopper sous sa phrase, déverrouiller, déchiffrer un défi chiffré pour sa clé
 * publique — et qu'une mauvaise phrase est refusée, sans jamais rendre une clé.
 *
 * L'environnement de test (jsdom) n'offre pas toujours `crypto.subtle` : on lui donne alors celui de Node, sans rien
 * importer qu'un empaqueteur devrait résoudre (`process.getBuiltinModule`, Node ≥ 22).
 */
function assurerWebCrypto(): void {
  if (globalThis.crypto?.subtle) return;
  const noeud = (globalThis as { process?: { getBuiltinModule?: (n: string) => { webcrypto: Crypto } } }).process;
  const webcrypto = noeud?.getBuiltinModule?.('node:crypto')?.webcrypto;
  if (!webcrypto) throw new Error('Aucun WebCrypto disponible pour le test.');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

describe('Clés du détenteur (WebCrypto, ADR-0013)', () => {
  beforeAll(assurerWebCrypto);

  it('encodages : base64 et hexadécimal font l’aller-retour, l’empreinte se formate par quatre', () => {
    const octets = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(depuisBase64(versBase64(octets))).toEqual(octets);
    expect(formaterEmpreinte('a1b2c3d4e5f6')).toBe('a1b2 c3d4 e5f6');
    expect(formaterEmpreinte(null)).toBe('');
  });

  it('la phrase générée : sept mots, vingt caractères au moins, deux tirages différents', () => {
    const a = genererPhrase();
    const b = genererPhrase();
    expect(a.split(' ').length).toBe(7);
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a.length).toBeGreaterThanOrEqual(LONGUEUR_MIN_PHRASE);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z]+( [a-z]+){6}$/);
  });

  it('générer, exporter, envelopper, déverrouiller, déchiffrer un défi : l’aller-retour complet du détenteur', async () => {
    const paire = await genererPaire();
    const { clePublique, empreinte } = await exporterClePublique(paire.publicKey);
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/);
    // L'empreinte recalculée depuis la SPKI servie est la même : c'est ce que le membre compare à la liste publiée.
    expect(await empreinteDe(clePublique)).toBe(empreinte);

    const phrase = 'quatre mots suffisent ici';
    const enveloppe = await envelopper(paire.privateKey, phrase);
    expect(enveloppe.iterations).toBe(600_000);
    expect(enveloppe.kdf).toBe('PBKDF2-SHA-256');
    expect(depuisBase64(enveloppe.iv).length).toBe(12);
    expect(depuisBase64(enveloppe.sel).length).toBe(16);

    // Le défi du serveur : 32 octets chiffrés pour la clé publique, rendus en clair par la clé déverrouillée.
    const defi = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const chiffre = await chiffrerPour(clePublique, defi);
    const privee = await desenvelopper(enveloppe, phrase);
    expect(privee.extractable).toBe(false);
    expect(depuisBase64(await dechiffrer(privee, chiffre))).toEqual(defi);
  }, 30_000);

  it('une mauvaise phrase est refusée nommément, sans rendre de clé', async () => {
    const paire = await genererPaire();
    const enveloppe = await envelopper(paire.privateKey, 'la bonne phrase secrete');
    await expect(desenvelopper(enveloppe, 'la mauvaise phrase secrete')).rejects.toBeInstanceOf(PhraseIncorrecte);
  }, 30_000);

  it('la copie hors ligne se relit, et un fichier étranger est rejeté', async () => {
    const enveloppe = { chiffre: 'AA==', iv: 'AAAAAAAAAAAAAAAA', sel: 'AAAAAAAAAAAAAAAAAAAAAA==', iterations: 600_000, kdf: 'PBKDF2-SHA-256' as const, algorithme: 'AES-256-GCM' as const };
    const texte = await fichierCopie({ idDmc: 34, role: 'MEMBRE', empreinte: 'ab'.repeat(32), enveloppe }).text();
    const copie = lireCopie(texte);
    expect(copie?.idDmc).toBe(34);
    expect(copie?.enveloppe.iterations).toBe(600_000);
    expect(lireCopie('{"bonjour": 1}')).toBeNull();
    expect(lireCopie('pas du json')).toBeNull();
  });
});
