import { blocsMd, fragmentsMd } from './markdown';

/**
 * Ce module est une **barrière de sécurité** autant qu'un convertisseur : c'est lui qui garantit
 * qu'un contenu d'actualité, rédigé librement, ne peut jamais devenir du HTML exécutable. Les cas
 * hostiles ci-dessous valent autant que les cas nominaux.
 */
describe('markdown des actualités', () => {
  describe('fragments en ligne', () => {
    it('reconnaît gras, italique et code', () => {
      expect(fragmentsMd('un **gras** et un *italique* et du `code`')).toEqual([
        { type: 'texte', texte: 'un ' },
        { type: 'gras', texte: 'gras' },
        { type: 'texte', texte: ' et un ' },
        { type: 'italique', texte: 'italique' },
        { type: 'texte', texte: ' et du ' },
        { type: 'code', texte: 'code' },
      ]);
    });

    it('accepte l’italique en tirets bas', () => {
      expect(fragmentsMd('_souligné_')).toEqual([{ type: 'italique', texte: 'souligné' }]);
    });

    it('rend un lien http(s) cliquable', () => {
      expect(fragmentsMd('voir [le portail](https://marches.gov.mg)')).toEqual([
        { type: 'texte', texte: 'voir ' },
        { type: 'lien', texte: 'le portail', href: 'https://marches.gov.mg' },
      ]);
    });

    it('accepte mailto', () => {
      expect(fragmentsMd('[écrire](mailto:contact@cnm.mg)')).toEqual([
        { type: 'lien', texte: 'écrire', href: 'mailto:contact@cnm.mg' },
      ]);
    });

    // ⚠️ Sécurité : un protocole exécutable ne doit JAMAIS ressortir en ancre.
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ])('dégrade en texte le lien à protocole non sûr : %s', (href) => {
      const out = fragmentsMd(`[clic](${href})`);
      expect(out.every((f) => f.type !== 'lien')).toBe(true);
      expect(out.map((f) => f.texte).join('')).toContain('clic');
    });

    it('laisse le HTML brut à l’état de texte, sans jamais l’interpréter', () => {
      const out = fragmentsMd('<script>alert(1)</script> et <img src=x onerror=alert(1)>');
      expect(out).toEqual([{ type: 'texte', texte: '<script>alert(1)</script> et <img src=x onerror=alert(1)>' }]);
    });
  });

  describe('blocs', () => {
    it('reconnaît les trois niveaux de titre', () => {
      const blocs = blocsMd('# Un\n## Deux\n### Trois');
      expect(blocs.map((b) => (b.type === 'titre' ? b.niveau : null))).toEqual([1, 2, 3]);
    });

    it('regroupe les lignes contiguës en un seul paragraphe, séparé par une ligne vide', () => {
      const blocs = blocsMd('première ligne\nsuite de la phrase\n\nautre paragraphe');
      expect(blocs).toHaveLength(2);
      expect(blocs[0]).toEqual({ type: 'paragraphe', contenu: [{ type: 'texte', texte: 'première ligne suite de la phrase' }] });
    });

    it('distingue liste à puces et liste numérotée', () => {
      const blocs = blocsMd('- un\n- deux\n\n1. premier\n2. second');
      expect(blocs.map((b) => (b.type === 'liste' ? b.ordonnee : null))).toEqual([false, true]);
      expect(blocs[0].type === 'liste' && blocs[0].elements).toHaveLength(2);
    });

    it('ferme la liste en cours quand le type change, sans ligne vide', () => {
      const blocs = blocsMd('- puce\n1. numéro');
      expect(blocs).toHaveLength(2);
      expect(blocs.every((b) => b.type === 'liste')).toBe(true);
    });

    it('reconnaît citation et séparateur', () => {
      const blocs = blocsMd('> une citation\n\n---');
      expect(blocs[0].type).toBe('citation');
      expect(blocs[1].type).toBe('separateur');
    });

    it('applique le style en ligne dans les titres et les listes', () => {
      const blocs = blocsMd('# Titre **gras**\n- élément *net*');
      expect(blocs[0].type === 'titre' && blocs[0].contenu.some((f) => f.type === 'gras')).toBe(true);
      expect(blocs[1].type === 'liste' && blocs[1].elements[0].some((f) => f.type === 'italique')).toBe(true);
    });

    it('tolère les fins de ligne Windows', () => {
      expect(blocsMd('# Titre\r\n\r\ntexte')).toHaveLength(2);
    });

    it('ne produit aucun bloc pour un contenu vide ou absent', () => {
      expect(blocsMd('')).toEqual([]);
      expect(blocsMd('   \n\n  ')).toEqual([]);
      expect(blocsMd(undefined as unknown as string)).toEqual([]);
    });

    it('reste sur du texte quand la syntaxe est incomplète', () => {
      const blocs = blocsMd('**gras jamais fermé et [lien sans cible');
      expect(blocs).toHaveLength(1);
      expect(blocs[0].type).toBe('paragraphe');
    });
  });
});
