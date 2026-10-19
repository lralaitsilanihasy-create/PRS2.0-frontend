import { PhraseIncorrecte } from './cles-detenteur';
import { LONGUEUR_MIN_PHRASE_COPIE, chiffrerCopie, dechiffrerCopie, empreinteFichier, phraseCopieRecevable } from './copie-offre';

describe('Copie chiffrée de l’offre (19/10, V136)', () => {
  const phrase = 'quatre mots qui se retiennent bien';

  it('chiffre puis déchiffre un récapitulatif à l’identique ; l’enveloppe a la forme de celle des clés', async () => {
    const clair = { v: 1, bordereau: [{ ordre: 1, prix: 17900 }], note: 'é, ’, —' };
    const env = await chiffrerCopie(clair, phrase);
    expect(env).toMatchObject({ kdf: 'PBKDF2-SHA-256', algorithme: 'AES-256-GCM', iterations: 600_000 });
    expect(env.chiffre).not.toContain('17900');
    expect(await dechiffrerCopie(env, phrase)).toEqual(clair);
  });

  it('une phrase fausse échoue sur le poste, par PhraseIncorrecte', async () => {
    const env = await chiffrerCopie({ a: 1 }, phrase);
    await expect(dechiffrerCopie(env, 'quatre mots qui se retiennent mal')).rejects.toBeInstanceOf(PhraseIncorrecte);
  });

  it('deux chiffrements du même clair diffèrent (sel et vecteur tirés à chaque fois)', async () => {
    const a = await chiffrerCopie({ a: 1 }, phrase);
    const b = await chiffrerCopie({ a: 1 }, phrase);
    expect(a.chiffre).not.toBe(b.chiffre);
    expect(a.sel).not.toBe(b.sel);
  });

  it('la phrase : seize caractères au moins, identique deux fois', () => {
    expect(LONGUEUR_MIN_PHRASE_COPIE).toBe(16);
    expect(phraseCopieRecevable('trop courte', 'trop courte')).toBe('courte');
    expect(phraseCopieRecevable(phrase, phrase + ' ')).toBe('differente');
    expect(phraseCopieRecevable(phrase, phrase)).toBeNull();
  });

  it('l’empreinte d’un fichier est son SHA-256 en hexadécimal', async () => {
    expect(await empreinteFichier(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
