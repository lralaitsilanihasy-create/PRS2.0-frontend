import { analyserReponse, segmenter } from './rendu-reponse';

/**
 * Mise en forme des réponses de l'assistant IA : un sous-ensemble de Markdown, des citations [n]
 * vérifiées, et jamais de HTML interprété (le texte vient d'un modèle — donnée non fiable).
 */
describe("Assistant IA — mise en forme d'une réponse", () => {
  const connus = new Set([1, 2, 3]);

  it('découpe paragraphes et listes à puces, en gardant les citations connues', () => {
    const texte = 'Trois conditions [1] :\n\n*   le marché initial [2] ;\n*   un tiers au plus.\n\nVoir aussi [3].';

    const blocs = analyserReponse(texte, connus);

    expect(blocs.map((b) => b.type)).toEqual(['paragraphe', 'liste', 'paragraphe']);
    expect(blocs[0]).toEqual({
      type: 'paragraphe',
      segments: [
        { type: 'texte', texte: 'Trois conditions ' },
        { type: 'citation', numero: 1 },
        { type: 'texte', texte: ' :' },
      ],
    });
    const liste = blocs[1];
    expect(liste.type === 'liste' && liste.ordonnee).toBe(false);
    expect(liste.type === 'liste' && liste.elements).toEqual([
      [{ type: 'texte', texte: 'le marché initial ' }, { type: 'citation', numero: 2 }, { type: 'texte', texte: ' ;' }],
      [{ type: 'texte', texte: 'un tiers au plus.' }],
    ]);
  });

  it('distingue une liste numérotée, et rattache une ligne indentée à l’élément qui la précède', () => {
    const blocs = analyserReponse('1. Premier point\n   qui continue\n2. Second point', connus);

    expect(blocs).toHaveLength(1);
    const liste = blocs[0];
    expect(liste.type === 'liste' && liste.ordonnee).toBe(true);
    expect(liste.type === 'liste' && liste.elements.map((e) => e.map((s) => ('texte' in s ? s.texte : '')).join(''))).toEqual([
      'Premier point qui continue',
      'Second point',
    ]);
  });

  it('rend le gras, et affiche un titre (interdit par la consigne) comme une ligne en gras', () => {
    expect(segmenter('Le seuil est de **20 %** au plus.', connus)).toEqual([
      { type: 'texte', texte: 'Le seuil est de ' },
      { type: 'gras', texte: '20 %' },
      { type: 'texte', texte: ' au plus.' },
    ]);
    expect(analyserReponse('## Conditions', connus)).toEqual([
      { type: 'paragraphe', segments: [{ type: 'gras', texte: 'Conditions' }] },
    ]);
  });

  it('laisse en texte simple une citation inventée (aucun extrait ne porte ce numéro)', () => {
    expect(segmenter('Nouvelles constructions [1][8].', connus)).toEqual([
      { type: 'texte', texte: 'Nouvelles constructions ' },
      { type: 'citation', numero: 1 },
      { type: 'texte', texte: '[8].' },
    ]);
  });

  it('ne produit jamais de balise : du HTML dans la réponse reste du texte à afficher tel quel', () => {
    const blocs = analyserReponse('<img src=x onerror=alert(1)> **gras** <script>x</script>', connus);

    expect(blocs).toEqual([
      {
        type: 'paragraphe',
        segments: [
          { type: 'texte', texte: '<img src=x onerror=alert(1)> ' },
          { type: 'gras', texte: 'gras' },
          { type: 'texte', texte: ' <script>x</script>' },
        ],
      },
    ]);
  });

  it('tolère une réponse partielle, en cours de génération (gras non refermé)', () => {
    expect(analyserReponse('Le délai est de **30 jo', connus)).toEqual([
      { type: 'paragraphe', segments: [{ type: 'texte', texte: 'Le délai est de **30 jo' }] },
    ]);
    expect(analyserReponse('', connus)).toEqual([]);
  });
});
