import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AnnuaireFiche, AnnuairePersonne, Localite, Page } from '../../models';
import { AnnuaireAdmin } from './annuaire-admin';

/**
 * Lot 6 F3 — l'annuaire des personnes.
 *
 * Quatre choses sont éprouvées ici, et les trois dernières comptent autant que la première :
 *
 * 1. ce que l'écran DIT d'une personne (identité, accès, place dans l'organisation, activité) ;
 * 2. **où part la recherche** : `q`, les filtres et la page sont des paramètres de REQUÊTE. Filtrer
 *    la seule page affichée est le défaut M15 de l'audit — sans ce test, rien n'empêcherait d'y
 *    revenir sans que personne ne s'en aperçoive avant la production ;
 * 3. ce qu'il **n'affiche pas** — la date d'activation d'une inscription refusée, les dossiers en
 *    cours de la maquette, et la dernière connexion **quand le serveur ne la sert pas**. Plan L6 §6 :
 *    « une mesure fausse sur un écran de sécurité est pire qu'une mesure absente ». ⚠️ Lot F5 : le
 *    test qui gardait l'absence des mesures de connexion a été RETOURNÉ — le besoin B4 est livré,
 *    elles s'affichent ; ce qui reste gardé, c'est qu'une dernière connexion **nulle** ne devienne
 *    jamais « jamais connecté », parce qu'elle veut seulement dire « pas depuis que le journal
 *    existe », et qu'au début c'est le cas de presque tout le monde ;
 * 4. que les **huit écrans** dont `/admin/comptes` était le seul chemin restent joignables. C'est le
 *    défaut §1.2 du plan : ce lot doit le corriger, surtout pas le déplacer.
 */
const PERSONNES: AnnuairePersonne[] = [
  {
    ref: 'CTR0142',
    type: 'CONTROLEUR',
    nom: 'RAKOTOMALALA',
    prenoms: 'Mamy',
    profil: 'MEMBRE',
    localite: 'ANT',
    entite: null,
    login: 'm.rakotomalala',
    statutCompte: 'ACTIF',
  },
  {
    ref: 'PRMP000001',
    type: 'PRMP',
    nom: 'RANDRIANARISOA',
    prenoms: 'Hanta',
    profil: null,
    localite: null,
    entite: 'Direction générale du contrôle financier',
    login: null,
    statutCompte: 'SANS_COMPTE',
  },
];

const LOCALITES: Localite[] = [
  { idLocalite: 'ANT', libelleLocalite: 'Centrale' },
  { idLocalite: 'FIA', libelleLocalite: 'Fianarantsoa' },
];

const FICHE: AnnuaireFiche = {
  ...PERSONNES[0],
  dateActivation: '2026-03-14T09:30:00',
  derniereConnexion: '2026-09-16T08:12:00',
  echecs30j: 3,
  superieur: { ref: 'CTRCC1', nom: 'RANDRIANARISOA', prenoms: 'Paul', profil: 'CHEF_COMMISSION', localite: 'ANT' },
  transversal: false,
  chaineControle: [
    { ref: 'CTR0142', nom: 'RAKOTOMALALA', prenoms: 'Mamy', profil: 'MEMBRE', lui: true },
    { ref: 'CTRVER1', nom: 'RASOARIMALALA', prenoms: 'Noro', profil: 'VERIFICATEUR', lui: false },
  ],
  delegations: [{ sens: 'EXERCEE_PAR', profil: 'CHEF_COMMISSION' }],
  mandat: null,
  actionsJournal30j: 112,
};

function page(contenu: AnnuairePersonne[], total = contenu.length, index = 0): Page<AnnuairePersonne> {
  return { content: contenu, totalElements: total, totalPages: Math.max(1, Math.ceil(total / 15)), number: index, size: 15 };
}

describe("AnnuaireAdmin — l'annuaire des personnes", () => {
  let fixture: ComponentFixture<AnnuaireAdmin>;
  let http: HttpTestingController;

  /** Monte l'écran et répond aux deux lectures d'ouverture ; `null` sur la liste simule l'échec du serveur. */
  function monter(options: { liste?: Page<AnnuairePersonne> | null; localites?: Localite[] } = {}): AnnuaireAdmin {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AnnuaireAdmin);
    fixture.detectChanges();

    const liste = http.expectOne((r) => r.url === '/api/annuaire');
    if (options.liste === null) {
      liste.flush('indisponible', { status: 500, statusText: 'Server Error' });
    } else {
      liste.flush(options.liste ?? page(PERSONNES));
    }
    http.expectOne('/api/localites').flush(options.localites ?? LOCALITES);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  /** Ouvre la fiche d'une personne de la liste et répond. `null` = 404, `false` = panne serveur. */
  function ouvrir(ecran: AnnuaireAdmin, p: AnnuairePersonne, reponse: AnnuaireFiche | null | false = FICHE): void {
    ecran.selectionner(p);
    fixture.detectChanges();
    const req = http.expectOne(`/api/annuaire/${p.type}/${p.ref}`);
    if (reponse === null) {
      req.flush('inconnu', { status: 404, statusText: 'Not Found' });
    } else if (reponse === false) {
      req.flush('boum', { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(reponse);
    }
    fixture.detectChanges();
  }

  const texte = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const liens = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));

  afterEach(() => {
    // `finally` : sans lui, un `verify()` qui échoue laisse le TestBed instancié et TOUS les tests
    // suivants tombent sur « already instantiated » — le vrai échec disparaît dans la cascade.
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  // ───────────────────────── La liste ─────────────────────────

  it('ouvre sur la première page de l’annuaire, et dit combien de personnes il porte', () => {
    const ecran = monter({ liste: page(PERSONNES, 42) });
    expect(ecran.personnes().length).toBe(2);
    expect(texte()).toContain('42 personnes');
    expect(texte()).toContain('RAKOTOMALALA Mamy');
    expect(texte()).toContain('RANDRIANARISOA Hanta');
  });

  it('compose « ANT — Centrale » : le serveur ne sert que le CODE de localité', () => {
    monter();
    expect(texte()).toContain('ANT — Centrale');
  });

  it('le code reste lisible seul si le référentiel des localités n’a pas répondu', () => {
    monter({ localites: [] });
    expect(texte()).toContain('ANT');
    expect(texte()).not.toContain('ANT — ');
  });

  it("une PRMP n'a pas de localité : c'est son entité de rattachement qui la situe", () => {
    monter();
    expect(texte()).toContain('Direction générale du contrôle financier');
  });

  // ───────────────────────── M15 : la recherche part au SERVEUR ─────────────────────────

  it('envoie `q` AU SERVEUR — et ne filtre jamais la seule page affichée (audit M15)', () => {
    vi.useFakeTimers();
    const ecran = monter();
    const avant = ecran.personnes();

    ecran.filtres.controls.q.setValue('herivelo');
    vi.advanceTimersByTime(400);
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/api/annuaire' && r.params.get('q') === 'herivelo');
    // La liste affichée n'a PAS bougé tant que le serveur n'a pas répondu : rien n'est filtré ici.
    expect(ecran.personnes()).toBe(avant);
    req.flush(page([]));
    fixture.detectChanges();
    expect(ecran.personnes()).toEqual([]);
  });

  it('les quatre critères partent au serveur, et seuls les critères renseignés', () => {
    const ecran = monter();

    ecran.filtres.controls.statut.setValue('SUSPENDU');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/annuaire' && r.params.get('statut') === 'SUSPENDU');
    // Un paramètre vide partirait tel quel et finirait en 400 sur un énuméré : il est omis.
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.has('profil')).toBe(false);
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
  });

  it('changer de population EFFACE profil et localité — et ne lance qu’UNE requête', () => {
    const ecran = monter();
    ecran.filtres.controls.profil.setValue('MEMBRE');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/annuaire' && r.params.get('profil') === 'MEMBRE').flush(page([]));

    ecran.filtres.controls.type.setValue('PRMP');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/api/annuaire');
    expect(req.request.params.get('type')).toBe('PRMP');
    expect(req.request.params.has('profil')).toBe(false);
    expect(ecran.filtresDeControleur()).toBe(false);
    req.flush(page([]));
  });

  it('« Tout afficher » efface les cinq critères en UNE seule lecture', () => {
    const ecran = monter();
    ecran.filtres.patchValue({ q: 'rakoto', type: 'CONTROLEUR', profil: 'MEMBRE', localite: 'ANT', statut: 'ACTIF' }, { emitEvent: false });

    ecran.reinitialiser();
    // Cinq critères effacés = cinq `valueChanges` si la remise à zéro était bruyante.
    const req = http.expectOne((r) => r.url === '/api/annuaire');
    expect(req.request.params.keys().sort()).toEqual(['page', 'size']);
    req.flush(page(PERSONNES));
    fixture.detectChanges();
    expect(ecran.filtreActif()).toBe(false);
  });

  it('la page suivante est demandée au serveur, filtres conservés', () => {
    const ecran = monter({ liste: page(PERSONNES, 42) });
    ecran.pageSuivante();
    const req = http.expectOne((r) => r.url === '/api/annuaire');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('15');
    req.flush(page(PERSONNES, 42, 1));
  });

  // ───────────────────────── Chargement, erreur, vide (audit M16) ─────────────────────────

  it("l'échec de la liste laisse un état d'erreur avec reprise, pas un écran vide", () => {
    const ecran = monter({ liste: null });
    expect(ecran.erreur()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-etat-erreur')).not.toBeNull();
    expect(texte()).toContain("L'annuaire n'a pas pu être chargé.");

    ecran.recharger();
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/annuaire').flush(page(PERSONNES));
    fixture.detectChanges();
    expect(ecran.erreur()).toBe(false);
  });

  it('un annuaire vide le DIT, et une recherche sans résultat dit autre chose', () => {
    monter({ liste: page([]) });
    expect(texte()).toContain("L'annuaire est vide");

    fixture.componentInstance.filtres.controls.statut.setValue('REFUSE');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/annuaire').flush(page([]));
    fixture.detectChanges();
    expect(texte()).toContain('Aucune personne ne correspond à cette recherche.');
  });

  it("la fiche a son état vide tant qu'aucune personne n'est choisie", () => {
    monter();
    expect(texte()).toContain('Choisissez une personne dans la liste');
  });

  it("l'échec de la fiche n'emporte pas la liste, et se rejoue", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], false);
    expect(ecran.ficheErreur()).toBe(true);
    expect(ecran.ficheIntrouvable()).toBe(false);
    expect(ecran.personnes().length).toBe(2);
    expect(texte()).toContain("La fiche n'a pas pu être chargée.");

    ecran.rechargerFiche();
    fixture.detectChanges();
    http.expectOne('/api/annuaire/CONTROLEUR/CTR0142').flush(FICHE);
    fixture.detectChanges();
    expect(ecran.ficheErreur()).toBe(false);
  });

  it("une personne disparue (404) ne propose PAS de réessayer : rien n'y changerait", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], null);
    expect(ecran.ficheIntrouvable()).toBe(true);
    expect(texte()).toContain("Cette personne n'existe plus dans l'annuaire.");
    expect(texte()).not.toContain('Réessayer');
  });

  // ───────────────────────── La fiche ─────────────────────────

  it("la fiche réunit l'accès, la place dans l'organisation et l'activité", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(texte()).toContain('m.rakotomalala');
    expect(texte()).toContain('ouvert le 14/03/2026');
    expect(texte()).toContain('RANDRIANARISOA Paul');
    expect(texte()).toContain('112 écritures portées à son nom');
  });

  it('dit la délégation DANS SON SENS : exercer, ou être exercé par', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(texte()).toContain('Ses tâches peuvent être exercées par Chef de commission');
  });

  it('affiche la chaîne de contrôle avec la personne en tête', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(texte()).toContain('Membre — lui');
    expect(texte()).toContain('RASOARIMALALA');
  });

  it("une chaîne d'un seul maillon est dite incomplète — c'est un état NORMAL, pas une erreur", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, chaineControle: [FICHE.chaineControle[0]] });
    expect(texte()).toContain('Chaîne incomplète');
    expect(texte()).toContain('repli par localité');
  });

  it("une UGPM ne se voit attribuer aucun mandat : elle travaille sous celui de sa tutelle", () => {
    const ecran = monter();
    const ugpm: AnnuairePersonne = { ...PERSONNES[1], ref: 'UGPM000001', type: 'UGPM', login: 'u.dgcf', statutCompte: 'ACTIF' };
    ouvrir(ecran, ugpm, {
      ...FICHE,
      ...ugpm,
      profil: null,
      localite: null,
      superieur: null,
      transversal: null,
      chaineControle: [],
      delegations: [],
      mandat: null,
    });
    expect(texte()).toContain('Entité de tutelle');
    expect(texte()).toContain('sous le mandat de sa PRMP de tutelle');
  });

  // ───────────────────────── Gestes de compte (modale de F4) ─────────────────────────

  it('un compte actif peut être suspendu et réinitialisé, sans saisir son login', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(ecran.gestesDeCompte()).toBe(true);
    expect(texte()).toContain('Suspendre le compte');
    expect(texte()).toContain('Réinitialiser le mot de passe');

    ecran.ouvrirCompte();
    fixture.detectChanges();
    // La modale de F4 est REPRISE telle quelle ; l'annuaire lui donne le login, qu'elle n'avait pas.
    const modale = (fixture.nativeElement as HTMLElement).querySelector('app-actions-compte');
    expect(modale).not.toBeNull();
    expect(modale?.textContent).toContain('m.rakotomalala');
    http.expectOne('/api/comptes-auth/en-attente').flush([]);
    fixture.detectChanges();
  });

  it('un compte suspendu propose la réactivation, pas une seconde suspension', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, statutCompte: 'SUSPENDU' });
    expect(texte()).toContain('Réactiver le compte');
    expect(texte()).not.toContain('Suspendre le compte');
  });

  it("une inscription EN ATTENTE n'offre aucun geste de compte : elle s'instruit ailleurs", () => {
    // « Réactiver » poserait ACTIF = true et ouvrirait l'accès à une demande jamais acceptée.
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, statutCompte: 'EN_ATTENTE', dateActivation: null });
    expect(ecran.gestesDeCompte()).toBe(false);
    expect(texte()).not.toContain('Réactiver le compte');
    expect(texte()).toContain("se valide ou se refuse depuis « Demandes d'accès »");
  });

  it('une personne sans compte ne propose ni suspension ni réinitialisation', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[1], {
      ...FICHE,
      ...PERSONNES[1],
      dateActivation: null,
      superieur: null,
      transversal: null,
      chaineControle: [],
      delegations: [],
    });
    expect(ecran.gestesDeCompte()).toBe(false);
    expect(texte()).toContain('aucun compte de connexion');
  });

  // ───────────────────────── Les huit écrans (défaut §1.2 du plan) ─────────────────────────

  it("porte le chemin des HUIT écrans que le sommaire était seul à donner", () => {
    monter();
    const attendus = [
      '/admin/comptes/controleurs',
      '/admin/comptes/prmps',
      '/admin/comptes/ugpms',
      '/admin/comptes/organigrammes',
      '/admin/comptes/prmp-entites',
      '/admin/comptes/mandats',
      '/admin/comptes/prmp-pieces',
      '/admin/comptes/ugpm-pieces',
    ];
    const rendus = liens();
    for (const chemin of attendus) {
      expect(rendus).toContain(chemin);
    }
  });

  it("la fiche mène en CONTEXTE aux écrans que la personne concerne", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(liens()).toContain('/admin/comptes/controleurs');
    expect(liens()).toContain('/admin/chaines-controle');

    ouvrir(ecran, PERSONNES[1], {
      ...FICHE,
      ...PERSONNES[1],
      dateActivation: null,
      superieur: null,
      transversal: null,
      chaineControle: [],
      delegations: [],
    });
    // Les deux écrans de PRMP s'ouvrent déjà filtrés sur elle (`?prmp=`).
    expect(liens()).toContain('/admin/comptes/prmp-entites?prmp=PRMP000001');
    expect(liens()).toContain('/admin/comptes/prmp-pieces?prmp=PRMP000001');
    expect(liens()).toContain('/admin/comptes/mandats');
  });

  // ───────────────────────── Ce qui n'est PAS affiché (plan L6, §6) ─────────────────────────

  it('affiche la dernière connexion et les échecs sur 30 jours — leur source existe (B4)', () => {
    // ⚠️ Test RETOURNÉ (lot F5) : il gardait leur absence tant que le serveur les servait nulles
    // par construction. Il garde maintenant leur présence, à l'instant près pour la connexion —
    // à la journée près, « le 16/09 » ne distinguerait plus ce matin de cette nuit.
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(texte()).toContain('Dernière connexion');
    expect(texte()).toContain('16/09/2026 08:12');
    expect(texte()).toContain('Échecs (30 j)');
    expect(texte()).toContain('3 tentatives refusées');
  });

  it("ne dit PAS « jamais connecté » quand la dernière connexion est nulle : la ligne disparaît", () => {
    // Nulle veut dire « pas de connexion DEPUIS QUE LE JOURNAL EXISTE » — au début, presque tout le
    // monde. « Jamais connecté » affirmerait ce que personne ne sait.
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, derniereConnexion: null });
    expect(texte()).not.toContain('Dernière connexion');
    expect(texte()).not.toContain('jamais connecté');
    // `echecs30j` vaut 0, plus null : cette ligne-là reste, parce que zéro est une mesure.
    expect(texte()).toContain('Échecs (30 j)');
  });

  it('zéro échec s’écrit en toutes lettres — ce n’est pas un trou dans la fiche', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, echecs30j: 0 });
    expect(texte()).toContain('aucune tentative refusée');
  });

  it('« Ses connexions » ouvre le journal des connexions filtré sur la personne', () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(liens()).toContain('/admin/audit?journal=connexions&acteur=CTR0142');
  });

  it("n'invente pas de date d'activation pour une inscription REFUSÉE", () => {
    // `DATE_DECISION` porte alors la date du REFUS : le serveur la tait, l'écran ne la réclame pas.
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0], { ...FICHE, statutCompte: 'REFUSE', dateActivation: null });
    expect(texte()).toContain('Inscription refusée');
    expect(texte()).not.toContain('ouvert le');
  });

  it("n'affiche pas les « dossiers en cours » de la maquette : aucune route ne les sert", () => {
    const ecran = monter();
    ouvrir(ecran, PERSONNES[0]);
    expect(texte()).toContain('Activité');
    expect(texte()).not.toContain('Dossiers en cours');
  });

  it("ne lance que les deux lectures d'ouverture — aucun appel de rattrapage", () => {
    monter();
    http.expectNone(() => true);
  });
});
