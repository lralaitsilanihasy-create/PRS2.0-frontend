import { grouperParSerie, libelleBordereauPropose, lireCollage, lireNombre, numerosEnDouble, serieDuNumero } from './dqe';

// Extraits des deux DQE réels (fiches des faits du MEN et du MTP), tels qu'Excel les copie : tabulations, retours.
const MTP = [
  'N°\tDésignation\tUnité\tQuantité\tPrix unitaire\tMontant',
  'SERIE 000 : INSTALLATION',
  '001\tInstallation et repli de chantier\tfft\t1\t\t',
  '500\tOUVRAGES\t\t\t\t',
  '510\tDémolition maçonnerie\tm3\t55,20\t\t',
  '520\tDéblai pour fouille\tm³\t2 054,50\t\t',
  '545\tAcier pour armature\tkg\t48 240,00\t\t',
  '\tSous-total série 500\t\t\t\t',
  '600\tCHAUSSEES',
  '620\tRemblai d’emprunt\tm³\t1 520,00',
  'TOTAL HT\t\t\t\t\t',
].join('\r\n');

const MEN = ['0.1\tInstallation de chantier\tfft\t1', '1.1\tDébroussaillage et décapage des terres végétales\tm²\t332,18', '2.4\tArmatures (infrastructure)\tkg\t1.516,44'].join('\n');

describe('DQE des travaux — lecture d’un collage de tableur', () => {
  it('lit les nombres à la française comme à l’anglaise, et refuse le reste', () => {
    expect(lireNombre('2 054,50')).toBe(2054.5);
    expect(lireNombre('48 240,00')).toBe(48240);
    expect(lireNombre('1.516,44')).toBe(1516.44);
    expect(lireNombre('2054.5')).toBe(2054.5);
    expect(lireNombre('1')).toBe(1);
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('environ 3')).toBeNull();
  });

  it('DQE du MTP : intertitres de série (cellule seule ou n° sans unité), articles, en-tête et totaux écartés', () => {
    const { articles, ecartees } = lireCollage(MTP);
    expect(articles.map((a) => [a.numeroPrix, a.serie, a.unite, a.quantite])).toEqual([
      ['001', '000', 'fft', 1],
      ['510', '500', 'm³', 55.2],
      ['520', '500', 'm³', 2054.5],
      ['545', '500', 'kg', 48240],
      ['620', '600', 'm³', 1520],
    ]);
    expect(articles[0].serieLibelle).toBe('INSTALLATION');
    expect(articles[1].serieLibelle).toBe('OUVRAGES');
    expect(articles[1].libelleBordereau).toBe('Le mètre cube');
    expect(articles[0].libelleBordereau).toBe('Le forfait');
    expect(ecartees.map((e) => e.raison)).toEqual(['en-tête de colonnes', 'ligne de total', 'ligne de total']);
  });

  it('DQE du MEN : sans intertitre, la série vient du n° de prix pointé', () => {
    const { articles, ecartees } = lireCollage(MEN);
    expect(articles.map((a) => [a.numeroPrix, a.serie, a.quantite])).toEqual([
      ['0.1', '0', 1],
      ['1.1', '1', 332.18],
      ['2.4', '2', 1516.44],
    ]);
    expect(articles[1].unite).toBe('m²');
    expect(ecartees).toEqual([]);
  });

  it('une quantité illisible écarte la ligne, et le dit — jamais une quantité devinée', () => {
    const { articles, ecartees } = lireCollage('530\tBéton\tm³\tà définir');
    expect(articles).toEqual([]);
    expect(ecartees[0]).toEqual({ rang: 1, texte: '530 · Béton · m³ · à définir', raison: 'quantité illisible (« à définir »)' });
  });

  it('libellé du bordereau proposé d’après l’unité ; rien pour une unité inconnue', () => {
    expect(libelleBordereauPropose('m2')).toBe('Le mètre carré');
    expect(libelleBordereauPropose('U')).toBe("L'unité");
    expect(libelleBordereauPropose('ml')).toBe('Le mètre linéaire');
    expect(libelleBordereauPropose('voyage')).toBeNull();
    expect(serieDuNumero('5.10')).toBe('5');
    expect(serieDuNumero('529')).toBeNull();
  });
});

describe('DQE des travaux — séries et doublons', () => {
  it('regroupe dans l’ordre de première apparition, libellé = le premier non vide', () => {
    const g = grouperParSerie([
      { serie: '500', serieLibelle: null },
      { serie: '000', serieLibelle: 'Installation' },
      { serie: '500', serieLibelle: 'Ouvrages' },
      { serie: null, serieLibelle: null },
    ]);
    expect(g.map((s) => [s.code, s.libelle, s.articles.length])).toEqual([
      ['500', 'Ouvrages', 2],
      ['000', 'Installation', 1],
      [null, null, 1],
    ]);
  });

  it('signale les n° de prix répétés dans le lot', () => {
    expect([...numerosEnDouble([{ numeroPrix: '529' }, { numeroPrix: ' 529' }, { numeroPrix: '530' }, { numeroPrix: null }])]).toEqual(['529']);
  });
});
