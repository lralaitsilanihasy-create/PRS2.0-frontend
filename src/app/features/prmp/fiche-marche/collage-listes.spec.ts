import { lireMateriel, lirePersonnel, lirePieces } from './collage-listes';

// Les textes réels du DAO du MEN (DPAO 6.2 et 6.3, tels que le jeu de recette les a recopiés) et une ligne de tableau du
// DAO routier du MTP, copiée cellule par cellule.
const MEN_MATERIEL =
  "Un (01) bétonnière de 350 litres minimum ; un (01) camion ou camionnette d'une capacité d'au moins 2,5 tonnes ; une (01) voiture de liaison de type 4x4 ; un (01) pervibrateur ; un groupe électrogène de 3 KVA au moins — en propriété (carte grise, facture) ou en location (lettre d'engagement de location)";
const MEN_PERSONNEL =
  "Un (01) conducteur de travaux ayant un diplôme d'ingénieur en BTP ou équivalent (génie civil, génie industriel, génie rural, architecture), au moins trois (03) ans d'expérience dans la réalisation de travaux de BTP ; un (01) chef de chantier ayant un diplôme de technicien supérieur en BTP ou équivalent, au moins trois (03) ans d'expérience — chacun appuyé d'un CV avec photo et d'un diplôme certifié";
const MEN_PIECES =
  "Copie certifiée conforme à l'original de la Carte d'immatriculation fiscale de l'année 2026 datée de moins de trois (03) mois\nCopie certifiée conforme à l'original de la carte statistique datée de moins de deux (03) mois\nUn certificat de non faillite daté de moins de 03 mois (original)\nUn extrait du Registre de Commerce daté de moins de trois (03) mois (original)";
const MEN_PIECES_EN_LIGNE =
  "1° Copie certifiée conforme à l'original de la Carte d'immatriculation fiscale de l'année en 2026 datée de moins de trois (03) mois - Copie certifiée conforme à l'original carte statistique datée de moins de deux (03) mois - Un certificat de non faillite daté de moins de 03 mois (Originale). - un extrait du Registre de Commerce datée de moins de trois (03) mois (Originale).";

describe('Coller une liste — matériel', () => {
  it('le MEN : cinq engins, « Un (01) » → 1, la note « — en propriété… » mise à part', () => {
    const { entrees, note } = lireMateriel(MEN_MATERIEL);
    expect(entrees.map((m) => [m.designation, m.nombre, m.minimumEnPropre])).toEqual([
      ['Bétonnière de 350 litres minimum', 1, null],
      ["Camion ou camionnette d'une capacité d'au moins 2,5 tonnes", 1, null],
      ['Voiture de liaison de type 4x4', 1, null],
      ['Pervibrateur', 1, null],
      ['Groupe électrogène de 3 KVA au moins', 1, null],
    ]);
    expect(note).toBe("en propriété (carte grise, facture) ou en location (lettre d'engagement de location)");
  });

  it('le MTP, lignes de tableau : désignation, nombre, statut ; « ≥ » sépare la caractéristique', () => {
    const { entrees } = lireMateriel('Camions bennes ≥ 10 000 kg\t6\tau moins 4 en propre\nNiveleuse\t1\ten propre\nBétonnière ≥ 500 l\t2\ten propre');
    expect(entrees.map((m) => [m.designation, m.caracteristique, m.nombre, m.minimumEnPropre])).toEqual([
      ['Camions bennes', '≥ 10 000 kg', 6, 4],
      ['Niveleuse', null, 1, 1],
      ['Bétonnière', '≥ 500 l', 2, 2],
    ]);
  });
});

describe('Coller une liste — personnel', () => {
  it('le MEN : deux postes, diplôme, « trois (03) ans », domaine ; la note donne les justificatifs de chacun', () => {
    const { entrees } = lirePersonnel(MEN_PERSONNEL);
    expect(entrees.map((p) => [p.poste, p.nombre, p.experienceAnnees, p.domaineExperience, p.justificatifs])).toEqual([
      ['Conducteur de travaux', 1, 3, 'travaux de BTP', 'CV avec photo et diplôme certifié'],
      ['Chef de chantier', 1, 3, null, 'CV avec photo et diplôme certifié'],
    ]);
    expect(entrees[0].diplome).toBe('Ingénieur en BTP ou équivalent (génie civil, génie industriel, génie rural, architecture)');
    expect(entrees[1].diplome).toBe('Technicien supérieur en BTP ou équivalent');
  });
});

describe('Coller une liste — pièces', () => {
  const attendu = [
    ['Carte d’immatriculation fiscale de l’année 2026', 'copie certifiée conforme à l’original', 3],
    ['Carte statistique', 'copie certifiée conforme à l’original', 3],
    ['Certificat de non faillite', 'original', 3],
    ['Extrait du Registre de Commerce', 'original', 3],
  ];
  const sansApostropheCourbe = (s: string | null | undefined) => (s ?? '').replace(/[’']/g, '’');

  it('le MEN, une pièce par ligne : forme, ancienneté (« deux (03) mois » vaut 3), libellé nettoyé', () => {
    const { entrees } = lirePieces(MEN_PIECES, 'ADMINISTRATIVE');
    expect(entrees.map((p) => [sansApostropheCourbe(p.libelle), p.forme, p.ancienneteMaxMois])).toEqual(attendu);
    expect(entrees.every((p) => p.rubrique === 'ADMINISTRATIVE')).toBe(true);
  });

  it('le MEN tel que son DPAO l’imprime : « 1° … - … - … », « (Originale). »', () => {
    const { entrees } = lirePieces(MEN_PIECES_EN_LIGNE, 'ADMINISTRATIVE');
    expect(entrees.map((p) => p.ancienneteMaxMois)).toEqual([3, 3, 3, 3]);
    expect(entrees.map((p) => p.forme)).toEqual(['copie certifiée conforme à l’original', 'copie certifiée conforme à l’original', 'original', 'original']);
    expect(sansApostropheCourbe(entrees[1].libelle)).toBe('Carte statistique');
  });

  it('le 2463 : « Photocopie certifiée conforme à l’original » est une forme entière, jamais « Photo » + « copie… »', () => {
    const { entrees } = lirePieces(
      "Photocopie certifiée conforme à l'original de la Carte d'Immatriculation Fiscale 2026 ou 2025 validée, datée de moins de 3 mois ; carte statistique, photocopie certifiée conforme à l'original, datée de moins de 3 mois ; certificat de non faillite daté de moins de 3 mois.",
      'ADMINISTRATIVE',
    );
    expect(entrees.map((p) => [sansApostropheCourbe(p.libelle), p.forme, p.ancienneteMaxMois])).toEqual([
      ['Carte d’Immatriculation Fiscale 2026 ou 2025 validée', 'photocopie certifiée conforme à l’original', 3],
      ['Carte statistique', 'photocopie certifiée conforme à l’original', 3],
      ['Certificat de non faillite', null, 3],
    ]);
  });

  it('numéros du MTP, rubrique choisie par la PRMP', () => {
    const { entrees } = lirePieces('05 : Quittance ARMP pour l’achat du dossier\n8-a : Planning général', 'OFFRE');
    expect(entrees.map((p) => [p.numero, p.libelle, p.rubrique])).toEqual([
      ['05', 'Quittance ARMP pour l’achat du dossier', 'OFFRE'],
      ['8-a', 'Planning général', 'OFFRE'],
    ]);
  });
});
