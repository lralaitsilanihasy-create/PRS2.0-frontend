import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/notifications/toast.service';
import { AFaireTache, DemandeRetrait, Dossier, GesteAFaire, GestesDossier, PvExamen, Role, SectionAFaire } from '../../models';
import { exempleAFairePresident } from '../home/a-faire/a-faire-contrat.exemple';
import { DossiersRefreshStore } from '../prmp/dossiers-refresh.store';
import { MOTIF_REFUS_MAX, erreurMotifRefus } from './decision-retrait';
import { PageDossier } from './page-dossier/page-dossier';

@Component({ template: '' })
class Vide {}

/** Noms et matricules de contrôleurs : aucun ne doit atteindre le DOM de la PRMP ni de l'UGPM. */
const CONTROLEURS = ['Voahangy Rasoa', 'Jean Claude Rakoto', 'Solofo Rakotondrabe', 'Lalatiana Ravao', 'Jean Baptiste Andriamampionona', 'MEMANT1', 'CCANT01', 'PRESID1', 'Rakotondrabe'];

const DOSSIER: Dossier = {
  idDossier: 42,
  refeDossier: '00042/PPM/CNM/2026',
  idTypeDossier: 'DDP',
  idSousType: 'PPM',
  statut: 'DISPATCHE',
  idLocalite: 'ANT',
  idEntiteContract: 3,
  datesEtapes: { RECEPTION: '2026-09-04T10:00:00', DISPATCH: '2026-09-07T09:00:00', EXAMEN: null, PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
  acteursEtapes: { RECEPTION: 'Voahangy Rasoa', DISPATCH: 'Jean Claude Rakoto', EXAMEN: null, PROJET_PV: null, PV_SIGNE: null, VERIFICATION: null, CLOTURE: null },
};

const MOTIF_PRMP = "Le ministère a revu son programme d'investissement.";
const DEMANDE: DemandeRetrait = { idDemandeRetrait: 77, idDossier: 42, idPrmp: 'PRMP001', motifRetrait: MOTIF_PRMP, dateDemande: '2026-09-15T23:57:48.376888', statut: 'EN_ATTENTE', nomFichier: 'lettre.pdf', tailleFichier: 193 };

const PV = { idPv: 12, idExamen: 9, idAvis: 'FAVR', imCtrlMembre: 'MEMANT1', statutPv: 'PROJET_SOUMIS', nbNavettes: 1, imDispatcheur: 'PRESID1', nomDispatcheur: 'Jean Baptiste Andriamampionona' } as PvExamen;

function tache(section: SectionAFaire, geste: GesteAFaire, autres: Partial<AFaireTache> = {}): AFaireTache {
  const base = exempleAFairePresident().taches[0];
  return {
    ...base,
    section,
    geste,
    rang: 1,
    gestesSecondaires: [],
    mode: 'TITULAIRE',
    urgence: 'SANS_DELAI',
    dossier: { ...base.dossier, idDossier: 42, acteursEtapes: { DISPATCH: 'Jean Claude Rakoto' } },
    delai: { ...base.delai, etape: null, entree: '2026-09-15T23:57:48.376888', standardHeures: null, ecouleHeures: null, restantHeures: null, echeance: null },
    faits: { ...base.faits, motifRetrait: MOTIF_PRMP, consigneDispatch: null, dernierRetourNavette: null, partsAttendues: null, idAvis: 'FAVR' },
    refs: { idReception: 7, idDispatch: 3, idExamen: 9, idPv: 12, idLettre: null, idDemandeRetrait: 77 },
    ...autres,
  };
}
const retrait = (autres: Partial<AFaireTache> = {}): AFaireTache => tache('RETRAITS_A_DECIDER', 'DECIDER_RETRAIT', autres);
const reponse = (profil: Role, taches: AFaireTache[], etapeCourante: GestesDossier['etapeCourante'] = null): GestesDossier => ({ idDossier: 42, profil, genereLe: '2026-09-15T23:59:00', etapeCourante, taches });

interface Scenario {
  gestes: GestesDossier;
  dossier?: Dossier;
  /** `GET /api/demande-retraits/77`. */
  demande?: DemandeRetrait | { status: number };
  /** `GET /api/demande-retraits` (PRMP). */
  demandes?: DemandeRetrait[];
  /** Relecture du dossier et de ses gestes refusée (le dossier a quitté le périmètre). */
  relectureRefusee?: number;
}

describe('Décision de retrait — motif de refus (règle)', () => {
  it('obligatoire : vide ou blanc refusé, avec le message affiché sous le champ', () => {
    for (const vide of ['', '   ', '\n\t', null, undefined]) expect(erreurMotifRefus(vide)).toBe('Indiquez le motif du refus : il est communiqué à la PRMP.');
    expect(erreurMotifRefus('  Pièces insuffisantes ')).toBeNull();
  });

  it('500 caractères au plus, espaces de bord non comptés (limite du serveur)', () => {
    expect(erreurMotifRefus('x'.repeat(MOTIF_REFUS_MAX))).toBeNull();
    expect(erreurMotifRefus(`  ${'x'.repeat(MOTIF_REFUS_MAX)}  `)).toBeNull();
    expect(erreurMotifRefus('x'.repeat(MOTIF_REFUS_MAX + 1))).toBe('Le motif du refus ne peut dépasser 500 caractères (501 saisis).');
  });
});

describe('Page dossier — décision de retrait dans le panneau (lot L4-F5)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let refresh: { notifierChangement: ReturnType<typeof vi.fn> };
  /** `MÉTHODE url` de chaque requête, dans l'ordre. */
  let demandees: string[];
  let scenario: Scenario;

  const racine = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const texte = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const q = <T extends Element = HTMLElement>(sel: string): T | null => racine().querySelector<T>(sel);
  const bouton = (libelle: string | RegExp, dans: ParentNode = racine()): HTMLButtonElement => {
    const b = Array.from(dans.querySelectorAll<HTMLButtonElement>('button')).find((x) => (typeof libelle === 'string' ? texte(x) === libelle : libelle.test(texte(x))));
    if (!b) throw new Error(`bouton introuvable : ${libelle}`);
    return b;
  };
  const cliquer = (libelle: string | RegExp, dans?: ParentNode): void => {
    bouton(libelle, dans).click();
    harness.detectChanges();
  };
  const saisir = (valeur: string): void => {
    const champ = q<HTMLTextAreaElement>('#dr-motif');
    if (!champ) throw new Error('champ du motif absent');
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    harness.detectChanges();
  };
  const mutations = (): TestRequest[] => http.match((r) => r.method !== 'GET');
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r));
  const toutLeDom = (): string => {
    const el = racine();
    return `${el.textContent ?? ''} ${Array.from(el.querySelectorAll('*')).flatMap((n) => Array.from(n.attributes).map((a) => a.value)).join(' ')}`;
  };

  async function ouvrir(role: Role, url: string, s: Scenario, ref = 'PRESID1', localite: string | null = null): Promise<void> {
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
        { provide: PermissionsService, useValue: { can: () => true } },
        { provide: ToastService, useValue: toast },
        { provide: DossiersRefreshStore, useValue: refresh },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    repondre();
  }

  /** Répond aux LECTURES en attente : dossier, gestes, demande, vague du store, projet de PV. Les décisions restent en attente. */
  function repondre(): void {
    let attente: TestRequest[];
    while ((attente = http.match((r) => r.method === 'GET')).length) {
      for (const req of attente) {
        const url = req.request.urlWithParams;
        demandees.push(`GET ${url}`);
        const demande = scenario.demande ?? DEMANDE;
        if ((url === '/api/dossiers/42' || url === '/api/dossiers/42/gestes') && scenario.relectureRefusee) req.flush({ message: 'x' }, { status: scenario.relectureRefusee, statusText: 'x' });
        else if (url === '/api/dossiers/42') req.flush(scenario.dossier ?? DOSSIER);
        else if (url === '/api/dossiers/42/gestes') req.flush(scenario.gestes);
        else if (url === '/api/demande-retraits/77') {
          if ('status' in demande) req.flush({ message: 'x' }, { status: demande.status, statusText: 'x' });
          else req.flush(demande);
        } else if (url === '/api/demande-retraits') req.flush(scenario.demandes ?? []);
        else if (url === '/api/pv-examens/12') req.flush(PV);
        else if (url.endsWith('/chronometrage')) req.flush(null);
        else req.flush([]);
      }
      harness.detectChanges();
    }
    harness.detectChanges();
  }

  // Aucune requête oubliée ; le module est réinitialisé même si la vérification échoue (pas d'échec en cascade).
  afterEach(() => {
    try {
      http.verify({ ignoreCancelled: true });
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('Président, demande seule : le formulaire sous le titre, le volet de la demande et sa lettre ; un seul geste marqué', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]) });

    expect(texte(q('.ec__titre'))).toBe('Retrait demandé par la PRMP');
    expect(q('app-etape-courante app-decision-retrait')).not.toBeNull();
    expect(q('.dr__titre')).toBeNull();
    expect(q('.dr')?.getAttribute('aria-labelledby')).toBe('ec-titre');
    // Parité : le geste servi est marqué une fois, sur le bouton principal du formulaire.
    expect(Array.from(racine().querySelectorAll('app-etape-courante [data-geste]')).map((b) => texte(b))).toEqual(['Accepter le retrait']);
    expect(bouton('Accepter le retrait').classList.contains('btn-primary')).toBe(true);
    const volet = texte(q('.dr-volet'));
    expect(volet).toContain(`La demande de la PRMP`);
    expect(volet).toContain(`Motif« ${MOTIF_PRMP} »`);
    expect(volet).toContain('Demandée le15/09 à 23:57');
    expect(volet).toContain('Ouvrir la lettre');
    // Ni phrase guide ni colonne de faits qui répéteraient le motif.
    expect(q('.ec__note')).toBeNull();
    expect(q('.ec__faits')).toBeNull();
    expect(demandees).toContain('GET /api/demande-retraits/77');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('lettre sans pièce (demande antérieure à la règle) ou lecture refusée : pas de bouton, un état discret, aucun toast', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]), demande: { ...DEMANDE, nomFichier: null } });
    expect(texte(q('.dr-volet'))).toContain('Aucune (demande antérieure au 17/08/2026)');
    TestBed.resetTestingModule();
    await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]), demande: { status: 403 } });
    expect(texte(q('.dr-volet'))).toContain('Indisponible');
    expect(toast.error).not.toHaveBeenCalled();
    // Les boutons de décision ne dépendent pas de cette lecture.
    expect(bouton('Accepter le retrait').disabled).toBe(false);
  });

  it('refus sans motif : un message sous le champ, ni confirmation ni requête ; motif saisi, la confirmation en modale', async () => {
    await ouvrir('CHEF_COMMISSION', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [retrait()]) }, 'CCANT01', 'ANT');

    cliquer('Refuser…');
    await tick();
    expect(document.activeElement).toBe(q('#dr-motif'));
    expect(texte(q('label[for="dr-motif"]'))).toBe('Motif du refus (obligatoire, communiqué à la PRMP)');

    for (const vide of ['', '   \n ']) {
      saisir(vide);
      cliquer('Refuser la demande');
      expect(texte(q('.dr__erreur'))).toBe('Indiquez le motif du refus : il est communiqué à la PRMP.');
      expect(q('#dr-motif')?.getAttribute('aria-invalid')).toBe('true');
      expect(q('#dr-motif')?.getAttribute('aria-describedby')).toBe('dr-motif-erreur');
      expect(document.activeElement).toBe(q('#dr-motif'));
      expect(q('[role="alertdialog"]')).toBeNull();
      expect(mutations()).toEqual([]);
    }

    // Le message suit la saisie : il s'efface dès qu'un motif valable est tapé.
    saisir('  Pièces justificatives insuffisantes  ');
    expect(q('.dr__erreur')).toBeNull();
    cliquer('Refuser la demande');
    const modale = q('[role="alertdialog"]');
    expect(modale?.getAttribute('aria-label')).toBe('Confirmer le refus de la demande de retrait');
    expect(modale?.hasAttribute('appmodale')).toBe(true);
    expect(texte(modale)).toContain('« Pièces justificatives insuffisantes »');
    expect(bouton('✕', modale as HTMLElement).getAttribute('aria-label')).toBe('Fermer');
    expect(mutations()).toEqual([]);

    cliquer('Annuler', modale as HTMLElement);
    expect(q('[role="alertdialog"]')).toBeNull();
    expect(mutations()).toEqual([]);
  });

  it('refus confirmé : le motif part, message de la liste, la page relit le dossier et ses gestes ; aucun formulaire fantôme entre-temps', async () => {
    await ouvrir('CHEF_COMMISSION', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [retrait()]) }, 'CCANT01', 'ANT');
    const corps = q('app-page-dossier-corps');
    cliquer('Refuser…');
    saisir('  Pièces justificatives insuffisantes  ');
    cliquer('Refuser la demande');
    demandees = [];
    scenario = { ...scenario, gestes: reponse('CHEF_COMMISSION', []) };
    cliquer('Confirmer le refus');

    const post = http.expectOne({ method: 'POST', url: '/api/demande-retraits/77/refuser' });
    expect(post.request.body).toEqual({ motif: 'Pièces justificatives insuffisantes' });
    post.flush({ ...DEMANDE, statut: 'REFUSEE' });
    harness.detectChanges();

    expect(toast.success).toHaveBeenCalledWith('Demande refusée.');
    expect(q('[role="alertdialog"]')).toBeNull();
    // Décision enregistrée, gestes pas encore relus : l'attente, sans bouton actif.
    expect(texte(q('.dr__attente'))).toBe('Décision enregistrée, mise à jour du dossier…');
    expect(racine().querySelectorAll('.dr button:not([disabled])').length).toBe(0);

    repondre();
    expect(demandees.sort()).toEqual(['GET /api/dossiers/42', 'GET /api/dossiers/42/gestes']);
    expect(refresh.notifierChangement).toHaveBeenCalledTimes(1);
    expect(q('app-page-dossier-corps')).toBe(corps);
    expect(q('app-decision-retrait')).toBeNull();
  });

  it('acceptation : un appel sans corps, message de la liste ; la page relue affiche le brouillon', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]) });
    scenario = { gestes: reponse('PRESIDENT', []), dossier: { ...DOSSIER, statut: 'BROUILLON', refeDossier: '00003/DGB/PPM/2026' } };
    cliquer('Accepter le retrait');
    expect(bouton('Acceptation…').disabled).toBe(true);
    http.expectOne({ method: 'POST', url: '/api/demande-retraits/77/accepter' }).flush({ ...DEMANDE, statut: 'ACCEPTEE' });
    harness.detectChanges();
    expect(toast.success).toHaveBeenCalledWith('Demande acceptée — dossier renvoyé en brouillon.');
    expect(q('.dr__attente')).not.toBeNull();

    repondre();
    expect(q('app-decision-retrait')).toBeNull();
    expect(texte(q('.ec__titre'))).toBe('Brouillon, pas encore soumis à la CNM');
    expect(texte(q('h1'))).toBe('00003/DGB/PPM/2026');
    expect(toast.error).not.toHaveBeenCalled();
  });

  describe('le dossier sort du périmètre du décideur à la relecture (403)', () => {
    it('CC qui accepte : la page dit que le retrait est accepté et le dossier revenu chez la PRMP — pas « hors de votre périmètre »', async () => {
      await ouvrir('CHEF_COMMISSION', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [retrait()]) }, 'CCANT01', 'ANT');
      scenario = { ...scenario, relectureRefusee: 403 };
      cliquer('Accepter le retrait');
      http.expectOne({ method: 'POST', url: '/api/demande-retraits/77/accepter' }).flush({ ...DEMANDE, statut: 'ACCEPTEE' });
      harness.detectChanges();
      repondre();
      const etat = texte(q('app-page-dossier .pd-retire'));
      expect(etat).toContain('Retrait accepté : le dossier est revenu en brouillon chez la PRMP.');
      expect(q('app-page-dossier .pd-retire')?.getAttribute('role')).toBe('status');
      // Une issue, pas une erreur : ni bloc d'erreur, ni « hors de votre périmètre ».
      expect(q('app-page-dossier app-etat-erreur')).toBeNull();
      expect(texte(racine())).not.toContain('hors de votre périmètre');
      expect(q('app-page-dossier-corps')).toBeNull();
      expect(q('.pd-ariane__retour')?.textContent).toContain('À faire');
      expect(toast.success).toHaveBeenCalledWith('Demande acceptée — dossier renvoyé en brouillon.');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('contre-épreuve — après un refus, un 403 reste « hors de votre périmètre »', async () => {
      await ouvrir('CHEF_COMMISSION', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [retrait()]) }, 'CCANT01', 'ANT');
      scenario = { ...scenario, relectureRefusee: 403 };
      cliquer('Refuser…');
      saisir('Pièces justificatives insuffisantes');
      cliquer('Refuser la demande');
      cliquer('Confirmer le refus');
      http.expectOne({ method: 'POST', url: '/api/demande-retraits/77/refuser' }).flush({ ...DEMANDE, statut: 'REFUSEE' });
      harness.detectChanges();
      repondre();
      expect(texte(q('app-page-dossier app-etat-erreur'))).toContain('Ce dossier est hors de votre périmètre.');
    });
  });

  it('conflit (409) : présenté par l’intercepteur, la page relit ; la demande encore servie, le formulaire revient', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]) });
    demandees = [];
    cliquer('Accepter le retrait');
    const message = 'Le dossier a progressé depuis la demande : la demande de retrait est caduque — refusez la demande.';
    http.expectOne({ method: 'POST', url: '/api/demande-retraits/77/accepter' }).flush({ status: 409, message }, { status: 409, statusText: 'Conflict' });
    harness.detectChanges();
    expect(toast.error).toHaveBeenCalledWith(message, expect.any(String));
    expect(toast.success).not.toHaveBeenCalled();
    repondre();
    expect(demandees).toEqual(expect.arrayContaining(['GET /api/dossiers/42/gestes']));
    expect(q('.dr__attente')).toBeNull();
    expect(bouton('Accepter le retrait').disabled).toBe(false);
  });

  describe('avec la navette du projet de PV : l’ordre du serveur', () => {
    const visa = (rang: number, mode: AFaireTache['mode']): AFaireTache => tache('PV_A_VISER', 'VISER', { gestesSecondaires: ['RETOURNER'], rang, mode, urgence: 'DANS_LES_DELAIS' });
    const avant = (a: Element | null, b: Element | null): boolean => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    it('CC : le retrait (titulaire) passe avant le visa par intérim — sous le titre ; la navette prend la rangée suivante', async () => {
      await ouvrir('CHEF_COMMISSION', '/cc/dossier/42', { gestes: reponse('CHEF_COMMISSION', [retrait({ rang: 1 }), visa(2, 'INTERIM')]), dossier: { ...DOSSIER, statut: 'EXAMINE' } }, 'CCANT01', 'ANT');
      expect(texte(q('.ec__titre'))).toBe('Retrait demandé par la PRMP');
      expect(avant(q('.dr'), q('.ep'))).toBe(true);
      expect(q('app-etape-pv')?.classList.contains('ep-hote--suite')).toBe(true);
      expect(q('app-decision-retrait')?.classList.contains('dr-hote--suite')).toBe(false);
      expect(q('.dr__titre')).toBeNull();
    });

    it('Président : le visa passe avant — la décision en suite, sous son intertitre, sans second bouton plein', async () => {
      await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [visa(1, 'TITULAIRE'), retrait({ rang: 2 })]), dossier: { ...DOSSIER, statut: 'EXAMINE' } });
      expect(texte(q('.ec__titre'))).toBe('Projet de PV en attente de visa');
      expect(avant(q('.ep'), q('.dr'))).toBe(true);
      expect(q('app-etape-pv')?.classList.contains('ep-hote--suite')).toBe(false);
      expect(q('app-decision-retrait')?.classList.contains('dr-hote--suite')).toBe(true);
      expect(texte(q('.dr__titre'))).toBe('Demande de retrait de la PRMP');
      expect(q('.dr')?.getAttribute('aria-labelledby')).toBe('dr-titre');
      expect(bouton('Accepter le retrait').classList.contains('btn-outline')).toBe(true);
      expect(Array.from(racine().querySelectorAll('app-etape-courante [data-geste]')).map((b) => b.getAttribute('data-geste')).sort()).toEqual(['DECIDER_RETRAIT', 'RETOURNER', 'VISER']);
    });
  });

  it('?geste=DECIDER_RETRAIT : le focus sur le formulaire, pas sur « Accepter » ; rien ne part. La barre collante ramène au bouton', async () => {
    await ouvrir('PRESIDENT', '/president/dossier/42?geste=DECIDER_RETRAIT', { gestes: reponse('PRESIDENT', [retrait()]) });
    await tick();
    expect(document.activeElement).toBe(q('.dr'));
    expect(mutations()).toEqual([]);

    (document.activeElement as HTMLElement).blur();
    (q('app-barre-collante button') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(bouton('Accepter le retrait'));
    expect(mutations()).toEqual([]);
  });

  describe('règle C2 — PRMP et UGPM, sur une doublure qui leur servirait la décision et des noms', () => {
    const DEMANDES: DemandeRetrait[] = [
      { ...DEMANDE, idDemandeRetrait: 5, statut: 'ACCEPTEE', imCtrlCc: 'PRESID1', dateDecision: '2026-08-01T10:00:00' },
      { ...DEMANDE, idDemandeRetrait: 9, statut: 'REFUSEE', imCtrlCc: 'CCANT01', dateDecision: '2026-09-16T08:30:00', obsDecision: 'Pièces justificatives insuffisantes' },
      { ...DEMANDE, idDemandeRetrait: 11, idDossier: 43, statut: 'EN_ATTENTE' },
    ];

    it('PRMP : ni formulaire ni lecture de la demande ; l’état de SA dernière demande, décidée par « la Commission nationale des marchés »', async () => {
      await ouvrir('PRMP', '/prmp/dossier/42', { gestes: reponse('PRMP', [retrait(), tache('EN_COURS_CNM', 'SUIVRE', { rang: 2, urgence: 'SUIVI' })]), demandes: DEMANDES }, 'PRMP001');
      expect(q('app-decision-retrait, .dr, .dr-volet')).toBeNull();
      expect(demandees.filter((d) => /demande-retraits\/\d+|mes-demandes/.test(d))).toEqual([]);
      expect(demandees.filter((d) => d === 'GET /api/demande-retraits')).toHaveLength(1);
      const suivi = texte(q('app-suivi-retrait'));
      expect(texte(q('app-suivi-retrait app-statut-badge'))).toBe('Refusée');
      expect(suivi).toContain('Demande de retrait refusée le 16/09 par la Commission nationale des marchés : le dossier poursuit son circuit.');
      expect(texte(q('.sr__motif'))).toBe('Motif du refus « Pièces justificatives insuffisantes »');
      const dom = toutLeDom();
      for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
    });

    it('UGPM : aucune requête de demande de retrait, aucun suivi, aucun nom', async () => {
      await ouvrir('UGPM', '/prmp/dossier/42', { gestes: reponse('UGPM', [retrait(), tache('EN_COURS_CNM', 'SUIVRE', { rang: 2, urgence: 'SUIVI' })]), demandes: DEMANDES }, 'PRMP001');
      expect(demandees.filter((d) => d.includes('demande-retraits'))).toEqual([]);
      expect(q('app-decision-retrait, app-suivi-retrait')).toBeNull();
      const dom = toutLeDom();
      for (const nom of CONTROLEURS) expect(dom, nom).not.toContain(nom);
    });

    it('contre-épreuve — Président : le formulaire, et aucun suivi « PRMP »', async () => {
      await ouvrir('PRESIDENT', '/president/dossier/42', { gestes: reponse('PRESIDENT', [retrait()]), demandes: DEMANDES });
      expect(q('app-decision-retrait')).not.toBeNull();
      expect(q('app-suivi-retrait')).toBeNull();
      expect(demandees).not.toContain('GET /api/demande-retraits');
    });
  });
});
