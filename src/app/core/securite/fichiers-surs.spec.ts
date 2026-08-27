import {
  TAILLE_MAX_MO,
  TYPES_PDF,
  blobSur,
  ouvrirBlobSur,
  telechargerBlob,
  urlBlobSure,
  validerFichier,
} from './fichiers-surs';

/**
 * Garde-fous issus de l'audit des 16-17/08. Une URL `blob:` hérite de l'origine de l'application :
 * un HTML ou un SVG restitué tel quel y exécuterait son script. `blobSur` force donc un type inerte,
 * et `validerFichier` double la garde serveur pour un retour immédiat. Les cas hostiles ci-dessous
 * sont la raison d'être du module — sans eux, la protection peut disparaître sans que rien n'alerte.
 */
describe('fichiers sûrs', () => {
  describe('blobSur', () => {
    it.each(['application/pdf', 'image/jpeg', 'image/png'])('laisse intact un type inoffensif : %s', (type) => {
      const blob = new Blob(['contenu'], { type });
      expect(blobSur(blob).type).toBe(type);
    });

    // ⚠️ Le cœur de la protection : ces types s'exécuteraient dans l'origine de l'application.
    it.each([
      'text/html',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/xml',
      'application/javascript',
    ])('force un type inerte pour un contenu exécutable : %s', (type) => {
      const blob = new Blob(['<script>alert(1)</script>'], { type });
      expect(blobSur(blob).type).toBe('application/pdf');
    });

    it('force aussi le type quand il est absent (blob sans type déclaré)', () => {
      expect(blobSur(new Blob(['x'])).type).toBe('application/pdf');
    });

    it('ne modifie pas le contenu, seulement l’étiquette de type', async () => {
      const blob = new Blob(['charge utile'], { type: 'text/html' });
      const sur = blobSur(blob);
      expect(await sur.text()).toBe('charge utile');
      expect(sur.size).toBe(blob.size);
    });
  });

  describe('urlBlobSure', () => {
    it('produit une URL d’objet à partir du blob assaini', () => {
      const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const url = urlBlobSure(new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' }));
      expect(url).toBe('blob:test');
      // Ce qui compte : le blob remis à createObjectURL n'est plus du SVG.
      expect((cree.mock.calls[0][0] as Blob).type).toBe('application/pdf');
      cree.mockRestore();
    });
  });

  /**
   * Le motif « créer une URL d'objet, la remettre au navigateur, la révoquer » était recopié à
   * l'identique dans six écrans (constat C-9 de l'audit du 27/08). Ces deux helpers le portent
   * désormais seuls — ce qui n'a d'intérêt que s'ils assainissent bien le blob au passage.
   */
  describe('telechargerBlob / ouvrirBlobSur', () => {
    const piegé = () => new Blob(['<script>alert(1)</script>'], { type: 'text/html' });

    it('télécharge sous le nom demandé, à partir du blob assaini', () => {
      const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const lien = document.createElement('a');
      const clic = vi.spyOn(lien, 'click').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(lien);

      telechargerBlob(piegé(), 'rapport-dossiers.pdf');

      expect((cree.mock.calls[0][0] as Blob).type).toBe('application/pdf');
      expect(lien.download).toBe('rapport-dossiers.pdf');
      expect(lien.href).toBe('blob:test');
      expect(clic).toHaveBeenCalledOnce();
      vi.restoreAllMocks();
    });

    it('ouvre un nouvel onglet sur le blob assaini', () => {
      const cree = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const ouvre = vi.spyOn(window, 'open').mockReturnValue(null);

      ouvrirBlobSur(piegé());

      expect((cree.mock.calls[0][0] as Blob).type).toBe('application/pdf');
      expect(ouvre).toHaveBeenCalledWith('blob:test', '_blank');
      vi.restoreAllMocks();
    });

    // Révoquer dans la foulée coupe le transfert (ERR_FAILED) : le différé fait partie du contrat.
    it('diffère la révocation de l’URL au lieu de la faire aussitôt', () => {
      vi.useFakeTimers();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revoque = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(window, 'open').mockReturnValue(null);

      ouvrirBlobSur(piegé());
      expect(revoque).not.toHaveBeenCalled();

      vi.advanceTimersByTime(60_000);
      expect(revoque).toHaveBeenCalledWith('blob:test');
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
  });

  describe('validerFichier', () => {
    const fichier = (type: string, octets = 1024) =>
      new File([new Uint8Array(octets)], 'piece', { type });

    it('accepte un fichier conforme', () => {
      expect(validerFichier(fichier('application/pdf'))).toBeNull();
    });

    it('refuse un type non autorisé', () => {
      expect(validerFichier(fichier('text/html'))).toMatch(/Format de fichier non accepté/);
    });

    it('adapte le message quand un seul type est admis', () => {
      expect(validerFichier(fichier('image/png'), TYPES_PDF)).toContain('PDF attendu');
    });

    it('refuse un fichier trop volumineux et annonce sa taille', () => {
      const trop = fichier('application/pdf', (TAILLE_MAX_MO + 1) * 1024 * 1024);
      expect(validerFichier(trop)).toMatch(/trop volumineux \(21\.0 Mo\).*maximum 20 Mo/);
    });

    it('accepte un fichier exactement à la limite', () => {
      expect(validerFichier(fichier('application/pdf', TAILLE_MAX_MO * 1024 * 1024))).toBeNull();
    });

    it('respecte un plafond spécifique — cas des images d’actualité (JPEG, 10 Mo)', () => {
      const jpeg = (mo: number) => fichier('image/jpeg', mo * 1024 * 1024);
      expect(validerFichier(jpeg(9), ['image/jpeg'], 10)).toBeNull();
      expect(validerFichier(jpeg(11), ['image/jpeg'], 10)).toMatch(/maximum 10 Mo/);
      expect(validerFichier(fichier('image/png'), ['image/jpeg'], 10)).toMatch(/Format de fichier non accepté/);
    });
  });
});
