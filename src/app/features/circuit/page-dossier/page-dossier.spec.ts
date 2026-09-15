import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ToastService } from '../../../core/notifications/toast.service';
import { Dossier, Marche, Ppm, Role } from '../../../models';
import { PageDossier } from './page-dossier';

@Component({ template: '' })
class Vide {}

/** Noms et matricules des contrôleurs portés par la doublure : aucun ne doit atteindre le DOM de la PRMP. */
const CONTROLEURS = ['Voahangy Rasoa', 'Jean Claude Rakoto', 'Solofo Rakotondrabe', 'Tojo Andriatsimahavandy', 'Faniry Randriamampionona', 'SECANT1', 'MEMANT1', 'CCANT01', 'VERANT1', 'ASSANT1'];

/**
 * Doublure d'un `DossierDto` qui porte des identités de contrôleurs — ce que le serveur NE sert PAS à la
 * PRMP ni à l'UGPM (règle C2) : la page ne doit pas s'en remettre à lui seul.
 */
const DOSSIER_NOMME: Dossier = {
  idDossier: 42,
  refeDossier: '00042/PPM/CNM/2026',
  idTypeDossier: 'DDP',
  idSousType: 'PPM',
  statut: 'EXAMINE',
  idLocalite: 'ANT',
  idEntiteContract: 3,
  datePrevisionnelleFin: '2026-09-24',
  datesEtapes: { RECEPTION: '2026-09-04T10:00:00', DISPATCH: '2026-09-07T09:00:00', EXAMEN: '2026-09-11T11:50:00', PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Jean Claude Rakoto', EXAMEN: 'Jean Claude Rakoto', PROJET_PV: 'Jean Claude Rakoto · Solofo Rakotondrabe', PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  imVerificateurCible: 'VERANT1',
  nomVerificateurCible: 'Tojo Andriatsimahavandy',
  imAssistantCible: 'ASSANT1',
  nomAssistantCible: 'Faniry Randriamampionona',
};
const PPM: Ppm = { idPpm: 9, idDossier: 42, exercice: 2026, signataire: 'Lova Andrianjafy', dateSignature: '2026-08-28', reference: '00042/MTP/PPM/2026' };
const MARCHE: Marche = { idDetail: 5, idDossier: 42, designationMarche: 'Travaux de réhabilitation' } as Marche;

/** Requêtes internes CNM : jamais pour la PRMP ni l'UGPM. */
const INTERNE = /\/(journal|chronometrage|historique-echanges)(\?|$)|\/pv-examens|\/observations-pv|\/navettes/;

describe('Page dossier', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  /** Toutes les URL demandées depuis l'ouverture, réponses comprises. */
  let demandees: string[];

  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function ouvrir(role: Role, url: string): Promise<void> {
    toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    demandees = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: ':espace/dossier/:idDossier', component: PageDossier },
          { path: '**', component: Vide },
        ]),
        { provide: AuthService, useValue: { role: signal<Role | null>(role), logout: vi.fn() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
  }

  /** Répond à tout ce qui attend, jusqu'à épuisement : le dossier, puis la vague du store. */
  function repondre(dossier: Dossier = DOSSIER_NOMME): void {
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        const url = req.request.urlWithParams;
        demandees.push(url);
        if (url === `/api/dossiers/${dossier.idDossier}`) req.flush(dossier);
        else if (url === `/api/dossiers/${dossier.idDossier}/gestes`) req.flush({ idDossier: dossier.idDossier, profil: 'PRESIDENT', genereLe: '2026-09-15T10:00:00.1', etapeCourante: null, taches: [] });
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else if (url.endsWith('/journal')) req.flush([{ idAction: 1, typeAction: 'DISPATCH', dateAction: '2026-09-07T09:00:00', auteur: 'CCANT01', nomOperateur: 'Solofo Rakotondrabe' }]);
        else if (url === '/api/ppms') req.flush([PPM]);
        else if (url === '/api/marches') req.flush([MARCHE]);
        else req.flush([]);
      }
      harness.detectChanges();
    }
    harness.detectChanges();
  }

  /** Texte ET attributs (infobulles, libellés accessibles) de toute la page rendue. */
  function toutLeDom(): string {
    const el = racine();
    const attributs = Array.from(el.querySelectorAll('*')).flatMap((n) => Array.from(n.attributes).map((a) => a.value));
    return `${el.textContent ?? ''} ${attributs.join(' ')}`;
  }

  describe('règle C2 — PRMP et UGPM', () => {
    for (const role of ['PRMP', 'UGPM'] as const) {
      it(`${role} : aucune requête interne, aucun nom ni matricule de contrôleur dans la page`, async () => {
        await ouvrir(role, '/prmp/dossier/42');
        repondre();
        expect(racine().querySelector('h1')?.textContent?.trim()).toBe('00042/PPM/CNM/2026');
        expect(racine().querySelectorAll('.pd-etape').length).toBe(7);
        expect(demandees.filter((u) => INTERNE.test(u))).toEqual([]);
        const dom = toutLeDom();
        for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
        // Ni Journal ni Délais.
        expect(Array.from(racine().querySelectorAll('button')).map((b) => texte(b))).not.toContain('Délais');
        expect(racine().querySelector('.pd-outils')).toBeNull();
        // La date reste : « date seule » au survol.
        expect(racine().querySelectorAll('.pd-etape')[1].getAttribute('title')).toBe('Dispatch · lun. 07/09/2026');
        // La référence PPM de la PRMP est montrée (règle existante).
        expect(texte(racine().querySelector('.pd-puces'))).toContain('Réf. PRMP 00042/MTP/PPM/2026');
      });
    }

    it('contre-épreuve — Président : la même doublure montre les acteurs, Journal et Délais', async () => {
      await ouvrir('PRESIDENT', '/president/dossier/42');
      repondre();
      expect(demandees).toContain('/api/dossiers/42/journal');
      expect(demandees).toContain('/api/dossiers/42/chronometrage');
      expect(racine().querySelectorAll('.pd-etape')[1].getAttribute('title')).toBe('Dispatch · lun. 07/09/2026 · Attribué à Jean Claude Rakoto');
      expect(texte(racine().querySelector('.pd-outils'))).toContain('Journal');
      expect(texte(racine().querySelector('.pd-puces'))).not.toContain('Réf. PRMP');
    });
  });

  describe("états d'ouverture : un seul message, aucun toast", () => {
    const echouer = async (status: number): Promise<void> => {
      await ouvrir('CHEF_COMMISSION', '/cc/dossier/42');
      http.expectOne('/api/dossiers/42').flush({ message: 'refus' }, { status, statusText: 'x' });
      harness.detectChanges();
    };

    it('403 : « hors de votre périmètre », sans Réessayer ni autre requête', async () => {
      await echouer(403);
      const erreurs = racine().querySelectorAll('app-etat-erreur');
      expect(erreurs.length).toBe(1);
      expect(texte(erreurs[0])).toContain('Ce dossier est hors de votre périmètre.');
      expect(erreurs[0].querySelector('button')).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
      http.expectNone(() => true);
      expect(racine().querySelector('h1')?.textContent?.trim()).toBe('Dossier n° 42');
    });

    it('404 : « n’existe pas », sans toast', async () => {
      await echouer(404);
      expect(texte(racine().querySelector('app-etat-erreur'))).toContain("Ce dossier n'existe pas.");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('échec serveur : Réessayer relance la lecture du dossier', async () => {
      await echouer(500);
      const bouton = racine().querySelector<HTMLButtonElement>('app-etat-erreur button');
      expect(texte(racine().querySelector('app-etat-erreur'))).toContain("Le dossier n'a pas pu être chargé.");
      expect(toast.error).not.toHaveBeenCalled();
      bouton?.click();
      http.expectOne('/api/dossiers/42').flush(DOSSIER_NOMME);
      repondre();
      expect(racine().querySelector('app-etat-erreur')).toBeNull();
      expect(racine().querySelector('h1')?.textContent?.trim()).toBe('00042/PPM/CNM/2026');
    });

    it('identifiant illisible : introuvable, sans appel', async () => {
      await ouvrir('MEMBRE', '/membre/dossier/abc');
      harness.detectChanges();
      http.expectNone(() => true);
      expect(texte(racine().querySelector('app-etat-erreur'))).toContain("Ce dossier n'existe pas.");
    });

    it('pendant la lecture : un indicateur role="status"', async () => {
      await ouvrir('MEMBRE', '/membre/dossier/42');
      expect(racine().querySelector('[role="status"]')).not.toBeNull();
      http.expectOne('/api/dossiers/42');
    });
  });

  describe("fil d'Ariane", () => {
    const lien = (): HTMLAnchorElement | null => racine().querySelector('.pd-ariane__retour');

    for (const forge of ['//exemple.org', 'https://exemple.org', 'javascript:alert(1)']) {
      it(`returnUrl « ${forge} » refusé : retour à « À faire » de l'espace`, async () => {
        await ouvrir('VERIFICATEUR', `/verificateur/dossier/42?returnUrl=${encodeURIComponent(forge)}`);
        repondre();
        expect(lien()?.getAttribute('href')).toBe('/verificateur/a-faire');
        expect(texte(lien())).toBe('À faire');
      });
    }

    it('returnUrl interne suivi, paramètres compris', async () => {
      await ouvrir('SECRETAIRE', `/secretaire/dossier/42?returnUrl=${encodeURIComponent('/secretaire/tableau-de-bord?page=2')}`);
      repondre();
      expect(lien()?.getAttribute('href')).toBe('/secretaire/tableau-de-bord?page=2');
      expect(texte(lien())).toBe('Retour');
    });
  });
});
