import { Chronometrage, DelaiStandard } from '../../../models';
import {
  EntreeParcours,
  ajouterHeuresOuvrees,
  construireParcours,
  delaiExamen,
  formatEcheance,
  lignesViseesParConsigne,
  numerosEnTexte,
  raisonValidationImpossible,
} from './examen-modele';

/** Entrée de parcours par défaut (étape à faire, accessible). */
const entree = (e: Partial<EntreeParcours> & Pick<EntreeParcours, 'cle'>): EntreeParcours => ({
  masquee: false,
  sansObjet: null,
  total: 1,
  faites: 0,
  nbObservations: 0,
  courante: false,
  accessible: true,
  ...e,
});

describe('Examen refondu — règles pures (lot 2)', () => {
  describe('construireParcours', () => {
    it('dit état, progression et observations de chaque étape', () => {
      const [fiche, lignes, agpm, pieces, dossier, synthese] = construireParcours([
        entree({ cle: 'fiche', faites: 1 }),
        entree({ cle: 'lignes', total: 14, faites: 5, nbObservations: 1, courante: true }),
        entree({ cle: 'agpm', total: 0, sansObjet: 'Sans objet pour ce plan' }),
        entree({ cle: 'pieces', total: 6 }),
        entree({ cle: 'dossier', faites: 1, nbObservations: 2 }),
        entree({ cle: 'synthese', accessible: false }),
      ]);
      expect(fiche).toMatchObject({ numero: 1, etat: 'terminee', resume: 'Terminé · RAS', progression: 100 });
      expect(lignes).toMatchObject({ libelle: 'Lignes du plan', etat: 'en-cours', resume: '5 sur 14 · 1 observation', progression: 36 });
      expect(agpm).toMatchObject({ etat: 'sans-objet', resume: 'Sans objet pour ce plan', progression: 0 });
      expect(pieces).toMatchObject({ etat: 'a-faire', resume: '0 sur 6' });
      expect(dossier).toMatchObject({ etat: 'terminee', resume: 'Terminé · 2 observations' });
      expect(synthese).toMatchObject({ numero: 6, etat: 'a-faire', resume: 'Après les contrôles' });
    });

    it('retire une étape masquée sans renuméroter les suivantes (dossier sans plan)', () => {
      const etapes = construireParcours([
        entree({ cle: 'fiche', masquee: true, total: 0 }),
        entree({ cle: 'lignes', masquee: true, total: 0 }),
        entree({ cle: 'agpm', masquee: true, total: 0 }),
        entree({ cle: 'pieces', total: 2, faites: 2 }),
        entree({ cle: 'dossier', courante: true }),
        entree({ cle: 'synthese', courante: false, accessible: true }),
      ]);
      expect(etapes.map((e) => [e.cle, e.numero])).toEqual([['pieces', 4], ['dossier', 5], ['synthese', 6]]);
      expect(etapes[1].resume).toBe('En cours');
      expect(etapes[2].resume).toBe('Prête');
    });
  });

  describe('raisonValidationImpossible', () => {
    it('nomme le premier point à renseigner', () => {
      expect(
        raisonValidationImpossible({
          verrouille: false,
          objet: 'la ligne 6',
          points: [
            { rang: 1, statut: 'RAS', observations: [] },
            { rang: 2, statut: null, observations: [] },
          ],
        }),
      ).toBe('Renseignez le point 2 pour valider la ligne 6.');
    });

    it("exige une correction renseignée pour un point « Observation », une observation écrite pour une pièce", () => {
      expect(
        raisonValidationImpossible({ verrouille: false, objet: 'la ligne 3', points: [{ rang: 1, statut: 'OBS', observations: [{ auLieuDe: ' ', lire: '' }] }] }),
      ).toBe("Complétez l'observation du point 1 (« Au lieu de » ou « Lire ») pour valider la ligne 3.");
      expect(raisonValidationImpossible({ verrouille: false, objet: 'la pièce 2', points: [], piece: { statut: 'OBS', observation: '' } })).toBe(
        "Rédigez l'observation pour valider la pièce 2.",
      );
      expect(raisonValidationImpossible({ verrouille: false, objet: 'la ligne 3', points: [{ rang: 1, statut: 'OBS', observations: [{ auLieuDe: 'Gré à gré', lire: '' }] }] })).toBeNull();
      expect(raisonValidationImpossible({ verrouille: true, objet: 'la ligne 3', points: [] })).toBe('Examen verrouillé : lecture seule.');
    });
  });

  describe('délai (chronométrage)', () => {
    it('ajoute des heures ouvrées sur la fenêtre 08:00-16:00 du lundi au vendredi', () => {
      // Vendredi 11/09/2026 14:00 + 8 h → lundi 14/09 14:00.
      expect(ajouterHeuresOuvrees(new Date(2026, 8, 11, 14, 0), 8)).toEqual(new Date(2026, 8, 14, 14, 0));
      // Samedi soir : rien ne court avant lundi 08:00.
      expect(ajouterHeuresOuvrees(new Date(2026, 8, 12, 22, 0), 1)).toEqual(new Date(2026, 8, 14, 9, 0));
      // Échéance pile à la fermeture : reste à 16:00.
      expect(ajouterHeuresOuvrees(new Date(2026, 8, 14, 8, 0), 8)).toEqual(new Date(2026, 8, 14, 16, 0));
    });

    const chrono = (dureeHeuresOuvrees: number, attentePrmp = false): Chronometrage => ({
      idDossier: 42,
      etapes: [{ etape: 'EXAMEN', occurrence: 1, entree: '2026-09-14T09:00:00', fin: null, dureeHeuresOuvrees, enCours: true }],
      dureeBruteHeuresOuvrees: 0,
      dureeNetteHeuresOuvrees: 0,
      attentePrmpHeuresOuvrees: 0,
      etapeCourante: 'EXAMEN',
      attentePrmp,
    });
    const delais: DelaiStandard[] = [{ etape: 'EXAMEN', delaiHeures: 16 }];

    it('« Reste N h · avant … », « bientôt » sous le seuil, puis retard', () => {
      const echeance = formatEcheance(new Date(2026, 8, 16, 9, 0));
      expect(delaiExamen(chrono(6), delais)).toEqual({ genre: 'ok', libelle: `Reste 10 h · avant ${echeance}` });
      expect(delaiExamen(chrono(11), delais)?.genre).toBe('bientot'); // 5 h ≤ ⌈35 % de 16⌉ = 6
      expect(delaiExamen(chrono(19), delais)).toEqual({ genre: 'retard', libelle: `En retard de 3 h · échéance ${echeance}` });
      expect(delaiExamen(chrono(3, true), delais)).toEqual({ genre: 'pause', libelle: 'En attente de la PRMP' });
      expect(delaiExamen(null, delais)).toBeNull();
    });
  });

  describe('consigne du dispatch', () => {
    it('reconnaît les lignes désignées, et seulement elles', () => {
      expect([...(lignesViseesParConsigne('Vérifier les modes dérogatoires des lignes 6 à 9') ?? [])]).toEqual([6, 7, 8, 9]);
      expect([...(lignesViseesParConsigne('Voir la ligne 3, puis lignes 5 et 7') ?? [])]).toEqual([3, 5, 7]);
      expect([...(lignesViseesParConsigne('Lignes 2-4 et ligne 12') ?? [])]).toEqual([2, 3, 4, 12]);
      expect([...(lignesViseesParConsigne('lignes 6 au 8') ?? [])]).toEqual([6, 7, 8]);
      expect(lignesViseesParConsigne('Contrôler la cohérence des montants')).toBeNull();
      expect(lignesViseesParConsigne(null)).toBeNull();
    });

    it('écrit des numéros de façon compacte', () => {
      expect(numerosEnTexte([9, 6, 7, 8])).toBe('6 à 9');
      expect(numerosEnTexte([6, 9])).toBe('6 et 9');
      expect(numerosEnTexte([3, 5, 9])).toBe('3, 5 et 9');
      expect(numerosEnTexte([4])).toBe('4');
    });
  });
});
