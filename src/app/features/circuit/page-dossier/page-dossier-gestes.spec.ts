import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { PermissionsService } from '../../../core/auth/permissions.service';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ToastService } from '../../../core/notifications/toast.service';
import { AFaireDelai, AFaireTache, Dispatch, Dossier, EtapeCouranteDossier, GesteAFaire, GestesDossier, ModeTache, Reception, Role, SectionAFaire } from '../../../models';
import { exempleAFairePresident } from '../../home/a-faire/a-faire-contrat.exemple';
import { CompleterPiecesDepotModal } from '../../prmp/completer-pieces-depot-modal';
import { DossiersRefreshStore } from '../../prmp/dossiers-refresh.store';
import { DispatchForm, DispatchItem } from '../dispatch-form';
import { ReceptionForm } from '../reception-form';
import { PageDossier } from './page-dossier';
import { PageDossierCorps } from './page-dossier-corps';

@Component({ template: '' })
class Vide {}

// Doublures des modales de geste : même sélecteur, mêmes entrées et sorties.
@Component({ selector: 'app-dispatch-form', template: '<p class="doublure-dispatch">{{ items().length }}</p>' })
class DispatchFormDoublure {
  readonly items = input.required<DispatchItem[]>();
  readonly reattribution = input<Dispatch | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();
}
@Component({ selector: 'app-reception-form', template: '<p class="doublure-reception">{{ dossier().idDossier }}</p>' })
class ReceptionFormDoublure {
  readonly dossier = input.required<Dossier>();
  readonly saved = output<Reception | null>();
  readonly closed = output<void>();
}
@Component({ selector: 'app-completer-pieces-depot-modal', template: '<p class="doublure-pieces">{{ dossier().idDossier }}</p>' })
class PiecesDepotDoublure {
  readonly dossier = input.required<Dossier>();
  readonly transmis = output<Dossier>();
  readonly fermer = output<void>();
}

const DELAI: AFaireDelai = { etape: null, entree: null, standardHeures: null, ecouleHeures: null, restantHeures: null, echeance: null, pauseDepuis: null, pauseHeures: null, datePrevisionnelleFin: null };
const CONTROLEURS = ['Voahangy Rasoa', 'Jean Claude Rakoto', 'Solofo Rakotondrabe', 'Tojo Andriatsimahavandy', 'Faniry Randriamampionona', 'SECANT1', 'MEMANT1', 'CCANT01', 'VERANT1', 'ASSANT1'];

const DOSSIER: Dossier = {
  idDossier: 42,
  refeDossier: '00042/PPM/CNM/2026',
  idTypeDossier: 'DDP',
  idSousType: 'PPM',
  statut: 'PRET_DISPATCH',
  idLocalite: 'ANT',
  idEntiteContract: 3,
  datesEtapes: { RECEPTION: '2026-09-15T10:42:10.496548', DISPATCH: null, EXAMEN: null, PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Jean Claude Rakoto', EXAMEN: null, PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  nomVerificateurCible: 'Tojo Andriatsimahavandy',
  imVerificateurCible: 'VERANT1',
};

/** Ligne servie, sur la forme exacte d'« À faire » ; la doublure porte des NOMS de contrôleurs. */
function tache(section: SectionAFaire, geste: GesteAFaire, rang: number, autres: Partial<AFaireTache> = {}): AFaireTache {
  const base = exempleAFairePresident().taches[0];
  return {
    ...base,
    section,
    geste,
    rang,
    gestesSecondaires: [],
    mode: 'TITULAIRE' as ModeTache,
    dossier: { ...base.dossier, idDossier: 42, acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Jean Claude Rakoto' } },
    faits: { ...base.faits, consigneDispatch: 'Voir avec Solofo Rakotondrabe', montantTotal: 345000000 },
    refs: { idReception: 7, idDispatch: 3, idExamen: null, idPv: 12, idLettre: 5, idDemandeRetrait: 77 },
    ...autres,
  };
}
const chrono = (urgence: EtapeCouranteDossier['urgence'], delai: Partial<AFaireDelai>): EtapeCouranteDossier => ({ urgence, delai: { ...DELAI, ...delai } });
const DISPATCH_BIENTOT = chrono('BIENTOT', { etape: 'DISPATCH', entree: '2026-09-15T10:42:10.496548', standardHeures: 8, ecouleHeures: 5, restantHeures: 3, echeance: '2026-09-16T10:43:00' });
const reponse = (profil: Role, taches: AFaireTache[], etapeCourante: EtapeCouranteDossier | null = DISPATCH_BIENTOT): GestesDossier => ({ idDossier: 42, profil, genereLe: '2026-09-15T21:08:29.5582001', etapeCourante, taches });

/** Gestes servis attendus en boutons : geste et secondaires de chaque ligne, sans VOIR ni SUIVRE. */
const servis = (g: GestesDossier): string[] => [...new Set(g.taches.flatMap((t) => [t.geste, ...t.gestesSecondaires]).filter((x) => x !== 'VOIR' && x !== 'SUIVRE'))].sort();

describe('Page dossier — étape en cours et gestes (lot L4-F3)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let refresh: { notifierChangement: ReturnType<typeof vi.fn> };
  let demandees: string[];

  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const gestesAffiches = (sel = 'app-etape-courante'): string[] => Array.from(racine().querySelectorAll(`${sel} [data-geste]`)).map((b) => b.getAttribute('data-geste') as string);

  async function ouvrir(role: Role, url: string): Promise<void> {
    toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    refresh = { notifierChangement: vi.fn() };
    demandees = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: ':espace/dossier/:idDossier', component: PageDossier },
          { path: '**', component: Vide },
        ]),
        // `ref` et `localite` : lus par `PvWorkflow`, monté pour la navette du PV (lot F4) ; toutes capacités.
        { provide: AuthService, useValue: { role: signal<Role | null>(role), ref: signal<string | null>('PRESID1'), localite: signal<string | null>(null), logout: vi.fn() } },
        { provide: PermissionsService, useValue: { can: () => true } },
        { provide: ToastService, useValue: toast },
        { provide: DossiersRefreshStore, useValue: refresh },
      ],
    });
    TestBed.overrideComponent(PageDossierCorps, {
      remove: { imports: [ReceptionForm, DispatchForm, CompleterPiecesDepotModal] },
      add: { imports: [ReceptionFormDoublure, DispatchFormDoublure, PiecesDepotDoublure] },
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
  }

  type Reponse = GestesDossier | { status: number };
  /** Répond à tout ce qui attend : dossier, gestes (ou erreur), vague du store, lectures des modales. */
  function repondre(gestes: Reponse, dossier: Dossier = DOSSIER): void {
    let attente: TestRequest[];
    while ((attente = http.match(() => true)).length) {
      for (const req of attente) {
        const url = req.request.urlWithParams;
        demandees.push(url);
        if (url === '/api/dossiers/42') req.flush(dossier);
        else if (url === '/api/dossiers/42/gestes') {
          if ('status' in gestes) req.flush({ message: 'x' }, { status: gestes.status, statusText: 'x' });
          else req.flush(gestes);
        } else if (url === '/api/receptions/7') req.flush({ idReception: 7, idDossier: 42 });
        else if (url === '/api/dispatchs/3') req.flush({ idDispatch: 3, idReception: 7 });
        // Projet de PV de la navette (lot F4) : soumis, visé par intérim (le dispatcheur est un autre).
        else if (url === '/api/pv-examens/12') req.flush({ idPv: 12, idExamen: 9, imCtrlMembre: 'MEMANT1', statutPv: 'PROJET_SOUMIS', nbNavettes: 1, imDispatcheur: 'CCANT01' });
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else req.flush([]);
      }
      harness.detectChanges();
    }
    harness.detectChanges();
  }

  function toutLeDom(): string {
    const el = racine();
    const attributs = Array.from(el.querySelectorAll('*')).flatMap((n) => Array.from(n.attributes).map((a) => a.value));
    return `${el.textContent ?? ''} ${attributs.join(' ')}`;
  }

  describe('parité : les gestes affichés sont ceux que sert le serveur', () => {
    const cas: { role: Role; espace: string; gestes: GestesDossier }[] = [
      { role: 'PRESIDENT', espace: 'president', gestes: reponse('PRESIDENT', [tache('A_DISPATCHER', 'DISPATCHER', 1)]) },
      {
        role: 'CHEF_COMMISSION',
        espace: 'cc',
        gestes: reponse('CHEF_COMMISSION', [
          tache('A_EXAMINER', 'REATTRIBUER', 1, { gestesSecondaires: ['EXAMINER'] }),
          tache('LETTRES_A_SIGNER', 'SIGNER_LETTRE', 2),
          tache('RETRAITS_A_DECIDER', 'DECIDER_RETRAIT', 3),
          tache('A_RECEPTIONNER', 'NUMEROTER', 4, { mode: 'DELEGATION' }),
        ]),
      },
      { role: 'PRESIDENT', espace: 'president', gestes: reponse('PRESIDENT', [tache('PV_A_VISER', 'VISER', 1, { gestesSecondaires: ['RETOURNER'], mode: 'INTERIM' })]) },
      { role: 'MEMBRE', espace: 'membre', gestes: reponse('MEMBRE', []) },
      { role: 'VERIFICATEUR', espace: 'verificateur', gestes: reponse('VERIFICATEUR', [tache('EN_ATTENTE_PRMP', 'VOIR', 1, { urgence: 'EN_PAUSE' })]) },
      { role: 'ASSISTANT_CONTROLEUR', espace: 'assistant', gestes: reponse('ASSISTANT_CONTROLEUR', [tache('A_ARCHIVER', 'ARCHIVER_PV', 1, { mode: 'COLLEGUE' }), tache('LETTRES_A_ARCHIVER', 'ARCHIVER_LETTRE', 2)]) },
      { role: 'SECRETAIRE', espace: 'secretaire', gestes: reponse('SECRETAIRE', [tache('A_RECEPTIONNER', 'NUMEROTER', 1)]) },
      { role: 'PRMP', espace: 'prmp', gestes: reponse('PRMP', [tache('A_RECTIFIER', 'RECTIFIER', 1)]) },
      { role: 'PRMP', espace: 'prmp', gestes: reponse('PRMP', [tache('PIECES_DEPOT_A_COMPLETER', 'COMPLETER_PIECES_DEPOT', 1)]) },
      { role: 'UGPM', espace: 'prmp', gestes: reponse('UGPM', [tache('BROUILLONS', 'COMPLETER_BROUILLON', 1)]) },
      { role: 'UGPM', espace: 'prmp', gestes: reponse('UGPM', [tache('EN_COURS_CNM', 'SUIVRE', 1, { urgence: 'SUIVI' })]) },
    ];
    for (const c of cas) {
      const libelle = c.gestes.taches.map((t) => [t.geste, ...t.gestesSecondaires].join('+')).join(', ') || 'aucun';
      it(`${c.role} — ${libelle}`, async () => {
        await ouvrir(c.role, `/${c.espace}/dossier/42`);
        repondre(c.gestes);
        expect(gestesAffiches().sort()).toEqual(servis(c.gestes));
        // Le principal est la ligne la mieux rangée ; la barre collante porte le même.
        expect(gestesAffiches('app-barre-collante')).toEqual(servis(c.gestes).length ? [c.gestes.taches[0].geste] : []);
        expect(toast.error).not.toHaveBeenCalled();
      });
    }
  });

  describe('règle C2 — sur une doublure qui porte des noms, un reste et une échéance', () => {
    const retard = chrono('EN_RETARD', { etape: 'VERIFICATION', entree: '2026-09-10T10:00:00.1', standardHeures: 8, ecouleHeures: 9, restantHeures: -1, echeance: '2026-09-15T10:00:00' });
    const pause = chrono('EN_PAUSE', { etape: 'RECTIFICATION_PRMP', standardHeures: 8, ecouleHeures: 5, restantHeures: 3, echeance: '2026-09-16T10:47:00', pauseDepuis: '2026-09-15T10:46:53.961635', pauseHeures: 5 });

    it('PRMP : « à vous », la pause seule ; aucun nom, ni reste, ni échéance', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42');
      repondre(reponse('PRMP', [tache('A_RECTIFIER', 'RECTIFIER', 1, { urgence: 'EN_PAUSE' })], pause), { ...DOSSIER, statut: 'EN_ATTENTE_DECISION_PRMP', attentePrmp: true });
      expect(texte(racine().querySelector('.ec__sur'))).toBe('Étape 6 sur 7 · à vous');
      expect(texte(racine().querySelector('.ec-delai'))).toBe('En pause · chez vous depuis le 15/09');
      const dom = toutLeDom();
      for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
      expect(dom).not.toMatch(/Reste|avant |de retard|Consigne|Numéroté par/);
    });

    it('UGPM en suivi : « à la Commission nationale des marchés », aucun délai CNM', async () => {
      await ouvrir('UGPM', '/prmp/dossier/42');
      repondre(reponse('UGPM', [tache('EN_COURS_CNM', 'SUIVRE', 1, { urgence: 'SUIVI' })], retard), { ...DOSSIER, statut: 'EN_VERIFICATION' });
      expect(texte(racine().querySelector('.ec__sur'))).toContain('à la Commission nationale des marchés');
      expect(racine().querySelector('.ec-delai')).toBeNull();
      const dom = toutLeDom();
      for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
      expect(dom).not.toMatch(/Reste|avant |de retard|Vérificateur/);
    });

    it('contre-épreuve — Membre non attributaire : le porteur nommé et le délai', async () => {
      await ouvrir('MEMBRE', '/membre/dossier/42');
      repondre(reponse('MEMBRE', [], chrono('DANS_LES_DELAIS', { etape: 'EXAMEN', entree: '2026-09-15T10:00:00', standardHeures: 40, ecouleHeures: 5, restantHeures: 35, echeance: '2026-09-21T10:00:00' })), { ...DOSSIER, statut: 'DISPATCHE' });
      expect(texte(racine().querySelector('.ec__sur'))).toBe('Étape 3 sur 7 · chez Jean Claude Rakoto, Membre');
      expect(texte(racine().querySelector('.ec-delai'))).toMatch(/^Reste 35 h · avant /);
      expect(racine().querySelector('app-etape-courante button')).toBeNull();
    });
  });

  it('geste en modale : la modale s’ouvre par-dessus la page ; réussi, la page relit le dossier et ses gestes SEULEMENT', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42');
    repondre(reponse('PRESIDENT', [tache('A_DISPATCHER', 'DISPATCHER', 1)]));
    const corps = racine().querySelector('app-page-dossier-corps');
    expect(texte(racine().querySelector('.pd-puces'))).toMatch(/345\s000\s000 Ar/);

    (racine().querySelector('.ec__principal') as HTMLButtonElement).click();
    harness.detectChanges();
    demandees = [];
    repondre(reponse('PRESIDENT', [tache('A_DISPATCHER', 'DISPATCHER', 1)]));
    expect(demandees.sort()).toEqual(['/api/dossiers/42', '/api/receptions/7']);
    expect(texte(racine().querySelector('.doublure-dispatch'))).toBe('1');

    demandees = [];
    harness.fixture.debugElement.query((d) => d.name === 'app-dispatch-form').componentInstance.saved.emit();
    harness.detectChanges();
    expect(racine().querySelector('.doublure-dispatch')).toBeNull();
    expect(refresh.notifierChangement).toHaveBeenCalledTimes(1);
    // Pendant la relecture, les gestes attendent.
    expect((racine().querySelector('.ec__principal') as HTMLButtonElement).disabled).toBe(true);
    repondre(reponse('PRESIDENT', [], chrono('DANS_LES_DELAIS', { etape: 'EXAMEN', restantHeures: 40, standardHeures: 40, ecouleHeures: 0, entree: '2026-09-15T21:00:00' })), { ...DOSSIER, statut: 'DISPATCHE' });
    // Recette L4-Q2, défaut (m) : les deux restitutions suivent le geste (compteur du bouton « Journal ») ; ni documents ni référentiels.
    expect(demandees.sort()).toEqual(['/api/dossiers/42', '/api/dossiers/42/chronometrage', '/api/dossiers/42/gestes', '/api/dossiers/42/journal']);
    // Même corps (documents et store en place), étape suivante affichée.
    expect(racine().querySelector('app-page-dossier-corps')).toBe(corps);
    expect(texte(racine().querySelector('.ec__titre'))).toBe('Examen en cours');
    expect(racine().querySelector('.ec__principal')).toBeNull();
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement?.classList.contains('ec__titre')).toBe(true);
  });

  it('écran de travail : son URL dans l’espace, avec returnUrl vers la page', async () => {
    await ouvrir('MEMBRE', `/membre/dossier/42?returnUrl=${encodeURIComponent('/membre/tableau-de-bord')}`);
    repondre(reponse('MEMBRE', [tache('A_EXAMINER', 'EXAMINER', 1)], null), { ...DOSSIER, statut: 'DISPATCHE' });
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (racine().querySelector('.ec__principal') as HTMLButtonElement).click();
    expect(naviguer).toHaveBeenCalledWith(['/membre', 'examiner', 42], { queryParams: { returnUrl: '/membre/dossier/42?returnUrl=%2Fmembre%2Ftableau-de-bord' } });
  });

  describe('?geste= à l’arrivée', () => {
    it('servi et court : sa modale s’ouvre, puis le paramètre quitte l’URL', async () => {
      await ouvrir('SECRETAIRE', '/secretaire/dossier/42?geste=NUMEROTER');
      repondre(reponse('SECRETAIRE', [tache('A_RECEPTIONNER', 'NUMEROTER', 1)]), { ...DOSSIER, statut: 'SOUMIS' });
      await harness.fixture.whenStable();
      repondre(reponse('SECRETAIRE', [tache('A_RECEPTIONNER', 'NUMEROTER', 1)]), { ...DOSSIER, statut: 'SOUMIS' });
      expect(texte(racine().querySelector('.doublure-reception'))).toBe('42');
      expect(TestBed.inject(Router).url).toBe('/secretaire/dossier/42');
    });

    it('forgé ou non servi : ignoré, aucune lecture de modale, paramètre retiré', async () => {
      for (const forge of ['DISPATCHER', 'SUPPRIMER']) {
        TestBed.resetTestingModule();
        await ouvrir('SECRETAIRE', `/secretaire/dossier/42?geste=${forge}&returnUrl=%2Fsecretaire%2Fa-faire`);
        repondre(reponse('SECRETAIRE', [tache('A_RECEPTIONNER', 'NUMEROTER', 1)]), { ...DOSSIER, statut: 'SOUMIS' });
        await harness.fixture.whenStable();
        repondre(reponse('SECRETAIRE', []));
        expect(demandees.filter((u) => u.startsWith('/api/receptions'))).toEqual([]);
        expect(racine().querySelector('.doublure-reception, .doublure-dispatch')).toBeNull();
        expect(TestBed.inject(Router).url).toBe('/secretaire/dossier/42?returnUrl=%2Fsecretaire%2Fa-faire');
      }
    });

    it('servi mais écran de travail : le bouton reçoit le focus, la page reste', async () => {
      await ouvrir('MEMBRE', '/membre/dossier/42?geste=EXAMINER');
      const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate');
      repondre(reponse('MEMBRE', [tache('A_EXAMINER', 'EXAMINER', 1)]), { ...DOSSIER, statut: 'DISPATCHE' });
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement?.getAttribute('data-geste')).toBe('EXAMINER');
      expect(naviguer.mock.calls.some(([commandes]) => Array.isArray(commandes) && commandes.includes('examiner'))).toBe(false);
    });
  });

  describe('repli : le serveur ne sert pas les gestes', () => {
    for (const status of [404, 405, 400]) {
      it(`${status} : lecture seule, une mention discrète, aucun toast`, async () => {
        await ouvrir('PRESIDENT', '/president/dossier/42');
        repondre({ status });
        expect(texte(racine().querySelector('.pd-lecture-seule'))).toContain('Lecture seule');
        expect(racine().querySelector('app-etape-courante, app-barre-collante, app-etat-erreur')).toBeNull();
        expect(racine().querySelector('h1')?.textContent?.trim()).toBe('00042/PPM/CNM/2026');
        expect(toast.error).not.toHaveBeenCalled();
      });
    }

    it('panne : « Réessayer » relit les gestes seuls', async () => {
      await ouvrir('PRESIDENT', '/president/dossier/42');
      repondre({ status: 500 });
      expect(toast.error).not.toHaveBeenCalled();
      demandees = [];
      (racine().querySelector('app-etat-erreur button') as HTMLButtonElement).click();
      repondre(reponse('PRESIDENT', [tache('A_DISPATCHER', 'DISPATCHER', 1)]));
      expect(demandees).toEqual(['/api/dossiers/42/gestes']);
      expect(gestesAffiches()).toEqual(['DISPATCHER']);
    });
  });

  describe('barre collante', () => {
    let rappel: IntersectionObserverCallback | null;
    const origine = globalThis.IntersectionObserver;
    beforeEach(() => {
      rappel = null;
      globalThis.IntersectionObserver = class {
        constructor(cb: IntersectionObserverCallback) {
          rappel = cb;
        }
        observe(): void {}
        disconnect(): void {}
      } as unknown as typeof IntersectionObserver;
    });
    afterEach(() => {
      globalThis.IntersectionObserver = origine;
    });
    const signaler = (sorti: boolean): void => {
      rappel?.([{ isIntersecting: !sorti, boundingClientRect: { bottom: sorti ? 20 : 500 } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
      harness.detectChanges();
    };

    it('dépliée quand le panneau sort par le haut ; même geste ; le focus revient au panneau au repli', async () => {
      await ouvrir('PRESIDENT', '/president/dossier/42');
      repondre(reponse('PRESIDENT', [tache('A_DISPATCHER', 'DISPATCHER', 1)]));
      const barre = racine().querySelector('app-barre-collante') as HTMLElement;
      expect(barre.classList.contains('bc--visible')).toBe(false);
      expect(rappel).not.toBeNull();

      signaler(true);
      expect(barre.classList.contains('bc--visible')).toBe(true);
      expect(racine().querySelector('app-page-dossier-corps')?.classList.contains('pd--barre')).toBe(true);
      expect(texte(barre)).toContain('00042/PPM/CNM/2026');
      const bouton = barre.querySelector('button') as HTMLButtonElement;
      expect(bouton.getAttribute('data-geste')).toBe('DISPATCHER');
      // Un vrai bouton, dans l'ordre du document : atteignable au clavier, aucun tabindex imposé.
      expect(bouton.hasAttribute('tabindex')).toBe(false);

      bouton.focus();
      signaler(false);
      expect(barre.classList.contains('bc--visible')).toBe(false);
      expect(document.activeElement).toBe(racine().querySelector('.ec__principal'));
    });
  });
  // ⚠️ Lot 1b (23/09) — la fiche marché du dossier d’appel d’offres. Ce que ces tests protègent : l’encart
  // n'existe QUE sur le sous-type DAO ; il montre ce qui est lié sans second appel (le serveur sert le résumé
  // dans le dossier) ; le RATTACHEMENT n'est qu'un secours, réservé au domaine PRMP sur un dossier encore en
  // brouillon — un dossier parti à la Commission se lit, ne se rattache plus.
  describe('fiche marché du dossier (lot 1b)', () => {
    const RESUME = {
      idDmc: 7, idDetail: 302873, refeDossierPpm: '00001/PPM-AGPM/CNM/2026', designationMarche: 'Fourniture de mobilier',
      typeMarche: 'QUANTITE_FIXE' as const, statut: 'VALIDEE' as const, version: 2, nbSaisis: 104, nbAttendus: 104,
    };
    const DAO = (p: Partial<Dossier> = {}): Dossier =>
      ({ ...DOSSIER, idTypeDossier: 'DMC', idSousType: 'DAO', statut: 'BROUILLON', refeDossier: '100332', ...p });
    const encart = (): HTMLElement | null => racine().querySelector('app-fiche-marche-dossier');
    const bouton = (nom: string): HTMLButtonElement | undefined => Array.from(encart()?.querySelectorAll('button') ?? []).find((b) => texte(b) === nom);

    it('fiche rattachée : son état, sa version, ses informations et le lien qui l’ouvre', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42');
      repondre(reponse('PRMP', []), DAO({ idDmc: 7, ficheMarche: RESUME }));
      expect(Array.from(encart()?.querySelectorAll('.fmd__ligne span') ?? []).map((s) => texte(s))).toEqual([
        'Validée', 'version 2', '· 104 sur 104 informations', '· ligne du plan 00001/PPM-AGPM/CNM/2026',
      ]);
      expect(texte(encart()?.querySelector('.fmd__obj'))).toBe('Fourniture de mobilier');
      expect(encart()?.querySelector('a[href="/prmp/dao/7"]')).not.toBeNull();
      // Le dossier est encore en brouillon : on peut défaire une liaison posée par erreur.
      expect(bouton('Détacher')).toBeDefined();
    });

    it('sans fiche, la PRMP rattache celle qu’elle a validée, et la page relit le dossier', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42');
      repondre(reponse('PRMP', []), DAO());
      expect(texte(encart())).toContain("Aucune fiche marché n'est rattachée");
      bouton('Rattacher une fiche marché')?.click();
      harness.detectChanges();
      http.expectOne('/api/fiches-marche/rattachables').flush([
        { idDmc: 7, idDetail: 302873, refeDossierPpm: '00001/PPM-AGPM/CNM/2026', designationMarche: 'Fourniture de mobilier', version: 2, dateValidation: '2026-09-23T10:00:00' },
      ]);
      harness.detectChanges();
      expect(texte(encart()?.querySelector('.fmd__liste-obj'))).toBe('Fourniture de mobilier');

      bouton('Rattacher')?.click();
      const put = http.expectOne('/api/dossiers/42/fiche-marche');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ idDmc: 7 });
      put.flush(DAO({ idDmc: 7, ficheMarche: RESUME }));
      harness.detectChanges();
      // Le dossier est relu : la page le redemande, avec ses gestes.
      expect(http.match('/api/dossiers/42').length).toBe(1);
      expect(toast.success).toHaveBeenCalledWith('Fiche marché rattachée à ce dossier.');
    });

    it('dossier parti à la Commission, ou profil de contrôle : on lit la fiche, on ne la rattache plus', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42');
      repondre(reponse('PRMP', []), DAO({ statut: 'PRET_DISPATCH', idDmc: 7, ficheMarche: RESUME }));
      expect(bouton('Détacher')).toBeUndefined();
      expect(encart()?.querySelector('a[href="/prmp/dao/7"]')).not.toBeNull();
      TestBed.resetTestingModule();

      await ouvrir('MEMBRE', '/membre/dossier/42');
      repondre(reponse('MEMBRE', []), DAO({ idDmc: 7, ficheMarche: RESUME }));
      expect(texte(encart()?.querySelector('.fmd__etat'))).toBe('Validée');
      expect(bouton('Rattacher une fiche marché')).toBeUndefined();
      // La fiche s'ouvre dans l'espace PRMP : pas de lien pour qui ne peut pas y aller.
      expect(encart()?.querySelector('a[href="/prmp/dao/7"]')).toBeNull();
    });

    it('aucun encart hors appel d’offres : un plan de passation n’a pas de fiche marché', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42');
      repondre(reponse('PRMP', []));
      expect(encart()).toBeNull();
    });
  });
});
