import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { Capability } from '../../../core/auth/permissions';
import { PermissionsService } from '../../../core/auth/permissions.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ToastService } from '../../../core/notifications/toast.service';
import { AFaireTache, Dossier, ExamenDetail, ExamenPiece, GesteAFaire, GestesDossier, PvExamen, Role, SectionAFaire } from '../../../models';
import { exempleAFairePresident } from '../../home/a-faire/a-faire-contrat.exemple';
import { DossiersRefreshStore } from '../../prmp/dossiers-refresh.store';
import { PageDossier } from './page-dossier';

@Component({ template: '' })
class Vide {}

/** Noms et matricules de contrôleurs : aucun ne doit atteindre le DOM de la PRMP ni de l'UGPM. */
const CONTROLEURS = ['Voahangy Rasoa', 'Jean Claude Rakoto', 'Solofo Rakotondrabe', 'Lalatiana Ravao', 'Jean Baptiste Andriamampionona', 'MEMANT1', 'MEMANT2', 'CCANT01', 'PRESID1'];

const DOSSIER: Dossier = {
  idDossier: 42,
  refeDossier: '00042/PPM/CNM/2026',
  idTypeDossier: 'DDP',
  idSousType: 'PPM',
  statut: 'EXAMINE',
  idLocalite: 'ANT',
  idEntiteContract: 3,
  datesEtapes: { RECEPTION: '2026-09-04T10:00:00', DISPATCH: '2026-09-07T09:00:00', EXAMEN: '2026-09-11T11:50:00', PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Lalatiana Ravao', EXAMEN: 'Lalatiana Ravao', PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
};

const PV: PvExamen = {
  idPv: 12,
  idExamen: 9,
  idAvis: 'FAVR',
  imCtrlMembre: 'MEMANT2',
  statutPv: 'PROJET_SOUMIS',
  nbNavettes: 1,
  imDispatcheur: 'PRESID1',
  nomDispatcheur: 'Jean Baptiste Andriamampionona',
} as PvExamen;

/** Examen 9 : deux points et une pièce non conformes (l'examen 8 et les conformes ne comptent pas). */
const DETAILS = [
  { idDetailExamen: 1, idExamen: 9, conforme: false },
  { idDetailExamen: 2, idExamen: 9, conforme: false },
  { idDetailExamen: 3, idExamen: 9, conforme: true },
  { idDetailExamen: 4, idExamen: 8, conforme: false },
] as ExamenDetail[];
const PIECES = [
  { idExamenPiece: 1, idExamen: 9, conforme: false },
  { idExamenPiece: 2, idExamen: 9, conforme: true },
] as ExamenPiece[];

function tache(section: SectionAFaire, geste: GesteAFaire, autres: Partial<AFaireTache> = {}): AFaireTache {
  const base = exempleAFairePresident().taches[0];
  return {
    ...base,
    section,
    geste,
    rang: 1,
    gestesSecondaires: [],
    mode: 'TITULAIRE',
    dossier: { ...base.dossier, idDossier: 42, acteursEtapes: { EXAMEN: 'Lalatiana Ravao' } },
    faits: { ...base.faits, idAvis: 'FAVR', nbObservations: null, dernierRetourNavette: 'Revoir le montant avec Solofo Rakotondrabe', partsAttendues: null },
    refs: { idReception: 7, idDispatch: 3, idExamen: 9, idPv: 12, idLettre: null, idDemandeRetrait: null },
    ...autres,
  };
}
const reponse = (profil: Role, taches: AFaireTache[]): GestesDossier => ({
  idDossier: 42,
  profil,
  genereLe: '2026-09-15T21:08:29.5582001',
  etapeCourante: { urgence: 'DANS_LES_DELAIS', delai: { etape: 'VISA', entree: '2026-09-15T10:00:00', standardHeures: 16, ecouleHeures: 2, restantHeures: 14, echeance: '2026-09-17T10:00:00', pauseDepuis: null, pauseHeures: null, datePrevisionnelleFin: null } },
  taches,
});

interface Scenario {
  gestes: GestesDossier;
  pv?: PvExamen | { status: number };
  /** Réponse d'une transition (`POST /api/pv-examens/12/<geste>`). */
  transition?: PvExamen;
}

describe('Page dossier — navette du projet de PV (lot L4-F4)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let refresh: { notifierChangement: ReturnType<typeof vi.fn> };
  /** `MÉTHODE url` de chaque requête, dans l'ordre. */
  let demandees: string[];
  let scenario: Scenario;

  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const boutonsWorkflow = (): string[] => Array.from(racine().querySelectorAll('.pv-workflow__actions > button')).map((b) => texte(b));
  const cliquer = (libelle: string | RegExp): void => {
    const bouton = Array.from(racine().querySelectorAll<HTMLButtonElement>('button')).find((b) => (typeof libelle === 'string' ? texte(b) === libelle : libelle.test(texte(b))));
    if (!bouton) throw new Error(`bouton introuvable : ${libelle}`);
    bouton.click();
    harness.detectChanges();
  };

  async function ouvrir(role: Role, ref: string, localite: string | null, url: string, s: Scenario, refuse: Capability[] = []): Promise<void> {
    toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    refresh = { notifierChangement: vi.fn() };
    demandees = [];
    scenario = s;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: ':espace/dossier/:idDossier', component: PageDossier },
          { path: '**', component: Vide },
        ]),
        { provide: AuthService, useValue: { role: signal<Role | null>(role), ref: signal<string | null>(ref), localite: signal<string | null>(localite), logout: vi.fn() } },
        { provide: PermissionsService, useValue: { can: (c: Capability) => !refuse.includes(c) } },
        { provide: ToastService, useValue: toast },
        { provide: DossiersRefreshStore, useValue: refresh },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    repondre();
  }

  /** Répond à tout ce qui attend : dossier, gestes, vague du store, projet de PV, compte de l'examen, transitions. */
  function repondre(): void {
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        const url = req.request.urlWithParams;
        demandees.push(`${req.request.method} ${url}`);
        const pv = scenario.pv ?? PV;
        if (url === '/api/dossiers/42') req.flush(DOSSIER);
        else if (url === '/api/dossiers/42/gestes') req.flush(scenario.gestes);
        else if (url === '/api/pv-examens/12' && req.request.method === 'GET') {
          if ('status' in pv) req.flush({ message: 'x' }, { status: pv.status, statusText: 'x' });
          else req.flush(pv);
        } else if (req.request.method === 'POST' && url.startsWith('/api/pv-examens/12/')) req.flush(scenario.transition ?? PV);
        else if (url === '/api/examen-details') req.flush(DETAILS);
        else if (url === '/api/examen-pieces?examen=9') req.flush(PIECES);
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else req.flush([]);
      }
      harness.detectChanges();
    }
    harness.detectChanges();
  }

  it('Membre qui soumet : PvWorkflow tel quel, le volet et le compte de l’examen ; la transition relit la page sans rechargement', async () => {
    const brouillon = { ...PV, statutPv: 'BROUILLON' as const };
    await ouvrir('MEMBRE', 'MEMANT2', 'ANT', '/membre/dossier/42', { gestes: reponse('MEMBRE', [tache('PV_A_SOUMETTRE', 'SOUMETTRE_PV')]), pv: brouillon });

    expect(racine().querySelector('app-etape-courante app-pv-workflow')).not.toBeNull();
    expect(boutonsWorkflow()).toEqual(['Soumettre le projet']);
    // Le bouton offert porte la marque des gestes du panneau : parité, barre collante et `?geste=` le retrouvent.
    expect(Array.from(racine().querySelectorAll('app-etape-courante [data-geste]')).map((b) => b.getAttribute('data-geste'))).toEqual(['SOUMETTRE_PV']);
    expect(racine().querySelector('.ep__indispo')).toBeNull();
    expect(texte(racine().querySelector('.ec__titre'))).toBe('Soumettre le projet de PV');
    const volet = texte(racine().querySelector('.ep-volet'));
    expect(volet).toContain('Ce que dit le projet de PV');
    expect(volet).toContain('Avis du MembreFavorable avec réserves');
    // Compte de l'EXAMEN (2 points + 1 pièce), pas le périmètre figé servi (nul pendant la navette).
    expect(volet).toContain('Observations3 observations');
    expect(volet).toContain('Dernier retour« Revoir le montant avec Solofo Rakotondrabe »');
    expect(demandees).toEqual(expect.arrayContaining(['GET /api/pv-examens/12', 'GET /api/examen-details', 'GET /api/examen-pieces?examen=9']));
    expect(toast.error).not.toHaveBeenCalled();

    // La transition : PvWorkflow poste, puis la page relit le dossier et ses gestes — pas le PV.
    const corps = racine().querySelector('app-page-dossier-corps');
    demandees = [];
    scenario = { ...scenario, gestes: reponse('MEMBRE', []), transition: { ...brouillon, statutPv: 'PROJET_SOUMIS' } };
    cliquer('Soumettre le projet');
    repondre();
    expect(demandees[0]).toBe('POST /api/pv-examens/12/soumettre');
    expect(demandees.slice(1).sort()).toEqual(['GET /api/dossiers/42', 'GET /api/dossiers/42/gestes']);
    expect(toast.success).toHaveBeenCalledWith('Projet soumis.');
    expect(refresh.notifierChangement).toHaveBeenCalledTimes(1);
    expect(racine().querySelector('app-page-dossier-corps')).toBe(corps);
    // Plus de geste de navette pour le Membre : le panneau affiche l'étape suivante.
    expect(racine().querySelector('app-etape-pv, app-pv-workflow')).toBeNull();
    expect(texte(racine().querySelector('.ec__titre'))).toBe('Visa du projet de PV en cours');
  });

  it('Président dispatcheur, navette simple : Viser et Retourner offerts ; le formulaire de visa s’ouvre dans le panneau', async () => {
    await ouvrir('PRESIDENT', 'PRESID1', null, '/president/dossier/42', { gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'] })]) });
    expect(boutonsWorkflow()).toEqual(['Viser…', 'Retourner pour rectification', 'Lettre de renvoi']);
    expect(racine().querySelector('.ep__indispo')).toBeNull();

    cliquer('Viser…');
    repondre();
    const formulaire = racine().querySelector('.pv-workflow__retour--accept');
    expect(texte(formulaire)).toContain('Visa — clôture de la navette');
    // La suggestion d'avis repose sur le compte de l'examen transmis à PvWorkflow.
    expect(texte(formulaire)).toContain('3 observation(s) relevée(s)');
  });

  describe('divergence : le serveur sert un geste que PvWorkflow n’offre pas', () => {
    it('CC d’une autre localité : VISER écrit « indisponible », avec le lien vers la gestion du projet de PV ; RETOURNER reste offert', async () => {
      await ouvrir('CHEF_COMMISSION', 'CCTMS01', 'TMS', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'], mode: 'INTERIM' })]) });
      expect(boutonsWorkflow()).toEqual(['Retourner pour rectification', 'Lettre de renvoi']);
      const indispo = racine().querySelector('.ep__indispo');
      expect(texte(indispo)).toContain('Viser le projet de PV : geste indisponible sur cet écran.');
      expect(texte(indispo)).not.toContain('Retourner');
      expect(indispo?.querySelector('a')?.getAttribute('href')).toBe('/cc/resultat-examen/pv?gerer=12');
    });

    it('Membre non désigné : « Signer » désactivé n’offre pas SIGNER', async () => {
      const accepte = { ...PV, statutPv: 'PROJET_ACCEPTE' as const, imMembreCoSignataire: 'MEMANT2', nomMembreCoSignataire: 'Lalatiana Ravao', dateSignaturePresident: '2026-09-15' };
      await ouvrir('MEMBRE', 'MEMANT1', 'ANT', '/membre/dossier/42', { gestes: reponse('MEMBRE', [tache('PV_A_SIGNER', 'SIGNER')]), pv: accepte });
      expect(boutonsWorkflow()).toEqual(['Signer']);
      expect(racine().querySelector('.pv-workflow__actions [data-geste]')).toBeNull();
      expect(texte(racine().querySelector('.ep__indispo'))).toContain('Signer ma part du PV : geste indisponible sur cet écran.');
    });

    it('*appCan retire le bouton : indisponible aussi', async () => {
      await ouvrir('PRESIDENT', 'PRESID1', null, '/president/dossier/42', { gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'] })]) }, ['PV_SIGNER']);
      expect(boutonsWorkflow()).not.toContain('Viser…');
      expect(texte(racine().querySelector('.ep__indispo'))).toContain('Viser le projet de PV : geste indisponible');
    });

    it('Membre désigné : « Signer » offert, aucune mention', async () => {
      const accepte = { ...PV, statutPv: 'PROJET_ACCEPTE' as const, imMembreCoSignataire: 'MEMANT2', dateSignaturePresident: '2026-09-15' };
      await ouvrir('MEMBRE', 'MEMANT2', 'ANT', '/membre/dossier/42', { gestes: reponse('MEMBRE', [tache('PV_A_SIGNER', 'SIGNER')]), pv: accepte });
      expect(boutonsWorkflow()).toEqual(['Signer']);
      expect(racine().querySelector('.ep__indispo')).toBeNull();
    });
  });

  it('lecture du PV en échec : erreur dans le panneau, sans toast, gestes signalés ; « Réessayer » relit le PV', async () => {
    await ouvrir('PRESIDENT', 'PRESID1', null, '/president/dossier/42', { gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER')]), pv: { status: 500 } });
    expect(texte(racine().querySelector('.ep__erreur'))).toContain("Le projet de PV n'a pas pu être chargé.");
    expect(texte(racine().querySelector('.ep__indispo'))).toContain('Viser le projet de PV : geste indisponible');
    expect(toast.error).not.toHaveBeenCalled();
    expect((racine().querySelector('.ep-volet__voir') as HTMLButtonElement).disabled).toBe(true);

    demandees = [];
    scenario = { ...scenario, pv: PV };
    (racine().querySelector('.ep__erreur button') as HTMLButtonElement).click();
    repondre();
    expect(demandees).toEqual(['GET /api/pv-examens/12', 'GET /api/examen-details', 'GET /api/examen-pieces?examen=9']);
    expect(boutonsWorkflow()).toContain('Viser…');
    expect(racine().querySelector('.ep__indispo, .ep__erreur')).toBeNull();
  });

  it('« Voir le projet de PV » : la modale de détail, annoncée comme projet et non « Définitif »', async () => {
    await ouvrir('PRESIDENT', 'PRESID1', null, '/president/dossier/42', { gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER')]) });
    cliquer(/^Voir le projet de PV$/);
    repondre();
    const modale = racine().querySelector('app-detail-pv-modal [role="dialog"]');
    expect(modale?.getAttribute('aria-label')).toBe('Détail du projet de PV');
    expect(texte(modale)).toContain('Projet soumis');
    expect(texte(modale)).not.toContain('Définitif');
  });

  it('?geste=VISER : le bouton de PvWorkflow reçoit le focus, rien ne s’ouvre ni ne part ; la barre collante y ramène', async () => {
    await ouvrir('PRESIDENT', 'PRESID1', null, '/president/dossier/42?geste=VISER', { gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'] })]) });
    await harness.fixture.whenStable();
    repondre();
    expect(texte(document.activeElement)).toBe('Viser…');
    expect(racine().querySelector('.pv-workflow__retour')).toBeNull();
    expect(demandees.filter((d) => d.startsWith('POST'))).toEqual([]);

    (document.activeElement as HTMLElement).blur();
    (racine().querySelector('app-barre-collante button') as HTMLButtonElement).click();
    expect(texte(document.activeElement)).toBe('Viser…');
  });

  describe('règle C2 — PRMP et UGPM, sur une doublure qui leur servirait la navette et des noms', () => {
    for (const role of ['PRMP', 'UGPM'] as const) {
      it(`${role} : aucune requête de PV ni d’examen, ni PvWorkflow, ni volet, aucun nom`, async () => {
        await ouvrir(role, 'PRMP001', null, '/prmp/dossier/42', { gestes: reponse(role, [tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'] })]) });
        expect(demandees.filter((d) => /pv-examens|examen-details|examen-pieces|avis|controleurs|profiles/.test(d))).toEqual([]);
        expect(racine().querySelector('app-etape-pv, app-pv-workflow, .ep-volet')).toBeNull();
        const el = racine();
        const dom = `${el.textContent ?? ''} ${Array.from(el.querySelectorAll('*')).flatMap((n) => Array.from(n.attributes).map((a) => a.value)).join(' ')}`;
        for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
      });
    }
  });
});
