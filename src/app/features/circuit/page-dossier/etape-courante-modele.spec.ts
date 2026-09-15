import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from '../../../core/errors/api-error';
import { AFaireDelai, AFaireTache, Dossier, GestesDossier, Role } from '../../../models';
import { exempleAFairePresident, exempleAFairePrmp } from '../../home/a-faire/a-faire-contrat.exemple';
import { cibleGeste } from '../../home/a-faire/a-faire-navigation';
import { LIBELLES_GESTES } from '../../home/a-faire/a-faire-libelles';
import { GESTES_ETAT, TITRES_SITUATION, ciblePage, classerEchecGestes, famillePage, gesteDemande, gestesBoutons, montantGestes, navettePv, retraitADecider, voletPv, vueEtape } from './etape-courante-modele';

const erreur = (status: number): ApiError => ({ status, message: 'x', raw: new HttpErrorResponse({ status }) });

const DELAI_VIDE: AFaireDelai = { etape: null, entree: null, standardHeures: null, ecouleHeures: null, restantHeures: null, echeance: null, pauseDepuis: null, pauseHeures: null, datePrevisionnelleFin: null };

/** Tâche du contrat d'« À faire », réaffectée à un autre geste. */
function tache(partiel: Partial<AFaireTache>): AFaireTache {
  const base = exempleAFairePresident().taches[0];
  return { ...base, dossier: { ...base.dossier, idDossier: 42 }, gestesSecondaires: [], mode: 'TITULAIRE', ...partiel };
}
function reponse(taches: AFaireTache[], etapeCourante: GestesDossier['etapeCourante'] = null, profil: Role = 'PRESIDENT'): GestesDossier {
  return { idDossier: 42, profil, genereLe: '2026-09-15T10:00:00.123456', etapeCourante, taches };
}
const dossier = (partiel: Partial<Dossier>): Dossier => ({ idDossier: 42, refeDossier: '00042/PPM/CNM/2026', statut: 'PRET_DISPATCH', ...partiel });

describe('Page dossier — étape en cours (règles)', () => {
  /** Recette L4-Q2, défaut (j) : le titre dit la situation, le bouton dit l'action — jamais la même phrase. */
  describe('titres de situation', () => {
    it('chaque geste a une phrase de situation, distincte du libellé de son bouton', () => {
      for (const [code, titre] of Object.entries(TITRES_SITUATION)) {
        const geste = code as keyof typeof TITRES_SITUATION;
        if (GESTES_ETAT.includes(geste)) {
          expect(titre).toBe('');
          continue;
        }
        expect(titre, code).not.toBe('');
        expect(titre, code).not.toBe(LIBELLES_GESTES[geste].long);
        expect(titre, code).not.toBe(LIBELLES_GESTES[geste].court);
      }
    });

    it('la phrase guide ne redit pas le titre', () => {
      // ARCHIVER_LETTRE : `noteCourte` dit « Lettre de renvoi signée », le titre aussi.
      const v = vueEtape(dossier({ statut: 'PV_SIGNE' }), reponse([tache({ section: 'LETTRES_A_ARCHIVER', geste: 'ARCHIVER_LETTRE' })]), 'ASSISTANT_CONTROLEUR');
      expect(v.titre).toBe('Lettre de renvoi signée');
      expect(v.note).toBe('');
    });
  });

  describe('gestes servis', () => {
    it('dans l’ordre du serveur : geste puis secondaires, tâche par tâche ; VOIR et SUIVRE n’en sont pas ; un code, un bouton', () => {
      const boutons = gestesBoutons([
        tache({ section: 'LETTRES_A_SIGNER', geste: 'SIGNER_LETTRE', rang: 2 }),
        tache({ section: 'A_EXAMINER', geste: 'REATTRIBUER', gestesSecondaires: ['EXAMINER'], rang: 1 }),
        tache({ section: 'EN_ATTENTE_PRMP', geste: 'VOIR', rang: 3 }),
        tache({ section: 'A_REEXAMINER', geste: 'EXAMINER', rang: 4, mode: 'DELEGATION' }),
      ]);
      expect(boutons.map((b) => b.geste)).toEqual(['REATTRIBUER', 'EXAMINER', 'SIGNER_LETTRE']);
      expect(boutons.map((b) => b.libelle)).toEqual(['Attribuer le dossier à un Membre', 'Examiner le dossier', 'Signer la lettre de renvoi']);
    });

    it('?geste= : seul un geste servi est retenu, une valeur forgée est ignorée', () => {
      const boutons = gestesBoutons([tache({ geste: 'DISPATCHER' })]);
      expect(gesteDemande('DISPATCHER', boutons)?.geste).toBe('DISPATCHER');
      expect(gesteDemande('NUMEROTER', boutons)).toBeNull();
      expect(gesteDemande('SUPPRIMER_TOUT', boutons)).toBeNull();
      expect(gesteDemande(null, boutons)).toBeNull();
    });
  });

  describe('cible depuis la page', () => {
    const t = tache({ refs: { idReception: 7, idDispatch: 3, idExamen: null, idPv: 12, idLettre: 5, idDemandeRetrait: 77 } });
    const page = '/president/dossier/42?returnUrl=%2Fpresident%2Fa-faire';

    it('gestes courts en modale ; consultation sans objet sur la page', () => {
      expect(ciblePage('NUMEROTER', t, 'president', page)).toEqual({ type: 'modale', modale: 'reception' });
      expect(ciblePage('DISPATCHER', t, 'president', page)).toEqual({ type: 'modale', modale: 'dispatch' });
      expect(ciblePage('REATTRIBUER', t, 'cc', page)).toEqual({ type: 'modale', modale: 'reattribution' });
      expect(ciblePage('COMPLETER_PIECES_DEPOT', t, 'prmp', page)).toEqual({ type: 'modale', modale: 'pieces-depot' });
      expect(ciblePage('DISPATCHER', { ...t, refs: { ...t.refs, idReception: null } }, 'president', page)).toBeNull();
      for (const g of ['NUMEROTER', 'DISPATCHER', 'REATTRIBUER', 'COMPLETER_PIECES_DEPOT'] as const) expect(famillePage(g)).toBe('modale');
    });

    it('écrans de travail : leur URL, avec returnUrl vers la page (la rectification ne revient plus à « À faire »)', () => {
      expect(ciblePage('EXAMINER', t, 'membre', page)).toEqual({ type: 'route', commandes: ['/membre', 'examiner', 42], ciblee: true, queryParams: { returnUrl: page } });
      expect(ciblePage('TRANSMETTRE_DECISION', t, 'verificateur', page)).toEqual({ type: 'route', commandes: ['/verificateur', 'verifier', 42], ciblee: true, queryParams: { returnUrl: page } });
      expect(ciblePage('RECTIFIER', t, 'prmp', page)).toEqual({ type: 'route', commandes: ['/prmp', 'rectifier', 42], ciblee: true, queryParams: { returnUrl: page } });
      expect(ciblePage('SOUMETTRE', t, 'prmp', page)).toEqual({ type: 'route', commandes: ['/prmp', 'soumettre-dossier'], ciblee: true, queryParams: { reprendre: 42, returnUrl: page } });
      expect(ciblePage('ARCHIVER_PV', t, 'assistant', page)).toEqual({ type: 'route', commandes: ['/assistant', 'pv-examens', 12], ciblee: true, queryParams: { returnUrl: page } });
      expect(ciblePage('SIGNER_LETTRE', t, 'cc', page)).toEqual({ type: 'route', commandes: ['/cc', 'lettre-renvois', 5], ciblee: true, queryParams: { returnUrl: page } });
    });

    it('lot F4 : la navette du PV se joue dans le panneau ; la gestion du PV, sans returnUrl, n’est plus qu’un repli', () => {
      for (const g of ['SOUMETTRE_PV', 'ACCEPTER', 'VISER', 'RETOURNER', 'SIGNER'] as const) {
        expect(famillePage(g)).toBe('navette');
        expect(ciblePage(g, t, 'president', page)).toEqual({ type: 'route', commandes: ['/president', 'resultat-examen', 'pv'], ciblee: true, queryParams: { gerer: 12 } });
      }
    });

    it('lot F5 : la décision de retrait se prend dans le panneau ; la liste d’« À faire » n’est plus une destination', () => {
      expect(famillePage('DECIDER_RETRAIT')).toBe('retrait');
      // Cible inchangée côté « À faire » (liste des demandes) : la page ne s'en sert pas pour agir.
      expect(ciblePage('DECIDER_RETRAIT', t, 'president', page)).toEqual(cibleGeste('DECIDER_RETRAIT', t, 'president'));
    });
  });

  describe('navette du projet de PV (lot F4)', () => {
    const faits = (partiel: Partial<AFaireTache['faits']>): AFaireTache['faits'] => ({ ...tache({}).faits, idAvis: null, nbObservations: null, dernierRetourNavette: null, partsAttendues: null, consigneDispatch: null, ...partiel });
    const refs = { idReception: 7, idDispatch: 3, idExamen: 9, idPv: 12, idLettre: null, idDemandeRetrait: null };
    const visa: GestesDossier['etapeCourante'] = { urgence: 'DANS_LES_DELAIS', delai: { ...DELAI_VIDE, etape: 'VISA', entree: '2026-09-15T10:00:00', standardHeures: 16, ecouleHeures: 2, restantHeures: 14, echeance: '2026-09-17T10:00:00' } };

    it('servie : les gestes de navette de toutes les lignes, la ligne la mieux rangée, son PV', () => {
      const v = vueEtape(
        dossier({ statut: 'EXAMINE' }),
        reponse([tache({ section: 'LETTRES_A_SIGNER', geste: 'SIGNER_LETTRE', rang: 2, refs }), tache({ section: 'PV_A_VISER', geste: 'VISER', gestesSecondaires: ['RETOURNER'], rang: 1, mode: 'INTERIM', refs, faits: faits({ idAvis: 'FAVR' }) })], visa),
        'CHEF_COMMISSION',
      );
      expect(v.navette).toEqual({ tache: expect.objectContaining({ section: 'PV_A_VISER' }), idPv: 12, gestes: ['VISER', 'RETOURNER'] });
      expect(v.titre).toBe('Projet de PV en attente de visa');
      expect([v.porteur, v.mode]).toEqual(['à vous par intérim', 'Par intérim']);
      // Le volet dit l'avis : ni phrase guide qui le répète, ni colonne de faits concurrente.
      expect(v.note).toBe('');
      expect(v.faits).toEqual([]);
      expect(v.horsPanneau.map((b) => b.geste)).toEqual(['SIGNER_LETTRE']);
      // La barre collante garde le geste principal servi.
      expect(v.principal?.geste).toBe('VISER');
    });

    it('non servie : aucune navette, le panneau de F3 inchangé', () => {
      const v = vueEtape(dossier({ statut: 'PRET_DISPATCH' }), reponse([tache({ geste: 'DISPATCHER' })]), 'PRESIDENT');
      expect([v.navette, v.retrait, v.horsPanneau]).toEqual([null, null, []]);
      expect(navettePv(gestesBoutons([tache({ geste: 'ARCHIVER_PV' })]))).toBeNull();
    });

    it('règle C2 : jamais pour la PRMP ni l’UGPM, même sur une doublure qui la servirait', () => {
      for (const role of ['PRMP', 'UGPM'] as const) {
        const v = vueEtape(dossier({ statut: 'EXAMINE' }), reponse([tache({ section: 'PV_A_VISER', geste: 'VISER', refs })], visa, role), role);
        expect(v.navette).toBeNull();
      }
    });

    it('volet : avis, observations de l’examen, dernier retour, parts attendues, examinateur', () => {
      const t = tache({
        section: 'PV_A_VISER',
        geste: 'VISER',
        dossier: { ...tache({}).dossier, acteursEtapes: { EXAMEN: 'Lalatiana Ravao' } },
        faits: faits({ idAvis: 'FAVR', nbObservations: null, dernierRetourNavette: 'Préciser le montant', partsAttendues: ['MEMBRE', 'CC'] }),
      });
      expect(voletPv(t, 3)).toEqual([
        { libelle: 'Avis du Membre', valeur: 'Favorable avec réserves' },
        { libelle: 'Observations', valeur: '3 observations' },
        { libelle: 'Dernier retour', valeur: '« Préciser le montant »' },
        { libelle: 'Parts attendues', valeur: 'Membre et Chef de commission' },
        { libelle: 'Examiné par', valeur: 'Lalatiana Ravao' },
      ]);
      // Compte de l'examen inconnu : repli sur le périmètre figé servi, sinon la ligne est omise.
      expect(voletPv(t, null).map((f) => f.libelle)).not.toContain('Observations');
      expect(voletPv({ ...t, faits: faits({ nbObservations: 2 }) }, null)).toContainEqual({ libelle: 'Observations', valeur: '2 observations' });
      expect(voletPv(t, 0)).toContainEqual({ libelle: 'Observations', valeur: 'Aucune observation' });
      expect(voletPv({ ...t, section: 'PV_A_SIGNER', faits: faits({ idAvis: 'FAV' }) }, 0)[0]).toEqual({ libelle: 'Avis arrêté au visa', valeur: 'Favorable' });
      expect(voletPv({ ...t, faits: faits({}) }, 0)[0]).toEqual({ libelle: 'Avis du Membre', valeur: 'Non renseigné' });
    });

    it('« Examiné par » : la ligne est omise tant que le serveur ne nomme personne (message backend du 16/09)', () => {
      // Sans réattribution, `acteursEtapes.EXAMEN` reste vide jusqu'à la soumission du projet de PV.
      const t = tache({ section: 'PV_A_SOUMETTRE', geste: 'SOUMETTRE_PV', refs, dossier: { ...tache({}).dossier, acteursEtapes: {} }, faits: faits({ idAvis: 'FAVR' }) });
      expect(voletPv(t, 1).map((f) => f.libelle)).not.toContain('Examiné par');
      expect(voletPv(t, 1).map((f) => f.libelle)).toEqual(['Avis du Membre', 'Observations']);
    });
  });

  /** Recette L4-Q2, défaut (f) : le motif du retour de navette, étiqueté, là où il dit ce qu'on attend. */
  describe('motif du retour de navette', () => {
    const refs = { idReception: 7, idDispatch: 3, idExamen: 9, idPv: 12, idLettre: null, idDemandeRetrait: null };
    const MOTIF = 'Merci de vérifier le montant de la ligne 1.';
    const reprise = (): AFaireTache =>
      tache({ section: 'PV_A_REPRENDRE', geste: 'REPRENDRE_EXAMEN', refs, faits: { ...tache({}).faits, dernierRetourNavette: MOTIF } });

    it('REPRENDRE_EXAMEN : le motif est porté à part, sans doublon dans la phrase guide ni dans les faits', () => {
      const v = vueEtape(dossier({ statut: 'EXAMINE' }), reponse([reprise()]), 'MEMBRE');
      expect(v.retourNavette).toBe(MOTIF);
      expect(v.note).toBe('');
      expect(v.faits.map((f) => f.libelle)).not.toContain('Dernier retour');
    });

    it('sans retour servi : rien, et la phrase guide reprend sa place', () => {
      const sansMotif = tache({ section: 'PV_A_REPRENDRE', geste: 'REPRENDRE_EXAMEN', refs, faits: { ...tache({}).faits, dernierRetourNavette: null } });
      const v = vueEtape(dossier({ statut: 'EXAMINE' }), reponse([sansMotif]), 'MEMBRE');
      expect(v.retourNavette).toBeNull();
      expect(v.note).toBe('Retourné pour rectification');
    });

    it('navette montée dans le panneau : c’est son volet qui porte « Dernier retour », pas le bloc', () => {
      const visa = tache({ section: 'PV_A_VISER', geste: 'VISER', refs, faits: { ...tache({}).faits, dernierRetourNavette: MOTIF } });
      expect(vueEtape(dossier({ statut: 'EXAMINE' }), reponse([visa]), 'PRESIDENT').retourNavette).toBeNull();
    });

    it('règle C2 : jamais pour la PRMP ni l’UGPM — c’est un échange interne à la CNM', () => {
      for (const role of ['PRMP', 'UGPM'] as const) {
        expect(vueEtape(dossier({ statut: 'EXAMINE' }), reponse([reprise()], null, role), role).retourNavette).toBeNull();
      }
    });
  });

  describe('décision de retrait (lot F5)', () => {
    const refs = { idReception: 7, idDispatch: 3, idExamen: 9, idPv: 12, idLettre: null, idDemandeRetrait: 77 };
    const retrait = (autres: Partial<AFaireTache> = {}): AFaireTache =>
      tache({ section: 'RETRAITS_A_DECIDER', geste: 'DECIDER_RETRAIT', urgence: 'SANS_DELAI', rang: 1, refs, delai: { ...DELAI_VIDE, entree: '2026-09-15T23:57:48.376888' }, faits: { ...tache({}).faits, motifRetrait: 'Doublon avec un autre plan' }, ...autres });

    it('servie seule : la demande (référence, motif, date), titre du geste ; ni phrase guide ni faits, le volet les porte', () => {
      const v = vueEtape(dossier({ statut: 'DISPATCHE' }), reponse([retrait()]), 'CHEF_COMMISSION');
      expect(v.retrait).toEqual({ tache: expect.objectContaining({ section: 'RETRAITS_A_DECIDER' }), idDemandeRetrait: 77, motif: 'Doublon avec un autre plan', demandeeLe: '2026-09-15T23:57:48.376888' });
      expect(v.titre).toBe('Retrait demandé par la PRMP');
      expect([v.principal?.geste, v.porteur, v.note, v.faits, v.horsPanneau, v.navette]).toEqual(['DECIDER_RETRAIT', 'à vous', '', [], [], null]);
    });

    it('après un autre geste : le geste principal reste, ses faits aussi — sans le motif du retrait, que porte le volet', () => {
      const autre = tache({ section: 'A_DISPATCHER', geste: 'DISPATCHER', rang: 1, refs, faits: { ...tache({}).faits, motifRetrait: 'Doublon avec un autre plan', consigneDispatch: null } });
      const v = vueEtape(dossier({}), reponse([autre, retrait({ rang: 2 })]), 'PRESIDENT');
      expect(v.principal?.geste).toBe('DISPATCHER');
      expect(v.retrait?.idDemandeRetrait).toBe(77);
      expect(v.horsPanneau.map((b) => b.geste)).toEqual(['DISPATCHER']);
      expect(v.note).not.toBe('');
      expect(v.faits.map((f) => f.libelle)).not.toContain('Motif du retrait');
    });

    it('avec la navette : les deux formulaires, dans l’ordre du serveur ; la phrase guide suit le geste principal', () => {
      const visa = tache({ section: 'PV_A_VISER', geste: 'VISER', gestesSecondaires: ['RETOURNER'], rang: 2, mode: 'INTERIM', refs });
      const cc = vueEtape(dossier({ statut: 'EXAMINE' }), reponse([retrait(), visa]), 'CHEF_COMMISSION');
      expect([cc.principal?.geste, cc.navette?.gestes, cc.retrait?.idDemandeRetrait, cc.horsPanneau, cc.note, cc.faits]).toEqual(['DECIDER_RETRAIT', ['VISER', 'RETOURNER'], 77, [], '', []]);
      const president = vueEtape(dossier({ statut: 'EXAMINE' }), reponse([{ ...visa, rang: 1, mode: 'TITULAIRE' }, retrait({ rang: 2 })]), 'PRESIDENT');
      expect([president.principal?.geste, president.titre, president.retrait?.idDemandeRetrait]).toEqual(['VISER', 'Projet de PV en attente de visa', 77]);
    });

    it('règle C2 : jamais pour la PRMP ni l’UGPM, même sur une doublure qui la servirait', () => {
      for (const role of ['PRMP', 'UGPM'] as const) expect(vueEtape(dossier({ statut: 'DISPATCHE' }), reponse([retrait()], null, role), role).retrait).toBeNull();
      expect(retraitADecider(gestesBoutons([tache({ geste: 'DISPATCHER' })]))).toBeNull();
    });

    /**
     * Recette L4-Q2, défaut (h) : la décision de retrait n'a pas de délai, le dossier si. « Reste 35 h »
     * sous « Examiner la demande de retrait » se lisait comme le délai de la décision.
     */
    describe('délai affiché : celui de l’étape, et il le dit', () => {
      const examen: GestesDossier['etapeCourante'] = { urgence: 'DANS_LES_DELAIS', delai: { ...DELAI_VIDE, etape: 'EXAMEN', entree: '2026-09-15T10:00:00', standardHeures: 40, ecouleHeures: 5, restantHeures: 35, echeance: '2026-09-21T10:00:00' } };

      it('décision de retrait : le délai nomme l’étape qu’il mesure', () => {
        const v = vueEtape(dossier({ statut: 'DISPATCHE' }), reponse([retrait()], examen), 'CHEF_COMMISSION');
        expect(v.delai?.texte).toMatch(/^Étape examen : reste 35 h · avant /);
      });

      it('même étape, autre geste principal : le délai reste celui de F3, sans préfixe', () => {
        const autre = tache({ section: 'A_EXAMINER', geste: 'EXAMINER', rang: 1, refs });
        const v = vueEtape(dossier({ statut: 'DISPATCHE' }), reponse([autre, retrait({ rang: 2 })], examen), 'MEMBRE');
        expect(v.delai?.texte).toMatch(/^Reste 35 h · avant /);
      });

      it('étape non chronométrée : rien plutôt qu’un délai dont on ne peut pas dire l’objet', () => {
        const sansEtape: GestesDossier['etapeCourante'] = { urgence: 'DANS_LES_DELAIS', delai: { ...examen.delai, etape: null } };
        expect(vueEtape(dossier({ statut: 'DISPATCHE' }), reponse([retrait()], sansEtape), 'CHEF_COMMISSION').delai).toBeNull();
      });
    });
  });

  describe('panneau', () => {
    const etapeDispatch = { urgence: 'BIENTOT' as const, delai: { ...DELAI_VIDE, etape: 'DISPATCH' as const, entree: '2026-09-15T10:42:10.496548', standardHeures: 8, ecouleHeures: 5, restantHeures: 3, echeance: '2026-09-16T10:43:00' } };

    it('contrôleur titulaire : étape, « à vous », geste principal, délai avec échéance', () => {
      const v = vueEtape(dossier({}), reponse([tache({ geste: 'DISPATCHER' })], etapeDispatch), 'PRESIDENT');
      expect(v.etape).toBe('Étape 2 sur 7');
      expect(v.fleche).toBe('21.43%');
      expect(v.porteur).toBe('à vous');
      expect(v.titre).toBe('En attente de dispatch');
      expect(v.principal?.geste).toBe('DISPATCHER');
      expect(v.delai).toEqual({ genre: 'bientot', texte: expect.stringMatching(/^Reste 3 h · avant mer\.? 16\/09, 10:43$/) });
      expect(v.mode).toBeNull();
    });

    it('à un autre titre : le mode dans la phrase et en badge', () => {
      const v = vueEtape(dossier({ statut: 'SOUMIS' }), reponse([tache({ section: 'A_RECEPTIONNER', geste: 'NUMEROTER', mode: 'DELEGATION' })], etapeDispatch), 'PRESIDENT');
      expect(v.porteur).toBe('à vous par délégation');
      expect(v.mode).toBe('Par délégation');
      expect(v.etape).toBe('Étape 1 sur 7');
    });

    it('Membre non attributaire : « chez … , Membre » et le délai, sans bouton', () => {
      const d = dossier({ statut: 'DISPATCHE', acteursEtapes: { DISPATCH: 'Lalatiana Ravao' } });
      const v = vueEtape(d, reponse([], { urgence: 'DANS_LES_DELAIS', delai: { ...DELAI_VIDE, etape: 'EXAMEN', entree: '2026-09-15T10:00:00', standardHeures: 40, ecouleHeures: 5, restantHeures: 35, echeance: '2026-09-21T10:00:00' } }), 'MEMBRE');
      expect(v.porteur).toBe('chez Lalatiana Ravao, Membre');
      expect(v.titre).toBe('Examen en cours');
      expect(v.principal).toBeNull();
      expect(v.delai?.texte).toMatch(/^Reste 35 h · avant/);
    });

    it('vérification sans cible nommée : « chez le … » ; attente PRMP (VOIR) : phrase d’état et pause', () => {
      const verif = vueEtape(dossier({ statut: 'EN_VERIFICATION' }), reponse([], { urgence: 'SANS_DELAI', delai: { ...DELAI_VIDE, etape: 'VERIFICATION' } }), 'SECRETAIRE');
      expect(verif.porteur).toBe('chez le Contrôleur vérificateur');
      expect(verif.titre).toBe('Vérification en cours');
      const archivage = vueEtape(dossier({ statut: 'DECISION_TRANSMISE_SIGMP', nomAssistantCible: 'Faniry Randriamampionona' }), reponse([], { urgence: 'DANS_LES_DELAIS', delai: { ...DELAI_VIDE, etape: 'ARCHIVAGE', restantHeures: 4, standardHeures: 8, ecouleHeures: 4, entree: '2026-09-15T22:00:00' } }), 'VERIFICATEUR');
      expect([archivage.porteur, archivage.titre]).toEqual(['chez Faniry Randriamampionona, Assistant contrôleur', 'Archivage en cours']);
      const voir = vueEtape(
        dossier({ statut: 'EN_ATTENTE_DECISION_PRMP', attentePrmp: true }),
        reponse([tache({ section: 'EN_ATTENTE_PRMP', geste: 'VOIR', urgence: 'EN_PAUSE' })], { urgence: 'EN_PAUSE', delai: { ...DELAI_VIDE, etape: 'RECTIFICATION_PRMP', pauseDepuis: '2026-09-12T10:00:00.5' } }),
        'VERIFICATEUR',
      );
      expect(voir.titre).toBe('En attente de la PRMP');
      expect(voir.porteur).toBe('chez la PRMP');
      expect(voir.principal).toBeNull();
      expect(voir.delai).toEqual({ genre: 'pause', texte: 'En pause · depuis le 12/09' });
    });

    it('dossier clos : pas de délai ni de geste, un état', () => {
      const v = vueEtape(dossier({ statut: 'CLOTURE' }), reponse([]), 'PRESIDENT');
      expect(v).toEqual(expect.objectContaining({ etape: 'Étape 7 sur 7', porteur: '', titre: 'Circuit terminé : dossier clôturé', delai: null, principal: null }));
    });

    describe('règle C2 — PRMP et UGPM', () => {
      /** Doublure que le serveur ne sert PAS à la PRMP : noms, reste, échéance. */
      const nommee = (statut: Dossier['statut']): Dossier => dossier({ statut, attentePrmp: statut === 'EN_ATTENTE_DECISION_PRMP', acteursEtapes: { DISPATCH: 'Jean Claude Rakoto' }, nomVerificateurCible: 'Tojo Andriatsimahavandy' });
      const pause = { urgence: 'EN_PAUSE' as const, delai: { ...DELAI_VIDE, etape: 'RECTIFICATION_PRMP' as const, standardHeures: 8, ecouleHeures: 5, restantHeures: 3, echeance: '2026-09-16T10:47:00', pauseDepuis: '2026-09-15T10:46:53.961635', pauseHeures: 5 } };
      const enCours = { urgence: 'EN_RETARD' as const, delai: { ...DELAI_VIDE, etape: 'VERIFICATION' as const, standardHeures: 8, ecouleHeures: 9, restantHeures: -1, echeance: '2026-09-15T10:00:00' } };
      const textes = (v: ReturnType<typeof vueEtape>): string => [v.etape, v.porteur, v.titre, v.note, v.delai?.texte, v.mode, ...v.faits.map((f) => `${f.libelle} ${f.valeur}`)].join(' | ');

      it('PRMP à rectifier : « à vous », la pause seule, ni reste ni échéance', () => {
        const rectifier = { ...exempleAFairePrmp().taches[1], faits: { ...exempleAFairePrmp().taches[1].faits, consigneDispatch: 'Voir avec Jean Claude Rakoto' } };
        const v = vueEtape(nommee('EN_ATTENTE_DECISION_PRMP'), reponse([rectifier], pause, 'PRMP'), 'PRMP');
        expect(v.porteur).toBe('à vous');
        expect(v.titre).toBe('Dossier renvoyé par la CNM');
        expect(v.delai).toEqual({ genre: 'pause', texte: 'En pause · chez vous depuis le 15/09' });
        expect(textes(v)).not.toMatch(/Rakoto|Andriatsimahavandy|Reste|avant|retard|Consigne/);
      });

      it('PRMP en suivi : « à la Commission nationale des marchés », aucun délai CNM', () => {
        const v = vueEtape(nommee('EN_VERIFICATION'), reponse([exempleAFairePrmp().taches[2]], enCours, 'PRMP'), 'PRMP');
        expect(v.porteur).toBe('à la Commission nationale des marchés');
        expect(v.titre).toBe('En cours à la Commission nationale des marchés');
        expect(v.delai).toBeNull();
        expect(textes(v)).not.toMatch(/Rakoto|Andriatsimahavandy|Reste|avant|retard|Vérificateur/);
      });

      it('UGPM sur un dossier à rectifier (aucun geste) : « à la PRMP », sa pause seule', () => {
        const v = vueEtape(nommee('EN_ATTENTE_DECISION_PRMP'), reponse([], pause, 'UGPM'), 'UGPM');
        expect(v.porteur).toBe('à la PRMP');
        expect(v.delai).toEqual({ genre: 'pause', texte: 'En pause · chez la PRMP depuis le 15/09' });
        expect(textes(v)).not.toMatch(/Rakoto|Andriatsimahavandy|Reste|avant/);
      });
    });
  });

  it('lecture des gestes : route non servie → lecture seule ; panne → Réessayer', () => {
    for (const status of [400, 403, 404, 405, 501]) expect(classerEchecGestes(erreur(status))).toEqual({ etat: 'indisponible' });
    expect(classerEchecGestes(erreur(500))).toEqual({ etat: 'echec' });
    expect(classerEchecGestes(new Error('réseau'))).toEqual({ etat: 'echec' });
  });

  it('montant du plan tiré des faits servis', () => {
    expect(montantGestes(reponse([tache({ faits: { ...tache({}).faits, montantTotal: 345000000 } })]))).toBe('345 000 000 Ar');
    expect(montantGestes(reponse([]))).toBe('');
    expect(montantGestes(null)).toBe('');
  });
});
