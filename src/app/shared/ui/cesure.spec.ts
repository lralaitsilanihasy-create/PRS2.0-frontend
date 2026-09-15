import { CESURE, cesurerMot, decouperTexte, pointsDeCesure } from './cesure';

/** Mot césuré, césures conditionnelles rendues visibles (« Four-ni-tures »). */
const vu = (mot: string): string => cesurerMot(mot).split(CESURE).join('-');

describe('Césure syllabique des documents officiels', () => {
  it('coupe les libellés réalistes du plan de passation à une syllabe', () => {
    expect(vu('Fournitures')).toBe('Four-ni-tures');
    expect(vu('Prestations')).toBe('Pres-ta-tions');
    expect(vu('intellectuelles')).toBe('in-tel-lec-tuelles');
    expect(vu('Consultation')).toBe('Con-sul-ta-tion');
    expect(vu('ouverte')).toBe('ou-verte');
    expect(vu("d'Offres")).toBe("d'Offres");
    expect(vu('Travaux')).toBe('Tra-vaux');
  });

  it('coupe les intitulés des colonnes étroites, COMPTE compris', () => {
    expect(vu('FINANCEMENT')).toBe('FI-NAN-CE-MENT');
    expect(vu('PREVISIONNELLE')).toBe('PRE-VI-SION-NELLE');
    expect(vu("D'ATTRIBUTION")).toBe("D'AT-TRI-BU-TION");
    expect(vu('BENEFICIAIRE')).toBe('BE-NE-FI-CIAIRE');
    expect(vu('COMPTE')).toBe('COMP-TE');
  });

  it('respecte les groupes soudés, les voyelles et les minima de part et d’autre', () => {
    expect(vu('construction')).toBe('cons-truc-tion'); // tr soudé, s part à gauche
    expect(vu('technique')).toBe('tech-nique'); // ch soudé, qu soudé, finale muette gardée
    expect(vu('Acquisition')).toBe('Ac-qui-si-tion');
    expect(vu('examen')).toBe('exa-men'); // pas de coupure autour d'un x entre voyelles
    expect(vu('INITIAL')).toBe('INI-TIAL'); // au moins 2 lettres avant
    expect(vu('Prévu')).toBe('Prévu'); // au moins 3 lettres après
    expect(pointsDeCesure('Fournitures')).toEqual([4, 6]); // jamais « fournitu-res »
  });

  it('laisse intacts chiffres, codes et montants', () => {
    expect(cesurerMot('00-21-0-J00')).toBe('00-21-0-J00');
    expect(cesurerMot('1 590 000 000,00')).toBe('1 590 000 000,00');
    expect(cesurerMot('RPI')).toBe('RPI');
  });

  it('découpe un texte en lignes (retours de la saisie) puis en mots', () => {
    const lignes = decouperTexte('Travaux  de voirie\nLot 2');
    expect(lignes.map((l) => l.map((m) => m.split(CESURE).join('-')))).toEqual([['Tra-vaux', 'de', 'voi-rie'], ['Lot', '2']]);
    expect(decouperTexte(null)).toEqual([[]]);
    expect(decouperTexte('Travaux  de voirie\nLot 2')).toBe(lignes); // mémoïsé
  });
});
