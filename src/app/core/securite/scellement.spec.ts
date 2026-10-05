import { ClesPubliques } from '../../models/cao.model';
import { dechiffrer, depuisBase64, exporterClePublique, genererPaire } from './cles-detenteur';
import { TAILLE_MORCEAU, construireContenu, desceller, lireContenu, sceller, typesDesFormats } from './scellement';

/**
 * Lot 3 (ADR-0013 §1, §4) — ce qui se teste, c'est le trajet complet d'une offre : l'archive, le scellement pour trois
 * détenteurs avec un seuil de deux, puis — comme le fera le lot 4 — deux détenteurs déchiffrent leur part, la clé se
 * reconstitue, le contenu se relit à l'identique. Et l'inverse : une part seule ne suffit pas, un morceau altéré est refusé.
 */
function assurerWebCrypto(): void {
  if (globalThis.crypto?.subtle) return;
  const noeud = (globalThis as { process?: { getBuiltinModule?: (n: string) => { webcrypto: Crypto } } }).process;
  const webcrypto = noeud?.getBuiltinModule?.('node:crypto')?.webcrypto;
  if (!webcrypto) throw new Error('Aucun WebCrypto disponible pour le test.');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

async function troisDetenteurs(): Promise<{ cles: ClesPubliques; privees: CryptoKey[] }> {
  const privees: CryptoKey[] = [];
  const detenteurs: ClesPubliques['detenteurs'] = [];
  for (const role of ['MEMBRE', 'MEMBRE', 'SECOURS'] as const) {
    const paire = await genererPaire();
    const { clePublique, empreinte } = await exporterClePublique(paire.publicKey);
    detenteurs.push({ role, clePublique, empreinte });
    privees.push(paire.privateKey);
  }
  return { cles: { idDmc: 34, quorum: 2, n: 3, algorithmes: [], dateCloture: null, detenteurs }, privees };
}

describe('Scellement d’une offre (ADR-0013, lot 3)', () => {
  beforeAll(assurerWebCrypto);

  it('l’archive du contenu porte le manifeste et chaque pièce avec son empreinte', async () => {
    const fichier = new File([new Uint8Array([37, 80, 68, 70, 1, 2, 3])], 'acte engagement.pdf', { type: 'application/pdf' });
    const { contenu, manifeste } = await construireContenu(
      { idDmc: 34, lot: 1, entreprise: { nif: '1234567890', raisonSociale: 'SARL X' }, groupement: null, acteEngagement: { montantHt: 100, montantTtc: 120, monnaie: 'MGA', delai: 6, delaiUnite: 'MOIS', validiteJours: 90, rabais: null } },
      [{ code: 'AE', fichier }],
      null,
      '2026-10-04T18:00:00',
    );
    const relu = lireContenu(contenu);
    expect(relu.manifeste).toEqual(manifeste);
    expect(manifeste.pieces[0].nomFichier).toBe('AE-acte engagement.pdf');
    expect(manifeste.pieces[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.from(relu.fichiers['AE-acte engagement.pdf'])).toEqual([37, 80, 68, 70, 1, 2, 3]);
  });

  it('format 2 (V70) : la garantie porte son code, son fichier, son montant et son émetteur', async () => {
    const ae = new File([new Uint8Array([37, 80, 68, 70])], 'ae.pdf', { type: 'application/pdf' });
    const gar = new File([new Uint8Array([37, 80, 68, 70, 9])], 'caution.pdf', { type: 'application/pdf' });
    const { manifeste } = await construireContenu(
      { idDmc: 40, lot: 2, entreprise: { nif: '1234567890', raisonSociale: 'SARL X' }, groupement: null, acteEngagement: { montantHt: 100, montantTtc: 120, monnaie: 'MGA', delai: 6, delaiUnite: 'MOIS', validiteJours: 90, rabais: null } },
      [{ code: 'AE', fichier: ae }, { code: 'GARANTIE', fichier: gar }],
      { code: 'GARANTIE', codeVerification: 'GAR-1', montant: 1600000, emetteur: 'Banque de recette' },
      '2026-10-04T22:00:00',
    );
    expect(manifeste.version).toBe(2);
    expect(manifeste.garantie).toEqual({ codeVerification: 'GAR-1', nomFichier: 'GARANTIE-caution.pdf', montant: 1600000, monnaie: 'MGA', emetteur: 'Banque de recette' });
  });

  it('sceller puis desceller avec deux parts sur trois : le contenu revient à l’identique, sur plusieurs morceaux', async () => {
    const { cles, privees } = await troisDetenteurs();
    // Un peu plus d'un morceau : deux morceaux, le second court.
    const contenu = new Uint8Array(TAILLE_MORCEAU + 1000);
    for (let i = 0; i < contenu.length; i += 65536) globalThis.crypto.getRandomValues(contenu.subarray(i, Math.min(contenu.length, i + 65536)));
    const s = await sceller(contenu, cles, 34, 1);
    const enTete = JSON.parse(s.enTete);
    expect(enTete.nombreMorceaux).toBe(2);
    expect(enTete.parts.map((p: { empreinte: string }) => p.empreinte)).toEqual(cles.detenteurs.map((d) => d.empreinte));
    expect(s.morceaux[0].length).toBe(12 + TAILLE_MORCEAU + 16);
    expect(s.empreinte).toMatch(/^[0-9a-f]{64}$/);

    // Les détenteurs 1 et 3 (un membre et la part de secours) déchiffrent leur part.
    const partsClaires = [0, 2].map(async (i) => depuisBase64(await dechiffrer(privees[i], enTete.parts[i].part)));
    const clair = await desceller(s.enTete, s.morceaux, await Promise.all(partsClaires));
    expect(clair.length).toBe(contenu.length);
    expect(clair.subarray(0, 64)).toEqual(contenu.subarray(0, 64));
    expect(clair.subarray(contenu.length - 64)).toEqual(contenu.subarray(contenu.length - 64));
  }, 60_000);

  it('une part seule ne rend pas la clé, et un morceau altéré ou permuté est refusé', async () => {
    const { cles, privees } = await troisDetenteurs();
    const contenu = globalThis.crypto.getRandomValues(new Uint8Array(5000));
    const s = await sceller(contenu, cles, 34, null);
    const enTete = JSON.parse(s.enTete);
    const part0 = depuisBase64(await dechiffrer(privees[0], enTete.parts[0].part));
    const part1 = depuisBase64(await dechiffrer(privees[1], enTete.parts[1].part));
    await expect(desceller(s.enTete, s.morceaux, [part0])).rejects.toBeTruthy();

    const altere = new Uint8Array(s.morceaux[0]);
    altere[40] ^= 1;
    await expect(desceller(s.enTete, [altere], [part0, part1])).rejects.toBeTruthy();
    // Un en-tête modifié (même d'un octet) change les données authentifiées : le morceau ne se déchiffre plus.
    await expect(desceller(s.enTete.replace('"lot":null', '"lot":1'), s.morceaux, [part0, part1])).rejects.toBeTruthy();
  }, 60_000);

  it('les formats de la fiche deviennent des types MIME', () => {
    expect(typesDesFormats(['PDF', 'PDF/A'])).toEqual(['application/pdf']);
    expect(typesDesFormats(['ZIP'])).toContain('application/zip');
    expect(typesDesFormats(null)).toEqual(['application/pdf']);
  });
});
