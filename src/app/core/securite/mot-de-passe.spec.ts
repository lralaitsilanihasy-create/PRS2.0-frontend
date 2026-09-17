import { LONGUEUR_MOT_DE_PASSE, genererMotDePasse } from './mot-de-passe';

/**
 * Le mot de passe provisoire tiré par l'Administrateur (lot 6 F4). Deux choses comptent : qu'il
 * PASSE la politique du serveur (`MotDePasseValide` : 8 à 72 caractères, au moins une lettre et un
 * chiffre) — un refus 400 après coup laisserait l'administrateur devant un compte non réinitialisé —
 * et qu'il soit réellement imprévisible.
 */
describe('genererMotDePasse', () => {
  const tirages = Array.from({ length: 200 }, () => genererMotDePasse());

  it('fait la longueur demandée, 16 par défaut', () => {
    expect(LONGUEUR_MOT_DE_PASSE).toBe(16);
    expect(tirages.every((m) => m.length === 16)).toBe(true);
    expect(genererMotDePasse(24).length).toBe(24);
  });

  it('passe la politique du serveur : au moins une lettre ET un chiffre, 8 à 72 caractères', () => {
    // La règle EXACTE du backend (`MotDePasseValide`) : @Size(8, 72) + ^(?=.*\p{L})(?=.*\p{N}).*$
    const politique = /^(?=.*\p{L})(?=.*\p{N}).{8,72}$/u;
    const fautifs = tirages.filter((m) => !politique.test(m));
    expect(fautifs).toEqual([]);
  });

  it('n’emploie aucun caractère qui se confond à la lecture — il sera dicté ou recopié', () => {
    // Ni 0/O, ni 1/l/I : un mot de passe provisoire se transmet de vive voix ou sur un papier.
    expect(tirages.join('')).not.toMatch(/[0O1lI]/);
    expect(tirages.join('')).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
  });

  it('les trois classes ne sont pas toujours en tête : le tirage est battu', () => {
    // Sans battage, les positions 0, 1 et 2 porteraient TOUJOURS minuscule, majuscule puis chiffre.
    expect(tirages.some((m) => !/^[a-z]/.test(m))).toBe(true);
    expect(tirages.some((m) => !/^.[A-Z]/.test(m))).toBe(true);
    expect(tirages.some((m) => !/^..[2-9]/.test(m))).toBe(true);
  });

  it('ne se répète pas : 200 tirages, 200 valeurs distinctes', () => {
    expect(new Set(tirages).size).toBe(tirages.length);
  });

  it('refuse une longueur plus faible que ce que le serveur accepte', () => {
    expect(() => genererMotDePasse(7)).toThrowError(/8 caractères/);
  });
});
