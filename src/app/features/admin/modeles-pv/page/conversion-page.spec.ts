import { NoeudPage } from '../../../../models';
import { cheminVersZone, depuisServeur, enveloppe, versServeur, zoneVide } from './conversion-page';

const p = (...content: NoeudPage[]): NoeudPage => ({ type: 'paragraph', content });
const t = (text: string): NoeudPage => ({ type: 'text', text });

describe('Page éditée — conversion serveur ↔ éditeur (21/10)', () => {
  it('un bloc dans un paragraphe devient un bloc en ligne, et redevient « bloc » à l’enregistrement', () => {
    const serveur: NoeudPage = { type: 'doc', content: [
      p(t('Commission '), { type: 'bloc', attrs: { condition: 'CENTRALE' }, content: [t('Centrale')] }),
      { type: 'bloc', attrs: { condition: 'DEFAVORABLE' }, content: [p(t('AVIS NON FAVORABLE'))] },
    ] };
    const editeur = depuisServeur(serveur);
    expect(editeur.content![0].content![1].type).toBe('blocEnLigne');
    expect(editeur.content![1].type).toBe('bloc');
    expect(versServeur(editeur)).toEqual(serveur);
  });

  it('retire les valeurs nulles de Tiptap ; l’image ne garde que ses attributs du schéma ; un style vide disparaît', () => {
    const editeur: NoeudPage = { type: 'doc', content: [
      { type: 'paragraph', attrs: { textAlign: null, retrait: null }, content: [
        { type: 'text', text: 'Gras', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontFamily: null, fontSize: null, color: null } }] },
        { type: 'variable', attrs: { code: 'PV.REFERENCE', format: null }, marks: [{ type: 'textStyle', attrs: { fontSize: '12pt', color: null } }] },
      ] },
      { type: 'image', attrs: { idImage: 3, largeur: 25, alignement: 'center', src: '/api/modeles-pv/images/3', alt: null, title: null } },
    ] };
    expect(versServeur(editeur)).toEqual({ type: 'doc', content: [
      { type: 'paragraph', content: [
        { type: 'text', text: 'Gras', marks: [{ type: 'bold' }] },
        { type: 'variable', attrs: { code: 'PV.REFERENCE' }, marks: [{ type: 'textStyle', attrs: { fontSize: '12pt' } }] },
      ] },
      { type: 'image', attrs: { idImage: 3, largeur: 25, alignement: 'center' } },
    ] });
  });

  it('une zone vide n’est pas envoyée ; l’en-tête « première page seulement » suit l’en-tête', () => {
    const vide: NoeudPage = { type: 'doc', content: [{ type: 'paragraph' }] };
    const corps: NoeudPage = { type: 'doc', content: [p(t('PV'))] };
    expect(zoneVide(vide)).toBe(true);
    expect(enveloppe({ format: 'A4' }, vide, corps, vide, true)).toEqual({ page: { format: 'A4' }, corps });
    expect(enveloppe(undefined, corps, corps, vide, true).enteteSurPremiereSeulement).toBe(true);
  });

  it('lit le chemin d’un point du rapport', () => {
    expect(cheminVersZone('corps/1/1')).toEqual({ zone: 'corps', rangs: [1, 1] });
    expect(cheminVersZone('ailleurs/1')).toBeNull();
    expect(cheminVersZone(null)).toBeNull();
  });
});
