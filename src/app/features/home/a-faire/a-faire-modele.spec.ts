import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from '../../../core/errors/api-error';
import { exempleAFairePresident, exempleAFairePrmp } from './a-faire-contrat.exemple';
import {
  compteursAffiches,
  delaiLigne,
  estAFaireIndisponible,
  faitsApercu,
  friseDossier,
  grouperTaches,
  noteCourte,
  phraseAccueil,
  prenomDe,
  referenceLigne,
} from './a-faire-modele';

const erreur = (status: number, fieldErrors?: Record<string, string>): ApiError => ({
  status,
  message: 'x',
  fieldErrors,
  raw: new HttpErrorResponse({ status }),
});

describe('Accueil « À faire » — règles pures', () => {
  const president = exempleAFairePresident();
  const prmp = exempleAFairePrmp();
  const [enRetard, bientot, visa, dansLesDelais, retrait] = president.taches;

  it("phrase d'accueil : actions et retards, ou dossiers côté PRMP", () => {
    expect(phraseAccueil(president.compteurs, 'PRESIDENT')).toBe('5 actions vous attendent, dont 1 en retard.');
    expect(phraseAccueil({ ...president.compteurs, enRetard: 0 }, 'MEMBRE')).toBe("5 actions vous attendent. Aucune n'est en retard.");
    expect(phraseAccueil({ ...president.compteurs, aFaire: 0 }, 'SECRETAIRE')).toBe('Aucune action ne vous attend.');
    expect(phraseAccueil(prmp.compteurs, 'PRMP')).toBe('2 dossiers attendent une action de votre part.');
    expect(prenomDe('RAVELOMANANA Mamy Hery')).toBe('Mamy');
    expect(prenomDe('ADMIN01')).toBe('ADMIN01');
  });

  it('compteurs : les trois classes chronométrées toujours, le reste seulement s’il existe', () => {
    expect(compteursAffiches(president.compteurs, 'PRESIDENT').map((c) => `${c.nombre} ${c.libelle}`)).toEqual([
      '1 en retard',
      '2 bientôt à échéance',
      '1 dans les délais',
      '1 sans délai',
    ]);
    expect(compteursAffiches(prmp.compteurs, 'PRMP').map((c) => `${c.nombre} ${c.libelle}`)).toEqual(['1 bloque le circuit', '1 hors délai CNM', '1 en cours à la CNM']);
  });

  it('délai lu dans la réponse, selon la classe servie', () => {
    expect(delaiLigne(enRetard)).toEqual({ genre: 'retard', texte: '1 h de retard', sousTexte: '9 h sur 8 h', pourcentage: 100 });
    expect(delaiLigne(bientot)).toEqual({ genre: 'bientot', texte: 'Reste 2 h', sousTexte: '6 h sur 8 h', pourcentage: 75 });
    expect(delaiLigne(dansLesDelais)).toMatchObject({ genre: 'ok', texte: 'Reste 7 h', pourcentage: 13 });
    expect(delaiLigne(retrait)).toEqual({ genre: 'sans', texte: 'Sans délai', sousTexte: 'Depuis le 12/09', pourcentage: 0 });
    const [brouillon, rectifier, suivi] = prmp.taches;
    expect(delaiLigne(rectifier)).toMatchObject({ genre: 'pause', texte: 'En pause · depuis le 12/09', sousTexte: 'Compteur suspendu' });
    expect(delaiLigne(brouillon)).toMatchObject({ genre: 'sans', texte: 'Hors délai CNM' });
    expect(delaiLigne(suivi)).toMatchObject({ genre: 'suivi', texte: 'Fin prévue le 16/09' });
  });

  it('référence mono, ou dépôt daté ; note courte tirée des faits', () => {
    expect(referenceLigne(enRetard)).toEqual({ texte: '00015/DGSR/DAO/2026', sansReference: false });
    const depot = { ...enRetard, dossier: { ...enRetard.dossier, refeDossier: null } };
    expect(referenceLigne(depot)).toEqual({ texte: 'Dépôt du 10/09 à 10:05', sansReference: true });
    expect(noteCourte(enRetard)).toBe('Numéroté le 11/09');
    expect(noteCourte(visa)).toBe('Favorable avec réserves · 3 observations');
    expect(noteCourte(retrait)).toBe("Motif : erreur sur l'exercice budgétaire");
    expect(noteCourte(prmp.taches[1])).toBe('2 observations maintenues par la CNM');
    expect(noteCourte(prmp.taches[2])).toBe('Étape : vérification');
  });

  describe('regroupement client', () => {
    it("« Par urgence » : sections par geste, la plus urgente d'abord, lignes dans l'ordre SERVI", () => {
      const groupes = grouperTaches(president.taches, 'urgence', president, 'PRESIDENT');
      expect(groupes.map((g) => [g.titre, g.lignes.length, g.sousTitre])).toEqual([
        ['À dispatcher', 3, 'Délai standard 8 h'],
        ['Projets de PV à viser', 1, 'Délai standard 16 h'],
        ['Demandes de retrait', 1, 'Sans délai standard'],
      ]);
      // Rangs 1, 2, 4 : l'ordre du serveur, pas celui des références (00015, 00014, 00016).
      expect(groupes[0].lignes.map((l) => l.reference)).toEqual(['00015/DGSR/DAO/2026', '00014/MTP/PPM/2026', '00016/FR/PPM/2026']);
    });

    it("« Par étape » suit l'ordre des sections servi ; « Par localité » regroupe sans perdre l'ordre", () => {
      const prmpUrgence = grouperTaches(prmp.taches, 'urgence', prmp, 'PRMP').map((g) => g.section);
      expect(prmpUrgence).toEqual(['BROUILLONS', 'A_RECTIFIER', 'EN_COURS_CNM']);
      const inverse = { ...prmp, sections: [...prmp.sections].reverse() };
      expect(grouperTaches(prmp.taches, 'etape', inverse, 'PRMP').map((g) => g.section)).toEqual(['EN_COURS_CNM', 'A_RECTIFIER', 'BROUILLONS']);
      const parLocalite = grouperTaches(president.taches, 'localite', president, 'PRESIDENT');
      expect(parLocalite.map((g) => [g.titre, g.lignes.map((l) => l.tache.rang)])).toEqual([['Antananarivo', [1, 2, 3, 4, 5]]]);
      expect(grouperTaches(prmp.taches, 'urgence', prmp, 'UGPM')[0].titre).toBe('Brouillons à compléter');
    });
  });

  it('frise : sept étapes datées, acteurs absents pour la PRMP, pause signalée', () => {
    const frise = friseDossier(visa);
    expect(frise.map((e) => e.etat)).toEqual(['faite', 'faite', 'faite', 'courante', 'a-venir', 'a-venir', 'a-venir']);
    expect(frise.slice(0, 4).map((e) => e.date)).toEqual(['04/09', '07/09', '11/09', 'en cours']);
    expect(frise[2].acteur).toBe('Naina Razafindrakoto');
    const friseRectif = friseDossier(prmp.taches[1]);
    expect(friseRectif.every((e) => e.acteur === null)).toBe(true);
    expect(friseRectif[5]).toMatchObject({ etat: 'pause', date: 'en pause' });
  });

  it("faits de l'aperçu : acteurs CNM chez le Président, rien d'interne chez la PRMP", () => {
    // Intl sépare les milliers par une espace fine insécable : comparée ici comme une espace.
    expect(faitsApercu(visa).map((f) => ({ ...f, valeur: f.valeur.replace(/\s/g, ' ') }))).toEqual([
      { libelle: 'Examiné par', valeur: 'Naina Razafindrakoto' },
      { libelle: 'Avis du Membre', valeur: 'Favorable avec réserves · 3 observations' },
      { libelle: 'Plan de passation', valeur: '12 lignes · 3 482 442 000 Ar' },
      { libelle: 'Fin de traitement prévue', valeur: '24/09/2026' },
    ]);
    const libellesPrmp = prmp.taches.flatMap((t) => faitsApercu(t).map((f) => f.libelle));
    expect(libellesPrmp).not.toContain('Examiné par');
    expect(libellesPrmp).not.toContain('Consigne');
  });

  it("endpoint indisponible : 404, 501, et 400 sur « id » (route inconnue du backend) — pas une panne", () => {
    expect(estAFaireIndisponible(erreur(404))).toBe(true);
    expect(estAFaireIndisponible(erreur(501))).toBe(true);
    expect(estAFaireIndisponible(erreur(400, { id: 'valeur numérique attendue.' }))).toBe(true);
    expect(estAFaireIndisponible(erreur(400, { delegations: 'booléen' }))).toBe(false);
    expect(estAFaireIndisponible(erreur(500))).toBe(false);
    expect(estAFaireIndisponible(new Error('x'))).toBe(false);
  });
});
