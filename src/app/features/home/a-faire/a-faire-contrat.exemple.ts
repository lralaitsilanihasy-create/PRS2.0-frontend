import { AFaire, AFaireDelai, AFaireDossier, AFaireFaits, AFaireRefs, AFaireTache } from '../../../models';

/**
 * Réponses d'exemple de `GET /api/dossiers/a-faire`, reprises du contrat
 * (`docs/demande-backend-2026-09-14-accueil-a-faire.md`, §2 : JSON du Président et tableau des autres
 * lignes) et complétées d'un exemple PRMP (règle C2 : ni acteurs ni consigne). Partagées par les tests :
 * l'écran se développe contre le contrat tant que le backend ne sert pas la route.
 */

const DATES_VIDES = { RECEPTION: null, DISPATCH: null, EXAMEN: null, PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null };
const FAITS_VIDES: AFaireFaits = {
  nbLignes: null,
  montantTotal: null,
  nbPieces: null,
  idAvis: null,
  nbObservations: null,
  consigneDispatch: null,
  dernierRetourNavette: null,
  motifRetrait: null,
  examenEntame: null,
  partsAttendues: null,
};
const REFS_VIDES: AFaireRefs = { idReception: null, idDispatch: null, idExamen: null, idPv: null, idLettre: null, idDemandeRetrait: null };

function dossier(d: Partial<AFaireDossier> & Pick<AFaireDossier, 'idDossier' | 'statut'>): AFaireDossier {
  return {
    refeDossier: null,
    dateSoumission: null,
    idTypeDossier: 'DDP',
    idSousType: 'PPM',
    idEntiteContract: null,
    libelleEntite: null,
    idLocalite: 'ANT',
    libelleLocalite: 'Antananarivo',
    statutPv: null,
    niveauNavette: null,
    datesEtapes: { ...DATES_VIDES },
    acteursEtapes: { ...DATES_VIDES },
    ...d,
  };
}
function delai(d: Partial<AFaireDelai>): AFaireDelai {
  return {
    etape: null,
    entree: null,
    standardHeures: null,
    ecouleHeures: null,
    restantHeures: null,
    echeance: null,
    pauseDepuis: null,
    pauseHeures: null,
    datePrevisionnelleFin: null,
    ...d,
  };
}
function tache(t: Partial<AFaireTache> & Pick<AFaireTache, 'section' | 'geste' | 'urgence' | 'rang' | 'dossier'>): AFaireTache {
  return { gestesSecondaires: [], mode: 'TITULAIRE', delai: delai({}), faits: { ...FAITS_VIDES }, refs: { ...REFS_VIDES }, ...t };
}

/** Président, lundi 14/09/2026 à 15:00 — les cinq lignes du contrat, dans l'ordre servi. */
export function exempleAFairePresident(): AFaire {
  return {
    profil: 'PRESIDENT',
    genereLe: '2026-09-14T15:00:00',
    compteurs: { aFaire: 5, enRetard: 1, bientot: 2, dansLesDelais: 1, sansDelai: 1, enPause: 0, suivi: 0 },
    sections: [
      { code: 'A_DISPATCHER', total: 3, standardHeures: 8 },
      { code: 'PV_A_VISER', total: 1, standardHeures: 16 },
      { code: 'RETRAITS_A_DECIDER', total: 1, standardHeures: null },
    ],
    taches: [
      tache({
        section: 'A_DISPATCHER',
        geste: 'DISPATCHER',
        urgence: 'EN_RETARD',
        rang: 1,
        dossier: dossier({
          idDossier: 1051,
          refeDossier: '00015/DGSR/DAO/2026',
          dateSoumission: '2026-09-10T10:05:00',
          idTypeDossier: 'DAO',
          idSousType: 'DAO',
          idEntiteContract: 31,
          libelleEntite: 'Direction générale de la Sécurité routière',
          statut: 'PRET_DISPATCH',
          datesEtapes: { ...DATES_VIDES, RECEPTION: '2026-09-11T14:00:00' },
          acteursEtapes: { ...DATES_VIDES, RECEPTION: 'Fanja Rasoanaivo' },
        }),
        delai: delai({ etape: 'DISPATCH', entree: '2026-09-11T14:00:00', standardHeures: 8, ecouleHeures: 9, restantHeures: -1, echeance: '2026-09-14T14:00:00', datePrevisionnelleFin: '2026-09-30' }),
        faits: { ...FAITS_VIDES, nbPieces: 8 },
        refs: { ...REFS_VIDES, idReception: 402 },
      }),
      tache({
        section: 'A_DISPATCHER',
        geste: 'DISPATCHER',
        urgence: 'BIENTOT',
        rang: 2,
        dossier: dossier({
          idDossier: 1050,
          refeDossier: '00014/MTP/PPM/2026',
          libelleEntite: 'Ministère des Travaux publics',
          statut: 'PRET_DISPATCH',
          datesEtapes: { ...DATES_VIDES, RECEPTION: '2026-09-14T09:00:00' },
        }),
        delai: delai({ etape: 'DISPATCH', entree: '2026-09-14T09:00:00', standardHeures: 8, ecouleHeures: 6, restantHeures: 2, echeance: '2026-09-15T09:00:00' }),
        faits: { ...FAITS_VIDES, nbLignes: 14, nbPieces: 5 },
        refs: { ...REFS_VIDES, idReception: 401 },
      }),
      tache({
        section: 'PV_A_VISER',
        geste: 'VISER',
        gestesSecondaires: ['RETOURNER'],
        urgence: 'BIENTOT',
        rang: 3,
        dossier: dossier({
          idDossier: 1002,
          refeDossier: '00002/MTP/PPM-AGPM/2026',
          idSousType: 'PPM-AGPM',
          libelleEntite: 'Ministère des Travaux publics',
          statut: 'EXAMINE',
          statutPv: 'PROJET_ACCEPTE',
          niveauNavette: 'PRESIDENT',
          datesEtapes: { ...DATES_VIDES, RECEPTION: '2026-09-04T10:00:00', DISPATCH: '2026-09-07T11:00:00', EXAMEN: '2026-09-11T12:00:00' },
          acteursEtapes: { ...DATES_VIDES, RECEPTION: 'Fanja Rasoanaivo', DISPATCH: 'Naina Razafindrakoto', EXAMEN: 'Naina Razafindrakoto' },
        }),
        delai: delai({ etape: 'VISA', entree: '2026-09-11T12:00:00', standardHeures: 16, ecouleHeures: 11, restantHeures: 5, echeance: '2026-09-15T12:00:00', datePrevisionnelleFin: '2026-09-24' }),
        faits: { ...FAITS_VIDES, nbLignes: 12, montantTotal: 3482442000, idAvis: 'FAVR', nbObservations: 3 },
        refs: { ...REFS_VIDES, idReception: 380, idDispatch: 210, idExamen: 150, idPv: 12 },
      }),
      tache({
        section: 'A_DISPATCHER',
        geste: 'DISPATCHER',
        urgence: 'DANS_LES_DELAIS',
        rang: 4,
        dossier: dossier({
          idDossier: 1052,
          refeDossier: '00016/FR/PPM/2026',
          libelleEntite: 'Fonds routier',
          statut: 'PRET_DISPATCH',
          datesEtapes: { ...DATES_VIDES, RECEPTION: '2026-09-14T14:00:00' },
        }),
        delai: delai({ etape: 'DISPATCH', entree: '2026-09-14T14:00:00', standardHeures: 8, ecouleHeures: 1, restantHeures: 7, echeance: '2026-09-15T14:00:00' }),
        refs: { ...REFS_VIDES, idReception: 403 },
      }),
      tache({
        section: 'RETRAITS_A_DECIDER',
        geste: 'DECIDER_RETRAIT',
        urgence: 'SANS_DELAI',
        rang: 5,
        dossier: dossier({ idDossier: 1009, refeDossier: '00009/DGB/PPM/2026', libelleEntite: 'Direction générale du Budget', statut: 'DISPATCHE' }),
        delai: delai({ entree: '2026-09-12T10:00:00' }),
        faits: { ...FAITS_VIDES, motifRetrait: "erreur sur l'exercice budgétaire" },
        refs: { ...REFS_VIDES, idDemandeRetrait: 77 },
      }),
    ],
    delegations: { total: 3, parSection: [{ code: 'A_RECEPTIONNER', total: 3 }], taches: [] },
  };
}

/** Lignes du bloc délégation du Président (`delegations=true`). */
export function exempleDelegationsPresident(): AFaire {
  const a = exempleAFairePresident();
  const reception = (idDossier: number, rang: number, soumis: string): AFaireTache =>
    tache({
      section: 'A_RECEPTIONNER',
      geste: 'NUMEROTER',
      mode: 'DELEGATION',
      urgence: 'DANS_LES_DELAIS',
      rang,
      dossier: dossier({ idDossier, dateSoumission: soumis, libelleEntite: 'Direction générale du Budget', statut: 'SOUMIS' }),
      delai: delai({ etape: 'RECEPTION', entree: soumis, standardHeures: 8, ecouleHeures: 3, restantHeures: 5 }),
      faits: { ...FAITS_VIDES, nbPieces: 5 },
    });
  a.delegations.taches = [reception(1101, 1, '2026-09-14T09:12:00'), reception(1102, 2, '2026-09-14T10:30:00'), reception(1103, 3, '2026-09-14T14:10:00')];
  return a;
}

/** PRMP : brouillon (hors délai, servi avant la pause selon l'ordre des urgences), à rectifier (pause), suivi — sans acteurs ni consigne (règle C2). */
export function exempleAFairePrmp(): AFaire {
  return {
    profil: 'PRMP',
    genereLe: '2026-09-14T15:00:00',
    compteurs: { aFaire: 2, enRetard: 0, bientot: 0, dansLesDelais: 0, sansDelai: 1, enPause: 1, suivi: 1 },
    sections: [
      { code: 'BROUILLONS', total: 1, standardHeures: null },
      { code: 'A_RECTIFIER', total: 1, standardHeures: null },
      { code: 'EN_COURS_CNM', total: 1, standardHeures: null },
    ],
    taches: [
      tache({
        section: 'BROUILLONS',
        geste: 'SOUMETTRE',
        urgence: 'HORS_DELAI',
        rang: 1,
        dossier: dossier({ idDossier: 1200, idSousType: 'PPM-AGPM', libelleEntite: 'Ministère des Travaux publics', statut: 'BROUILLON', acteursEtapes: null }),
        faits: { ...FAITS_VIDES, nbLignes: 9 },
      }),
      tache({
        section: 'A_RECTIFIER',
        geste: 'RECTIFIER',
        urgence: 'EN_PAUSE',
        rang: 2,
        dossier: dossier({
          idDossier: 1004,
          refeDossier: '00004/MTP/PPM/2026',
          libelleEntite: 'Ministère des Travaux publics',
          statut: 'EN_ATTENTE_DECISION_PRMP',
          datesEtapes: { ...DATES_VIDES, RECEPTION: '2026-08-25T09:00:00', DISPATCH: '2026-08-26T09:00:00', EXAMEN: '2026-09-01T09:00:00', PROJET_PV: '2026-09-03T09:00:00', PV_SIGNE: '2026-09-04T09:00:00' },
          acteursEtapes: null,
        }),
        delai: delai({ pauseDepuis: '2026-09-12T10:00:00', pauseHeures: 13 }),
        faits: { ...FAITS_VIDES, nbObservations: 2 },
        refs: { ...REFS_VIDES, idPv: 40 },
      }),
      tache({
        section: 'EN_COURS_CNM',
        geste: 'SUIVRE',
        urgence: 'SUIVI',
        rang: 3,
        dossier: dossier({ idDossier: 1018, refeDossier: '00018/MTP/PPM/2026', libelleEntite: 'Ministère des Travaux publics', statut: 'EN_VERIFICATION', acteursEtapes: null }),
        delai: delai({ etape: 'VERIFICATION', datePrevisionnelleFin: '2026-09-16' }),
      }),
    ],
    delegations: { total: 0, parSection: [], taches: [] },
  };
}
